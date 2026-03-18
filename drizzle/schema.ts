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
  // Subscription
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "pro"]).default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
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
  notifyBadgeUnlocks: boolean("notifyBadgeUnlocks").default(true).notNull(),
  notifyWeeklyDigest: boolean("notifyWeeklyDigest").default(true).notNull(),
  ppmTarget: decimal("ppmTarget", { precision: 5, scale: 2 }).$type<number>().default(0.5 as unknown as number),
  leaderboardOptIn: boolean("leaderboardOptIn").default(false).notNull(),
  displayName: varchar("displayName", { length: 20 }),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["draft", "planned", "active", "completed", "cancelled"]).default("planned").notNull(),

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
  // Legacy traffic light (kept for backward compat)
  worthItScore: mysqlEnum("worthItScore", ["green", "amber", "red"]),
  // A+/A/B/C/D composite grade
  grade: mysqlEnum("grade", ["A+", "A", "B", "C", "D"]),
  compositeScore: decimal("compositeScore", { precision: 5, scale: 2 }).$type<number>(),
  scoreState: mysqlEnum("scoreState", ["estimated", "travel_adjusted", "receipt_adjusted", "final"]).default("estimated"),
  scoreDimensions: json("scoreDimensions"),
  transportCostRatio: decimal("transportCostRatio", { precision: 5, scale: 4 }).$type<number>(),
  scoreVariance: decimal("scoreVariance", { precision: 5, scale: 2 }).$type<number>(),
  improvementTips: json("improvementTips").$type<string[]>(),
  actualTravelToJobCost: decimal("actualTravelToJobCost", { precision: 8, scale: 2 }).$type<number>(),
  actualTravelHomeCost: decimal("actualTravelHomeCost", { precision: 8, scale: 2 }).$type<number>(),
  startedAt: timestamp("startedAt"),
  draftExpiresAt: timestamp("draftExpiresAt"),

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
  brokerId: int("brokerId"), // FK to brokers table
  jobReference: varchar("jobReference", { length: 100 }),
  bookingImageUrl: text("bookingImageUrl"),
  notes: text("notes"),

  // Route JSON from Maps API
  routeData: json("routeData"),

  // Vehicle details (from scan or manual entry)
  vehicleMake: varchar("vehicleMake", { length: 50 }),
  vehicleModel: varchar("vehicleModel", { length: 50 }),
  vehicleReg: varchar("vehicleReg", { length: 20 }),
  vehicleFuelType: mysqlEnum("vehicleFuelType", ["petrol", "diesel", "electric", "hybrid", "unknown"]).default("unknown"),
  vehicleColour: varchar("vehicleColour", { length: 30 }),

  // Scanned booking distance/duration (from broker app screenshot)
  scannedDistanceMiles: decimal("scannedDistanceMiles", { precision: 8, scale: 2 }).$type<number>(),
  scannedDurationMins: decimal("scannedDurationMins", { precision: 8, scale: 2 }).$type<number>(),

  // Travel expenses (cost to get to pickup / get home after dropoff)
  travelToJobCost: decimal("travelToJobCost", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),
  travelToJobMode: mysqlEnum("travelToJobMode", ["train", "bus", "taxi", "own_car", "none"]).default("none"),
  travelHomePostcode: varchar("travelHomePostcode", { length: 10 }),
  travelHomeCost: decimal("travelHomeCost", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),
  travelHomeMode: mysqlEnum("travelHomeMode", ["train", "bus", "taxi", "own_car", "none"]).default("none"),

  scheduledPickupAt: timestamp("scheduledPickupAt"),
  scheduledDropoffAt: timestamp("scheduledDropoffAt"),

  // Contact / consignee info (from scan or manual)
  pickupContactName: varchar("pickupContactName", { length: 100 }),
  pickupContactPhone: varchar("pickupContactPhone", { length: 30 }),
  dropoffContactName: varchar("dropoffContactName", { length: 100 }),
  dropoffContactPhone: varchar("dropoffContactPhone", { length: 30 }),
  customerName: varchar("customerName", { length: 100 }),

  // Multi-modal travel route (step-by-step JSON from travel planner)
  travelRouteData: json("travelRouteData"),

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

// ─── Receipts ─────────────────────────────────────────────────────────────────

export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId"), // optional — can be attached to a job later

  // Image
  imageUrl: text("imageUrl").notNull(),

  // AI-extracted fields
  merchantName: varchar("merchantName", { length: 100 }),
  receiptDate: timestamp("receiptDate"),
  totalAmount: decimal("totalAmount", { precision: 8, scale: 2 }).$type<number>(),
  category: mysqlEnum("category", ["fuel", "train", "bus", "taxi", "parking", "toll", "food", "other"]).default("other"),
  fuelLitres: decimal("fuelLitres", { precision: 8, scale: 3 }).$type<number>(),
  fuelPricePerLitre: decimal("fuelPricePerLitre", { precision: 6, scale: 4 }).$type<number>(),
  fuelType: mysqlEnum("fuelType", ["petrol", "diesel", "electric", "unknown"]).default("unknown"),
  notes: text("notes"),
  rawExtracted: json("rawExtracted"), // full AI response for reference

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

// ─── Favourite Routes ─────────────────────────────────────────────────────────

export const favouriteRoutes = mysqlTable("favourite_routes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  fromPostcode: varchar("fromPostcode", { length: 10 }).notNull(),
  toPostcode: varchar("toPostcode", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FavouriteRoute = typeof favouriteRoutes.$inferSelect;
export type InsertFavouriteRoute = typeof favouriteRoutes.$inferInsert;

// ─── Route History ────────────────────────────────────────────────────────────

export const routeHistory = mysqlTable("route_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fromPostcode: varchar("fromPostcode", { length: 10 }).notNull(),
  toPostcode: varchar("toPostcode", { length: 10 }).notNull(),
  label: mysqlEnum("label", ["fastest", "cheapest", "balanced"]).default("balanced").notNull(),
  summary: varchar("summary", { length: 200 }),
  totalDurationSecs: int("totalDurationSecs"),
  totalDistanceMetres: int("totalDistanceMetres"),
  estimatedCost: decimal("estimatedCost", { precision: 8, scale: 2 }).$type<number>(),
  dominantMode: varchar("dominantMode", { length: 20 }),
  departureTime: varchar("departureTime", { length: 30 }),
  arrivalTime: varchar("arrivalTime", { length: 30 }),
  legsSnapshot: json("legsSnapshot"),
  shareToken: varchar("shareToken", { length: 64 }),
  shareExpiresAt: timestamp("shareExpiresAt"),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteHistory = typeof routeHistory.$inferSelect;
export type InsertRouteHistory = typeof routeHistory.$inferInsert;

// ─── Gamification: User Badges ────────────────────────────────────────────────

export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  badgeId: varchar("badgeId", { length: 50 }).notNull(), // e.g. "first_delivery", "ton_up"
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
  progress: int("progress").default(0).notNull(), // current progress toward badge
  target: int("target").default(1).notNull(),     // target to unlock
  unlocked: boolean("unlocked").default(false).notNull(),
  seenAt: timestamp("seenAt"),                    // null = unseen notification
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

// ─── Gamification: User Streaks ───────────────────────────────────────────────

export const userStreaks = mysqlTable("user_streaks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  currentStreak: int("currentStreak").default(0).notNull(),   // consecutive working days
  longestStreak: int("longestStreak").default(0).notNull(),
  lastJobDate: varchar("lastJobDate", { length: 10 }),        // YYYY-MM-DD
  totalJobsAllTime: int("totalJobsAllTime").default(0).notNull(),
  totalMilesAllTime: decimal("totalMilesAllTime", { precision: 12, scale: 2 }).$type<number>().default(0 as unknown as number),
  totalEarningsAllTime: decimal("totalEarningsAllTime", { precision: 12, scale: 2 }).$type<number>().default(0 as unknown as number),
  totalTrainTrips: int("totalTrainTrips").default(0).notNull(),
  totalBusTrips: int("totalBusTrips").default(0).notNull(),
  totalScans: int("totalScans").default(0).notNull(),
  totalCitiesVisited: int("totalCitiesVisited").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserStreak = typeof userStreaks.$inferSelect;
export type InsertUserStreak = typeof userStreaks.$inferInsert;

// ─── Brokers ──────────────────────────────────────────────────────────────────

export const brokers = mysqlTable("brokers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  feePercent: decimal("feePercent", { precision: 5, scale: 2 }).$type<number>().default(0 as unknown as number),
  feeFixed: decimal("feeFixed", { precision: 8, scale: 2 }).$type<number>().default(0 as unknown as number),
  notes: text("notes"),
  website: varchar("website", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  rating: int("rating"), // 1-5 stars
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Broker = typeof brokers.$inferSelect;
export type InsertBroker = typeof brokers.$inferInsert;

// ─── Vehicle Condition Reports ────────────────────────────────────────────────

export const vehicleConditionReports = mysqlTable("vehicle_condition_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId"),
  type: mysqlEnum("type", ["pickup", "dropoff"]).notNull(),

  // Vehicle info
  vehicleReg: varchar("vehicleReg", { length: 20 }),
  vehicleMake: varchar("vehicleMake", { length: 50 }),
  vehicleModel: varchar("vehicleModel", { length: 50 }),
  vehicleColour: varchar("vehicleColour", { length: 30 }),

  // Photos & video
  photoUrls: json("photoUrls").$type<string[]>().default([]),
  videoUrl: text("videoUrl"),

  // Damage notes
  damageNotes: text("damageNotes"),
  hasDamage: boolean("hasDamage").default(false).notNull(),
  damageLocations: json("damageLocations").$type<string[]>().default([]), // e.g. ["front_left", "rear_bumper"]

  // Location
  locationPostcode: varchar("locationPostcode", { length: 10 }),
  locationLat: decimal("locationLat", { precision: 10, scale: 7 }).$type<number>(),
  locationLng: decimal("locationLng", { precision: 10, scale: 7 }).$type<number>(),

  // Sharing
  shareToken: varchar("shareToken", { length: 64 }),
  shareExpiresAt: timestamp("shareExpiresAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VehicleConditionReport = typeof vehicleConditionReports.$inferSelect;
export type InsertVehicleConditionReport = typeof vehicleConditionReports.$inferInsert;

// ─── Driver Lift Marketplace ──────────────────────────────────────────────────

export const lifts = mysqlTable("lifts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // driver offering the lift
  fromPostcode: varchar("fromPostcode", { length: 10 }).notNull(),
  fromLabel: varchar("fromLabel", { length: 100 }),
  toPostcode: varchar("toPostcode", { length: 10 }).notNull(),
  toLabel: varchar("toLabel", { length: 100 }),
  departureTime: timestamp("departureTime").notNull(),
  seats: int("seats").notNull().default(1),
  pricePerSeat: decimal("pricePerSeat", { precision: 8, scale: 2 }).$type<number>().notNull(),
  status: mysqlEnum("status", ["active", "full", "cancelled", "completed"]).default("active").notNull(),
  notes: text("notes"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lift = typeof lifts.$inferSelect;
export type InsertLift = typeof lifts.$inferInsert;

export const liftRequests = mysqlTable("lift_requests", {
  id: int("id").autoincrement().primaryKey(),
  liftId: int("liftId").notNull(),
  requesterId: int("requesterId").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "cancelled", "completed"]).default("pending").notNull(),
  message: text("message"),
  seatsRequested: int("seatsRequested").default(1).notNull(),
  totalPrice: decimal("totalPrice", { precision: 8, scale: 2 }).$type<number>(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LiftRequest = typeof liftRequests.$inferSelect;
export type InsertLiftRequest = typeof liftRequests.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["badge_unlock", "weekly_digest", "lift_request", "lift_accepted", "lift_rejected", "system"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  data: json("data"), // extra payload (e.g. badgeId, liftId)
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Usage Counters (for free tier limits) ────────────────────────────────────

export const usageCounters = mysqlTable("usage_counters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  monthKey: varchar("monthKey", { length: 7 }).notNull().default(""), // YYYY-MM
  aiScansThisMonth: int("aiScansThisMonth").default(0).notNull(),
  routeSearchesToday: int("routeSearchesToday").default(0).notNull(),
  routeSearchDate: varchar("routeSearchDate", { length: 10 }), // YYYY-MM-DD
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UsageCounter = typeof usageCounters.$inferSelect;
export type InsertUsageCounter = typeof usageCounters.$inferInsert;

// ─── Mileage Log ──────────────────────────────────────────────────────────────

export const mileageLog = mysqlTable("mileage_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId"),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  startMileage: decimal("startMileage", { precision: 10, scale: 1 }).$type<number>(),
  endMileage: decimal("endMileage", { precision: 10, scale: 1 }).$type<number>(),
  distanceMiles: decimal("distanceMiles", { precision: 8, scale: 2 }).$type<number>().notNull(),
  purpose: mysqlEnum("purpose", ["delivery", "reposition", "personal"]).default("delivery").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MileageLog = typeof mileageLog.$inferSelect;
export type InsertMileageLog = typeof mileageLog.$inferInsert;

// ─── Leaderboard Entries ──────────────────────────────────────────────────────

export const leaderboardEntries = mysqlTable("leaderboard_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  weekKey: varchar("weekKey", { length: 10 }).notNull(), // YYYY-WNN
  region: varchar("region", { length: 50 }),             // e.g. "West Midlands"
  netEarnings: decimal("netEarnings", { precision: 10, scale: 2 }).$type<number>().default(0 as unknown as number),
  jobCount: int("jobCount").default(0).notNull(),
  totalMiles: decimal("totalMiles", { precision: 10, scale: 2 }).$type<number>().default(0 as unknown as number),
  avgGrade: varchar("avgGrade", { length: 3 }),           // A+, A, B, C, D
  leaderRank: int("leaderRank"),
  optedIn: boolean("optedIn").default(false).notNull(),
  displayName: varchar("displayName", { length: 50 }),    // anonymised name for leaderboard
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
export type InsertLeaderboardEntry = typeof leaderboardEntries.$inferInsert;
