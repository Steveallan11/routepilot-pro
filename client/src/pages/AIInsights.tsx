import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Sparkles, TrendingUp, Clock, Route, PoundSterling, Lightbulb, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  route: { icon: <Route size={16} />, color: "text-blue-400", bg: "bg-blue-400/10" },
  timing: { icon: <Clock size={16} />, color: "text-purple-400", bg: "bg-purple-400/10" },
  pricing: { icon: <PoundSterling size={16} />, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  cost_saving: { icon: <TrendingUp size={16} />, color: "text-green-400", bg: "bg-green-400/10" },
  chain_opportunity: { icon: <Sparkles size={16} />, color: "text-primary", bg: "bg-primary/10" },
  getting_started: { icon: <Lightbulb size={16} />, color: "text-orange-400", bg: "bg-orange-400/10" },
};

const priorityLabel: Record<string, string> = {
  high: "High Priority",
  medium: "Medium",
  low: "Low",
};

const priorityColor: Record<string, string> = {
  high: "text-red-400 bg-red-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  low: "text-muted-foreground bg-secondary",
};

export default function AIInsights() {
  const { isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState<Array<{
    type: string;
    title: string;
    insight: string;
    priority: string;
  }> | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const recMutation = trpc.ai.recommendations.useMutation({
    onSuccess: (data) => {
      setRecommendations(data.recommendations);
      setGeneratedAt(data.generatedAt);
    },
    onError: () => toast.error("Failed to generate insights. Please try again."),
  });

  if (!isAuthenticated) {
    return (
      <div className="pb-24 pt-4 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">AI Insights</h2>
          <p className="text-muted-foreground text-sm">Sign in to get personalised recommendations based on your job history</p>
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
            <Sparkles size={18} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold">AI Insights</h1>
        </div>
        <p className="text-sm text-muted-foreground">Personalised recommendations to maximise your earnings</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Generate button */}
        <Button
          onClick={() => recMutation.mutate({ forceRefresh: true })}
          disabled={recMutation.isPending}
          className="w-full h-12 font-semibold"
        >
          {recMutation.isPending ? (
            <span className="flex items-center gap-2">
              <Sparkles size={18} className="animate-pulse" /> Analysing your jobs...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {recommendations ? <RefreshCw size={18} /> : <Sparkles size={18} />}
              {recommendations ? "Refresh Insights" : "Generate AI Insights"}
            </span>
          )}
        </Button>

        {generatedAt && (
          <p className="text-xs text-muted-foreground text-center">
            Generated {new Date(generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {recommendations.map((rec, i) => {
              const config = typeConfig[rec.type] ?? typeConfig.getting_started!;
              return (
                <Card key={i} className="bg-card border-border overflow-hidden">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", config.bg)}>
                        <span className={config.color}>{config.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="text-sm font-semibold leading-tight">{rec.title}</h3>
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0", priorityColor[rec.priority] ?? priorityColor.low)}>
                            {priorityLabel[rec.priority] ?? rec.priority}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{rec.insight}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!recommendations && !recMutation.isPending && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={36} className="text-primary/60" />
            </div>
            <h3 className="text-base font-semibold mb-2">Ready to analyse your data</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Tap "Generate AI Insights" to get personalised recommendations on routes, timing, and pricing strategies based on your job history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
