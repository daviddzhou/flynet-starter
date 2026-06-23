import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@flynetdev/core";
import { resolveAccessToken } from "../../../lib/session";
import { env } from "../../../lib/env";

// Issue a FLY reward to the signed-in member, server-side. Unlike a payment
// (which moves FLY *from* the member), a reward is credited *to* the member out
// of your app's own wallet — so every call here is authenticated with the
// Discovery API key (X-API-Key; JWTs are rejected). The key needs the
// `write:rewards`, `read:balance`, and `read:app` scopes.
//
// There's no SDK method for these endpoints yet, so we call the REST API
// directly per the repo's "when the SDK is in your way, hit the API" rule.
//
// 1 FLY in 18-decimal WEI. Sent as a STRING — that's how the stable API contract
// and the /balance response both represent FLY wei (a number tripped the
// endpoint with a 500). BigInt form is kept for the balance comparison in GET.
const REWARD_FLY_WEI = "1000000000000000000";
const REWARD_FLY_WEI_BIG = 1000000000000000000n;

type AppInfo = { flynet_merchant_id?: string };
type Balance = {
  balance?: { value?: string };
  balance_usd?: { value?: number };
};

function apiHeaders(apiKey: string) {
  return { "X-API-Key": apiKey, "Content-Type": "application/json" };
}

// Pull a plain string out of a Blackbird error body. The envelope is
// `{ error: { type, code, message, param } }` for auth/validation errors but
// `{ message, error: "SomeException" }` for internal 500s — so `error` can be an
// object OR a string. Never return the raw object: it would crash the UI as an
// invalid React child.
function apiErrorMessage(data: unknown, status: number): string {
  const d = data as { error?: unknown; message?: unknown } | null;
  const e = d?.error;
  if (e && typeof e === "object") {
    const eo = e as { message?: unknown; code?: unknown };
    if (typeof eo.message === "string") return eo.message;
    if (typeof eo.code === "string") return eo.code;
  }
  if (typeof d?.message === "string") return d.message;
  if (typeof e === "string") return e;
  return `Reward failed (HTTP ${status}).`;
}

// GET: the app-wallet status the claim UI needs — current balance, whether it
// covers a 1 FLY reward, and the merchant id to hand out for a top-up.
export async function GET() {
  const apiKey = env.FLYNET_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FLYNET_API_KEY is not set." },
      { status: 500 },
    );
  }

  // Both are app-scoped (key-authenticated), so fetch them together. A failure
  // on either is non-fatal: we fall back to an optimistic claim and let the
  // issue_reward call be the real gate.
  const [appRes, balanceRes] = await Promise.all([
    fetch(`${env.API_BASE_URL}/app`, {
      headers: apiHeaders(apiKey),
      cache: "no-store",
    }).catch(() => null),
    fetch(`${env.API_BASE_URL}/balance`, {
      headers: apiHeaders(apiKey),
      cache: "no-store",
    }).catch(() => null),
  ]);

  const app: AppInfo | null = appRes?.ok ? await appRes.json().catch(() => null) : null;
  const balance: Balance | null = balanceRes?.ok
    ? await balanceRes.json().catch(() => null)
    : null;

  const balanceWei = balance?.balance?.value ?? null;
  // Compare in WEI with BigInt — these values overflow Number.MAX_SAFE_INTEGER.
  // If the balance couldn't be read, stay optimistic (true) and let POST gate.
  const canClaim =
    balanceWei != null ? BigInt(balanceWei) >= REWARD_FLY_WEI_BIG : true;

  return NextResponse.json({
    merchantId: app?.flynet_merchant_id ?? null,
    balanceWei,
    balanceUsdCents: balance?.balance_usd?.value ?? null,
    canClaim,
  });
}

// POST: issue the 1 FLY reward to whoever is signed in. The member token only
// identifies who to reward; the reward is funded by the app wallet behind the
// key. Instant and irreversible — there's no confirm step.
export async function POST() {
  const apiKey = env.FLYNET_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FLYNET_API_KEY is not set — can't issue rewards." },
      { status: 500 },
    );
  }

  const accessToken = await resolveAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Not signed in — no member to reward." },
      { status: 401 },
    );
  }
  const userId = getAuthenticatedUserId(accessToken);
  if (!userId) {
    return NextResponse.json(
      { error: "Couldn't read the member id from the access token." },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${env.API_BASE_URL}/issue_reward`, {
      method: "POST",
      headers: apiHeaders(apiKey),
      body: JSON.stringify({
        user_id: userId,
        amount: { value: REWARD_FLY_WEI, currency: "FLY" },
        description: "Flynet starter welcome reward",
        // Stable per member, so this is a genuine one-time claim: replaying the
        // key returns the reward already issued (HTTP 200) instead of sending a
        // second one. Safe to click twice. (max 218 chars; this is well under.)
        idempotency_key: `starter-welcome-${userId}`,
      }),
      // A reward mutates state; never serve it from a cache.
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the rewards API." },
      { status: 502 },
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A 5xx is the rewards service itself failing, not our request. As of this
    // writing issue_reward returns `500 UnexpectedException` (error_code
    // internal0000) on every well-formed call — a known server-side bug in the
    // newly-shipped endpoint. Don't masquerade it as our own 500: return 502
    // (bad upstream) with a clear message, and log the upstream detail.
    if (res.status >= 500) {
      console.error(
        "[reward] upstream issue_reward error:",
        res.status,
        data?.error_code,
        data?.message,
      );
      return NextResponse.json(
        {
          error:
            "Blackbird's reward service is erroring right now (upstream 500). " +
            "The request is valid — this is a server-side issue with issue_reward.",
          upstream: data?.error_code ?? null,
        },
        { status: 502 },
      );
    }
    const message = apiErrorMessage(data, res.status);
    // An empty app wallet surfaces as 400; flag it so the UI can show the
    // top-up hint (send the merchant id to get funded).
    return NextResponse.json(
      { error: message, insufficient: res.status === 400 },
      { status: res.status },
    );
  }

  // 201 = freshly issued, 200 = idempotent replay (already claimed).
  return NextResponse.json({
    id: data?.id,
    amount: data?.amount,
    alreadyClaimed: res.status === 200,
  });
}
