import { useState, useRef, useCallback, useEffect } from "react";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Car, MapPin, Zap, Clock, ChevronDown, ChevronUp,
  Loader2, Navigation, TrendingDown, Timer, Scale,
  Trash2, Plus, PoundSterling, Route, CheckCircle2,
  ArrowRight, Home, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JobStop {
  id: string;
  pickupPostcode: string;
  dropoffPostcode: string;
  deliveryFee: string;
}

interface RouteStep {
  instruction: string;
  distanceText: string;
  durationText: string;
}

interface RouteOption {
  id: "fastest" | "balanced" | "cheapest";
  label: string;
  tagline: string;
  totalDurationSecs: number;
  totalDistanceMiles: number;
  fuelCostEstimate: number;
  netProfit: number;
  grade: "A+" | "A" | "B" | "C" | "D";
  polylines: string[];
  waypoints: Array<{ lat: number; lng: number; label: string }>;
  steps: RouteStep[];
  warnings: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeStop(): JobStop {
  return { id: Math.random().toString(36).slice(2), pickupPostcode: "", dropoffPostcode: "", deliveryFee: "" };
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function gradeColour(grade: string) {
  switch (grade) {
    case "A+": return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    case "A":  return "text-green-400 bg-green-400/10 border-green-400/30";
    case "B":  return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "C":  return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    default:   return "text-red-400 bg-red-400/10 border-red-400/30";
  }
}

const OPTION_CONFIG = {
  fastest:  { icon: Timer,      colour: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/30",   label: "Fastest" },
  balanced: { icon: Scale,      colour: "text-primary",    bg: "bg-primary/10 border-primary/30",     label: "Best Value" },
  cheapest: { icon: TrendingDown, colour: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "Cheapest" },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RouteFinder() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [startPostcode, setStartPostcode] = useState("");
  const [stops, setStops] = useState<JobStop[]>([makeStop()]);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedId, setSelectedId] = useState<RouteOption["id"] | null>(null);
  const [expandedId, setExpandedId] = useState<RouteOption["id"] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [savingId, setSavingId] = useState<RouteOption["id"] | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const { data: settings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: fuelData } = trpc.fuel.averages.useQuery(undefined, { enabled: isAuthenticated });
  const createJobMutation = trpc.jobs.create.useMutation();

  // Auto-fill start postcode from settings
  useEffect(() => {
    if (settings?.homePostcode && !startPostcode) {
      setStartPostcode(settings.homePostcode.toUpperCase());
    }
  }, [settings?.homePostcode]);

  // ── Stop helpers ──────────────────────────────────────────────────────────
  const updateStop = (id: string, key: keyof JobStop, value: string) =>
    setStops(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));

  const addStop = () => {
    if (stops.length >= 4) { toast.info("Maximum 4 jobs per route"); return; }
    const last = stops[stops.length - 1];
    const next = makeStop();
    if (last?.dropoffPostcode) next.pickupPostcode = last.dropoffPostcode;
    setStops(prev => [...prev, next]);
  };

  const removeStop = (id: string) => {
    if (stops.length === 1) return;
    setStops(prev => prev.filter(s => s.id !== id));
  };

  // ── Map helpers ───────────────────────────────────────────────────────────
  const clearMap = useCallback(() => {
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
  }, []);

  const drawRoute = useCallback((route: RouteOption) => {
    if (!mapRef.current) return;
    clearMap();
    const bounds = new window.google.maps.LatLngBounds();

    // Draw polylines
    route.polylines.forEach(encoded => {
      const decoded = window.google.maps.geometry.encoding.decodePath(encoded);
      decoded.forEach(p => bounds.extend(p));
      const poly = new window.google.maps.Polyline({
        path: decoded,
        strokeColor: "#2D7DD2",
        strokeOpacity: 0.85,
        strokeWeight: 5,
      });
      poly.setMap(mapRef.current!);
      polylinesRef.current.push(poly);
    });

    // Draw waypoint markers
    route.waypoints.forEach((wp, i) => {
      const isFirst = i === 0;
      const isLast = i === route.waypoints.length - 1;
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:${isFirst ? "#22C55E" : isLast ? "#EF4444" : "#2D7DD2"};color:white;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${wp.label}</div>`;
      markersRef.current.push(new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!, position: { lat: wp.lat, lng: wp.lng }, content: el,
      }));
      bounds.extend({ lat: wp.lat, lng: wp.lng });
    });

    mapRef.current!.fitBounds(bounds, { top: 60, bottom: 60, left: 20, right: 20 });
  }, [clearMap]);

  // ── Route optimisation ────────────────────────────────────────────────────
  const optimiseRoute = useCallback(async () => {
    const validStops = stops.filter(s => s.pickupPostcode.trim() && s.dropoffPostcode.trim());
    if (validStops.length === 0) {
      toast.error("Add at least one job with pickup and drop-off postcodes");
      return;
    }
    if (!mapRef.current) {
      toast.error("Map not ready — please wait a moment");
      return;
    }

    setLoading(true);
    setRoutes([]);
    setSelectedId(null);
    setExpandedId(null);
    clearMap();

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const origin = startPostcode.trim() ? `${startPostcode.trim()}, UK` : `${validStops[0].pickupPostcode.trim()}, UK`;

      // Build waypoints for all stops (pickup → dropoff for each)
      const allWaypoints: string[] = [];
      validStops.forEach((s, i) => {
        if (i === 0) {
          // origin is the pickup of first job
        } else {
          allWaypoints.push(`${s.pickupPostcode.trim()}, UK`);
        }
        allWaypoints.push(`${s.dropoffPostcode.trim()}, UK`);
      });
      const destination = allWaypoints.pop() ?? `${validStops[0].dropoffPostcode.trim()}, UK`;

      const waypointObjs = allWaypoints.map(loc => ({ location: loc, stopover: true }));

      // Request 3 variants: default, avoid tolls, avoid highways
      const requests: google.maps.DirectionsRequest[] = [
        { origin, destination, waypoints: waypointObjs, travelMode: google.maps.TravelMode.DRIVING, provideRouteAlternatives: true, unitSystem: google.maps.UnitSystem.IMPERIAL },
        { origin, destination, waypoints: waypointObjs, travelMode: google.maps.TravelMode.DRIVING, avoidTolls: true, unitSystem: google.maps.UnitSystem.IMPERIAL },
        { origin, destination, waypoints: waypointObjs, travelMode: google.maps.TravelMode.DRIVING, avoidHighways: true, unitSystem: google.maps.UnitSystem.IMPERIAL },
      ];

      const results = await Promise.allSettled(
        requests.map(req => new Promise<google.maps.DirectionsResult>((resolve, reject) =>
          directionsService.route(req, (res, status) =>
            status === "OK" && res ? resolve(res) : reject(new Error(status))
          )
        ))
      );

      const totalFee = validStops.reduce((s, j) => s + (Number(j.deliveryFee) || 0), 0);
      const mpg = Number(settings?.vehicleMpg) || 35;
      const hourlyRate = Number(settings?.hourlyRate) || 15;
      // Use live fuel price from fuel tracker, or UK average fallback
      const fuelPencePerLitre = fuelData?.petrolPencePerLitre ?? 145;

      const candidates: RouteOption[] = [];
      const seenDurations = new Set<number>();

      results.forEach((res, idx) => {
        if (res.status !== "fulfilled") return;
        const gmRoute = res.value.routes[0];
        if (!gmRoute) return;

        const totalDuration = gmRoute.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
        const totalDistanceMetres = gmRoute.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
        const totalDistanceMiles = totalDistanceMetres / 1609.34;

        // Deduplicate by duration (within 2 min)
        const rounded = Math.round(totalDuration / 120) * 120;
        if (seenDurations.has(rounded)) return;
        seenDurations.add(rounded);

        // Fuel cost
        const litresPerMile = 4.546 / mpg;
        const fuelCostEstimate = Math.round(totalDistanceMiles * litresPerMile * fuelPencePerLitre) / 100;

        // Net profit
        const netProfit = Math.round((totalFee - fuelCostEstimate) * 100) / 100;
        const profitPerHour = totalDuration > 0 ? (netProfit / (totalDuration / 3600)) : 0;

        // Grade — based on user's hourly rate target
        const hr = hourlyRate;
        let grade: RouteOption["grade"] = "D";
        if (profitPerHour >= hr * 1.2) grade = "A+";
        else if (profitPerHour >= hr) grade = "A";
        else if (profitPerHour >= hr * 0.75) grade = "B";
        else if (profitPerHour >= hr * 0.5) grade = "C";

        // Extract polylines and steps
        const polylines: string[] = [];
        const steps: RouteStep[] = [];
        gmRoute.legs.forEach(leg => {
          leg.steps?.forEach(step => {
            if (step.polyline?.points) polylines.push(step.polyline.points);
            steps.push({
              instruction: step.instructions?.replace(/<[^>]*>/g, "") ?? "",
              distanceText: step.distance?.text ?? "",
              durationText: step.duration?.text ?? "",
            });
          });
        });

        // Build waypoints for markers
        const waypoints: RouteOption["waypoints"] = [];
        if (startPostcode.trim()) {
          const firstLeg = gmRoute.legs[0];
          waypoints.push({ lat: firstLeg.start_location.lat(), lng: firstLeg.start_location.lng(), label: startPostcode.toUpperCase() });
        }
        validStops.forEach((s, i) => {
          const leg = gmRoute.legs[i] ?? gmRoute.legs[gmRoute.legs.length - 1];
          if (i === 0 && !startPostcode.trim()) {
            waypoints.push({ lat: leg.start_location.lat(), lng: leg.start_location.lng(), label: s.pickupPostcode.toUpperCase() });
          }
          waypoints.push({ lat: leg.end_location.lat(), lng: leg.end_location.lng(), label: s.dropoffPostcode.toUpperCase() });
        });

        const idMap: RouteOption["id"][] = ["fastest", "balanced", "cheapest"];
        candidates.push({
          id: idMap[candidates.length] ?? "balanced",
          label: OPTION_CONFIG[idMap[candidates.length] ?? "balanced"].label,
          tagline: idx === 0 ? "Quickest route" : idx === 1 ? "Avoids toll roads" : "Avoids motorways",
          totalDurationSecs: totalDuration,
          totalDistanceMiles: Math.round(totalDistanceMiles * 10) / 10,
          fuelCostEstimate,
          netProfit,
          grade,
          polylines,
          waypoints,
          steps,
          warnings: gmRoute.warnings ?? [],
        });
      });

      if (candidates.length === 0) {
        toast.error("No routes found. Check your postcodes and try again.");
        setLoading(false);
        return;
      }

      // Sort: fastest first, then by net profit for balanced, then cheapest fuel
      const sorted = [...candidates].sort((a, b) => a.totalDurationSecs - b.totalDurationSecs);
      const byProfit = [...candidates].sort((a, b) => b.netProfit - a.netProfit);
      const byCost = [...candidates].sort((a, b) => a.fuelCostEstimate - b.fuelCostEstimate);

      const final: RouteOption[] = [];
      const used = new Set<string>();
      const push = (r: RouteOption, id: RouteOption["id"]) => {
        if (!used.has(r.id)) { used.add(r.id); final.push({ ...r, id, label: OPTION_CONFIG[id].label }); }
      };
      if (sorted[0]) push(sorted[0], "fastest");
      if (byProfit[0]) push(byProfit[0], "balanced");
      if (byCost[0]) push(byCost[0], "cheapest");
      // Fill remaining slots
      candidates.forEach(c => {
        if (!used.has(c.id) && final.length < 3) push(c, c.id);
      });

      setRoutes(final);
      const best = final.find(r => r.id === "balanced") ?? final[0];
      setSelectedId(best.id);
      drawRoute(best);

    } catch (err) {
      console.error(err);
      toast.error("Failed to calculate route. Check postcodes and try again.");
    } finally {
      setLoading(false);
    }
  }, [stops, startPostcode, settings, clearMap, drawRoute]);

  // ── Select route ──────────────────────────────────────────────────────────
  const handleSelectRoute = useCallback((route: RouteOption) => {
    setSelectedId(route.id);
    drawRoute(route);
  }, [drawRoute]);

  // ── Save as job ───────────────────────────────────────────────────────────
  const handleSaveAsJob = useCallback(async (route: RouteOption) => {
    const validStops = stops.filter(s => s.pickupPostcode.trim() && s.dropoffPostcode.trim());
    if (validStops.length === 0) return;
    setSavingId(route.id);
    try {
      const firstStop = validStops[0];
      const totalFee = validStops.reduce((s, j) => s + (Number(j.deliveryFee) || 0), 0);
      await createJobMutation.mutateAsync({
        pickupPostcode: firstStop.pickupPostcode.trim().toUpperCase(),
        dropoffPostcode: validStops[validStops.length - 1].dropoffPostcode.trim().toUpperCase(),
        deliveryFee: totalFee,
        scannedDistanceMiles: route.totalDistanceMiles,
        scannedDurationMins: Math.round(route.totalDurationSecs / 60),
      });
      toast.success("Job saved to your Jobs list");
      navigate("/jobs");
    } catch {
      toast.error("Failed to save job");
    } finally {
      setSavingId(null);
    }
  }, [stops, createJobMutation, navigate]);

  const selectedRoute = routes.find(r => r.id === selectedId) ?? null;
  const validStops = stops.filter(s => s.pickupPostcode.trim() && s.dropoffPostcode.trim());
  const canOptimise = validStops.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-28">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Route size={17} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Route Optimiser</h1>
        </div>
        <p className="text-sm text-muted-foreground">Add your jobs, then let AI find the best route.</p>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Start address ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Home size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start / Home</span>
          </div>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            <Input
              value={startPostcode}
              onChange={e => setStartPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. BS1 4DJ (defaults to home postcode)"
              className="pl-8 font-mono tracking-wider text-sm h-10"
            />
          </div>
        </div>

        {/* ── Job stops ──────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Car size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jobs</span>
            </div>
            <span className="text-xs text-muted-foreground">{stops.length}/4</span>
          </div>

          {stops.map((stop, idx) => (
            <div key={stop.id} className="space-y-2">
              {idx > 0 && <div className="border-t border-border/50 pt-3" />}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Job {idx + 1}</span>
                {stops.length > 1 && (
                  <button onClick={() => removeStop(stop.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <Input
                    value={stop.pickupPostcode}
                    onChange={e => {
                      updateStop(stop.id, "pickupPostcode", e.target.value.toUpperCase());
                      // Auto-fill next stop's pickup
                    }}
                    onBlur={e => {
                      const val = e.target.value.toUpperCase();
                      updateStop(stop.id, "pickupPostcode", val);
                    }}
                    placeholder="Pickup"
                    className="pl-7 font-mono tracking-wider text-xs h-9"
                  />
                </div>
                <div className="relative">
                  <MapPin size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-400" />
                  <Input
                    value={stop.dropoffPostcode}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      updateStop(stop.id, "dropoffPostcode", val);
                      // Auto-fill next stop's pickup if it exists and is empty
                      const nextStop = stops[idx + 1];
                      if (nextStop && !nextStop.pickupPostcode) {
                        updateStop(nextStop.id, "pickupPostcode", val);
                      }
                    }}
                    placeholder="Drop-off"
                    className="pl-7 font-mono tracking-wider text-xs h-9"
                  />
                </div>
              </div>
              <div className="relative">
                <PoundSterling size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={stop.deliveryFee}
                  onChange={e => updateStop(stop.id, "deliveryFee", e.target.value)}
                  placeholder="Delivery fee (optional)"
                  className="pl-7 text-xs h-9"
                  min={0}
                />
              </div>
            </div>
          ))}

          {stops.length < 4 && (
            <button
              onClick={addStop}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors mt-1"
            >
              <Plus size={13} />
              Add another job
            </button>
          )}
        </div>

        {/* ── Optimise button ────────────────────────────────────────────── */}
        <Button
          className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={optimiseRoute}
          disabled={loading || !canOptimise || !mapReady}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              Finding best routes...
            </>
          ) : (
            <>
              <Zap size={18} className="mr-2" />
              Optimise Route
            </>
          )}
        </Button>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <div className={cn(
          "rounded-2xl overflow-hidden border border-border transition-all duration-300",
          routes.length > 0 ? "h-56" : "h-44"
        )}>
          <MapView
            className="w-full h-full"
            onMapReady={(map) => { mapRef.current = map; setMapReady(true); }}
          />
        </div>

        {/* ── Route option cards ─────────────────────────────────────────── */}
        {routes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Navigation size={14} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Route Options</span>
              <span className="text-xs text-muted-foreground">— tap to select, expand for directions</span>
            </div>

            {routes.map(route => {
              const cfg = OPTION_CONFIG[route.id];
              const Icon = cfg.icon;
              const isSelected = selectedId === route.id;
              const isExpanded = expandedId === route.id;

              return (
                <div
                  key={route.id}
                  className={cn(
                    "rounded-2xl border overflow-hidden transition-all duration-200",
                    isSelected
                      ? "border-primary/60 bg-primary/5"
                      : "border-border bg-card"
                  )}
                >
                  {/* Summary row — always visible */}
                  <button
                    className="w-full text-left p-4"
                    onClick={() => handleSelectRoute(route)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: label + tagline */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold", cfg.bg, cfg.colour)}>
                            <Icon size={11} />
                            {route.label}
                          </div>
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", gradeColour(route.grade))}>
                            {route.grade}
                          </span>
                          {isSelected && <CheckCircle2 size={14} className="text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{route.tagline}</p>
                      </div>

                      {/* Right: key stats */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end text-foreground font-bold text-sm">
                          <Clock size={12} className="text-muted-foreground" />
                          {formatDuration(route.totalDurationSecs)}
                        </div>
                        <div className="text-xs text-muted-foreground">{route.totalDistanceMiles} mi</div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-background/60 rounded-xl p-2 text-center">
                        <div className="text-xs text-muted-foreground mb-0.5">Fuel cost</div>
                        <div className="text-sm font-bold text-foreground">£{route.fuelCostEstimate.toFixed(2)}</div>
                      </div>
                      <div className="bg-background/60 rounded-xl p-2 text-center">
                        <div className="text-xs text-muted-foreground mb-0.5">Net profit</div>
                        <div className={cn("text-sm font-bold", route.netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {route.netProfit >= 0 ? "+" : ""}£{route.netProfit.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-background/60 rounded-xl p-2 text-center">
                        <div className="text-xs text-muted-foreground mb-0.5">£/hr</div>
                        <div className="text-sm font-bold text-foreground">
                          £{route.totalDurationSecs > 0
                            ? (route.netProfit / (route.totalDurationSecs / 3600)).toFixed(2)
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expand/collapse directions */}
                  <div className="px-4 pb-3 space-y-2">
                    <div className="flex gap-2">
                      {/* Save as Job */}
                      {isSelected && (
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30"
                          variant="outline"
                          onClick={() => handleSaveAsJob(route)}
                          disabled={savingId === route.id}
                        >
                          {savingId === route.id ? (
                            <Loader2 size={12} className="animate-spin mr-1" />
                          ) : (
                            <Star size={12} className="mr-1" />
                          )}
                          Save as Job
                        </Button>
                      )}

                      {/* Toggle directions */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : route.id)}
                        className={cn(
                          "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-primary/30",
                          isSelected ? "flex-1" : "w-full"
                        )}
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {isExpanded ? "Hide directions" : "Show full directions"}
                      </button>
                    </div>

                    {/* Full directions */}
                    {isExpanded && (
                      <div className="bg-background/60 rounded-xl p-3 space-y-2 max-h-64 overflow-y-auto">
                        {route.warnings.length > 0 && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-2">
                            {route.warnings.map((w, i) => (
                              <p key={i} className="text-xs text-amber-400">{w}</p>
                            ))}
                          </div>
                        )}
                        {route.steps.map((step, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground leading-snug">{step.instruction}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {step.distanceText}{step.distanceText && step.durationText ? " · " : ""}{step.durationText}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {routes.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Route size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Add your jobs above</p>
            <p className="text-xs mt-1">Enter pickup and drop-off postcodes, then tap Optimise Route to get the best 3 options.</p>
          </div>
        )}

      </div>
    </div>
  );
}
