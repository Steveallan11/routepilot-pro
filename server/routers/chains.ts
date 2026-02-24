import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobChains, chainJobs, jobs, userSettings } from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { calculateJobCost } from "../../shared/routepilot-types";
import axios from "axios";
import { nanoid } from "nanoid";

const TRANSPORT_API_BASE = "https://transportapi.com/v3/uk";
const TRANSPORT_APP_ID = process.env.TRANSPORT_APP_ID ?? "";
const TRANSPORT_APP_KEY = process.env.TRANSPORT_APP_KEY ?? "";

async function getTransportRoute(fromPostcode: string, toPostcode: string) {
  if (!TRANSPORT_APP_ID || !TRANSPORT_APP_KEY) {
    return getMockTransportRoute(fromPostcode, toPostcode);
  }
  try {
    const response = await axios.get(
      `${TRANSPORT_API_BASE}/public/journey/from/postcode:${fromPostcode}/to/postcode:${toPostcode}.json`,
      {
        params: { app_id: TRANSPORT_APP_ID, app_key: TRANSPORT_APP_KEY, modes_of_transport: "train,bus,tram" },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (err) {
    console.warn("[Chains] TransportAPI failed, using mock:", err);
    return getMockTransportRoute(fromPostcode, toPostcode);
  }
}

function getMockTransportRoute(fromPostcode: string, toPostcode: string) {
  // Realistic mock — vary slightly based on postcode hash so legs look different
  const seed = (fromPostcode.charCodeAt(0) + toPostcode.charCodeAt(0)) % 3;
  const routes = [
    {
      mode: "train",
      duration_mins: 35 + seed * 10,
      cost: 8.50 + seed * 4,
      operator: "National Rail",
      changes: seed,
      departure_time: `${8 + seed}:${seed === 0 ? "00" : seed === 1 ? "15" : "30"}`,
      arrival_time: `${9 + seed}:${seed === 0 ? "05" : seed === 1 ? "22" : "45"}`,
    },
    {
      mode: "bus",
      duration_mins: 55 + seed * 15,
      cost: 3.50 + seed,
      operator: "National Express",
      changes: 1,
      departure_time: `${8 + seed}:00`,
      arrival_time: `${9 + seed}:${seed === 0 ? "10" : "25"}`,
    },
    {
      mode: "taxi",
      duration_mins: 20 + seed * 5,
      cost: 18 + seed * 6,
      operator: "Local Taxi",
      changes: 0,
      departure_time: "On demand",
      arrival_time: "On demand",
    },
  ];
  return { routes, from: fromPostcode, to: toPostcode, is_rural: false };
}

function detectRiskFlags(
  legs: Array<{ durationMins: number; mode: string; isRural?: boolean }>,
  jobCount: number
): string[] {
  const flags: string[] = [];
  for (const leg of legs) {
    if (leg.durationMins < 15) flags.push("Tight connection — less than 15 mins between legs");
    if (leg.isRural) flags.push("Rural area detected — limited public transport, consider taxi");
    if (leg.mode === "taxi" && leg.durationMins > 30) flags.push("Long taxi leg — check cost vs earnings");
  }
  if (jobCount >= 3) flags.push("3-job chain — allow extra buffer time for delays");
  return Array.from(new Set(flags));
}

// Transport leg shape used throughout
const transportLegSchema = z.object({
  fromPostcode: z.string(),
  toPostcode: z.string(),
  legType: z.enum(["homeToPickup", "reposition", "homeReturn"]),
  options: z.array(z.object({
    mode: z.string(),
    durationMins: z.number(),
    cost: z.number(),
    operator: z.string().optional(),
    changes: z.number().optional(),
    departureTime: z.string().optional(),
    arrivalTime: z.string().optional(),
  })),
  selectedOptionIndex: z.number().default(0),
  noTransitZone: z.boolean().default(false),
});

export const chainsRouter = router({
  // Plan a chain: full door-to-door route including home travel legs
  plan: protectedProcedure
    .input(z.object({
      jobIds: z.array(z.number()).min(2).max(3),
      // Per-leg selected option indices (for re-planning with different choices)
      legSelections: z.array(z.object({
        legIndex: z.number(),
        optionIndex: z.number(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch jobs
      const jobList = await db.select().from(jobs)
        .where(and(inArray(jobs.id, input.jobIds), eq(jobs.userId, ctx.user.id)));
      if (jobList.length !== input.jobIds.length) {
        throw new Error("Some jobs not found or don't belong to you");
      }
      const orderedJobs = input.jobIds.map(id => jobList.find(j => j.id === id)!);

      // Fetch user settings for home postcode
      const settingsRows = await db.select().from(userSettings)
        .where(eq(userSettings.userId, ctx.user.id)).limit(1);
      const s = settingsRows[0];
      const homePostcode = s?.homePostcode ?? "";

      // Build the full leg sequence:
      // [homeToPickup1, driveLeg1, reposition1, driveLeg2, ..., homeReturn]
      // Transport legs: homeToPickup, repositions, homeReturn
      // Drive legs: one per job

      // --- Transport legs ---
      type TransportLeg = {
        fromPostcode: string;
        toPostcode: string;
        legType: "homeToPickup" | "reposition" | "homeReturn";
        options: Array<{
          mode: string; durationMins: number; cost: number;
          operator?: string; changes?: number; departureTime?: string; arrivalTime?: string;
        }>;
        selectedOptionIndex: number;
        noTransitZone: boolean;
      };

      const transportLegs: TransportLeg[] = [];

      // Leg 0: home → first pickup
      if (homePostcode) {
        const data = await getTransportRoute(homePostcode, orderedJobs[0]!.pickupPostcode);
        transportLegs.push({
          fromPostcode: homePostcode,
          toPostcode: orderedJobs[0]!.pickupPostcode,
          legType: "homeToPickup",
          options: (data.routes ?? []).map((r: { mode: string; duration_mins: number; cost: number; operator?: string; changes?: number; departure_time?: string; arrival_time?: string }) => ({
            mode: r.mode,
            durationMins: r.duration_mins,
            cost: r.cost,
            operator: r.operator,
            changes: r.changes,
            departureTime: r.departure_time,
            arrivalTime: r.arrival_time,
          })),
          selectedOptionIndex: 0,
          noTransitZone: data.is_rural ?? false,
        });
      }

      // Reposition legs: dropoff[i] → pickup[i+1]
      for (let i = 0; i < orderedJobs.length - 1; i++) {
        const from = orderedJobs[i]!;
        const to = orderedJobs[i + 1]!;
        const data = await getTransportRoute(from.dropoffPostcode, to.pickupPostcode);
        transportLegs.push({
          fromPostcode: from.dropoffPostcode,
          toPostcode: to.pickupPostcode,
          legType: "reposition",
          options: (data.routes ?? []).map((r: { mode: string; duration_mins: number; cost: number; operator?: string; changes?: number; departure_time?: string; arrival_time?: string }) => ({
            mode: r.mode,
            durationMins: r.duration_mins,
            cost: r.cost,
            operator: r.operator,
            changes: r.changes,
            departureTime: r.departure_time,
            arrivalTime: r.arrival_time,
          })),
          selectedOptionIndex: 0,
          noTransitZone: data.is_rural ?? false,
        });
      }

      // Last leg: last dropoff → home
      if (homePostcode) {
        const lastJob = orderedJobs[orderedJobs.length - 1]!;
        const data = await getTransportRoute(lastJob.dropoffPostcode, homePostcode);
        transportLegs.push({
          fromPostcode: lastJob.dropoffPostcode,
          toPostcode: homePostcode,
          legType: "homeReturn",
          options: (data.routes ?? []).map((r: { mode: string; duration_mins: number; cost: number; operator?: string; changes?: number; departure_time?: string; arrival_time?: string }) => ({
            mode: r.mode,
            durationMins: r.duration_mins,
            cost: r.cost,
            operator: r.operator,
            changes: r.changes,
            departureTime: r.departure_time,
            arrivalTime: r.arrival_time,
          })),
          selectedOptionIndex: 0,
          noTransitZone: data.is_rural ?? false,
        });
      }

      // Apply any user-selected option indices
      if (input.legSelections) {
        for (const sel of input.legSelections) {
          if (transportLegs[sel.legIndex]) {
            transportLegs[sel.legIndex]!.selectedOptionIndex = sel.optionIndex;
          }
        }
      }

      // --- Calculate totals ---
      let totalEarnings = 0;
      let totalFuelCost = 0;
      let totalBrokerFees = 0;
      let totalDistanceMiles = 0;
      let totalDurationMins = 0;

      for (const job of orderedJobs) {
        const deliveryFee = Number(job.deliveryFee);
        const fuelDeposit = Number(job.fuelDeposit ?? 0);
        const estimatedFuelCost = Number(job.estimatedFuelCost ?? 0);
        const brokerFeePercent = Number(job.brokerFeePercent ?? 0);
        const brokerFeeFixed = Number(job.brokerFeeFixed ?? 0);
        const estimatedDistanceMiles = Number(job.estimatedDistanceMiles ?? 0);
        const estimatedDurationMins = Number(job.estimatedDurationMins ?? 0);

        totalEarnings += deliveryFee + fuelDeposit;
        totalFuelCost += estimatedFuelCost;
        totalBrokerFees += (deliveryFee * brokerFeePercent / 100) + brokerFeeFixed;
        totalDistanceMiles += estimatedDistanceMiles;
        totalDurationMins += estimatedDurationMins;
      }

      // Sum all transport leg costs (home travel + repositions)
      let totalTransportCost = 0;
      let totalTransportMins = 0;
      for (const leg of transportLegs) {
        const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
        if (opt) {
          totalTransportCost += opt.cost;
          totalTransportMins += opt.durationMins;
        }
      }
      totalDurationMins += totalTransportMins;

      // Deductions: broker fees + all transport costs (home + reposition)
      // Fuel is NOT deducted — drivers claim it back
      const totalCosts = totalBrokerFees + totalTransportCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;

      const riskFlags = detectRiskFlags(
        transportLegs.map(leg => {
          const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
          return {
            durationMins: opt?.durationMins ?? 0,
            mode: opt?.mode ?? "train",
            isRural: leg.noTransitZone,
          };
        }),
        orderedJobs.length
      );

      return {
        jobs: orderedJobs,
        transportLegs,
        homePostcode,
        summary: {
          totalEarnings,
          totalTransportCost,
          totalFuelCost,
          totalBrokerFees,
          totalTimeValue: 0,
          totalWearTear: 0,
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
      transportLegs: z.any(),
      summary: z.object({
        totalEarnings: z.number(),
        totalTransportCost: z.number(),
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
        repositionLegs: input.transportLegs,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
      }).$returningId();

      const chainId = chain!.id;

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
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.update(jobChains)
        .set({ shareToken: token, shareExpiresAt: expiresAt })
        .where(and(eq(jobChains.id, input.chainId), eq(jobChains.userId, ctx.user.id)));

      return { token, expiresAt };
    }),
});
