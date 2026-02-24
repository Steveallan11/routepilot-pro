import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobChains, chainJobs, jobs, userSettings } from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { makeRequest } from "../_core/map";
import { calculateJobCost } from "../../shared/routepilot-types";
import axios from "axios";
import { nanoid } from "nanoid";

const TRANSPORT_API_BASE = "https://transportapi.com/v3/uk";
const TRANSPORT_APP_ID = process.env.TRANSPORT_APP_ID ?? "";
const TRANSPORT_APP_KEY = process.env.TRANSPORT_APP_KEY ?? "";

async function getTransportRoute(fromPostcode: string, toPostcode: string) {
  // If no TransportAPI credentials, return mock data
  if (!TRANSPORT_APP_ID || !TRANSPORT_APP_KEY) {
    return getMockTransportRoute(fromPostcode, toPostcode);
  }

  try {
    const response = await axios.get(`${TRANSPORT_API_BASE}/public/journey/from/postcode:${fromPostcode}/to/postcode:${toPostcode}.json`, {
      params: {
        app_id: TRANSPORT_APP_ID,
        app_key: TRANSPORT_APP_KEY,
        modes_of_transport: "train,bus,tram",
      },
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    console.warn("[Chains] TransportAPI failed, using mock:", err);
    return getMockTransportRoute(fromPostcode, toPostcode);
  }
}

function getMockTransportRoute(fromPostcode: string, toPostcode: string) {
  // Realistic mock transport options for UK
  return {
    routes: [
      {
        mode: "train",
        duration_mins: 45,
        cost: 12.50,
        operator: "National Rail",
        changes: 0,
        departure_time: "10:15",
        arrival_time: "11:00",
      },
      {
        mode: "bus",
        duration_mins: 75,
        cost: 3.50,
        operator: "National Express",
        changes: 1,
        departure_time: "10:00",
        arrival_time: "11:15",
      },
    ],
    from: fromPostcode,
    to: toPostcode,
    is_rural: false,
  };
}

function detectRiskFlags(legs: Array<{ durationMins: number; mode: string; isRural?: boolean }>, jobCount: number): string[] {
  const flags: string[] = [];

  for (const leg of legs) {
    if (leg.durationMins < 15) flags.push("Tight connection — less than 15 mins between jobs");
    if (leg.isRural) flags.push("Rural area detected — limited public transport, consider taxi");
    if (leg.mode === "taxi" && leg.durationMins > 30) flags.push("Long taxi leg — check cost vs earnings");
  }

  if (jobCount >= 3) flags.push("3-job chain — allow extra buffer time for delays");

  return Array.from(new Set(flags));
}

export const chainsRouter = router({
  // Plan a chain: calculate transport legs between jobs
  plan: protectedProcedure
    .input(z.object({
      jobIds: z.array(z.number()).min(2).max(3),
      repositionCosts: z.array(z.object({
        cost: z.number(),
        mode: z.enum(["train", "bus", "tram", "taxi", "walk", "scooter", "drive", "none"]),
        durationMins: z.number(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch all jobs
      const jobList = await db.select().from(jobs)
        .where(and(inArray(jobs.id, input.jobIds), eq(jobs.userId, ctx.user.id)));

      if (jobList.length !== input.jobIds.length) {
        throw new Error("Some jobs not found or don't belong to you");
      }

      // Sort jobs by their position in the input array
      const orderedJobs = input.jobIds.map(id => jobList.find(j => j.id === id)!);

      // Get transport routes between each consecutive pair
      const repositionLegs: Array<{
        fromPostcode: string;
        toPostcode: string;
        options: Array<{ from: string; to: string; mode: string; durationMins: number; cost: number; operator?: string; changes?: number; departureTime?: string; arrivalTime?: string; isRural: boolean }>;
        noTransitZone: boolean;
        riskFlags: string[];
      }> = [];
      for (let i = 0; i < orderedJobs.length - 1; i++) {
        const from = orderedJobs[i]!;
        const to = orderedJobs[i + 1]!;
        const transportData = await getTransportRoute(from.dropoffPostcode, to.pickupPostcode);

        const options = (transportData.routes ?? []).map((r: {
          mode: string;
          duration_mins: number;
          cost: number;
          operator?: string;
          changes?: number;
          departure_time?: string;
          arrival_time?: string;
        }) => ({
          from: from.dropoffPostcode,
          to: to.pickupPostcode,
          mode: r.mode as string,
          durationMins: r.duration_mins,
          cost: r.cost,
          operator: r.operator,
          changes: r.changes,
          departureTime: r.departure_time,
          arrivalTime: r.arrival_time,
          isRural: transportData.is_rural ?? false,
        }));

        repositionLegs.push({
          fromPostcode: from.dropoffPostcode,
          toPostcode: to.pickupPostcode,
          options,
          noTransitZone: transportData.is_rural ?? false,
          riskFlags: transportData.is_rural ? ["Rural area — limited public transport"] : [],
        });
      }

      // Calculate totals
      const settings = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
      const s = settings[0];

      let totalEarnings = 0;
      let totalFuelCost = 0;
      let totalBrokerFees = 0;
      let totalTimeValue = 0;
      let totalWearTear = 0;
      let totalDistanceMiles = 0;
      let totalDurationMins = 0;

      for (const job of orderedJobs) {
        totalEarnings += job.deliveryFee + job.fuelDeposit;
        totalFuelCost += job.estimatedFuelCost ?? 0;
        totalBrokerFees += (job.deliveryFee * (job.brokerFeePercent ?? 0) / 100) + (job.brokerFeeFixed ?? 0);
        totalTimeValue += job.estimatedTimeValue ?? 0;
        totalWearTear += job.estimatedWearTear ?? 0;
        totalDistanceMiles += job.estimatedDistanceMiles ?? 0;
        totalDurationMins += job.estimatedDurationMins ?? 0;
      }

      // Add reposition costs
      const selectedReposCosts = input.repositionCosts ?? repositionLegs.map(leg => ({
        cost: leg.options[0]?.cost ?? 0,
        mode: (leg.options[0]?.mode ?? "train") as "train" | "bus" | "tram" | "taxi" | "walk" | "scooter" | "drive" | "none",
        durationMins: leg.options[0]?.durationMins ?? 0,
      }));

      const totalRepositionCost = selectedReposCosts.reduce((sum, r) => sum + r.cost, 0);
      const totalRepositionMins = selectedReposCosts.reduce((sum, r) => sum + r.durationMins, 0);

      totalDurationMins += totalRepositionMins;

      const totalCosts = totalFuelCost + totalBrokerFees + totalTimeValue + totalWearTear + totalRepositionCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;

      const riskFlags = detectRiskFlags(
        selectedReposCosts.map((r, i) => ({
          durationMins: r.durationMins,
          mode: r.mode,
          isRural: repositionLegs[i]?.noTransitZone ?? false,
        })),
        orderedJobs.length
      );

      return {
        jobs: orderedJobs,
        repositionLegs,
        summary: {
          totalEarnings,
          totalRepositionCost,
          totalFuelCost,
          totalBrokerFees,
          totalTimeValue,
          totalWearTear,
          totalCosts,
          totalNetProfit,
          totalDurationMins,
          totalDistanceMiles,
          profitPerHour,
          riskFlags,
        },
      };
    }),

  // Save a chain
  create: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      jobIds: z.array(z.number()).min(2).max(3),
      repositionLegs: z.any(),
      summary: z.object({
        totalEarnings: z.number(),
        totalRepositionCost: z.number(),
        totalFuelCost: z.number(),
        totalBrokerFees: z.number(),
        totalTimeValue: z.number(),
        totalWearTear: z.number(),
        totalCosts: z.number(),
        totalNetProfit: z.number(),
        totalDurationMins: z.number(),
        totalDistanceMiles: z.number(),
        profitPerHour: z.number(),
        riskFlags: z.array(z.string()),
      }),
      scheduledDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [chain] = await db.insert(jobChains).values({
        userId: ctx.user.id,
        name: input.name ?? `Chain ${new Date().toLocaleDateString("en-GB")}`,
        status: "planned",
        totalEarnings: input.summary.totalEarnings,
        totalCosts: input.summary.totalCosts,
        totalNetProfit: input.summary.totalNetProfit,
        totalDurationMins: input.summary.totalDurationMins,
        totalDistanceMiles: input.summary.totalDistanceMiles,
        profitPerHour: input.summary.profitPerHour,
        riskFlags: input.summary.riskFlags,
        repositionLegs: input.repositionLegs,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
      }).$returningId();

      const chainId = chain!.id;

      // Insert chain-job relationships
      for (let i = 0; i < input.jobIds.length; i++) {
        await db.insert(chainJobs).values({
          chainId,
          jobId: input.jobIds[i]!,
          position: i + 1,
        });
      }

      return { success: true, chainId };
    }),

  // List chains
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { chains: [] };

      const result = await db.select().from(jobChains)
        .where(eq(jobChains.userId, ctx.user.id))
        .orderBy(desc(jobChains.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { chains: result };
    }),

  // Get chain with jobs
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [chain] = await db.select().from(jobChains)
        .where(and(eq(jobChains.id, input.id), eq(jobChains.userId, ctx.user.id)))
        .limit(1);

      if (!chain) return null;

      const cjRows = await db.select().from(chainJobs).where(eq(chainJobs.chainId, chain.id));
      const jobIds = cjRows.sort((a, b) => a.position - b.position).map(r => r.jobId);
      const jobList = jobIds.length > 0
        ? await db.select().from(jobs).where(inArray(jobs.id, jobIds))
        : [];

      return { chain, jobs: jobList, chainJobs: cjRows };
    }),

  // Generate share token
  share: protectedProcedure
    .input(z.object({ chainId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.update(jobChains)
        .set({ shareToken: token, shareExpiresAt: expiresAt })
        .where(and(eq(jobChains.id, input.chainId), eq(jobChains.userId, ctx.user.id)));

      return { token, expiresAt };
    }),
});
