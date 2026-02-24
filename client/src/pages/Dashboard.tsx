import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, MapPin, Clock, Zap, Star, Flame, Trophy,
  ChevronRight, RefreshCw, Navigation, Car, Calendar,
  ArrowRight, Sparkles, Target, Award
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtGbp(n: number) {
  return `£${fmt(n, 2)}`;
}

function timeUntil(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-green-400", icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-[#1a1f2e] rounded-2xl p-4 flex flex-col gap-1 border border-white/5">
      <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide">
        <Icon size={12} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function StreakWidget({ streak }: { streak: { currentStreak: number; longestStreak: number } | null }) {
  const current = streak?.currentStreak ?? 0;
  const longest = streak?.longestStreak ?? 0;

  return (
    <div className="bg-gradient-to-r from-orange-500/20 to-red-500/10 border border-orange-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔥</div>
          <div>
            <div className="text-white font-bold text-lg">{current} day streak</div>
            <div className="text-orange-300/70 text-xs">Best: {longest} days</div>
          </div>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${i < current % 7 || (current >= 7) ? "bg-orange-400" : "bg-gray-700"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NextJobWidget({ job }: { job: any | null }) {
  const [, navigate] = useLocation();

  if (!job) {
    return (
      <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
          <Calendar size={14} />
          <span className="uppercase tracking-wide text-xs font-medium">Next Job</span>
        </div>
        <div className="text-gray-500 text-sm text-center py-4">
          No jobs planned yet
          <div className="mt-2">
            <button
              onClick={() => navigate("/")}
              className="text-green-400 text-xs underline"
            >
              Add a job →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-green-500/15 to-emerald-500/5 border border-green-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-green-400 text-xs font-medium uppercase tracking-wide">
          <Navigation size={12} />
          Next Job
        </div>
        <div className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full font-medium">
          in {timeUntil(job.scheduledPickupAt)}
        </div>
      </div>
      <div className="flex items-center gap-2 text-white font-semibold text-base mb-2">
        <MapPin size={14} className="text-green-400 shrink-0" />
        {job.pickupPostcode}
        <ArrowRight size={14} className="text-gray-500" />
        {job.dropoffPostcode}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span className="flex items-center gap-1">
          <Car size={12} />
          {job.brokerName || "Delivery"}
        </span>
        {job.estimatedDistanceMiles && (
          <span>{Number(job.estimatedDistanceMiles).toFixed(0)} mi</span>
        )}
        {job.estimatedNetProfit && (
          <span className="text-green-400 font-medium">{fmtGbp(Number(job.estimatedNetProfit))}</span>
        )}
      </div>
      <button
        onClick={() => navigate("/routes")}
        className="mt-3 w-full bg-green-500/20 hover:bg-green-500/30 text-green-300 text-sm py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <Navigation size={14} />
        Find route to pickup
      </button>
    </div>
  );
}

function WeeklyChart({ data }: { data: { day: string; netProfit: number; earnings: number }[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "short" });

  // Fill in all 7 days
  const filled = days.map(d => {
    const match = data.find(r => dayLabel(r.day) === d);
    return { day: d, netProfit: match?.netProfit ?? 0, earnings: match?.earnings ?? 0 };
  });

  const max = Math.max(...filled.map(d => d.netProfit), 1);

  return (
    <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-400 flex items-center gap-2">
          <TrendingUp size={12} />
          This Week
        </div>
        <div className="text-xs text-gray-500">Net profit / day</div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={filled} barSize={28}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 11 }}
          />
          <YAxis hide domain={[0, max * 1.2]} />
          <Tooltip
            contentStyle={{ background: "#0d1117", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`£${v.toFixed(2)}`, "Net Profit"]}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Bar dataKey="netProfit" radius={[6, 6, 0, 0]}>
            {filled.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.day === today ? "#22c55e" : entry.netProfit > 0 ? "#16a34a" : "#1f2937"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AIInsightsPanel() {
  const { data, isLoading, refetch, isFetching } = trpc.dashboard.aiInsights.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/20 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-purple-300 text-xs font-medium uppercase tracking-wide">
          <Sparkles size={12} />
          AI Insights
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-purple-400/60 hover:text-purple-300 transition-colors"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.insights ?? []).map((insight: { icon: string; text: string }, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 bg-white/5 rounded-xl p-3"
            >
              <span className="text-lg leading-none mt-0.5">{insight.icon}</span>
              <p className="text-gray-300 text-sm leading-snug">{insight.text}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function BadgePreview() {
  const [, navigate] = useLocation();
  const { data } = trpc.dashboard.badges.useQuery();
  const markSeen = trpc.dashboard.markBadgesSeen.useMutation();

  const unlocked = data?.badges.filter(b => b.unlocked) ?? [];
  const newBadges = data?.newBadges ?? [];

  // Show new badge toast
  const [shownNew, setShownNew] = useState(false);
  if (newBadges.length > 0 && !shownNew) {
    setShownNew(true);
    markSeen.mutate();
  }

  if (unlocked.length === 0) {
    return (
      <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-yellow-400/70 text-xs font-medium uppercase tracking-wide">
            <Award size={12} />
            Badges
          </div>
          <button onClick={() => navigate("/badges")} className="text-gray-500 text-xs flex items-center gap-1">
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="text-gray-500 text-sm text-center py-3">
          Complete jobs to earn your first badge 🏅
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-yellow-400/70 text-xs font-medium uppercase tracking-wide">
          <Award size={12} />
          Badges
          {newBadges.length > 0 && (
            <span className="bg-yellow-400 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
              +{newBadges.length} new!
            </span>
          )}
        </div>
        <button onClick={() => navigate("/badges")} className="text-gray-500 text-xs flex items-center gap-1">
          {data?.badges.length ?? 0} total <ChevronRight size={12} />
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {unlocked.slice(0, 8).map(badge => (
          <motion.div
            key={badge.id}
            initial={newBadges.includes(badge.id) ? { scale: 0 } : { scale: 1 }}
            animate={{ scale: 1 }}
            className={`relative text-2xl p-2 rounded-xl ${
              badge.rarity === "legendary" ? "bg-yellow-500/20 border border-yellow-500/40" :
              badge.rarity === "epic" ? "bg-purple-500/20 border border-purple-500/30" :
              badge.rarity === "rare" ? "bg-blue-500/20 border border-blue-500/30" :
              "bg-white/5 border border-white/10"
            }`}
            title={badge.name}
          >
            {badge.emoji}
            {newBadges.includes(badge.id) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-[#0d1117]" />
            )}
          </motion.div>
        ))}
        {unlocked.length > 8 && (
          <div className="text-2xl p-2 rounded-xl bg-white/5 border border-white/10 text-gray-500 text-sm flex items-center justify-center w-10 h-10">
            +{unlocked.length - 8}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });
  const { data: nextJob } = trpc.dashboard.nextJob.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const { data: streakData } = trpc.dashboard.streak.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">🚗</div>
        <div className="text-center">
          <h2 className="text-white text-xl font-bold mb-2">Sign in to see your dashboard</h2>
          <p className="text-gray-400 text-sm">Track earnings, badges, and AI insights</p>
        </div>
        <a
          href={getLoginUrl()}
          className="bg-green-500 text-black font-bold py-3 px-8 rounded-2xl"
        >
          Sign In
        </a>
      </div>
    );
  }

  const today = stats?.today;
  const week = stats?.week;
  const dailyData = stats?.dailyBreakdown ?? [];

  return (
    <div className="min-h-screen bg-[#0d1117] pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{greeting},</p>
            <h1 className="text-white text-2xl font-bold">{user?.name?.split(" ")[0] ?? "Driver"} 👋</h1>
          </div>
          <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1.5">
            <Flame size={14} className="text-orange-400" />
            <span className="text-orange-300 text-sm font-bold">{streakData?.currentStreak ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Today's hero stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Today's Profit"
            value={statsLoading ? "..." : fmtGbp(today?.netProfit ?? 0)}
            sub={`${today?.jobCount ?? 0} job${(today?.jobCount ?? 0) !== 1 ? "s" : ""}`}
            color="text-green-400"
            icon={TrendingUp}
          />
          <StatCard
            label="Today's Miles"
            value={statsLoading ? "..." : `${fmt(today?.miles ?? 0)} mi`}
            sub={`${fmtGbp(today?.earnings ?? 0)} earned`}
            color="text-blue-400"
            icon={MapPin}
          />
          <StatCard
            label="Week Profit"
            value={statsLoading ? "..." : fmtGbp(week?.netProfit ?? 0)}
            sub={`${week?.jobCount ?? 0} jobs`}
            color="text-purple-400"
            icon={Star}
          />
          <StatCard
            label="Avg £/hr"
            value={statsLoading ? "..." : fmtGbp(week?.avgProfitPerHour ?? 0)}
            sub="this week"
            color={((week?.avgProfitPerHour ?? 0) >= 15) ? "text-green-400" : "text-amber-400"}
            icon={Zap}
          />
        </div>

        {/* Streak */}
        <StreakWidget streak={streakData ?? null} />

        {/* Next Job */}
        <NextJobWidget job={nextJob} />

        {/* Weekly chart */}
        <WeeklyChart data={dailyData} />

        {/* AI Insights */}
        <AIInsightsPanel />

        {/* Badge preview */}
        <BadgePreview />
      </div>
    </div>
  );
}
