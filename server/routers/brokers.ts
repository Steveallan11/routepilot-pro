import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { brokers, jobs } from "../../drizzle/schema";

export const brokersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(brokers)
      .where(eq(brokers.userId, ctx.user.id))
      .orderBy(desc(brokers.createdAt));
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const brokerList = await db.select().from(brokers)
      .where(eq(brokers.userId, ctx.user.id));

    const stats = await Promise.all(brokerList.map(async (broker) => {
      const jobList = await db.select().from(jobs)
        .where(and(
          eq(jobs.userId, ctx.user.id),
          eq(jobs.brokerId, broker.id)
        ));

      const totalJobs = jobList.length;
      const totalEarned = jobList.reduce((sum, j) => sum + (Number(j.estimatedNetProfit) || 0), 0);
      const totalMiles = jobList.reduce((sum, j) => sum + (Number(j.estimatedDistanceMiles) || 0), 0);
      const avgPerJob = totalJobs > 0 ? totalEarned / totalJobs : 0;
      const avgPerMile = totalMiles > 0 ? totalEarned / totalMiles : 0;

      return {
        ...broker,
        totalJobs,
        totalEarned: Math.round(totalEarned * 100) / 100,
        totalMiles: Math.round(totalMiles * 100) / 100,
        avgPerJob: Math.round(avgPerJob * 100) / 100,
        avgPerMile: Math.round(avgPerMile * 100) / 100,
      };
    }));

    return stats.sort((a, b) => b.totalEarned - a.totalEarned);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      feePercent: z.number().min(0).max(100).default(0),
      feeFixed: z.number().min(0).default(0),
      notes: z.string().optional(),
      website: z.string().url().optional(),
      phone: z.string().max(20).optional(),
      rating: z.number().min(1).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [result] = await db.insert(brokers).values({
        userId: ctx.user.id,
        name: input.name,
        feePercent: input.feePercent as unknown as number,
        feeFixed: input.feeFixed as unknown as number,
        notes: input.notes,
        website: input.website,
        phone: input.phone,
        rating: input.rating,
      });

      return { id: result.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      feePercent: z.number().min(0).max(100).optional(),
      feeFixed: z.number().min(0).optional(),
      notes: z.string().optional(),
      website: z.string().url().optional(),
      phone: z.string().max(20).optional(),
      rating: z.number().min(1).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...updates } = input;
      await db.update(brokers)
        .set(updates as Record<string, unknown>)
        .where(and(eq(brokers.id, id), eq(brokers.userId, ctx.user.id)));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(brokers)
        .where(and(eq(brokers.id, input.id), eq(brokers.userId, ctx.user.id)));

      return { success: true };
    }),
});
