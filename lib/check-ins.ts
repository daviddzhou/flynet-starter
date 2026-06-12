// Raw Discovery fetch for a restaurant's total check-in count.
//
// The check-in feed (GET /check_ins) is API-key auth — X-API-Key, no member
// token — but two things bite you, so we don't use the SDK member client here:
//   1. The key must carry the `read:checkins` scope (set when the key is minted;
//      an app listing the scope is NOT enough). Without it the call 403s, so we
//      treat any failure as "unknown" and return null — the card just hides the
//      stat rather than erroring.
//   2. The WAF rejects non-browser User-Agents with a 403 HTML body, so we send
//      a browser-like UA.
// We only need the count, so ask for the smallest page and read
// pagination.total_count. Server-only — it carries the Discovery API key.

// API_BASE_URL switches environments (unset = production), matching the SDK clients.
import { env } from "./env";

const DISCOVERY_URL = env.API_BASE_URL;

// The check-in feed sits behind a WAF that 403s non-browser User-Agents.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// The most common reason counts never show is a key minted without the
// `read:checkins` scope — every call 403s. We hide the stat silently in the UI,
// so warn once in dev; otherwise it just looks like the feature is broken.
let warnedMissingScope = false;

export async function getRestaurantCheckInCount(
  apiKey: string,
  restaurantId: string,
): Promise<number | null> {
  try {
    // Filter by the bare `restaurant` param (not `restaurant_id` — unknown
    // filter names are silently ignored and return the full feed).
    const res = await fetch(
      `${DISCOVERY_URL}/check_ins?restaurant=${restaurantId}&page_size=1`,
      {
        headers: { "X-API-Key": apiKey, "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(2500),
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
          "[check-ins] Restaurant check-in counts are hidden: FLYNET_API_KEY " +
            "got 403 from /check_ins. The key needs the `read:checkins` scope, " +
            "which must be set when the key is minted (an app that merely lists " +
            "the scope is not enough). Mint a key with read:checkins to show them.",
        );
      }
      return null;
    }
    const data = (await res.json()) as {
      pagination?: { total_count?: number };
    };
    const count = data.pagination?.total_count;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}
