import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { jobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TravelStep = {
  type: "walk" | "bus" | "train" | "tram" | "tube" | "taxi" | "wait";
  instruction: string;           // e.g. "Take the 7:50 No. 7 bus"
  detail: string;                // e.g. "From Stop 37 (Market Square) towards Wellingborough"
  departureTime: string;         // e.g. "07:50"
  arrivalTime: string;           // e.g. "08:22"
  durationMins: number;
  stopOrStation?: string;        // e.g. "Stop 37", "Platform 2", "Wellingborough Station"
  lineOrService?: string;        // e.g. "No. 7", "East Midlands Railway", "Uber"
  cost?: number;                 // GBP
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
  summary: string;               // e.g. "Bus → Train → Taxi"
  warnings?: string[];
};

// ─── LLM schema ──────────────────────────────────────────────────────────────

const travelRouteSchema = {
  type: "object" as const,
  properties: {
    origin: { type: "string", description: "The starting location as provided" },
    destination: { type: "string", description: "The destination as provided" },
    departureTime: { type: "string", description: "Overall departure time (HH:MM)" },
    arrivalTime: { type: "string", description: "Overall arrival time at destination (HH:MM)" },
    totalDurationMins: { type: "number", description: "Total journey duration in minutes" },
    totalCost: { type: "number", description: "Total estimated cost in GBP" },
    summary: { type: "string", description: "Short summary of modes used, e.g. 'Walk → Bus → Train → Taxi'" },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Any warnings such as 'check timetable', 'book taxi in advance', etc."
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Mode: walk, bus, train, tram, tube, taxi, or wait"
          },
          instruction: {
            type: "string",
            description: "Primary instruction, e.g. 'Take the 07:50 No. 7 bus'"
          },
          detail: {
            type: "string",
            description: "Supporting detail, e.g. 'From Stop 37 (Market Square) towards Wellingborough town centre'"
          },
          departureTime: { type: "string", description: "Departure time for this step (HH:MM)" },
          arrivalTime: { type: "string", description: "Arrival time for this step (HH:MM)" },
          durationMins: { type: "number", description: "Duration of this step in minutes" },
          stopOrStation: {
            type: "string",
            description: "Stop number, station name, or platform (e.g. 'Stop 37', 'Wellingborough Station Platform 1')"
          },
          lineOrService: {
            type: "string",
            description: "Bus number, train operator, or taxi provider (e.g. 'No. 7', 'East Midlands Railway', 'Uber')"
          },
          cost: { type: "number", description: "Cost of this step in GBP (0 if free or unknown)" },
          notes: {
            type: "string",
            description: "Any additional notes for this step (e.g. 'Buy ticket on board', 'Advance booking recommended')"
          }
        },
        required: ["type", "instruction", "detail", "departureTime", "arrivalTime", "durationMins", "stopOrStation", "lineOrService", "cost", "notes"],
        additionalProperties: false
      }
    }
  },
  required: ["origin", "destination", "departureTime", "arrivalTime", "totalDurationMins", "totalCost", "summary", "warnings", "steps"],
  additionalProperties: false
};

export const travelPlannerRouter = router({
  // Plan a multi-modal journey to reach a pickup location
  planRoute: protectedProcedure
    .input(z.object({
      fromAddress: z.string().min(2),   // Driver's current location / home postcode
      toAddress: z.string().min(2),     // Pickup address / postcode
      arriveBy: z.string().optional(),  // ISO datetime — arrive by this time
      departAt: z.string().optional(),  // ISO datetime — depart at this time
      preferredModes: z.array(z.enum(["bus", "train", "tram", "tube", "taxi", "walk"])).optional(),
    }))
    .mutation(async ({ input }) => {
      const { fromAddress, toAddress, arriveBy, departAt, preferredModes } = input;

      const now = new Date();
      const targetTime = arriveBy
        ? new Date(arriveBy)
        : departAt
          ? new Date(departAt)
          : new Date(now.getTime() + 60 * 60 * 1000); // default: 1 hour from now

      const timeContext = arriveBy
        ? `The driver needs to ARRIVE at the pickup by ${new Date(arriveBy).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
        : departAt
          ? `The driver plans to DEPART at ${new Date(departAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`
          : `The driver needs to travel as soon as possible (current time: ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}).`;

      const modesContext = preferredModes && preferredModes.length > 0
        ? `Preferred transport modes: ${preferredModes.join(", ")}.`
        : "Use any combination of public transport (bus, train, tram, tube) and taxi/rideshare as needed.";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert UK public transport journey planner. You plan detailed step-by-step multi-modal journeys for car delivery drivers who need to travel to a pickup location using public transport.

Your routes must be REALISTIC and SPECIFIC:
- Use real UK bus routes with actual route numbers (e.g. "No. 7", "X4", "46A")
- Use real train operators (East Midlands Railway, CrossCountry, Avanti, etc.)
- Include real stop numbers where known (e.g. "Stop 37", "Stand B")
- Include real platform numbers where known
- Include realistic departure times based on typical timetables
- Include realistic costs (bus: £1.50-£3, train: varies, taxi: £2.50 flag + £1.50/mile)
- If taxi is needed for the last mile, calculate realistic cost based on distance
- Always include a buffer of 5-10 minutes at connections
- If the journey is impossible by public transport (rural area, late night), recommend taxi for that leg
- Today's date context: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
          },
          {
            role: "user",
            content: `Plan a journey for a car delivery driver:

FROM: ${fromAddress}
TO: ${toAddress} (pickup location)

${timeContext}
${modesContext}

Please provide a detailed step-by-step journey plan with specific bus numbers, stop numbers, train times, platform numbers, and costs. The driver will be travelling in the UK. Make the instructions clear enough that the driver can follow them without a smartphone — include stop numbers, service numbers, and key landmarks.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "travel_route",
            strict: true,
            schema: travelRouteSchema,
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("No route generated. Please try again.");

      const route: TravelRoute = typeof content === "string" ? JSON.parse(content) : content;
      return route;
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
