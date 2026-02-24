import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import axios from "axios";

// UK Government Fuel Finder API
const FUEL_API_URL = "https://www.gov.uk/api/fuel-prices-data";

interface FuelStation {
  site_id: string;
  brand: string;
  address: string;
  postcode: string;
  location: { latitude: number; longitude: number };
  prices: { E10?: number; B7?: number; E5?: number; SDV?: number };
}

interface FuelApiResponse {
  last_updated: string;
  stations: FuelStation[];
}

// Cache fuel data for 30 minutes
let fuelCache: { data: FuelApiResponse; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchFuelData(): Promise<FuelApiResponse | null> {
  if (fuelCache && Date.now() - fuelCache.fetchedAt < CACHE_TTL_MS) {
    return fuelCache.data;
  }
  try {
    const response = await axios.get<FuelApiResponse>(FUEL_API_URL, { timeout: 10000 });
    fuelCache = { data: response.data, fetchedAt: Date.now() };
    return response.data;
  } catch (err) {
    console.warn("[Fuel] API fetch failed:", err);
    return null;
  }
}

function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function postcodeToCoords(postcode: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const clean = postcode.replace(/\s+/g, "").toUpperCase();
    const response = await axios.get<{ result: { latitude: number; longitude: number } }>(
      `https://api.postcodes.io/postcodes/${clean}`,
      { timeout: 5000 }
    );
    return { lat: response.data.result.latitude, lon: response.data.result.longitude };
  } catch {
    return null;
  }
}

export const fuelRouter = router({
  // Get national average fuel prices
  averages: publicProcedure.query(async () => {
    const data = await fetchFuelData();
    if (!data) {
      return {
        petrolPencePerLitre: 143,
        dieselPencePerLitre: 151,
        lastUpdated: new Date().toISOString(),
        source: "fallback",
      };
    }

    const stations = data.stations;
    const petrolPrices = stations.map(s => s.prices.E10 ?? s.prices.E5).filter((p): p is number => p != null && p > 0);
    const dieselPrices = stations.map(s => s.prices.B7).filter((p): p is number => p != null && p > 0);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      petrolPencePerLitre: Math.round(avg(petrolPrices) * 10) / 10,
      dieselPencePerLitre: Math.round(avg(dieselPrices) * 10) / 10,
      lastUpdated: data.last_updated,
      source: "uk-gov",
    };
  }),

  // Get nearest fuel prices to a postcode
  nearest: publicProcedure
    .input(z.object({ postcode: z.string(), fuelType: z.enum(["petrol", "diesel"]).default("petrol") }))
    .query(async ({ input }) => {
      const coords = await postcodeToCoords(input.postcode);
      if (!coords) {
        return { stations: [], error: "Invalid postcode" };
      }

      const data = await fetchFuelData();
      if (!data) return { stations: [], error: "Fuel data unavailable" };

      const withDistance = data.stations
        .filter(s => {
          const price = input.fuelType === "petrol" ? (s.prices.E10 ?? s.prices.E5) : s.prices.B7;
          return price != null && price > 0;
        })
        .map(s => ({
          name: s.brand,
          address: s.address,
          postcode: s.postcode,
          price: input.fuelType === "petrol" ? (s.prices.E10 ?? s.prices.E5 ?? 0) : (s.prices.B7 ?? 0),
          distanceMiles: haversineDistanceMiles(
            coords.lat, coords.lon,
            s.location.latitude, s.location.longitude
          ),
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 5);

      return { stations: withDistance, lastUpdated: data.last_updated };
    }),
});
