import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import {
  ChevronLeft, ChevronRight, TrendingUp, PoundSterling,
  Car, Download, BarChart3, Calendar, Route, Target, Pencil, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
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

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtShort(iso: string, mode: "week" | "month") {
  const d = new Date(iso);
  if (mode === "week") return d.toLocaleDateString("en-GB", { weekday: "short" });
  return String(d.getDate());
}

function fmt(n: number, dp = 2) {
  return n.toFixed(dp);
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

type DayData = { date: string; earnings: number; costs: number; netProfit: number; jobCount: number };

function BarChart({ days, maxVal, mode }: { days: DayData[]; maxVal: number; mode: "week" | "month" }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const showLabel = (i: number) => mode === "week" || i % 5 === 0 || i === days.length - 1;

  return (
    <div className="w-full">
      <div className="flex items-end gap-0.5 h-40 px-1">
        {days.map((d, i) => {
          const earningsH = maxVal > 0 ? (d.earnings / maxVal) * 100 : 0;
          const netH = maxVal > 0 ? (Math.max(0, d.netProfit) / maxVal) * 100 : 0;
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer relative"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)}
              onTouchEnd={() => setTimeout(() => setHovered(null), 1500)}
            >
              {/* Tooltip */}
              {hovered === i && d.jobCount > 0 && (
                <div className="absolute z-10 bottom-full mb-1 bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none whitespace-nowrap left-1/2 -translate-x-1/2">
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
              <div className="relative w-full flex items-end justify-center gap-px h-32">
                <div
                  className={cn(
                    "flex-1 rounded-t-sm transition-all",
                    d.earnings > 0 ? "bg-primary/40" : "bg-muted/20",
                    hovered === i && "bg-primary/60"
                  )}
                  style={{ height: `${Math.max(earningsH, d.earnings > 0 ? 4 : 0)}%` }}
                />
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
              {showLabel(i) ? (
                <span className={cn(
                  "text-[9px] font-medium leading-none",
                  isToday ? "text-primary font-bold" : "text-muted-foreground",
                  d.jobCount > 0 ? "text-foreground" : ""
                )}>
                  {fmtShort(d.date, mode)}
                </span>
              ) : (
                <span className="text-[9px] leading-none opacity-0">·</span>
              )}
              {d.jobCount > 0 && mode === "week" && (
                <span className="text-[9px] text-primary font-mono">{d.jobCount}j</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground justify-center">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/40" /> Earnings</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /> Net Profit</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = "week" | "month";

export default function Reports() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [monthRef, setMonthRef] = useState(() => new Date());

  const weekEnd = useMemo(() => getSundayOfWeek(weekStart), [weekStart]);
  const monthStart = useMemo(() => getMonthStart(monthRef), [monthRef]);
  const monthEnd = useMemo(() => getMonthEnd(monthRef), [monthRef]);

  const rangeStart = viewMode === "week" ? weekStart : monthStart;
  const rangeEnd = viewMode === "week" ? weekEnd : monthEnd;

  const { data, isLoading } = trpc.jobs.weeklyReport.useQuery({
    weekStart: rangeStart.toISOString().slice(0, 10),
    weekEnd: rangeEnd.toISOString().slice(0, 10),
  }, { enabled: isAuthenticated });

  // £/mile target
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const upsertSettings = trpc.settings.upsert.useMutation({ onSuccess: () => refetchSettings() });
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const maxVal = useMemo(() => {
    if (!data?.days) return 100;
    return Math.max(...data.days.map(d => Math.max(d.earnings, d.netProfit)), 1);
  }, [data]);

  // Week navigation
  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const thisWeek = () => setWeekStart(getMondayOfWeek(new Date()));

  // Month navigation
  const prevMonth = () => { const d = new Date(monthRef); d.setMonth(d.getMonth() - 1); setMonthRef(d); };
  const nextMonth = () => { const d = new Date(monthRef); d.setMonth(d.getMonth() + 1); setMonthRef(d); };
  const thisMonth = () => setMonthRef(new Date());

  const isCurrentWeek = weekStart.toISOString().slice(0, 10) === getMondayOfWeek(new Date()).toISOString().slice(0, 10);
  const isCurrentMonth = monthRef.getFullYear() === new Date().getFullYear() && monthRef.getMonth() === new Date().getMonth();

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Date", "Route", "Fee (£)", "Fuel (£)", "Transport (£)", "Net Profit (£)", "Miles", "Broker", "Status"];
    const rows = data.jobs.map(j => [
      j.date ?? "", j.route, fmt(j.fee), fmt(j.fuel), fmt(j.transport), fmt(j.net), fmt(j.miles, 1), j.broker, j.status,
    ]);
    const totals = ["TOTAL", `${data.totals.jobCount} jobs`, fmt(data.totals.earnings), "", "", fmt(data.totals.netProfit), fmt(data.totals.miles, 1), "", ""];
    const csv = [headers, ...rows, totals].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pl-${viewMode}-${rangeStart.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${viewMode === "week" ? "Week" : "Month"} P&L exported as CSV`);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <BarChart3 size={40} className="text-muted-foreground" />
        <p className="text-muted-foreground text-center">Sign in to view your P&amp;L reports</p>
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
          <div className="flex items-center gap-2">
            {/* Week / Month toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setViewMode("week")}
                className={cn(
                  "px-3 py-1 rounded-md font-medium transition-all",
                  viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={cn(
                  "px-3 py-1 rounded-md font-medium transition-all",
                  viewMode === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Month
              </button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCSV} disabled={!data || data.jobs.length === 0}>
              <Download size={13} /> CSV
            </Button>
          </div>
        </div>

        {/* Navigator */}
        {viewMode === "week" ? (
          <div className="flex items-center justify-between mt-3">
            <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-secondary transition-colors"><ChevronLeft size={18} /></button>
            <div className="text-center">
              <div className="text-sm font-semibold">
                {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              {isCurrentWeek && <Badge variant="outline" className="text-[10px] mt-0.5 text-primary border-primary/30">This Week</Badge>}
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentWeek && <button onClick={thisWeek} className="text-[11px] text-primary px-2 py-1 rounded-lg hover:bg-primary/10">Today</button>}
              <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-secondary transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-3">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors"><ChevronLeft size={18} /></button>
            <div className="text-center">
              <div className="text-sm font-semibold">
                {monthRef.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </div>
              {isCurrentMonth && <Badge variant="outline" className="text-[10px] mt-0.5 text-primary border-primary/30">This Month</Badge>}
            </div>
            <div className="flex items-center gap-1">
              {!isCurrentMonth && <button onClick={thisMonth} className="text-[11px] text-primary px-2 py-1 rounded-lg hover:bg-primary/10">Today</button>}
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-secondary transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Earnings</div>
            <div className="text-base font-bold font-mono text-primary">{isLoading ? "…" : `£${fmt(totals?.earnings ?? 0, 0)}`}</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Net Profit</div>
            <div className={cn("text-base font-bold font-mono", (totals?.netProfit ?? 0) >= 0 ? "text-primary" : "text-destructive")}>
              {isLoading ? "…" : `${(totals?.netProfit ?? 0) >= 0 ? "+" : ""}£${fmt(totals?.netProfit ?? 0, 0)}`}
            </div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Jobs</div>
            <div className="text-base font-bold font-mono">{isLoading ? "…" : totals?.jobCount ?? 0}</div>
          </div>
        </div>

        {/* Additional stats */}
        <div className="grid grid-cols-3 gap-2">
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
          <div className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
            <Route size={16} className="text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted-foreground">£/mile</div>
              <div className={cn(
                "text-sm font-bold font-mono",
                !isLoading && (totals?.miles ?? 0) > 0
                  ? ((totals?.netProfit ?? 0) / (totals?.miles ?? 1)) >= (settingsData?.ppmTarget ?? 0.5)
                    ? "text-primary"
                    : "text-yellow-400"
                  : ""
              )}>
                {isLoading ? "…" : (totals?.miles ?? 0) > 0
                  ? `£${fmt((totals!.netProfit) / (totals!.miles), 2)}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* £/mile target progress bar */}
        {isAuthenticated && (totals?.miles ?? 0) > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Target size={13} className="text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">£/mile target</span>
              </div>
              {!editingTarget ? (
                <button
                  onClick={() => { setTargetInput(String(settingsData?.ppmTarget ?? 0.5)); setEditingTarget(true); }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={10} /> {settingsData?.ppmTarget != null ? `£${fmt(Number(settingsData.ppmTarget), 2)}/mi` : "Set target"}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">£</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="10"
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    className="h-6 w-16 text-[11px] px-1.5 py-0"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const v = parseFloat(targetInput);
                        if (!isNaN(v) && v >= 0) {
                          upsertSettings.mutate({ ppmTarget: v });
                          toast.success(`Target set to £${fmt(v, 2)}/mi`);
                        }
                        setEditingTarget(false);
                      } else if (e.key === "Escape") {
                        setEditingTarget(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const v = parseFloat(targetInput);
                      if (!isNaN(v) && v >= 0) {
                        upsertSettings.mutate({ ppmTarget: v });
                        toast.success(`Target set to £${fmt(v, 2)}/mi`);
                      }
                      setEditingTarget(false);
                    }}
                    className="p-0.5 rounded text-primary hover:bg-primary/10"
                  >
                    <Check size={12} />
                  </button>
                </div>
              )}
            </div>
            {(() => {
              const target = Number(settingsData?.ppmTarget ?? 0.5);
              const actual = (totals?.miles ?? 0) > 0 ? (totals!.netProfit) / (totals!.miles) : 0;
              const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
              const isOnTarget = actual >= target;
              return (
                <div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className={cn("h-2 rounded-full transition-all", isOnTarget ? "bg-primary" : "bg-yellow-400")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">£{fmt(actual, 2)}/mi actual</span>
                    <span className={cn("text-[10px] font-semibold", isOnTarget ? "text-primary" : "text-yellow-400")}>
                      {pct}% of £{fmt(target, 2)}/mi target
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Bar chart */}
        <div className="bg-card rounded-xl p-4 border border-border relative">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {viewMode === "week" ? "Daily Breakdown" : "Monthly Breakdown"}
            </span>
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : (data?.days?.length ?? 0) === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No jobs {viewMode === "week" ? "this week" : "this month"}
            </div>
          ) : (
            <BarChart days={data!.days} maxVal={maxVal} mode={viewMode} />
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
              {data!.jobs.map((j) => (
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
            <p className="text-muted-foreground text-sm">
              No jobs {viewMode === "week" ? "scheduled this week" : "recorded this month"}
            </p>
            <p className="text-muted-foreground/60 text-xs">
              Navigate to a different {viewMode} or add jobs to see your P&amp;L
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
