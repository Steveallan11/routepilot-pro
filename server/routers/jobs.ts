import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, userSettings } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { makeRequest } from "../_core/map";
import { calculateJobCost } from "../../shared/routepilot-types";

const jobInputSchema = z.object({
  pickupPostcode: z.string().min(2).max(10),
  dropoffPostcode: z.string().min(2).max(10),
  deliveryFee: z.number().min(0),
  fuelDeposit: z.number().min(0).default(0),
  brokerFeePercent: z.number().min(0).max(100).default(0),
  brokerFeeFixed: z.number().min(0).default(0),
  fuelReimbursed: z.boolean().default(false),
  scheduledPickupAt: z.string().optional(),
});

async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result[0] ?? null;
}

async function getRouteData(pickupPostcode: string, dropoffPostcode: string) {
  try {
    const response = await makeRequest("/maps/api/directions/json", {
      origin: pickupPostcode + ", UK",
      destination: dropoffPostcode + ", UK",
      mode: "driving",
      units: "imperial",
    });
    const data = response as {
      routes?: Array<{
        legs?: Array<{
          distance?: { value?: number };
          duration?: { value?: number };
        }>;
      }>;
      status?: string;
    };
    if (data.routes && data.routes.length > 0) {
      const leg = data.routes[0]?.legs?.[0];
      if (leg) {
        const distanceMetres = leg.distance?.value ?? 0;
        const durationSeconds = leg.duration?.value ?? 0;
        return {
          distanceMiles: distanceMetres / 1609.344,
          durationMins: durationSeconds / 60,
          routeData: data,
        };
      }
    }
  } catch (err) {
    console.warn("[Jobs] Route lookup failed:", err);
  }
  return null;
}

export const jobsRouter = router({
  // Calculate job costs (no save)
  calculate: protectedProcedure
    .input(jobInputSchema.extend({
      fuelPricePerLitre: z.number().optional(),
      vehicleMpg: z.number().optional(),
      hourlyRate: z.number().optional(),
      wearTearPerMile: z.number().optional(),
      riskBufferPercent: z.number().optional(),
      enableTimeValue: z.boolean().optional(),
      enableWearTear: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await getUserSettings(ctx.user.id);

      const routeInfo = await getRouteData(input.pickupPostcode, input.dropoffPostcode);
      const distanceMiles = routeInfo?.distanceMiles ?? 50;
      const durationMins = routeInfo?.durationMins ?? 60;

      const vehicleMpg = input.vehicleMpg ?? settings?.vehicleMpg ?? 35;
      const hourlyRate = input.hourlyRate ?? settings?.hourlyRate ?? 15;
      const wearTearPerMile = input.wearTearPerMile ?? settings?.wearTearPerMile ?? 0.15;
      const riskBufferPercent = input.riskBufferPercent ?? settings?.riskBufferPercent ?? 10;
      const enableTimeValue = input.enableTimeValue ?? settings?.enableTimeValue ?? true;
      const enableWearTear = input.enableWearTear ?? settings?.enableWearTear ?? true;
      const fuelPricePerLitre = (input.fuelPricePerLitre ?? 150) / 100; // pence to £

      const breakdown = calculateJobCost({
        deliveryFee: input.deliveryFee,
        fuelDeposit: input.fuelDeposit,
        fuelReimbursed: input.fuelReimbursed,
        distanceMiles,
        durationMins,
        fuelPricePerLitre,
        vehicleMpg,
        brokerFeePercent: input.brokerFeePercent,
        brokerFeeFixed: input.brokerFeeFixed,
        hourlyRate,
        wearTearPerMile,
        riskBufferPercent,
        enableTimeValue,
        enableWearTear,
      });

      return {
        distanceMiles,
        durationMins,
        breakdown,
        routeData: routeInfo?.routeData ?? null,
      };
    }),

  // Save a job
  create: protectedProcedure
    .input(jobInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const settings = await getUserSettings(ctx.user.id);
      const routeInfo = await getRouteData(input.pickupPostcode, input.dropoffPostcode);
      const distanceMiles = routeInfo?.distanceMiles ?? 0;
      const durationMins = routeInfo?.durationMins ?? 0;

      const vehicleMpg = settings?.vehicleMpg ?? 35;
      const hourlyRate = settings?.hourlyRate ?? 15;
      const wearTearPerMile = settings?.wearTearPerMile ?? 0.15;
      const riskBufferPercent = settings?.riskBufferPercent ?? 10;
      const enableTimeValue = settings?.enableTimeValue ?? true;
      const enableWearTear = settings?.enableWearTear ?? true;
      const fuelPricePerLitre = 1.5; // default, will be updated by fuel API

      const breakdown = calculateJobCost({
        deliveryFee: input.deliveryFee,
        fuelDeposit: input.fuelDeposit,
        fuelReimbursed: input.fuelReimbursed,
        distanceMiles,
        durationMins,
        fuelPricePerLitre,
        vehicleMpg,
        brokerFeePercent: input.brokerFeePercent,
        brokerFeeFixed: input.brokerFeeFixed,
        hourlyRate,
        wearTearPerMile,
        riskBufferPercent,
        enableTimeValue,
        enableWearTear,
      });

      await db.insert(jobs).values({
        userId: ctx.user.id,
        status: "planned",
        pickupPostcode: input.pickupPostcode.toUpperCase(),
        dropoffPostcode: input.dropoffPostcode.toUpperCase(),
        deliveryFee: input.deliveryFee,
        fuelDeposit: input.fuelDeposit,
        brokerFeePercent: input.brokerFeePercent,
        brokerFeeFixed: input.brokerFeeFixed,
        fuelReimbursed: input.fuelReimbursed,
        estimatedDistanceMiles: distanceMiles,
        estimatedDurationMins: durationMins,
        estimatedFuelCost: breakdown.fuelCost,
        estimatedFuelPricePerLitre: fuelPricePerLitre,
        estimatedWearTear: breakdown.wearTear,
        estimatedTimeValue: breakdown.timeValue,
        estimatedNetProfit: breakdown.netProfit,
        estimatedProfitPerHour: breakdown.profitPerHour,
        estimatedProfitPerMile: breakdown.profitPerMile,
        worthItScore: breakdown.worthItScore,
        scheduledPickupAt: input.scheduledPickupAt ? new Date(input.scheduledPickupAt) : undefined,
        routeData: routeInfo?.routeData ?? null,
      });

      return { success: true, breakdown, distanceMiles, durationMins };
    }),

  // List user's jobs
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { jobs: [], total: 0 };

      const conditions = [eq(jobs.userId, ctx.user.id)];
      if (input.status) conditions.push(eq(jobs.status, input.status));

      const result = await db
        .select()
        .from(jobs)
        .where(and(...conditions))
        .orderBy(desc(jobs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { jobs: result, total: result.length };
    }),

  // Get single job
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(jobs)
        .where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)))
        .limit(1);
      return result[0] ?? null;
    }),

  // Update job status / actuals
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
      actualDistanceMiles: z.number().optional(),
      actualDurationMins: z.number().optional(),
      actualFuelCost: z.number().optional(),
      actualNetProfit: z.number().optional(),
      actualNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.status === "completed") {
        updateData.completedAt = new Date();
      }

      await db.update(jobs)
        .set(updateData)
        .where(and(eq(jobs.id, id), eq(jobs.userId, ctx.user.id)));

      return { success: true };
    }),

  // Delete job
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(jobs).where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)));
      return { success: true };
    }),
});
