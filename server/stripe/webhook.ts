import type { Request, Response } from "express";
import Stripe from "stripe";
import { getStripe } from "./client";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";

export async function stripeWebhookHandler(req: Request, res: Response) {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret ?? "");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return res.status(400).json({ error: `Webhook Error: ${message}` });
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} (${event.id})`);

  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available");
    return res.status(500).json({ error: "Database unavailable" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.metadata?.user_id ?? "0");
        if (!userId) break;

        if (session.mode === "subscription" && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          // current_period_end is a unix timestamp in the Stripe API
          const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end;
          const expiresAt = new Date(periodEnd * 1000);

          await db.update(users)
            .set({
              subscriptionTier: "pro",
              stripeSubscriptionId: session.subscription as string,
              subscriptionExpiresAt: expiresAt,
            })
            .where(eq(users.id, userId));

          console.log(`[Stripe] User ${userId} upgraded to Pro, expires ${expiresAt.toISOString()}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const user = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
        if (!user[0]) break;

        const isActive = sub.status === "active" || sub.status === "trialing";
        const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end;
        const expiresAt = new Date(periodEnd * 1000);

        await db.update(users)
          .set({
            subscriptionTier: isActive ? "pro" : "free",
            stripeSubscriptionId: sub.id,
            subscriptionExpiresAt: isActive ? expiresAt : null,
          })
          .where(eq(users.id, user[0].id));

        console.log(`[Stripe] User ${user[0].id} subscription updated: ${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const user = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
        if (!user[0]) break;

        await db.update(users)
          .set({
            subscriptionTier: "free",
            stripeSubscriptionId: null,
            subscriptionExpiresAt: null,
          })
          .where(eq(users.id, user[0].id));

        console.log(`[Stripe] User ${user[0].id} subscription cancelled`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`[Stripe] Payment failed for customer: ${invoice.customer}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
