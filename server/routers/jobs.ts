import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, userSettings } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { makeRequest } from "../_core/map";
import { calculateJobCost } from "../../shared/routepilot-types";
import { checkAndAwardBadges } from "../gamification";

const jobInputSchema = z.object({
  pickupPostcode: z.string().min(2).max(10),
  dropoffPostcode: z.string().min(2).max(10),
  deliveryFee: z.number().min(0),
  fuelDeposit: z.number().min(0).default(0),
  brokerFeePercent: z.number().min(0).max(100).default(0),
  brokerFeeFixed: z.number().min(0).default(0),
  fuelReimbursed: z.boolean().default(false),
  scheduledPickupAt: z.string().optional(),
  // Travel expenses
  travelToJobCost: z.number().min(0).default(0),
  travelToJobMode: z.enum(["train", "bus", "taxi", "own_car", "none"]).default("none"),
  travelHomePostcode: z.string().max(10).optional(),
  travelHomeCost: z.number().min(0).default(0),
  travelHomeMode: z.enum(["train", "bus", "taxi", "own_car", "none"]).default("none"),
  // Vehicle details
  vehicleMake: z.string().max(50).optional(),
  vehicleModel: z.string().max(50).optional(),
  vehicleReg: z.string().max(20).optional(),
  vehicleFuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "unknown"]).optional(),
  vehicleColour: z.string().max(30).optional(),
  // Booking metadata (from AI scan or manual entry)
  brokerName: z.string().max(100).optional(),
  jobReference: z.string().max(100).optional(),
  pickupAddress: z.string().optional(),
  dropoffAddress: z.string().optional(),
  bookingImageUrl: z.string().url().optional(),
  notes: z.string().optional(),
  // Pre-scanned distance/duration from broker app screenshot
  scannedDistanceMiles: z.number().optional(),
  scannedDurationMins: z.number().optional(),
  // Scheduled dropoff time
  scheduledDropoffAt: z.string().optional(),
  // Contact details
  pickupContactName: z.string().max(100).optional(),
  pickupContactPhone: z.string().max(30).optional(),
  dropoffContactName: z.string().max(100).optional(),
  dropoffContactPhone: z.string().max(30).optional(),
  customerName: z.string().max(100).optional(),
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
        travelToJobCost: input.travelToJobCost,
        travelHomeCost: input.travelHomeCost,
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
      // Use safe fallbacks to avoid division-by-zero in profitPerMile/profitPerHour
      const distanceMiles = routeInfo?.distanceMiles ?? 50;
      const durationMins = routeInfo?.durationMins ?? 60;

      const vehicleMpg = settings?.vehicleMpg ?? 35;
      const fuelPricePerLitre = 1.5;

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
        travelToJobCost: input.travelToJobCost,
        travelHomeCost: input.travelHomeCost,
      });

      const insertResult = await db.insert(jobs).values({
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
        // Travel expenses
        travelToJobCost: input.travelToJobCost,
        travelToJobMode: input.travelToJobMode,
        travelHomePostcode: input.travelHomePostcode ?? null,
        travelHomeCost: input.travelHomeCost,
        travelHomeMode: input.travelHomeMode,
        // Vehicle details
        vehicleMake: input.vehicleMake ?? null,
        vehicleModel: input.vehicleModel ?? null,
        vehicleReg: input.vehicleReg ?? null,
        vehicleFuelType: input.vehicleFuelType ?? "unknown",
        vehicleColour: input.vehicleColour ?? null,
        scannedDistanceMiles: input.scannedDistanceMiles ?? null,
        scannedDurationMins: input.scannedDurationMins ?? null,
        // Booking metadata
        brokerName: input.brokerName ?? null,
        jobReference: input.jobReference ?? null,
        pickupAddress: input.pickupAddress ?? null,
        dropoffAddress: input.dropoffAddress ?? null,
        bookingImageUrl: input.bookingImageUrl ?? null,
        notes: input.notes ?? null,
        // Scheduled dropoff
        scheduledDropoffAt: input.scheduledDropoffAt ? new Date(input.scheduledDropoffAt) : undefined,
        // Contact details
        pickupContactName: input.pickupContactName ?? null,
        pickupContactPhone: input.pickupContactPhone ?? null,
        dropoffContactName: input.dropoffContactName ?? null,
        dropoffContactPhone: input.dropoffContactPhone ?? null,
        customerName: input.customerName ?? null,
      }).$returningId();

      // $returningId() returns an array of objects with primary key fields
      const insertedId = Array.isArray(insertResult) && insertResult.length > 0
        ? Number((insertResult[0] as { id?: number | bigint })?.id ?? 0)
        : 0;

      // Fire gamification in background (don't block response)
      checkAndAwardBadges(ctx.user.id, {
        jobMiles: distanceMiles,
        jobEarnings: breakdown.grossIncome,
        profitPerMile: breakdown.profitPerMile,
        travelHomeMode: input.travelHomeMode,
        isScanned: !!input.bookingImageUrl,
      }).catch(e => console.warn("[Gamification]", e));

      return { success: true, jobId: insertedId, breakdown, distanceMiles, durationMins };
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

      // TiDB/MySQL decimal columns come back as strings from the driver.
      // Coerce all numeric fields to actual numbers before sending to the client.
      const normalised = result.map(j => ({
        ...j,
        deliveryFee: Number(j.deliveryFee),
        fuelDeposit: Number(j.fuelDeposit),
        brokerFeePercent: Number(j.brokerFeePercent),
        brokerFeeFixed: Number(j.brokerFeeFixed),
        estimatedDistanceMiles: j.estimatedDistanceMiles != null ? Number(j.estimatedDistanceMiles) : null,
        estimatedDurationMins: j.estimatedDurationMins != null ? Number(j.estimatedDurationMins) : null,
        estimatedFuelCost: j.estimatedFuelCost != null ? Number(j.estimatedFuelCost) : null,
        estimatedFuelPricePerLitre: j.estimatedFuelPricePerLitre != null ? Number(j.estimatedFuelPricePerLitre) : null,
        estimatedWearTear: j.estimatedWearTear != null ? Number(j.estimatedWearTear) : null,
        estimatedTimeValue: j.estimatedTimeValue != null ? Number(j.estimatedTimeValue) : null,
        estimatedNetProfit: j.estimatedNetProfit != null ? Number(j.estimatedNetProfit) : null,
        estimatedProfitPerHour: j.estimatedProfitPerHour != null ? Number(j.estimatedProfitPerHour) : null,
        estimatedProfitPerMile: j.estimatedProfitPerMile != null ? Number(j.estimatedProfitPerMile) : null,
        actualDistanceMiles: j.actualDistanceMiles != null ? Number(j.actualDistanceMiles) : null,
        actualDurationMins: j.actualDurationMins != null ? Number(j.actualDurationMins) : null,
        actualFuelCost: j.actualFuelCost != null ? Number(j.actualFuelCost) : null,
        actualNetProfit: j.actualNetProfit != null ? Number(j.actualNetProfit) : null,
        travelToJobCost: j.travelToJobCost != null ? Number(j.travelToJobCost) : null,
        travelHomeCost: j.travelHomeCost != null ? Number(j.travelHomeCost) : null,
        scannedDistanceMiles: j.scannedDistanceMiles != null ? Number(j.scannedDistanceMiles) : null,
        scannedDurationMins: j.scannedDurationMins != null ? Number(j.scannedDurationMins) : null,
      }));
      return { jobs: normalised, total: normalised.length };
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
      if (!result[0]) return null;
      const j = result[0];
      return {
        ...j,
        deliveryFee: Number(j.deliveryFee),
        fuelDeposit: Number(j.fuelDeposit),
        brokerFeePercent: Number(j.brokerFeePercent),
        brokerFeeFixed: Number(j.brokerFeeFixed),
        estimatedDistanceMiles: j.estimatedDistanceMiles != null ? Number(j.estimatedDistanceMiles) : null,
        estimatedDurationMins: j.estimatedDurationMins != null ? Number(j.estimatedDurationMins) : null,
        estimatedNetProfit: j.estimatedNetProfit != null ? Number(j.estimatedNetProfit) : null,
        estimatedProfitPerHour: j.estimatedProfitPerHour != null ? Number(j.estimatedProfitPerHour) : null,
        estimatedProfitPerMile: j.estimatedProfitPerMile != null ? Number(j.estimatedProfitPerMile) : null,
        actualDistanceMiles: j.actualDistanceMiles != null ? Number(j.actualDistanceMiles) : null,
        actualDurationMins: j.actualDurationMins != null ? Number(j.actualDurationMins) : null,
        actualNetProfit: j.actualNetProfit != null ? Number(j.actualNetProfit) : null,
        travelToJobCost: j.travelToJobCost != null ? Number(j.travelToJobCost) : null,
        travelHomeCost: j.travelHomeCost != null ? Number(j.travelHomeCost) : null,
      };
    }),

  // Update job status / actuals / metadata
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["planned", "active", "completed", "cancelled"]).optional(),
      actualDistanceMiles: z.number().optional(),
      actualDurationMins: z.number().optional(),
      actualFuelCost: z.number().optional(),
      actualNetProfit: z.number().optional(),
      actualNotes: z.string().optional(),
      // Allow updating all job fields
      scheduledPickupAt: z.string().optional(),
      scheduledDropoffAt: z.string().optional(),
      pickupContactName: z.string().max(100).optional(),
      pickupContactPhone: z.string().max(30).optional(),
      dropoffContactName: z.string().max(100).optional(),
      dropoffContactPhone: z.string().max(30).optional(),
      customerName: z.string().max(100).optional(),
      vehicleMake: z.string().max(50).optional(),
      vehicleModel: z.string().max(50).optional(),
      vehicleReg: z.string().max(20).optional(),
      vehicleFuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "unknown"]).optional(),
      vehicleColour: z.string().max(30).optional(),
      notes: z.string().optional(),
      travelRouteData: z.any().optional(),
      travelToJobCost: z.number().min(0).optional(),
      travelToJobMode: z.enum(["train", "bus", "taxi", "own_car", "none"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.status === "completed") {
        updateData.completedAt = new Date();
      }
      // Convert date strings to Date objects
      if (typeof updates.scheduledPickupAt === "string") {
        updateData.scheduledPickupAt = new Date(updates.scheduledPickupAt);
      }
      if (typeof updates.scheduledDropoffAt === "string") {
        updateData.scheduledDropoffAt = new Date(updates.scheduledDropoffAt);
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

  // Duplicate a job (clone with status reset to planned)
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const existing = await db.select().from(jobs)
        .where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)))
        .limit(1);
      if (!existing[0]) throw new Error("Job not found");
      const src = existing[0];
      const insertResult = await db.insert(jobs).values({
        userId: ctx.user.id,
        status: "planned",
        pickupPostcode: src.pickupPostcode,
        dropoffPostcode: src.dropoffPostcode,
        deliveryFee: src.deliveryFee,
        fuelDeposit: src.fuelDeposit,
        brokerFeePercent: src.brokerFeePercent,
        brokerFeeFixed: src.brokerFeeFixed,
        fuelReimbursed: src.fuelReimbursed,
        estimatedDistanceMiles: src.estimatedDistanceMiles,
        estimatedDurationMins: src.estimatedDurationMins,
        estimatedFuelCost: src.estimatedFuelCost,
        estimatedFuelPricePerLitre: src.estimatedFuelPricePerLitre,
        estimatedWearTear: src.estimatedWearTear,
        estimatedTimeValue: src.estimatedTimeValue,
        estimatedNetProfit: src.estimatedNetProfit,
        estimatedProfitPerHour: src.estimatedProfitPerHour,
        estimatedProfitPerMile: src.estimatedProfitPerMile,
        worthItScore: src.worthItScore,
        routeData: src.routeData,
        travelToJobCost: src.travelToJobCost,
        travelToJobMode: src.travelToJobMode,
        travelHomePostcode: src.travelHomePostcode,
        travelHomeCost: src.travelHomeCost,
        travelHomeMode: src.travelHomeMode,
        vehicleMake: src.vehicleMake,
        vehicleModel: src.vehicleModel,
        vehicleReg: src.vehicleReg,
        vehicleFuelType: src.vehicleFuelType,
        vehicleColour: src.vehicleColour,
        brokerName: src.brokerName,
        jobReference: null, // don't copy reference
        pickupAddress: src.pickupAddress,
        dropoffAddress: src.dropoffAddress,
        bookingImageUrl: null,
        notes: src.notes,
        customerName: src.customerName,
        pickupContactName: src.pickupContactName,
        pickupContactPhone: src.pickupContactPhone,
        dropoffContactName: src.dropoffContactName,
        dropoffContactPhone: src.dropoffContactPhone,
        scannedDistanceMiles: src.scannedDistanceMiles,
        scannedDurationMins: src.scannedDurationMins,
      }).$returningId();
      const insertedId = Array.isArray(insertResult) && insertResult.length > 0
        ? Number((insertResult[0] as { id?: number | bigint })?.id ?? 0)
        : 0;
      return { success: true, jobId: insertedId };
    }),

  // Full edit of a job (re-calculates route if postcodes change)
  edit: protectedProcedure
    .input(jobInputSchema.extend({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const settings = await getUserSettings(ctx.user.id);
      const routeInfo = await getRouteData(input.pickupPostcode, input.dropoffPostcode);
      const distanceMiles = routeInfo?.distanceMiles ?? 50;
      const durationMins = routeInfo?.durationMins ?? 60;

      const vehicleMpg = settings?.vehicleMpg ?? 35;
      const fuelPricePerLitre = 1.5;

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
        travelToJobCost: input.travelToJobCost,
        travelHomeCost: input.travelHomeCost,
      });

      await db.update(jobs).set({
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
        routeData: routeInfo?.routeData ?? null,
        travelToJobCost: input.travelToJobCost,
        travelToJobMode: input.travelToJobMode,
        travelHomePostcode: input.travelHomePostcode ?? null,
        travelHomeCost: input.travelHomeCost,
        travelHomeMode: input.travelHomeMode,
        vehicleMake: input.vehicleMake ?? null,
        vehicleModel: input.vehicleModel ?? null,
        vehicleReg: input.vehicleReg ?? null,
        vehicleFuelType: input.vehicleFuelType ?? "unknown",
        vehicleColour: input.vehicleColour ?? null,
        brokerName: input.brokerName ?? null,
        jobReference: input.jobReference ?? null,
        pickupAddress: input.pickupAddress ?? null,
        dropoffAddress: input.dropoffAddress ?? null,
        bookingImageUrl: input.bookingImageUrl ?? null,
        notes: input.notes ?? null,
        scheduledPickupAt: input.scheduledPickupAt ? new Date(input.scheduledPickupAt) : undefined,
        scheduledDropoffAt: input.scheduledDropoffAt ? new Date(input.scheduledDropoffAt) : undefined,
        pickupContactName: input.pickupContactName ?? null,
        pickupContactPhone: input.pickupContactPhone ?? null,
        dropoffContactName: input.dropoffContactName ?? null,
        dropoffContactPhone: input.dropoffContactPhone ?? null,
        customerName: input.customerName ?? null,
      }).where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id)));

      return { success: true, breakdown, distanceMiles, durationMins };
    }),
});
