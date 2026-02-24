import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { favouriteRoutes } from "../../drizzle/schema";

export const routesRouter = router({
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
});
