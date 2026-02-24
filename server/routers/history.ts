import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, jobChains } from "../../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export const historyRouter = router({
  // Summary stats for a date range
  summary: protectedProcedure
    .input(z.object({
      period: z.enum(["day", "week", "month", "all"]).default("week"),
      date: z.string().optional(), // ISO date string for the reference date
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const now = input.date ? new Date(input.date) : new Date();
      let startDate: Date;

      switch (input.period) {
        case "day":
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(0);
      }

      const completedJobs = await db.select().from(jobs)
        .where(and(
          eq(jobs.userId, ctx.user.id),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, startDate)
        ))
        .orderBy(desc(jobs.completedAt));

      const totalEarnings = completedJobs.reduce((sum, j) => sum + j.deliveryFee + j.fuelDeposit, 0);
      const totalFuelCost = completedJobs.reduce((sum, j) => sum + (j.actualFuelCost ?? j.estimatedFuelCost ?? 0), 0);
      const totalNetProfit = completedJobs.reduce((sum, j) => sum + (j.actualNetProfit ?? j.estimatedNetProfit ?? 0), 0);
      const totalMiles = completedJobs.reduce((sum, j) => sum + (j.actualDistanceMiles ?? j.estimatedDistanceMiles ?? 0), 0);
      const totalMins = completedJobs.reduce((sum, j) => sum + (j.actualDurationMins ?? j.estimatedDurationMins ?? 0), 0);

      return {
        period: input.period,
        jobCount: completedJobs.length,
        totalEarnings,
        totalFuelCost,
        totalNetProfit,
        totalMiles,
        totalMins,
        profitPerHour: totalMins > 0 ? (totalNetProfit / totalMins) * 60 : 0,
        profitPerMile: totalMiles > 0 ? totalNetProfit / totalMiles : 0,
        jobs: completedJobs,
      };
    }),

  // Daily breakdown for chart
  dailyBreakdown: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const completedJobs = await db.select().from(jobs)
        .where(and(
          eq(jobs.userId, ctx.user.id),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, startDate)
        ))
        .orderBy(desc(jobs.completedAt));

      // Group by date
      const byDate: Record<string, { earnings: number; profit: number; jobs: number }> = {};

      for (const job of completedJobs) {
        if (!job.completedAt) continue;
        const dateKey = job.completedAt.toISOString().split("T")[0]!;
        if (!byDate[dateKey]) byDate[dateKey] = { earnings: 0, profit: 0, jobs: 0 };
        byDate[dateKey]!.earnings += job.deliveryFee;
        byDate[dateKey]!.profit += job.actualNetProfit ?? job.estimatedNetProfit ?? 0;
        byDate[dateKey]!.jobs += 1;
      }

      return Object.entries(byDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }),
});
