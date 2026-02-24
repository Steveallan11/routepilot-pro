import { useLocation, Link } from "wouter";
import { Car, Navigation, History, LayoutDashboard, Trophy, LogIn, User, Bell, MoreHorizontal, Camera, Fuel, FileText, TrendingUp, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const primaryNav = [
  { path: "/calculator", icon: Car, label: "Calculator" },
  { path: "/routes", icon: Navigation, label: "Routes" },
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/history", icon: History, label: "History" },
];

const moreItems = [
  { path: "/vehicle-condition", icon: Camera, label: "Condition Log" },
  { path: "/fuel-finder", icon: Fuel, label: "Fuel Finder" },
  { path: "/tax-export", icon: FileText, label: "Tax Export" },
  { path: "/brokers", icon: TrendingUp, label: "Brokers" },
  { path: "/lifts", icon: Users, label: "Lifts" },
  { path: "/badges", icon: Trophy, label: "Badges" },
  { path: "/insights", icon: Trophy, label: "AI Insights" },
  { path: "/subscription", icon: Crown, label: "Pro" },
];

export default function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const isMoreActive = moreItems.some((item) => location === item.path || location.startsWith(item.path + "/"));

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 mx-4 bg-card border border-border rounded-2xl shadow-xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1">
              {moreItems.map(({ path, icon: Icon, label }) => {
                const isActive = location === path;
                return (
                  <Link key={path} href={path} onClick={() => setShowMore(false)}>
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-stretch max-w-lg mx-auto">
          {primaryNav.map(({ path, icon: Icon, label }) => {
            const isActive = location === path || location.startsWith(path + "/");
            return (
              <Link key={path} href={path} className="flex-1">
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

          {/* More button */}
          <button className="flex-1" onClick={() => setShowMore((v) => !v)}>
            <div className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative",
              (showMore || isMoreActive) ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <MoreHorizontal size={22} strokeWidth={(showMore || isMoreActive) ? 2.5 : 1.8} />
              <span className={cn("text-[10px] font-medium", (showMore || isMoreActive) && "font-semibold")}>More</span>
              {(showMore || isMoreActive) && <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />}
            </div>
          </button>

          {/* Notifications */}
          <Link href="/notifications" className="flex-1">
            <div className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative",
              location === "/notifications" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <div className="relative">
                <Bell size={22} strokeWidth={location === "/notifications" ? 2.5 : 1.8} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-medium", location === "/notifications" && "font-semibold")}>Alerts</span>
              {location === "/notifications" && <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />}
            </div>
          </Link>

          {/* Sign-in / profile button */}
          {isAuthenticated ? (
            <Link href="/settings" className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors relative",
                location.startsWith("/settings") ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <User size={12} className="text-primary" />
                </div>
                <span className="text-[10px] font-medium truncate max-w-[40px]">
                  {user?.name?.split(" ")[0] ?? "Me"}
                </span>
                {location.startsWith("/settings") && (
                  <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />
                )}
              </div>
            </Link>
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
