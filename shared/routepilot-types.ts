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
  hourlyRate: number;
  wearTearPerMile: number;
  riskBufferPercent: number;
  enableTimeValue: boolean;
  enableWearTear: boolean;
  // Travel expenses
  travelToJobCost: number;   // Cost to get to the pickup (train/bus/taxi/own car)
  travelHomeCost: number;    // Cost to get home after dropoff (or to next job)
}

export interface JobCostBreakdown {
  deliveryFee: number;
  fuelDeposit: number;       // Shown as +income (reimbursed by broker)
  grossIncome: number;       // deliveryFee + fuelDeposit
  fuelCost: number;          // 0 if fuelReimbursed
  brokerFee: number;
  timeValue: number;
  wearTear: number;
  travelToJobCost: number;
  travelHomeCost: number;
  riskBuffer: number;
  totalCosts: number;
  netProfit: number;
  profitPerHour: number;
  profitPerMile: number;
  worthItScore: "green" | "amber" | "red";
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
    hourlyRate,
    wearTearPerMile,
    riskBufferPercent,
    enableTimeValue,
    enableWearTear,
    travelToJobCost,
    travelHomeCost,
  } = input;

  // Income: delivery fee + fuel deposit (broker pays this back, so it's income)
  const grossIncome = deliveryFee + fuelDeposit;

  // Fuel cost: miles / mpg * litres_per_gallon * price_per_litre
  // If fuelReimbursed is true, driver uses a fuel card / gets fuel paid — no cost
  const fuelCost = fuelReimbursed
    ? 0
    : (distanceMiles / vehicleMpg) * LITRES_PER_GALLON * fuelPricePerLitre;

  // Broker fee (percentage of delivery fee + any fixed amount)
  const brokerFee = (deliveryFee * brokerFeePercent) / 100 + brokerFeeFixed;

  // Time value (opportunity cost of driver's time)
  const timeValue = enableTimeValue ? (durationMins / 60) * hourlyRate : 0;

  // Wear & tear on driver's own vehicle
  const wearTear = enableWearTear ? distanceMiles * wearTearPerMile : 0;

  // Pre-buffer costs (all deductions before risk buffer)
  const preCosts = fuelCost + brokerFee + timeValue + wearTear + travelToJobCost + travelHomeCost;

  // Risk buffer on net (only applied if positive)
  const riskBuffer = ((grossIncome - preCosts) * riskBufferPercent) / 100;
  const adjustedRiskBuffer = riskBuffer > 0 ? riskBuffer : 0;

  const totalCosts = preCosts + adjustedRiskBuffer;
  const netProfit = grossIncome - totalCosts;

  const profitPerHour = durationMins > 0 ? (netProfit / durationMins) * 60 : 0;
  const profitPerMile = distanceMiles > 0 ? netProfit / distanceMiles : 0;

  // Worth-it scoring
  let worthItScore: "green" | "amber" | "red";
  if (netProfit <= 0) {
    worthItScore = "red";
  } else if (profitPerHour >= 15 && netProfit >= 20) {
    worthItScore = "green";
  } else if (profitPerHour >= 8 || netProfit >= 10) {
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
    timeValue,
    wearTear,
    travelToJobCost,
    travelHomeCost,
    riskBuffer: adjustedRiskBuffer,
    totalCosts,
    netProfit,
    profitPerHour,
    profitPerMile,
    worthItScore,
  };
}
