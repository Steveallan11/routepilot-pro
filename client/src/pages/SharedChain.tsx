import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Car, Train, Bus, Footprints, Navigation, MapPin, ArrowRight, Clock, AlertTriangle, Bike, Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(v: number | string | null | undefined, decimals = 2): string {
  const n = Number(v ?? 0);
  return isNaN(n) ? "0.00" : n.toFixed(decimals);
}

const modeIcons: Record<string, React.ReactNode> = {
  WALK: <Footprints size={13} />, Walk: <Footprints size={13} />, walk: <Footprints size={13} />,
  BUS: <Bus size={13} />, Bus: <Bus size={13} />, bus: <Bus size={13} />,
  TRAIN: <Train size={13} />, Train: <Train size={13} />, train: <Train size={13} />,
  TRAM: <Train size={13} />, tram: <Train size={13} />,
  SUBWAY: <Train size={13} />, subway: <Train size={13} />,
  TAXI: <Car size={13} />, Taxi: <Car size={13} />, taxi: <Car size={13} />,
  SCOOTER: <Bike size={13} />, Scooter: <Bike size={13} />, scooter: <Bike size={13} />,
  FERRY: <Anchor size={13} />, Ferry: <Anchor size={13} />, ferry: <Anchor size={13} />,
};

const modeColors: Record<string, string> = {
  WALK: "text-gray-400", Walk: "text-gray-400", walk: "text-gray-400",
  BUS: "text-green-400", Bus: "text-green-400", bus: "text-green-400",
  TRAIN: "text-blue-400", Train: "text-blue-400", train: "text-blue-400",
  TRAM: "text-purple-400", tram: "text-purple-400",
  SUBWAY: "text-indigo-400", subway: "text-indigo-400",
  TAXI: "text-yellow-400", Taxi: "text-yellow-400", taxi: "text-yellow-400",
  SCOOTER: "text-orange-400", Scooter: "text-orange-400", scooter: "text-orange-400",
  FERRY: "text-cyan-400", Ferry: "text-cyan-400", ferry: "text-cyan-400",
};

export default function SharedChain() {
  const [, params] = useRoute("/chain/:token");
  const token = params?.token ?? "";

  const { data, isLoading, error } = trpc.chainsPublic.getShared.useQuery(
    { token },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading chain plan…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle size={32} className="text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Link not found or expired</h2>
          <p className="text-sm text-muted-foreground">
            This chain plan link may have expired (links last 7 days) or been removed.
          </p>
        </div>
      </div>
    );
  }

  const { chain, jobs } = data;
  const transportLegs = (chain.transportLegs as any[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">RoutePilot Pro</p>
            <h1 className="text-base font-bold text-foreground">{chain.name ?? "Chain Plan"}</h1>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">Read-only</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Summary card */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">Chain Summary</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-primary font-mono">£{fmt(chain.totalNetProfit)}</p>
              <p className="text-[10px] text-muted-foreground">Net Profit</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground font-mono">£{fmt(chain.totalEarnings)}</p>
              <p className="text-[10px] text-muted-foreground">Gross</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground font-mono">£{fmt(chain.profitPerHour)}/hr</p>
              <p className="text-[10px] text-muted-foreground">Profit/hr</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock size={11} /> {Math.round(Number(chain.totalDurationMins ?? 0))} min total</span>
            <span>{fmt(chain.totalDistanceMiles, 1)} mi</span>
            <span>Transport: £{fmt(chain.totalCosts)}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-1">
          {jobs.map((job, ji) => {
            const scheduledTime = job.scheduledPickupAt
              ? new Date(job.scheduledPickupAt as unknown as string).toLocaleString("en-GB", {
                  weekday: "short", day: "numeric", month: "short",
                  hour: "2-digit", minute: "2-digit",
                })
              : null;

            // Transport leg before this job
            const legBefore = transportLegs[ji];

            return (
              <div key={job.id}>
                {/* Transport leg before this job */}
                {legBefore && (
                  <div className="flex items-start gap-3 py-1.5">
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-border mx-auto" />
                      <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center">
                        <Train size={13} className="text-muted-foreground" />
                      </div>
                      <div className="w-0.5 h-3 bg-border mx-auto" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="bg-secondary/70 border border-border/50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {ji === 0 ? "Home → Pickup" : `Reposition to Job ${ji + 1}`}
                          </span>
                          <span className="text-xs font-bold font-mono">
                            £{fmt((legBefore as any).options?.[(legBefore as any).selectedOptionIndex ?? 0]?.cost ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin size={11} />
                          <span className="font-mono">{(legBefore as any).fromPostcode}</span>
                          <ArrowRight size={10} />
                          <span className="font-mono">{(legBefore as any).toPostcode}</span>
                        </div>
                        {/* Steps */}
                        {(() => {
                          const opt = (legBefore as any).options?.[(legBefore as any).selectedOptionIndex ?? 0];
                          const steps: any[] = opt?.steps ?? [];
                          return steps.length > 0 ? (
                            <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                              {steps.map((step: any, si: number) => (
                                <div key={si} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className={cn("shrink-0", modeColors[step.mode] ?? "text-foreground")}>
                                    {modeIcons[step.mode] ?? <Navigation size={11} />}
                                  </span>
                                  <span className="flex-1 truncate">{step.instruction}</span>
                                  <span className="font-mono shrink-0">{step.durationMins}m</span>
                                  {(step.cost ?? 0) > 0 && (
                                    <span className="font-mono shrink-0 text-primary/80">£{fmt(step.cost)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Drive job */}
                <div className="flex items-start gap-3 py-1.5">
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <Car size={14} className="text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Drive Job {ji + 1}</span>
                        <span className="text-sm font-bold font-mono text-primary">+£{fmt(job.deliveryFee)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
                        <MapPin size={12} className="text-muted-foreground" />
                        <span className="font-mono">{job.pickupPostcode}</span>
                        <ArrowRight size={11} className="text-muted-foreground" />
                        <span className="font-mono">{job.dropoffPostcode}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {scheduledTime && (
                          <span className="flex items-center gap-1 text-primary/80 font-medium">
                            <Clock size={10} /> Pickup {scheduledTime}
                          </span>
                        )}
                        {(job.estimatedDistanceMiles ?? 0) > 0 && (
                          <span>{fmt(job.estimatedDistanceMiles, 1)} mi</span>
                        )}
                        {(job.estimatedDurationMins ?? 0) > 0 && (
                          <span>{Math.round(Number(job.estimatedDurationMins))} min drive</span>
                        )}
                        {job.vehicleMake && (
                          <span>{job.vehicleMake} {job.vehicleModel}</span>
                        )}
                        {job.brokerName && <span>· {job.brokerName}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Home return leg */}
          {transportLegs[jobs.length] && (
            <div className="flex items-start gap-3 py-1.5">
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-3 bg-border mx-auto" />
                <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center">
                  <Train size={13} className="text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="bg-secondary/70 border border-border/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Return Home</span>
                    <span className="text-xs font-bold font-mono">
                      £{fmt((transportLegs[jobs.length] as any).options?.[(transportLegs[jobs.length] as any).selectedOptionIndex ?? 0]?.cost ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    <span className="font-mono">{(transportLegs[jobs.length] as any).fromPostcode}</span>
                    <ArrowRight size={10} />
                    <span className="font-mono">{(transportLegs[jobs.length] as any).toPostcode}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Shared via <span className="font-semibold text-primary">RoutePilot Pro</span> · Link expires in 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
