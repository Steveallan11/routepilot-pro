import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, Shield, Camera, Map, FileText, Users, Star, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useSearch } from "wouter";
import { useEffect } from "react";

const PRO_FEATURES = [
  { icon: Zap,        text: "Unlimited AI booking scans" },
  { icon: Map,        text: "Unlimited route searches" },
  { icon: TrendingUp, text: "A+/A/B/C/D job scoring with improvement tips" },
  { icon: Camera,     text: "Vehicle condition logger with photo/video" },
  { icon: FileText,   text: "HMRC mileage CSV & monthly P&L export" },
  { icon: Users,      text: "Driver lift marketplace — post & request lifts" },
  { icon: Shield,     text: "3-job chain planner (free = 2 jobs)" },
  { icon: Star,       text: "Broker performance scorecard" },
  { icon: Crown,      text: "Unlimited job history" },
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
    toast.info("Opening secure checkout — you'll be redirected to Stripe.");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-28 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pt-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown className="w-8 h-8 text-amber-400" />
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>RoutePilot Pro</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Everything you need to maximise your earnings as a UK car delivery driver.
        </p>
        <p className="text-xs text-primary font-semibold">7-day free trial · No card required to start</p>
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

      {/* Pricing cards — Annual first */}
      {!sub?.isPro && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {/* Annual — MOST POPULAR */}
          <Card className="border-primary/60 relative bg-primary/5 order-first sm:order-last">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-primary text-white font-bold px-3 text-xs">MOST POPULAR</Badge>
            </div>
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Annual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>£74.99</span>
                <span className="text-muted-foreground text-sm">/year</span>
              </div>
              <p className="text-xs text-primary font-semibold">Save £44.89 vs monthly · Best value</p>
              <p className="text-xs text-muted-foreground">Equivalent to £6.25/month</p>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={() => handleCheckout("pro_annual")}
                disabled={createCheckout.isPending}
              >
                <Crown className="w-4 h-4 mr-2" />
                Start Free Trial — Annual
              </Button>
            </CardContent>
          </Card>

          {/* Monthly */}
          <Card className="border-border/50 relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif" }}>£9.99</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-xs text-muted-foreground">Cancel anytime. No lock-in.</p>
              <p className="text-xs text-muted-foreground">&nbsp;</p>
              <Button
                variant="outline"
                className="w-full font-semibold"
                onClick={() => handleCheckout("pro_monthly")}
                disabled={createCheckout.isPending}
              >
                <Zap className="w-4 h-4 mr-2" />
                Start Free Trial — Monthly
              </Button>
            </CardContent>
          </Card>
        </div>
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

      {/* Test card info */}
      {!sub?.isPro && (
        <p className="text-xs text-center text-muted-foreground">
          Test with card <span className="font-mono-rp">4242 4242 4242 4242</span> · Any future date · Any CVC
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
              <div className="text-muted-foreground">Receipt scans</div>
              <div className="font-medium">3 per month</div>
              <div className="text-muted-foreground">Job history</div>
              <div className="font-medium">15 jobs</div>
              <div className="text-muted-foreground">Job chains</div>
              <div className="font-medium">2-job only</div>
              <div className="text-muted-foreground">Saved routes</div>
              <div className="font-medium">3 routes</div>
              <div className="text-muted-foreground">Saved brokers</div>
              <div className="font-medium">5 brokers</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
