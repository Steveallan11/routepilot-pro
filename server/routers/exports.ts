import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { jobs } from "../../drizzle/schema";

// HMRC approved mileage rate (2024/25)
const HMRC_MILEAGE_RATE_FIRST_10K = 0.45; // 45p per mile for first 10,000 miles
const HMRC_MILEAGE_RATE_OVER_10K = 0.25;  // 25p per mile over 10,000 miles

export const exportsRouter = router({
  // Generate HMRC mileage log CSV
  mileageCSV: protectedProcedure
    .input(z.object({
      fromDate: z.string(), // YYYY-MM-DD
      toDate: z.string(),   // YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const fromTs = new Date(input.fromDate + "T00:00:00Z");
      const toTs = new Date(input.toDate + "T23:59:59Z");

      const jobList = await db.select().from(jobs)
        .where(and(
          eq(jobs.userId, ctx.user.id),
          gte(jobs.createdAt, fromTs),
          lte(jobs.createdAt, toTs)
        ))
        .orderBy(jobs.createdAt);

      // Build CSV rows
      const rows: string[] = [
        "Date,From,To,Miles,Purpose,HMRC Rate (£/mile),HMRC Allowance (£),Actual Fuel Cost (£),Net Profit (£)"
      ];

      let cumulativeMiles = 0;
      for (const job of jobList) {
        const miles = Number(job.estimatedDistanceMiles) || 0;
        const date = job.createdAt ? new Date(job.createdAt).toLocaleDateString("en-GB") : "";
        const from = job.pickupPostcode;
        const to = job.dropoffPostcode;
        const purpose = `Car delivery${job.vehicleReg ? ` - ${job.vehicleReg}` : ""}${job.brokerName ? ` (${job.brokerName})` : ""}`;

        // Calculate HMRC rate based on cumulative mileage
        let hmrcAllowance = 0;
        if (cumulativeMiles < 10000) {
          const milesAtFirstRate = Math.min(miles, 10000 - cumulativeMiles);
          const milesAtSecondRate = miles - milesAtFirstRate;
          hmrcAllowance = milesAtFirstRate * HMRC_MILEAGE_RATE_FIRST_10K + milesAtSecondRate * HMRC_MILEAGE_RATE_OVER_10K;
        } else {
          hmrcAllowance = miles * HMRC_MILEAGE_RATE_OVER_10K;
        }
        cumulativeMiles += miles;

        const rate = cumulativeMiles <= 10000 ? HMRC_MILEAGE_RATE_FIRST_10K : HMRC_MILEAGE_RATE_OVER_10K;
        const fuelCost = Number(job.estimatedFuelCost) || 0;
        const netProfit = Number(job.estimatedNetProfit) || 0;

        rows.push([
          date,
          from,
          to,
          miles.toFixed(1),
          `"${purpose}"`,
          rate.toFixed(2),
          hmrcAllowance.toFixed(2),
          fuelCost.toFixed(2),
          netProfit.toFixed(2),
        ].join(","));
      }

      // Summary row
      const totalMiles = jobList.reduce((s, j) => s + (Number(j.estimatedDistanceMiles) || 0), 0);
      const totalHmrc = totalMiles <= 10000
        ? totalMiles * HMRC_MILEAGE_RATE_FIRST_10K
        : 10000 * HMRC_MILEAGE_RATE_FIRST_10K + (totalMiles - 10000) * HMRC_MILEAGE_RATE_OVER_10K;
      const totalProfit = jobList.reduce((s, j) => s + (Number(j.estimatedNetProfit) || 0), 0);

      rows.push("");
      rows.push(`TOTAL,,,"${totalMiles.toFixed(1)}",,,"${totalHmrc.toFixed(2)}",,,"${totalProfit.toFixed(2)}"`);

      return {
        csv: rows.join("\n"),
        totalJobs: jobList.length,
        totalMiles: Math.round(totalMiles * 10) / 10,
        totalHmrcAllowance: Math.round(totalHmrc * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
      };
    }),

  // Generate monthly P&L summary
  monthlyPL: protectedProcedure
    .input(z.object({
      year: z.number().min(2020).max(2030),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const fromTs = new Date(`${input.year}-01-01T00:00:00Z`);
      const toTs = new Date(`${input.year}-12-31T23:59:59Z`);

      const jobList = await db.select().from(jobs)
        .where(and(
          eq(jobs.userId, ctx.user.id),
          gte(jobs.createdAt, fromTs),
          lte(jobs.createdAt, toTs)
        ))
        .orderBy(jobs.createdAt);

      // Group by month
      const months: Record<string, {
        month: string;
        jobs: number;
        grossIncome: number;
        fuelCosts: number;
        travelCosts: number;
        brokerFees: number;
        netProfit: number;
        miles: number;
        avgPerJob: number;
        avgPerMile: number;
      }> = {};

      for (let m = 1; m <= 12; m++) {
        const key = `${input.year}-${String(m).padStart(2, "0")}`;
        const label = new Date(`${key}-01`).toLocaleString("en-GB", { month: "long" });
        months[key] = { month: label, jobs: 0, grossIncome: 0, fuelCosts: 0, travelCosts: 0, brokerFees: 0, netProfit: 0, miles: 0, avgPerJob: 0, avgPerMile: 0 };
      }

      for (const job of jobList) {
        const key = new Date(job.createdAt).toISOString().slice(0, 7);
        if (!months[key]) continue;

        const gross = Number(job.deliveryFee) + Number(job.fuelDeposit || 0);
        const fuel = Number(job.estimatedFuelCost) || 0;
        const travel = (Number(job.travelToJobCost) || 0) + (Number(job.travelHomeCost) || 0);
        const brokerFee = (gross * (Number(job.brokerFeePercent) || 0) / 100) + (Number(job.brokerFeeFixed) || 0);
        const net = Number(job.estimatedNetProfit) || 0;
        const miles = Number(job.estimatedDistanceMiles) || 0;

        months[key].jobs++;
        months[key].grossIncome += gross;
        months[key].fuelCosts += fuel;
        months[key].travelCosts += travel;
        months[key].brokerFees += brokerFee;
        months[key].netProfit += net;
        months[key].miles += miles;
      }

      // Calculate averages
      for (const key of Object.keys(months)) {
        const m = months[key];
        m.grossIncome = Math.round(m.grossIncome * 100) / 100;
        m.fuelCosts = Math.round(m.fuelCosts * 100) / 100;
        m.travelCosts = Math.round(m.travelCosts * 100) / 100;
        m.brokerFees = Math.round(m.brokerFees * 100) / 100;
        m.netProfit = Math.round(m.netProfit * 100) / 100;
        m.miles = Math.round(m.miles * 10) / 10;
        m.avgPerJob = m.jobs > 0 ? Math.round((m.netProfit / m.jobs) * 100) / 100 : 0;
        m.avgPerMile = m.miles > 0 ? Math.round((m.netProfit / m.miles) * 100) / 100 : 0;
      }

      const monthsArray = Object.values(months);
      const totals = monthsArray.reduce((acc, m) => ({
        jobs: acc.jobs + m.jobs,
        grossIncome: acc.grossIncome + m.grossIncome,
        fuelCosts: acc.fuelCosts + m.fuelCosts,
        travelCosts: acc.travelCosts + m.travelCosts,
        brokerFees: acc.brokerFees + m.brokerFees,
        netProfit: acc.netProfit + m.netProfit,
        miles: acc.miles + m.miles,
      }), { jobs: 0, grossIncome: 0, fuelCosts: 0, travelCosts: 0, brokerFees: 0, netProfit: 0, miles: 0 });

      return { months: monthsArray, totals, year: input.year };
    }),
});
