import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Clock,
  Fuel,
  MapPin,
  ChevronRight,
  Zap,
  CheckCircle2,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [hourlyRate, setHourlyRate] = useState("15");
  const [mpg, setMpg] = useState("35");
  const [fuelType, setFuelType] = useState<"petrol" | "diesel">("petrol");
  const [homePostcode, setHomePostcode] = useState("");

  const upsert = trpc.settings.upsert.useMutation();

  const handleComplete = async () => {
    await upsert.mutateAsync({
      hourlyRate: Number(hourlyRate) || 15,
      vehicleMpg: Number(mpg) || 35,
      fuelType,
      homePostcode: homePostcode.trim().toUpperCase() || undefined,
      onboardingCompleted: true,
    });
    onComplete();
  };

  const steps = [
    { id: 1, label: "Your rate", icon: Clock },
    { id: 2, label: "Your vehicle", icon: Fuel },
    { id: 3, label: "Home base", icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap size={16} className="text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-lg font-display">RoutePilot Pro</span>
        </div>

        <h1 className="text-2xl font-bold text-foreground font-display mb-1">
          Let's set you up
        </h1>
        <p className="text-muted-foreground text-sm">
          Three quick questions so your profit calculations are accurate from day one.
        </p>
      </div>

      {/* Step indicator */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-2">
          {steps.map(({ id, label, icon: Icon }) => (
            <div key={id} className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                id < step
                  ? "bg-emerald-500"
                  : id === step
                  ? "bg-primary"
                  : "bg-muted"
              }`}>
                {id < step ? (
                  <CheckCircle2 size={14} className="text-white" />
                ) : (
                  <Icon size={13} className={id === step ? "text-primary-foreground" : "text-muted-foreground"} />
                )}
              </div>
              <span className={`text-xs font-medium ${id === step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {id < 3 && <div className={`flex-1 h-px mx-1 ${id < step ? "bg-emerald-500" : "bg-border"}`} style={{ width: "24px" }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-6 overflow-y-auto">

        {/* Step 1: Hourly Rate */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Clock size={24} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">What's your hourly rate?</h2>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                This is the minimum you want to earn per hour of work. RoutePilot uses it to calculate whether a job is worth your time.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">£</span>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="pl-7 text-lg font-bold h-12"
                  placeholder="15"
                  min={5}
                  max={500}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/hr</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[12, 15, 18, 20].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => setHourlyRate(String(rate))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      hourlyRate === String(rate)
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-muted border-transparent text-muted-foreground hover:border-border"
                    }`}
                  >
                    £{rate}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-primary">Tip:</span> Most UK car delivery drivers target £12–£18/hr. If a job pays less than your rate, it gets a lower grade.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Vehicle MPG + Fuel Type */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                <Fuel size={24} className="text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Your vehicle's fuel economy</h2>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                Used to calculate your real fuel cost per job using live UK pump prices.
              </p>

              {/* Fuel type toggle */}
              <div className="flex gap-2 mb-4">
                {(["petrol", "diesel"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFuelType(type)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors capitalize ${
                      fuelType === type
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-muted border-transparent text-muted-foreground hover:border-border"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* MPG input */}
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Miles per gallon (MPG)</label>
              <div className="relative">
                <Input
                  type="number"
                  value={mpg}
                  onChange={(e) => setMpg(e.target.value)}
                  className="text-lg font-bold h-12"
                  placeholder="35"
                  min={10}
                  max={200}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">mpg</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[30, 35, 40, 50].map((val) => (
                  <button
                    key={val}
                    onClick={() => setMpg(String(val))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      mpg === String(val)
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-muted border-transparent text-muted-foreground hover:border-border"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-amber-400">Tip:</span> Not sure? Check your car's handbook or search "[make model] MPG". A typical petrol hatchback gets 35–45 mpg.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Home Postcode */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <MapPin size={24} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">Where do you work from?</h2>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                Your home postcode is used to calculate travel costs to your first pickup and back from your last drop-off.
              </p>
              <Input
                type="text"
                value={homePostcode}
                onChange={(e) => setHomePostcode(e.target.value.toUpperCase())}
                className="text-lg font-bold h-12 font-mono tracking-widest"
                placeholder="e.g. BS1 4DJ"
                maxLength={8}
              />
              <p className="text-xs text-muted-foreground mt-2">You can skip this and add it later in Settings.</p>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-emerald-400">You're all set!</span> You can update any of these settings at any time from the Me tab → Settings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 pb-10 pt-4 space-y-3">
        {step < 3 ? (
          <Button
            className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setStep((s) => (s + 1) as Step)}
          >
            Continue
            <ChevronRight size={18} className="ml-1" />
          </Button>
        ) : (
          <Button
            className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleComplete}
            disabled={upsert.isPending}
          >
            {upsert.isPending ? "Saving..." : "Start Using RoutePilot Pro"}
            {!upsert.isPending && <Zap size={16} className="ml-1.5" />}
          </Button>
        )}
        {step > 1 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        )}
        {step === 3 && (
          <button
            onClick={handleComplete}
            className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
