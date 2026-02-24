import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Train, Bus, Car, Navigation, MapPin, Clock, PoundSterling,
  Loader2, ChevronDown, ChevronUp, AlertTriangle, Footprints,
  CheckCircle2, ArrowRight
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TravelStep = {
  type: "walk" | "bus" | "train" | "tram" | "tube" | "taxi" | "wait";
  instruction: string;
  detail: string;
  departureTime: string;
  arrivalTime: string;
  durationMins: number;
  stopOrStation?: string;
  lineOrService?: string;
  cost?: number;
  notes?: string;
};

type TravelRoute = {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  totalDurationMins: number;
  totalCost: number;
  steps: TravelStep[];
  summary: string;
  warnings?: string[];
};

// ─── Step icon / colour mapping ───────────────────────────────────────────────

function StepIcon({ type, className }: { type: TravelStep["type"]; className?: string }) {
  const props = { size: 16, className };
  switch (type) {
    case "train": return <Train {...props} />;
    case "bus": return <Bus {...props} />;
    case "tram": return <Train {...props} />;
    case "tube": return <Train {...props} />;
    case "taxi": return <Car {...props} />;
    case "walk": return <Footprints {...props} />;
    case "wait": return <Clock {...props} />;
    default: return <Navigation {...props} />;
  }
}

function stepColour(type: TravelStep["type"]) {
  switch (type) {
    case "train": return "text-blue-400 bg-blue-400/10 border-blue-400/25";
    case "bus": return "text-green-400 bg-green-400/10 border-green-400/25";
    case "tram": return "text-cyan-400 bg-cyan-400/10 border-cyan-400/25";
    case "tube": return "text-red-400 bg-red-400/10 border-red-400/25";
    case "taxi": return "text-amber-400 bg-amber-400/10 border-amber-400/25";
    case "walk": return "text-muted-foreground bg-secondary border-border";
    case "wait": return "text-muted-foreground bg-secondary border-border";
    default: return "text-primary bg-primary/10 border-primary/25";
  }
}

// ─── Single step card ─────────────────────────────────────────────────────────

function StepCard({ step, index, total }: { step: TravelStep; index: number; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const colour = stepColour(step.type);
  const isLast = index === total - 1;

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-[42px] bottom-0 w-px bg-border z-0" />
      )}

      <div className="relative z-10 flex gap-3">
        {/* Icon bubble */}
        <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 mt-1", colour)}>
          <StepIcon type={step.type} />
        </div>

        {/* Content */}
        <div className="flex-1 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">{step.instruction}</p>
              {step.stopOrStation && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.stopOrStation}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-mono font-bold">{step.departureTime}</p>
              <p className="text-[10px] text-muted-foreground">{step.durationMins}m</p>
            </div>
          </div>

          {/* Arrival time badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <ArrowRight size={10} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Arrive {step.arrivalTime}</span>
            {(step.cost ?? 0) > 0 && (
              <span className="text-xs text-primary font-mono ml-auto">£{(step.cost ?? 0).toFixed(2)}</span>
            )}
            {(step.cost ?? 0) === 0 && step.type !== "wait" && (
              <span className="text-xs text-muted-foreground ml-auto">Free</span>
            )}
          </div>

          {/* Detail / notes (expandable) */}
          {(step.detail || step.notes) && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {expanded ? "Less" : "Details"}
            </button>
          )}
          {expanded && (
            <div className="mt-1.5 space-y-1">
              {step.detail && (
                <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-2.5 py-1.5">{step.detail}</p>
              )}
              {step.notes && (
                <p className="text-xs text-amber-400/80 bg-amber-400/5 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                  {step.notes}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main TravelPlanner component ─────────────────────────────────────────────

interface TravelPlannerProps {
  /** Pre-filled destination (pickup address/postcode) */
  pickupAddress?: string;
  /** Pre-filled arrival time (ISO string) */
  arriveBy?: string;
  /** Called when user saves the route to a job */
  onSaveToJob?: (cost: number, mode: "train" | "bus" | "taxi" | "own_car" | "none") => void;
  /** Existing saved route data to display without re-planning */
  savedRoute?: TravelRoute | null;
  /** Job ID for saving */
  jobId?: number;
}

export function TravelPlanner({ pickupAddress, arriveBy, onSaveToJob, savedRoute, jobId }: TravelPlannerProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(pickupAddress ?? "");
  const [arriveByInput, setArriveByInput] = useState(
    arriveBy ? new Date(arriveBy).toISOString().slice(0, 16) : ""
  );
  const [route, setRoute] = useState<TravelRoute | null>(savedRoute ?? null);
  const [showForm, setShowForm] = useState(!savedRoute);

  const planMutation = trpc.travelPlanner.planRoute.useMutation();
  const saveMutation = trpc.travelPlanner.saveToJob.useMutation();

  async function handlePlan() {
    if (!from.trim() || !to.trim()) {
      toast.error("Enter both your starting location and the pickup address");
      return;
    }
    try {
      const result = await planMutation.mutateAsync({
        fromAddress: from.trim(),
        toAddress: to.trim(),
        arriveBy: arriveByInput ? new Date(arriveByInput).toISOString() : undefined,
      });
      setRoute(result as TravelRoute);
      setShowForm(false);
      toast.success("Journey planned!");
    } catch {
      toast.error("Could not plan route. Please try again.");
    }
  }

  async function handleSave() {
    if (!route || !jobId) return;
    // Determine dominant mode from steps
    const modeCount: Record<string, number> = {};
    for (const step of route.steps) {
      if (step.type !== "walk" && step.type !== "wait") {
        modeCount[step.type] = (modeCount[step.type] ?? 0) + (step.durationMins ?? 0);
      }
    }
    const dominantType = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";
    const modeMap: Record<string, "train" | "bus" | "taxi" | "own_car" | "none"> = {
      train: "train", bus: "bus", taxi: "taxi", tram: "train", tube: "train",
    };
    const mode = modeMap[dominantType] ?? "none";

    try {
      await saveMutation.mutateAsync({ jobId, route, totalCost: route.totalCost, mode });
      onSaveToJob?.(route.totalCost, mode);
      toast.success(`Route saved — £${route.totalCost.toFixed(2)} travel cost added to job`);
    } catch {
      toast.error("Failed to save route to job");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
          <Train size={11} /> Travel to Pickup
        </p>
        {route && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs text-primary hover:underline"
          >
            {showForm ? "Hide form" : "Re-plan"}
          </button>
        )}
      </div>

      {/* Planning form */}
      {showForm && (
        <div className="space-y-3 bg-secondary/50 rounded-xl p-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <MapPin size={10} /> Your starting location
            </Label>
            <Input
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="Your home postcode or address"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Navigation size={10} /> Pickup location
            </Label>
            <Input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="Pickup address or postcode"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Clock size={10} /> Arrive by (optional)
            </Label>
            <Input
              type="datetime-local"
              value={arriveByInput}
              onChange={e => setArriveByInput(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handlePlan}
            disabled={planMutation.isPending}
          >
            {planMutation.isPending ? (
              <><Loader2 size={15} className="animate-spin mr-2" /> Planning journey...</>
            ) : (
              <><Train size={15} className="mr-2" /> Plan My Journey</>
            )}
          </Button>
        </div>
      )}

      {/* Route result */}
      {route && !showForm && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="bg-secondary rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-muted-foreground">Journey</p>
                <p className="text-sm font-semibold">{route.summary}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total cost</p>
                <p className="text-lg font-bold font-mono text-primary">£{route.totalCost.toFixed(2)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background/50 rounded-lg p-1.5">
                <p className="text-[10px] text-muted-foreground">Depart</p>
                <p className="text-xs font-mono font-bold">{route.departureTime}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-1.5">
                <p className="text-[10px] text-muted-foreground">Arrive</p>
                <p className="text-xs font-mono font-bold">{route.arrivalTime}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-1.5">
                <p className="text-[10px] text-muted-foreground">Duration</p>
                <p className="text-xs font-mono font-bold">
                  {Math.floor(route.totalDurationMins / 60)}h {route.totalDurationMins % 60}m
                </p>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {route.warnings && route.warnings.length > 0 && (
            <div className="space-y-1">
              {route.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/5 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Steps */}
          <div className="space-y-0">
            {route.steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} total={route.steps.length} />
            ))}
            {/* Arrival marker */}
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center flex-shrink-0 bg-primary/10">
                <CheckCircle2 size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Arrived at pickup</p>
                <p className="text-xs text-muted-foreground">{route.arrivalTime} · {route.destination}</p>
              </div>
            </div>
          </div>

          {/* Save to job button */}
          {jobId && (
            <Button
              variant="outline"
              className="w-full border-primary/30 text-primary"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <><Loader2 size={15} className="animate-spin mr-2" /> Saving...</>
              ) : (
                <><PoundSterling size={15} className="mr-2" /> Save Route & Add £{route.totalCost.toFixed(2)} to Job</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
