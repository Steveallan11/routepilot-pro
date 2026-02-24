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
  worthItScore: "green" | "amber" | "red";
  // Legacy fields kept for backward compat (always 0 now)
  timeValue: number;
  wearTear: number;
  riskBuffer: number;
}

const LITRES_PER_GALLON = 4.54609;

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

  // Income: delivery fee + fuel deposit (broker pays this back, so it's income)
  const grossIncome = deliveryFee + fuelDeposit;

  // Fuel cost: calculated for display only — NOT deducted (driver claims it back)
  // If fuelReimbursed is true, driver uses a fuel card — show as £0
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

  // Worth-it scoring (based on actual net profit, not time value)
  let worthItScore: "green" | "amber" | "red";
  if (netProfit <= 0) {
    worthItScore = "red";
  } else if (profitPerMile >= 0.50 && netProfit >= 30) {
    worthItScore = "green";
  } else if (profitPerMile >= 0.25 || netProfit >= 15) {
    worthItScore = "amber";
  } else {
    worthItScore = "red";
  }

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
    worthItScore,
    // Legacy fields — always 0
    timeValue: 0,
    wearTear: 0,
    riskBuffer: 0,
  };
}
