import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, MapPin, Clock, Zap, Star, Flame, Trophy,
  ChevronRight, RefreshCw, Navigation, Car, Calendar,
  ArrowRight, Sparkles, Target, Award, Fuel, Train, Building2,
  Hash, CheckCircle2, XCircle, Circle, PlusCircle, FileText
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell
} from "recharts";

// ─── Next Job Detail Sheet ───────────────────────────────────────────────────

function NextJobDetailSheet({ job, onClose }: { job: any; onClose: () => void }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const updateMutation = trpc.jobs.update.useMutation({
    onSuccess: () => { utils.dashboard.nextJob.invalidate(); onClose(); },
  });

  const netProfit = job.actualNetProfit ?? job.estimatedNetProfit ?? 0;
  const brokerFee = ((job.deliveryFee * (job.brokerFeePercent ?? 0)) / 100) + (job.brokerFeeFixed ?? 0);
  const travelCost = (job.travelToJobCost ?? 0) + (job.travelHomeCost ?? 0);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[90dvh] overflow-y-auto rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">
              {job.pickupPostcode} → {job.dropoffPostcode}
            </SheetTitle>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
              in {timeUntil(job.scheduledPickupAt)}
            </span>
          </div>
          {job.scheduledPickupAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(job.scheduledPickupAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </SheetHeader>

        <div className="px-4 pt-4 space-y-4">
          {/* Net profit hero */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
              <p className={cn("text-3xl font-bold font-mono", netProfit >= 0 ? "text-primary" : "text-destructive")}>
                {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(2)}
              </p>
            </div>
            <div className="text-right space-y-1">
              {job.estimatedDistanceMiles && <p className="text-xs text-muted-foreground">{Number(job.estimatedDistanceMiles).toFixed(1)} mi</p>}
              {job.estimatedDurationMins && <p className="text-xs text-muted-foreground">{Math.floor(job.estimatedDurationMins / 60)}h {Math.round(job.estimatedDurationMins % 60)}m</p>}
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Breakdown</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="font-mono text-primary">+£{Number(job.deliveryFee).toFixed(2)}</span>
              </div>
              {(job.estimatedFuelCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Fuel size={11} /> Fuel Cost <span className="text-xs text-blue-400">(claimed back)</span>
                  </span>
                  <span className="font-mono text-muted-foreground">£{Number(job.estimatedFuelCost).toFixed(2)}</span>
                </div>
              )}
              {brokerFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broker Fee</span>
                  <span className="font-mono">-£{brokerFee.toFixed(2)}</span>
                </div>
              )}
              {travelCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Train size={11} /> Travel Expenses</span>
                  <span className="font-mono">-£{travelCost.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Net Profit</span>
                <span className={cn("font-mono", netProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Job sheet info */}
          {(job.brokerName || job.jobReference || job.vehicleReg) && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Job Sheet</p>
              <div className="space-y-1.5 text-sm">
                {job.brokerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Building2 size={11} /> Broker</span>
                    <span className="font-medium">{job.brokerName}</span>
                  </div>
                )}
                {job.jobReference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Hash size={11} /> Reference</span>
                    <span className="font-mono text-xs">{job.jobReference}</span>
                  </div>
                )}
                {job.vehicleReg && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Car size={11} /> Vehicle</span>
                    <span className="font-mono text-xs uppercase">{job.vehicleReg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { navigate(`/routes?from=${job.pickupPostcode}`); onClose(); }}
            >
              <Navigation size={14} className="mr-1.5" /> Route
            </Button>
            <Button
              className="flex-1"
              onClick={() => updateMutation.mutate({ id: job.id, status: "active" })}
              disabled={updateMutation.isPending || job.status === "active"}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              {job.status === "active" ? "Active" : "Start Job"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
  const [showDetail, setShowDetail] = useState(false);

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
              onClick={() => navigate("/jobs")}
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
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="w-full text-left bg-gradient-to-br from-green-500/15 to-emerald-500/5 border border-green-500/30 rounded-2xl p-4 hover:border-green-400/50 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-green-400 text-xs font-medium uppercase tracking-wide">
            <Navigation size={12} />
            Next Job
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full font-medium">
              in {timeUntil(job.scheduledPickupAt)}
            </div>
            <ChevronRight size={14} className="text-green-400/60" />
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
      </button>

      {/* Inline job detail sheet */}
      {showDetail && (
        <NextJobDetailSheet job={job} onClose={() => setShowDetail(false)} />
      )}
    </>
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

function WeeklySummaryCard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: myPos } = trpc.leaderboard.myPosition.useQuery({ weekOffset: 0 });
  const [, navigate] = useLocation();

  const week = stats?.week;
  if (isLoading) return null;
  if (!week || week.jobCount === 0) return null;

  const ppm = week.miles > 0 ? week.netProfit / week.miles : 0;
  const gradeFromPpm = ppm >= 0.7 ? "A+" : ppm >= 0.55 ? "A" : ppm >= 0.40 ? "B" : ppm >= 0.28 ? "C" : "D";
  const gradeColor = (g: string) => {
    if (g === "A+" || g === "A") return "text-emerald-400";
    if (g === "B") return "text-blue-400";
    if (g === "C") return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-primary" />
          <span className="text-xs font-medium uppercase tracking-wide text-primary">Week Summary</span>
        </div>
        <button onClick={() => navigate("/reports")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          Full report <ChevronRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <p className="text-lg font-black font-display text-foreground">£{week.netProfit.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Net profit</p>
        </div>
        <div className="text-center">
          <p className={`text-lg font-black font-display ${gradeColor(gradeFromPpm)}`}>{gradeFromPpm}</p>
          <p className="text-xs text-muted-foreground">Avg grade</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black font-display text-foreground">{week.jobCount}</p>
          <p className="text-xs text-muted-foreground">Jobs done</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
        <span>£{ppm.toFixed(2)}/mi · {week.miles.toFixed(0)} mi total</span>
        {myPos && myPos.rank <= 10 && (
          <span className="text-primary font-semibold">#{myPos.rank} this week 🏆</span>
        )}
      </div>
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
  const [, navigate] = useLocation();
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

  // Draft jobs banner
  const { data: draftJobsData } = trpc.jobs.list.useQuery(
    { status: "draft" },
    { enabled: isAuthenticated }
  );
  const draftJobs = draftJobsData?.jobs ?? [];
  const hasDrafts = draftJobs.length > 0;

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
        {/* Draft jobs banner */}
        {hasDrafts && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
          >
            <FileText size={16} className="text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">
                {draftJobs!.length} draft job{draftJobs!.length !== 1 ? "s" : ""} saved
              </p>
              <p className="text-xs text-muted-foreground truncate">Tap to review and confirm</p>
            </div>
            <button
              onClick={() => navigate("/jobs?status=draft")}
              className="text-xs text-amber-400 font-semibold shrink-0 flex items-center gap-1"
            >
              View <ChevronRight size={12} />
            </button>
          </motion.div>
        )}

        {/* Check a Job CTA */}
        <button
          onClick={() => navigate("/check")}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <PlusCircle size={20} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-foreground">Check a Job</p>
              <p className="text-xs text-muted-foreground">Is this booking worth it?</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-primary" />
        </button>

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
        {/* Weekly summary card */}
        <WeeklySummaryCard />
        {/* AI Insights */}
        <AIInsightsPanel />

        {/* Badge preview */}
        <BadgePreview />
      </div>
    </div>
  );
}
