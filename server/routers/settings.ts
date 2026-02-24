import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const settingsSchema = z.object({
  vehicleMpg: z.number().min(1).max(200).optional(),
  fuelType: z.enum(["petrol", "diesel"]).optional(),
  hourlyRate: z.number().min(0).max(500).optional(),
  wearTearPerMile: z.number().min(0).max(5).optional(),
  defaultBrokerFeePercent: z.number().min(0).max(100).optional(),
  riskBufferPercent: z.number().min(0).max(100).optional(),
  enableTimeValue: z.boolean().optional(),
  enableWearTear: z.boolean().optional(),
  homePostcode: z.string().max(10).optional(),
  alertsEnabled: z.boolean().optional(),
});

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
    return result[0] ?? null;
  }),

  upsert: protectedProcedure
    .input(settingsSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const existing = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);

      if (existing.length > 0) {
        await db.update(userSettings).set(input).where(eq(userSettings.userId, ctx.user.id));
      } else {
        await db.insert(userSettings).values({
          userId: ctx.user.id,
          vehicleMpg: input.vehicleMpg ?? 35,
          fuelType: input.fuelType ?? "petrol",
          hourlyRate: input.hourlyRate ?? 15,
          wearTearPerMile: input.wearTearPerMile ?? 0.15,
          defaultBrokerFeePercent: input.defaultBrokerFeePercent ?? 0,
          riskBufferPercent: input.riskBufferPercent ?? 10,
          enableTimeValue: input.enableTimeValue ?? true,
          enableWearTear: input.enableWearTear ?? true,
          homePostcode: input.homePostcode,
          alertsEnabled: input.alertsEnabled ?? true,
        });
      }

      return { success: true };
    }),
});
