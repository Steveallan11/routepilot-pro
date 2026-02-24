import { useState, useCallback } from "react";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Fuel, Navigation, MapPin, Star, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface FuelStation {
  placeId: string;
  name: string;
  address: string;
  distance: number; // metres
  lat: number;
  lng: number;
  rating?: number;
  isOpen?: boolean;
}

export default function FuelFinderPage() {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const { data: settings } = trpc.settings.get.useQuery();

  const clearMarkers = () => {
    markers.forEach((m) => m.setMap(null));
    setMarkers([]);
  };

  const searchNearby = useCallback(async (lat: number, lng: number) => {
    if (!mapInstance) return;
    setLoading(true);
    clearMarkers();

    const center = new google.maps.LatLng(lat, lng);
    mapInstance.setCenter(center);
    mapInstance.setZoom(13);

    const service = new google.maps.places.PlacesService(mapInstance);
    service.nearbySearch(
      {
        location: center,
        radius: 5000,
        type: "gas_station",
      },
      (results, status) => {
        setLoading(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
          toast.error("No fuel stations found nearby");
          return;
        }

        const stationList: FuelStation[] = results.slice(0, 15).map((place) => {
          const plat = place.geometry?.location?.lat() ?? 0;
          const plng = place.geometry?.location?.lng() ?? 0;
          const dist = google.maps.geometry?.spherical.computeDistanceBetween(
            center,
            new google.maps.LatLng(plat, plng)
          ) ?? 0;

          return {
            placeId: place.place_id ?? "",
            name: place.name ?? "Fuel Station",
            address: place.vicinity ?? "",
            distance: Math.round(dist),
            lat: plat,
            lng: plng,
            rating: place.rating,
            isOpen: place.opening_hours?.isOpen?.(),
          };
        });

        stationList.sort((a, b) => a.distance - b.distance);
        setStations(stationList);

        // Add markers
        const newMarkers = stationList.map((s, i) => {
          const marker = new google.maps.Marker({
            position: { lat: s.lat, lng: s.lng },
            map: mapInstance,
            title: s.name,
            label: { text: String(i + 1), color: "white", fontSize: "12px", fontWeight: "bold" },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#f59e0b",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });
          return marker;
        });
        setMarkers(newMarkers);
      }
    );
  }, [mapInstance, markers]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    setMapInstance(map);
    // Try to get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => searchNearby(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Fall back to home postcode or London
          const home = settings?.homePostcode;
          if (home) {
            geocodePostcode(home, map);
          } else {
            searchNearby(51.5074, -0.1278); // London
          }
        }
      );
    }
  }, [searchNearby, settings]);

  const geocodePostcode = (pc: string, map?: google.maps.Map) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: pc + ", UK" }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const loc = results[0].geometry.location;
        if (map) {
          map.setCenter(loc);
          map.setZoom(13);
        }
        searchNearby(loc.lat(), loc.lng());
      } else {
        toast.error("Postcode not found");
        setLoading(false);
      }
    });
  };

  const handleSearch = () => {
    if (!postcode.trim()) {
      toast.error("Enter a postcode to search");
      return;
    }
    setLoading(true);
    geocodePostcode(postcode.trim());
  };

  const handleNavigate = (station: FuelStation) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const formatDistance = (m: number) => {
    if (m < 1000) return `${m}m`;
    return `${(m / 1609.34).toFixed(1)} miles`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 space-y-3 bg-background border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Fuel className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Fuel Finder</h1>
            <p className="text-xs text-muted-foreground">Find petrol stations near you</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="Enter postcode..."
            className="font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
        <MapView
          onMapReady={handleMapReady}
          className="w-full h-full"
        />
      </div>

      {/* Station list */}
      {stations.length > 0 && (
        <div className="h-64 overflow-y-auto bg-background border-t border-border/50">
          <div className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium px-1">
              {stations.length} stations found nearby
            </p>
            {stations.map((station, i) => (
              <Card key={station.placeId} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{station.name}</p>
                        {station.isOpen !== undefined && (
                          <Badge
                            variant="outline"
                            className={station.isOpen ? "border-green-500/50 text-green-400 text-xs" : "border-red-500/50 text-red-400 text-xs"}
                          >
                            {station.isOpen ? "Open" : "Closed"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {station.address}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-blue-400">{formatDistance(station.distance)}</span>
                        {station.rating && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400" />
                            {station.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleNavigate(station)}
                      className="shrink-0 gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Go
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {stations.length === 0 && !loading && (
        <div className="p-6 text-center text-muted-foreground bg-background border-t border-border/50">
          <Fuel className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Search by postcode or allow location access</p>
        </div>
      )}
    </div>
  );
}
