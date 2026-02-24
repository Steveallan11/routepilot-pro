import { useState, useRef, useCallback } from "react";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Train, Bus, Car, PersonStanding, Zap, PoundSterling, Clock,
  ChevronRight, ArrowRight, MapPin, Loader2, CheckCircle2, X,
  Navigation, TrendingDown, Timer, Scale
} from "lucide-react";
import { cn } from "@/lib/utils";

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

// ─── Cost estimation ──────────────────────────────────────────────────────────

function estimateCost(legs: TransitLeg[]): number {
  let cost = 0;
  for (const leg of legs) {
    if (leg.mode === "TRANSIT") {
      const distKm = leg.distanceMetres / 1000;
      if (leg.transitMode === "TRAIN" || leg.transitMode === "RAIL") {
        // UK rail: roughly £0.20/km with £2 base
        cost += 2 + distKm * 0.20;
      } else if (leg.transitMode === "BUS" || leg.transitMode === "TRAM") {
        // UK bus: ~£2.50 flat cap per journey
        cost += 2.50;
      } else {
        cost += 1.50 + distKm * 0.10;
      }
    }
    // Walking is free; driving handled separately
  }
  return Math.round(cost * 100) / 100;
}

// ─── Colour coding ────────────────────────────────────────────────────────────

const LEG_COLOURS: Record<string, string> = {
  TRAIN: "#3B82F6",   // blue
  RAIL: "#3B82F6",
  SUBWAY: "#8B5CF6",  // purple
  BUS: "#F97316",     // orange
  TRAM: "#10B981",    // green
  FERRY: "#06B6D4",   // cyan
  WALKING: "#6B7280", // grey
  DRIVING: "#EF4444", // red
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
    case "TRAM": return <Train size={14} />;
    default: return <Train size={14} />;
  }
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ─── Parse Google Directions transit result ───────────────────────────────────

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
          polyline,
          startLocation: startLoc,
          endLocation: endLoc,
        });
      } else if (mode === "WALKING") {
        legs.push({
          mode: "WALKING",
          durationSecs: step.duration?.value ?? 0,
          distanceMetres: step.distance?.value ?? 0,
          polyline,
          startLocation: startLoc,
          endLocation: endLoc,
          instructions: step.instructions ?? "",
        });
      } else {
        legs.push({
          mode: "DRIVING",
          durationSecs: step.duration?.value ?? 0,
          distanceMetres: step.distance?.value ?? 0,
          polyline,
          startLocation: startLoc,
          endLocation: endLoc,
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
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const renderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // Clear map overlays
  const clearMap = useCallback(() => {
    renderersRef.current.forEach(r => r.setMap(null));
    renderersRef.current = [];
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];
  }, []);

  // Draw a route on the map with colour-coded polylines per leg
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
          offset: "0",
          repeat: "12px",
        }] : undefined,
      });
      polyline.setMap(mapRef.current!);

      // Interchange marker at start of each leg (except first)
      if (i > 0) {
        const markerEl = document.createElement("div");
        markerEl.style.cssText = `
          width: 10px; height: 10px;
          background: ${colour};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        `;
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current!,
          position: leg.startLocation,
          content: markerEl,
          title: leg.departureStop ?? leg.mode,
        });
        markersRef.current.push(marker);
      }
    });

    // Start marker (green)
    const startEl = document.createElement("div");
    startEl.innerHTML = `<div style="background:#22C55E;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4)">▶ ${from.toUpperCase()}</div>`;
    markersRef.current.push(new window.google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current!,
      position: route.legs[0].startLocation,
      content: startEl,
    }));

    // End marker (red)
    const endEl = document.createElement("div");
    endEl.innerHTML = `<div style="background:#EF4444;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4)">⬛ ${to.toUpperCase()}</div>`;
    markersRef.current.push(new window.google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current!,
      position: route.legs[route.legs.length - 1].endLocation,
      content: endEl,
    }));

    mapRef.current!.fitBounds(bounds, { top: 60, bottom: 60, left: 20, right: 20 });
  }, [clearMap, from, to]);

  // Search routes using Google Maps Directions API (frontend)
  const searchRoutes = useCallback(async () => {
    if (!from.trim() || !to.trim()) {
      toast.error("Please enter both postcodes");
      return;
    }
    if (!mapRef.current) {
      toast.error("Map not ready yet — please wait a moment");
      return;
    }
    setLoading(true);
    setRoutes([]);
    setSelectedRoute(null);
    clearMap();

    try {
      const directionsService = new window.google.maps.DirectionsService();

      // Fetch transit options (multiple alternatives)
      const transitRequest: google.maps.DirectionsRequest = {
        origin: `${from.trim()}, UK`,
        destination: `${to.trim()}, UK`,
        travelMode: google.maps.TravelMode.TRANSIT,
        provideRouteAlternatives: true,
        transitOptions: {
          departureTime: new Date(),
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

      // Also fetch driving for comparison
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

      // Process transit routes
      if (transitResult.status === "fulfilled") {
        const res = transitResult.value;
        res.routes.forEach((route, idx) => {
          const legs = parseTransitResult(route);
          const totalDuration = route.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
          const totalDistance = route.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
          const cost = estimateCost(legs);
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

      // Process driving route
      if (drivingResult.status === "fulfilled") {
        const res = drivingResult.value;
        const route = res.routes[0];
        if (route) {
          const legs = parseTransitResult(route);
          const totalDuration = route.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
          const totalDistance = route.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
          const distMiles = totalDistance / 1609.34;
          const drivingCost = distMiles * 0.15 + 5; // ~15p/mile + parking estimate
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
        toast.error("No routes found between these postcodes. Try nearby towns instead.");
        setLoading(false);
        return;
      }

      // Rank: fastest = lowest duration, cheapest = lowest cost, balanced = best cost/time ratio
      const sorted = [...candidates].sort((a, b) => a.totalDurationSecs - b.totalDurationSecs);
      const byCost = [...candidates].sort((a, b) => a.estimatedCost - b.estimatedCost);
      const byBalance = [...candidates].sort((a, b) => {
        const scoreA = a.estimatedCost + (a.totalDurationSecs / 60) * 0.25;
        const scoreB = b.estimatedCost + (b.totalDurationSecs / 60) * 0.25;
        return scoreA - scoreB;
      });

      const labelled: RouteOption[] = [];
      const used = new Set<string>();

      const addUnique = (r: RouteOption, label: RouteOption["label"]) => {
        if (!used.has(r.id)) {
          used.add(r.id);
          labelled.push({ ...r, label });
        } else {
          // Still show it but with a different label if it's the same route
          labelled.push({ ...r, id: `${r.id}-${label}`, label });
        }
      };

      addUnique(sorted[0], "fastest");
      addUnique(byCost[0], "cheapest");
      addUnique(byBalance[0], "balanced");

      // Add remaining unique routes
      candidates.forEach(r => {
        if (!used.has(r.id)) {
          used.add(r.id);
          labelled.push(r);
        }
      });

      setRoutes(labelled);

      // Auto-select and draw the balanced route
      const balanced = labelled.find(r => r.label === "balanced") ?? labelled[0];
      setSelectedRoute(balanced);
      drawRoute(balanced);

    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch routes. Check postcodes and try again.");
    } finally {
      setLoading(false);
    }
  }, [from, to, clearMap, drawRoute]);

  const handleSelectRoute = useCallback((route: RouteOption) => {
    setSelectedRoute(route);
    drawRoute(route);
  }, [drawRoute]);

  const labelConfig = {
    fastest: { icon: <Timer size={12} />, colour: "text-blue-400 border-blue-400/30 bg-blue-400/10", label: "Fastest" },
    cheapest: { icon: <TrendingDown size={12} />, colour: "text-green-400 border-green-400/30 bg-green-400/10", label: "Cheapest" },
    balanced: { icon: <Scale size={12} />, colour: "text-amber-400 border-amber-400/30 bg-amber-400/10", label: "Best Value" },
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Navigation size={18} className="text-primary" />
          Route Finder
        </h1>
        <p className="text-xs text-muted-foreground">Find the best way to reposition between jobs</p>
      </div>

      <div className="px-4 py-4 space-y-4">
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
                  maxLength={8}
                />
                <Input
                  placeholder="To postcode (e.g. CR0 4YL)"
                  value={to}
                  onChange={e => setTo(e.target.value.toUpperCase())}
                  className="bg-input border-border text-sm uppercase"
                  maxLength={8}
                />
              </div>
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
              onMapReady={(map) => {
                mapRef.current = map;
                setMapReady(true);
              }}
            />
            {/* Legend */}
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

        {/* Route options */}
        {routes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {routes.length} Route{routes.length > 1 ? "s" : ""} Found
            </h2>
            {routes.map(route => {
              const cfg = labelConfig[route.label] ?? labelConfig.balanced;
              const isSelected = selectedRoute?.id === route.id;
              const transitModes = Array.from(new Set(
                route.legs
                  .filter(l => l.mode === "TRANSIT")
                  .map(l => l.transitMode ?? "BUS")
              ));

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
                    {/* Header row */}
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
                        <div className="text-xs text-muted-foreground">estimated fare</div>
                      </div>
                    </div>

                    {/* Stats row */}
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
                        <div className="text-xs text-muted-foreground">
                          Dep. {route.departureTime}
                        </div>
                      )}
                      {route.arrivalTime && (
                        <div className="text-xs text-muted-foreground">
                          Arr. {route.arrivalTime}
                        </div>
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

                    {/* Step-by-step breakdown */}
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
                      </div>
                    )}

                    {/* Warnings */}
                    {route.warnings.length > 0 && (
                      <div className="text-xs text-amber-400 bg-amber-400/10 rounded p-2">
                        {route.warnings[0]}
                      </div>
                    )}

                    {/* Use this route button */}
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

        {/* Empty state */}
        {routes.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Navigation size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Enter postcodes above to find routes</p>
            <p className="text-xs mt-1">Compares train, bus, and driving options</p>
          </div>
        )}
      </div>
    </div>
  );
}
