import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Car, MapPin, PoundSterling, Fuel, Clock, ChevronDown, ChevronUp,
  Save, Zap, Camera, X, CheckCircle2, AlertCircle, Loader2, Sparkles,
  Building2, Hash, Route, FileText, Plus, Trash2, Train, Receipt,
  TrendingUp, TrendingDown, Link2, Navigation
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateJobCost } from "../../../shared/routepilot-types";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobSlot {
  id: string;
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: string;
  fuelDeposit: string;
  fuelReimbursed: boolean;
  brokerFeePercent: string;
  brokerName?: string;
  jobReference?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleReg?: string;
  vehicleFuelType?: string;
  vehicleColour?: string;
  scannedDistanceMiles?: number;
  scannedDurationMins?: number;
  bookingImageUrl?: string;
  scheduledDate?: string;
}

interface TravelExpenses {
  travelToJobCost: string;
  travelToJobMode: string;
  travelHomeCost: string;
  travelHomeMode: string;
  travelHomePostcode: string;
}

interface CalcSettings {
  vehicleMpg: number;
  hourlyRate: number;
  wearTearPerMile: number;
  riskBufferPercent: number;
  enableTimeValue: boolean;
  enableWearTear: boolean;
}

type ScanState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "extracting" }
  | { status: "preview"; data: ScanResult; targetJobId: string }
  | { status: "error"; message: string };

interface ScanResult {
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: number;
  fuelDeposit: number;
  distanceMiles: number;
  durationMins: number;
  pickupAddress: string;
  dropoffAddress: string;
  brokerName: string;
  scheduledDate: string;
  jobReference: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleReg?: string;
  vehicleColour?: string;
  vehicleFuelType?: string;
  confidence: number;
  imageUrl?: string;
}

type ReceiptScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; data: ReceiptResult }
  | { status: "error"; message: string };

interface ReceiptResult {
  merchantName?: string;
  receiptDate?: string;
  totalAmount?: number;
  category?: string;
  fuelLitres?: number;
  fuelPricePerLitre?: number;
  fuelType?: string;
  notes?: string;
  confidence?: number;
  imageUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJobSlot(): JobSlot {
  return {
    id: Math.random().toString(36).slice(2),
    pickupPostcode: "",
    dropoffPostcode: "",
    deliveryFee: "",
    fuelDeposit: "0",
    fuelReimbursed: false,
    brokerFeePercent: "0",
  };
}

const TRAVEL_MODE_LABELS: Record<string, string> = {
  none: "None",
  train: "Train",
  bus: "Bus",
  taxi: "Taxi",
  own_car: "Own Car",
};

function WorthItBadge({ score }: { score: "green" | "amber" | "red" }) {
  const config = {
    green: { label: "Worth It ✓", className: "badge-green" },
    amber: { label: "Marginal ⚠", className: "badge-amber" },
    red: { label: "Not Worth It ✗", className: "badge-red" },
  };
  const { label, className } = config[score];
  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold", className)}>
      {label}
    </span>
  );
}

type Grade = "A+" | "A" | "B" | "C" | "D";

function GradeChip({ grade, score }: { grade: Grade; score: number }) {
  const config: Record<Grade, { bg: string; text: string; ring: string }> = {
    "A+": { bg: "bg-emerald-500/20", text: "text-emerald-400", ring: "ring-emerald-500/40" },
    "A":  { bg: "bg-green-500/20",   text: "text-green-400",   ring: "ring-green-500/40" },
    "B":  { bg: "bg-blue-500/20",    text: "text-blue-400",    ring: "ring-blue-500/40" },
    "C":  { bg: "bg-amber-500/20",   text: "text-amber-400",   ring: "ring-amber-500/40" },
    "D":  { bg: "bg-red-500/20",     text: "text-red-400",     ring: "ring-red-500/40" },
  };
  const { bg, text, ring } = config[grade];
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl ring-1", bg, ring)}>
      <span className={cn("text-xl font-black font-display leading-none", text)}>{grade}</span>
      <span className={cn("text-xs font-semibold tabular-nums", text)}>{score}</span>
    </div>
  );
}

function ScoreDimensionBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-blue-500" : value >= 35 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Job chain: up to 3 job slots
  const [jobs, setJobs] = useState<JobSlot[]>([makeJobSlot()]);
  const [travel, setTravel] = useState<TravelExpenses>({
    travelToJobCost: "0",
    travelToJobMode: "none",
    travelHomeCost: "0",
    travelHomeMode: "none",
    travelHomePostcode: "",
  });
  const [settings, setSettings] = useState<CalcSettings>({
    vehicleMpg: 35,
    hourlyRate: 15,
    wearTearPerMile: 0.15,
    riskBufferPercent: 10,
    enableTimeValue: true,
    enableWearTear: true,
  });
  const [showTravelExpenses, setShowTravelExpenses] = useState(true);
  const [showCostSettings, setShowCostSettings] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{
    jobId: string;
    distanceMiles: number;
    durationMins: number;
    breakdown: ReturnType<typeof calculateJobCost>;
  }> | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [receiptScan, setReceiptScan] = useState<ReceiptScanState>({ status: "idle" });
  const [showReceiptPanel, setShowReceiptPanel] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const scanTargetRef = useRef<string>("");

  const { data: userSettings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: fuelData } = trpc.fuel.averages.useQuery();
  const { data: draftJobsData } = trpc.jobs.list.useQuery(
    { status: "draft", limit: 5 },
    { enabled: isAuthenticated, staleTime: 30_000 }
  );
  const draftJobs = draftJobsData?.jobs ?? [];
  const calculateMutation = trpc.jobs.calculate.useMutation();
  const createJobMutation = trpc.jobs.create.useMutation();
  const uploadImageMutation = trpc.scan.uploadImage.useMutation();
  const extractBookingMutation = trpc.scan.extractBooking.useMutation();
  const scanReceiptMutation = trpc.receipts.scanReceipt.useMutation();

  useEffect(() => {
    if (userSettings) {
      setSettings({
        vehicleMpg: userSettings.vehicleMpg,
        hourlyRate: userSettings.hourlyRate,
        wearTearPerMile: userSettings.wearTearPerMile,
        riskBufferPercent: userSettings.riskBufferPercent,
        enableTimeValue: userSettings.enableTimeValue,
        enableWearTear: userSettings.enableWearTear,
      });
    }
  }, [userSettings]);

  // ── Job slot helpers ──────────────────────────────────────────────────────

  const updateJob = (id: string, key: keyof JobSlot, value: string | number | boolean | undefined) =>
    setJobs(prev => prev.map(j => j.id === id ? { ...j, [key]: value } : j));

  const addJob = () => {
    if (jobs.length >= 3) { toast.info("Maximum 3 jobs in a chain"); return; }
    // Pre-fill pickup of new job with dropoff of last job
    const last = jobs[jobs.length - 1];
    const newJob = makeJobSlot();
    if (last?.dropoffPostcode) newJob.pickupPostcode = last.dropoffPostcode;
    setJobs(prev => [...prev, newJob]);
  };

  const removeJob = (id: string) => {
    if (jobs.length === 1) return;
    setJobs(prev => prev.filter(j => j.id !== id));
    setResults(null);
  };

  // ── Scan booking screenshot ───────────────────────────────────────────────

  const handleScanImage = async (file: File, jobId: string) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image too large (max 10MB)"); return; }

    const localUrl = URL.createObjectURL(file);
    setPreviewImageUrl(localUrl);
    scanTargetRef.current = jobId;
    setScanState({ status: "uploading" });

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { url: imageUrl } = await uploadImageMutation.mutateAsync({ base64Data, mimeType: file.type });
      setScanState({ status: "extracting" });
      const extracted = await extractBookingMutation.mutateAsync({ imageUrl });
      setScanState({ status: "preview", data: { ...extracted, imageUrl }, targetJobId: jobId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      setScanState({ status: "error", message });
      toast.error(message);
    }
  };

  const applyScannedData = (data: ScanResult, jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? {
      ...j,
      pickupPostcode: data.pickupPostcode || j.pickupPostcode,
      dropoffPostcode: data.dropoffPostcode || j.dropoffPostcode,
      deliveryFee: data.deliveryFee > 0 ? data.deliveryFee.toString() : j.deliveryFee,
      fuelDeposit: data.fuelDeposit > 0 ? data.fuelDeposit.toString() : j.fuelDeposit,
      brokerName: data.brokerName || j.brokerName,
      jobReference: data.jobReference || j.jobReference,
      pickupAddress: data.pickupAddress || j.pickupAddress,
      dropoffAddress: data.dropoffAddress || j.dropoffAddress,
      vehicleMake: data.vehicleMake || j.vehicleMake,
      vehicleModel: data.vehicleModel || j.vehicleModel,
      vehicleReg: data.vehicleReg || j.vehicleReg,
      vehicleColour: data.vehicleColour || j.vehicleColour,
      vehicleFuelType: data.vehicleFuelType || j.vehicleFuelType,
      scannedDistanceMiles: data.distanceMiles || j.scannedDistanceMiles,
      scannedDurationMins: data.durationMins || j.scannedDurationMins,
      bookingImageUrl: data.imageUrl || j.bookingImageUrl,
      scheduledDate: data.scheduledDate || j.scheduledDate,
    } : j));
    setScanState({ status: "idle" });
    setPreviewImageUrl(null);
    setResults(null);
    toast.success("Booking details filled in!");
  };

  // ── Scan receipt ──────────────────────────────────────────────────────────

  const handleReceiptScan = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setReceiptScan({ status: "scanning" });
    setShowReceiptPanel(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await scanReceiptMutation.mutateAsync({ base64Data, mimeType: file.type });
      setReceiptScan({ status: "done", data: result });
      toast.success("Receipt scanned successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Receipt scan failed";
      setReceiptScan({ status: "error", message });
      toast.error(message);
    }
  };

  // ── Calculate ─────────────────────────────────────────────────────────────

  const handleCalculate = async () => {
    const firstJob = jobs[0];
    if (!firstJob?.pickupPostcode || !firstJob?.dropoffPostcode || !firstJob?.deliveryFee) {
      toast.error("Please fill in postcode and delivery fee for the first job");
      return;
    }

    try {
      const calcResults = await Promise.all(jobs.map(async (job, idx) => {
        if (!job.pickupPostcode || !job.dropoffPostcode || !job.deliveryFee) return null;
        const res = await calculateMutation.mutateAsync({
          pickupPostcode: job.pickupPostcode,
          dropoffPostcode: job.dropoffPostcode,
          deliveryFee: parseFloat(job.deliveryFee) || 0,
          fuelDeposit: parseFloat(job.fuelDeposit) || 0,
          brokerFeePercent: parseFloat(job.brokerFeePercent) || 0,
          fuelReimbursed: job.fuelReimbursed,
          // Travel expenses only on first job (to-job) and last job (home)
          travelToJobCost: idx === 0 ? (parseFloat(travel.travelToJobCost) || 0) : 0,
          travelToJobMode: idx === 0 ? (travel.travelToJobMode as "train" | "bus" | "taxi" | "own_car" | "none") : "none",
          travelHomeCost: idx === jobs.length - 1 ? (parseFloat(travel.travelHomeCost) || 0) : 0,
          travelHomeMode: idx === jobs.length - 1 ? (travel.travelHomeMode as "train" | "bus" | "taxi" | "own_car" | "none") : "none",
          vehicleMpg: settings.vehicleMpg,
          hourlyRate: settings.hourlyRate,
          wearTearPerMile: settings.wearTearPerMile,
          riskBufferPercent: settings.riskBufferPercent,
          enableTimeValue: settings.enableTimeValue,
          enableWearTear: settings.enableWearTear,
          fuelPricePerLitre: fuelData?.petrolPencePerLitre,
        });
        return { jobId: job.id, ...res };
      }));

      const valid = calcResults.filter(Boolean) as Array<{
        jobId: string;
        distanceMiles: number;
        durationMins: number;
        breakdown: ReturnType<typeof calculateJobCost>;
      }>;
      setResults(valid);
    } catch {
      toast.error("Calculation failed. Please check your postcodes.");
    }
  };

  // ── Save all jobs ─────────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    if (!results?.length) { toast.error("Please calculate first"); return; }

    try {
      await Promise.all(jobs.map(async (job, idx) => {
        if (!job.pickupPostcode || !job.dropoffPostcode || !job.deliveryFee) return;
        await createJobMutation.mutateAsync({
          pickupPostcode: job.pickupPostcode,
          dropoffPostcode: job.dropoffPostcode,
          deliveryFee: parseFloat(job.deliveryFee) || 0,
          fuelDeposit: parseFloat(job.fuelDeposit) || 0,
          brokerFeePercent: parseFloat(job.brokerFeePercent) || 0,
          fuelReimbursed: job.fuelReimbursed,
          travelToJobCost: idx === 0 ? (parseFloat(travel.travelToJobCost) || 0) : 0,
          travelToJobMode: idx === 0 ? (travel.travelToJobMode as "train" | "bus" | "taxi" | "own_car" | "none") : "none",
          travelHomeCost: idx === jobs.length - 1 ? (parseFloat(travel.travelHomeCost) || 0) : 0,
          travelHomeMode: idx === jobs.length - 1 ? (travel.travelHomeMode as "train" | "bus" | "taxi" | "own_car" | "none") : "none",
          travelHomePostcode: idx === jobs.length - 1 ? travel.travelHomePostcode || undefined : undefined,
          vehicleMake: job.vehicleMake,
          vehicleModel: job.vehicleModel,
          vehicleReg: job.vehicleReg,
          vehicleFuelType: (job.vehicleFuelType as "petrol" | "diesel" | "electric" | "hybrid" | "unknown") || "unknown",
          vehicleColour: job.vehicleColour,
          brokerName: job.brokerName,
          jobReference: job.jobReference,
          pickupAddress: job.pickupAddress,
          dropoffAddress: job.dropoffAddress,
          bookingImageUrl: job.bookingImageUrl,
          scheduledPickupAt: job.scheduledDate,
          scannedDistanceMiles: job.scannedDistanceMiles,
          scannedDurationMins: job.scannedDurationMins,
        });
      }));
      toast.success(jobs.length > 1 ? `${jobs.length} jobs saved to history!` : "Job saved to history!");
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  // ── Chain totals ──────────────────────────────────────────────────────────

  const chainTotals = results ? {
    totalProfit: results.reduce((s, r) => s + r.breakdown.netProfit, 0),
    totalDistance: results.reduce((s, r) => s + r.distanceMiles, 0),
    totalDuration: results.reduce((s, r) => s + r.durationMins, 0),
    totalIncome: results.reduce((s, r) => s + r.breakdown.grossIncome, 0),
    totalCosts: results.reduce((s, r) => s + r.breakdown.totalCosts, 0),
  } : null;

  const isScanning = scanState.status === "uploading" || scanState.status === "extracting";

  return (
    <div className="pb-28 pt-4">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleScanImage(file, scanTargetRef.current);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
      <input ref={receiptInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleReceiptScan(file);
          if (receiptInputRef.current) receiptInputRef.current.value = "";
        }}
      />

      {/* Draft Jobs Banner */}
      {draftJobs.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-400">
                    {draftJobs.length === 1 ? "1 saved draft" : `${draftJobs.length} saved drafts`}
                  </span>
                </div>
                {draftJobs.slice(0, 2).map((draft) => {
                  const expiresAt = draft.draftExpiresAt ? new Date(draft.draftExpiresAt) : null;
                  const hoursLeft = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3_600_000)) : null;
                  return (
                    <div key={draft.id} className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-foreground truncate">
                        {draft.pickupPostcode} → {draft.dropoffPostcode}
                        {draft.deliveryFee ? ` · £${Number(draft.deliveryFee).toFixed(0)}` : ""}
                      </span>
                      {hoursLeft !== null && (
                        <span className={`text-[10px] font-medium shrink-0 ${
                          hoursLeft <= 2 ? "text-red-400" : "text-amber-400/70"
                        }`}>
                          {hoursLeft <= 0 ? "Expired" : `${hoursLeft}h left`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => navigate("/jobs")}
                className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                Book it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 mb-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Car size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">RoutePilot Pro</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              onClick={() => receiptInputRef.current?.click()}
              className="flex items-center gap-1.5 border-border text-muted-foreground hover:text-foreground h-8 px-2.5"
            >
              <Receipt size={13} />
              <span className="text-xs">Receipt</span>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Calculate your delivery profitability</p>
        {fuelData && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-green" />
            <span className="text-xs text-muted-foreground">
              Live fuel: <span className="text-primary font-medium">{fuelData.petrolPencePerLitre.toFixed(1)}p/L petrol</span>
              {" · "}{fuelData.dieselPencePerLitre.toFixed(1)}p/L diesel
            </span>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">

        {/* Receipt scan panel */}
        {showReceiptPanel && (
          <Card className={cn(
            "border overflow-hidden animate-in fade-in duration-200",
            receiptScan.status === "done" ? "border-primary/40 bg-primary/5" :
            receiptScan.status === "error" ? "border-destructive/40 bg-destructive/5" :
            "border-border bg-card"
          )}>
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt size={14} className="text-primary" />
                  <CardTitle className="text-sm font-semibold">
                    {receiptScan.status === "scanning" ? "Reading receipt..." :
                     receiptScan.status === "done" ? "Receipt Scanned" :
                     receiptScan.status === "error" ? "Scan Failed" : "Receipt"}
                  </CardTitle>
                </div>
                <button onClick={() => setShowReceiptPanel(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              {receiptScan.status === "scanning" && (
                <div className="flex items-center gap-3">
                  <Loader2 size={20} className="animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">AI is reading your receipt...</span>
                </div>
              )}
              {receiptScan.status === "done" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    {receiptScan.data.merchantName && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Merchant: </span>
                        <span className="font-semibold text-foreground">{receiptScan.data.merchantName}</span>
                      </div>
                    )}
                    {receiptScan.data.totalAmount != null && (
                      <div>
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-mono font-bold text-primary">£{receiptScan.data.totalAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {receiptScan.data.category && (
                      <div>
                        <span className="text-muted-foreground">Type: </span>
                        <Badge variant="secondary" className="text-xs capitalize">{receiptScan.data.category}</Badge>
                      </div>
                    )}
                    {receiptScan.data.fuelLitres != null && (
                      <div>
                        <span className="text-muted-foreground">Litres: </span>
                        <span className="font-mono text-foreground">{receiptScan.data.fuelLitres.toFixed(2)}L</span>
                      </div>
                    )}
                    {receiptScan.data.fuelPricePerLitre != null && (
                      <div>
                        <span className="text-muted-foreground">p/L: </span>
                        <span className="font-mono text-foreground">{(receiptScan.data.fuelPricePerLitre * 100).toFixed(1)}p</span>
                      </div>
                    )}
                    {receiptScan.data.receiptDate && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Date: </span>
                        <span className="text-foreground text-xs">
                          {new Date(receiptScan.data.receiptDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Receipt saved to your account. Attach it to a job in History.</p>
                </div>
              )}
              {receiptScan.status === "error" && (
                <div>
                  <p className="text-sm text-destructive mb-2">{receiptScan.message}</p>
                  <Button size="sm" variant="outline" onClick={() => receiptInputRef.current?.click()}>Try Again</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scan preview card */}
        {(isScanning || scanState.status === "preview" || scanState.status === "error") && (
          <Card className={cn(
            "border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
            scanState.status === "preview" ? "border-primary/50 bg-primary/5" :
            scanState.status === "error" ? "border-destructive/50 bg-destructive/5" :
            "border-border bg-card"
          )}>
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className={cn(isScanning ? "text-muted-foreground animate-pulse" : "text-primary")} />
                  <CardTitle className="text-sm font-semibold">
                    {isScanning ? (scanState.status === "uploading" ? "Uploading..." : "AI reading booking...") :
                     scanState.status === "preview" ? "Booking Detected" : "Scan Failed"}
                  </CardTitle>
                </div>
                <button onClick={() => { setScanState({ status: "idle" }); setPreviewImageUrl(null); }}
                  className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
            </CardHeader>
            {isScanning && (
              <CardContent className="pb-3">
                <div className="flex items-center gap-3">
                  {previewImageUrl && <img src={previewImageUrl} alt="Booking" className="w-16 h-20 object-cover rounded-md border border-border" />}
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-secondary rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
                    <div className="h-3 bg-secondary rounded animate-pulse w-2/3" />
                  </div>
                </div>
              </CardContent>
            )}
            {scanState.status === "preview" && (
              <CardContent className="pb-3 space-y-3">
                <div className="flex gap-3">
                  {previewImageUrl && <img src={previewImageUrl} alt="Booking" className="w-16 h-20 object-cover rounded-md border border-border flex-shrink-0" />}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {scanState.data.brokerName && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Building2 size={10} />{scanState.data.brokerName}
                        </Badge>
                        {scanState.data.jobReference && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Hash size={10} />{scanState.data.jobReference}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Vehicle details from scan */}
                    {(scanState.data.vehicleReg || scanState.data.vehicleMake) && (
                      <div className="flex items-center gap-1.5">
                        <Car size={11} className="text-muted-foreground" />
                        <span className="text-xs text-foreground font-medium">
                          {[scanState.data.vehicleColour, scanState.data.vehicleMake, scanState.data.vehicleModel].filter(Boolean).join(" ")}
                          {scanState.data.vehicleReg && <span className="ml-1.5 font-mono bg-secondary px-1.5 py-0.5 rounded text-xs">{scanState.data.vehicleReg}</span>}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {scanState.data.pickupPostcode && <div><span className="text-muted-foreground">From: </span><span className="font-mono font-semibold">{scanState.data.pickupPostcode}</span></div>}
                      {scanState.data.dropoffPostcode && <div><span className="text-muted-foreground">To: </span><span className="font-mono font-semibold">{scanState.data.dropoffPostcode}</span></div>}
                      {scanState.data.deliveryFee > 0 && <div><span className="text-muted-foreground">Fee: </span><span className="font-mono font-semibold text-primary">£{scanState.data.deliveryFee.toFixed(2)}</span></div>}
                      {scanState.data.fuelDeposit > 0 && <div><span className="text-muted-foreground">Fuel dep: </span><span className="font-mono font-semibold">£{scanState.data.fuelDeposit.toFixed(2)}</span></div>}
                      {scanState.data.distanceMiles > 0 && <div><span className="text-muted-foreground">Dist: </span><span className="font-mono font-semibold">{scanState.data.distanceMiles} mi</span></div>}
                      {scanState.data.durationMins > 0 && <div><span className="text-muted-foreground">Time: </span><span className="font-mono font-semibold">{Math.floor(scanState.data.durationMins / 60)}h {Math.round(scanState.data.durationMins % 60)}m</span></div>}
                    </div>
                    {scanState.data.pickupAddress && <p className="text-xs text-muted-foreground truncate">↑ {scanState.data.pickupAddress}</p>}
                    {scanState.data.dropoffAddress && <p className="text-xs text-muted-foreground truncate">↓ {scanState.data.dropoffAddress}</p>}
                    <div className="flex items-center gap-1.5 mt-1">
                      {scanState.data.confidence >= 0.8 ? <CheckCircle2 size={11} className="text-primary" /> : <AlertCircle size={11} className="text-amber-500" />}
                      <span className="text-xs text-muted-foreground">
                        {scanState.data.confidence >= 0.8 ? "High confidence" : scanState.data.confidence >= 0.5 ? "Please verify" : "Low confidence — check carefully"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => applyScannedData(scanState.data, scanState.targetJobId)}
                    size="sm" className="flex-1 bg-primary text-primary-foreground h-9">
                    <CheckCircle2 size={14} className="mr-1.5" />Use These Details
                  </Button>
                  <Button onClick={() => { setScanState({ status: "idle" }); setPreviewImageUrl(null); }}
                    variant="outline" size="sm" className="h-9 border-border">Dismiss</Button>
                </div>
              </CardContent>
            )}
            {scanState.status === "error" && (
              <CardContent className="pb-3">
                <p className="text-sm text-destructive mb-3">{scanState.message}</p>
                <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">Try Again</Button>
              </CardContent>
            )}
          </Card>
        )}

        {/* Job slots */}
        {jobs.map((job, idx) => (
          <div key={job.id} className="space-y-0">
            {/* Chain connector */}
            {idx > 0 && (
              <div className="flex items-center gap-2 py-1.5 px-2">
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  <Link2 size={11} />
                  <span>Job {idx + 1} — picks up from {jobs[idx - 1]?.dropoffPostcode || "previous dropoff"}</span>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            <Card className="bg-card border-border">
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      idx === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    )}>{idx + 1}</div>
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {jobs.length > 1 ? `Job ${idx + 1}` : "Job Details"}
                    </CardTitle>
                    {job.brokerName && <Badge variant="secondary" className="text-xs">{job.brokerName}</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Scan booking button per job */}
                    <Button variant="ghost" size="sm"
                      onClick={() => { scanTargetRef.current = job.id; fileInputRef.current?.click(); }}
                      disabled={isScanning}
                      className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                    >
                      {isScanning && scanTargetRef.current === job.id ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                      <span className="ml-1">Scan</span>
                    </Button>
                    {jobs.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeJob(job.id)}
                        className="h-7 px-2 text-destructive hover:bg-destructive/10">
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Postcodes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Pickup Postcode</Label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="e.g. MK1 1DF" value={job.pickupPostcode}
                        onChange={e => updateJob(job.id, "pickupPostcode", e.target.value.toUpperCase())}
                        className="pl-8 bg-input border-border text-sm uppercase" maxLength={8} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Dropoff Postcode</Label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                      <Input placeholder="e.g. CR0 4YL" value={job.dropoffPostcode}
                        onChange={e => updateJob(job.id, "dropoffPostcode", e.target.value.toUpperCase())}
                        className="pl-8 bg-input border-border text-sm uppercase" maxLength={8} />
                    </div>
                  </div>
                </div>

                {/* Fees */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Delivery Fee (£)</Label>
                    <div className="relative">
                      <PoundSterling size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="number" placeholder="0.00" value={job.deliveryFee}
                        onChange={e => updateJob(job.id, "deliveryFee", e.target.value)}
                        className="pl-8 bg-input border-border text-sm" min="0" step="0.01" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                      Fuel Deposit (£)
                      <span className="text-primary text-xs font-normal">(+income)</span>
                    </Label>
                    <div className="relative">
                      <Fuel size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                      <Input type="number" placeholder="0.00" value={job.fuelDeposit}
                        onChange={e => updateJob(job.id, "fuelDeposit", e.target.value)}
                        className="pl-8 bg-input border-primary/30 text-sm" min="0" step="0.01" />
                    </div>
                  </div>
                </div>

                {/* Fuel reimbursed toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Fuel Reimbursed / Card</p>
                    <p className="text-xs text-muted-foreground">Company fuel card or reimbursed fuel</p>
                  </div>
                  <Switch checked={job.fuelReimbursed} onCheckedChange={v => updateJob(job.id, "fuelReimbursed", v)} />
                </div>

                {/* Vehicle details toggle */}
                <button
                  onClick={() => setShowVehicleDetails(showVehicleDetails === job.id ? null : job.id)}
                  className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Car size={12} />
                    Vehicle Details
                    {job.vehicleReg && <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-foreground">{job.vehicleReg}</span>}
                    {job.vehicleMake && !job.vehicleReg && <span className="text-foreground">{job.vehicleMake} {job.vehicleModel}</span>}
                  </span>
                  {showVehicleDetails === job.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showVehicleDetails === job.id && (
                  <div className="space-y-3 pt-1 border-t border-border">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Make</Label>
                        <Input placeholder="e.g. BMW" value={job.vehicleMake || ""}
                          onChange={e => updateJob(job.id, "vehicleMake", e.target.value)}
                          className="bg-input border-border text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Model</Label>
                        <Input placeholder="e.g. 3 Series" value={job.vehicleModel || ""}
                          onChange={e => updateJob(job.id, "vehicleModel", e.target.value)}
                          className="bg-input border-border text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Registration</Label>
                        <Input placeholder="e.g. AB12 CDE" value={job.vehicleReg || ""}
                          onChange={e => updateJob(job.id, "vehicleReg", e.target.value.toUpperCase())}
                          className="bg-input border-border text-sm uppercase" maxLength={8} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Colour</Label>
                        <Input placeholder="e.g. Silver" value={job.vehicleColour || ""}
                          onChange={e => updateJob(job.id, "vehicleColour", e.target.value)}
                          className="bg-input border-border text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Fuel Type</Label>
                      <Select value={job.vehicleFuelType || "unknown"}
                        onValueChange={v => updateJob(job.id, "vehicleFuelType", v)}>
                        <SelectTrigger className="bg-input border-border text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="petrol">Petrol</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Job sheet summary if scanned */}
                {(job.brokerName || job.jobReference || job.pickupAddress) && (
                  <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1 text-xs">
                    {job.brokerName && <div className="flex justify-between"><span className="text-muted-foreground">Broker</span><span className="font-medium">{job.brokerName}</span></div>}
                    {job.jobReference && <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span className="font-mono">{job.jobReference}</span></div>}
                    {job.pickupAddress && <p className="text-muted-foreground truncate">↑ {job.pickupAddress}</p>}
                    {job.dropoffAddress && <p className="text-muted-foreground truncate">↓ {job.dropoffAddress}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Add job button */}
        {jobs.length < 3 && (
          <Button variant="outline" onClick={addJob}
            className="w-full border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary h-10">
            <Plus size={15} className="mr-2" />
            Add Another Job to Chain
          </Button>
        )}

        {/* Travel Expenses */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTravelExpenses(s => !s)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Train size={14} className="text-muted-foreground" />
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Travel Expenses
                </CardTitle>
                {(parseFloat(travel.travelToJobCost) > 0 || parseFloat(travel.travelHomeCost) > 0) && (
                  <Badge variant="secondary" className="text-xs">
                    -£{(parseFloat(travel.travelToJobCost || "0") + parseFloat(travel.travelHomeCost || "0")).toFixed(2)}
                  </Badge>
                )}
              </div>
              {showTravelExpenses ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </CardHeader>
          {showTravelExpenses && (
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Cost to get to the first job and home (or to your next job) after the last dropoff. These are deducted from your total profit.</p>

              {/* Travel to job */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Getting to Job 1 (from home)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary px-2 gap-1"
                    onClick={() => {
                      const homePostcode = travel.travelHomePostcode || "";
                      const firstPickup = jobs[0]?.pickupPostcode || "";
                      const params = new URLSearchParams();
                      if (homePostcode) params.set("from", homePostcode);
                      if (firstPickup) params.set("to", firstPickup);
                      window.location.href = `/routes?${params.toString()}`;
                    }}
                  >
                    <Navigation size={11} /> Find Route
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <PoundSterling size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" placeholder="0.00" value={travel.travelToJobCost}
                      onChange={e => setTravel(t => ({ ...t, travelToJobCost: e.target.value }))}
                      className="pl-8 bg-input border-border text-sm" min="0" step="0.01" />
                  </div>
                  <Select value={travel.travelToJobMode} onValueChange={v => setTravel(t => ({ ...t, travelToJobMode: v }))}>
                    <SelectTrigger className="bg-input border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRAVEL_MODE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Travel home */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Getting home after last dropoff</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary px-2 gap-1"
                    onClick={() => {
                      const lastDropoff = jobs[jobs.length - 1]?.dropoffPostcode || "";
                      const homePostcode = travel.travelHomePostcode || "";
                      const params = new URLSearchParams();
                      if (lastDropoff) params.set("from", lastDropoff);
                      if (homePostcode) params.set("to", homePostcode);
                      window.location.href = `/routes?${params.toString()}`;
                    }}
                  >
                    <Navigation size={11} /> Find Route
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <PoundSterling size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" placeholder="0.00" value={travel.travelHomeCost}
                      onChange={e => setTravel(t => ({ ...t, travelHomeCost: e.target.value }))}
                      className="pl-8 bg-input border-border text-sm" min="0" step="0.01" />
                  </div>
                  <Select value={travel.travelHomeMode} onValueChange={v => setTravel(t => ({ ...t, travelHomeMode: v }))}>
                    <SelectTrigger className="bg-input border-border text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRAVEL_MODE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Home postcode (optional)" value={travel.travelHomePostcode}
                    onChange={e => setTravel(t => ({ ...t, travelHomePostcode: e.target.value.toUpperCase() }))}
                    className="pl-8 bg-input border-border text-sm uppercase" maxLength={8} />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Vehicle & Cost Settings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowCostSettings(s => !s)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Cost Settings
              </CardTitle>
              {showCostSettings ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </CardHeader>
          {showCostSettings && (
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Vehicle MPG</Label>
                  <span className="text-xs font-mono">{settings.vehicleMpg} mpg</span>
                </div>
                <Slider value={[settings.vehicleMpg]} onValueChange={([v]) => setSettings(s => ({ ...s, vehicleMpg: v! }))} min={10} max={80} step={1} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Time Value</p><p className="text-xs text-muted-foreground">£{settings.hourlyRate}/hr</p></div>
                <Switch checked={settings.enableTimeValue} onCheckedChange={v => setSettings(s => ({ ...s, enableTimeValue: v }))} />
              </div>
              {settings.enableTimeValue && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Hourly Rate</Label>
                    <span className="text-xs font-mono">£{settings.hourlyRate}/hr</span>
                  </div>
                  <Slider value={[settings.hourlyRate]} onValueChange={([v]) => setSettings(s => ({ ...s, hourlyRate: v! }))} min={5} max={50} step={1} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Wear & Tear</p><p className="text-xs text-muted-foreground">£{settings.wearTearPerMile.toFixed(2)}/mile</p></div>
                <Switch checked={settings.enableWearTear} onCheckedChange={v => setSettings(s => ({ ...s, enableWearTear: v }))} />
              </div>
              {settings.enableWearTear && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Per-mile cost</Label>
                    <span className="text-xs font-mono">£{settings.wearTearPerMile.toFixed(2)}/mi</span>
                  </div>
                  <Slider value={[settings.wearTearPerMile * 100]} onValueChange={([v]) => setSettings(s => ({ ...s, wearTearPerMile: v! / 100 }))} min={5} max={50} step={1} />
                </div>
              )}
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Risk Buffer</Label>
                  <span className="text-xs font-mono">{settings.riskBufferPercent}%</span>
                </div>
                <Slider value={[settings.riskBufferPercent]} onValueChange={([v]) => setSettings(s => ({ ...s, riskBufferPercent: v! }))} min={0} max={30} step={1} />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Calculate Button */}
        <Button onClick={handleCalculate} disabled={calculateMutation.isPending}
          className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
          {calculateMutation.isPending
            ? <span className="flex items-center gap-2"><Zap size={18} className="animate-pulse" /> Calculating...</span>
            : <span className="flex items-center gap-2"><Zap size={18} /> Calculate {jobs.length > 1 ? `Chain of ${jobs.length} Jobs` : "Profit"}</span>}
        </Button>

        {/* Results */}
        {results && chainTotals && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Chain summary (shown when >1 job) */}
            {results.length > 1 && (
              <Card className="bg-card border-primary/30 overflow-hidden">
                <div className="h-1.5 bg-primary" />
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Chain Total Profit</p>
                      <p className={cn("text-4xl font-bold font-mono profit-glow",
                        chainTotals.totalProfit >= 0 ? "text-primary" : "text-destructive")}>
                        {chainTotals.totalProfit >= 0 ? "+" : ""}£{chainTotals.totalProfit.toFixed(2)}
                      </p>
                    </div>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                      {results.length} Jobs
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-secondary rounded-lg p-2.5 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">£/hr</p>
                      <p className="text-base font-bold font-mono text-primary">
                        £{chainTotals.totalDuration > 0 ? ((chainTotals.totalProfit / chainTotals.totalDuration) * 60).toFixed(2) : "0.00"}
                      </p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2.5 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Total mi</p>
                      <p className="text-base font-bold font-mono text-foreground">{chainTotals.totalDistance.toFixed(0)}mi</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2.5 text-center">
                      <p className="text-xs text-muted-foreground mb-0.5">Total time</p>
                      <p className="text-base font-bold font-mono text-foreground">
                        {Math.floor(chainTotals.totalDuration / 60)}h{Math.round(chainTotals.totalDuration % 60)}m
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><TrendingUp size={11} className="text-primary" /> Income: <span className="text-primary font-mono ml-0.5">+£{chainTotals.totalIncome.toFixed(2)}</span></span>
                    <span className="flex items-center gap-1"><TrendingDown size={11} className="text-destructive" /> Costs: <span className="font-mono ml-0.5">-£{chainTotals.totalCosts.toFixed(2)}</span></span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Individual job results */}
            {results.map((res, idx) => {
              const job = jobs.find(j => j.id === res.jobId);
              return (
                <Card key={res.jobId} className="bg-card border-border overflow-hidden">
                  <div className={cn("h-1.5",
                    (res.breakdown.grade === "A+" || res.breakdown.grade === "A") && "bg-emerald-500",
                    res.breakdown.grade === "B" && "bg-blue-500",
                    res.breakdown.grade === "C" && "bg-amber-500",
                    res.breakdown.grade === "D" && "bg-red-500",
                  )} />
                  <CardContent className="pt-3">
                    {/* Job header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {results.length > 1 && (
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{idx + 1}</div>
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {job?.pickupPostcode} → {job?.dropoffPostcode}
                        </span>
                        {job?.vehicleReg && (
                          <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{job.vehicleReg}</span>
                        )}
                      </div>
                      <GradeChip grade={res.breakdown.grade as Grade} score={res.breakdown.compositeScore} />
                    </div>

                    {/* Vehicle details on card */}
                    {(job?.vehicleMake || job?.vehicleModel || job?.vehicleColour || job?.vehicleFuelType) && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-2.5 py-2">
                        <Car size={12} className="text-muted-foreground flex-shrink-0" />
                        <span>
                          {[job?.vehicleColour, job?.vehicleMake, job?.vehicleModel].filter(Boolean).join(" ")}
                          {job?.vehicleFuelType && job.vehicleFuelType !== "unknown" && (
                            <span className="ml-1.5 capitalize text-muted-foreground/70">({job.vehicleFuelType})</span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Profit */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Net Profit</p>
                        <p className={cn("text-3xl font-bold font-mono",
                          res.breakdown.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                          {res.breakdown.netProfit >= 0 ? "+" : ""}£{res.breakdown.netProfit.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{res.distanceMiles.toFixed(1)} mi</p>
                        <p>{Math.round(res.durationMins)} min</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-secondary rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Per Hour</p>
                        <p className={cn("text-sm font-bold font-mono",
                          res.breakdown.profitPerHour >= 15 ? "text-primary" : "text-muted-foreground")}>
                          £{res.breakdown.profitPerHour.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-secondary rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Per Mile</p>
                        <p className="text-sm font-bold font-mono text-foreground">£{res.breakdown.profitPerMile.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Score dimensions */}
                    <div className="bg-secondary/40 rounded-xl p-3 mb-3 space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Score Breakdown</p>
                      <ScoreDimensionBar label="£/mile" value={res.breakdown.scoreDimensions.ppmScore} />
                      <ScoreDimensionBar label="Net profit" value={res.breakdown.scoreDimensions.netProfitScore} />
                      <ScoreDimensionBar label="Travel ratio" value={res.breakdown.scoreDimensions.transportRatioScore} />
                      <ScoreDimensionBar label="£/hour" value={res.breakdown.scoreDimensions.pphScore} />
                      <ScoreDimensionBar label="Efficiency" value={res.breakdown.scoreDimensions.efficiencyScore} />
                    </div>

                    {/* Improvement tips */}
                    {res.breakdown.improvementTips.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {res.breakdown.improvementTips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-2.5 py-2">
                            <span className="text-primary shrink-0 mt-0.5">→</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cost breakdown */}
                    <div className="space-y-1.5 text-sm border-t border-border pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery Fee</span>
                        <span className="font-mono text-primary">+£{res.breakdown.deliveryFee.toFixed(2)}</span>
                      </div>
                      {res.breakdown.fuelDeposit > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            Fuel Deposit <span className="text-xs text-primary">(reimbursed)</span>
                          </span>
                          <span className="font-mono text-primary">+£{res.breakdown.fuelDeposit.toFixed(2)}</span>
                        </div>
                      )}
                      {res.breakdown.fuelCost > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            Fuel Cost <span className="text-xs text-blue-400">(claimed back)</span>
                          </span>
                          <span className="font-mono text-muted-foreground">£{res.breakdown.fuelCost.toFixed(2)}</span>
                        </div>
                      )}
                      {res.breakdown.brokerFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Broker Fee</span>
                          <span className="font-mono">-£{res.breakdown.brokerFee.toFixed(2)}</span>
                        </div>
                      )}
                      {res.breakdown.travelToJobCost > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Train size={11} /> Travel to Job
                          </span>
                          <span className="font-mono">-£{res.breakdown.travelToJobCost.toFixed(2)}</span>
                        </div>
                      )}
                      {res.breakdown.travelHomeCost > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Train size={11} /> Travel Home
                          </span>
                          <span className="font-mono">-£{res.breakdown.travelHomeCost.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator className="my-1.5" />
                      <div className="flex justify-between font-semibold">
                        <span>Net Profit</span>
                        <span className={cn("font-mono", res.breakdown.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                          {res.breakdown.netProfit >= 0 ? "+" : ""}£{res.breakdown.netProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Full job sheet if scanned */}
                    {(job?.brokerName || job?.jobReference || job?.pickupAddress || job?.vehicleReg) && (
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <FileText size={11} /> Job Sheet
                        </p>
                        {job?.brokerName && <div className="flex justify-between text-xs"><span className="text-muted-foreground flex items-center gap-1"><Building2 size={11} /> Broker</span><span className="font-medium">{job.brokerName}</span></div>}
                        {job?.jobReference && <div className="flex justify-between text-xs"><span className="text-muted-foreground flex items-center gap-1"><Hash size={11} /> Reference</span><span className="font-mono">{job.jobReference}</span></div>}
                        {job?.scheduledDate && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Scheduled</span><span>{new Date(job.scheduledDate).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>}
                        {job?.pickupAddress && <p className="text-xs text-muted-foreground truncate">↑ {job.pickupAddress}</p>}
                        {job?.dropoffAddress && <p className="text-xs text-muted-foreground truncate">↓ {job.dropoffAddress}</p>}
                        {(job?.scannedDistanceMiles || job?.scannedDurationMins) && (
                          <div className="flex gap-2 mt-1">
                            {job.scannedDistanceMiles && (
                              <div className="flex-1 bg-secondary rounded p-1.5 text-center">
                                <p className="text-xs text-muted-foreground">Booking dist.</p>
                                <p className="text-xs font-mono font-bold">{job.scannedDistanceMiles} mi</p>
                              </div>
                            )}
                            {job.scannedDurationMins && (
                              <div className="flex-1 bg-secondary rounded p-1.5 text-center">
                                <p className="text-xs text-muted-foreground">Booking time</p>
                                <p className="text-xs font-mono font-bold">{Math.floor(job.scannedDurationMins / 60)}h {Math.round(job.scannedDurationMins % 60)}m</p>
                              </div>
                            )}
                          </div>
                        )}
                        {job?.bookingImageUrl && (
                          <div className="flex items-center gap-2 mt-1">
                            <img src={job.bookingImageUrl} alt="Booking" className="w-10 h-14 object-cover rounded border border-border" />
                            <span className="text-xs text-muted-foreground">Booking screenshot attached</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Save button */}
            <Button onClick={handleSaveAll} disabled={createJobMutation.isPending}
              className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
              <Save size={16} className="mr-2" />
              {createJobMutation.isPending ? "Saving..." :
               jobs.length > 1 ? `Save All ${jobs.length} Jobs to History` : "Save Job to History"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
