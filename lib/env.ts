import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// The single, validated source of truth for environment variables — mirrors
// .env.example. Import `env` instead of reaching into `process.env` directly:
// values are parsed and type-checked once at startup, prod-default URLs live in
// one place, and a typo'd or malformed value fails fast with a named error
// rather than surfacing as a confusing API failure later.
//
// Everything here is SERVER-ONLY (there are no NEXT_PUBLIC_* vars — nothing in
// this app is sent to the browser). t3env guards that boundary: reading any
// `server` value from a Client Component throws.
export const env = createEnv({
  server: {
    // ── Flynet credentials ─────────────────────────────────────────────────
    // All optional on purpose: the app boots without them (rendering setup
    // notices), and the dev onboarding drawer writes them into .env.local at
    // runtime. `emptyStringAsUndefined` below turns the `KEY=""` placeholders
    // from .env.example into "unset", so .optional() / .default() behave.

    // Flynet Discovery API key, sent as X-API-Key. Server-side only.
    FLYNET_API_KEY: z.string().min(1).optional(),
    // OAuth client credentials powering "Sign in with Blackbird".
    FLYNET_CLIENT_ID: z.string().min(1).optional(),
    FLYNET_CLIENT_SECRET: z.string().min(1).optional(),
    // Merchant id for Blackbird Pay. Optional: when unset the app pays itself
    // off the member JWT (see app/api/pay/route.ts).
    FLYNET_MERCHANT_ID: z.string().min(1).optional(),
    // Optional pinned member access token (JWT) — set to skip the sign-in flow.
    ACCESS_TOKEN: z.string().min(1).optional(),

    // Browser-facing redirect target for the OAuth flow. Must be a full URL and
    // exactly match a redirect URI registered for the OAuth app. Optional —
    // lib/auth.ts blocks sign-in (and falls back to localhost) when it's unset.
    REDIRECT_URI: z.url().optional(),

    // ── Environment routing ────────────────────────────────────────────────
    // Unset = production. These defaults centralize what used to be repeated as
    // `process.env.X || "<prod-url>"` across page.tsx, lib/auth.ts,
    // lib/locations.ts, the pay route and the proxy. Point them at staging
    // (https://api.staging.blackbird.xyz/...) to switch environments.
    API_BASE_URL: z.url().default("https://api.blackbird.xyz/flynet/v1"),
    AUTH_BASE_URL: z.url().default("https://api.blackbird.xyz/oauth"),
    AUTH_AUDIENCE: z.url().default("https://api.blackbird.xyz/flynet"),
  },

  // Available on both server and client. NODE_ENV is the only shared var; it's
  // never sent over the wire but is read in a few server modules through here
  // so there's one typed accessor for it.
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  // No NEXT_PUBLIC_* variables — keep it that way; the API key and secrets must
  // never reach the browser.
  client: {},

  // Explicit mapping of each schema key to its process.env source. Spelling out
  // every `process.env.X` (rather than using experimental__runtimeEnv) keeps
  // the wiring obvious AND lets Next statically inline these for the Edge
  // middleware, where only referenced env vars are available at runtime.
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    FLYNET_API_KEY: process.env.FLYNET_API_KEY,
    FLYNET_CLIENT_ID: process.env.FLYNET_CLIENT_ID,
    FLYNET_CLIENT_SECRET: process.env.FLYNET_CLIENT_SECRET,
    FLYNET_MERCHANT_ID: process.env.FLYNET_MERCHANT_ID,
    ACCESS_TOKEN: process.env.ACCESS_TOKEN,
    REDIRECT_URI: process.env.REDIRECT_URI,
    API_BASE_URL: process.env.API_BASE_URL,
    AUTH_BASE_URL: process.env.AUTH_BASE_URL,
    AUTH_AUDIENCE: process.env.AUTH_AUDIENCE,
  },

  // .env.example ships every credential as `KEY=""`. Treat empty strings as
  // unset so an empty key is a missing key (lets .optional()/.default() apply).
  emptyStringAsUndefined: true,

  // Escape hatch for tooling/CI that builds without a configured env. Every var
  // here is optional or defaulted, so validation won't fail the build on its
  // own — this just lets you force-skip it (e.g. SKIP_ENV_VALIDATION=1).
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
