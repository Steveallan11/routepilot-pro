import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useParams } from "wouter";
import { Link2, Car, ArrowDown, Train, Bus, Clock, MapPin, AlertTriangle, PoundSterling } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SharedChain() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading } = trpc.share.getByToken.useQuery({ token }, { enabled: !!token });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading shared chain...</p>
        </div>
      </div>
    );
  }

  if (!data || (data as { expired?: boolean }).expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Link Expired</h2>
          <p className="text-sm text-muted-foreground">This shared chain link has expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const { chain, jobs } = data as {
    chain: {
      name: string;
      totalEarnings: number;
      totalCosts: number;
      totalNetProfit: number;
      totalDurationMins: number;
      totalDistanceMiles: number;
      profitPerHour: number;
      riskFlags: string[] | null;
      repositionLegs: unknown;
      scheduledDate: Date | null;
    };
    jobs: Array<{
      pickupPostcode: string;
      dropoffPostcode: string;
      deliveryFee: number;
      estimatedDistanceMiles: number | null;
      estimatedDurationMins: number | null;
      estimatedNetProfit: number | null;
      worthItScore: string | null;
    }>;
  };

  const repoLegs = (chain.repositionLegs as Array<{
    fromPostcode: string;
    toPostcode: string;
    options: Array<{ mode: string; durationMins: number; cost: number; operator?: string }>;
  }> | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Link2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{chain.name}</h1>
            <p className="text-xs text-muted-foreground">Shared via RoutePilot Pro</p>
          </div>
        </div>

        {/* Summary */}
        <Card className="bg-card border-border overflow-hidden">
          <div className={cn("h-1.5", chain.totalNetProfit >= 0 ? "bg-[oklch(0.72_0.2_142)]" : "bg-[oklch(0.62_0.22_25)]")} />
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Chain Net Profit</p>
                <p className={cn("text-4xl font-bold font-mono", chain.totalNetProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {chain.totalNetProfit >= 0 ? "+" : ""}£{chain.totalNetProfit.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">£/hr</p>
                <p className="text-xl font-bold font-mono">£{chain.profitPerHour.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total Earnings", value: `£${chain.totalEarnings.toFixed(2)}` },
                { label: "Total Costs", value: `£${chain.totalCosts.toFixed(2)}` },
                { label: "Total Distance", value: `${chain.totalDistanceMiles.toFixed(1)} mi` },
                { label: "Total Time", value: `${Math.round(chain.totalDurationMins / 60)}h ${Math.round(chain.totalDurationMins % 60)}m` },
              ].map(item => (
                <div key={item.label} className="bg-secondary rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                  <p className="text-sm font-bold font-mono">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Jobs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Jobs in Chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.map((job, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="text-muted-foreground text-xs">#{idx + 1}</span>
                      <span>{job.pickupPostcode}</span>
                      <ArrowDown size={10} className="text-muted-foreground rotate-[-90deg]" />
                      <span>{job.dropoffPostcode}</span>
                    </div>
                    <div className="flex gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>£{job.deliveryFee.toFixed(2)}</span>
                      {job.estimatedDistanceMiles && <span>{job.estimatedDistanceMiles.toFixed(1)} mi</span>}
                    </div>
                  </div>
                  {job.estimatedNetProfit != null && (
                    <span className={cn("text-sm font-bold font-mono", job.estimatedNetProfit >= 0 ? "text-primary" : "text-destructive")}>
                      £{job.estimatedNetProfit.toFixed(2)}
                    </span>
                  )}
                </div>

                {idx < repoLegs.length && repoLegs[idx] && (
                  <div className="mx-3 my-1 p-2.5 bg-secondary/50 rounded-lg border border-dashed border-border">
                    <p className="text-xs text-muted-foreground mb-1">Reposition: {repoLegs[idx]!.fromPostcode} → {repoLegs[idx]!.toPostcode}</p>
                    {repoLegs[idx]!.options.slice(0, 2).map((opt, oi) => (
                      <div key={oi} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{opt.mode}{opt.operator ? ` (${opt.operator})` : ""}</span>
                        <span>{Math.round(opt.durationMins)} min · £{opt.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk flags */}
        {chain.riskFlags && chain.riskFlags.length > 0 && (
          <div className="space-y-1.5">
            {chain.riskFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <span>{flag}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Shared via <span className="text-primary font-medium">RoutePilot Pro</span>
        </p>
      </div>
    </div>
  );
}
