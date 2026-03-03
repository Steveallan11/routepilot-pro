import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, CalendarDays, Briefcase, Wrench, User, LogIn,
  Camera, Fuel, FileText, TrendingUp, Users, Trophy, Zap, Crown,
  Bell, Navigation, Link2, MoreHorizontal, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

// ─── Primary 5-tab nav ────────────────────────────────────────────────────────

const primaryNav = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { path: "/calendar", icon: CalendarDays, label: "Calendar" },
  { path: "/jobs", icon: Briefcase, label: "Jobs" },
];

// ─── Tools drawer items ───────────────────────────────────────────────────────

const toolItems = [
  { path: "/routes", icon: Navigation, label: "Route Finder" },
  { path: "/chain", icon: Link2, label: "Chain Planner" },
  { path: "/fuel-finder", icon: Fuel, label: "Fuel Finder" },
  { path: "/insights", icon: Zap, label: "AI Insights" },
  { path: "/vehicle-condition", icon: Camera, label: "Condition Log" },
  { path: "/tax-export", icon: FileText, label: "Tax Export" },
  { path: "/brokers", icon: TrendingUp, label: "Brokers" },
  { path: "/lifts", icon: Users, label: "Lifts" },
  { path: "/reports", icon: BarChart3, label: "P&L Report" },
];

// ─── Me drawer items ──────────────────────────────────────────────────────────

const meItems = [
  { path: "/notifications", icon: Bell, label: "Alerts" },
  { path: "/badges", icon: Trophy, label: "Badges" },
  { path: "/subscription", icon: Crown, label: "Pro" },
  { path: "/settings", icon: User, label: "Settings" },
];

export default function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showTools, setShowTools] = useState(false);
  const [showMe, setShowMe] = useState(false);

  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const isToolsActive = toolItems.some(i => location === i.path || location.startsWith(i.path + "/"));
  const isMeActive = meItems.some(i => location === i.path || location.startsWith(i.path + "/"));

  function closeAll() {
    setShowTools(false);
    setShowMe(false);
  }

  return (
    <>
      {/* Tools drawer */}
      {showTools && (
        <div className="fixed inset-0 z-40" onClick={closeAll}>
          <div
            className="absolute bottom-16 left-0 right-0 mx-4 bg-card border border-border rounded-2xl shadow-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1 mb-2">Tools</p>
            <div className="grid grid-cols-4 gap-1">
              {toolItems.map(({ path, icon: Icon, label }) => {
                const isActive = location === path;
                return (
                  <Link key={path} href={path} onClick={closeAll}>
                    <div className={cn(
                      "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Me drawer */}
      {showMe && (
        <div className="fixed inset-0 z-40" onClick={closeAll}>
          <div
            className="absolute bottom-16 right-0 left-0 mx-4 bg-card border border-border rounded-2xl shadow-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1 mb-2">
              {user?.name ? `Hi, ${user.name.split(" ")[0]}` : "Account"}
            </p>
            <div className="grid grid-cols-4 gap-1">
              {meItems.map(({ path, icon: Icon, label }) => {
                const isActive = location === path;
                return (
                  <Link key={path} href={path} onClick={closeAll}>
                    <div className={cn(
                      "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl transition-colors relative",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}>
                      <div className="relative">
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                        {path === "/notifications" && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch max-w-lg mx-auto">
          {/* Primary 4 tabs */}
          {primaryNav.map(({ path, icon: Icon, label }) => {
            const isActive = location === path || location.startsWith(path + "/");
            return (
              <Link key={path} href={path} className="flex-1" onClick={closeAll}>
                <div className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>{label}</span>
                  {isActive && <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />}
                </div>
              </Link>
            );
          })}

          {/* Tools tab */}
          <button className="flex-1" onClick={() => { setShowMe(false); setShowTools(v => !v); }}>
            <div className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative",
              (showTools || isToolsActive) ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <Wrench size={22} strokeWidth={(showTools || isToolsActive) ? 2.5 : 1.8} />
              <span className={cn("text-[10px] font-medium", (showTools || isToolsActive) && "font-semibold")}>Tools</span>
              {(showTools || isToolsActive) && <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />}
            </div>
          </button>

          {/* Me tab */}
          {isAuthenticated ? (
            <button className="flex-1" onClick={() => { setShowTools(false); setShowMe(v => !v); }}>
              <div className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative",
                (showMe || isMeActive) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <div className="relative">
                  <div className={cn(
                    "w-[22px] h-[22px] rounded-full flex items-center justify-center",
                    (showMe || isMeActive) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <User size={13} strokeWidth={2} />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium truncate max-w-[40px]", (showMe || isMeActive) && "font-semibold")}>
                  {user?.name?.split(" ")[0] ?? "Me"}
                </span>
                {(showMe || isMeActive) && <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />}
              </div>
            </button>
          ) : (
            <button onClick={() => { window.location.href = getLoginUrl(); }} className="flex-1">
              <div className="flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-primary hover:text-primary/80 transition-colors">
                <LogIn size={22} strokeWidth={2} />
                <span className="text-[10px] font-semibold">Sign In</span>
              </div>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
