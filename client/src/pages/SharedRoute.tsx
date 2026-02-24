import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { MapView } from "@/components/Map";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Train, Bus, Car, PersonStanding, Clock, MapPin,
  ChevronRight, Navigation, AlertCircle, Loader2, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Colour / icon helpers (mirrors RouteFinder) ─────────────────────────────

const LEG_COLOURS: Record<string, string> = {
  TRAIN: "#3B82F6", RAIL: "#3B82F6", SUBWAY: "#8B5CF6",
  BUS: "#F97316", TRAM: "#10B981", FERRY: "#06B6D4",
  WALKING: "#6B7280", DRIVING: "#EF4444",
};

function getLegColour(leg: any): string {
  if (leg.mode === "WALKING") return LEG_COLOURS.WALKING;
  if (leg.mode === "DRIVING") return LEG_COLOURS.DRIVING;
  const tm = (leg.transitMode ?? leg.mode ?? "BUS").toUpperCase();
  return LEG_COLOURS[tm] ?? "#F97316";
}

function getLegIcon(leg: any) {
  if (leg.mode === "WALKING") return <PersonStanding size={14} />;
  if (leg.mode === "DRIVING") return <Car size={14} />;
  const tm = (leg.transitMode ?? "").toUpperCase();
  if (tm === "TRAIN" || tm === "RAIL") return <Train size={14} />;
  if (tm === "BUS") return <Bus size={14} />;
  return <Train size={14} />;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SharedRoute() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const { data: route, isLoading, error } = trpc.routes.getSharedRoute.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const legs: any[] = Array.isArray(route?.legsSnapshot) ? route.legsSnapshot : [];

  // Draw route on map once both are ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || legs.length === 0) return;

    // Clear existing
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    legs.forEach((leg, i) => {
      if (!leg.polyline) return;
      const colour = getLegColour(leg);
      try {
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
      } catch { /* skip invalid polylines */ }
    });

    if (!bounds.isEmpty()) {
      mapRef.current!.fitBounds(bounds, { top: 60, bottom: 60, left: 20, right: 20 });
    }
  }, [mapReady, legs]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Loading shared route…</p>
        </div>
      </div>
    );
  }

  if (!route || error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="bg-card border-border max-w-sm w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <AlertCircle size={40} className="text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Route Not Found</h2>
            <p className="text-sm text-muted-foreground">
              This share link may have expired (links are valid for 7 days) or the route no longer exists.
            </p>
            <a
              href="/"
              className="inline-block mt-2 text-sm text-primary hover:underline"
            >
              Open RoutePilot Pro
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dominantMode = (route.dominantMode ?? "transit").toUpperCase();
  const modeColour = LEG_COLOURS[dominantMode] ?? "#22C55E";

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <Navigation size={14} className="text-primary" />
          </div>
          <span className="text-sm font-semibold text-muted-foreground">RoutePilot Pro</span>
          <Share2 size={12} className="text-muted-foreground ml-auto" />
          <span className="text-xs text-muted-foreground">Shared Route</span>
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {route.fromPostcode} → {route.toPostcode}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shared on {new Date(route.createdAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric"
          })}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Summary card */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {route.totalDurationSecs ? formatDuration(route.totalDurationSecs) : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {route.totalDistanceMetres
                    ? `${(route.totalDistanceMetres / 1609.34).toFixed(1)} miles`
                    : ""}
                </div>
              </div>
              <div className="text-right">
                {route.estimatedCost && (
                  <>
                    <div className="text-xl font-bold" style={{ color: modeColour }}>
                      ~£{Number(route.estimatedCost).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">estimated fare</div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {route.departureTime && (
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  <Clock size={10} className="mr-1" /> Dep. {route.departureTime}
                </Badge>
              )}
              {route.arrivalTime && (
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  Arr. {route.arrivalTime}
                </Badge>
              )}
              {route.label && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    route.label === "fastest" && "text-blue-400 border-blue-400/30 bg-blue-400/10",
                    route.label === "cheapest" && "text-green-400 border-green-400/30 bg-green-400/10",
                    route.label === "balanced" && "text-amber-400 border-amber-400/30 bg-amber-400/10",
                  )}
                >
                  {route.label === "fastest" ? "Fastest" : route.label === "cheapest" ? "Cheapest" : "Best Value"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="bg-card border-border overflow-hidden">
          <MapView
            initialCenter={{ lat: 52.5, lng: -1.5 }}
            initialZoom={6}
            className="h-72 w-full"
            onMapReady={(map) => { mapRef.current = map; setMapReady(true); }}
          />
        </Card>

        {/* Leg-by-leg breakdown */}
        {legs.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                Journey Breakdown
              </h3>
              <div className="space-y-2">
                {legs.map((leg: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div
                      className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: getLegColour(leg) + "33", color: getLegColour(leg) }}
                    >
                      {getLegIcon(leg)}
                    </div>
                    <div className="flex-1">
                      {leg.mode === "TRANSIT" ? (
                        <span className="text-foreground">
                          <span className="font-medium" style={{ color: getLegColour(leg) }}>
                            {leg.lineName || leg.transitMode || "Transit"}
                          </span>
                          {leg.departureStop && ` from ${leg.departureStop}`}
                          {leg.arrivalStop && ` → ${leg.arrivalStop}`}
                          {leg.numStops ? ` (${leg.numStops} stops)` : ""}
                          {leg.departureTime && ` · dep. ${leg.departureTime}`}
                          {leg.estimatedFare !== undefined && (
                            <span className="ml-1 text-green-400 font-semibold">
                              ~£{Number(leg.estimatedFare).toFixed(2)}
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
                          Drive {leg.distanceMetres
                            ? `${(leg.distanceMetres / 1609.34).toFixed(1)} miles`
                            : ""}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground flex-shrink-0">
                      {formatDuration(leg.durationSecs)}
                    </span>
                    {i < legs.length - 1 && (
                      <ChevronRight size={10} className="text-muted-foreground flex-shrink-0 mt-1" />
                    )}
                  </div>
                ))}
              </div>
              {legs.some((l: any) => l.mode === "TRANSIT") && (
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Fares are estimates based on UK Anytime Single rates. Advance tickets may be cheaper.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="text-center pt-2">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <Navigation size={14} />
            Open RoutePilot Pro to plan your own routes
          </a>
        </div>
      </div>
    </div>
  );
}
