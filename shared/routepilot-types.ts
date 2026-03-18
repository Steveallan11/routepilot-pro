export interface JobCostInput {
  deliveryFee: number;
  fuelDeposit: number;       // Reimbursed by broker — counts as income
  fuelReimbursed: boolean;   // If true, driver pays no fuel cost at all
  distanceMiles: number;
  durationMins: number;
  fuelPricePerLitre: number; // £ per litre
  vehicleMpg: number;
  brokerFeePercent: number;
  brokerFeeFixed: number;
  // Travel expenses (only real out-of-pocket deductions)
  travelToJobCost: number;   // Cost to get to the pickup (train/bus/taxi/own car)
  travelHomeCost: number;    // Cost to get home after dropoff (or to next job)
  // Legacy fields — kept for backward compat but no longer used in calculation
  hourlyRate?: number;
  wearTearPerMile?: number;
  riskBufferPercent?: number;
  enableTimeValue?: boolean;
  enableWearTear?: boolean;
}

// ─── Grade system ─────────────────────────────────────────────────────────────
// A+ = 90-100  (exceptional — top 10% earner territory)
// A  = 75-89   (good job, above average)
// B  = 55-74   (acceptable, room to improve)
// C  = 35-54   (below average, consider alternatives)
// D  = 0-34    (poor — likely not worth it)
export type Grade = "A+" | "A" | "B" | "C" | "D";

export interface ScoreDimensions {
  // 1. Profit per mile vs benchmark (£0.50/mi = 100 pts)
  ppmScore: number;
  // 2. Net profit absolute (£50+ = 100 pts)
  netProfitScore: number;
  // 3. Transport cost ratio (travelCosts / grossIncome — lower is better)
  transportRatioScore: number;
  // 4. Profit per hour (£15/hr = 100 pts)
  pphScore: number;
  // 5. Job efficiency (distance vs. earnings density)
  efficiencyScore: number;
}

export interface JobCostBreakdown {
  deliveryFee: number;
  fuelDeposit: number;       // Shown as +income (reimbursed by broker)
  grossIncome: number;       // deliveryFee + fuelDeposit
  fuelCost: number;          // Informational only — NOT deducted (claimed back)
  brokerFee: number;
  travelToJobCost: number;
  travelHomeCost: number;
  totalCosts: number;        // brokerFee + travelToJobCost + travelHomeCost
  netProfit: number;         // grossIncome - totalCosts
  profitPerHour: number;
  profitPerMile: number;
  // New A+/A/B/C/D grade system
  grade: Grade;
  compositeScore: number;    // 0-100
  scoreDimensions: ScoreDimensions;
  improvementTips: string[];
  // Legacy traffic light — derived from grade for backward compat
  worthItScore: "green" | "amber" | "red";
  // Legacy fields kept for backward compat (always 0 now)
  timeValue: number;
  wearTear: number;
  riskBuffer: number;
}

const LITRES_PER_GALLON = 4.54609;

// ─── Scoring benchmarks ───────────────────────────────────────────────────────
const BENCH_PPM_EXCELLENT = 0.60;  // £0.60/mi = 100 pts
const BENCH_PPM_GOOD      = 0.50;  // £0.50/mi = 80 pts
const BENCH_PPM_MIN       = 0.20;  // £0.20/mi = 0 pts

const BENCH_NET_EXCELLENT = 60;    // £60 net = 100 pts
const BENCH_NET_GOOD      = 40;    // £40 net = 80 pts
const BENCH_NET_MIN       = 10;    // £10 net = 0 pts

const BENCH_PPH_EXCELLENT = 18;    // £18/hr = 100 pts
const BENCH_PPH_GOOD      = 14;    // £14/hr = 80 pts
const BENCH_PPH_MIN       = 7;     // £7/hr = 0 pts

// Dimension weights (must sum to 1.0)
const WEIGHTS = {
  ppm:           0.30,  // profit per mile — most important
  netProfit:     0.25,  // absolute net profit
  transportRatio: 0.20, // how much travel cost eats into earnings
  pph:           0.15,  // profit per hour
  efficiency:    0.10,  // distance vs earnings density
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function linearScore(value: number, min: number, max: number): number {
  if (value <= min) return 0;
  if (value >= max) return 100;
  return ((value - min) / (max - min)) * 100;
}

function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A+";
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  if (score >= 35) return "C";
  return "D";
}

function gradeToWorthIt(grade: Grade): "green" | "amber" | "red" {
  if (grade === "A+" || grade === "A") return "green";
  if (grade === "B" || grade === "C") return "amber";
  return "red";
}

function buildImprovementTips(
  dims: ScoreDimensions,
  grade: Grade,
  input: JobCostInput,
  breakdown: Pick<JobCostBreakdown, "netProfit" | "profitPerMile" | "profitPerHour" | "travelToJobCost" | "travelHomeCost" | "brokerFee">
): string[] {
  const tips: string[] = [];

  if (dims.ppmScore < 60) {
    tips.push(`£/mile is low (£${breakdown.profitPerMile.toFixed(2)}/mi). Aim for £0.50+ by negotiating a higher delivery fee or choosing shorter reposition legs.`);
  }
  if (dims.netProfitScore < 50) {
    tips.push(`Net profit of £${breakdown.netProfit.toFixed(2)} is below target. Look for jobs paying £40+ for this distance.`);
  }
  if (dims.transportRatioScore < 50 && (breakdown.travelToJobCost + breakdown.travelHomeCost) > 5) {
    const travelTotal = breakdown.travelToJobCost + breakdown.travelHomeCost;
    tips.push(`Travel costs (£${travelTotal.toFixed(2)}) are eating ${Math.round((travelTotal / (input.deliveryFee + input.fuelDeposit)) * 100)}% of your gross. Consider jobs closer to home or chain them to reduce dead legs.`);
  }
  if (dims.pphScore < 50) {
    tips.push(`Profit per hour (£${breakdown.profitPerHour.toFixed(2)}/hr) is below the £14/hr target. A faster route or higher fee would improve this.`);
  }
  if (breakdown.brokerFee > 0 && input.brokerFeePercent > 8) {
    tips.push(`Broker fee of ${input.brokerFeePercent}% is high. Negotiate a lower rate or find direct work.`);
  }
  if (grade === "A+" || grade === "A") {
    tips.push("Great job! This is a high-value booking — accept quickly.");
  }

  return tips.slice(0, 3); // max 3 tips
}

export function calculateJobCost(input: JobCostInput): JobCostBreakdown {
  const {
    deliveryFee,
    fuelDeposit,
    fuelReimbursed,
    distanceMiles,
    durationMins,
    fuelPricePerLitre,
    vehicleMpg,
    brokerFeePercent,
    brokerFeeFixed,
    travelToJobCost,
    travelHomeCost,
  } = input;

  // ── Income ──────────────────────────────────────────────────────────────────
  const grossIncome = deliveryFee + fuelDeposit;

  // Fuel cost: calculated for display only — NOT deducted (driver claims it back)
  const fuelCost = fuelReimbursed
    ? 0
    : (distanceMiles / vehicleMpg) * LITRES_PER_GALLON * fuelPricePerLitre;

  // Broker fee (percentage of delivery fee + any fixed amount)
  const brokerFee = (deliveryFee * brokerFeePercent) / 100 + brokerFeeFixed;

  // Only real out-of-pocket deductions: broker fee + travel expenses
  const totalCosts = brokerFee + travelToJobCost + travelHomeCost;
  const netProfit = grossIncome - totalCosts;

  const profitPerHour = durationMins > 0 ? (netProfit / durationMins) * 60 : 0;
  const profitPerMile = distanceMiles > 0 ? netProfit / distanceMiles : 0;

  // ── 5-dimension scoring ──────────────────────────────────────────────────────

  // 1. Profit per mile score
  const ppmScore = clamp(linearScore(profitPerMile, BENCH_PPM_MIN, BENCH_PPM_EXCELLENT));

  // 2. Net profit score
  const netProfitScore = clamp(linearScore(netProfit, BENCH_NET_MIN, BENCH_NET_EXCELLENT));

  // 3. Transport cost ratio score (lower ratio = higher score)
  const transportRatio = grossIncome > 0 ? (travelToJobCost + travelHomeCost) / grossIncome : 0;
  // 0% travel cost = 100 pts, 40%+ = 0 pts
  const transportRatioScore = clamp(linearScore(1 - transportRatio, 0.6, 1.0));

  // 4. Profit per hour score
  const pphScore = clamp(linearScore(profitPerHour, BENCH_PPH_MIN, BENCH_PPH_EXCELLENT));

  // 5. Efficiency score: earnings density (£ per mile vs distance band)
  // Short jobs (<30mi) penalised if low fee; long jobs (>100mi) rewarded for consistency
  const efficiencyBase = distanceMiles > 0 ? grossIncome / distanceMiles : 0;
  const efficiencyScore = clamp(linearScore(efficiencyBase, 0.5, 2.0));

  const scoreDimensions: ScoreDimensions = {
    ppmScore: Math.round(ppmScore),
    netProfitScore: Math.round(netProfitScore),
    transportRatioScore: Math.round(transportRatioScore),
    pphScore: Math.round(pphScore),
    efficiencyScore: Math.round(efficiencyScore),
  };

  // Weighted composite
  const compositeScore = clamp(
    ppmScore           * WEIGHTS.ppm +
    netProfitScore     * WEIGHTS.netProfit +
    transportRatioScore * WEIGHTS.transportRatio +
    pphScore           * WEIGHTS.pph +
    efficiencyScore    * WEIGHTS.efficiency
  );

  const grade = gradeFromScore(compositeScore);
  const worthItScore = gradeToWorthIt(grade);

  const partialBreakdown = {
    netProfit,
    profitPerMile,
    profitPerHour,
    travelToJobCost,
    travelHomeCost,
    brokerFee,
  };

  const improvementTips = buildImprovementTips(scoreDimensions, grade, input, partialBreakdown);

  return {
    deliveryFee,
    fuelDeposit,
    grossIncome,
    fuelCost,
    brokerFee,
    travelToJobCost,
    travelHomeCost,
    totalCosts,
    netProfit,
    profitPerHour,
    profitPerMile,
    grade,
    compositeScore: Math.round(compositeScore),
    scoreDimensions,
    improvementTips,
    worthItScore,
    // Legacy fields — always 0
    timeValue: 0,
    wearTear: 0,
    riskBuffer: 0,
  };
}
