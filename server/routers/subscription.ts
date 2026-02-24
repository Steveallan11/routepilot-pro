import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getStripe } from "../stripe/client";
import { STRIPE_PRODUCTS, FREE_LIMITS, type PlanId } from "../stripe/products";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { users, usageCounters } from "../../drizzle/schema";

export const subscriptionRouter = router({
  // Get current subscription status
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    const isPro = user.subscriptionTier === "pro";
    const isExpired = user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt) < new Date()
      : false;

    return {
      tier: isPro && !isExpired ? "pro" : "free",
      isPro: isPro && !isExpired,
      expiresAt: user.subscriptionExpiresAt,
      stripeSubscriptionId: user.stripeSubscriptionId,
      limits: FREE_LIMITS,
    };
  }),

  // Get usage counters for free tier
  usage: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7);

    if (!db) return { aiScansThisMonth: 0, routeSearchesToday: 0, monthKey, today };

    const [counter] = await db.select().from(usageCounters)
      .where(eq(usageCounters.userId, ctx.user.id)).limit(1);

    if (!counter) return { aiScansThisMonth: 0, routeSearchesToday: 0, monthKey, today };

    const routeSearchesToday =
      counter.routeSearchDate === today ? counter.routeSearchesToday : 0;
    const aiScansThisMonth =
      counter.monthKey === monthKey ? counter.aiScansThisMonth : 0;

    return { aiScansThisMonth, routeSearchesToday, monthKey, today };
  }),

  // Create Stripe checkout session
  createCheckout: protectedProcedure
    .input(z.object({ planId: z.enum(["pro_monthly", "pro_annual"]), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const plan = STRIPE_PRODUCTS[input.planId as PlanId];
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get or create Stripe customer
      const [userRow] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      let stripeCustomerId = userRow?.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: ctx.user.email ?? undefined,
          name: ctx.user.name ?? undefined,
          metadata: { userId: String(ctx.user.id) },
        });
        stripeCustomerId = customer.id;
        await db.update(users)
          .set({ stripeCustomerId })
          .where(eq(users.id, ctx.user.id));
      }

      // Create price on the fly if no priceId configured
      let priceId = plan.priceId;
      if (!priceId) {
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceGBP,
          currency: "gbp",
          recurring: { interval: plan.interval },
        });
        priceId = price.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${input.origin}/settings?tab=subscription&success=1`,
        cancel_url: `${input.origin}/settings?tab=subscription&cancelled=1`,
        allow_promotion_codes: true,
        client_reference_id: String(ctx.user.id),
        metadata: {
          user_id: String(ctx.user.id),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          plan_id: input.planId,
        },
      });

      return { url: session.url };
    }),

  // Create Stripe billing portal session
  createPortal: protectedProcedure
    .input(z.object({ origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${input.origin}/settings?tab=subscription`,
      });

      return { url: session.url };
    }),
});
