import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Car, MapPin, PoundSterling, Fuel, Clock, TrendingUp,
  ChevronDown, ChevronUp, Save, Zap, AlertCircle, CheckCircle2
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

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState<CalcState>(DEFAULT_STATE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<{
    distanceMiles: number;
    durationMins: number;
    breakdown: ReturnType<typeof calculateJobCost>;
  } | null>(null);

  const { data: settings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: fuelData } = trpc.fuel.averages.useQuery();
  const calculateMutation = trpc.jobs.calculate.useMutation();
  const createJobMutation = trpc.jobs.create.useMutation();

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
    } catch (err) {
      toast.error("Calculation failed. Please check your postcodes.");
    }
  };

  const handleSaveJob = async () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!result) return;

    try {
      await createJobMutation.mutateAsync({
        pickupPostcode: form.pickupPostcode,
        dropoffPostcode: form.dropoffPostcode,
        deliveryFee: parseFloat(form.deliveryFee) || 0,
        fuelDeposit: parseFloat(form.fuelDeposit) || 0,
        brokerFeePercent: parseFloat(form.brokerFeePercent) || 0,
        fuelReimbursed: form.fuelReimbursed,
      });
      toast.success("Job saved to history!");
    } catch {
      toast.error("Failed to save job");
    }
  };

  const update = (key: keyof CalcState, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="pb-24 pt-4">
      {/* Header */}
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Car size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">RoutePilot Pro</h1>
        </div>
        <p className="text-sm text-muted-foreground">Calculate your delivery profitability</p>
        {fuelData && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-green" />
            <span className="text-xs text-muted-foreground">
              Live fuel: <span className="text-foreground font-medium">{fuelData.petrolPencePerLitre.toFixed(1)}p/L petrol</span>
              {" · "}{fuelData.dieselPencePerLitre.toFixed(1)}p/L diesel
            </span>
          </div>
        )}
      </div>

      <div className="px-4 space-y-4">
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

            {/* Save button */}
            <Button
              onClick={handleSaveJob}
              disabled={createJobMutation.isPending}
              variant="outline"
              className="w-full border-border hover:border-primary/50 bg-transparent"
            >
              <Save size={16} className="mr-2" />
              {createJobMutation.isPending ? "Saving..." : "Save to Job History"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
