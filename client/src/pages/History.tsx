import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { History as HistoryIcon, TrendingUp, MapPin, ArrowDown, CheckCircle2, Clock, Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-secondary rounded-xl p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-bold font-mono", accent ? "text-primary" : "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function History() {
  const { isAuthenticated } = useAuth();
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  const { data: summary, isLoading } = trpc.history.summary.useQuery(
    { period },
    { enabled: isAuthenticated }
  );
  const { data: chartData } = trpc.history.dailyBreakdown.useQuery(
    { days: 30 },
    { enabled: isAuthenticated }
  );
  const { data: jobsData } = trpc.jobs.list.useQuery(
    { status: "completed", limit: 20 },
    { enabled: isAuthenticated }
  );

  const updateMutation = trpc.jobs.update.useMutation();

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <HistoryIcon size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Job History</h2>
          <p className="text-muted-foreground text-sm">Sign in to track your earnings and expenses</p>
        </div>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="w-full max-w-xs">
          Sign In to Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4">
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <HistoryIcon size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Job History</h1>
        </div>
        <p className="text-sm text-muted-foreground">Track your earnings and performance</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Period selector */}
        <div className="flex gap-2">
          {(["day", "week", "month"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Net Profit" value={`£${summary.totalNetProfit.toFixed(2)}`} accent />
            <StatCard label="Total Earnings" value={`£${summary.totalEarnings.toFixed(2)}`} />
            <StatCard label="Jobs Completed" value={summary.jobCount.toString()} sub={`${summary.totalMiles.toFixed(0)} miles total`} />
            <StatCard label="Profit / Hour" value={`£${summary.profitPerHour.toFixed(2)}`} sub="avg" />
          </div>
        )}

        {/* Earnings chart */}
        {chartData && chartData.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Daily Earnings (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "oklch(0.55 0.01 240)" }}
                    tickFormatter={d => d.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.01 240)" }} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.17 0.018 240)", border: "1px solid oklch(0.28 0.02 240)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`£${value.toFixed(2)}`, ""]}
                  />
                  <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.profit >= 0 ? "oklch(0.72 0.2 142)" : "oklch(0.62 0.22 25)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Job list */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Completed Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(jobsData?.jobs ?? []).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No completed jobs yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Jobs you mark as complete will appear here.</p>
              </div>
            ) : (
              (jobsData?.jobs ?? []).map(job => (
                <div key={job.id} className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <span>{job.pickupPostcode}</span>
                      <ArrowDown size={10} className="text-muted-foreground rotate-[-90deg]" />
                      <span>{job.dropoffPostcode}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">£{job.deliveryFee.toFixed(2)}</span>
                      {job.estimatedDistanceMiles && (
                        <span className="text-xs text-muted-foreground">{job.estimatedDistanceMiles.toFixed(1)} mi</span>
                      )}
                      {job.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  {job.actualNetProfit != null || job.estimatedNetProfit != null ? (
                    <span className={cn("text-sm font-bold font-mono",
                      (job.actualNetProfit ?? job.estimatedNetProfit ?? 0) >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      £{(job.actualNetProfit ?? job.estimatedNetProfit ?? 0).toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
