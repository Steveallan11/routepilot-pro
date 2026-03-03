import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import {
  ChevronLeft, ChevronRight, TrendingUp, PoundSterling,
  Car, Download, BarChart3, Calendar, Route
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
}

function fmt(n: number, dp = 2) {
  return n.toFixed(dp);
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

type DayData = { date: string; earnings: number; costs: number; netProfit: number; jobCount: number };

function WeekBarChart({ days, maxVal }: { days: DayData[]; maxVal: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-40 px-1">
        {days.map((d, i) => {
          const earningsH = maxVal > 0 ? (d.earnings / maxVal) * 100 : 0;
          const costsH = maxVal > 0 ? (d.costs / maxVal) * 100 : 0;
          const netH = maxVal > 0 ? (Math.max(0, d.netProfit) / maxVal) * 100 : 0;
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)}
            >
              {/* Tooltip */}
              {hovered === i && d.jobCount > 0 && (
                <div className="absolute z-10 -mt-24 bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none whitespace-nowrap">
                  <div className="font-semibold mb-1">{fmtDate(d.date)}</div>
                  <div className="text-primary">Earnings: £{fmt(d.earnings)}</div>
                  <div className="text-destructive">Costs: £{fmt(d.costs)}</div>
                  <div className={cn("font-bold", d.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                    Net: {d.netProfit >= 0 ? "+" : ""}£{fmt(d.netProfit)}
                  </div>
                  <div className="text-muted-foreground">{d.jobCount} job{d.jobCount !== 1 ? "s" : ""}</div>
                </div>
              )}
              {/* Bars */}
              <div className="relative w-full flex items-end justify-center gap-0.5 h-32">
                {/* Earnings bar */}
                <div
                  className={cn(
                    "flex-1 rounded-t-sm transition-all",
                    d.earnings > 0 ? "bg-primary/40" : "bg-muted/20",
                    hovered === i && "bg-primary/60"
                  )}
                  style={{ height: `${Math.max(earningsH, d.earnings > 0 ? 4 : 0)}%` }}
                />
                {/* Net profit bar */}
                <div
                  className={cn(
                    "flex-1 rounded-t-sm transition-all",
                    d.netProfit > 0 ? "bg-primary" : d.netProfit < 0 ? "bg-destructive" : "bg-muted/20",
                    hovered === i && "opacity-90"
                  )}
                  style={{ height: `${Math.max(netH, d.netProfit !== 0 ? 4 : 0)}%` }}
                />
              </div>
              {/* Day label */}
              <span className={cn(
                "text-[10px] font-medium",
                isToday ? "text-primary font-bold" : "text-muted-foreground",
                d.jobCount > 0 ? "text-foreground" : ""
              )}>
                {fmtShort(d.date)}
              </span>
              {d.jobCount > 0 && (
                <span className="text-[9px] text-primary font-mono">{d.jobCount}j</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground justify-center">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/40" /> Earnings</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /> Net Profit</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));

  const weekEnd = useMemo(() => getSundayOfWeek(weekStart), [weekStart]);

  const { data, isLoading } = trpc.jobs.weeklyReport.useQuery({
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
  }, { enabled: isAuthenticated });

  const maxVal = useMemo(() => {
    if (!data?.days) return 100;
    return Math.max(...data.days.map(d => Math.max(d.earnings, d.netProfit)), 1);
  }, [data]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const thisWeek = () => setWeekStart(getMondayOfWeek(new Date()));

  const isCurrentWeek = weekStart.toISOString().slice(0, 10) === getMondayOfWeek(new Date()).toISOString().slice(0, 10);

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Date", "Route", "Fee (£)", "Fuel (£)", "Transport (£)", "Net Profit (£)", "Miles", "Broker", "Status"];
    const rows = data.jobs.map(j => [
      j.date ?? "",
      j.route,
      fmt(j.fee),
      fmt(j.fuel),
      fmt(j.transport),
      fmt(j.net),
      fmt(j.miles, 1),
      j.broker,
      j.status,
    ]);
    const totals = [
      "TOTAL",
      `${data.totals.jobCount} jobs`,
      fmt(data.totals.earnings),
      "",
      "",
      fmt(data.totals.netProfit),
      fmt(data.totals.miles, 1),
      "",
      "",
    ];
    const csv = [headers, ...rows, totals]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pl-week-${weekStart.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Week P&L exported as CSV");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <BarChart3 size={40} className="text-muted-foreground" />
        <p className="text-muted-foreground text-center">Sign in to view your P&L reports</p>
        <Button onClick={() => navigate(getLoginUrl())}>Sign In</Button>
      </div>
    );
  }

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            <h1 className="text-lg font-bold">P&amp;L Report</h1>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCSV} disabled={!data || data.jobs.length === 0}>
            <Download size={13} /> Export CSV
          </Button>
        </div>
        {/* Week navigator */}
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={prevWeek}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold">
              {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            {isCurrentWeek && <Badge variant="outline" className="text-[10px] mt-0.5 text-primary border-primary/30">This Week</Badge>}
          </div>
          <div className="flex items-center gap-1">
            {!isCurrentWeek && (
              <button onClick={thisWeek} className="text-[11px] text-primary px-2 py-1 rounded-lg hover:bg-primary/10">Today</button>
            )}
            <button
              onClick={nextWeek}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Earnings</div>
            <div className="text-base font-bold font-mono text-primary">
              {isLoading ? "…" : `£${fmt(totals?.earnings ?? 0, 0)}`}
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Net Profit</div>
            <div className={cn("text-base font-bold font-mono", (totals?.netProfit ?? 0) >= 0 ? "text-primary" : "text-destructive")}>
              {isLoading ? "…" : `${(totals?.netProfit ?? 0) >= 0 ? "+" : ""}£${fmt(totals?.netProfit ?? 0, 0)}`}
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Jobs</div>
            <div className="text-base font-bold font-mono">
              {isLoading ? "…" : totals?.jobCount ?? 0}
            </div>
          </div>
        </div>

        {/* Additional stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
            <Car size={16} className="text-muted-foreground shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">Total Miles</div>
              <div className="text-sm font-bold font-mono">{isLoading ? "…" : `${fmt(totals?.miles ?? 0, 0)} mi`}</div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
            <TrendingUp size={16} className="text-muted-foreground shrink-0" />
            <div>
              <div className="text-[10px] text-muted-foreground">Costs</div>
              <div className="text-sm font-bold font-mono text-destructive">{isLoading ? "…" : `£${fmt(totals?.costs ?? 0, 0)}`}</div>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-card rounded-xl p-4 border border-border relative">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Breakdown</span>
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : (data?.days?.length ?? 0) === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No jobs this week</div>
          ) : (
            <WeekBarChart days={data!.days} maxVal={maxVal} />
          )}
        </div>

        {/* Job breakdown table */}
        {(data?.jobs?.length ?? 0) > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Route size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Breakdown</span>
            </div>
            <div className="divide-y divide-border">
              {data!.jobs.map((j, i) => (
                <div key={j.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{j.route}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      {j.date && <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(j.date)}</span>}
                      {j.broker && <span>{j.broker}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono text-primary">£{fmt(j.fee, 0)}</div>
                    <div className={cn("text-[11px] font-mono", j.net >= 0 ? "text-primary/70" : "text-destructive")}>
                      {j.net >= 0 ? "+" : ""}£{fmt(j.net, 0)} net
                    </div>
                  </div>
                </div>
              ))}
              {/* Totals row */}
              <div className="px-4 py-3 flex items-center justify-between gap-3 bg-muted/30">
                <div className="text-sm font-bold">Total ({data!.totals.jobCount} jobs)</div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-primary">£{fmt(data!.totals.earnings, 0)}</div>
                  <div className={cn("text-[11px] font-mono font-bold", data!.totals.netProfit >= 0 ? "text-primary/70" : "text-destructive")}>
                    {data!.totals.netProfit >= 0 ? "+" : ""}£{fmt(data!.totals.netProfit, 0)} net
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (data?.jobs?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <PoundSterling size={36} className="text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No jobs scheduled this week</p>
            <p className="text-muted-foreground/60 text-xs">Navigate to a different week or add jobs to see your P&amp;L</p>
          </div>
        )}
      </div>
    </div>
  );
}
