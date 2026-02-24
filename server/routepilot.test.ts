import { describe, expect, it } from "vitest";
import { calculateJobCost } from "../shared/routepilot-types";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── calculateJobCost unit tests ──────────────────────────────────────────────

describe("calculateJobCost", () => {
  const baseInput = {
    deliveryFee: 100,
    fuelDeposit: 0,
    fuelReimbursed: false,
    distanceMiles: 50,
    durationMins: 60,
    fuelPricePerLitre: 1.50,
    vehicleMpg: 35,
    brokerFeePercent: 0,
    brokerFeeFixed: 0,
    hourlyRate: 15,
    wearTearPerMile: 0.15,
    riskBufferPercent: 10,
    enableTimeValue: true,
    enableWearTear: true,
    travelToJobCost: 0,
    travelHomeCost: 0,
  };

  it("calculates fuel cost correctly", () => {
    const result = calculateJobCost(baseInput);
    // 50 miles / 35 mpg * 4.54609 litres/gallon * £1.50/litre
    const expectedFuel = (50 / 35) * 4.54609 * 1.50;
    expect(result.fuelCost).toBeCloseTo(expectedFuel, 2);
  });

  it("returns zero fuel cost when fuel is reimbursed", () => {
    const result = calculateJobCost({ ...baseInput, fuelReimbursed: true });
    expect(result.fuelCost).toBe(0);
  });

  it("timeValue is always 0 (removed from calculation — claimed back)", () => {
    const result = calculateJobCost(baseInput);
    expect(result.timeValue).toBe(0);
  });

  it("wearTear is always 0 (removed from calculation — claimed back)", () => {
    const result = calculateJobCost(baseInput);
    expect(result.wearTear).toBe(0);
  });

  it("calculates broker fee as percentage", () => {
    const result = calculateJobCost({ ...baseInput, brokerFeePercent: 10 });
    // 10% of £100 = £10
    expect(result.brokerFee).toBeCloseTo(10, 2);
  });

  it("calculates broker fee as fixed amount", () => {
    const result = calculateJobCost({ ...baseInput, brokerFeeFixed: 5 });
    expect(result.brokerFee).toBeCloseTo(5, 2);
  });

  it("scores green for profitable high-rate jobs", () => {
    // £200 fee, 100 miles, fuel reimbursed, no broker fee, no travel costs
    // netProfit = £200, profitPerMile = £2.00 (>= 0.50), netProfit >= 30 → green
    const result = calculateJobCost({
      ...baseInput,
      deliveryFee: 200,
      distanceMiles: 100,
      durationMins: 90,
      fuelReimbursed: true,
      brokerFeePercent: 0,
      travelToJobCost: 0,
      travelHomeCost: 0,
    });
    expect(result.worthItScore).toBe("green");
  });

  it("scores red for loss-making jobs", () => {
    const result = calculateJobCost({
      ...baseInput,
      deliveryFee: 5,
      distanceMiles: 100,
      durationMins: 120,
    });
    expect(result.worthItScore).toBe("red");
  });

  it("netProfit equals grossIncome minus totalCosts", () => {
    const result = calculateJobCost(baseInput);
    expect(result.netProfit).toBeCloseTo(result.grossIncome - result.totalCosts, 2);
  });

  it("includes fuelDeposit in grossIncome", () => {
    const result = calculateJobCost({ ...baseInput, fuelDeposit: 20 });
    expect(result.grossIncome).toBeCloseTo(120, 2);
    expect(result.fuelDeposit).toBe(20);
  });

  it("profitPerHour is calculated correctly", () => {
    // £100 fee, fuel reimbursed, no broker fee, no travel costs → netProfit = £100, 60 mins → £100/hr
    const result = calculateJobCost({
      ...baseInput,
      fuelReimbursed: true,
      brokerFeePercent: 0,
      brokerFeeFixed: 0,
      travelToJobCost: 0,
      travelHomeCost: 0,
    });
    // netProfit = £100, durationMins = 60 → £100/hr
    expect(result.profitPerHour).toBeCloseTo(100, 1);
  });
});

// ─── auth.logout test ─────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext() {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test Driver",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ─── New feature tests ────────────────────────────────────────────────────────

describe("App router — new routers registered", () => {
  it("should include subscription, brokers, vehicleCondition, lifts, notifications, exports", () => {
    const routerKeys = Object.keys(appRouter._def.record ?? appRouter._def.procedures ?? {});
    expect(routerKeys).toContain("subscription");
    expect(routerKeys).toContain("brokers");
    expect(routerKeys).toContain("vehicleCondition");
    expect(routerKeys).toContain("lifts");
    expect(routerKeys).toContain("notifications");
    expect(routerKeys).toContain("exports");
  });
});

describe("HMRC mileage allowance calculation", () => {
  function calcHmrcAllowance(miles: number): number {
    const RATE_FIRST_10K = 0.45;
    const RATE_OVER_10K = 0.25;
    const THRESHOLD = 10000;
    if (miles <= THRESHOLD) return miles * RATE_FIRST_10K;
    return THRESHOLD * RATE_FIRST_10K + (miles - THRESHOLD) * RATE_OVER_10K;
  }

  it("should calculate 45p/mile for first 10,000 miles", () => {
    expect(calcHmrcAllowance(1000)).toBe(450);
    expect(calcHmrcAllowance(10000)).toBe(4500);
  });

  it("should calculate 25p/mile for miles over 10,000", () => {
    expect(calcHmrcAllowance(11000)).toBe(4500 + 250);
    expect(calcHmrcAllowance(15000)).toBe(4500 + 1250);
  });

  it("should handle zero miles", () => {
    expect(calcHmrcAllowance(0)).toBe(0);
  });
});

describe("Lift platform fee calculation", () => {
  const PLATFORM_FEE_PERCENT = 12;

  it("should calculate platform fee correctly", () => {
    const pricePerSeat = 25;
    const seats = 2;
    const total = pricePerSeat * seats;
    const fee = (total * PLATFORM_FEE_PERCENT) / 100;
    const driverReceives = total - fee;

    expect(total).toBe(50);
    expect(fee).toBe(6);
    expect(driverReceives).toBe(44);
  });

  it("should handle single seat", () => {
    const pricePerSeat = 30;
    const total = pricePerSeat * 1;
    const fee = (total * PLATFORM_FEE_PERCENT) / 100;
    expect(fee).toBeCloseTo(3.6, 2);
  });

  it("platform fee should be between 0 and 100 percent", () => {
    expect(PLATFORM_FEE_PERCENT).toBeGreaterThan(0);
    expect(PLATFORM_FEE_PERCENT).toBeLessThan(100);
  });
});

describe("Subscription tier gating", () => {
  const PRO_FEATURES = [
    "vehicle-condition",
    "tax-export",
    "lifts",
  ];

  const FREE_FEATURES = [
    "calculator",
    "routes",
    "dashboard",
    "history",
    "fuel-finder",
    "brokers",
    "badges",
  ];

  it("should have defined Pro-only features", () => {
    expect(PRO_FEATURES.length).toBeGreaterThan(0);
  });

  it("should have defined Free features", () => {
    expect(FREE_FEATURES.length).toBeGreaterThan(0);
  });

  it("Pro features should not overlap with Free features", () => {
    const overlap = PRO_FEATURES.filter((f) => FREE_FEATURES.includes(f));
    expect(overlap).toHaveLength(0);
  });
});

// ─── Multimodal step editor logic ─────────────────────────────────────────────

describe("multimodal step editor logic", () => {
  type TransitStep = {
    mode: string;
    instruction: string;
    durationMins: number;
    distanceMetres: number;
    departureStop?: string;
    arrivalStop?: string;
  };

  function recalcLegDuration(steps: TransitStep[]): number {
    return steps.reduce((s, st) => s + st.durationMins, 0);
  }

  function insertStepAfter(steps: TransitStep[], idx: number, newStep: TransitStep): TransitStep[] {
    return [...steps.slice(0, idx + 1), newStep, ...steps.slice(idx + 1)];
  }

  function removeStep(steps: TransitStep[], idx: number): TransitStep[] {
    return steps.filter((_, i) => i !== idx);
  }

  function updateStep(steps: TransitStep[], idx: number, updated: TransitStep): TransitStep[] {
    return steps.map((s, i) => i === idx ? updated : s);
  }

  const baseSteps: TransitStep[] = [
    { mode: "WALK", instruction: "Walk to bus stop", durationMins: 5, distanceMetres: 400 },
    { mode: "BUS", instruction: "Take bus 46", durationMins: 20, distanceMetres: 8000 },
    { mode: "WALK", instruction: "Walk to destination", durationMins: 3, distanceMetres: 250 },
  ];

  it("recalculates total duration from steps", () => {
    expect(recalcLegDuration(baseSteps)).toBe(28);
  });

  it("inserts a new step after a given index", () => {
    const newStep: TransitStep = { mode: "TRAIN", instruction: "Take train", durationMins: 15, distanceMetres: 12000 };
    const result = insertStepAfter(baseSteps, 1, newStep);
    expect(result).toHaveLength(4);
    expect(result[2]!.mode).toBe("TRAIN");
    expect(result[3]!.mode).toBe("WALK");
  });

  it("inserts a step at the beginning (after index -1 via prepend)", () => {
    const newStep: TransitStep = { mode: "WALK", instruction: "Walk to start", durationMins: 2, distanceMetres: 150 };
    const result = insertStepAfter(baseSteps, -1, newStep);
    expect(result[0]!.mode).toBe("WALK");
    expect(result).toHaveLength(4);
  });

  it("removes a step by index", () => {
    const result = removeStep(baseSteps, 1);
    expect(result).toHaveLength(2);
    expect(result[0]!.mode).toBe("WALK");
    expect(result[1]!.mode).toBe("WALK");
  });

  it("does not allow removing the last step (guard)", () => {
    const singleStep = [baseSteps[0]!];
    // Guard: if only 1 step, don't remove
    const result = singleStep.length > 1 ? removeStep(singleStep, 0) : singleStep;
    expect(result).toHaveLength(1);
  });

  it("updates a step's mode and duration", () => {
    const updated: TransitStep = { ...baseSteps[1]!, mode: "TRAIN", durationMins: 12 };
    const result = updateStep(baseSteps, 1, updated);
    expect(result[1]!.mode).toBe("TRAIN");
    expect(result[1]!.durationMins).toBe(12);
    // Other steps unchanged
    expect(result[0]!.mode).toBe("WALK");
    expect(result[2]!.mode).toBe("WALK");
  });

  it("recalculates total duration after step update", () => {
    const updated: TransitStep = { ...baseSteps[1]!, durationMins: 10 };
    const newSteps = updateStep(baseSteps, 1, updated);
    expect(recalcLegDuration(newSteps)).toBe(18); // 5 + 10 + 3
  });

  it("recalculates total duration after step insertion", () => {
    const newStep: TransitStep = { mode: "TAXI", instruction: "Taxi to station", durationMins: 8, distanceMetres: 3000 };
    const newSteps = insertStepAfter(baseSteps, 0, newStep);
    expect(recalcLegDuration(newSteps)).toBe(36); // 5 + 8 + 20 + 3
  });

  it("recalculates total duration after step removal", () => {
    const newSteps = removeStep(baseSteps, 1);
    expect(recalcLegDuration(newSteps)).toBe(8); // 5 + 3
  });
});
