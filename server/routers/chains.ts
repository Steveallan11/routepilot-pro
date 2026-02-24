import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobChains, chainJobs, jobs, userSettings } from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { calculateJobCost } from "../../shared/routepilot-types";
import { nanoid } from "nanoid";
import { makeRequest } from "../_core/map";

// ============================================================================
// Real Google Maps Transit Directions
// ============================================================================

type TransitStep = {
  mode: "WALK" | "BUS" | "TRAIN" | "TRAM" | "SUBWAY" | "RAIL" | "FERRY" | "CABLE_CAR" | "GONDOLA" | "FUNICULAR" | "OTHER";
  instruction: string;
  durationMins: number;
  distanceMetres: number;
  departureStop?: string;
  arrivalStop?: string;
  lineName?: string;
  lineShortName?: string;
  operator?: string;
  departureTime?: string;
  arrivalTime?: string;
  numStops?: number;
  vehicleIcon?: string;
};

type TransitOption = {
  mode: string; // summary label e.g. "Walk + Train" or "Bus + Walk"
  durationMins: number;
  cost: number;
  operator?: string;
  changes: number;
  departureTime?: string;
  arrivalTime?: string;
  steps: TransitStep[];
  summary: string;
};

interface GoogleDirectionsStep {
  travel_mode: string;
  duration: { value: number; text: string };
  distance: { value: number; text: string };
  html_instructions: string;
  transit_details?: {
    departure_stop?: { name: string };
    arrival_stop?: { name: string };
    line?: {
      name?: string;
      short_name?: string;
      agencies?: Array<{ name: string }>;
      vehicle?: { type?: string; icon?: string };
    };
    departure_time?: { text: string };
    arrival_time?: { text: string };
    num_stops?: number;
  };
}

interface GoogleDirectionsLeg {
  duration: { value: number; text: string };
  distance: { value: number; text: string };
  departure_time?: { text: string };
  arrival_time?: { text: string };
  steps: GoogleDirectionsStep[];
}

interface GoogleDirectionsRoute {
  legs: GoogleDirectionsLeg[];
  summary: string;
}

interface GoogleDirectionsResult {
  status: string;
  routes: GoogleDirectionsRoute[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateUKTransitCost(steps: TransitStep[]): number {
  let cost = 0;
  let hasBusOrTram = false;
  let trainKm = 0;

  for (const step of steps) {
    if (step.mode === "WALK") continue;

    if (step.mode === "TRAIN" || step.mode === "RAIL") {
      // UK rail pricing: roughly £0.20/km for off-peak, minimum £3.50
      // Short journeys (commuter): £3-£8; medium (50km): £10-£20; long (100km+): £20-£50
      const km = (step.distanceMetres ?? 15000) / 1000;
      trainKm += km;
      // Use a tiered approach
      if (km < 10) cost += Math.max(3.5, km * 0.35);
      else if (km < 30) cost += Math.max(6.0, km * 0.28);
      else if (km < 80) cost += Math.max(10.0, km * 0.22);
      else cost += Math.max(18.0, km * 0.18);
    } else if (step.mode === "BUS") {
      // UK bus: capped at £2.00 per journey since Jan 2023 (England)
      if (!hasBusOrTram) {
        cost += 2.0;
        hasBusOrTram = true;
      }
      // Additional bus legs on same journey are usually free with day ticket
    } else if (step.mode === "TRAM") {
      cost += 2.50;
    } else if (step.mode === "SUBWAY") {
      // London Tube / Metro: zone-based, ~£2.80 off-peak
      cost += 2.80;
    } else if (step.mode === "FERRY") {
      cost += 5.0;
    } else {
      // OTHER (taxi/rideshare) — handled separately via driving API
      cost += 3.0;
    }
  }
  return Math.round(cost * 100) / 100;
}

function buildModeSummary(steps: TransitStep[]): string {
  const modes: string[] = [];
  for (const step of steps) {
    if (step.mode === "WALK" && step.durationMins < 2) continue;
    const label = step.mode === "WALK" ? "Walk"
      : step.mode === "TRAIN" || step.mode === "RAIL" ? `Train${step.lineShortName ? ` (${step.lineShortName})` : ""}`
      : step.mode === "BUS" ? `Bus${step.lineShortName ? ` ${step.lineShortName}` : ""}`
      : step.mode === "TRAM" ? "Tram"
      : step.mode === "SUBWAY" ? "Tube"
      : step.mode;
    if (!modes.length || modes[modes.length - 1] !== label) modes.push(label);
  }
  return modes.join(" → ") || "Walk";
}

async function getRealTransitOptions(
  fromPostcode: string,
  toPostcode: string,
  departureTimestamp?: number
): Promise<TransitOption[]> {
  const options: TransitOption[] = [];

  // Departure time: use provided timestamp or "now" (next 30 min)
  const depTime = departureTimestamp ?? Math.floor(Date.now() / 1000) + 1800;

  try {
    // Request transit alternatives from Google Maps
    const result = await makeRequest<GoogleDirectionsResult>(
      "/maps/api/directions/json",
      {
        origin: fromPostcode + ", UK",
        destination: toPostcode + ", UK",
        mode: "transit",
        alternatives: "true",
        departure_time: String(depTime),
        region: "gb",
        language: "en-GB",
        units: "imperial",
      }
    );

    if (result.status !== "OK" || !result.routes?.length) {
      console.warn("[Chains] Google Maps transit returned:", result.status, "for", fromPostcode, "→", toPostcode);
      return getFallbackOptions(fromPostcode, toPostcode);
    }

    for (const route of result.routes.slice(0, 3)) {
      const leg = route.legs[0];
      if (!leg) continue;

      const steps: TransitStep[] = leg.steps.map((s) => {
        const td = s.transit_details;
        const vehicleType = td?.line?.vehicle?.type?.toUpperCase() as TransitStep["mode"] | undefined;
        const mode: TransitStep["mode"] = s.travel_mode === "WALKING" ? "WALK"
          : s.travel_mode === "TRANSIT" ? (vehicleType ?? "TRAIN")
          : "WALK";

        return {
          mode,
          instruction: stripHtml(s.html_instructions),
          durationMins: Math.round(s.duration.value / 60),
          distanceMetres: s.distance?.value ?? 0,
          departureStop: td?.departure_stop?.name,
          arrivalStop: td?.arrival_stop?.name,
          lineName: td?.line?.name,
          lineShortName: td?.line?.short_name,
          operator: td?.line?.agencies?.[0]?.name,
          departureTime: td?.departure_time?.text,
          arrivalTime: td?.arrival_time?.text,
          numStops: td?.num_stops,
          vehicleIcon: td?.line?.vehicle?.icon,
        };
      });

      const durationMins = Math.round(leg.duration.value / 60);
      const cost = estimateUKTransitCost(steps);
      const changes = steps.filter(s => s.mode !== "WALK").length - 1;
      const summary = buildModeSummary(steps);

      options.push({
        mode: summary,
        durationMins,
        cost,
        operator: steps.find(s => s.operator)?.operator,
        changes: Math.max(0, changes),
        departureTime: leg.departure_time?.text,
        arrivalTime: leg.arrival_time?.text,
        steps,
        summary,
      });
    }

    // Always add taxi as a fallback option
    const drivingResult = await makeRequest<GoogleDirectionsResult>(
      "/maps/api/directions/json",
      {
        origin: fromPostcode + ", UK",
        destination: toPostcode + ", UK",
        mode: "driving",
        region: "gb",
      }
    );
    if (drivingResult.status === "OK" && drivingResult.routes?.[0]) {
      const driveLeg = drivingResult.routes[0].legs[0];
      if (driveLeg) {
        const taxiMins = Math.round(driveLeg.duration.value / 60);
        const taxiKm = driveLeg.distance.value / 1000;
        const taxiCost = Math.max(8, 2.5 + taxiKm * 1.8); // UK taxi: ~£1.80/km + £2.50 flag fall
        options.push({
          mode: "Taxi",
          durationMins: taxiMins,
          cost: Math.round(taxiCost * 100) / 100,
          operator: "Local Taxi",
          changes: 0,
          departureTime: "On demand",
          arrivalTime: "On demand",
          steps: [{
            mode: "OTHER",
            instruction: `Taxi from ${fromPostcode} to ${toPostcode}`,
            durationMins: taxiMins,
            distanceMetres: driveLeg.distance.value,
          }],
          summary: "Taxi",
        });
      }
    }

    return options.length ? options : getFallbackOptions(fromPostcode, toPostcode);
  } catch (err) {
    console.error("[Chains] Google Maps transit error:", err);
    return getFallbackOptions(fromPostcode, toPostcode);
  }
}

function getFallbackOptions(fromPostcode: string, toPostcode: string): TransitOption[] {
  const seed = (fromPostcode.charCodeAt(0) + toPostcode.charCodeAt(0)) % 3;
  return [
    {
      mode: "Train",
      durationMins: 35 + seed * 10,
      cost: 8.50 + seed * 4,
      operator: "National Rail",
      changes: seed,
      departureTime: `${8 + seed}:${seed === 0 ? "00" : seed === 1 ? "15" : "30"}`,
      arrivalTime: `${9 + seed}:${seed === 0 ? "05" : seed === 1 ? "22" : "45"}`,
      steps: [{
        mode: "TRAIN",
        instruction: `Train from ${fromPostcode} to ${toPostcode}`,
        durationMins: 35 + seed * 10,
        distanceMetres: 50000,
        operator: "National Rail",
      }],
      summary: "Train",
    },
    {
      mode: "Bus",
      durationMins: 55 + seed * 15,
      cost: 3.50 + seed,
      operator: "National Express",
      changes: 1,
      departureTime: `${8 + seed}:00`,
      arrivalTime: `${9 + seed}:${seed === 0 ? "10" : "25"}`,
      steps: [{
        mode: "BUS",
        instruction: `Bus from ${fromPostcode} to ${toPostcode}`,
        durationMins: 55 + seed * 15,
        distanceMetres: 40000,
        operator: "National Express",
      }],
      summary: "Bus",
    },
    {
      mode: "Taxi",
      durationMins: 20 + seed * 5,
      cost: 18 + seed * 6,
      operator: "Local Taxi",
      changes: 0,
      departureTime: "On demand",
      arrivalTime: "On demand",
      steps: [{
        mode: "OTHER",
        instruction: `Taxi from ${fromPostcode} to ${toPostcode}`,
        durationMins: 20 + seed * 5,
        distanceMetres: 20000,
      }],
      summary: "Taxi",
    },
  ];
}

function detectRiskFlags(
  legs: Array<{ durationMins: number; mode: string; isRural?: boolean }>,
  jobCount: number
): string[] {
  const flags: string[] = [];
  for (const leg of legs) {
    if (leg.durationMins < 15) flags.push("Tight connection — less than 15 mins between legs");
    if (leg.isRural) flags.push("Rural area detected — limited public transport, consider taxi");
    if (leg.mode === "Taxi" && leg.durationMins > 30) flags.push("Long taxi leg — check cost vs earnings");
  }
  if (jobCount >= 3) flags.push("3-job chain — allow extra buffer time for delays");
  return Array.from(new Set(flags));
}

// Transport leg shape used throughout
const transitStepSchema = z.object({
  mode: z.string(),
  instruction: z.string(),
  durationMins: z.number(),
  distanceMetres: z.number(),
  departureStop: z.string().optional(),
  arrivalStop: z.string().optional(),
  lineName: z.string().optional(),
  lineShortName: z.string().optional(),
  operator: z.string().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  numStops: z.number().optional(),
});

export const chainsRouter = router({
  // Plan a chain: full door-to-door route including home travel legs with real transit data
  plan: protectedProcedure
    .input(z.object({
      jobIds: z.array(z.number()).min(2).max(3),
      legSelections: z.array(z.object({
        legIndex: z.number(),
        optionIndex: z.number(),
      })).optional(),
      // Optional departure time for the first leg (Unix timestamp)
      departureTimestamp: z.number().optional(),
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

      // Determine departure time for first leg
      // If first job has a scheduled pickup time, work backwards from it
      const firstJob = orderedJobs[0]!;
      let depTimestamp = input.departureTimestamp;
      if (!depTimestamp && firstJob.scheduledPickupAt) {
        // Leave 30 mins before scheduled pickup as a starting point
        depTimestamp = Math.floor(new Date(firstJob.scheduledPickupAt).getTime() / 1000) - 1800;
      }
      if (!depTimestamp) {
        depTimestamp = Math.floor(Date.now() / 1000) + 1800;
      }

      // --- Fetch real transit options for each transport leg in parallel ---
      type TransportLeg = {
        fromPostcode: string;
        toPostcode: string;
        legType: "homeToPickup" | "reposition" | "homeReturn";
        options: TransitOption[];
        selectedOptionIndex: number;
        noTransitZone: boolean;
      };

      const transportLegPromises: Promise<TransportLeg>[] = [];

      // Leg 0: home → first pickup
      if (homePostcode) {
        transportLegPromises.push(
          getRealTransitOptions(homePostcode, orderedJobs[0]!.pickupPostcode, depTimestamp)
            .then(options => ({
              fromPostcode: homePostcode,
              toPostcode: orderedJobs[0]!.pickupPostcode,
              legType: "homeToPickup" as const,
              options,
              selectedOptionIndex: 0,
              noTransitZone: options.length === 1 && options[0]?.mode === "Taxi",
            }))
        );
      }

      // Reposition legs: dropoff[i] → pickup[i+1]
      // Estimate departure time based on drive duration of previous job
      let runningTime = depTimestamp;
      for (let i = 0; i < orderedJobs.length - 1; i++) {
        const from = orderedJobs[i]!;
        const to = orderedJobs[i + 1]!;
        // Add drive duration of this job to get estimated arrival at dropoff
        runningTime += (Number(from.estimatedDurationMins ?? 60) * 60);
        const repDepTime = runningTime;
        transportLegPromises.push(
          getRealTransitOptions(from.dropoffPostcode, to.pickupPostcode, repDepTime)
            .then(options => ({
              fromPostcode: from.dropoffPostcode,
              toPostcode: to.pickupPostcode,
              legType: "reposition" as const,
              options,
              selectedOptionIndex: 0,
              noTransitZone: options.length === 1 && options[0]?.mode === "Taxi",
            }))
        );
        // Add reposition time (use first option duration as estimate)
        runningTime += 60 * 60; // 1hr estimate for reposition
      }

      // Last leg: last dropoff → home
      if (homePostcode) {
        const lastJob = orderedJobs[orderedJobs.length - 1]!;
        runningTime += (Number(lastJob.estimatedDurationMins ?? 60) * 60);
        transportLegPromises.push(
          getRealTransitOptions(lastJob.dropoffPostcode, homePostcode, runningTime)
            .then(options => ({
              fromPostcode: lastJob.dropoffPostcode,
              toPostcode: homePostcode,
              legType: "homeReturn" as const,
              options,
              selectedOptionIndex: 0,
              noTransitZone: options.length === 1 && options[0]?.mode === "Taxi",
            }))
        );
      }

      const transportLegs = await Promise.all(transportLegPromises);

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

      // Deductions: broker fees + all transport costs
      // Fuel is NOT deducted — drivers claim it back
      const totalCosts = totalBrokerFees + totalTransportCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;

      const riskFlags = detectRiskFlags(
        transportLegs.map(leg => {
          const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
          return {
            durationMins: opt?.durationMins ?? 0,
            mode: opt?.mode ?? "Train",
            isRural: leg.noTransitZone,
          };
        }),
        orderedJobs.length
      );

      // Add scheduledPickupAt to each job in the result
      const jobsWithSchedule = orderedJobs.map(j => ({
        ...j,
        scheduledPickupAt: j.scheduledPickupAt ?? null,
      }));

      return {
        jobs: jobsWithSchedule,
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
        },
        riskFlags,
      };
    }),

  // Save a chain
  save: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      jobIds: z.array(z.number()).min(2).max(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const chainId = nanoid(12);
      await db.insert(jobChains).values({
        userId: ctx.user.id,
        name: input.name ?? `Chain ${new Date().toLocaleDateString("en-GB")}`,
        status: "planned",
        totalEarnings: 0,
        totalCosts: 0,
        totalNetProfit: 0,
        totalDistanceMiles: 0,
        totalDurationMins: 0,
      });

      return { success: true };
    }),

  // List saved chains
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const chains = await db.select().from(jobChains)
        .where(eq(jobChains.userId, ctx.user.id))
        .orderBy(desc(jobChains.createdAt));
      return chains.map(c => ({
        ...c,
        totalEarnings: Number(c.totalEarnings ?? 0),
        totalCosts: Number(c.totalCosts ?? 0),
        totalNetProfit: Number(c.totalNetProfit ?? 0),
        totalDistanceMiles: Number(c.totalDistanceMiles ?? 0),
      }));
    }),
});
