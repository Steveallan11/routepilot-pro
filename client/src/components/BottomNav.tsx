import { useLocation, Link } from "wouter";
import { Car, Link2, History, CalendarDays, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Car, label: "Calculator" },
  { path: "/chain", icon: Link2, label: "Chain" },
  { path: "/planner", icon: CalendarDays, label: "Planner" },
  { path: "/history", icon: History, label: "History" },
  { path: "/insights", icon: Sparkles, label: "AI" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-stretch max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link key={path} href={path} className="flex-1">
              <div className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                  {label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
