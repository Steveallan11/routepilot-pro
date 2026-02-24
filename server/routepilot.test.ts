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
