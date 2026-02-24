import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { notifications } from "../../drizzle/schema";

export const notificationsRouter = router({
  // Get all notifications for user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(notifications)
      .where(eq(notifications.userId, ctx.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }),

  // Get unread count
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const unread = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, ctx.user.id),
        isNull(notifications.readAt)
      ));
    return { count: unread.length };
  }),

  // Mark notification as read
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(notifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(notifications.id, input.id),
          eq(notifications.userId, ctx.user.id)
        ));
      return { success: true };
    }),

  // Mark all as read
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.userId, ctx.user.id),
        isNull(notifications.readAt)
      ));
    return { success: true };
  }),
});
