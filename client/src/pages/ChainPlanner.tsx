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
  Link2, Plus, Trash2, ArrowRight, Train, Bus, Car, Footprints,
  AlertTriangle, TrendingUp, Clock, MapPin, PoundSterling, Save,
  ChevronDown, ChevronUp, Home, Navigation, Check
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

type TransportOption = {
  mode: string;
  durationMins: number;
  cost: number;
  operator?: string;
  changes?: number;
  departureTime?: string;
  arrivalTime?: string;
};

type TransportLeg = {
  fromPostcode: string;
  toPostcode: string;
  legType: "homeToPickup" | "reposition" | "homeReturn";
  options: TransportOption[];
  selectedOptionIndex: number;
  noTransitZone: boolean;
};

type ChainJob = {
  id: number;
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: number | string;
  estimatedNetProfit?: number | string | null;
  estimatedDistanceMiles?: number | string | null;
  estimatedDurationMins?: number | string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleReg?: string | null;
  brokerName?: string | null;
};

type ChainResult = {
  jobs: ChainJob[];
  transportLegs: TransportLeg[];
  homePostcode: string;
  summary: {
    totalEarnings: number;
    totalTransportCost: number;
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
};

// Expandable transport leg card
function TransportLegCard({
  leg,
  legIndex,
  label,
  onSelectOption,
}: {
  leg: TransportLeg;
  legIndex: number;
  label: string;
  onSelectOption: (legIndex: number, optionIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedOpt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];

  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-3 bg-border" />
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
          {modeIcons[selectedOpt?.mode ?? "train"] ?? <Train size={13} />}
        </div>
        <div className="w-0.5 h-3 bg-border" />
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-left"
        >
          <div className="bg-secondary/70 border border-border/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
              <div className="flex items-center gap-1.5">
                {selectedOpt && (
                  <span className="text-xs font-bold text-foreground font-mono">£{fmt(selectedOpt.cost)}</span>
                )}
                {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={11} />
              <span className="font-mono">{leg.fromPostcode}</span>
              <ArrowRight size={10} />
              <span className="font-mono">{leg.toPostcode}</span>
            </div>
            {selectedOpt && (
              <div className="flex items-center gap-3 mt-1.5">
                <span className={cn("flex items-center gap-1 text-xs font-semibold", modeColors[selectedOpt.mode] ?? "text-foreground")}>
                  {modeIcons[selectedOpt.mode]}
                  {selectedOpt.mode.charAt(0).toUpperCase() + selectedOpt.mode.slice(1)}
                  {selectedOpt.operator && <span className="text-muted-foreground font-normal">· {selectedOpt.operator}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{Math.round(selectedOpt.durationMins)} min</span>
                {selectedOpt.departureTime && selectedOpt.departureTime !== "On demand" && (
                  <span className="text-xs text-muted-foreground">{selectedOpt.departureTime} → {selectedOpt.arrivalTime}</span>
                )}
              </div>
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-1.5 bg-secondary/40 border border-border/40 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-muted-foreground font-semibold mb-2">Choose transport option:</p>
            {leg.options.map((opt, oi) => {
              const isSelected = oi === leg.selectedOptionIndex;
              return (
                <button
                  key={oi}
                  onClick={() => { onSelectOption(legIndex, oi); setExpanded(false); }}
                  className={cn(
                    "w-full text-left rounded-lg p-2.5 border transition-all",
                    isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/50 bg-secondary/50 hover:border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSelected && <Check size={12} className="text-primary" />}
                      <span className={cn("flex items-center gap-1 text-xs font-semibold", modeColors[opt.mode] ?? "text-foreground")}>
                        {modeIcons[opt.mode]}
                        {opt.mode.charAt(0).toUpperCase() + opt.mode.slice(1)}
                      </span>
                      {opt.operator && <span className="text-xs text-muted-foreground">{opt.operator}</span>}
                      {opt.changes != null && opt.changes > 0 && (
                        <span className="text-xs text-muted-foreground">{opt.changes} change{opt.changes > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{Math.round(opt.durationMins)} min</span>
                      <span className="font-bold font-mono text-foreground">£{fmt(opt.cost)}</span>
                    </div>
                  </div>
                  {opt.departureTime && opt.departureTime !== "On demand" && (
                    <div className="text-xs text-muted-foreground mt-1 ml-5">
                      {opt.departureTime} → {opt.arrivalTime}
                    </div>
                  )}
                </button>
              );
            })}
            {leg.noTransitZone && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-2 py-1.5">
                <AlertTriangle size={11} />
                Rural area — limited public transport
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Drive leg card
function DriveLegCard({ job, jobIndex }: { job: ChainJob; jobIndex: number }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Car size={14} className="text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Drive Job {jobIndex + 1}</span>
            <span className="text-sm font-bold font-mono text-primary">+£{fmt(job.deliveryFee)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
            <MapPin size={12} className="text-muted-foreground" />
            <span className="font-mono">{job.pickupPostcode}</span>
            <ArrowRight size={11} className="text-muted-foreground" />
            <span className="font-mono">{job.dropoffPostcode}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {job.estimatedDistanceMiles && (
              <span>{fmt(job.estimatedDistanceMiles, 1)} mi</span>
            )}
            {job.estimatedDurationMins && (
              <span>{Math.round(Number(job.estimatedDurationMins))} min drive</span>
            )}
            {job.vehicleMake && (
              <span>{job.vehicleMake}{job.vehicleModel ? ` ${job.vehicleModel}` : ""}{job.vehicleReg ? ` · ${job.vehicleReg}` : ""}</span>
            )}
            {job.brokerName && <span>· {job.brokerName}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChainPlanner() {
  const { isAuthenticated } = useAuth();
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
  const [chainResult, setChainResult] = useState<ChainResult | null>(null);
  const [legSelections, setLegSelections] = useState<Array<{ legIndex: number; optionIndex: number }>>([]);

  const { data: jobsData } = trpc.jobs.list.useQuery(
    { status: "planned", limit: 20 },
    { enabled: isAuthenticated }
  );

  const planMutation = trpc.chains.plan.useMutation();
  const createChainMutation = trpc.chains.create.useMutation();

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
    setLegSelections([]);
  };

  const handlePlanChain = async (selections?: typeof legSelections) => {
    if (selectedJobIds.length < 2) {
      toast.error("Select at least 2 jobs to plan a chain");
      return;
    }
    try {
      const result = await planMutation.mutateAsync({
        jobIds: selectedJobIds,
        legSelections: selections,
      });
      setChainResult(result as ChainResult);
    } catch {
      toast.error("Failed to plan chain. Please try again.");
    }
  };

  const handleSelectOption = (legIndex: number, optionIndex: number) => {
    const newSelections = [
      ...legSelections.filter(s => s.legIndex !== legIndex),
      { legIndex, optionIndex },
    ];
    setLegSelections(newSelections);
    // Update local state immediately for instant feedback
    setChainResult(prev => {
      if (!prev) return prev;
      const updatedLegs = prev.transportLegs.map((leg, i) =>
        i === legIndex ? { ...leg, selectedOptionIndex: optionIndex } : leg
      );
      // Recalculate transport total
      let totalTransportCost = 0;
      let totalTransportMins = 0;
      for (const leg of updatedLegs) {
        const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
        if (opt) {
          totalTransportCost += opt.cost;
          totalTransportMins += opt.durationMins;
        }
      }
      const totalBrokerFees = Number(prev.summary.totalBrokerFees);
      const totalEarnings = Number(prev.summary.totalEarnings);
      const totalCosts = totalBrokerFees + totalTransportCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const baseDriveMins = Number(prev.summary.totalDurationMins) -
        prev.transportLegs.reduce((s, leg) => {
          const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
          return s + (opt?.durationMins ?? 0);
        }, 0);
      const totalDurationMins = baseDriveMins + totalTransportMins;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;
      return {
        ...prev,
        transportLegs: updatedLegs,
        summary: {
          ...prev.summary,
          totalTransportCost,
          totalCosts,
          totalNetProfit,
          totalDurationMins,
          profitPerHour,
        },
      };
    });
  };

  const handleSaveChain = async () => {
    if (!chainResult) return;
    try {
      await createChainMutation.mutateAsync({
        jobIds: selectedJobIds,
        transportLegs: chainResult.transportLegs,
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

  // Build the interleaved timeline from chain result
  const buildTimeline = (result: ChainResult) => {
    const items: Array<
      | { type: "homeStart"; postcode: string }
      | { type: "transport"; leg: TransportLeg; legIndex: number; label: string }
      | { type: "drive"; job: ChainJob; jobIndex: number }
      | { type: "homeEnd"; postcode: string }
    > = [];

    let transportLegIndex = 0;

    // Home start node
    if (result.homePostcode) {
      items.push({ type: "homeStart", postcode: result.homePostcode });
    }

    // Home → first pickup transport leg
    const homeToPickup = result.transportLegs.find(l => l.legType === "homeToPickup");
    if (homeToPickup) {
      items.push({ type: "transport", leg: homeToPickup, legIndex: transportLegIndex++, label: "Travel to first pickup" });
    }

    // For each job: drive leg, then reposition (if not last)
    for (let i = 0; i < result.jobs.length; i++) {
      items.push({ type: "drive", job: result.jobs[i]!, jobIndex: i });

      if (i < result.jobs.length - 1) {
        const repoLeg = result.transportLegs.find((l, li) => l.legType === "reposition" && li === transportLegIndex);
        if (repoLeg) {
          items.push({ type: "transport", leg: repoLeg, legIndex: transportLegIndex++, label: `Reposition to Job ${i + 2}` });
        }
      }
    }

    // Last dropoff → home transport leg
    const homeReturn = result.transportLegs.find(l => l.legType === "homeReturn");
    if (homeReturn) {
      items.push({ type: "transport", leg: homeReturn, legIndex: transportLegIndex++, label: "Return home" });
    }

    // Home end node
    if (result.homePostcode) {
      items.push({ type: "homeEnd", postcode: result.homePostcode });
    }

    return items;
  };

  return (
    <div className="pb-24 pt-4">
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Link2 size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Chain Planner</h1>
        </div>
        <p className="text-sm text-muted-foreground">Full door-to-door route with all travel costs</p>
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
                <Button variant="ghost" size="sm" onClick={() => { setSelectedJobIds([]); setChainResult(null); setLegSelections([]); }}
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
                <p className="text-xs text-muted-foreground mt-1">Add jobs in the Jobs tab first.</p>
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
                          <span className="font-mono">{job.pickupPostcode}</span>
                          <ArrowRight size={11} className="text-muted-foreground" />
                          <span className="font-mono">{job.dropoffPostcode}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">£{fmt(job.deliveryFee)}</span>
                          {job.estimatedDistanceMiles && (
                            <span className="text-xs text-muted-foreground">{fmt(job.estimatedDistanceMiles, 1)} mi</span>
                          )}
                          {job.estimatedNetProfit != null && (
                            <span className={cn("text-xs font-medium",
                              Number(job.estimatedNetProfit) >= 0 ? "text-primary" : "text-destructive"
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
            onClick={() => handlePlanChain()}
            disabled={planMutation.isPending}
            className="w-full h-12 font-semibold"
          >
            {planMutation.isPending ? "Planning Route..." : `Plan Chain (${selectedJobIds.length} jobs)`}
          </Button>
        )}

        {/* Chain Result */}
        {chainResult && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Full door-to-door timeline */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Full Journey
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="space-y-0">
                  {buildTimeline(chainResult).map((item, idx) => {
                    if (item.type === "homeStart" || item.type === "homeEnd") {
                      return (
                        <div key={idx} className="flex items-center gap-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                            <Home size={13} className="text-muted-foreground" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">{item.type === "homeStart" ? "Start from home" : "Return home"}</span>
                            <p className="text-sm font-mono font-medium">{item.postcode}</p>
                          </div>
                        </div>
                      );
                    }
                    if (item.type === "transport") {
                      return (
                        <TransportLegCard
                          key={idx}
                          leg={item.leg}
                          legIndex={item.legIndex}
                          label={item.label}
                          onSelectOption={handleSelectOption}
                        />
                      );
                    }
                    if (item.type === "drive") {
                      return (
                        <DriveLegCard key={idx} job={item.job} jobIndex={item.jobIndex} />
                      );
                    }
                    return null;
                  })}
                </div>

                {!chainResult.homePostcode && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} />
                    Set your home postcode in Settings to see home travel legs
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary card */}
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

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { label: "Total Earnings", value: `£${fmt(chainResult.summary.totalEarnings)}`, positive: true },
                    { label: "Travel Costs", value: `£${fmt(chainResult.summary.totalTransportCost)}`, positive: false },
                    { label: "Total Distance", value: `${fmt(chainResult.summary.totalDistanceMiles, 1)} mi`, positive: null },
                    { label: "Broker Fees", value: `£${fmt(chainResult.summary.totalBrokerFees)}`, positive: false },
                  ].map(item => (
                    <div key={item.label} className="bg-secondary rounded-lg p-2.5">
                      <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-sm font-bold font-mono text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>

                {chainResult.summary.totalFuelCost > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground mb-3 px-0.5">
                    <span className="flex items-center gap-1">Fuel Cost <span className="text-blue-400">(claimed back)</span></span>
                    <span className="font-mono">£{fmt(chainResult.summary.totalFuelCost)}</span>
                  </div>
                )}

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

                <Button onClick={handleSaveChain} disabled={createChainMutation.isPending} className="w-full">
                  <Save size={16} className="mr-2" />
                  {createChainMutation.isPending ? "Saving..." : "Save Chain"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
