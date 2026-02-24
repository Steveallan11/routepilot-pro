import { useState, useRef, useEffect } from "react";
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
  ChevronDown, ChevronUp, Home, Navigation, Check, Settings, CalendarPlus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MapView } from "@/components/Map";
import { Map as MapIcon } from "lucide-react";

// Safe number formatter — prevents crashes when TiDB returns decimals as strings
function fmt(val: unknown, decimals = 2): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0." + "0".repeat(decimals);
  return n.toFixed(decimals);
}

// Scooter SVG icon (inline, no external dep)
const ScooterIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="17" r="2"/>
    <circle cx="17" cy="17" r="2"/>
    <path d="M5 17H3v-3l4-4h6l2 4h3"/>
    <path d="M9 10V6l4 1"/>
  </svg>
);

const modeIcons: Record<string, React.ReactNode> = {
  train: <Train size={14} />,
  Train: <Train size={14} />,
  TRAIN: <Train size={14} />,
  RAIL: <Train size={14} />,
  bus: <Bus size={14} />,
  Bus: <Bus size={14} />,
  BUS: <Bus size={14} />,
  tram: <Train size={14} />,
  Tram: <Train size={14} />,
  TRAM: <Train size={14} />,
  SUBWAY: <Train size={14} />,
  Subway: <Train size={14} />,
  taxi: <Car size={14} />,
  Taxi: <Car size={14} />,
  TAXI: <Car size={14} />,
  OTHER: <Car size={14} />,
  walk: <Footprints size={14} />,
  Walk: <Footprints size={14} />,
  WALK: <Footprints size={14} />,
  drive: <Car size={14} />,
  scooter: <ScooterIcon size={14} />,
  Scooter: <ScooterIcon size={14} />,
  SCOOTER: <ScooterIcon size={14} />,
  ferry: <Navigation size={14} />,
  Ferry: <Navigation size={14} />,
  FERRY: <Navigation size={14} />,
};

const stepModeColors: Record<string, string> = {
  WALK: "text-gray-400",
  TRAIN: "text-blue-400",
  RAIL: "text-blue-400",
  BUS: "text-green-400",
  TRAM: "text-purple-400",
  SUBWAY: "text-indigo-400",
  OTHER: "text-yellow-400",
  SCOOTER: "text-orange-400",
  TAXI: "text-yellow-400",
  FERRY: "text-cyan-400",
};

function StepDetail({ step }: { step: TransitStep }) {
  const icon = modeIcons[step.mode] ?? <Navigation size={12} />;
  const color = stepModeColors[step.mode] ?? "text-foreground";
  const isWalk = step.mode === "WALK";
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className={cn("mt-0.5 shrink-0", color)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs font-medium", color)}>
            {isWalk ? `Walk ${step.durationMins} min` : step.instruction}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {step.durationMins} min
          </span>
        </div>
        {!isWalk && (
          <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
            {step.departureStop && step.arrivalStop && (
              <p>{step.departureStop} → {step.arrivalStop}</p>
            )}
            {(step.lineShortName || step.lineName) && (
              <p className="font-medium">
                {step.lineShortName ?? step.lineName}
                {step.operator && ` · ${step.operator}`}
                {step.numStops && ` · ${step.numStops} stops`}
              </p>
            )}
            {step.departureTime && step.arrivalTime && (
              <p className="font-mono">{step.departureTime} → {step.arrivalTime}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const modeColors: Record<string, string> = {
  train: "text-blue-400",
  Train: "text-blue-400",
  bus: "text-green-400",
  Bus: "text-green-400",
  tram: "text-purple-400",
  taxi: "text-yellow-400",
  Taxi: "text-yellow-400",
  walk: "text-gray-400",
  Walk: "text-gray-400",
  drive: "text-orange-400",
  scooter: "text-orange-400",
  Scooter: "text-orange-400",
};

type TransitStep = {
  mode: string;
  instruction: string;
  durationMins: number;
  distanceMetres: number;
  cost?: number;           // per-step fare cost (£)
  departureStop?: string;
  arrivalStop?: string;
  lineName?: string;
  lineShortName?: string;
  operator?: string;
  departureTime?: string;
  arrivalTime?: string;
  numStops?: number;
};

type TransportOption = {
  mode: string;
  durationMins: number;
  cost: number;
  operator?: string;
  changes?: number;
  departureTime?: string;
  arrivalTime?: string;
  steps?: TransitStep[];
  summary?: string;
};

type TransportLeg = {
  fromPostcode: string;
  toPostcode: string;
  legType: "homeToPickup" | "reposition" | "homeReturn";
  options: TransportOption[];
  selectedOptionIndex: number;
  noTransitZone: boolean;
  departureTimestampSecs?: number;
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
  scheduledPickupAt?: Date | string | null;
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
    riskFlags?: string[];
  };
  riskFlags: string[];
};

// ============================================================================
// Multimodal Step Editor — per-step add/remove/edit within a transport leg
// ============================================================================

const STEP_MODES = ["WALK", "BUS", "TRAIN", "TRAM", "SUBWAY", "TAXI", "SCOOTER", "FERRY"] as const;
const STEP_MODE_COSTS: Record<string, number> = {
  WALK: 0, BUS: 2.5, TRAIN: 8.5, TRAM: 2.5, SUBWAY: 2.8, TAXI: 12, SCOOTER: 4, FERRY: 5,
};

function StepEditor({
  step,
  stepIndex,
  totalSteps,
  onUpdate,
  onRemove,
  onInsertAfter,
  initiallyEditing = false,
}: {
  step: TransitStep;
  stepIndex: number;
  totalSteps: number;
  onUpdate: (idx: number, updated: TransitStep) => void;
  onRemove: (idx: number) => void;
  onInsertAfter: (idx: number) => void;
  initiallyEditing?: boolean;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [editMode, setEditMode] = useState(step.mode);
  const [editDuration, setEditDuration] = useState(String(step.durationMins));
  const [editCost, setEditCost] = useState(String(step.cost ?? STEP_MODE_COSTS[step.mode] ?? 0));
  const [editInstruction, setEditInstruction] = useState(step.instruction);
  const icon = modeIcons[step.mode] ?? <Navigation size={12} />;
  const color = stepModeColors[step.mode] ?? "text-foreground";
  const isWalk = step.mode === "WALK";
  const displayCost = step.cost ?? STEP_MODE_COSTS[step.mode] ?? 0;

  // Sync local state when step prop changes (e.g. after save)
  useEffect(() => {
    if (!editing) {
      setEditMode(step.mode);
      setEditDuration(String(step.durationMins));
      setEditCost(String(step.cost ?? STEP_MODE_COSTS[step.mode] ?? 0));
      setEditInstruction(step.instruction);
    }
  }, [step, editing]);

  function openEdit() {
    setEditMode(step.mode);
    setEditDuration(String(step.durationMins));
    setEditCost(String(step.cost ?? STEP_MODE_COSTS[step.mode] ?? 0));
    setEditInstruction(step.instruction);
    setEditing(true);
  }

  function saveStep() {
    const dur = parseInt(editDuration);
    const cost = parseFloat(editCost);
    onUpdate(stepIndex, {
      ...step,
      mode: editMode,
      durationMins: isNaN(dur) ? step.durationMins : dur,
      cost: isNaN(cost) ? (step.cost ?? STEP_MODE_COSTS[editMode] ?? 0) : cost,
      instruction: editInstruction || step.instruction,
    });
    setEditing(false);
  }

  return (
    <div>
      <div className="flex items-start gap-2 py-1.5">
        <div className={cn("mt-0.5 shrink-0", color)}>{icon}</div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="bg-background border border-primary/30 rounded-lg p-2 space-y-2 animate-in fade-in duration-150">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Mode</label>
                  <select
                    value={editMode}
                    onChange={e => { setEditMode(e.target.value); setEditCost(String(STEP_MODE_COSTS[e.target.value] ?? 0)); }}
                    className="w-full mt-0.5 text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                  >
                    {STEP_MODES.map(m => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Duration (min)</label>
                  <Input type="number" min="0" value={editDuration} onChange={e => setEditDuration(e.target.value)} className="mt-0.5 h-8 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Cost (£)</label>
                  <Input type="number" min="0" step="0.10" value={editCost} onChange={e => setEditCost(e.target.value)} className="mt-0.5 h-8 text-xs font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Description</label>
                <Input value={editInstruction} onChange={e => setEditInstruction(e.target.value)} placeholder="e.g. Take bus 46 to Temple Meads" className="mt-0.5 h-8 text-xs" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={saveStep}>Save</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs px-3" onClick={() => setEditing(false)}>Cancel</Button>
                {totalSteps > 1 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs px-3 text-destructive hover:text-destructive border-destructive/30" onClick={() => onRemove(stepIndex)}>
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            // Entire row is tappable on mobile — no hover required
            <button
              onClick={openEdit}
              className="w-full text-left flex items-center justify-between gap-2 rounded-lg px-2 py-1 -mx-2 hover:bg-secondary/60 active:bg-secondary transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className={cn("text-xs font-medium", color)}>
                  {isWalk ? `Walk ${step.durationMins} min` : step.instruction}
                </span>
                {!isWalk && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
                    {step.departureStop && step.arrivalStop && (
                      <p>{step.departureStop} → {step.arrivalStop}</p>
                    )}
                    {(step.lineShortName || step.lineName) && (
                      <p className="font-medium">{step.lineShortName ?? step.lineName}{step.operator && ` · ${step.operator}`}</p>
                    )}
                    {step.departureTime && step.arrivalTime && (
                      <p className="font-mono">{step.departureTime} → {step.arrivalTime}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {displayCost > 0 && (
                  <span className="text-[10px] font-mono font-semibold text-primary/80">£{fmt(displayCost)}</span>
                )}
                <span className="text-[10px] text-muted-foreground font-mono">{step.durationMins}m</span>
                {/* Always-visible edit indicator — no hover needed on mobile */}
                <span className="text-muted-foreground/60">
                  <Settings size={11} />
                </span>
              </div>
            </button>
          )}
        </div>
      </div>
      {/* Insert step button — always visible, full-width tap target */}
      <button
        onClick={() => onInsertAfter(stepIndex)}
        className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary active:text-primary hover:bg-primary/5 rounded-md py-1 transition-colors border border-dashed border-transparent hover:border-primary/20"
      >
        <Plus size={10} /> insert step here
      </button>
    </div>
  );
}

// Expandable transport leg card with full multimodal step editor
function TransportLegCard({
  leg,
  legIndex,
  label,
  onSelectOption,
  onEditLeg,
  onDeleteLeg,
  onEditSteps,
}: {
  leg: TransportLeg;
  legIndex: number;
  label: string;
  onSelectOption: (legIndex: number, optionIndex: number) => void;
  onEditLeg?: (legIndex: number, cost: number, mode: string, durationMins: number) => void;
  onDeleteLeg?: (legIndex: number) => void;
  onEditSteps?: (legIndex: number, steps: TransitStep[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  // Track which newly-inserted step index should open in edit mode
  const [newlyInsertedIdx, setNewlyInsertedIdx] = useState<number | null>(null);
  const selectedOpt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
  const steps: TransitStep[] = selectedOpt?.steps ?? [];

  // Per-step editing handlers
  function handleUpdateStep(stepIdx: number, updated: TransitStep) {
    const newSteps = steps.map((s, i) => i === stepIdx ? updated : s);
    onEditSteps?.(legIndex, newSteps);
    setNewlyInsertedIdx(null); // clear after save
  }

  function handleRemoveStep(stepIdx: number) {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== stepIdx);
    onEditSteps?.(legIndex, newSteps);
    setNewlyInsertedIdx(null);
  }

  function handleInsertAfter(stepIdx: number) {
    const insertAt = stepIdx + 1;
    const newStep: TransitStep = {
      mode: "WALK",
      instruction: "Walk to next stop",
      durationMins: 5,
      distanceMetres: 400,
    };
    const newSteps = [
      ...steps.slice(0, insertAt),
      newStep,
      ...steps.slice(insertAt),
    ];
    onEditSteps?.(legIndex, newSteps);
    // Open the new step in edit mode immediately
    setNewlyInsertedIdx(insertAt);
  }

  // Compute summary from steps
  const totalDurationMins = steps.reduce((s, st) => s + st.durationMins, 0) || selectedOpt?.durationMins || 0;
  const displayCost = selectedOpt?.cost ?? 0;

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
        {/* Collapsed header */}
        <button onClick={() => setExpanded(e => !e)} className="w-full text-left">
          <div className="bg-secondary/70 border border-border/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground font-mono">£{fmt(displayCost)}</span>
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
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Step-mode chips */}
                {steps.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {steps.filter(s => s.durationMins > 0).map((s, si) => (
                      <span key={si} className={cn("flex items-center gap-0.5 text-[10px] font-semibold", stepModeColors[s.mode] ?? "text-foreground")}>
                        {si > 0 && <ArrowRight size={8} className="text-muted-foreground" />}
                        {modeIcons[s.mode]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={cn("flex items-center gap-1 text-xs font-semibold", modeColors[selectedOpt.mode] ?? "text-foreground")}>
                    {modeIcons[selectedOpt.mode]}
                    {selectedOpt.mode}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{Math.round(totalDurationMins)} min</span>
                {selectedOpt.departureTime && selectedOpt.departureTime !== "On demand" && (
                  <span className="text-xs text-muted-foreground font-mono">{selectedOpt.departureTime} → {selectedOpt.arrivalTime}</span>
                )}
              </div>
            )}
          </div>
        </button>

        {/* Action row */}
        <div className="flex gap-1.5 mt-1 flex-wrap">
          <button
            onClick={() => setShowOptions(o => !o)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
          >
            <Settings size={10} /> Change option
          </button>
          {onDeleteLeg && (
            <button
              onClick={() => onDeleteLeg(legIndex)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-secondary"
            >
              <Trash2 size={10} /> Remove leg
            </button>
          )}
        </div>

        {/* Option picker */}
        {showOptions && (
          <div className="mt-1.5 bg-secondary/40 border border-border/40 rounded-xl p-3 space-y-2 animate-in fade-in duration-200">
            <p className="text-xs text-muted-foreground font-semibold mb-2">Choose transport option:</p>
            {leg.options.map((opt, oi) => {
              const isSelected = oi === leg.selectedOptionIndex;
              return (
                <button
                  key={oi}
                  onClick={() => { onSelectOption(legIndex, oi); setShowOptions(false); }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg border transition-all",
                    isSelected ? "border-primary/60 bg-primary/10" : "border-border/50 bg-secondary/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSelected && <Check size={12} className="text-primary" />}
                      <span className={cn("flex items-center gap-1 text-xs font-semibold", modeColors[opt.mode] ?? "text-foreground")}>
                        {modeIcons[opt.mode] ?? <Navigation size={13} />}
                        {opt.summary ?? opt.mode}
                      </span>
                      {opt.operator && <span className="text-xs text-muted-foreground">{opt.operator}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{Math.round(opt.durationMins)} min</span>
                      <span className="font-bold font-mono">£{fmt(opt.cost)}</span>
                    </div>
                  </div>
                  {opt.departureTime && opt.departureTime !== "On demand" && (
                    <div className="text-xs text-muted-foreground mt-1 ml-5 font-mono">
                      Departs {opt.departureTime} · Arrives {opt.arrivalTime}
                    </div>
                  )}
                </button>
              );
            })}
            {leg.noTransitZone && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-2 py-1.5">
                <AlertTriangle size={11} /> Rural area — limited public transport
              </div>
            )}
          </div>
        )}

        {/* Multimodal step-by-step editor */}
        {expanded && (
          <div className="mt-1.5 bg-secondary/40 border border-border/40 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-semibold">Journey steps</p>
              <span className="text-[10px] text-muted-foreground">{steps.length} step{steps.length !== 1 ? "s" : ""} · {Math.round(totalDurationMins)} min · £{fmt(displayCost)}</span>
            </div>
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No step detail available</p>
            ) : (
              <div className="divide-y divide-border/20">
                {steps.map((step, si) => (
                  <StepEditor
                    key={`${si}-${steps.length}`}
                    step={step}
                    stepIndex={si}
                    totalSteps={steps.length}
                    onUpdate={handleUpdateStep}
                    onRemove={handleRemoveStep}
                    onInsertAfter={handleInsertAfter}
                    initiallyEditing={newlyInsertedIdx === si}
                  />
                ))}
              </div>
            )}
            {/* Add step at end */}
            <button
              onClick={() => handleInsertAfter(steps.length - 1)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary active:text-primary border border-dashed border-border rounded-lg py-2 transition-colors hover:border-primary/40"
            >
              <Plus size={11} /> Add step
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Drive leg card
function DriveLegCard({ job, jobIndex }: { job: ChainJob; jobIndex: number }) {
  const scheduledTime = job.scheduledPickupAt
    ? new Date(job.scheduledPickupAt as string | Date).toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

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
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {scheduledTime && (
              <span className="flex items-center gap-1 text-primary/80 font-medium">
                <Clock size={10} /> Pickup {scheduledTime}
              </span>
            )}
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

// Full-day route map component
function ChainRouteMap({ jobs, homePostcode }: { jobs: ChainJob[]; homePostcode?: string }) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapReady || !mapRef.current || jobs.length === 0) return;
    const map = mapRef.current;
    const directionsService = new window.google.maps.DirectionsService();
    const bounds = new window.google.maps.LatLngBounds();
    const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

    // Build waypoints: home → pickup1 → dropoff1 → pickup2 → dropoff2 → ...
    const allPoints: string[] = [];
    if (homePostcode) allPoints.push(homePostcode + ", UK");
    for (const job of jobs) {
      allPoints.push(job.pickupPostcode + ", UK");
      allPoints.push(job.dropoffPostcode + ", UK");
    }
    if (homePostcode) allPoints.push(homePostcode + ", UK");

    if (allPoints.length < 2) return;

    const origin = allPoints[0]!;
    const destination = allPoints[allPoints.length - 1]!;
    const waypoints = allPoints.slice(1, -1).map(p => ({ location: p, stopover: true }));

    directionsService.route(
      { origin, destination, waypoints, travelMode: window.google.maps.TravelMode.DRIVING, optimizeWaypoints: false },
      (result, status) => {
        if (status === "OK" && result) {
          const renderer = new window.google.maps.DirectionsRenderer({
            map,
            suppressMarkers: false,
            polylineOptions: { strokeColor: colors[0], strokeWeight: 4, strokeOpacity: 0.8 },
          });
          renderer.setDirections(result);
          // Fit bounds
          result.routes[0]?.legs.forEach(leg => {
            bounds.extend(leg.start_location);
            bounds.extend(leg.end_location);
          });
          map.fitBounds(bounds, 40);
        }
      }
    );
  }, [mapReady, jobs, homePostcode]);

  return (
    <MapView
      className="h-64 rounded-xl overflow-hidden"
      initialCenter={{ lat: 52.5, lng: -1.5 }}
      initialZoom={7}
      onMapReady={(map) => { mapRef.current = map; setMapReady(true); }}
    />
  );
}

export default function ChainPlanner() {
  const { isAuthenticated } = useAuth();

  // Pre-select jobs from ?chainJobs=1,2,3 URL param (set by Plan Day sheet in Jobs page)
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const chainJobsParam = params.get("chainJobs");
    if (chainJobsParam) {
      return chainJobsParam.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
    }
    return [];
  });
  const [chainResult, setChainResult] = useState<ChainResult | null>(null);
  const [legSelections, setLegSelections] = useState<Array<{ legIndex: number; optionIndex: number }>>([]);
  const [showHomePrompt, setShowHomePrompt] = useState(false);
  const [homePostcodeInput, setHomePostcodeInput] = useState("");

  const { data: jobsData } = trpc.jobs.list.useQuery(
    { status: "planned", limit: 20 },
    { enabled: isAuthenticated }
  );
  const { data: settings, refetch: refetchSettings } = trpc.settings.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const [savedChainId, setSavedChainId] = useState<number | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const planMutation = trpc.chains.plan.useMutation();
  const saveChainMutation = trpc.chains.save.useMutation();
  const saveEditsMutation = trpc.chains.saveEdits.useMutation();
  const createShareLinkMutation = trpc.chains.createShareLink.useMutation();
  const saveSettingsMutation = trpc.settings.upsert.useMutation();
  const createJobMutation = trpc.jobs.create.useMutation();

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
    // Prompt for home postcode if not set
    if (!settings?.homePostcode) {
      setShowHomePrompt(true);
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

  const handleSaveHomePostcode = async () => {
    if (!homePostcodeInput.trim()) return;
    try {
      await saveSettingsMutation.mutateAsync({ homePostcode: homePostcodeInput.trim().toUpperCase() });
      await refetchSettings();
      setShowHomePrompt(false);
      // Now plan the chain
      try {
        const result = await planMutation.mutateAsync({
          jobIds: selectedJobIds,
          legSelections,
        });
        setChainResult(result as ChainResult);
      } catch {
        toast.error("Failed to plan chain. Please try again.");
      }
    } catch {
      toast.error("Failed to save home postcode");
    }
  };

  const handleSaveToCalendar = async () => {
    if (!chainResult || chainResult.jobs.length === 0) return;
    // Create a calendar event by creating a "chain" job that spans the whole day
    // We use the first job's scheduled pickup time as the event time
    const firstJob = chainResult.jobs[0]!;
    const scheduledAt = firstJob.scheduledPickupAt
      ? new Date(firstJob.scheduledPickupAt as string | Date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);
    const label = chainResult.jobs.map(j => `${j.pickupPostcode}→${j.dropoffPostcode}`).join(" + ");
    try {
      await createJobMutation.mutateAsync({
        pickupPostcode: firstJob.pickupPostcode,
        dropoffPostcode: chainResult.jobs[chainResult.jobs.length - 1]!.dropoffPostcode,
        deliveryFee: Number(chainResult.summary.totalEarnings),
        fuelDeposit: 0,
        brokerFeeFixed: 0,
        brokerFeePercent: 0,
        fuelReimbursed: false,
        scheduledPickupAt: scheduledAt,
        notes: `Chain: ${label}\nNet profit: £${fmt(chainResult.summary.totalNetProfit)}\nJobs: ${chainResult.jobs.length}`,
        brokerName: "Chain",
      });
      toast.success("Chain added to Calendar!");
    } catch {
      toast.error("Failed to add to calendar");
    }
  };

  // Edit a leg's cost/mode/duration manually
  const handleEditLeg = (legIndex: number, cost: number, mode: string, durationMins: number) => {
    setChainResult(prev => {
      if (!prev) return prev;
      const updatedLegs = prev.transportLegs.map((leg, i) => {
        if (i !== legIndex) return leg;
        // Update the selected option with the new values
        const updatedOptions = leg.options.map((opt, oi) =>
          oi === leg.selectedOptionIndex
            ? { ...opt, cost, mode, durationMins, summary: mode }
            : opt
        );
        // If no options exist, create a custom one
        if (updatedOptions.length === 0) {
          return { ...leg, options: [{ mode, cost, durationMins, summary: mode, operator: "Custom", changes: 0, departureTime: "Manual", arrivalTime: "Manual", steps: [] }], selectedOptionIndex: 0 };
        }
        return { ...leg, options: updatedOptions };
      });
      // Recalculate totals
      let totalTransportCost = 0;
      let totalTransportMins = 0;
      for (const leg of updatedLegs) {
        const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
        if (opt) { totalTransportCost += opt.cost; totalTransportMins += opt.durationMins; }
      }
      const totalBrokerFees = Number(prev.summary.totalBrokerFees);
      const totalEarnings = Number(prev.summary.totalEarnings);
      const totalCosts = totalBrokerFees + totalTransportCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const baseDriveMins = Number(prev.summary.totalDurationMins) -
        prev.transportLegs.reduce((s, leg) => { const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0]; return s + (opt?.durationMins ?? 0); }, 0);
      const totalDurationMins = baseDriveMins + totalTransportMins;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;
      return { ...prev, transportLegs: updatedLegs, summary: { ...prev.summary, totalTransportCost, totalCosts, totalNetProfit, totalDurationMins, profitPerHour } };
    });
    toast.success("Leg updated");
  };

  // Delete a transport leg
  const handleDeleteLeg = (legIndex: number) => {
    setChainResult(prev => {
      if (!prev) return prev;
      const updatedLegs = prev.transportLegs.filter((_, i) => i !== legIndex);
      let totalTransportCost = 0;
      let totalTransportMins = 0;
      for (const leg of updatedLegs) {
        const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
        if (opt) { totalTransportCost += opt.cost; totalTransportMins += opt.durationMins; }
      }
      const totalBrokerFees = Number(prev.summary.totalBrokerFees);
      const totalEarnings = Number(prev.summary.totalEarnings);
      const totalCosts = totalBrokerFees + totalTransportCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const baseDriveMins = prev.summary.totalDurationMins -
        prev.transportLegs.reduce((s, leg) => { const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0]; return s + (opt?.durationMins ?? 0); }, 0);
      const totalDurationMins = baseDriveMins + totalTransportMins;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;
      return { ...prev, transportLegs: updatedLegs, summary: { ...prev.summary, totalTransportCost, totalCosts, totalNetProfit, totalDurationMins, profitPerHour } };
    });
    // Re-index legSelections
    setLegSelections(prev => prev.filter(s => s.legIndex !== legIndex).map(s => s.legIndex > legIndex ? { ...s, legIndex: s.legIndex - 1 } : s));
    toast.success("Leg removed");
  };

  // Edit individual steps within a transport leg
  const handleEditSteps = (legIndex: number, newSteps: TransitStep[]) => {
    setChainResult(prev => {
      if (!prev) return prev;
      const updatedLegs = prev.transportLegs.map((leg, i) => {
        if (i !== legIndex) return leg;
        // Recalculate duration and cost from steps
        const newDurationMins = newSteps.reduce((s, st) => s + (st.durationMins ?? 0), 0);
        // If any step has an explicit cost, sum them; otherwise keep original opt cost
        const stepsHaveCost = newSteps.some(st => st.cost !== undefined);
        const newCostFromSteps = stepsHaveCost
          ? newSteps.reduce((s, st) => s + (st.cost ?? STEP_MODE_COSTS[st.mode] ?? 0), 0)
          : null;
        const updatedOptions = leg.options.map((opt, oi) =>
          oi === leg.selectedOptionIndex
            ? {
                ...opt,
                steps: newSteps,
                durationMins: newDurationMins > 0 ? newDurationMins : opt.durationMins,
                cost: newCostFromSteps !== null ? newCostFromSteps : opt.cost,
              }
            : opt
        );
        return { ...leg, options: updatedOptions };
      });
      // Recalculate totals
      let totalTransportCost = 0;
      let totalTransportMins = 0;
      for (const leg of updatedLegs) {
        const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0];
        if (opt) { totalTransportCost += opt.cost; totalTransportMins += opt.durationMins; }
      }
      const totalBrokerFees = Number(prev.summary.totalBrokerFees);
      const totalEarnings = Number(prev.summary.totalEarnings);
      const totalCosts = totalBrokerFees + totalTransportCost;
      const totalNetProfit = totalEarnings - totalCosts;
      const baseDriveMins = Number(prev.summary.totalDurationMins) -
        prev.transportLegs.reduce((s, leg) => { const opt = leg.options[leg.selectedOptionIndex] ?? leg.options[0]; return s + (opt?.durationMins ?? 0); }, 0);
      const totalDurationMins = baseDriveMins + totalTransportMins;
      const profitPerHour = totalDurationMins > 0 ? (totalNetProfit / totalDurationMins) * 60 : 0;
      return { ...prev, transportLegs: updatedLegs, summary: { ...prev.summary, totalTransportCost, totalCosts, totalNetProfit, totalDurationMins, profitPerHour } };
    });
  };

  // Add a custom leg
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [addLegFrom, setAddLegFrom] = useState("");
  const [addLegTo, setAddLegTo] = useState("");
  const [addLegMode, setAddLegMode] = useState("Train");
  const [addLegCost, setAddLegCost] = useState("");
  const [addLegDuration, setAddLegDuration] = useState("");

  const handleAddLeg = () => {
    const cost = parseFloat(addLegCost);
    const dur = parseInt(addLegDuration);
    if (!addLegFrom.trim() || !addLegTo.trim() || isNaN(cost) || isNaN(dur)) {
      toast.error("Please fill in all fields");
      return;
    }
    const newLeg: TransportLeg = {
      fromPostcode: addLegFrom.trim().toUpperCase(),
      toPostcode: addLegTo.trim().toUpperCase(),
      legType: "reposition",
      options: [{ mode: addLegMode, cost, durationMins: dur, summary: addLegMode, operator: "Custom", changes: 0, departureTime: "Manual", arrivalTime: "Manual", steps: [] }],
      selectedOptionIndex: 0,
      noTransitZone: false,
      departureTimestampSecs: 0,
    };
    setChainResult(prev => {
      if (!prev) return prev;
      const updatedLegs = [...prev.transportLegs, newLeg];
      const totalTransportCost = prev.summary.totalTransportCost + cost;
      const totalTransportMins = prev.summary.totalDurationMins + dur;
      const totalCosts = prev.summary.totalBrokerFees + totalTransportCost;
      const totalNetProfit = prev.summary.totalEarnings - totalCosts;
      const profitPerHour = totalTransportMins > 0 ? (totalNetProfit / totalTransportMins) * 60 : 0;
      return { ...prev, transportLegs: updatedLegs, summary: { ...prev.summary, totalTransportCost, totalCosts, totalNetProfit, profitPerHour } };
    });
    setShowAddLeg(false);
    setAddLegFrom(""); setAddLegTo(""); setAddLegCost(""); setAddLegDuration(""); setAddLegMode("Train");
    toast.success("Leg added");
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
      const result = await saveChainMutation.mutateAsync({
        jobIds: selectedJobIds,
      }) as { chainId?: number };
      if (result?.chainId) setSavedChainId(result.chainId);
      toast.success("Chain saved!");
    } catch {
      toast.error("Failed to save chain");
    }
  };

  const handleSaveEdits = async () => {
    if (!chainResult || !savedChainId) {
      toast.error("Save the chain first before saving edits");
      return;
    }
    try {
      await saveEditsMutation.mutateAsync({
        chainId: savedChainId,
        transportLegs: chainResult.transportLegs,
        summary: {
          totalEarnings: Number(chainResult.summary.totalEarnings),
          totalTransportCost: Number(chainResult.summary.totalTransportCost),
          totalCosts: Number(chainResult.summary.totalCosts),
          totalNetProfit: Number(chainResult.summary.totalNetProfit),
          totalDurationMins: Number(chainResult.summary.totalDurationMins),
          totalDistanceMiles: Number(chainResult.summary.totalDistanceMiles ?? 0),
          profitPerHour: Number(chainResult.summary.profitPerHour),
        },
      });
      toast.success("Edits saved to database!");
    } catch {
      toast.error("Failed to save edits");
    }
  };

  const handleShareChain = async () => {
    if (!savedChainId) {
      toast.error("Save the chain first to generate a share link");
      return;
    }
    try {
      const result = await createShareLinkMutation.mutateAsync({ chainId: savedChainId });
      const link = `${window.location.origin}/chain/${result.token}`;
      setShareLink(link);
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Share link copied to clipboard! Valid for 7 days.");
    } catch {
      toast.error("Failed to generate share link");
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
    <>
      {/* Home postcode prompt dialog */}
      {showHomePrompt && (
        <Dialog open onOpenChange={(o) => !o && setShowHomePrompt(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Home size={18} className="text-primary" /> Set Your Home Postcode
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Your home postcode is used to calculate travel costs to the first pickup and back after the last dropoff.
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Home Postcode</Label>
              <Input
                value={homePostcodeInput}
                onChange={e => setHomePostcodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. NN4 6RA"
                className="font-mono uppercase"
                onKeyDown={e => e.key === "Enter" && handleSaveHomePostcode()}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowHomePrompt(false);
                // Plan anyway without home postcode
                planMutation.mutateAsync({ jobIds: selectedJobIds, legSelections }).then(r => setChainResult(r as ChainResult)).catch(() => toast.error("Failed to plan chain"));
              }}>Skip</Button>
              <Button onClick={handleSaveHomePostcode} disabled={saveSettingsMutation.isPending || !homePostcodeInput.trim()}>
                {saveSettingsMutation.isPending ? "Saving..." : "Save & Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                      // Compute "leave by" time from the first transport leg
                      const homeToPickupLeg = chainResult.transportLegs.find(l => l.legType === "homeToPickup");
                      const leaveByTime = item.type === "homeStart" && homeToPickupLeg?.departureTimestampSecs
                        ? new Date(homeToPickupLeg.departureTimestampSecs * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
                        : null;
                      return (
                        <div key={idx} className="flex items-center gap-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                            <Home size={13} className="text-muted-foreground" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">{item.type === "homeStart" ? "Start from home" : "Return home"}</span>
                            <p className="text-sm font-mono font-medium">{item.postcode}</p>
                            {leaveByTime && (
                              <p className="text-xs text-primary font-semibold mt-0.5">⏰ Leave by {leaveByTime}</p>
                            )}
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
                          onEditLeg={handleEditLeg}
                          onDeleteLeg={handleDeleteLeg}
                          onEditSteps={handleEditSteps}
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

                {/* Add custom leg */}
                <div className="mt-3">
                  {!showAddLeg ? (
                    <button
                      onClick={() => setShowAddLeg(true)}
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg py-2 transition-colors hover:border-border/80"
                    >
                      <Plus size={12} /> Add custom leg
                    </button>
                  ) : (
                    <div className="bg-secondary/60 border border-primary/30 rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
                      <p className="text-xs font-semibold text-primary">Add a leg</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">From postcode</label>
                          <Input value={addLegFrom} onChange={e => setAddLegFrom(e.target.value.toUpperCase())} placeholder="e.g. BS34 6FE" className="mt-0.5 h-8 text-xs font-mono uppercase" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">To postcode</label>
                          <Input value={addLegTo} onChange={e => setAddLegTo(e.target.value.toUpperCase())} placeholder="e.g. BS20 7XJ" className="mt-0.5 h-8 text-xs font-mono uppercase" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Mode</label>
                          <select value={addLegMode} onChange={e => setAddLegMode(e.target.value)} className="w-full mt-0.5 text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground">
                            {["Train", "Bus", "Taxi", "Walk", "Scooter", "Tube", "Tram", "Ferry"].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Cost (£)</label>
                          <Input type="number" step="0.10" min="0" value={addLegCost} onChange={e => setAddLegCost(e.target.value)} className="mt-0.5 h-8 text-xs font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Duration (min)</label>
                          <Input type="number" min="1" value={addLegDuration} onChange={e => setAddLegDuration(e.target.value)} className="mt-0.5 h-8 text-xs font-mono" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddLeg}>Add Leg</Button>
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setShowAddLeg(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Route Map card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <MapIcon size={14} /> Day Route Map
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <ChainRouteMap jobs={chainResult.jobs} homePostcode={chainResult.homePostcode} />
                <p className="text-[10px] text-muted-foreground mt-2 text-center">All drive legs plotted — tap markers for details</p>
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

                {(chainResult.riskFlags ?? chainResult.summary.riskFlags ?? []).length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {(chainResult.riskFlags ?? chainResult.summary.riskFlags ?? []).map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-lg px-3 py-2">
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleSaveChain} disabled={saveChainMutation.isPending} className="flex-1">
                    <Save size={16} className="mr-2" />
                    {saveChainMutation.isPending ? "Saving..." : "Save Chain"}
                  </Button>
                  <Button variant="outline" onClick={handleSaveToCalendar} disabled={createJobMutation.isPending} className="flex-1 gap-1.5">
                    <CalendarPlus size={16} />
                    {createJobMutation.isPending ? "Adding..." : "Add to Calendar"}
                  </Button>
                </div>

                {/* Save Edits + Share row — shown once chain is saved */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveEdits}
                    disabled={saveEditsMutation.isPending || !savedChainId}
                    className="flex-1 gap-1.5"
                    title={!savedChainId ? "Save the chain first" : "Persist step edits to database"}
                  >
                    <Save size={14} />
                    {saveEditsMutation.isPending ? "Saving edits..." : "Save Edits"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleShareChain}
                    disabled={createShareLinkMutation.isPending || !savedChainId}
                    className="flex-1 gap-1.5"
                    title={!savedChainId ? "Save the chain first" : "Generate a shareable read-only link"}
                  >
                    <Link2 size={14} />
                    {createShareLinkMutation.isPending ? "Generating..." : "Share Plan"}
                  </Button>
                </div>

                {/* Share link display */}
                {shareLink && (
                  <div className="bg-secondary/60 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Share link (valid 7 days):</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-primary flex-1 truncate">{shareLink}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(shareLink).catch(() => {});
                          toast.success("Copied!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
