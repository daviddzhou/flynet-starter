// Raw Discovery fetch for a restaurant's locations. The SDK's generated
// Location model lags the live API: it throws on `coordinate: null` and strips
// the `reservation_url` / `reservations_enabled` fields the API now returns.
// Until the SDK catches up, hit the endpoint directly and keep only the fields
// the UI needs. Server-only — it carries the Discovery API key.

// API_BASE_URL switches environments (unset = production), matching the SDK clients.
import { env } from "./env";

const DISCOVERY_URL = env.API_BASE_URL;

export interface RestaurantLocation {
  id: string;
  neighborhood: string | null;
  city: string | null;
  /** Booking link, only when the location has reservations switched on. */
  reservationUrl: string | null;
}

interface RawLocation {
  id: string;
  neighborhood?: { name?: string | null } | null;
  address?: { city?: string | null } | null;
  reservation_url?: string | null;
  reservations_enabled?: boolean;
}

export async function listRestaurantLocations(
  apiKey: string,
  restaurantId: string,
): Promise<RestaurantLocation[]> {
  const res = await fetch(
    `${DISCOVERY_URL}/restaurants/${restaurantId}/locations`,
    {
      headers: { "X-API-Key": apiKey },
      // Locations barely change, and this runs once per restaurant on every
      // render. Cache in Next's Data Cache so we don't re-hit Discovery on
      // each page load — served from cache for an hour, then revalidated.
      next: { revalidate: 3600 },
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { locations?: RawLocation[] };
  return (data.locations ?? []).map((location) => ({
    id: location.id,
    neighborhood: location.neighborhood?.name ?? null,
    city: location.address?.city ?? null,
    reservationUrl:
      (location.reservations_enabled && location.reservation_url) || null,
  }));
}
