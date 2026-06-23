// Raw Discovery fetch for a restaurant's challenges. Mirrors lib/specials.ts:
// API-key auth (X-API-Key, no member token), filter by the bare `restaurant`
// param, keep only what the card needs. The key must carry the
// `read:restaurant_challenges` scope or the call 403s — we treat any failure as
// "no challenges" so a card just drops the row. Server-only — carries the key.

// API_BASE_URL switches environments (unset = production), matching the SDK clients.
import { env } from "./env";

const DISCOVERY_URL = env.API_BASE_URL;

// Discovery sits behind a WAF that 403s non-browser User-Agents (see check-ins).
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface RestaurantChallenge {
  id: string;
  title: string;
  type: string | null;
}

interface RawChallenge {
  id: string;
  title?: string | null;
  type?: string | null;
}

// Challenges are hidden silently in the UI, so a key minted without
// `read:restaurant_challenges` looks like "no challenges" rather than a broken
// feature — warn once in dev to make the cause obvious.
let warnedMissingScope = false;

export async function listRestaurantChallenges(
  apiKey: string,
  restaurantId: string,
): Promise<RestaurantChallenge[]> {
  try {
    const res = await fetch(
      `${DISCOVERY_URL}/challenges?restaurant=${restaurantId}&page_size=50`,
      {
        headers: { "X-API-Key": apiKey, "User-Agent": BROWSER_UA },
        // One call per restaurant per render. Challenges run over days/weeks, so
        // cache in Next's Data Cache and revalidate every 10 minutes rather than
        // re-hitting Discovery on each page load.
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
          "[challenges] Restaurant challenges are hidden: FLYNET_API_KEY got " +
            "403 from /challenges. The key needs the `read:restaurant_challenges` " +
            "scope (set when the key is minted). Mint a key with it to show them.",
        );
      }
      return [];
    }
    const data = (await res.json()) as { challenges?: RawChallenge[] };
    return (data.challenges ?? [])
      .filter((challenge) => challenge.title)
      .map((challenge) => ({
        id: challenge.id,
        title: challenge.title as string,
        type: challenge.type ?? null,
      }));
  } catch {
    return [];
  }
}
