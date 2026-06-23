// Raw Discovery fetch for a restaurant's specials (offers). Mirrors
// lib/check-ins.ts: API-key auth (X-API-Key, no member token), filter by the
// bare `restaurant` param, and keep only the fields the card needs. The key must
// carry the `read:restaurant_specials` scope or the call 403s — we treat any
// failure as "no specials" so a card just drops the offers row instead of
// erroring. Server-only — it carries the Discovery API key.

// API_BASE_URL switches environments (unset = production), matching the SDK clients.
import { env } from "./env";

const DISCOVERY_URL = env.API_BASE_URL;

// Discovery sits behind a WAF that 403s non-browser User-Agents (see check-ins).
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface RestaurantSpecial {
  id: string;
  label: string;
  description: string | null;
  emoji: string | null;
}

interface RawSpecial {
  id: string;
  label?: string | null;
  description?: string | null;
  emoji?: string | null;
}

// Specials are hidden silently in the UI, so a key minted without
// `read:restaurant_specials` looks like "no offers" rather than a broken
// feature — warn once in dev to make the cause obvious.
let warnedMissingScope = false;

export async function listRestaurantSpecials(
  apiKey: string,
  restaurantId: string,
): Promise<RestaurantSpecial[]> {
  try {
    const res = await fetch(
      `${DISCOVERY_URL}/specials?restaurant=${restaurantId}&page_size=50`,
      {
        headers: { "X-API-Key": apiKey, "User-Agent": BROWSER_UA },
        // One call per restaurant per render. Offers change occasionally, not
        // constantly, so cache in Next's Data Cache and revalidate every 10
        // minutes instead of re-hitting Discovery on each page load.
        next: { revalidate: 600 },
      },
    );
    if (!res.ok) {
      if (
        res.status === 403 &&
        !warnedMissingScope &&
        env.NODE_ENV !== "production"
      ) {
        warnedMissingScope = true;
        console.warn(
          "[specials] Restaurant specials are hidden: FLYNET_API_KEY got 403 " +
            "from /specials. The key needs the `read:restaurant_specials` scope " +
            "(set when the key is minted). Mint a key with it to show offers.",
        );
      }
      return [];
    }
    const data = (await res.json()) as { specials?: RawSpecial[] };
    return (data.specials ?? [])
      .filter((special) => special.label)
      .map((special) => ({
        id: special.id,
        label: special.label as string,
        description: special.description ?? null,
        emoji: special.emoji ?? null,
      }));
  } catch {
    return [];
  }
}
