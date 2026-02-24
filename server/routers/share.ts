import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobChains, chainJobs, jobs } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

export const shareRouter = router({
  // Public: get a shared chain by token
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [chain] = await db.select().from(jobChains)
        .where(eq(jobChains.shareToken, input.token))
        .limit(1);

      if (!chain) return null;

      // Check expiry
      if (chain.shareExpiresAt && chain.shareExpiresAt < new Date()) {
        return { expired: true };
      }

      const cjRows = await db.select().from(chainJobs).where(eq(chainJobs.chainId, chain.id));
      const jobIds = cjRows.sort((a, b) => a.position - b.position).map(r => r.jobId);
      const jobList = jobIds.length > 0
        ? await db.select().from(jobs).where(inArray(jobs.id, jobIds))
        : [];

      // Return sanitised data (no user info)
      return {
        expired: false,
        chain: {
          name: chain.name,
          totalEarnings: chain.totalEarnings,
          totalCosts: chain.totalCosts,
          totalNetProfit: chain.totalNetProfit,
          totalDurationMins: chain.totalDurationMins,
          totalDistanceMiles: chain.totalDistanceMiles,
          profitPerHour: chain.profitPerHour,
          riskFlags: chain.riskFlags,
          repositionLegs: chain.repositionLegs,
          scheduledDate: chain.scheduledDate,
          createdAt: chain.createdAt,
        },
        jobs: jobList.map(j => ({
          pickupPostcode: j.pickupPostcode,
          dropoffPostcode: j.dropoffPostcode,
          deliveryFee: j.deliveryFee,
          estimatedDistanceMiles: j.estimatedDistanceMiles,
          estimatedDurationMins: j.estimatedDurationMins,
          estimatedNetProfit: j.estimatedNetProfit,
          worthItScore: j.worthItScore,
        })),
      };
    }),
});
