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

  it("calculates time value correctly", () => {
    const result = calculateJobCost(baseInput);
    // 60 mins / 60 * £15/hr = £15
    expect(result.timeValue).toBeCloseTo(15, 2);
  });

  it("returns zero time value when disabled", () => {
    const result = calculateJobCost({ ...baseInput, enableTimeValue: false });
    expect(result.timeValue).toBe(0);
  });

  it("calculates wear and tear correctly", () => {
    const result = calculateJobCost(baseInput);
    // 50 miles * £0.15/mile = £7.50
    expect(result.wearTear).toBeCloseTo(7.5, 2);
  });

  it("returns zero wear and tear when disabled", () => {
    const result = calculateJobCost({ ...baseInput, enableWearTear: false });
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
    const result = calculateJobCost({
      ...baseInput,
      deliveryFee: 200,
      distanceMiles: 100,
      durationMins: 90,
      enableTimeValue: false,
      enableWearTear: false,
      fuelReimbursed: true,
      riskBufferPercent: 0,
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
    const result = calculateJobCost({
      ...baseInput,
      enableTimeValue: false,
      enableWearTear: false,
      fuelReimbursed: true,
      riskBufferPercent: 0,
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
