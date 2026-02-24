import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Link2, Plus, Trash2, ArrowDown, Train, Bus, Car, Footprints,
  AlertTriangle, TrendingUp, Clock, MapPin, PoundSterling, Save, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Safe number formatter — prevents crashes when TiDB returns decimals as strings
function fmt(val: unknown, decimals = 2): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0." + "0".repeat(decimals);
  return n.toFixed(decimals);
}

const modeIcons: Record<string, React.ReactNode> = {
  train: <Train size={14} />,
  bus: <Bus size={14} />,
  tram: <Train size={14} />,
  taxi: <Car size={14} />,
  walk: <Footprints size={14} />,
  drive: <Car size={14} />,
  scooter: <Car size={14} />,
};

const modeColors: Record<string, string> = {
  train: "text-blue-400",
  bus: "text-green-400",
  tram: "text-purple-400",
  taxi: "text-yellow-400",
  walk: "text-gray-400",
  drive: "text-orange-400",
};

export default function ChainPlanner() {
  const { isAuthenticated } = useAuth();
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [chainResult, setChainResult] = useState<{
    jobs: Array<{ id: number; pickupPostcode: string; dropoffPostcode: string; deliveryFee: number; estimatedNetProfit?: number | null; estimatedDistanceMiles?: number | null; estimatedDurationMins?: number | null }>;
    repositionLegs: Array<{
      fromPostcode: string;
      toPostcode: string;
      options: Array<{ mode: string; durationMins: number; cost: number; operator?: string; changes?: number; departureTime?: string; arrivalTime?: string }>;
      noTransitZone: boolean;
      riskFlags: string[];
    }>;
    summary: {
      totalEarnings: number;
      totalRepositionCost: number;
      totalFuelCost: number;
      totalBrokerFees: number;
      totalTimeValue: number;
      totalWearTear: number;
      totalCosts: number;
      totalNetProfit: number;
      totalDurationMins: number;
      totalDistanceMiles: number;
      profitPerHour: number;
      riskFlags: string[];
    };
  } | null>(null);

  const { data: jobsData } = trpc.jobs.list.useQuery(
    { status: "planned", limit: 20 },
    { enabled: isAuthenticated }
  );

  const planMutation = trpc.chains.plan.useMutation();
  const createChainMutation = trpc.chains.create.useMutation();
  const shareMutation = trpc.chains.share.useMutation();

  const plannedJobs = jobsData?.jobs ?? [];

  const toggleJob = (id: number) => {
    setSelectedJobIds(prev => {
      if (prev.includes(id)) return prev.filter(j => j !== id);
      if (prev.length >= 3) {
        toast.error("Maximum 3 jobs per chain");
        return prev;
      }
      return [...prev, id];
    });
    setChainResult(null);
  };

  const handlePlanChain = async () => {
    if (selectedJobIds.length < 2) {
      toast.error("Select at least 2 jobs to plan a chain");
      return;
    }
    try {
      const result = await planMutation.mutateAsync({ jobIds: selectedJobIds });
      setChainResult(result as typeof chainResult);
    } catch {
      toast.error("Failed to plan chain. Please try again.");
    }
  };

  const handleSaveChain = async () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!chainResult) return;
    try {
      const res = await createChainMutation.mutateAsync({
        jobIds: selectedJobIds,
        repositionLegs: chainResult.repositionLegs,
        summary: chainResult.summary,
      });
      toast.success("Chain saved!");
    } catch {
      toast.error("Failed to save chain");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Link2 size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Chain Planner</h2>
          <p className="text-muted-foreground text-sm">Sign in to plan multi-job chains with public transport routes</p>
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
            <Link2 size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Chain Planner</h1>
        </div>
        <p className="text-sm text-muted-foreground">Link 2–3 jobs with public transport repositioning</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Job selector */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Select Jobs ({selectedJobIds.length}/3)
              </CardTitle>
              {selectedJobIds.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedJobIds([]); setChainResult(null); }}
                  className="text-xs text-muted-foreground h-7">
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {plannedJobs.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No planned jobs yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add jobs in the Calculator tab first.</p>
              </div>
            ) : (
              plannedJobs.map(job => {
                const isSelected = selectedJobIds.includes(job.id);
                const position = selectedJobIds.indexOf(job.id) + 1;
                return (
                  <button
                    key={job.id}
                    onClick={() => toggleJob(job.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      isSelected
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-secondary/50 hover:border-border/80"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {isSelected ? position : "+"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <span>{job.pickupPostcode}</span>
                          <ArrowDown size={12} className="text-muted-foreground rotate-[-90deg]" />
                          <span>{job.dropoffPostcode}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">£{fmt(job.deliveryFee)}</span>
                          {job.estimatedDistanceMiles && (
                            <span className="text-xs text-muted-foreground">{fmt(job.estimatedDistanceMiles, 1)} mi</span>
                          )}
                          {job.estimatedNetProfit != null && (
                            <span className={cn("text-xs font-medium",
                              job.estimatedNetProfit >= 0 ? "text-primary" : "text-destructive"
                            )}>
                              {Number(job.estimatedNetProfit) >= 0 ? "+" : ""}£{fmt(job.estimatedNetProfit)} profit
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {selectedJobIds.length >= 2 && (
          <Button
            onClick={handlePlanChain}
            disabled={planMutation.isPending}
            className="w-full h-12 font-semibold"
          >
            {planMutation.isPending ? "Planning Chain..." : `Plan Chain (${selectedJobIds.length} jobs)`}
          </Button>
        )}

        {/* Chain Result */}
        {chainResult && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Chain visualisation */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Chain Route
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {chainResult.jobs.map((job, idx) => (
                    <div key={job.id}>
                      {/* Job leg */}
                      <div className="flex items-start gap-3 py-2">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Car size={14} className="text-primary" />
                          </div>
                          {idx < chainResult.jobs.length - 1 && (
                            <div className="w-0.5 h-4 bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <MapPin size={12} className="text-muted-foreground" />
                            <span>{job.pickupPostcode}</span>
                            <ArrowDown size={10} className="text-muted-foreground rotate-[-90deg]" />
                            <span>{job.dropoffPostcode}</span>
                          </div>
                          <div className="flex gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">£{fmt(job.deliveryFee)}</span>
                            {job.estimatedDistanceMiles && (
                              <span className="text-xs text-muted-foreground">{fmt(job.estimatedDistanceMiles, 1)} mi</span>
                            )}
                          </div>
                        </div>
                        {job.estimatedNetProfit != null && (
                          <span className={cn("text-sm font-bold font-mono",
                            job.estimatedNetProfit >= 0 ? "text-primary" : "text-destructive"
                          )}>
                            £{fmt(job.estimatedNetProfit)}
                          </span>
                        )}
                      </div>

                      {/* Reposition leg */}
                      {idx < chainResult.repositionLegs.length && chainResult.repositionLegs[idx] && (
                        <div className="flex items-start gap-3 py-1.5">
                          <div className="flex flex-col items-center">
                            <div className="w-0.5 h-2 bg-border" />
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              {modeIcons[chainResult.repositionLegs[idx]!.options[0]?.mode ?? "train"] ?? <Train size={12} />}
                            </div>
                            <div className="w-0.5 h-2 bg-border" />
                          </div>
                          <div className="flex-1">
                            <div className="bg-secondary rounded-lg p-2.5">
                              <p className="text-xs text-muted-foreground mb-1.5">Reposition options:</p>
                              <div className="space-y-1.5">
                                {chainResult.repositionLegs[idx]!.options.slice(0, 3).map((opt, oi) => (
                                  <div key={oi} className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn("flex items-center gap-1 text-xs font-medium", modeColors[opt.mode] ?? "text-foreground")}>
                                        {modeIcons[opt.mode]}
                                        {opt.mode.charAt(0).toUpperCase() + opt.mode.slice(1)}
                                      </span>
                                      {opt.operator && <span className="text-xs text-muted-foreground">({opt.operator})</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-muted-foreground">{Math.round(opt.durationMins)} min</span>
                                      <span className="font-medium text-foreground">£{fmt(opt.cost)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {chainResult.repositionLegs[idx]!.noTransitZone && (
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-yellow-400">
                                  <AlertTriangle size={12} />
                                  Rural area — limited public transport
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chain summary */}
            <Card className="bg-card border-border overflow-hidden">
              <div className={cn(
                "h-1.5",
                chainResult.summary.totalNetProfit > 0 ? "bg-[oklch(0.72_0.2_142)]" : "bg-[oklch(0.62_0.22_25)]"
              )} />
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Chain Net Profit</p>
                    <p className={cn(
                      "text-4xl font-bold font-mono profit-glow",
                      chainResult.summary.totalNetProfit >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {Number(chainResult.summary.totalNetProfit) >= 0 ? "+" : ""}£{fmt(chainResult.summary.totalNetProfit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">£/hr</p>
                    <p className="text-xl font-bold font-mono text-foreground">
                      £{fmt(chainResult.summary.profitPerHour)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "Total Earnings", value: `£${fmt(chainResult.summary.totalEarnings)}`, positive: true },
                    { label: "Reposition Cost", value: `£${fmt(chainResult.summary.totalRepositionCost)}`, positive: false },
                    { label: "Total Distance", value: `${fmt(chainResult.summary.totalDistanceMiles, 1)} mi`, positive: null },
                    { label: "Broker Fees", value: `£${fmt(chainResult.summary.totalBrokerFees)}`, positive: false },
                  ].map(item => (
                    <div key={item.label} className="bg-secondary rounded-lg p-2.5">
                      <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                      <p className={cn("text-sm font-bold font-mono",
                        item.positive === true ? "text-primary" :
                        item.positive === false ? "text-foreground" : "text-foreground"
                      )}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                {chainResult.summary.totalFuelCost > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground mb-3 px-0.5">
                    <span className="flex items-center gap-1">Fuel Cost <span className="text-blue-400">(claimed back)</span></span>
                    <span className="font-mono">£{fmt(chainResult.summary.totalFuelCost)}</span>
                  </div>
                )}

                {/* Risk flags */}
                {chainResult.summary.riskFlags.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {chainResult.summary.riskFlags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-3 py-2">
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSaveChain} disabled={createChainMutation.isPending} className="flex-1">
                    <Save size={16} className="mr-2" />
                    {createChainMutation.isPending ? "Saving..." : "Save Chain"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
