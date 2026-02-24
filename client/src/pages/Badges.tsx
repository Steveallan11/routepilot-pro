import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Award, Lock, Trophy } from "lucide-react";
type BadgeCategory = "milestone" | "earnings" | "distance" | "eco" | "speed" | "streak" | "special";

const RARITY_STYLES: Record<string, { border: string; bg: string; label: string; labelColor: string }> = {
  legendary: {
    border: "border-yellow-500/60",
    bg: "bg-gradient-to-br from-yellow-500/25 to-amber-500/10",
    label: "Legendary",
    labelColor: "text-yellow-400",
  },
  epic: {
    border: "border-purple-500/50",
    bg: "bg-gradient-to-br from-purple-500/20 to-violet-500/5",
    label: "Epic",
    labelColor: "text-purple-400",
  },
  rare: {
    border: "border-blue-500/40",
    bg: "bg-gradient-to-br from-blue-500/15 to-cyan-500/5",
    label: "Rare",
    labelColor: "text-blue-400",
  },
  common: {
    border: "border-white/10",
    bg: "bg-[#1a1f2e]",
    label: "Common",
    labelColor: "text-gray-500",
  },
};

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  milestone: "🏁 Milestones",
  earnings: "💰 Earnings",
  distance: "🛤️ Distance",
  eco: "🌿 Eco",
  speed: "⚡ Speed",
  streak: "🔥 Streaks",
  special: "⭐ Special",
};

interface BadgeWithProgress {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: BadgeCategory;
  target: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  progress: number;
  unlocked: boolean;
  awardedAt: Date | null;
  seen: boolean;
}

function BadgeCard({ badge }: { badge: BadgeWithProgress }) {
  const style = RARITY_STYLES[badge.rarity];
  const pct = Math.min(100, (badge.progress / badge.target) * 100);
  const isNew = badge.unlocked && !badge.seen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl p-4 border ${badge.unlocked ? style.border : "border-white/5"} ${badge.unlocked ? style.bg : "bg-[#12161f]"} ${!badge.unlocked ? "opacity-60" : ""}`}
    >
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          NEW!
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className={`text-3xl p-2 rounded-xl ${badge.unlocked ? "bg-white/10" : "bg-white/5 grayscale"}`}>
          {badge.unlocked ? badge.emoji : <Lock size={20} className="text-gray-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${badge.unlocked ? "text-white" : "text-gray-500"}`}>
              {badge.name}
            </span>
            <span className={`text-xs ${style.labelColor}`}>{style.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{badge.description}</p>

          {/* Progress bar */}
          {!badge.unlocked && badge.target > 1 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{badge.progress} / {badge.target}</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    badge.rarity === "legendary" ? "bg-yellow-400" :
                    badge.rarity === "epic" ? "bg-purple-400" :
                    badge.rarity === "rare" ? "bg-blue-400" :
                    "bg-green-400"
                  }`}
                />
              </div>
            </div>
          )}

          {badge.unlocked && badge.awardedAt && (
            <div className="text-xs text-gray-500 mt-1">
              Earned {new Date(badge.awardedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Badges() {
  const { isAuthenticated, loading } = useAuth();
  const { data, isLoading } = trpc.dashboard.badges.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">🏆</div>
        <div className="text-center">
          <h2 className="text-white text-xl font-bold mb-2">Sign in to see your badges</h2>
          <p className="text-gray-400 text-sm">Earn achievements as you deliver</p>
        </div>
        <a href={getLoginUrl()} className="bg-green-500 text-black font-bold py-3 px-8 rounded-2xl">
          Sign In
        </a>
      </div>
    );
  }

  const badges = (data?.badges ?? []) as BadgeWithProgress[];
  const unlocked = badges.filter(b => b.unlocked);
  const categories = Array.from(new Set(badges.map(b => b.category))) as BadgeCategory[];

  return (
    <div className="min-h-screen bg-[#0d1117] pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={20} className="text-yellow-400" />
          <h1 className="text-white text-2xl font-bold">Badges</h1>
        </div>
        <p className="text-gray-400 text-sm">
          {unlocked.length} of {badges.length} unlocked
        </p>
      </div>

      {/* Progress overview */}
      <div className="px-4 mb-4">
        <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Overall progress</span>
            <span>{badges.length > 0 ? Math.round((unlocked.length / badges.length) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${badges.length > 0 ? (unlocked.length / badges.length) * 100 : 0}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {(["legendary", "epic", "rare", "common"] as const).map(r => {
              const count = unlocked.filter(b => b.rarity === r).length;
              const total = badges.filter(b => b.rarity === r).length;
              return (
                <div key={r} className="text-center">
                  <div className={`text-sm font-bold ${RARITY_STYLES[r].labelColor}`}>{count}/{total}</div>
                  <div className="text-xs text-gray-600 capitalize">{r}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Badge categories */}
      <div className="px-4 space-y-6">
        {categories.map(cat => {
          const catBadges = badges.filter(b => b.category === cat);
          const catUnlocked = catBadges.filter(b => b.unlocked).length;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-sm">{CATEGORY_LABELS[cat]}</h2>
                <span className="text-xs text-gray-500">{catUnlocked}/{catBadges.length}</span>
              </div>
              <div className="space-y-3">
                {catBadges
                  .sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0))
                  .map(badge => (
                    <BadgeCard key={badge.id} badge={badge} />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
