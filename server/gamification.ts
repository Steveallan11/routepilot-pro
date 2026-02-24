import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { jobs, userBadges, userStreaks } from "../drizzle/schema";

// ─── Badge Definitions ────────────────────────────────────────────────────────

export type BadgeCategory = "milestone" | "earnings" | "distance" | "eco" | "speed" | "streak" | "special";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  target: number;
  /** Which stat field on userStreaks drives progress (or null for custom logic) */
  statField?: keyof {
    totalJobsAllTime: number;
    totalMilesAllTime: number;
    totalEarningsAllTime: number;
    totalTrainTrips: number;
    totalBusTrips: number;
    totalScans: number;
    currentStreak: number;
    longestStreak: number;
    totalCitiesVisited: number;
  };
  /** Rarity for visual styling */
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  // ── Milestone ──
  {
    id: "first_delivery",
    name: "First Delivery",
    description: "Save your very first job",
    emoji: "🚗",
    category: "milestone",
    target: 1,
    statField: "totalJobsAllTime",
    rarity: "common",
  },
  {
    id: "ten_jobs",
    name: "Getting Started",
    description: "Complete 10 jobs",
    emoji: "📦",
    category: "milestone",
    target: 10,
    statField: "totalJobsAllTime",
    rarity: "common",
  },
  {
    id: "fifty_jobs",
    name: "Road Regular",
    description: "Complete 50 jobs",
    emoji: "🏅",
    category: "milestone",
    target: 50,
    statField: "totalJobsAllTime",
    rarity: "rare",
  },
  {
    id: "century_driver",
    name: "Century Driver",
    description: "Complete 100 jobs",
    emoji: "💯",
    category: "milestone",
    target: 100,
    statField: "totalJobsAllTime",
    rarity: "epic",
  },
  {
    id: "scanner_pro",
    name: "Scanner Pro",
    description: "Scan 20 booking screenshots",
    emoji: "📸",
    category: "milestone",
    target: 20,
    statField: "totalScans",
    rarity: "common",
  },
  // ── Earnings ──
  {
    id: "ton_up",
    name: "Ton Up",
    description: "Earn £100 in a single day",
    emoji: "💰",
    category: "earnings",
    target: 1,
    rarity: "rare",
  },
  {
    id: "double_ton",
    name: "Double Ton",
    description: "Earn £200 in a single day",
    emoji: "🏆",
    category: "earnings",
    target: 1,
    rarity: "epic",
  },
  {
    id: "grand_week",
    name: "Legend",
    description: "Earn £1,000 in a single week",
    emoji: "🌟",
    category: "earnings",
    target: 1,
    rarity: "legendary",
  },
  {
    id: "profit_king",
    name: "Profit King",
    description: "Achieve £0.50+ per mile on 5 jobs",
    emoji: "🚀",
    category: "earnings",
    target: 5,
    rarity: "epic",
  },
  // ── Distance ──
  {
    id: "road_warrior_week",
    name: "Road Warrior",
    description: "Drive 1,000 miles in a single week",
    emoji: "🛤️",
    category: "distance",
    target: 1,
    rarity: "rare",
  },
  {
    id: "ten_k_miles",
    name: "10K Club",
    description: "Drive 10,000 miles total",
    emoji: "🌍",
    category: "distance",
    target: 10000,
    statField: "totalMilesAllTime",
    rarity: "epic",
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "Deliver to 10 different UK cities",
    emoji: "🗺️",
    category: "distance",
    target: 10,
    statField: "totalCitiesVisited",
    rarity: "rare",
  },
  // ── Eco ──
  {
    id: "train_spotter",
    name: "Train Spotter",
    description: "Use the train to reposition 10 times",
    emoji: "🚂",
    category: "eco",
    target: 10,
    statField: "totalTrainTrips",
    rarity: "common",
  },
  {
    id: "eco_driver",
    name: "Eco Driver",
    description: "Take the train 25 times instead of driving back",
    emoji: "🌿",
    category: "eco",
    target: 25,
    statField: "totalTrainTrips",
    rarity: "rare",
  },
  {
    id: "bus_buddy",
    name: "Bus Buddy",
    description: "Use the bus to reposition 10 times",
    emoji: "🚌",
    category: "eco",
    target: 10,
    statField: "totalBusTrips",
    rarity: "common",
  },
  // ── Speed ──
  {
    id: "speed_runner",
    name: "Speed Runner",
    description: "Complete 5 jobs in a single day",
    emoji: "⚡",
    category: "speed",
    target: 1,
    rarity: "epic",
  },
  {
    id: "chain_master",
    name: "Chain Master",
    description: "Complete a 3-job chain in one day",
    emoji: "🤝",
    category: "speed",
    target: 1,
    rarity: "rare",
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Start a job before 7am",
    emoji: "🌅",
    category: "special",
    target: 1,
    rarity: "common",
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Complete a job after 10pm",
    emoji: "🌙",
    category: "special",
    target: 1,
    rarity: "common",
  },
  // ── Streak ──
  {
    id: "three_day_streak",
    name: "Hat Trick",
    description: "Work 3 days in a row",
    emoji: "🔥",
    category: "streak",
    target: 3,
    statField: "currentStreak",
    rarity: "common",
  },
  {
    id: "seven_day_streak",
    name: "Diamond Driver",
    description: "Work 7 days in a row",
    emoji: "💎",
    category: "streak",
    target: 7,
    statField: "currentStreak",
    rarity: "epic",
  },
  {
    id: "sharp_shooter",
    name: "Sharp Shooter",
    description: "10 jobs rated Worth It in a row",
    emoji: "🎯",
    category: "special",
    target: 10,
    rarity: "rare",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Returns start of today (UTC midnight) */
function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns start of the current ISO week (Monday) */
function startOfWeek(): Date {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun, 1=Mon…
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Streak Update ────────────────────────────────────────────────────────────

export async function updateStreak(
  userId: number,
  jobMiles: number,
  jobEarnings: number,
  travelHomeMode?: string | null,
  travelToJobMode?: string | null,
  isScanned?: boolean,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = todayStr();
  const yesterday = yesterdayStr();

  const existing = await db.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1);

  const trainModes = ["train"];
  const busModes = ["bus"];
  const isTrainTrip = trainModes.includes(travelHomeMode ?? "") || trainModes.includes(travelToJobMode ?? "");
  const isBusTrip = busModes.includes(travelHomeMode ?? "") || busModes.includes(travelToJobMode ?? "");

  if (existing.length === 0) {
    await db.insert(userStreaks).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastJobDate: today,
      totalJobsAllTime: 1,
      totalMilesAllTime: jobMiles as unknown as number,
      totalEarningsAllTime: jobEarnings as unknown as number,
      totalTrainTrips: isTrainTrip ? 1 : 0,
      totalBusTrips: isBusTrip ? 1 : 0,
      totalScans: isScanned ? 1 : 0,
    });
    return;
  }

  const row = existing[0]!;
  const lastDate = row.lastJobDate;

  let newStreak = row.currentStreak;
  if (lastDate === today) {
    // Same day — no streak change
  } else if (lastDate === yesterday) {
    newStreak = row.currentStreak + 1;
  } else {
    newStreak = 1; // streak broken
  }

  const newLongest = Math.max(row.longestStreak, newStreak);

  await db.update(userStreaks)
    .set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastJobDate: today,
      totalJobsAllTime: row.totalJobsAllTime + 1,
      totalMilesAllTime: (Number(row.totalMilesAllTime) + jobMiles) as unknown as number,
      totalEarningsAllTime: (Number(row.totalEarningsAllTime) + jobEarnings) as unknown as number,
      totalTrainTrips: row.totalTrainTrips + (isTrainTrip ? 1 : 0),
      totalBusTrips: row.totalBusTrips + (isBusTrip ? 1 : 0),
      totalScans: row.totalScans + (isScanned ? 1 : 0),
    })
    .where(eq(userStreaks.userId, userId));
}

// ─── Badge Award Engine ───────────────────────────────────────────────────────

export async function checkAndAwardBadges(
  userId: number,
  context: {
    jobMiles?: number;
    jobEarnings?: number;
    profitPerMile?: number;
    scheduledAt?: Date | null;
    completedAt?: Date | null;
    travelHomeMode?: string | null;
    isScanned?: boolean;
    isThreeJobChain?: boolean;
  },
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const newlyUnlocked: string[] = [];

  // Fetch current streak row
  const streakRows = await db.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1);
  const streak = streakRows[0];
  if (!streak) return [];

  // Fetch existing badge rows for this user
  const existingBadges = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  const badgeMap = new Map(existingBadges.map(b => [b.badgeId, b]));

  // ── Helper: upsert badge progress ──
  const upsertBadge = async (def: BadgeDef, progress: number) => {
    const existing = badgeMap.get(def.id);
    const unlocked = progress >= def.target;

    if (!existing) {
      await db.insert(userBadges).values({
        userId,
        badgeId: def.id,
        progress,
        target: def.target,
        unlocked,
        awardedAt: unlocked ? new Date() : new Date(0),
      });
      if (unlocked) newlyUnlocked.push(def.id);
    } else if (!existing.unlocked && progress >= def.target) {
      await db.update(userBadges)
        .set({ progress, unlocked: true, awardedAt: new Date() })
        .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, def.id)));
      newlyUnlocked.push(def.id);
    } else if (!existing.unlocked && progress > existing.progress) {
      await db.update(userBadges)
        .set({ progress })
        .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, def.id)));
    }
  };

  // ── Stat-driven badges ──
  for (const def of BADGE_DEFINITIONS) {
    if (!def.statField) continue;
    let progress = 0;
    switch (def.statField) {
      case "totalJobsAllTime": progress = streak.totalJobsAllTime; break;
      case "totalMilesAllTime": progress = Math.floor(Number(streak.totalMilesAllTime)); break;
      case "totalEarningsAllTime": progress = Math.floor(Number(streak.totalEarningsAllTime)); break;
      case "totalTrainTrips": progress = streak.totalTrainTrips; break;
      case "totalBusTrips": progress = streak.totalBusTrips; break;
      case "totalScans": progress = streak.totalScans; break;
      case "currentStreak": progress = streak.currentStreak; break;
      case "longestStreak": progress = streak.longestStreak; break;
      case "totalCitiesVisited": progress = streak.totalCitiesVisited; break;
    }
    await upsertBadge(def, progress);
  }

  // ── Custom logic badges ──

  // ton_up: £100 in a day
  if ((context.jobEarnings ?? 0) > 0) {
    const todayStart = startOfToday();
    const todayJobs = await db.select({ total: sql<string>`SUM(deliveryFee + fuelDeposit)` })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, todayStart)));
    const todayTotal = Number(todayJobs[0]?.total ?? 0);
    if (todayTotal >= 100) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "ton_up")!, 1);
    if (todayTotal >= 200) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "double_ton")!, 1);
  }

  // grand_week: £1000 in a week
  const weekStart = startOfWeek();
  const weekJobs = await db.select({ total: sql<string>`SUM(deliveryFee + fuelDeposit)` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, weekStart)));
  const weekTotal = Number(weekJobs[0]?.total ?? 0);
  if (weekTotal >= 1000) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "grand_week")!, 1);

  // road_warrior_week: 1000 miles in a week
  const weekMiles = await db.select({ total: sql<string>`SUM(estimatedDistanceMiles)` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, weekStart)));
  const weekMilesTotal = Number(weekMiles[0]?.total ?? 0);
  if (weekMilesTotal >= 1000) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "road_warrior_week")!, 1);

  // speed_runner: 5 jobs in a day
  const todayStart2 = startOfToday();
  const todayCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, todayStart2)));
  if (Number(todayCount[0]?.count ?? 0) >= 5) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "speed_runner")!, 1);

  // profit_king: £0.50+ per mile
  if ((context.profitPerMile ?? 0) >= 0.5) {
    const pkBadge = badgeMap.get("profit_king");
    const pkProgress = (pkBadge?.progress ?? 0) + 1;
    await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "profit_king")!, pkProgress);
  }

  // early_bird / night_owl
  if (context.scheduledAt) {
    const h = context.scheduledAt.getHours();
    if (h < 7) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "early_bird")!, 1);
  }
  if (context.completedAt) {
    const h = context.completedAt.getHours();
    if (h >= 22) await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "night_owl")!, 1);
  }

  // chain_master: 3-job chain
  if (context.isThreeJobChain) {
    await upsertBadge(BADGE_DEFINITIONS.find(b => b.id === "chain_master")!, 1);
  }

  return newlyUnlocked;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  const [todayStats, weekStats, streakRow, recentJobs] = await Promise.all([
    db.select({
      earnings: sql<string>`COALESCE(SUM(deliveryFee + fuelDeposit), 0)`,
      netProfit: sql<string>`COALESCE(SUM(estimatedNetProfit), 0)`,
      jobCount: sql<number>`COUNT(*)`,
      miles: sql<string>`COALESCE(SUM(estimatedDistanceMiles), 0)`,
    }).from(jobs).where(and(eq(jobs.userId, userId), gte(jobs.createdAt, todayStart))),

    db.select({
      earnings: sql<string>`COALESCE(SUM(deliveryFee + fuelDeposit), 0)`,
      netProfit: sql<string>`COALESCE(SUM(estimatedNetProfit), 0)`,
      jobCount: sql<number>`COUNT(*)`,
      miles: sql<string>`COALESCE(SUM(estimatedDistanceMiles), 0)`,
      avgProfitPerHour: sql<string>`COALESCE(AVG(estimatedProfitPerHour), 0)`,
    }).from(jobs).where(and(eq(jobs.userId, userId), gte(jobs.createdAt, weekStart))),

    db.select().from(userStreaks).where(eq(userStreaks.userId, userId)).limit(1),

    // Last 7 days daily breakdown
    db.select({
      day: sql<string>`DATE(createdAt)`,
      earnings: sql<string>`COALESCE(SUM(deliveryFee + fuelDeposit), 0)`,
      netProfit: sql<string>`COALESCE(SUM(estimatedNetProfit), 0)`,
      jobCount: sql<number>`COUNT(*)`,
      miles: sql<string>`COALESCE(SUM(estimatedDistanceMiles), 0)`,
    }).from(jobs)
      .where(and(eq(jobs.userId, userId), gte(jobs.createdAt, weekStart)))
      .groupBy(sql`DATE(createdAt)`)
      .orderBy(sql`DATE(createdAt)`),
  ]);

  return {
    today: {
      earnings: Number(todayStats[0]?.earnings ?? 0),
      netProfit: Number(todayStats[0]?.netProfit ?? 0),
      jobCount: Number(todayStats[0]?.jobCount ?? 0),
      miles: Number(todayStats[0]?.miles ?? 0),
    },
    week: {
      earnings: Number(weekStats[0]?.earnings ?? 0),
      netProfit: Number(weekStats[0]?.netProfit ?? 0),
      jobCount: Number(weekStats[0]?.jobCount ?? 0),
      miles: Number(weekStats[0]?.miles ?? 0),
      avgProfitPerHour: Number(weekStats[0]?.avgProfitPerHour ?? 0),
    },
    streak: streakRow[0] ?? null,
    dailyBreakdown: recentJobs.map(r => ({
      day: r.day,
      earnings: Number(r.earnings),
      netProfit: Number(r.netProfit),
      jobCount: Number(r.jobCount),
      miles: Number(r.miles),
    })),
  };
}
