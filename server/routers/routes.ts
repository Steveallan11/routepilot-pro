import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { favouriteRoutes, routeHistory } from "../../drizzle/schema";

const legSchema = z.object({
  mode: z.string(),
  summary: z.string().optional(),
  durationSecs: z.number(),
  distanceMetres: z.number().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  lineName: z.string().optional(),
  departureStop: z.string().optional(),
  arrivalStop: z.string().optional(),
  numStops: z.number().optional(),
  polyline: z.string().optional(),
  estimatedFare: z.number().optional(),
});

const saveRouteInput = z.object({
  fromPostcode: z.string().min(2).max(10),
  toPostcode: z.string().min(2).max(10),
  label: z.enum(["fastest", "cheapest", "balanced"]),
  summary: z.string().max(200).optional(),
  totalDurationSecs: z.number().optional(),
  totalDistanceMetres: z.number().optional(),
  estimatedCost: z.number().optional(),
  dominantMode: z.string().max(20).optional(),
  departureTime: z.string().max(30).optional(),
  arrivalTime: z.string().max(30).optional(),
  legs: z.array(legSchema).optional(),
});

export const routesRouter = router({
  // ── Favourites ──────────────────────────────────────────────────────────────

  listFavourites: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(favouriteRoutes)
      .where(eq(favouriteRoutes.userId, ctx.user.id))
      .orderBy(favouriteRoutes.createdAt);
  }),

  saveFavourite: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      fromPostcode: z.string().min(2).max(10),
      toPostcode: z.string().min(2).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db.insert(favouriteRoutes).values({
        userId: ctx.user.id,
        name: input.name,
        fromPostcode: input.fromPostcode.toUpperCase(),
        toPostcode: input.toPostcode.toUpperCase(),
      });
      return { id: (result as any).insertId };
    }),

  deleteFavourite: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .delete(favouriteRoutes)
        .where(and(
          eq(favouriteRoutes.id, input.id),
          eq(favouriteRoutes.userId, ctx.user.id),
        ));
      return { success: true };
    }),

  // ── Route History ────────────────────────────────────────────────────────────

  listHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(routeHistory)
        .where(eq(routeHistory.userId, ctx.user.id))
        .orderBy(desc(routeHistory.usedAt))
        .limit(input.limit);
    }),

  saveToHistory: protectedProcedure
    .input(saveRouteInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db.insert(routeHistory).values({
        userId: ctx.user.id,
        fromPostcode: input.fromPostcode.toUpperCase(),
        toPostcode: input.toPostcode.toUpperCase(),
        label: input.label,
        summary: input.summary,
        totalDurationSecs: input.totalDurationSecs,
        totalDistanceMetres: input.totalDistanceMetres,
        estimatedCost: input.estimatedCost as unknown as number | undefined,
        dominantMode: input.dominantMode,
        departureTime: input.departureTime,
        arrivalTime: input.arrivalTime,
        legsSnapshot: input.legs ?? null,
      });
      return { id: (result as any).insertId };
    }),

  deleteHistory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .delete(routeHistory)
        .where(and(
          eq(routeHistory.id, input.id),
          eq(routeHistory.userId, ctx.user.id),
        ));
      return { success: true };
    }),

  // ── Share ────────────────────────────────────────────────────────────────────

  createShare: protectedProcedure
    .input(saveRouteInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const token = nanoid(16);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const [result] = await db.insert(routeHistory).values({
        userId: ctx.user.id,
        fromPostcode: input.fromPostcode.toUpperCase(),
        toPostcode: input.toPostcode.toUpperCase(),
        label: input.label,
        summary: input.summary,
        totalDurationSecs: input.totalDurationSecs,
        totalDistanceMetres: input.totalDistanceMetres,
        estimatedCost: input.estimatedCost as unknown as number | undefined,
        dominantMode: input.dominantMode,
        departureTime: input.departureTime,
        arrivalTime: input.arrivalTime,
        legsSnapshot: input.legs ?? null,
        shareToken: token,
        shareExpiresAt: expiresAt,
      });
      return { id: (result as any).insertId, token };
    }),

  getSharedRoute: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db
        .select()
        .from(routeHistory)
        .where(eq(routeHistory.shareToken, input.token))
        .limit(1);
      if (!rows.length) return null;
      const route = rows[0];
      // Check expiry
      if (route.shareExpiresAt && new Date() > route.shareExpiresAt) return null;
      return route;
    }),
});
