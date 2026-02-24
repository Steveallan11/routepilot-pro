import { useState, useRef, useCallback, useEffect } from "react";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Train, Bus, Car, PersonStanding, Zap, Clock,
  ChevronRight, MapPin, Loader2, CheckCircle2,
  Navigation, TrendingDown, Timer, Scale, Star, StarOff,
  Trash2, CalendarClock, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMinutes } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransitLeg {
  mode: "TRANSIT" | "WALKING" | "DRIVING";
  transitMode?: "TRAIN" | "SUBWAY" | "BUS" | "TRAM" | "FERRY" | "RAIL";
  lineName?: string;
  lineShortName?: string;
  lineColour?: string;
  departureStop?: string;
  arrivalStop?: string;
  departureTime?: string;
  arrivalTime?: string;
  numStops?: number;
  durationSecs: number;
  distanceMetres: number;
  polyline: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  instructions?: string;
  estimatedFare?: number;
}

interface RouteOption {
  id: string;
  label: "fastest" | "cheapest" | "balanced";
  summary: string;
  totalDurationSecs: number;
  totalDistanceMetres: number;
  estimatedCost: number;
  legs: TransitLeg[];
  departureTime?: string;
  arrivalTime?: string;
  warnings: string[];
}

// ─── UK Rail fare model (ATOC-based distance bands) ──────────────────────────
// Based on published UK rail fare data: Anytime Single prices by distance band

function estimateRailFare(distanceKm: number): number {
  // UK rail fare bands (Anytime Single, approximate)
  if (distanceKm < 10)  return 3.50;
  if (distanceKm < 20)  return 6.00;
  if (distanceKm < 40)  return 10.50;
  if (distanceKm < 60)  return 15.00;
  if (distanceKm < 80)  return 19.50;
  if (distanceKm < 100) return 24.00;
  if (distanceKm < 150) return 32.00;
  if (distanceKm < 200) return 42.00;
  if (distanceKm < 300) return 58.00;
  return 75.00; // 300km+
}

function estimateCost(legs: TransitLeg[]): number {
  let cost = 0;
  for (const leg of legs) {
    if (leg.mode === "TRANSIT") {
      const distKm = leg.distanceMetres / 1000;
      if (leg.transitMode === "TRAIN" || leg.transitMode === "RAIL") {
        const fare = estimateRailFare(distKm);
        leg.estimatedFare = fare;
        cost += fare;
      } else if (leg.transitMode === "SUBWAY") {
        // London Underground: zone-based, typical £2.80–£5.25
        leg.estimatedFare = distKm < 10 ? 2.80 : 4.50;
        cost += leg.estimatedFare;
      } else if (leg.transitMode === "BUS" || leg.transitMode === "TRAM") {
        // UK bus: £2.00 cap (England bus fare cap)
        leg.estimatedFare = 2.00;
        cost += 2.00;
      } else {
        leg.estimatedFare = 2.50;
        cost += 2.50;
      }
    }
  }
  return Math.round(cost * 100) / 100;
}

// ─── Colour coding ────────────────────────────────────────────────────────────

const LEG_COLOURS: Record<string, string> = {
  TRAIN: "#3B82F6",
  RAIL: "#3B82F6",
  SUBWAY: "#8B5CF6",
  BUS: "#F97316",
  TRAM: "#10B981",
  FERRY: "#06B6D4",
  WALKING: "#6B7280",
  DRIVING: "#EF4444",
};

function getLegColour(leg: TransitLeg): string {
  if (leg.mode === "WALKING") return LEG_COLOURS.WALKING;
  if (leg.mode === "DRIVING") return LEG_COLOURS.DRIVING;
  return leg.lineColour ? `#${leg.lineColour}` : (LEG_COLOURS[leg.transitMode ?? "BUS"] ?? "#F97316");
}

function getLegIcon(leg: TransitLeg) {
  if (leg.mode === "WALKING") return <PersonStanding size={14} />;
  if (leg.mode === "DRIVING") return <Car size={14} />;
  switch (leg.transitMode) {
    case "TRAIN": case "RAIL": return <Train size={14} />;
    case "BUS": return <Bus size={14} />;
    default: return <Train size={14} />;
  }
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ─── Parse Google Directions result ──────────────────────────────────────────

function parseTransitResult(route: google.maps.DirectionsRoute): TransitLeg[] {
  const legs: TransitLeg[] = [];
  for (const leg of route.legs) {
    for (const step of leg.steps) {
      const mode = step.travel_mode as string;
      const transitDetails = (step as any).transit;
      const polyline = step.polyline?.points ?? "";
      const startLoc = { lat: step.start_location.lat(), lng: step.start_location.lng() };
      const endLoc = { lat: step.end_location.lat(), lng: step.end_location.lng() };

      if (mode === "TRANSIT" && transitDetails) {
        const line = transitDetails.line ?? {};
        const vehicle = line.vehicle ?? {};
        const vehicleType = (vehicle.type as string ?? "BUS").toUpperCase();
        legs.push({
          mode: "TRANSIT",
          transitMode: vehicleType as TransitLeg["transitMode"],
          lineName: line.name ?? line.short_name ?? "",
          lineShortName: line.short_name ?? "",
          lineColour: line.color?.replace("#", "") ?? "",
          departureStop: transitDetails.departure_stop?.name ?? "",
          arrivalStop: transitDetails.arrival_stop?.name ?? "",
          departureTime: transitDetails.departure_time?.text ?? "",
          arrivalTime: transitDetails.arrival_time?.text ?? "",
          numStops: transitDetails.num_stops ?? 0,
          durationSecs: step.duration?.value ?? 0,
          distanceMetres: step.distance?.value ?? 0,
          polyline, startLocation: startLoc, endLocation: endLoc,
        });
      } else if (mode === "WALKING") {
        legs.push({
          mode: "WALKING",
          durationSecs: step.duration?.value ?? 0,
          distanceMetres: step.distance?.value ?? 0,
          polyline, startLocation: startLoc, endLocation: endLoc,
          instructions: step.instructions ?? "",
        });
      } else {
        legs.push({
          mode: "DRIVING",
          durationSecs: step.duration?.value ?? 0,
          distanceMetres: step.distance?.value ?? 0,
          polyline, startLocation: startLoc, endLocation: endLoc,
          instructions: step.instructions ?? "",
        });
      }
    }
  }
  return legs;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RouteFinderProps {
  initialFrom?: string;
  initialTo?: string;
  onUseRoute?: (cost: number, mode: string, summary: string) => void;
}

export default function RouteFinder({ initialFrom = "", initialTo = "", onUseRoute }: RouteFinderProps) {
  const { isAuthenticated } = useAuth();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showTimeOptions, setShowTimeOptions] = useState(false);
  const [departureMode, setDepartureMode] = useState<"now" | "custom">("now");
  const [departureDate, setDepartureDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [departureTime, setDepartureTime] = useState(() => format(addMinutes(new Date(), 5), "HH:mm"));
  const [showFavourites, setShowFavourites] = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [favName, setFavName] = useState("");
  const [showSaveFav, setShowSaveFav] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // tRPC: favourites
  const { data: favourites, refetch: refetchFavs } = trpc.routes.listFavourites.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const saveFavMutation = trpc.routes.saveFavourite.useMutation({
    onSuccess: () => { refetchFavs(); setShowSaveFav(false); setFavName(""); toast.success("Route saved to favourites"); },
    onError: () => toast.error("Failed to save favourite"),
  });
  const deleteFavMutation = trpc.routes.deleteFavourite.useMutation({
    onSuccess: () => refetchFavs(),
  });

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get("from");
    const t = params.get("to");
    if (f) setFrom(f.toUpperCase());
    if (t) setTo(t.toUpperCase());
  }, []);

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

    route.legs.forEach((leg, i) => {
      const colour = getLegColour(leg);
      const decoded = window.google.maps.geometry.encoding.decodePath(leg.polyline);
      decoded.forEach(p => bounds.extend(p));

      const polyline = new window.google.maps.Polyline({
        path: decoded,
        strokeColor: colour,
        strokeOpacity: 0.9,
        strokeWeight: leg.mode === "WALKING" ? 3 : 5,
        icons: leg.mode === "WALKING" ? [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0", repeat: "12px",
        }] : undefined,
      });
      polyline.setMap(mapRef.current!);
      polylinesRef.current.push(polyline);

      if (i > 0) {
        const el = document.createElement("div");
        el.style.cssText = `width:10px;height:10px;background:${colour};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)`;
        markersRef.current.push(new window.google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current!, position: leg.startLocation, content: el,
          title: leg.departureStop ?? leg.mode,
        }));
      }
    });

    const startEl = document.createElement("div");
    startEl.innerHTML = `<div style="background:#22C55E;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4)">▶ ${from.toUpperCase()}</div>`;
    markersRef.current.push(new window.google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current!, position: route.legs[0].startLocation, content: startEl,
    }));

    const endEl = document.createElement("div");
    endEl.innerHTML = `<div style="background:#EF4444;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4)">■ ${to.toUpperCase()}</div>`;
    markersRef.current.push(new window.google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current!, position: route.legs[route.legs.length - 1].endLocation, content: endEl,
    }));

    mapRef.current!.fitBounds(bounds, { top: 60, bottom: 60, left: 20, right: 20 });
  }, [clearMap, from, to]);

  const getDepartureDate = useCallback((): Date => {
    if (departureMode === "now") return new Date();
    const [y, mo, d] = departureDate.split("-").map(Number);
    const [h, mi] = departureTime.split(":").map(Number);
    return new Date(y, mo - 1, d, h, mi);
  }, [departureMode, departureDate, departureTime]);

  const searchRoutes = useCallback(async () => {
    if (!from.trim() || !to.trim()) { toast.error("Please enter both postcodes"); return; }
    if (!mapRef.current) { toast.error("Map not ready yet"); return; }
    setLoading(true);
    setRoutes([]);
    setSelectedRoute(null);
    clearMap();

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const depTime = getDepartureDate();

      const transitRequest: google.maps.DirectionsRequest = {
        origin: `${from.trim()}, UK`,
        destination: `${to.trim()}, UK`,
        travelMode: google.maps.TravelMode.TRANSIT,
        provideRouteAlternatives: true,
        transitOptions: {
          departureTime: depTime,
          modes: [
            google.maps.TransitMode.BUS,
            google.maps.TransitMode.RAIL,
            google.maps.TransitMode.SUBWAY,
            google.maps.TransitMode.TRAIN,
            google.maps.TransitMode.TRAM,
          ],
          routingPreference: google.maps.TransitRoutePreference.FEWER_TRANSFERS,
        },
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      };

      const drivingRequest: google.maps.DirectionsRequest = {
        origin: `${from.trim()}, UK`,
        destination: `${to.trim()}, UK`,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.IMPERIAL,
      };

      const [transitResult, drivingResult] = await Promise.allSettled([
        new Promise<google.maps.DirectionsResult>((resolve, reject) =>
          directionsService.route(transitRequest, (res, status) =>
            status === "OK" && res ? resolve(res) : reject(new Error(status))
          )
        ),
        new Promise<google.maps.DirectionsResult>((resolve, reject) =>
          directionsService.route(drivingRequest, (res, status) =>
            status === "OK" && res ? resolve(res) : reject(new Error(status))
          )
        ),
      ]);

      const candidates: RouteOption[] = [];

      if (transitResult.status === "fulfilled") {
        transitResult.value.routes.forEach((route, idx) => {
          const legs = parseTransitResult(route);
          const cost = estimateCost(legs);
          const totalDuration = route.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
          const totalDistance = route.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
          const firstLeg = route.legs[0];
          const lastLeg = route.legs[route.legs.length - 1];
          candidates.push({
            id: `transit-${idx}`,
            label: "fastest",
            summary: route.summary || `Transit route ${idx + 1}`,
            totalDurationSecs: totalDuration,
            totalDistanceMetres: totalDistance,
            estimatedCost: cost,
            legs,
            departureTime: (firstLeg as any).departure_time?.text,
            arrivalTime: (lastLeg as any).arrival_time?.text,
            warnings: route.warnings ?? [],
          });
        });
      }

      if (drivingResult.status === "fulfilled") {
        const route = drivingResult.value.routes[0];
        if (route) {
          const legs = parseTransitResult(route);
          const totalDuration = route.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
          const totalDistance = route.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
          const distMiles = totalDistance / 1609.34;
          const drivingCost = distMiles * 0.15 + 5;
          candidates.push({
            id: "driving",
            label: "fastest",
            summary: "Drive / Taxi",
            totalDurationSecs: totalDuration,
            totalDistanceMetres: totalDistance,
            estimatedCost: Math.round(drivingCost * 100) / 100,
            legs,
            warnings: route.warnings ?? [],
          });
        }
      }

      if (candidates.length === 0) {
        toast.error("No routes found. Try nearby town names instead of postcodes.");
        setLoading(false);
        return;
      }

      const sorted = [...candidates].sort((a, b) => a.totalDurationSecs - b.totalDurationSecs);
      const byCost = [...candidates].sort((a, b) => a.estimatedCost - b.estimatedCost);
      const byBalance = [...candidates].sort((a, b) => {
        const scoreA = a.estimatedCost + (a.totalDurationSecs / 60) * 0.20;
        const scoreB = b.estimatedCost + (b.totalDurationSecs / 60) * 0.20;
        return scoreA - scoreB;
      });

      const labelled: RouteOption[] = [];
      const used = new Set<string>();
      const addUnique = (r: RouteOption, label: RouteOption["label"]) => {
        if (!used.has(r.id)) { used.add(r.id); labelled.push({ ...r, label }); }
        else labelled.push({ ...r, id: `${r.id}-${label}`, label });
      };
      addUnique(sorted[0], "fastest");
      addUnique(byCost[0], "cheapest");
      addUnique(byBalance[0], "balanced");
      candidates.forEach(r => { if (!used.has(r.id)) { used.add(r.id); labelled.push(r); } });

      setRoutes(labelled);
      const balanced = labelled.find(r => r.label === "balanced") ?? labelled[0];
      setSelectedRoute(balanced);
      drawRoute(balanced);
      setShowSaveFav(true);

    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch routes. Check postcodes and try again.");
    } finally {
      setLoading(false);
    }
  }, [from, to, clearMap, drawRoute, getDepartureDate]);

  const handleSelectRoute = useCallback((route: RouteOption) => {
    setSelectedRoute(route);
    drawRoute(route);
  }, [drawRoute]);

  const labelConfig = {
    fastest: { icon: <Timer size={12} />, colour: "text-blue-400 border-blue-400/30 bg-blue-400/10", label: "Fastest" },
    cheapest: { icon: <TrendingDown size={12} />, colour: "text-green-400 border-green-400/30 bg-green-400/10", label: "Cheapest" },
    balanced: { icon: <Scale size={12} />, colour: "text-amber-400 border-amber-400/30 bg-amber-400/10", label: "Best Value" },
  };

  const depLabel = departureMode === "now"
    ? "Departing now"
    : `Departing ${format(getDepartureDate(), "EEE d MMM 'at' HH:mm")}`;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Navigation size={18} className="text-primary" />
          Route Finder
        </h1>
        <p className="text-xs text-muted-foreground">Find the best way to reposition between jobs</p>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Favourites bar */}
        {isAuthenticated && (favourites?.length ?? 0) > 0 && (
          <Card className="bg-card border-border">
            <div
              className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
              onClick={() => setShowFavourites(s => !s)}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Star size={14} className="text-amber-400" />
                Saved Routes ({favourites!.length})
              </div>
              {showFavourites ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
            {showFavourites && (
              <div className="px-4 pb-3 space-y-2 border-t border-border pt-2">
                {favourites!.map((fav: any) => (
                  <div key={fav.id} className="flex items-center gap-2">
                    <button
                      className="flex-1 text-left text-sm text-foreground bg-input rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                      onClick={() => {
                        setFrom(fav.fromPostcode);
                        setTo(fav.toPostcode);
                        setShowFavourites(false);
                        toast.info(`Loaded: ${fav.name}`);
                      }}
                    >
                      <div className="font-medium">{fav.name}</div>
                      <div className="text-xs text-muted-foreground">{fav.fromPostcode} → {fav.toPostcode}</div>
                    </button>
                    <button
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => deleteFavMutation.mutate({ id: fav.id })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Search inputs */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-400" />
                <div className="w-0.5 h-6 bg-border" />
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-400" />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="From postcode (e.g. MK1 1DF)"
                  value={from}
                  onChange={e => setFrom(e.target.value.toUpperCase())}
                  className="bg-input border-border text-sm uppercase"
                  maxLength={10}
                />
                <Input
                  placeholder="To postcode (e.g. CR0 4YL)"
                  value={to}
                  onChange={e => setTo(e.target.value.toUpperCase())}
                  className="bg-input border-border text-sm uppercase"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Departure time */}
            <div>
              <button
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={() => setShowTimeOptions(s => !s)}
              >
                <CalendarClock size={13} className="text-primary" />
                <span className="flex-1 text-left">{depLabel}</span>
                {showTimeOptions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showTimeOptions && (
                <div className="mt-2 space-y-2 pl-5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDepartureMode("now")}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                        departureMode === "now"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      Depart Now
                    </button>
                    <button
                      onClick={() => setDepartureMode("custom")}
                      className={cn(
                        "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                        departureMode === "custom"
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      Choose Time
                    </button>
                  </div>
                  {departureMode === "custom" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={departureDate}
                        onChange={e => setDepartureDate(e.target.value)}
                        className="bg-input border-border text-xs"
                        min={format(new Date(), "yyyy-MM-dd")}
                      />
                      <Input
                        type="time"
                        value={departureTime}
                        onChange={e => setDepartureTime(e.target.value)}
                        className="bg-input border-border text-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={searchRoutes}
              disabled={loading || !mapReady}
              className="w-full bg-primary text-primary-foreground font-bold"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin mr-2" />Searching routes...</>
              ) : !mapReady ? (
                <><Loader2 size={16} className="animate-spin mr-2" />Loading map...</>
              ) : (
                <><Zap size={16} className="mr-2" />Find Best Routes</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="relative">
            <MapView
              initialCenter={{ lat: 52.5, lng: -1.5 }}
              initialZoom={6}
              className="h-72 w-full"
              onMapReady={(map) => { mapRef.current = map; setMapReady(true); }}
            />
            {selectedRoute && (
              <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1 border border-border">
                {Array.from(new Set(selectedRoute.legs.map(l =>
                  l.mode === "WALKING" ? "WALKING" : (l.transitMode ?? l.mode)
                ))).map(type => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: LEG_COLOURS[type] ?? "#888" }} />
                    <span className="text-muted-foreground capitalize">{type.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Save as favourite (shown after search) */}
        {showSaveFav && isAuthenticated && routes.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <Star size={14} className="text-amber-400 flex-shrink-0" />
                <Input
                  placeholder="Name this route (e.g. Home → ALD depot)"
                  value={favName}
                  onChange={e => setFavName(e.target.value)}
                  className="bg-input border-border text-sm flex-1"
                />
                <Button
                  size="sm"
                  disabled={!favName.trim() || savingFav}
                  onClick={async () => {
                    setSavingFav(true);
                    try {
                      await saveFavMutation.mutateAsync({ name: favName.trim(), fromPostcode: from, toPostcode: to });
                    } finally { setSavingFav(false); }
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3"
                >
                  {savingFav ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                </Button>
                <button onClick={() => setShowSaveFav(false)} className="text-muted-foreground hover:text-foreground">
                  ×
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route options */}
        {routes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {routes.length} Route{routes.length > 1 ? "s" : ""} Found
              {departureMode === "custom" && (
                <span className="ml-2 text-primary normal-case font-normal">
                  · {format(getDepartureDate(), "EEE d MMM HH:mm")}
                </span>
              )}
            </h2>
            {routes.map(route => {
              const cfg = labelConfig[route.label] ?? labelConfig.balanced;
              const isSelected = selectedRoute?.id === route.id;

              return (
                <Card
                  key={route.id}
                  className={cn(
                    "bg-card border-border cursor-pointer transition-all",
                    isSelected && "border-primary ring-1 ring-primary/30"
                  )}
                  onClick={() => handleSelectRoute(route)}
                >
                  <CardContent className="pt-4 pb-3 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-xs flex items-center gap-1", cfg.colour)}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                        {isSelected && (
                          <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10">
                            <CheckCircle2 size={10} className="mr-1" /> Viewing
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          ~£{route.estimatedCost.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {route.legs.some(l => l.mode === "TRANSIT") ? "est. fare" : "est. cost"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-foreground font-semibold">
                        <Clock size={13} className="text-muted-foreground" />
                        {formatDuration(route.totalDurationSecs)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <MapPin size={12} />
                        {(route.totalDistanceMetres / 1609.34).toFixed(1)} mi
                      </div>
                      {route.departureTime && (
                        <div className="text-xs text-muted-foreground">Dep. {route.departureTime}</div>
                      )}
                      {route.arrivalTime && (
                        <div className="text-xs text-muted-foreground">Arr. {route.arrivalTime}</div>
                      )}
                    </div>

                    {/* Leg strip */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {route.legs.map((leg, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: getLegColour(leg) + "22",
                              color: getLegColour(leg),
                              border: `1px solid ${getLegColour(leg)}44`,
                            }}
                          >
                            {getLegIcon(leg)}
                            {leg.mode === "WALKING"
                              ? `${Math.round(leg.distanceMetres)}m walk`
                              : leg.mode === "DRIVING"
                              ? `Drive ${(leg.distanceMetres / 1609.34).toFixed(1)}mi`
                              : leg.lineShortName || leg.lineName || leg.transitMode?.toLowerCase()}
                          </div>
                          {i < route.legs.length - 1 && (
                            <ChevronRight size={10} className="text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Expanded step-by-step */}
                    {isSelected && (
                      <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                        {route.legs.map((leg, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <div
                              className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: getLegColour(leg) + "33", color: getLegColour(leg) }}
                            >
                              {getLegIcon(leg)}
                            </div>
                            <div className="flex-1">
                              {leg.mode === "TRANSIT" ? (
                                <span className="text-foreground">
                                  <span className="font-medium" style={{ color: getLegColour(leg) }}>
                                    {leg.lineName || leg.transitMode}
                                  </span>
                                  {leg.departureStop && ` from ${leg.departureStop}`}
                                  {leg.arrivalStop && ` → ${leg.arrivalStop}`}
                                  {leg.numStops ? ` (${leg.numStops} stops)` : ""}
                                  {leg.departureTime && ` · dep. ${leg.departureTime}`}
                                  {leg.estimatedFare !== undefined && (
                                    <span className="ml-1 text-green-400 font-semibold">
                                      ~£{leg.estimatedFare.toFixed(2)}
                                    </span>
                                  )}
                                </span>
                              ) : leg.mode === "WALKING" ? (
                                <span className="text-muted-foreground">
                                  Walk {leg.distanceMetres < 1000
                                    ? `${Math.round(leg.distanceMetres)}m`
                                    : `${(leg.distanceMetres / 1000).toFixed(1)}km`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Drive {(leg.distanceMetres / 1609.34).toFixed(1)} miles
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground flex-shrink-0">
                              {formatDuration(leg.durationSecs)}
                            </span>
                          </div>
                        ))}
                        {/* Fare note */}
                        {route.legs.some(l => l.mode === "TRANSIT") && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Fares based on UK Anytime Single rates. Advance tickets may be cheaper.
                          </p>
                        )}
                      </div>
                    )}

                    {route.warnings.length > 0 && (
                      <div className="text-xs text-amber-400 bg-amber-400/10 rounded p-2">
                        {route.warnings[0]}
                      </div>
                    )}

                    {isSelected && onUseRoute && (
                      <Button
                        size="sm"
                        className="w-full mt-1 bg-primary text-primary-foreground font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          const dominantMode = route.legs.find(l => l.mode === "TRANSIT")?.transitMode ?? "DRIVING";
                          onUseRoute(route.estimatedCost, dominantMode.toLowerCase(), route.summary);
                          toast.success(`Route cost £${route.estimatedCost.toFixed(2)} added to travel expenses`);
                        }}
                      >
                        <CheckCircle2 size={14} className="mr-2" />
                        Use This Route — £{route.estimatedCost.toFixed(2)}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {routes.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Navigation size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Enter postcodes above to find routes</p>
            <p className="text-xs mt-1">Compares train, bus, and driving options in real time</p>
            {!isAuthenticated && (
              <p className="text-xs mt-2 text-primary">Sign in to save favourite routes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
