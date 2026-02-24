// RoutePilot Pro — Stripe Products & Prices
// These are created dynamically via the API if not already configured

export const STRIPE_PRODUCTS = {
  pro_monthly: {
    name: "RoutePilot Pro — Monthly",
    description: "Full access to all RoutePilot Pro features. Cancel anytime.",
    priceGBP: 1999, // £19.99 in pence
    interval: "month" as const,
    // Set this once you've created the price in Stripe dashboard
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
  },
  pro_annual: {
    name: "RoutePilot Pro — Annual",
    description: "Full access to all RoutePilot Pro features. Best value — save £90/year.",
    priceGBP: 14900, // £149 in pence
    interval: "year" as const,
    priceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "",
  },
} as const;

export type PlanId = keyof typeof STRIPE_PRODUCTS;

// Free tier limits
export const FREE_LIMITS = {
  aiScansPerMonth: 5,
  routeSearchesPerDay: 5,
  jobHistoryMax: 20,
  chainsMax: 1, // only 2-job chains on free
};

// Platform fee for lift marketplace (12%)
export const LIFT_PLATFORM_FEE_PERCENT = 12;
