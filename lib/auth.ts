import { FlynetOAuth } from "@flynetdev/core";
import { env } from "./env";

// Server-only OAuth wiring (Token-Mediating Backend, per the Flynet docs):
// the backend holds FLYNET_CLIENT_SECRET and the refresh token; the browser only ever
// sees the short-lived access token. Never import this from a Client Component.

/** Short-lived member access token (60 min, mirrors the token's expires_in). */
export const ACCESS_COOKIE = "fn_access";
/** Rotating refresh token (up to 30 days, single-use — rotated on every refresh). */
export const REFRESH_COOKIE = "fn_refresh";
/** PKCE state + verifier parked between the authorize redirect and the callback. */
export const HANDSHAKE_COOKIE = "fn_oauth_pending";

export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

// Everything the member routes + components need, including the pay button
// (payment intents are scope-gated). Scope names are exact-match
// ("read:profiles" is rejected) and routes outside these return 403.
export const SCOPES = [
  "read:profile",
  "read:wallets",
  "read:checkins",
  "read:payment_intent",
  "write:payment_intent",
];

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
} as const;

/**
 * Where browser-facing auth redirects land. Behind a tunnel (ngrok) the
 * request URL the server sees carries the local host, not the public one — so
 * derive the public origin from REDIRECT_URI (the OAuth session's cookies live
 * on that host by definition) and fall back to the request URL without it.
 */
export function appUrl(path: string, requestUrl: string | URL): URL {
  return new URL(path, env.REDIRECT_URI || requestUrl);
}

type ForwardableRequest = { headers: Headers; nextUrl: URL };

/**
 * The origin the browser is actually viewing, reconstructed from forwarded
 * proxy headers (falling back to the request host). Unlike {@link appUrl} this
 * does NOT depend on REDIRECT_URI, so it can carry a setup-error redirect back
 * to the right host even when REDIRECT_URI is the thing that's missing.
 */
export function publicOrigin(req: ForwardableRequest): URL {
  const host =
    (req.headers.get("x-forwarded-host") || req.nextUrl.host)
      .split(",")[0]
      .trim();
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(":", "");
  return new URL(`${proto}://${host}`);
}

/**
 * True when REDIRECT_URI is unset. Without it the SDK falls back to a
 * localhost:3000/callback redirect_uri that Blackbird won't have whitelisted,
 * so sign-in would bounce to a dead callback. Callers block the flow and
 * surface a setup error instead of starting a doomed round-trip — note the dev
 * browser is on localhost even when a tunnel is up, so host alone can't tell us.
 */
export function redirectUriMissing(): boolean {
  return !env.REDIRECT_URI;
}

/** Build the SDK's OAuth helper from env, or null when the app isn't configured. */
export function makeOAuth(): FlynetOAuth | null {
  const clientId = env.FLYNET_CLIENT_ID;
  const clientSecret = env.FLYNET_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new FlynetOAuth({
    clientId,
    clientSecret,
    redirectUri: env.REDIRECT_URI ?? "http://localhost:3000/callback",
    scopes: SCOPES,
    // Defaults to production (env defaults AUTH_BASE_URL to it). Set
    // AUTH_BASE_URL to override (e.g. the SDK's staging default) — there's no
    // named "production" environment in the SDK yet, so production is spelled
    // out explicitly here.
    authBaseUrl: env.AUTH_BASE_URL,
    // The audience the token is minted for — the production API gateway. The
    // staging form hyphenates this (api-staging) as the auth tenant in claims.
    audience: env.AUTH_AUDIENCE,
  });
}
