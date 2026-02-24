export interface JobCostInput {
  deliveryFee: number;
  fuelDeposit: number;
  fuelReimbursed: boolean;
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
}

export interface JobCostBreakdown {
  deliveryFee: number;
  fuelDeposit: number;
  grossIncome: number;
  fuelCost: number;
  brokerFee: number;
  timeValue: number;
  wearTear: number;
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
  } = input;

  const grossIncome = deliveryFee + fuelDeposit;

  // Fuel cost: miles / mpg * litres_per_gallon * price_per_litre
  const fuelCost = fuelReimbursed
    ? 0
    : (distanceMiles / vehicleMpg) * LITRES_PER_GALLON * fuelPricePerLitre;

  // Broker fee
  const brokerFee = (deliveryFee * brokerFeePercent) / 100 + brokerFeeFixed;

  // Time value (opportunity cost)
  const timeValue = enableTimeValue ? (durationMins / 60) * hourlyRate : 0;

  // Wear & tear
  const wearTear = enableWearTear ? distanceMiles * wearTearPerMile : 0;

  // Pre-buffer costs
  const preCosts = fuelCost + brokerFee + timeValue + wearTear;

  // Risk buffer on net
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
    riskBuffer: adjustedRiskBuffer,
    totalCosts,
    netProfit,
    profitPerHour,
    profitPerMile,
    worthItScore,
  };
}
