import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Zap } from "lucide-react";
import { useLocation } from "wouter";

interface ProGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
}

export function ProGate({ feature, description, children }: ProGateProps) {
  const { data: sub } = trpc.subscription.status.useQuery();
  const [, navigate] = useLocation();

  if (sub?.isPro) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl z-10 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
          <Crown className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Pro Feature</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          {description ?? `${feature} is available on RoutePilot Pro.`}
        </p>
        <Button
          onClick={() => navigate("/settings?tab=subscription")}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Pro — £19.99/mo
        </Button>
        <p className="text-xs text-muted-foreground mt-2">or £149/year · Cancel anytime</p>
      </div>
    </div>
  );
}

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 ${className}`}>
      <Crown className="w-3 h-3" />
      PRO
    </span>
  );
}

interface UsageLimitBannerProps {
  current: number;
  limit: number;
  label: string;
}

export function UsageLimitBanner({ current, limit, label }: UsageLimitBannerProps) {
  const { data: sub } = trpc.subscription.status.useQuery();
  const [, navigate] = useLocation();

  if (sub?.isPro) return null;
  if (current < limit) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
      <Lock className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex-1">
        <span className="text-amber-300 font-medium">Free limit reached</span>
        <span className="text-muted-foreground ml-1">— {current}/{limit} {label} used</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate("/settings?tab=subscription")}
        className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 shrink-0"
      >
        Upgrade
      </Button>
    </div>
  );
}
