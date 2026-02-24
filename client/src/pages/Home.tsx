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
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Car, MapPin, PoundSterling, Fuel, Clock, TrendingUp,
  ChevronDown, ChevronUp, Save, Zap, Camera, X, CheckCircle2,
  AlertCircle, Loader2, Sparkles, Building2, Hash, Route, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateJobCost } from "../../../shared/routepilot-types";

interface CalcState {
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: string;
  fuelDeposit: string;
  brokerFeePercent: string;
  fuelReimbursed: boolean;
  vehicleMpg: number;
  hourlyRate: number;
  wearTearPerMile: number;
  riskBufferPercent: number;
  enableTimeValue: boolean;
  enableWearTear: boolean;
}

const DEFAULT_STATE: CalcState = {
  pickupPostcode: "",
  dropoffPostcode: "",
  deliveryFee: "",
  fuelDeposit: "0",
  brokerFeePercent: "0",
  fuelReimbursed: false,
  vehicleMpg: 35,
  hourlyRate: 15,
  wearTearPerMile: 0.15,
  riskBufferPercent: 10,
  enableTimeValue: true,
  enableWearTear: true,
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

// Scan state type
type ScanState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "extracting" }
  | { status: "preview"; data: ScanResult }
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
  confidence: number;
  imageUrl?: string;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<CalcState>(DEFAULT_STATE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<{
    distanceMiles: number;
    durationMins: number;
    breakdown: ReturnType<typeof calculateJobCost>;
  } | null>(null);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  // Store the full scan data for saving alongside the job
  const [savedScanData, setSavedScanData] = useState<ScanResult | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: fuelData } = trpc.fuel.averages.useQuery();
  const calculateMutation = trpc.jobs.calculate.useMutation();
  const createJobMutation = trpc.jobs.create.useMutation();
  const uploadImageMutation = trpc.scan.uploadImage.useMutation();
  const extractBookingMutation = trpc.scan.extractBooking.useMutation();

  // Apply settings defaults
  useEffect(() => {
    if (settings) {
      setForm(prev => ({
        ...prev,
        vehicleMpg: settings.vehicleMpg,
        hourlyRate: settings.hourlyRate,
        wearTearPerMile: settings.wearTearPerMile,
        riskBufferPercent: settings.riskBufferPercent,
        enableTimeValue: settings.enableTimeValue,
        enableWearTear: settings.enableWearTear,
        brokerFeePercent: settings.defaultBrokerFeePercent.toString(),
      }));
    }
  }, [settings]);

  const fuelPricePerLitre = fuelData
    ? (form.fuelReimbursed ? 0 : (fuelData.petrolPencePerLitre / 100))
    : 1.43;

  // Handle screenshot scan
  const handleScanImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large. Please use an image under 10MB.");
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewImageUrl(localUrl);
    setScanState({ status: "uploading" });

    try {
      // Convert to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setScanState({ status: "uploading" });
      const { url: imageUrl } = await uploadImageMutation.mutateAsync({
        base64Data,
        mimeType: file.type,
      });
      setUploadedImageUrl(imageUrl);

      setScanState({ status: "extracting" });
      const extracted = await extractBookingMutation.mutateAsync({ imageUrl });

      setScanState({ status: "preview", data: { ...extracted, imageUrl } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed. Please try again.";
      setScanState({ status: "error", message });
      toast.error(message);
    }
  };

  // Apply scanned data to form and store it for saving
  const applyScannedData = (data: ScanResult) => {
    setForm(prev => ({
      ...prev,
      pickupPostcode: data.pickupPostcode || prev.pickupPostcode,
      dropoffPostcode: data.dropoffPostcode || prev.dropoffPostcode,
      deliveryFee: data.deliveryFee > 0 ? data.deliveryFee.toString() : prev.deliveryFee,
      fuelDeposit: data.fuelDeposit > 0 ? data.fuelDeposit.toString() : prev.fuelDeposit,
    }));
    // Keep the full scan data so we can persist it when saving
    setSavedScanData(data);
    setScanState({ status: "idle" });
    setPreviewImageUrl(null);
    setResult(null);
    toast.success("Booking details filled in! Check and calculate.");
  };

  const dismissScan = () => {
    setScanState({ status: "idle" });
    setPreviewImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCalculate = async () => {
    if (!form.pickupPostcode || !form.dropoffPostcode || !form.deliveryFee) {
      toast.error("Please fill in pickup postcode, dropoff postcode, and delivery fee");
      return;
    }

    try {
      const res = await calculateMutation.mutateAsync({
        pickupPostcode: form.pickupPostcode,
        dropoffPostcode: form.dropoffPostcode,
        deliveryFee: parseFloat(form.deliveryFee) || 0,
        fuelDeposit: parseFloat(form.fuelDeposit) || 0,
        brokerFeePercent: parseFloat(form.brokerFeePercent) || 0,
        fuelReimbursed: form.fuelReimbursed,
        vehicleMpg: form.vehicleMpg,
        hourlyRate: form.hourlyRate,
        wearTearPerMile: form.wearTearPerMile,
        riskBufferPercent: form.riskBufferPercent,
        enableTimeValue: form.enableTimeValue,
        enableWearTear: form.enableWearTear,
        fuelPricePerLitre: fuelData?.petrolPencePerLitre,
      });
      setResult(res);
    } catch {
      toast.error("Calculation failed. Please check your postcodes.");
    }
  };

  const handleSaveJob = async () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!result) {
      toast.error("Please calculate the job first");
      return;
    }

    try {
      await createJobMutation.mutateAsync({
        pickupPostcode: form.pickupPostcode,
        dropoffPostcode: form.dropoffPostcode,
        deliveryFee: parseFloat(form.deliveryFee) || 0,
        fuelDeposit: parseFloat(form.fuelDeposit) || 0,
        brokerFeePercent: parseFloat(form.brokerFeePercent) || 0,
        fuelReimbursed: form.fuelReimbursed,
        // Pass all scan metadata so it's fully logged
        brokerName: savedScanData?.brokerName || undefined,
        jobReference: savedScanData?.jobReference || undefined,
        pickupAddress: savedScanData?.pickupAddress || undefined,
        dropoffAddress: savedScanData?.dropoffAddress || undefined,
        bookingImageUrl: savedScanData?.imageUrl || uploadedImageUrl || undefined,
        scheduledPickupAt: savedScanData?.scheduledDate || undefined,
        scannedDistanceMiles: savedScanData?.distanceMiles || undefined,
        scannedDurationMins: savedScanData?.durationMins || undefined,
      });
      toast.success("Job saved to history!");
      // Clear scan data after successful save
      setSavedScanData(null);
      setUploadedImageUrl(null);
    } catch {
      toast.error("Failed to save job. Please try again.");
    }
  };

  const update = (key: keyof CalcState, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const isScanning = scanState.status === "uploading" || scanState.status === "extracting";

  return (
    <div className="pb-24 pt-4">
      {/* Hidden file input — no capture attribute so users get full gallery/files/camera choice */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleScanImage(file);
        }}
      />

      {/* Header */}
      <div className="px-4 mb-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Car size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">RoutePilot Pro</h1>
          </div>
          {/* Scan booking button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className="flex items-center gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
          >
            {isScanning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
            <span className="text-xs font-semibold">
              {scanState.status === "uploading" ? "Uploading..." :
               scanState.status === "extracting" ? "Reading..." :
               "Scan Booking"}
            </span>
          </Button>
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

        {/* Saved scan badge — shows when scan data is attached to the current job */}
        {savedScanData && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 animate-in fade-in duration-200">
            <Sparkles size={13} className="text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-primary">Booking scanned</span>
              {savedScanData.brokerName && (
                <span className="text-xs text-muted-foreground ml-1.5">· {savedScanData.brokerName}</span>
              )}
              {savedScanData.jobReference && (
                <span className="text-xs text-muted-foreground ml-1.5">· {savedScanData.jobReference}</span>
              )}
            </div>
            <button
              onClick={() => setSavedScanData(null)}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* AI Scan Preview Card */}
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
                  <Sparkles size={14} className={cn(
                    isScanning ? "text-muted-foreground animate-pulse" : "text-primary"
                  )} />
                  <CardTitle className="text-sm font-semibold">
                    {isScanning ? (
                      scanState.status === "uploading" ? "Uploading image..." : "AI reading your booking..."
                    ) : scanState.status === "preview" ? (
                      "Booking Detected"
                    ) : (
                      "Scan Failed"
                    )}
                  </CardTitle>
                </div>
                <button onClick={dismissScan} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
            </CardHeader>

            {isScanning && (
              <CardContent className="pb-3">
                <div className="flex items-center gap-3">
                  {previewImageUrl && (
                    <img src={previewImageUrl} alt="Booking" className="w-16 h-20 object-cover rounded-md border border-border" />
                  )}
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
                  {previewImageUrl && (
                    <img src={previewImageUrl} alt="Booking" className="w-16 h-20 object-cover rounded-md border border-border flex-shrink-0" />
                  )}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {scanState.data.brokerName && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Building2 size={10} />
                          {scanState.data.brokerName}
                        </Badge>
                        {scanState.data.jobReference && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Hash size={10} />
                            {scanState.data.jobReference}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {scanState.data.pickupPostcode && (
                        <div>
                          <span className="text-muted-foreground">From: </span>
                          <span className="font-mono font-semibold text-foreground">{scanState.data.pickupPostcode}</span>
                        </div>
                      )}
                      {scanState.data.dropoffPostcode && (
                        <div>
                          <span className="text-muted-foreground">To: </span>
                          <span className="font-mono font-semibold text-foreground">{scanState.data.dropoffPostcode}</span>
                        </div>
                      )}
                      {scanState.data.deliveryFee > 0 && (
                        <div>
                          <span className="text-muted-foreground">Fee: </span>
                          <span className="font-mono font-semibold text-primary">£{scanState.data.deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                      {scanState.data.distanceMiles > 0 && (
                        <div>
                          <span className="text-muted-foreground">Distance: </span>
                          <span className="font-mono font-semibold text-foreground">{scanState.data.distanceMiles} mi</span>
                        </div>
                      )}
                      {scanState.data.durationMins > 0 && (
                        <div>
                          <span className="text-muted-foreground">Duration: </span>
                          <span className="font-mono font-semibold text-foreground">
                            {Math.floor(scanState.data.durationMins / 60)}h {Math.round(scanState.data.durationMins % 60)}m
                          </span>
                        </div>
                      )}
                      {scanState.data.fuelDeposit > 0 && (
                        <div>
                          <span className="text-muted-foreground">Fuel dep: </span>
                          <span className="font-mono font-semibold text-foreground">£{scanState.data.fuelDeposit.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    {scanState.data.pickupAddress && (
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="text-muted-foreground/60">↑ </span>{scanState.data.pickupAddress}
                      </p>
                    )}
                    {scanState.data.dropoffAddress && (
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="text-muted-foreground/60">↓ </span>{scanState.data.dropoffAddress}
                      </p>
                    )}
                    {scanState.data.scheduledDate && (
                      <p className="text-xs text-muted-foreground">
                        <span className="text-muted-foreground/60">📅 </span>
                        {new Date(scanState.data.scheduledDate).toLocaleString("en-GB", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    )}
                    {/* Confidence indicator */}
                    <div className="flex items-center gap-1.5 mt-1">
                      {scanState.data.confidence >= 0.8 ? (
                        <CheckCircle2 size={11} className="text-primary" />
                      ) : (
                        <AlertCircle size={11} className="text-amber-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {scanState.data.confidence >= 0.8 ? "High confidence" :
                         scanState.data.confidence >= 0.5 ? "Please verify details" :
                         "Low confidence — check carefully"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => applyScannedData(scanState.data)}
                    size="sm"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-9"
                  >
                    <CheckCircle2 size={14} className="mr-1.5" />
                    Use These Details
                  </Button>
                  <Button
                    onClick={dismissScan}
                    variant="outline"
                    size="sm"
                    className="h-9 border-border"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            )}

            {scanState.status === "error" && (
              <CardContent className="pb-3">
                <p className="text-sm text-destructive mb-3">{scanState.message}</p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  variant="outline"
                  className="border-border"
                >
                  Try Again
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {/* Job Input Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Pickup Postcode</Label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="e.g. SW1A 1AA"
                    value={form.pickupPostcode}
                    onChange={e => update("pickupPostcode", e.target.value.toUpperCase())}
                    className="pl-8 bg-input border-border text-sm uppercase"
                    maxLength={8}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Dropoff Postcode</Label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                  <Input
                    placeholder="e.g. M1 1AE"
                    value={form.dropoffPostcode}
                    onChange={e => update("dropoffPostcode", e.target.value.toUpperCase())}
                    className="pl-8 bg-input border-border text-sm uppercase"
                    maxLength={8}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Delivery Fee (£)</Label>
                <div className="relative">
                  <PoundSterling size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.deliveryFee}
                    onChange={e => update("deliveryFee", e.target.value)}
                    className="pl-8 bg-input border-border text-sm"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Fuel Deposit (£)</Label>
                <div className="relative">
                  <Fuel size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.fuelDeposit}
                    onChange={e => update("fuelDeposit", e.target.value)}
                    className="pl-8 bg-input border-border text-sm"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Fuel Reimbursed / Card</p>
                <p className="text-xs text-muted-foreground">Company fuel card or reimbursed fuel</p>
              </div>
              <Switch
                checked={form.fuelReimbursed}
                onCheckedChange={v => update("fuelReimbursed", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Vehicle & Cost Settings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Vehicle & Cost Settings
              </CardTitle>
              {showAdvanced ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </CardHeader>
          {showAdvanced && (
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Vehicle MPG</Label>
                  <span className="text-xs font-mono text-foreground">{form.vehicleMpg} mpg</span>
                </div>
                <Slider
                  value={[form.vehicleMpg]}
                  onValueChange={([v]) => update("vehicleMpg", v!)}
                  min={10} max={80} step={1}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Time Value</p>
                  <p className="text-xs text-muted-foreground">£{form.hourlyRate}/hr</p>
                </div>
                <Switch checked={form.enableTimeValue} onCheckedChange={v => update("enableTimeValue", v)} />
              </div>
              {form.enableTimeValue && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Hourly Rate</Label>
                    <span className="text-xs font-mono text-foreground">£{form.hourlyRate}/hr</span>
                  </div>
                  <Slider
                    value={[form.hourlyRate]}
                    onValueChange={([v]) => update("hourlyRate", v!)}
                    min={5} max={50} step={1}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Wear & Tear</p>
                  <p className="text-xs text-muted-foreground">£{form.wearTearPerMile.toFixed(2)}/mile</p>
                </div>
                <Switch checked={form.enableWearTear} onCheckedChange={v => update("enableWearTear", v)} />
              </div>
              {form.enableWearTear && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Per-mile cost</Label>
                    <span className="text-xs font-mono text-foreground">£{form.wearTearPerMile.toFixed(2)}/mi</span>
                  </div>
                  <Slider
                    value={[form.wearTearPerMile * 100]}
                    onValueChange={([v]) => update("wearTearPerMile", v! / 100)}
                    min={5} max={50} step={1}
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Broker Fee %</Label>
                  <span className="text-xs font-mono text-foreground">{form.brokerFeePercent}%</span>
                </div>
                <Input
                  type="number"
                  value={form.brokerFeePercent}
                  onChange={e => update("brokerFeePercent", e.target.value)}
                  className="bg-input border-border text-sm"
                  min="0" max="100" step="0.5"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Risk Buffer</Label>
                  <span className="text-xs font-mono text-foreground">{form.riskBufferPercent}%</span>
                </div>
                <Slider
                  value={[form.riskBufferPercent]}
                  onValueChange={([v]) => update("riskBufferPercent", v!)}
                  min={0} max={30} step={1}
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Calculate Button */}
        <Button
          onClick={handleCalculate}
          disabled={calculateMutation.isPending}
          className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {calculateMutation.isPending ? (
            <span className="flex items-center gap-2"><Zap size={18} className="animate-pulse" /> Calculating...</span>
          ) : (
            <span className="flex items-center gap-2"><Zap size={18} /> Calculate Profit</span>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Main profit card */}
            <Card className="bg-card border-border overflow-hidden">
              <div className={cn(
                "h-1.5",
                result.breakdown.worthItScore === "green" && "bg-[oklch(0.72_0.2_142)]",
                result.breakdown.worthItScore === "amber" && "bg-[oklch(0.78_0.18_65)]",
                result.breakdown.worthItScore === "red" && "bg-[oklch(0.62_0.22_25)]",
              )} />
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Net Profit</p>
                    <p className={cn(
                      "text-4xl font-bold font-mono profit-glow",
                      result.breakdown.netProfit >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {result.breakdown.netProfit >= 0 ? "+" : ""}£{result.breakdown.netProfit.toFixed(2)}
                    </p>
                  </div>
                  <WorthItBadge score={result.breakdown.worthItScore} />
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-secondary rounded-lg p-2.5 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Per Hour</p>
                    <p className={cn("text-base font-bold font-mono",
                      result.breakdown.profitPerHour >= 15 ? "text-primary" : "text-muted-foreground"
                    )}>
                      £{result.breakdown.profitPerHour.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2.5 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Per Mile</p>
                    <p className="text-base font-bold font-mono text-foreground">
                      £{result.breakdown.profitPerMile.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-2.5 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Distance</p>
                    <p className="text-base font-bold font-mono text-foreground">
                      {result.distanceMiles.toFixed(1)}mi
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>Est. {Math.round(result.durationMins)} mins drive time</span>
                </div>
              </CardContent>
            </Card>

            {/* Cost breakdown */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Delivery Fee", value: result.breakdown.deliveryFee, positive: true },
                  { label: "Fuel Deposit", value: result.breakdown.fuelDeposit, positive: true, show: result.breakdown.fuelDeposit > 0 },
                  { label: "Fuel Cost", value: -result.breakdown.fuelCost, positive: false, show: !form.fuelReimbursed },
                  { label: "Broker Fee", value: -result.breakdown.brokerFee, positive: false, show: result.breakdown.brokerFee > 0 },
                  { label: "Time Value", value: -result.breakdown.timeValue, positive: false, show: form.enableTimeValue && result.breakdown.timeValue > 0 },
                  { label: "Wear & Tear", value: -result.breakdown.wearTear, positive: false, show: form.enableWearTear && result.breakdown.wearTear > 0 },
                  { label: "Risk Buffer", value: -result.breakdown.riskBuffer, positive: false, show: result.breakdown.riskBuffer > 0 },
                ].filter(item => item.show !== false).map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={cn("font-mono font-medium", item.value >= 0 ? "text-primary" : "text-foreground")}>
                      {item.value >= 0 ? "+" : ""}£{Math.abs(item.value).toFixed(2)}
                    </span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Net Profit</span>
                  <span className={cn("font-mono", result.breakdown.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                    {result.breakdown.netProfit >= 0 ? "+" : ""}£{result.breakdown.netProfit.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Job Sheet — shows all booking metadata if available */}
            {savedScanData && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText size={13} />
                    Job Sheet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {savedScanData.brokerName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 size={13} /> Broker
                      </span>
                      <span className="font-medium text-foreground">{savedScanData.brokerName}</span>
                    </div>
                  )}
                  {savedScanData.jobReference && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Hash size={13} /> Reference
                      </span>
                      <span className="font-mono text-xs text-foreground">{savedScanData.jobReference}</span>
                    </div>
                  )}
                  {savedScanData.scheduledDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Scheduled</span>
                      <span className="text-foreground text-xs">
                        {new Date(savedScanData.scheduledDate).toLocaleString("en-GB", {
                          weekday: "short", day: "numeric", month: "short",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  )}
                  {(savedScanData.pickupAddress || savedScanData.dropoffAddress) && (
                    <Separator className="my-1" />
                  )}
                  {savedScanData.pickupAddress && (
                    <div className="text-sm">
                      <span className="text-muted-foreground text-xs block mb-0.5 flex items-center gap-1">
                        <MapPin size={11} className="text-muted-foreground" /> Pickup address
                      </span>
                      <span className="text-foreground text-xs leading-relaxed">{savedScanData.pickupAddress}</span>
                    </div>
                  )}
                  {savedScanData.dropoffAddress && (
                    <div className="text-sm">
                      <span className="text-muted-foreground text-xs block mb-0.5 flex items-center gap-1">
                        <MapPin size={11} className="text-primary" /> Dropoff address
                      </span>
                      <span className="text-foreground text-xs leading-relaxed">{savedScanData.dropoffAddress}</span>
                    </div>
                  )}
                  {(savedScanData.distanceMiles > 0 || savedScanData.durationMins > 0) && (
                    <>
                      <Separator className="my-1" />
                      <div className="grid grid-cols-2 gap-3">
                        {savedScanData.distanceMiles > 0 && (
                          <div className="bg-secondary rounded-lg p-2 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                              <Route size={10} /> Booking dist.
                            </p>
                            <p className="text-sm font-bold font-mono text-foreground">{savedScanData.distanceMiles} mi</p>
                          </div>
                        )}
                        {savedScanData.durationMins > 0 && (
                          <div className="bg-secondary rounded-lg p-2 text-center">
                            <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                              <Clock size={10} /> Booking time
                            </p>
                            <p className="text-sm font-bold font-mono text-foreground">
                              {Math.floor(savedScanData.durationMins / 60)}h {Math.round(savedScanData.durationMins % 60)}m
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {savedScanData.imageUrl && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex items-center gap-2">
                        <img
                          src={previewImageUrl || savedScanData.imageUrl}
                          alt="Booking screenshot"
                          className="w-12 h-16 object-cover rounded border border-border"
                        />
                        <span className="text-xs text-muted-foreground">Booking screenshot attached</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Save button */}
            <Button
              onClick={handleSaveJob}
              disabled={createJobMutation.isPending}
              className={cn(
                "w-full h-12 text-base font-semibold",
                savedScanData
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-transparent border border-border hover:border-primary/50 text-foreground"
              )}
            >
              <Save size={16} className="mr-2" />
              {createJobMutation.isPending ? "Saving..." :
               savedScanData ? "Save Job with Booking Details" : "Save to Job History"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
