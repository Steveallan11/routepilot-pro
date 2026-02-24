import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { vehicleConditionReports } from "../../drizzle/schema";
import { storagePut } from "../storage";
import crypto from "crypto";

function randomSuffix() {
  return crypto.randomBytes(6).toString("hex");
}

export const vehicleConditionRouter = router({
  // Get reports for a job
  getByJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(vehicleConditionReports)
        .where(and(
          eq(vehicleConditionReports.jobId, input.jobId),
          eq(vehicleConditionReports.userId, ctx.user.id)
        ));
    }),

  // Get all reports for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(vehicleConditionReports)
      .where(eq(vehicleConditionReports.userId, ctx.user.id));
  }),

  // Upload a photo and get URL
  uploadPhoto: protectedProcedure
    .input(z.object({
      base64: z.string(), // base64 encoded image
      mimeType: z.string().default("image/jpeg"),
      filename: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const key = `vehicle-photos/${ctx.user.id}/${randomSuffix()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  // Create a condition report
  create: protectedProcedure
    .input(z.object({
      jobId: z.number().optional(),
      type: z.enum(["pickup", "dropoff"]),
      vehicleReg: z.string().max(20).optional(),
      vehicleMake: z.string().max(50).optional(),
      vehicleModel: z.string().max(50).optional(),
      vehicleColour: z.string().max(30).optional(),
      photoUrls: z.array(z.string()).default([]),
      videoUrl: z.string().optional(),
      damageNotes: z.string().optional(),
      hasDamage: z.boolean().default(false),
      damageLocations: z.array(z.string()).default([]),
      locationPostcode: z.string().max(10).optional(),
      locationLat: z.number().optional(),
      locationLng: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const shareToken = crypto.randomBytes(24).toString("hex");
      const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

      const [result] = await db.insert(vehicleConditionReports).values({
        userId: ctx.user.id,
        jobId: input.jobId,
        type: input.type,
        vehicleReg: input.vehicleReg,
        vehicleMake: input.vehicleMake,
        vehicleModel: input.vehicleModel,
        vehicleColour: input.vehicleColour,
        photoUrls: input.photoUrls,
        videoUrl: input.videoUrl,
        damageNotes: input.damageNotes,
        hasDamage: input.hasDamage,
        damageLocations: input.damageLocations,
        locationPostcode: input.locationPostcode,
        locationLat: input.locationLat as unknown as number | undefined,
        locationLng: input.locationLng as unknown as number | undefined,
        shareToken,
        shareExpiresAt,
      });

      return { id: result.insertId, shareToken };
    }),

  // Get share link for a report
  getShareLink: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [report] = await db.select().from(vehicleConditionReports)
        .where(and(
          eq(vehicleConditionReports.id, input.id),
          eq(vehicleConditionReports.userId, ctx.user.id)
        )).limit(1);

      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      return { shareToken: report.shareToken, shareExpiresAt: report.shareExpiresAt };
    }),

  // Public: view shared report
  viewShared: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [report] = await db.select().from(vehicleConditionReports)
        .where(eq(vehicleConditionReports.shareToken, input.token)).limit(1);

      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      if (report.shareExpiresAt && new Date(report.shareExpiresAt) < new Date()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This report link has expired" });
      }

      return report;
    }),
});
