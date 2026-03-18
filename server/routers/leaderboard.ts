import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, userSettings } from "../../drizzle/schema";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(weekOffset = 0): { start: Date; end: Date; key: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const key = monday.toISOString().slice(0, 10);
  return { start: monday, end: sunday, key };
}

type SettingsRow = { userId: number; displayName: string | null; leaderboardOptIn: boolean };
type LeaderRow = { userId: number; netEarnings: number; jobCount: number; totalMiles: number; gradeSum: number };

// ─── Router ───────────────────────────────────────────────────────────────────

export const leaderboardRouter = router({
  // Get the weekly leaderboard (public — anonymised display names)
  weekly: publicProcedure
    .input(z.object({
      weekOffset: z.number().min(-4).max(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { entries: [], weekKey: "", weekStart: "", weekEnd: "" };
      const { start, end, key } = getWeekBounds(input.weekOffset);

      const rows = await db
        .select({
          userId: jobs.userId,
          netEarnings: sql<number>`COALESCE(SUM(CASE WHEN ${jobs.actualNetProfit} IS NOT NULL THEN ${jobs.actualNetProfit} ELSE ${jobs.estimatedNetProfit} END), 0)`,
          jobCount: sql<number>`COUNT(*)`,
          totalMiles: sql<number>`COALESCE(SUM(CASE WHEN ${jobs.actualDistanceMiles} IS NOT NULL THEN ${jobs.actualDistanceMiles} ELSE ${jobs.estimatedDistanceMiles} END), 0)`,
          gradeSum: sql<number>`COALESCE(SUM(CASE grade WHEN 'A+' THEN 5 WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 ELSE 0 END), 0)`,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "completed"),
            gte(jobs.updatedAt, start),
            lte(jobs.updatedAt, end),
          )
        )
        .groupBy(jobs.userId)
        .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${jobs.actualNetProfit} IS NOT NULL THEN ${jobs.actualNetProfit} ELSE ${jobs.estimatedNetProfit} END), 0)`));

      const userIds = (rows as LeaderRow[]).map((r) => r.userId);
      const settingsRows: SettingsRow[] = userIds.length > 0
        ? (await db
            .select({ userId: userSettings.userId, displayName: userSettings.displayName, leaderboardOptIn: userSettings.leaderboardOptIn })
            .from(userSettings)
            .where(sql`${userSettings.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`)
          ) as SettingsRow[]
        : [];

      const settingsMap = new Map<number, SettingsRow>(settingsRows.map((s) => [s.userId, s]));

      const entries = (rows as LeaderRow[]).map((row, idx: number) => {
        const settings = settingsMap.get(row.userId);
        const optedIn = settings?.leaderboardOptIn ?? false;
        const displayName = optedIn && settings?.displayName
          ? settings.displayName
          : `Driver ${String(row.userId).slice(-3).padStart(3, "0")}`;
        const avgGrade = row.jobCount > 0
          ? (["D", "C", "B", "A", "A+"][Math.min(4, Math.round(row.gradeSum / row.jobCount) - 1)] ?? "B")
          : null;
        return {
          rank: idx + 1,
          userId: row.userId,
          displayName,
          netEarnings: Number(row.netEarnings),
          jobCount: Number(row.jobCount),
          totalMiles: Number(row.totalMiles),
          avgGrade,
          optedIn,
        };
      });

      return { entries, weekKey: key, weekStart: start.toISOString(), weekEnd: end.toISOString() };
    }),

  // Get the current user's leaderboard position and opt-in status
  myPosition: protectedProcedure
    .input(z.object({ weekOffset: z.number().min(-4).max(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { rank: 0, netEarnings: 0, jobCount: 0, totalMiles: 0, optedIn: false, displayName: null };
      const { start, end } = getWeekBounds(input.weekOffset);

      const [myStats] = await db
        .select({
          netEarnings: sql<number>`COALESCE(SUM(CASE WHEN ${jobs.actualNetProfit} IS NOT NULL THEN ${jobs.actualNetProfit} ELSE ${jobs.estimatedNetProfit} END), 0)`,
          jobCount: sql<number>`COUNT(*)`,
          totalMiles: sql<number>`COALESCE(SUM(CASE WHEN ${jobs.actualDistanceMiles} IS NOT NULL THEN ${jobs.actualDistanceMiles} ELSE ${jobs.estimatedDistanceMiles} END), 0)`,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.userId, ctx.user.id),
            eq(jobs.status, "completed"),
            gte(jobs.updatedAt, start),
            lte(jobs.updatedAt, end),
          )
        );

      // Count how many users earned more this week (approximate rank)
      const higherRows = await db
        .select({ higherCount: sql<number>`COUNT(DISTINCT ${jobs.userId})` })
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "completed"),
            gte(jobs.updatedAt, start),
            lte(jobs.updatedAt, end),
          )
        )
        .groupBy(jobs.userId)
        .having(
          sql`COALESCE(SUM(CASE WHEN ${jobs.actualNetProfit} IS NOT NULL THEN ${jobs.actualNetProfit} ELSE ${jobs.estimatedNetProfit} END), 0) > ${Number(myStats?.netEarnings ?? 0)}`
        );

      const higherCount = higherRows.length;

      const [mySettingsRow] = await db
        .select({ displayName: userSettings.displayName, leaderboardOptIn: userSettings.leaderboardOptIn })
        .from(userSettings)
        .where(eq(userSettings.userId, ctx.user.id));

      return {
        rank: higherCount + 1,
        netEarnings: Number(myStats?.netEarnings ?? 0),
        jobCount: Number(myStats?.jobCount ?? 0),
        totalMiles: Number(myStats?.totalMiles ?? 0),
        optedIn: mySettingsRow?.leaderboardOptIn ?? false,
        displayName: mySettingsRow?.displayName ?? null,
      };
    }),

  // Toggle leaderboard opt-in and set display name
  updateOptIn: protectedProcedure
    .input(z.object({
      optedIn: z.boolean(),
      displayName: z.string().min(2).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(userSettings)
        .set({
          leaderboardOptIn: input.optedIn,
          displayName: input.displayName ?? null,
        })
        .where(eq(userSettings.userId, ctx.user.id));
      return { success: true };
    }),
});
