import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { jobs, userBadges, userSettings, userStreaks } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { BADGE_DEFINITIONS, getDashboardStats } from "../gamification";
import { protectedProcedure, router } from "../_core/trpc";

export const dashboardRouter = router({
  // ── Stats ──────────────────────────────────────────────────────────────────
  stats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getDashboardStats(ctx.user.id);
    return stats;
  }),

  // ── Next Planned Job ───────────────────────────────────────────────────────
  nextJob: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const now = new Date();
    const result = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.userId, ctx.user.id),
          eq(jobs.status, "planned"),
          gte(jobs.scheduledPickupAt, now),
        ),
      )
      .orderBy(jobs.scheduledPickupAt)
      .limit(1);

    return result[0] ?? null;
  }),

  // ── Badges ─────────────────────────────────────────────────────────────────
  badges: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { badges: BADGE_DEFINITIONS.map(d => ({ ...d, progress: 0, unlocked: false, awardedAt: null })) };

    const userBadgeRows = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, ctx.user.id));

    const badgeMap = new Map(userBadgeRows.map(b => [b.badgeId, b]));

    return {
      badges: BADGE_DEFINITIONS.map(def => {
        const row = badgeMap.get(def.id);
        return {
          ...def,
          progress: row?.progress ?? 0,
          unlocked: row?.unlocked ?? false,
          awardedAt: row?.unlocked ? row.awardedAt : null,
          seen: row?.seenAt != null,
        };
      }),
      newBadges: BADGE_DEFINITIONS
        .filter(def => {
          const row = badgeMap.get(def.id);
          return row?.unlocked && !row.seenAt;
        })
        .map(def => def.id),
    };
  }),

  // ── Mark badges as seen ────────────────────────────────────────────────────
  markBadgesSeen: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return;
    await db
      .update(userBadges)
      .set({ seenAt: new Date() })
      .where(and(eq(userBadges.userId, ctx.user.id)));
  }),

  // ── Streak ─────────────────────────────────────────────────────────────────
  streak: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(userStreaks).where(eq(userStreaks.userId, ctx.user.id)).limit(1);
    return rows[0] ?? null;
  }),

  // ── AI Insights ────────────────────────────────────────────────────────────
  aiInsights: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { insights: [] };

    // Gather last 30 days of job data for context
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentJobs, streakRow, settingsRow] = await Promise.all([
      db.select({
        pickupPostcode: jobs.pickupPostcode,
        dropoffPostcode: jobs.dropoffPostcode,
        deliveryFee: jobs.deliveryFee,
        estimatedDistanceMiles: jobs.estimatedDistanceMiles,
        estimatedDurationMins: jobs.estimatedDurationMins,
        estimatedNetProfit: jobs.estimatedNetProfit,
        estimatedProfitPerHour: jobs.estimatedProfitPerHour,
        worthItScore: jobs.worthItScore,
        travelHomeMode: jobs.travelHomeMode,
        brokerName: jobs.brokerName,
        scheduledPickupAt: jobs.scheduledPickupAt,
        createdAt: jobs.createdAt,
      }).from(jobs)
        .where(and(eq(jobs.userId, ctx.user.id), gte(jobs.createdAt, thirtyDaysAgo)))
        .orderBy(desc(jobs.createdAt))
        .limit(50),
      db.select().from(userStreaks).where(eq(userStreaks.userId, ctx.user.id)).limit(1),
      db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1),
    ]);

    if (recentJobs.length === 0) {
      return {
        insights: [
          { icon: "🚗", text: "Save your first job to start receiving personalised AI insights." },
          { icon: "📸", text: "Try scanning a booking screenshot to auto-fill job details in seconds." },
          { icon: "🗺️", text: "Use the Routes tab to find the cheapest way home after each delivery." },
        ],
      };
    }

    const streak = streakRow[0];
    const settings = settingsRow[0];

    // Build a concise summary for the LLM
    const summary = {
      totalJobs: recentJobs.length,
      avgProfit: recentJobs.reduce((s, j) => s + Number(j.estimatedNetProfit ?? 0), 0) / recentJobs.length,
      avgProfitPerHour: recentJobs.reduce((s, j) => s + Number(j.estimatedProfitPerHour ?? 0), 0) / recentJobs.length,
      avgMiles: recentJobs.reduce((s, j) => s + Number(j.estimatedDistanceMiles ?? 0), 0) / recentJobs.length,
      worthItRate: recentJobs.filter(j => j.worthItScore === "green").length / recentJobs.length,
      topBrokers: Array.from(new Set(recentJobs.map(j => j.brokerName).filter(Boolean))).slice(0, 3),
      trainUsageRate: recentJobs.filter(j => j.travelHomeMode === "train").length / recentJobs.length,
      currentStreak: streak?.currentStreak ?? 0,
      hourlyRate: settings?.hourlyRate ?? 15,
    };

    const prompt = `You are a smart assistant for a UK car delivery driver. Based on their last 30 days of job data, give exactly 3 short, practical, personalised tips to help them earn more or work smarter. Be specific and use their actual numbers.

Data summary:
- ${summary.totalJobs} jobs in last 30 days
- Average net profit per job: £${summary.avgProfit.toFixed(2)}
- Average profit per hour: £${summary.avgProfitPerHour.toFixed(2)} (target: £${summary.hourlyRate}/hr)
- Average job distance: ${summary.avgMiles.toFixed(1)} miles
- "Worth It" rate: ${(summary.worthItRate * 100).toFixed(0)}%
- Top brokers used: ${summary.topBrokers.join(", ") || "none recorded"}
- Train used for repositioning: ${(summary.trainUsageRate * 100).toFixed(0)}% of jobs
- Current working streak: ${summary.currentStreak} days

Return a JSON array of exactly 3 objects with fields: "icon" (single emoji), "text" (max 80 chars, actionable tip).`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a helpful assistant that returns only valid JSON arrays." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "insights",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      icon: { type: "string" },
                      text: { type: "string" },
                    },
                    required: ["icon", "text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return { insights: parsed.insights ?? [] };
      }
    } catch (e) {
      console.error("[Dashboard] AI insights error:", e);
    }

    return {
      insights: [
        { icon: "💰", text: `Your avg profit is £${summary.avgProfit.toFixed(2)}/job. Aim for £${(summary.avgProfit * 1.1).toFixed(2)} by filtering out sub-£0.30/mile jobs.` },
        { icon: "🚂", text: `You use the train ${(summary.trainUsageRate * 100).toFixed(0)}% of the time. Increasing this saves wear & tear costs.` },
        { icon: "⏰", text: `Your avg profit/hr is £${summary.avgProfitPerHour.toFixed(2)}. Try chaining 2 jobs to push this above £${summary.hourlyRate}/hr.` },
      ],
    };
  }),
});
