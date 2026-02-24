import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, userSettings } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const aiRouter = router({
  recommendations: protectedProcedure
    .input(z.object({ forceRefresh: z.boolean().default(false) }))
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get recent completed jobs for context
      const recentJobs = await db.select().from(jobs)
        .where(and(eq(jobs.userId, ctx.user.id), eq(jobs.status, "completed")))
        .orderBy(desc(jobs.completedAt))
        .limit(30);

      const settings = await db.select().from(userSettings)
        .where(eq(userSettings.userId, ctx.user.id))
        .limit(1);

      const s = settings[0];

      if (recentJobs.length === 0) {
        return {
          recommendations: [
            {
              type: "getting_started",
              title: "Start tracking your jobs",
              insight: "Complete a few jobs to unlock personalised AI recommendations on your best routes, optimal working hours, and pricing strategies.",
              priority: "high",
            },
          ],
          generatedAt: new Date().toISOString(),
        };
      }

      // Build summary for LLM
      const totalEarnings = recentJobs.reduce((sum, j) => sum + j.deliveryFee, 0);
      const totalProfit = recentJobs.reduce((sum, j) => sum + (j.actualNetProfit ?? j.estimatedNetProfit ?? 0), 0);
      const avgProfitPerHour = recentJobs.reduce((sum, j) => sum + (j.estimatedProfitPerHour ?? 0), 0) / recentJobs.length;
      const avgProfitPerMile = recentJobs.reduce((sum, j) => sum + (j.estimatedProfitPerMile ?? 0), 0) / recentJobs.length;

      const topRoutes = recentJobs
        .sort((a, b) => (b.estimatedNetProfit ?? 0) - (a.estimatedNetProfit ?? 0))
        .slice(0, 5)
        .map(j => `${j.pickupPostcode} → ${j.dropoffPostcode}: £${j.estimatedNetProfit?.toFixed(2)} profit, ${j.estimatedDistanceMiles?.toFixed(1)} miles`);

      const jobsByDay: Record<string, number> = {};
      for (const job of recentJobs) {
        if (job.completedAt) {
          const day = new Date(job.completedAt).toLocaleDateString("en-GB", { weekday: "long" });
          jobsByDay[day] = (jobsByDay[day] ?? 0) + 1;
        }
      }

      const prompt = `You are a delivery driver profitability advisor for UK car delivery drivers. Analyse this driver's recent performance and give 3-5 specific, actionable recommendations.

Driver stats (last ${recentJobs.length} jobs):
- Total earnings: £${totalEarnings.toFixed(2)}
- Total profit: £${totalProfit.toFixed(2)}
- Average profit/hour: £${avgProfitPerHour.toFixed(2)}
- Average profit/mile: £${avgProfitPerMile.toFixed(2)}
- Vehicle MPG: ${s?.vehicleMpg ?? 35}
- Hourly rate target: £${s?.hourlyRate ?? 15}/hr

Most profitable routes:
${topRoutes.join("\n")}

Jobs by day of week: ${JSON.stringify(jobsByDay)}

Return a JSON array of recommendations, each with:
- type: "route" | "timing" | "pricing" | "cost_saving" | "chain_opportunity"
- title: short title (max 8 words)
- insight: specific actionable advice (2-3 sentences, mention specific numbers/postcodes where relevant)
- priority: "high" | "medium" | "low"

Focus on: optimal working hours, best routes, cost reduction, chain opportunities, pricing strategy.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a delivery driver profitability advisor. Always respond with valid JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "recommendations",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        title: { type: "string" },
                        insight: { type: "string" },
                        priority: { type: "string" },
                      },
                      required: ["type", "title", "insight", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recommendations"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "{}";
        const parsed = JSON.parse(content);

        return {
          recommendations: parsed.recommendations ?? [],
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error("[AI] Recommendations failed:", err);
        return {
          recommendations: [
            {
              type: "route",
              title: "Focus on longer distance jobs",
              insight: `Your average profit per mile is £${avgProfitPerMile.toFixed(2)}. Jobs over 50 miles tend to be more profitable as fixed time costs are spread over more miles.`,
              priority: "high",
            },
            {
              type: "timing",
              title: "Avoid peak congestion hours",
              insight: "UK delivery drivers typically earn 20-30% more per hour by avoiding 7-9am and 4-7pm congestion windows. Plan pickups for mid-morning or early afternoon.",
              priority: "medium",
            },
            {
              type: "chain_opportunity",
              title: "Chain jobs to reduce dead miles",
              insight: "Use the Chain Planner to link 2-3 jobs per day. Drivers who chain jobs earn an average of 40% more per hour by reducing unpaid reposition time.",
              priority: "high",
            },
          ],
          generatedAt: new Date().toISOString(),
        };
      }
    }),
});
