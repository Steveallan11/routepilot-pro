import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, and, desc, gte } from "drizzle-orm";
import { lifts, liftRequests, notifications, users } from "../../drizzle/schema";
import { LIFT_PLATFORM_FEE_PERCENT } from "../stripe/products";

export const liftsRouter = router({
  // Browse available lifts
  list: protectedProcedure
    .input(z.object({
      fromPostcode: z.string().optional(),
      toPostcode: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const now = new Date();
      const allLifts = await db.select({
        lift: lifts,
        driverName: users.name,
      })
        .from(lifts)
        .leftJoin(users, eq(lifts.userId, users.id))
        .where(and(
          eq(lifts.status, "active"),
          gte(lifts.departureTime, now)
        ))
        .orderBy(lifts.departureTime);

      return allLifts.map(({ lift, driverName }) => ({
        ...lift,
        driverName: driverName ?? "Driver",
        platformFeePercent: LIFT_PLATFORM_FEE_PERCENT,
        isOwn: lift.userId === ctx.user.id,
      }));
    }),

  // Post a new lift
  post: protectedProcedure
    .input(z.object({
      fromPostcode: z.string().min(2).max(10),
      fromLabel: z.string().max(100).optional(),
      toPostcode: z.string().min(2).max(10),
      toLabel: z.string().max(100).optional(),
      departureTime: z.string(), // ISO string
      seats: z.number().min(1).max(8).default(1),
      pricePerSeat: z.number().min(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(lifts).values({
        userId: ctx.user.id,
        fromPostcode: input.fromPostcode.toUpperCase(),
        fromLabel: input.fromLabel,
        toPostcode: input.toPostcode.toUpperCase(),
        toLabel: input.toLabel,
        departureTime: new Date(input.departureTime),
        seats: input.seats,
        pricePerSeat: input.pricePerSeat as unknown as number,
        notes: input.notes,
      });

      return { id: result.insertId };
    }),

  // Get my lifts (posted and requested)
  myLifts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { posted: [], requested: [] };

    const posted = await db.select().from(lifts)
      .where(eq(lifts.userId, ctx.user.id))
      .orderBy(desc(lifts.createdAt));

    const requested = await db.select({
      request: liftRequests,
      lift: lifts,
      driverName: users.name,
    })
      .from(liftRequests)
      .leftJoin(lifts, eq(liftRequests.liftId, lifts.id))
      .leftJoin(users, eq(lifts.userId, users.id))
      .where(eq(liftRequests.requesterId, ctx.user.id))
      .orderBy(desc(liftRequests.createdAt));

    return {
      posted,
      requested: requested.map(({ request, lift, driverName }) => ({
        ...request,
        lift,
        driverName: driverName ?? "Driver",
      })),
    };
  }),

  // Request a lift
  request: protectedProcedure
    .input(z.object({
      liftId: z.number(),
      message: z.string().max(500).optional(),
      seatsRequested: z.number().min(1).max(8).default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [lift] = await db.select().from(lifts)
        .where(eq(lifts.id, input.liftId)).limit(1);

      if (!lift) throw new TRPCError({ code: "NOT_FOUND" });
      if (lift.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot request your own lift" });
      }
      if (lift.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This lift is no longer available" });
      }
      if (input.seatsRequested > lift.seats) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough seats available" });
      }

      const totalPrice = Number(lift.pricePerSeat) * input.seatsRequested;
      const platformFee = (totalPrice * LIFT_PLATFORM_FEE_PERCENT) / 100;

      const [result] = await db.insert(liftRequests).values({
        liftId: input.liftId,
        requesterId: ctx.user.id,
        message: input.message,
        seatsRequested: input.seatsRequested,
        totalPrice: totalPrice as unknown as number,
      });

      // Notify the driver
      const [requester] = await db.select().from(users)
        .where(eq(users.id, ctx.user.id)).limit(1);

      await db.insert(notifications).values({
        userId: lift.userId,
        type: "lift_request",
        title: "New lift request",
        body: `${requester?.name ?? "Someone"} wants to join your lift from ${lift.fromPostcode} to ${lift.toPostcode}`,
        data: { liftId: input.liftId, requestId: result.insertId },
      });

      return { id: result.insertId, totalPrice, platformFee };
    }),

  // Accept or reject a request
  respondToRequest: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      accept: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [request] = await db.select({
        request: liftRequests,
        lift: lifts,
      })
        .from(liftRequests)
        .leftJoin(lifts, eq(liftRequests.liftId, lifts.id))
        .where(eq(liftRequests.id, input.requestId))
        .limit(1);

      if (!request?.lift) throw new TRPCError({ code: "NOT_FOUND" });
      if (request.lift.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const newStatus = input.accept ? "accepted" : "rejected";
      await db.update(liftRequests)
        .set({ status: newStatus })
        .where(eq(liftRequests.id, input.requestId));

      // Notify the requester
      await db.insert(notifications).values({
        userId: request.request.requesterId,
        type: input.accept ? "lift_accepted" : "lift_rejected",
        title: input.accept ? "Lift request accepted!" : "Lift request declined",
        body: input.accept
          ? `Your lift request from ${request.lift.fromPostcode} to ${request.lift.toPostcode} has been accepted.`
          : `Your lift request from ${request.lift.fromPostcode} to ${request.lift.toPostcode} was declined.`,
        data: { liftId: request.lift.id, requestId: input.requestId },
      });

      return { success: true };
    }),

  // Cancel a lift
  cancel: protectedProcedure
    .input(z.object({ liftId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(lifts)
        .set({ status: "cancelled" })
        .where(and(eq(lifts.id, input.liftId), eq(lifts.userId, ctx.user.id)));

      return { success: true };
    }),
});
