import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Settings as SettingsIcon, Car, PoundSterling, Bell, User, LogOut, Crown } from "lucide-react";
import { Link } from "wouter";

export default function Settings() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: settings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const upsertMutation = trpc.settings.upsert.useMutation({
    onSuccess: () => toast.success("Settings saved!"),
    onError: () => toast.error("Failed to save settings"),
  });

  const [form, setForm] = useState({
    vehicleMpg: 35,
    fuelType: "petrol" as "petrol" | "diesel",
    hourlyRate: 15,
    wearTearPerMile: 0.15,
    defaultBrokerFeePercent: 0,
    riskBufferPercent: 10,
    enableTimeValue: true,
    enableWearTear: true,
    homePostcode: "",
    alertsEnabled: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        vehicleMpg: settings.vehicleMpg,
        fuelType: settings.fuelType as "petrol" | "diesel",
        hourlyRate: settings.hourlyRate,
        wearTearPerMile: settings.wearTearPerMile,
        defaultBrokerFeePercent: settings.defaultBrokerFeePercent,
        riskBufferPercent: settings.riskBufferPercent,
        enableTimeValue: settings.enableTimeValue,
        enableWearTear: settings.enableWearTear,
        homePostcode: settings.homePostcode ?? "",
        alertsEnabled: settings.alertsEnabled,
      });
    }
  }, [settings]);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    upsertMutation.mutate(form);
  };

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Settings</h2>
          <p className="text-muted-foreground text-sm">Sign in to save your vehicle and cost preferences</p>
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
            <SettingsIcon size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Your vehicle and cost preferences</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Profile */}
        {user && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User size={20} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{user.name ?? "Driver"}</p>
                  <p className="text-xs text-muted-foreground">{user.email ?? ""}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground h-8">
                  <LogOut size={14} className="mr-1" /> Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vehicle */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Car size={14} /> Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Fuel Type</Label>
              <Select value={form.fuelType} onValueChange={v => update("fuelType", v as "petrol" | "diesel")}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Vehicle MPG</Label>
                <span className="text-xs font-mono text-foreground">{form.vehicleMpg} mpg</span>
              </div>
              <Slider
                value={[form.vehicleMpg]}
                onValueChange={([v]) => update("vehicleMpg", v!)}
                min={10} max={80} step={1}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Home Postcode</Label>
              <Input
                placeholder="e.g. SW1A 1AA"
                value={form.homePostcode}
                onChange={e => update("homePostcode", e.target.value.toUpperCase())}
                className="bg-input border-border text-sm uppercase"
                maxLength={8}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cost Settings */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <PoundSterling size={14} /> Cost Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Time Value</p>
                <p className="text-xs text-muted-foreground">Include your time as a cost</p>
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

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Wear & Tear</p>
                <p className="text-xs text-muted-foreground">Per-mile vehicle cost</p>
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

            <Separator />

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Default Broker Fee %</Label>
                <span className="text-xs font-mono text-foreground">{form.defaultBrokerFeePercent}%</span>
              </div>
              <Slider
                value={[form.defaultBrokerFeePercent]}
                onValueChange={([v]) => update("defaultBrokerFeePercent", v!)}
                min={0} max={30} step={0.5}
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
        </Card>

        {/* Alerts */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Bell size={14} /> Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Alerts</p>
                <p className="text-xs text-muted-foreground">Fuel price drops & chain opportunities</p>
              </div>
              <Switch checked={form.alertsEnabled} onCheckedChange={v => update("alertsEnabled", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Pro subscription shortcut */}
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Crown size={18} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">RoutePilot Pro</p>
                <p className="text-xs text-muted-foreground">Unlock Tax Export, Lifts, Condition Logger & more</p>
              </div>
              <Link href="/subscription">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shrink-0">Upgrade</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={upsertMutation.isPending} className="w-full h-12 font-semibold">
          {upsertMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
