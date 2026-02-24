import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Briefcase, Plus, MapPin, Clock, PoundSterling, Car, CheckCircle2,
  Circle, XCircle, AlertCircle, Train, Building2, Hash, FileText,
  Fuel, ChevronDown, ChevronUp, Camera, Loader2, Navigation,
  Trash2, TrendingUp, TrendingDown, Receipt, Search, Filter,
  CalendarDays, Route, Image as ImageIcon, StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateJobCost } from "../../../shared/routepilot-types";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = "planned" | "active" | "completed" | "cancelled";

type Job = {
  id: number;
  status: JobStatus;
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: number;
  fuelDeposit: number;
  fuelReimbursed: boolean;
  brokerFeePercent: number | null;
  brokerFeeFixed: number | null;
  estimatedDistanceMiles: number | null;
  estimatedDurationMins: number | null;
  estimatedFuelCost: number | null;
  estimatedNetProfit: number | null;
  estimatedProfitPerHour: number | null;
  estimatedProfitPerMile: number | null;
  worthItScore: "green" | "amber" | "red" | null;
  actualNetProfit: number | null;
  actualDistanceMiles: number | null;
  actualDurationMins: number | null;
  actualNotes: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  brokerName: string | null;
  jobReference: string | null;
  bookingImageUrl: string | null;
  notes: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleReg: string | null;
  vehicleFuelType: string | null;
  vehicleColour: string | null;
  travelToJobCost: number | null;
  travelHomeCost: number | null;
  travelToJobMode: string | null;
  travelHomeMode: string | null;
  scannedDistanceMiles: number | null;
  scannedDurationMins: number | null;
  scheduledPickupAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; dot: string; icon: React.ElementType }> = {
  planned: { label: "Planned", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/25", dot: "bg-amber-400", icon: Circle },
  active: { label: "Active", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/25", dot: "bg-blue-400", icon: Clock },
  completed: { label: "Completed", color: "text-primary", bg: "bg-primary/10 border-primary/25", dot: "bg-primary", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted/20 border-border", dot: "bg-muted-foreground", icon: XCircle },
};

const TRAVEL_MODE_LABELS: Record<string, string> = { none: "None", train: "Train", bus: "Bus", taxi: "Taxi", own_car: "Own Car" };

function WorthItBadge({ score }: { score: "green" | "amber" | "red" | null }) {
  if (!score) return null;
  const map = { green: "bg-primary/20 text-primary", amber: "bg-amber-400/20 text-amber-400", red: "bg-red-500/20 text-red-400" };
  const labels = { green: "Worth It", amber: "Marginal", red: "Not Worth It" };
  return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", map[score])}>{labels[score]}</span>;
}

function formatDateTime(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Job Detail Sheet ─────────────────────────────────────────────────────────

function JobDetailSheet({ job, onClose, onStatusChange, onDelete }: {
  job: Job;
  onClose: () => void;
  onStatusChange: (id: number, status: JobStatus) => void;
  onDelete: (id: number) => void;
}) {
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const netProfit = job.actualNetProfit ?? job.estimatedNetProfit ?? 0;
  const brokerFee = ((job.deliveryFee * (job.brokerFeePercent ?? 0)) / 100) + (job.brokerFeeFixed ?? 0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[92dvh] overflow-y-auto rounded-t-2xl px-0 pb-8">
        <SheetHeader className="px-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              <SheetTitle className="text-base font-bold">
                {job.pickupPostcode} → {job.dropoffPostcode}
              </SheetTitle>
            </div>
            <WorthItBadge score={job.worthItScore} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StatusIcon size={13} className={cfg.color} />
            <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
            {job.scheduledPickupAt && (
              <span className="text-xs text-muted-foreground ml-auto">
                {formatDateTime(job.scheduledPickupAt)}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="px-4 pt-4 space-y-5">
          {/* Net profit hero */}
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
                <p className={cn("text-3xl font-bold font-mono", netProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(2)}
                </p>
              </div>
              <div className="text-right space-y-1">
                {(job.estimatedDistanceMiles || job.actualDistanceMiles) && (
                  <p className="text-sm font-mono text-muted-foreground">
                    {(job.actualDistanceMiles ?? job.estimatedDistanceMiles)?.toFixed(1)} mi
                  </p>
                )}
                {(job.estimatedDurationMins || job.actualDurationMins) && (() => {
                  const mins = job.actualDurationMins ?? job.estimatedDurationMins ?? 0;
                  return <p className="text-sm font-mono text-muted-foreground">{Math.floor(mins / 60)}h {Math.round(mins % 60)}m</p>;
                })()}
              </div>
            </div>
            {(job.estimatedProfitPerHour || job.estimatedProfitPerMile) && (
              <div className="grid grid-cols-2 gap-2">
                {job.estimatedProfitPerHour != null && (
                  <div className="bg-background/50 rounded-xl p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Per Hour</p>
                    <p className="text-sm font-bold font-mono">£{job.estimatedProfitPerHour.toFixed(2)}</p>
                  </div>
                )}
                {job.estimatedProfitPerMile != null && (
                  <div className="bg-background/50 rounded-xl p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Per Mile</p>
                    <p className="text-sm font-bold font-mono">£{Number(job.estimatedProfitPerMile).toFixed(4)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cost breakdown */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
              <PoundSterling size={11} /> Breakdown
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="font-mono text-primary">+£{job.deliveryFee.toFixed(2)}</span>
              </div>
              {(job.fuelDeposit ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuel Deposit <span className="text-xs text-primary">(reimbursed)</span></span>
                  <span className="font-mono text-primary">+£{(job.fuelDeposit ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(job.estimatedFuelCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Fuel size={11} /> Fuel Cost <span className="text-xs text-blue-400">(claimed back)</span>
                  </span>
                  <span className="font-mono text-muted-foreground">£{(job.estimatedFuelCost ?? 0).toFixed(2)}</span>
                </div>
              )}
              {brokerFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broker Fee</span>
                  <span className="font-mono">-£{brokerFee.toFixed(2)}</span>
                </div>
              )}
              {(job.travelToJobCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Train size={11} /> Travel to Job <span className="text-xs">({TRAVEL_MODE_LABELS[job.travelToJobMode ?? "none"]})</span>
                  </span>
                  <span className="font-mono">-£{(job.travelToJobCost ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(job.travelHomeCost ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Train size={11} /> Travel Home <span className="text-xs">({TRAVEL_MODE_LABELS[job.travelHomeMode ?? "none"]})</span>
                  </span>
                  <span className="font-mono">-£{(job.travelHomeCost ?? 0).toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span>Net Profit</span>
                <span className={cn("font-mono", netProfit >= 0 ? "text-primary" : "text-destructive")}>
                  {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Route info */}
          {(job.pickupAddress || job.dropoffAddress || job.scannedDistanceMiles) && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                <Route size={11} /> Route
              </p>
              <div className="space-y-1.5 text-sm">
                {job.pickupAddress && (
                  <div className="flex gap-2">
                    <span className="text-primary font-bold text-xs mt-0.5">↑</span>
                    <span className="text-muted-foreground text-xs">{job.pickupAddress}</span>
                  </div>
                )}
                {job.dropoffAddress && (
                  <div className="flex gap-2">
                    <span className="text-red-400 font-bold text-xs mt-0.5">↓</span>
                    <span className="text-muted-foreground text-xs">{job.dropoffAddress}</span>
                  </div>
                )}
                {(job.scannedDistanceMiles || job.scannedDurationMins) && (
                  <div className="flex gap-2 mt-1">
                    {job.scannedDistanceMiles && (
                      <div className="flex-1 bg-secondary rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Booking dist.</p>
                        <p className="text-xs font-mono font-bold">{job.scannedDistanceMiles} mi</p>
                      </div>
                    )}
                    {job.scannedDurationMins && (
                      <div className="flex-1 bg-secondary rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Booking time</p>
                        <p className="text-xs font-mono font-bold">{Math.floor(job.scannedDurationMins / 60)}h {Math.round(job.scannedDurationMins % 60)}m</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job sheet */}
          {(job.brokerName || job.jobReference || job.vehicleReg) && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                <FileText size={11} /> Job Sheet
              </p>
              <div className="space-y-1.5 text-sm">
                {job.brokerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Building2 size={11} /> Broker</span>
                    <span className="font-medium">{job.brokerName}</span>
                  </div>
                )}
                {job.jobReference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Hash size={11} /> Reference</span>
                    <span className="font-mono text-xs">{job.jobReference}</span>
                  </div>
                )}
                {job.vehicleReg && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Car size={11} /> Vehicle</span>
                    <span className="font-mono text-xs">{[job.vehicleMake, job.vehicleModel, job.vehicleReg].filter(Boolean).join(" ")}</span>
                  </div>
                )}
                {job.vehicleColour && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Colour</span>
                    <span className="text-xs">{job.vehicleColour}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Booking screenshot */}
          {job.bookingImageUrl && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                <ImageIcon size={11} /> Booking Screenshot
              </p>
              <img src={job.bookingImageUrl} alt="Booking" className="w-full rounded-xl object-cover max-h-56" />
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2 flex items-center gap-1.5">
                <StickyNote size={11} /> Notes
              </p>
              <p className="text-sm bg-secondary rounded-xl px-3 py-2">{job.notes}</p>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-1 text-xs text-muted-foreground">
            {job.scheduledPickupAt && <p>Scheduled: {formatDateTime(job.scheduledPickupAt)}</p>}
            {job.completedAt && <p>Completed: {formatDateTime(job.completedAt)}</p>}
            <p>Added: {formatDateTime(job.createdAt)}</p>
          </div>

          {/* Status actions */}
          <div className="space-y-2 pt-1">
            {job.status === "planned" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-blue-400/30 text-blue-400"
                  onClick={() => { onStatusChange(job.id, "active"); onClose(); }}
                >
                  Start Job
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-destructive/30 text-destructive"
                  onClick={() => { onStatusChange(job.id, "cancelled"); onClose(); }}
                >
                  Cancel
                </Button>
              </div>
            )}
            {job.status === "active" && (
              <Button className="w-full" onClick={() => { onStatusChange(job.id, "completed"); onClose(); }}>
                <CheckCircle2 size={16} className="mr-2" /> Mark Complete
              </Button>
            )}
            {job.status === "cancelled" && (
              <Button variant="outline" className="w-full" onClick={() => { onStatusChange(job.id, "planned"); onClose(); }}>
                Restore to Planned
              </Button>
            )}

            {/* Delete */}
            {!showDeleteConfirm ? (
              <Button variant="ghost" className="w-full text-destructive/70 hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={14} className="mr-2" /> Delete Job
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Keep</Button>
                <Button variant="destructive" className="flex-1" onClick={() => { onDelete(job.id); onClose(); }}>
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Add Job Sheet (inline calculator) ───────────────────────────────────────

function AddJobSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { isAuthenticated } = useAuth();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [fee, setFee] = useState("");
  const [fuelDeposit, setFuelDeposit] = useState("0");
  const [fuelReimbursed, setFuelReimbursed] = useState(false);
  const [brokerFeePercent, setBrokerFeePercent] = useState("0");
  const [brokerName, setBrokerName] = useState("");
  const [jobRef, setJobRef] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [travelToJob, setTravelToJob] = useState("0");
  const [travelToJobMode, setTravelToJobMode] = useState("none");
  const [travelHome, setTravelHome] = useState("0");
  const [travelHomeMode, setTravelHomeMode] = useState("none");
  const [notes, setNotes] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [result, setResult] = useState<{ distanceMiles: number; durationMins: number; breakdown: ReturnType<typeof calculateJobCost> } | null>(null);
  const [scanState, setScanState] = useState<"idle" | "uploading" | "extracting" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userSettings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const calculateMutation = trpc.jobs.calculate.useMutation();
  const createJobMutation = trpc.jobs.create.useMutation();
  const uploadImageMutation = trpc.scan.uploadImage.useMutation();
  const extractBookingMutation = trpc.scan.extractBooking.useMutation();

  async function handleCalculate() {
    if (!pickup || !dropoff || !fee) {
      toast.error("Fill in pickup, dropoff and delivery fee");
      return;
    }
    try {
      const res = await calculateMutation.mutateAsync({
        pickupPostcode: pickup,
        dropoffPostcode: dropoff,
        deliveryFee: parseFloat(fee) || 0,
        fuelDeposit: parseFloat(fuelDeposit) || 0,
        fuelReimbursed,
        brokerFeePercent: parseFloat(brokerFeePercent) || 0,
        brokerFeeFixed: 0,
        travelToJobCost: parseFloat(travelToJob) || 0,
        travelHomeCost: parseFloat(travelHome) || 0,
        vehicleMpg: userSettings?.vehicleMpg ?? 35,
      });
      setResult(res as typeof result);
    } catch {
      toast.error("Could not calculate route. Check postcodes.");
    }
  }

  async function handleSave() {
    if (!pickup || !dropoff || !fee) {
      toast.error("Fill in pickup, dropoff and delivery fee");
      return;
    }
    try {
      await createJobMutation.mutateAsync({
        pickupPostcode: pickup,
        dropoffPostcode: dropoff,
        deliveryFee: parseFloat(fee) || 0,
        fuelDeposit: parseFloat(fuelDeposit) || 0,
        fuelReimbursed,
        brokerFeePercent: parseFloat(brokerFeePercent) || 0,
        brokerFeeFixed: 0,
        travelToJobCost: parseFloat(travelToJob) || 0,
        travelToJobMode: travelToJobMode as "train" | "bus" | "taxi" | "own_car" | "none",
        travelHomeCost: parseFloat(travelHome) || 0,
        travelHomeMode: travelHomeMode as "train" | "bus" | "taxi" | "own_car" | "none",
        scheduledPickupAt: scheduledDate || undefined,
        brokerName: brokerName || undefined,
        jobReference: jobRef || undefined,
        notes: notes || undefined,
        vehicleReg: vehicleReg || undefined,
      });
      toast.success("Job saved!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save job");
    }
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanState("uploading");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]!;
        setScanState("extracting");
        const { url } = await uploadImageMutation.mutateAsync({ base64Data: base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" });
        const data = await extractBookingMutation.mutateAsync({ imageUrl: url });
        if (data.pickupPostcode) setPickup(data.pickupPostcode);
        if (data.dropoffPostcode) setDropoff(data.dropoffPostcode);
        if (data.deliveryFee) setFee(String(data.deliveryFee));
        if (data.brokerName) setBrokerName(data.brokerName);
        if (data.jobReference) setJobRef(data.jobReference);
        if (data.scheduledDate) setScheduledDate(data.scheduledDate);
        if ((data as Record<string, unknown>).vehicleReg) setVehicleReg((data as Record<string, unknown>).vehicleReg as string);
        setScanState("idle");
        toast.success("Booking scanned successfully");
      };
      reader.readAsDataURL(file);
    } catch {
      setScanState("error");
      toast.error("Scan failed. Try again.");
      setScanState("idle");
    }
    e.target.value = "";
  }

  const breakdown = result?.breakdown;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[95dvh] overflow-y-auto rounded-t-2xl px-0 pb-8">
        <SheetHeader className="px-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="text-base font-bold flex items-center gap-2">
            <Plus size={16} className="text-primary" /> Add New Job
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pt-4 space-y-4">
          {/* Scan button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanState !== "idle"}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {scanState === "uploading" || scanState === "extracting" ? (
              <><Loader2 size={16} className="animate-spin" /> {scanState === "uploading" ? "Uploading..." : "Scanning..."}</>
            ) : (
              <><Camera size={16} /> Scan Booking Screenshot</>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScan} />

          {/* Core fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Pickup Postcode</Label>
              <Input
                value={pickup}
                onChange={e => setPickup(e.target.value.toUpperCase())}
                placeholder="NN4 6RA"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Dropoff Postcode</Label>
              <Input
                value={dropoff}
                onChange={e => setDropoff(e.target.value.toUpperCase())}
                placeholder="BS34 6FE"
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Delivery Fee (£)</Label>
              <Input
                type="number"
                value={fee}
                onChange={e => setFee(e.target.value)}
                placeholder="85.00"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Broker Fee (%)</Label>
              <Input
                type="number"
                value={brokerFeePercent}
                onChange={e => setBrokerFeePercent(e.target.value)}
                placeholder="0"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-secondary rounded-xl">
            <div>
              <p className="text-sm font-medium">Fuel Reimbursed</p>
              <p className="text-xs text-muted-foreground">Broker pays for fuel</p>
            </div>
            <Switch checked={fuelReimbursed} onCheckedChange={setFuelReimbursed} />
          </div>

          {/* Scheduled date */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
              <CalendarDays size={11} /> Scheduled Date & Time
            </Label>
            <Input
              type="datetime-local"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
            />
          </div>

          {/* Travel expenses */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Train size={11} /> Travel Expenses
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">To Job (£)</Label>
                <Input type="number" value={travelToJob} onChange={e => setTravelToJob(e.target.value)} placeholder="0" className="font-mono" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Mode</Label>
                <Select value={travelToJobMode} onValueChange={setTravelToJobMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRAVEL_MODE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Home (£)</Label>
                <Input type="number" value={travelHome} onChange={e => setTravelHome(e.target.value)} placeholder="0" className="font-mono" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Mode</Label>
                <Select value={travelHomeMode} onValueChange={setTravelHomeMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRAVEL_MODE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Extra details toggle */}
          <button
            onClick={() => setShowExtra(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showExtra ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showExtra ? "Hide" : "Show"} extra details
          </button>

          {showExtra && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Broker Name</Label>
                  <Input value={brokerName} onChange={e => setBrokerName(e.target.value)} placeholder="Waylands Group" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Job Reference</Label>
                  <Input value={jobRef} onChange={e => setJobRef(e.target.value)} placeholder="WG-12345" className="font-mono" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Vehicle Reg</Label>
                <Input value={vehicleReg} onChange={e => setVehicleReg(e.target.value.toUpperCase())} placeholder="AB12 CDE" className="font-mono uppercase" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this job..." />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Fuel Deposit (£)</Label>
                <Input type="number" value={fuelDeposit} onChange={e => setFuelDeposit(e.target.value)} placeholder="0" className="font-mono" />
              </div>
            </div>
          )}

          {/* Calculate button */}
          <Button
            variant="outline"
            className="w-full border-primary/30 text-primary"
            onClick={handleCalculate}
            disabled={calculateMutation.isPending}
          >
            {calculateMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Navigation size={16} className="mr-2" />}
            Calculate Route & Profit
          </Button>

          {/* Result */}
          {breakdown && (
            <div className="bg-secondary rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Net Profit</p>
                  <p className={cn("text-2xl font-bold font-mono", breakdown.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                    {breakdown.netProfit >= 0 ? "+" : ""}£{breakdown.netProfit.toFixed(2)}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  <p>{result!.distanceMiles.toFixed(1)} mi</p>
                  <p>{Math.floor(result!.durationMins / 60)}h {Math.round(result!.durationMins % 60)}m</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background/50 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Per Hour</p>
                  <p className="text-sm font-bold font-mono">£{breakdown.profitPerHour.toFixed(2)}</p>
                </div>
                <div className="bg-background/50 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Per Mile</p>
                  <p className="text-sm font-bold font-mono">£{breakdown.profitPerMile.toFixed(4)}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Fee</span><span className="text-primary font-mono">+£{breakdown.deliveryFee.toFixed(2)}</span>
                </div>
                {breakdown.fuelCost > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fuel <span className="text-blue-400">(claimed back)</span></span>
                    <span className="font-mono">£{breakdown.fuelCost.toFixed(2)}</span>
                  </div>
                )}
                {breakdown.brokerFee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Broker Fee</span><span className="font-mono">-£{breakdown.brokerFee.toFixed(2)}</span>
                  </div>
                )}
                {breakdown.travelToJobCost > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Travel to Job</span><span className="font-mono">-£{breakdown.travelToJobCost.toFixed(2)}</span>
                  </div>
                )}
                {breakdown.travelHomeCost > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Travel Home</span><span className="font-mono">-£{breakdown.travelHomeCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save button */}
          <Button className="w-full" onClick={handleSave} disabled={createJobMutation.isPending}>
            {createJobMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
            Save Job
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Job List Item ────────────────────────────────────────────────────────────

function JobListItem({ job, onClick }: { job: Job; onClick: () => void }) {
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const netProfit = job.actualNetProfit ?? job.estimatedNetProfit ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
            <span className="text-base font-bold text-foreground truncate">
              {job.pickupPostcode} → {job.dropoffPostcode}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {job.estimatedDistanceMiles && (
              <span className="flex items-center gap-0.5">
                <Navigation size={10} /> {job.estimatedDistanceMiles.toFixed(1)} mi
              </span>
            )}
            {job.estimatedDurationMins && (
              <span className="flex items-center gap-0.5">
                <Clock size={10} /> {Math.floor(job.estimatedDurationMins / 60)}h {Math.round(job.estimatedDurationMins % 60)}m
              </span>
            )}
            {job.brokerName && (
              <span className="flex items-center gap-0.5 truncate">
                <Building2 size={10} /> {job.brokerName}
              </span>
            )}
          </div>
          {job.scheduledPickupAt && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CalendarDays size={10} />
              {new Date(job.scheduledPickupAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-lg font-bold font-mono text-primary">£{job.deliveryFee.toFixed(0)}</p>
          <p className={cn("text-xs font-mono", netProfit >= 0 ? "text-primary/70" : "text-destructive")}>
            {netProfit >= 0 ? "+" : ""}£{netProfit.toFixed(0)} net
          </p>
          <WorthItBadge score={job.worthItScore} />
        </div>
      </div>
    </button>
  );
}

// ─── Main Jobs Page ───────────────────────────────────────────────────────────

const STATUS_TABS: { key: JobStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "planned", label: "Planned" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

export default function Jobs() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<JobStatus | "all">("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showAddJob, setShowAddJob] = useState(false);
  const [search, setSearch] = useState("");

  const { data: jobsData, refetch } = trpc.jobs.list.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

  const updateMutation = trpc.jobs.update.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteMutation = trpc.jobs.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Job deleted"); },
  });

  const allJobs = (jobsData?.jobs ?? []) as Job[];

  const filteredJobs = allJobs.filter(j => {
    if (activeTab !== "all" && j.status !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        j.pickupPostcode.toLowerCase().includes(q) ||
        j.dropoffPostcode.toLowerCase().includes(q) ||
        (j.brokerName ?? "").toLowerCase().includes(q) ||
        (j.jobReference ?? "").toLowerCase().includes(q) ||
        (j.vehicleReg ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary stats for current tab
  const totalEarnings = filteredJobs.reduce((s, j) => s + j.deliveryFee, 0);
  const totalProfit = filteredJobs.reduce((s, j) => s + (j.actualNetProfit ?? j.estimatedNetProfit ?? 0), 0);
  const totalMiles = filteredJobs.reduce((s, j) => s + (j.actualDistanceMiles ?? j.estimatedDistanceMiles ?? 0), 0);

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Briefcase size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Your Jobs</h2>
          <p className="text-muted-foreground text-sm">Sign in to manage and track all your jobs</p>
        </div>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="w-full max-w-xs">
          Sign In to Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-0 flex flex-col min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Briefcase size={15} className="text-primary" />
            </div>
            <h1 className="text-lg font-bold">Jobs</h1>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {allJobs.length}
            </span>
          </div>
          <Button size="sm" onClick={() => setShowAddJob(true)} className="gap-1.5">
            <Plus size={15} /> Add Job
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by postcode, broker, reg..."
            className="pl-8 text-sm"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {STATUS_TABS.map(tab => {
            const count = tab.key === "all" ? allJobs.length : allJobs.filter(j => j.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] px-1 rounded-full",
                    activeTab === tab.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip */}
      {filteredJobs.length > 0 && (
        <div className="flex gap-3 px-4 py-3 border-b border-border/50 bg-secondary/30">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Earnings</p>
            <p className="text-sm font-bold font-mono text-primary">£{totalEarnings.toFixed(0)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Net Profit</p>
            <p className={cn("text-sm font-bold font-mono", totalProfit >= 0 ? "text-primary" : "text-destructive")}>
              {totalProfit >= 0 ? "+" : ""}£{totalProfit.toFixed(0)}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Miles</p>
            <p className="text-sm font-bold font-mono">{totalMiles.toFixed(0)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground">Jobs</p>
            <p className="text-sm font-bold font-mono">{filteredJobs.length}</p>
          </div>
        </div>
      )}

      {/* Job list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No jobs match your search" : activeTab === "all" ? "No jobs yet" : `No ${activeTab} jobs`}
            </p>
            {!search && activeTab === "all" && (
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowAddJob(true)}>
                <Plus size={14} /> Add Your First Job
              </Button>
            )}
          </div>
        ) : (
          filteredJobs.map(job => (
            <JobListItem key={job.id} job={job} onClick={() => setSelectedJob(job)} />
          ))
        )}
      </div>

      {/* Sheets */}
      {selectedJob && (
        <JobDetailSheet
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onStatusChange={(id, status) => updateMutation.mutate({ id, status })}
          onDelete={(id) => deleteMutation.mutate({ id })}
        />
      )}
      {showAddJob && (
        <AddJobSheet onClose={() => setShowAddJob(false)} onSaved={() => refetch()} />
      )}
    </div>
  );
}
