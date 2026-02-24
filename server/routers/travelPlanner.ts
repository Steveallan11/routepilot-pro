import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { makeRequest } from "../_core/map";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TravelStep = {
  type: "walk" | "bus" | "train" | "tram" | "tube" | "taxi" | "wait";
  instruction: string;
  detail: string;
  departureTime: string;
  arrivalTime: string;
  durationMins: number;
  stopOrStation?: string;
  lineOrService?: string;
  cost?: number;
  notes?: string;
};

export type TravelRoute = {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  totalDurationMins: number;
  totalCost: number;
  steps: TravelStep[];
  summary: string;
  warnings?: string[];
};

// ─── Google Maps types ────────────────────────────────────────────────────────

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
      vehicle?: { type?: string };
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

interface GoogleDirectionsResult {
  status: string;
  routes: Array<{
    legs: GoogleDirectionsLeg[];
    summary: string;
  }>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtTime(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Estimate UK transit cost per step.
 * Each bus/tram leg = £2.50 (typical UK single fare; England cap is £2.00 on eligible services).
 * Train = tiered by distance.
 * Walk/wait = free.
 */
function estimateStepCost(
  mode: string,
  distanceMetres: number
): number {
  const km = distanceMetres / 1000;
  switch (mode.toUpperCase()) {
    case "WALKING":
    case "WALK":
      return 0;
    case "BUS":
      // Each bus leg = £2.50 (Stagecoach/Arriva typical single; some operators cap at £2.00)
      return 2.50;
    case "TRAM":
      return 2.50;
    case "SUBWAY":
      return 2.80; // London Tube off-peak
    case "TRAIN":
    case "RAIL":
    case "HEAVY_RAIL":
    case "COMMUTER_TRAIN":
    case "HIGH_SPEED_TRAIN":
    case "INTERCITY_BUS":
      if (km < 10) return Math.max(3.50, km * 0.35);
      if (km < 30) return Math.max(6.00, km * 0.28);
      if (km < 80) return Math.max(10.00, km * 0.22);
      return Math.max(18.00, km * 0.18);
    case "FERRY":
      return 5.00;
    default:
      return 0;
  }
}

function getStepType(travelMode: string, vehicleType?: string): TravelStep["type"] {
  if (travelMode === "WALKING") return "walk";
  if (travelMode !== "TRANSIT") return "walk";
  const vt = (vehicleType ?? "").toUpperCase();
  if (vt.includes("BUS") || vt.includes("TROLLEYBUS") || vt.includes("INTERCITY_BUS")) return "bus";
  if (vt.includes("TRAM") || vt.includes("CABLE_CAR") || vt.includes("GONDOLA")) return "tram";
  if (vt.includes("SUBWAY") || vt.includes("METRO")) return "tube";
  return "train";
}

async function getGoogleTransitRoute(
  from: string,
  to: string,
  departureTimestamp: number
): Promise<TravelRoute | null> {
  try {
    const result = await makeRequest<GoogleDirectionsResult>(
      "/maps/api/directions/json",
      {
        origin: from.includes(",") ? from : `${from}, UK`,
        destination: to.includes(",") ? to : `${to}, UK`,
        mode: "transit",
        alternatives: "false",
        departure_time: String(departureTimestamp),
        region: "gb",
        language: "en-GB",
        units: "imperial",
      }
    );

    if (result.status !== "OK" || !result.routes?.length) {
      console.warn("[TravelPlanner] Google Maps returned:", result.status);
      return null;
    }

    const route = result.routes[0];
    const leg = route.legs[0];
    if (!leg) return null;

    const steps: TravelStep[] = [];
    let totalCost = 0;

    for (const s of leg.steps) {
      const td = s.transit_details;
      const vehicleType = td?.line?.vehicle?.type ?? "";
      const stepType = getStepType(s.travel_mode, vehicleType);
      const stepCost = estimateStepCost(
        s.travel_mode === "TRANSIT" ? vehicleType || "TRAIN" : "WALK",
        s.distance?.value ?? 0
      );
      totalCost += stepCost;

      const durationMins = Math.round(s.duration.value / 60);
      const depUnix = departureTimestamp; // approximate — Google gives leg-level times
      const depTime = td?.departure_time?.text ?? "";
      const arrTime = td?.arrival_time?.text ?? "";

      let instruction = "";
      let detail = "";
      let stopOrStation = "";
      let lineOrService = "";

      if (s.travel_mode === "WALKING") {
        instruction = stripHtml(s.html_instructions);
        detail = td?.departure_stop?.name ?? "";
        stopOrStation = td?.departure_stop?.name ?? "";
        lineOrService = "";
      } else if (s.travel_mode === "TRANSIT") {
        const lineName = td?.line?.short_name ?? td?.line?.name ?? "";
        const operator = td?.line?.agencies?.[0]?.name ?? "";
        const numStops = td?.num_stops ?? 0;
        instruction = `Take the ${depTime} ${lineName ? `No. ${lineName}` : vehicleType} towards ${td?.arrival_stop?.name ?? to}`;
        detail = `From ${td?.departure_stop?.name ?? ""} · ${numStops} stop${numStops !== 1 ? "s" : ""} · ${operator}`;
        stopOrStation = td?.departure_stop?.name ?? "";
        lineOrService = lineName ? `No. ${lineName}` : operator;
      } else {
        instruction = stripHtml(s.html_instructions);
        detail = "";
      }

      steps.push({
        type: stepType,
        instruction,
        detail,
        departureTime: depTime || "",
        arrivalTime: arrTime || "",
        durationMins,
        stopOrStation,
        lineOrService,
        cost: stepCost > 0 ? stepCost : undefined,
        notes: stepCost > 0 ? `£${stepCost.toFixed(2)}` : "Free",
      });
    }

    // Build summary label
    const modeLabels: string[] = [];
    for (const step of steps) {
      if (step.type === "walk" && step.durationMins < 2) continue;
      const label = step.type === "walk" ? "Walk"
        : step.type === "bus" ? `Bus${steps.find(s => s.lineOrService)?.lineOrService ? ` ${steps.find(s => s.type === "bus")?.lineOrService}` : ""}`
        : step.type === "train" ? "Train"
        : step.type === "tram" ? "Tram"
        : step.type === "tube" ? "Tube"
        : step.type;
      if (!modeLabels.length || modeLabels[modeLabels.length - 1] !== label) {
        modeLabels.push(label);
      }
    }

    const durationMins = Math.round(leg.duration.value / 60);
    const warnings: string[] = [];
    if (durationMins > 90) warnings.push("Long journey — allow extra time for delays");
    if (steps.filter(s => s.type !== "walk").length > 2) warnings.push("Multiple connections — check live departures before travelling");

    return {
      origin: from,
      destination: to,
      departureTime: leg.departure_time?.text ?? fmtTime(departureTimestamp),
      arrivalTime: leg.arrival_time?.text ?? fmtTime(departureTimestamp + durationMins * 60),
      totalDurationMins: durationMins,
      totalCost: Math.round(totalCost * 100) / 100,
      steps,
      summary: modeLabels.join(" → ") || "Walk",
      warnings,
    };
  } catch (err) {
    console.error("[TravelPlanner] Google Maps error:", err);
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const travelPlannerRouter = router({
  // Plan a multi-modal journey to reach a pickup location using real Google Maps data
  planRoute: protectedProcedure
    .input(z.object({
      fromAddress: z.string().min(2),
      toAddress: z.string().min(2),
      arriveBy: z.string().optional(),  // ISO datetime
      departAt: z.string().optional(),  // ISO datetime
      preferredModes: z.array(z.enum(["bus", "train", "tram", "tube", "taxi", "walk"])).optional(),
    }))
    .mutation(async ({ input }) => {
      const { fromAddress, toAddress, arriveBy, departAt } = input;

      // Determine departure timestamp for Google Maps
      let departureTimestamp: number;
      if (departAt) {
        departureTimestamp = Math.floor(new Date(departAt).getTime() / 1000);
      } else if (arriveBy) {
        // Estimate: depart 90 mins before arrival (will be corrected by Google)
        departureTimestamp = Math.floor(new Date(arriveBy).getTime() / 1000) - 90 * 60;
      } else {
        // Default: next 30 minutes
        departureTimestamp = Math.floor(Date.now() / 1000) + 1800;
      }

      // Try real Google Maps transit first
      const realRoute = await getGoogleTransitRoute(fromAddress, toAddress, departureTimestamp);
      if (realRoute) return realRoute;

      // Fallback: generate a basic route with correct cost calculation
      const depSecs = departureTimestamp;
      const busMins = 45;
      const fallbackCost = 2.50; // single bus fare
      return {
        origin: fromAddress,
        destination: toAddress,
        departureTime: fmtTime(depSecs),
        arrivalTime: fmtTime(depSecs + busMins * 60),
        totalDurationMins: busMins,
        totalCost: fallbackCost,
        steps: [
          {
            type: "bus" as const,
            instruction: `Take a bus from ${fromAddress} to ${toAddress}`,
            detail: "Check local bus timetable for exact times",
            departureTime: fmtTime(depSecs),
            arrivalTime: fmtTime(depSecs + busMins * 60),
            durationMins: busMins,
            stopOrStation: "Local bus stop",
            lineOrService: "Local bus",
            cost: fallbackCost,
            notes: "£2.50 — check timetable",
          },
        ],
        summary: "Bus",
        warnings: ["Could not load live timetable — check local bus app for exact times"],
      } as TravelRoute;
    }),

  // Save a travel route to a job
  saveToJob: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      route: z.any(),
      totalCost: z.number(),
      mode: z.enum(["train", "bus", "taxi", "own_car", "none"]).default("train"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(jobs)
        .set({
          travelRouteData: input.route,
          travelToJobCost: input.totalCost,
          travelToJobMode: input.mode,
        })
        .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id)));

      return { success: true };
    }),
});
