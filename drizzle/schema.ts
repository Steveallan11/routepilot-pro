import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── User Settings ────────────────────────────────────────────────────────────

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  vehicleMpg: decimal("vehicleMpg", { precision: 5, scale: 2 }).notNull().$type<number>().default(35 as unknown as number),
  fuelType: mysqlEnum("fuelType", ["petrol", "diesel"]).default("petrol").notNull(),
  hourlyRate: decimal("hourlyRate", { precision: 6, scale: 2 }).notNull().$type<number>().default(15 as unknown as number),
  wearTearPerMile: decimal("wearTearPerMile", { precision: 5, scale: 3 }).notNull().$type<number>().default(0.15 as unknown as number),
  defaultBrokerFeePercent: decimal("defaultBrokerFeePercent", { precision: 5, scale: 2 }).notNull().$type<number>().default(0 as unknown as number),
  riskBufferPercent: decimal("riskBufferPercent", { precision: 5, scale: 2 }).notNull().$type<number>().default(10 as unknown as number),
  enableTimeValue: boolean("enableTimeValue").default(true).notNull(),
  enableWearTear: boolean("enableWearTear").default(true).notNull(),
  homePostcode: varchar("homePostcode", { length: 10 }),
  alertsEnabled: boolean("alertsEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["planned", "active", "completed", "cancelled"]).default("planned").notNull(),

  // Route
  pickupPostcode: varchar("pickupPostcode", { length: 10 }).notNull(),
  dropoffPostcode: varchar("dropoffPostcode", { length: 10 }).notNull(),

  // Income
  deliveryFee: decimal("deliveryFee", { precision: 8, scale: 2 }).notNull().$type<number>(),
  fuelDeposit: decimal("fuelDeposit", { precision: 8, scale: 2 }).notNull().$type<number>().default(0 as unknown as number),
  brokerFeePercent: decimal("brokerFeePercent", { precision: 5, scale: 2 }).$type<number>().default(0 as unknown as number),
  brokerFeeFixed: decimal("brokerFeeFixed", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),
  fuelReimbursed: boolean("fuelReimbursed").default(false).notNull(),

  // Estimated values (from Google Maps + fuel API)
  estimatedDistanceMiles: decimal("estimatedDistanceMiles", { precision: 8, scale: 2 }).$type<number>(),
  estimatedDurationMins: decimal("estimatedDurationMins", { precision: 8, scale: 2 }).$type<number>(),
  estimatedFuelCost: decimal("estimatedFuelCost", { precision: 8, scale: 2 }).$type<number>(),
  estimatedFuelPricePerLitre: decimal("estimatedFuelPricePerLitre", { precision: 6, scale: 4 }).$type<number>(),
  estimatedWearTear: decimal("estimatedWearTear", { precision: 8, scale: 2 }).$type<number>(),
  estimatedTimeValue: decimal("estimatedTimeValue", { precision: 8, scale: 2 }).$type<number>(),
  estimatedNetProfit: decimal("estimatedNetProfit", { precision: 10, scale: 2 }).$type<number>(),
  estimatedProfitPerHour: decimal("estimatedProfitPerHour", { precision: 8, scale: 2 }).$type<number>(),
  estimatedProfitPerMile: decimal("estimatedProfitPerMile", { precision: 8, scale: 4 }).$type<number>(),
  worthItScore: mysqlEnum("worthItScore", ["green", "amber", "red"]),

  // Actual values (filled in after completion)
  actualDistanceMiles: decimal("actualDistanceMiles", { precision: 8, scale: 2 }).$type<number>(),
  actualDurationMins: decimal("actualDurationMins", { precision: 8, scale: 2 }).$type<number>(),
  actualFuelCost: decimal("actualFuelCost", { precision: 8, scale: 2 }).$type<number>(),
  actualNetProfit: decimal("actualNetProfit", { precision: 10, scale: 2 }).$type<number>(),
  actualNotes: text("actualNotes"),

  // Broker & booking metadata (from AI scan or manual entry)
  pickupAddress: text("pickupAddress"),
  dropoffAddress: text("dropoffAddress"),
  brokerName: varchar("brokerName", { length: 100 }),
  jobReference: varchar("jobReference", { length: 100 }),
  bookingImageUrl: text("bookingImageUrl"),
  notes: text("notes"),

  // Route JSON from Maps API
  routeData: json("routeData"),

  scheduledPickupAt: timestamp("scheduledPickupAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ─── Job Chains ───────────────────────────────────────────────────────────────

export const jobChains = mysqlTable("job_chains", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }),
  status: mysqlEnum("status", ["planned", "active", "completed", "cancelled"]).default("planned").notNull(),

  // Financials
  totalEarnings: decimal("totalEarnings", { precision: 10, scale: 2 }).$type<number>().default(0 as unknown as number),
  totalCosts: decimal("totalCosts", { precision: 10, scale: 2 }).$type<number>().default(0 as unknown as number),
  totalNetProfit: decimal("totalNetProfit", { precision: 10, scale: 2 }).$type<number>().default(0 as unknown as number),
  totalDurationMins: decimal("totalDurationMins", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),
  totalDistanceMiles: decimal("totalDistanceMiles", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),
  profitPerHour: decimal("profitPerHour", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),

  // Risk & transport data
  riskFlags: json("riskFlags").$type<string[]>(),
  repositionLegs: json("repositionLegs"),

  // Sharing
  shareToken: varchar("shareToken", { length: 64 }),
  shareExpiresAt: timestamp("shareExpiresAt"),

  scheduledDate: timestamp("scheduledDate"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JobChain = typeof jobChains.$inferSelect;
export type InsertJobChain = typeof jobChains.$inferInsert;

// ─── Chain Jobs (join table) ──────────────────────────────────────────────────

export const chainJobs = mysqlTable("chain_jobs", {
  id: int("id").autoincrement().primaryKey(),
  chainId: int("chainId").notNull(),
  jobId: int("jobId").notNull(),
  position: int("position").notNull(), // 1, 2, 3
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChainJob = typeof chainJobs.$inferSelect;
export type InsertChainJob = typeof chainJobs.$inferInsert;
