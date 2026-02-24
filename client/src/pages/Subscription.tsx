import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, Shield, Camera, Map, FileText, Users, Star } from "lucide-react";
import { toast } from "sonner";
import { useSearch } from "wouter";
import { useEffect } from "react";

const PRO_FEATURES = [
  { icon: Zap, text: "Unlimited AI booking scans" },
  { icon: Map, text: "Unlimited route searches" },
  { icon: Camera, text: "Vehicle condition logger with photo/video" },
  { icon: FileText, text: "HMRC mileage CSV & monthly P&L export" },
  { icon: Users, text: "Driver lift marketplace — post & request lifts" },
  { icon: Shield, text: "3-job chain planner (free = 2 jobs)" },
  { icon: Star, text: "Broker performance scorecard" },
  { icon: Crown, text: "Unlimited job history" },
];

export default function SubscriptionPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const { data: sub, refetch } = trpc.subscription.status.useQuery();

  const createCheckout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (err) => toast.error(err.message),
  });

  const createPortal = trpc.subscription.createPortal.useMutation({
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (params.get("success") === "1") {
      toast.success("Welcome to RoutePilot Pro! 🎉 Your subscription is now active.");
      refetch();
    } else if (params.get("cancelled") === "1") {
      toast.info("Checkout cancelled — you can upgrade anytime.");
    }
  }, []);

  const handleCheckout = (planId: "pro_monthly" | "pro_annual") => {
    createCheckout.mutate({ planId, origin: window.location.origin });
    toast.info("Opening secure checkout...");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Crown className="w-8 h-8 text-amber-400" />
          <h1 className="text-2xl font-bold">RoutePilot Pro</h1>
        </div>
        <p className="text-muted-foreground">Everything you need to maximise your earnings as a UK car delivery driver.</p>
      </div>

      {/* Current status */}
      {sub && (
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <div className="flex items-center gap-2 mt-1">
                  {sub.isPro ? (
                    <>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <Crown className="w-3 h-3 mr-1" /> Pro
                      </Badge>
                      {sub.expiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Renews {new Date(sub.expiresAt).toLocaleDateString("en-GB")}
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline">Free</Badge>
                  )}
                </div>
              </div>
              {sub.isPro && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createPortal.mutate({ origin: window.location.origin })}
                  disabled={createPortal.isPending}
                >
                  Manage Billing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pro features list */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            What's included in Pro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {PRO_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pricing cards */}
      {!sub?.isPro && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly */}
          <Card className="border-border/50 relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">£19.99</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-xs text-muted-foreground">Cancel anytime. No lock-in.</p>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={() => handleCheckout("pro_monthly")}
                disabled={createCheckout.isPending}
              >
                <Zap className="w-4 h-4 mr-2" />
                Start Monthly
              </Button>
            </CardContent>
          </Card>

          {/* Annual */}
          <Card className="border-amber-500/50 relative bg-amber-500/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-amber-500 text-black font-bold px-3">BEST VALUE</Badge>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Annual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">£149</span>
                <span className="text-muted-foreground text-sm">/year</span>
              </div>
              <p className="text-xs text-amber-400 font-medium">Save £90.88 vs monthly</p>
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                onClick={() => handleCheckout("pro_annual")}
                disabled={createCheckout.isPending}
              >
                <Crown className="w-4 h-4 mr-2" />
                Start Annual
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test card info */}
      {!sub?.isPro && (
        <p className="text-xs text-center text-muted-foreground">
          Test with card <span className="font-mono">4242 4242 4242 4242</span> · Any future date · Any CVC
        </p>
      )}

      {/* Free tier limits */}
      {!sub?.isPro && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Free tier limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">AI scans</div>
              <div className="font-medium">5 per month</div>
              <div className="text-muted-foreground">Route searches</div>
              <div className="font-medium">5 per day</div>
              <div className="text-muted-foreground">Job history</div>
              <div className="font-medium">20 jobs</div>
              <div className="text-muted-foreground">Job chains</div>
              <div className="font-medium">2-job only</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
