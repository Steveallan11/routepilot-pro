import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { CalendarDays, Car, Train, ArrowDown, MapPin, Clock, PoundSterling, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DayPlanner() {
  const { isAuthenticated } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]!);

  const { data: jobsData, refetch } = trpc.jobs.list.useQuery(
    { status: "planned", limit: 20 },
    { enabled: isAuthenticated }
  );
  const { data: chainsData } = trpc.chains.list.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated }
  );

  const updateMutation = trpc.jobs.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Job status updated!"); },
  });

  const plannedJobs = (jobsData?.jobs ?? []).filter(j => {
    if (!j.scheduledPickupAt) return true;
    return j.scheduledPickupAt.toISOString?.()?.startsWith(selectedDate) ?? true;
  });

  const todayChains = (chainsData?.chains ?? []).filter(c => {
    if (!c.scheduledDate) return false;
    return c.scheduledDate.toISOString?.()?.startsWith(selectedDate) ?? false;
  });

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarDays size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Day Planner</h2>
          <p className="text-muted-foreground text-sm">Sign in to view and manage your daily job schedule</p>
        </div>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="w-full max-w-xs">
          Sign In to Continue
        </Button>
      </div>
    );
  }

  const totalEstimatedEarnings = plannedJobs.reduce((sum, j) => sum + j.deliveryFee, 0);
  const totalEstimatedProfit = plannedJobs.reduce((sum, j) => sum + (j.estimatedNetProfit ?? 0), 0);
  const totalEstimatedMins = plannedJobs.reduce((sum, j) => sum + (j.estimatedDurationMins ?? 0), 0);

  return (
    <div className="pb-24 pt-4">
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <CalendarDays size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Day Planner</h1>
        </div>
        <p className="text-sm text-muted-foreground">Your planned jobs and chains for today</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Date selector */}
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
        />

        {/* Day summary */}
        {plannedJobs.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Jobs</p>
              <p className="text-xl font-bold text-foreground">{plannedJobs.length}</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Est. Profit</p>
              <p className={cn("text-xl font-bold font-mono", totalEstimatedProfit >= 0 ? "text-primary" : "text-destructive")}>
                £{totalEstimatedProfit.toFixed(0)}
              </p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Drive Time</p>
              <p className="text-xl font-bold text-foreground">{Math.round(totalEstimatedMins / 60)}h</p>
            </div>
          </div>
        )}

        {/* Chains for today */}
        {todayChains.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Planned Chains
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayChains.map(chain => (
                <div key={chain.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{chain.name ?? "Unnamed Chain"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {chain.totalNetProfit != null && `£${chain.totalNetProfit.toFixed(2)} profit · `}
                      {chain.totalDurationMins != null && `${Math.round(chain.totalDurationMins / 60)}h total`}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold font-mono",
                    (chain.totalNetProfit ?? 0) >= 0 ? "text-primary" : "text-destructive"
                  )}>
                    £{(chain.totalNetProfit ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Job Timeline
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs text-muted-foreground">
                <RefreshCw size={12} className="mr-1" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {plannedJobs.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No planned jobs for this day.</p>
                <p className="text-xs text-muted-foreground mt-1">Add jobs in the Calculator tab and they'll appear here.</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />

                <div className="space-y-4">
                  {plannedJobs.map((job, idx) => (
                    <div key={job.id} className="flex gap-4 relative">
                      {/* Timeline dot */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10",
                        job.status === "completed" ? "bg-primary/30" : "bg-card border-2 border-primary/40"
                      )}>
                        {job.status === "completed"
                          ? <CheckCircle2 size={16} className="text-primary" />
                          : <Car size={14} className="text-primary" />
                        }
                      </div>

                      {/* Job card */}
                      <div className="flex-1 bg-secondary rounded-xl p-3 mb-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold">
                              <span>{job.pickupPostcode}</span>
                              <ArrowDown size={10} className="text-muted-foreground rotate-[-90deg]" />
                              <span>{job.dropoffPostcode}</span>
                            </div>
                            {job.scheduledPickupAt && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                <Clock size={10} className="inline mr-1" />
                                {new Date(job.scheduledPickupAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold font-mono text-primary">
                              £{job.deliveryFee.toFixed(2)}
                            </p>
                            {job.estimatedNetProfit != null && (
                              <p className={cn("text-xs font-mono",
                                job.estimatedNetProfit >= 0 ? "text-primary/70" : "text-destructive/70"
                              )}>
                                {job.estimatedNetProfit >= 0 ? "+" : ""}£{job.estimatedNetProfit.toFixed(2)} net
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          {job.estimatedDistanceMiles && <span>{job.estimatedDistanceMiles.toFixed(1)} mi</span>}
                          {job.estimatedDurationMins && <span>{Math.round(job.estimatedDurationMins)} min</span>}
                          {job.worthItScore && (
                            <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium",
                              job.worthItScore === "green" ? "badge-green" :
                              job.worthItScore === "amber" ? "badge-amber" : "badge-red"
                            )}>
                              {job.worthItScore === "green" ? "Worth It" : job.worthItScore === "amber" ? "Marginal" : "Not Worth It"}
                            </span>
                          )}
                        </div>

                        {/* Quick actions */}
                        {job.status === "planned" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs border-border"
                              onClick={() => updateMutation.mutate({ id: job.id, status: "active" })}
                            >
                              Start Job
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => updateMutation.mutate({ id: job.id, status: "completed" })}
                            >
                              Complete
                            </Button>
                          </div>
                        )}
                        {job.status === "active" && (
                          <Button
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={() => updateMutation.mutate({ id: job.id, status: "completed" })}
                          >
                            <CheckCircle2 size={12} className="mr-1" /> Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
