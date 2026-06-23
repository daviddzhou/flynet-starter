# Working in this repo (agent instructions)

This is the Flynet starter — a Next.js app on the Flynet SDK. Read the README
for the full layout; this file covers the rules that are specific to agents.

## Secrets: never touch the env files

**Do not read, write, edit, create, copy, or print `.env.local` (or any
`.env*` file holding real values).** Treat them as sensitive — they hold the
human's Blackbird credentials (API key, OAuth client id/secret, redirect URI,
merchant id) and must never enter the conversation, a commit, or a tool result.

- Don't `cat`/`Read`/`grep` `.env.local`, and don't write credentials into it.
- The app reads credentials from `process.env` at runtime — you never need their
  values to build features. If a credential is missing, the app shows a setup
  notice instead of crashing; that's expected, not a bug to fix by editing env.
- The **dev setup drawer** is the only thing that writes `.env.local`, through
  its own dev-only API route. The human drives it; you do not.
- `.env.example` (placeholders only, no real values) is fine to read and edit.

## First-time setup flow

When you've been asked to set this repo up, do the install, get the app running
locally, then hand env configuration to the human:

1. `npm install`
2. `npm run dev` — start the app on http://localhost:3000 and confirm it boots.
3. **Stop and ask the human to set the environment variables themselves**, via
   the **Dev Setup drawer** (the "⚙ Dev Setup" button, bottom-right of the
   running app). It lets them paste and verify the Blackbird credentials —
   Discovery API key, OAuth client id/secret, and redirect URI — and writes
   `.env.local` for them. Point them at it; do not offer to fill it in yourself.

Tell them, in words like:

> Setup's done and the app is running at http://localhost:3000. Open it, click
> **⚙ Dev Setup** (bottom-right), and paste your Blackbird credentials there —
> the drawer verifies them and writes `.env.local`. I won't touch that file.

Before the env is set, the app renders a setup notice rather than real data —
that is the expected pre-configuration state, so don't try to "fix" it by
writing env values.

## Building the user's app: prune the starter components

The starter ships a full demo on `page.tsx` — the restaurant list, the member
panel (profile, wallet, claim-reward, pay), and the special/challenge pills — to
show the SDK working end to end. It's scaffolding to build _from_, not a layout
to preserve. When you start building the user's actual app, treat these as
removable: **delete or replace any starter component that doesn't fit the user's
flow** rather than leaving it stacked around their feature.

- Keep only what their flow actually reuses (a component, hook, or route); remove
  the rest — don't leave orphaned demo sections, unrelated cards, or the
  `👉 Your code goes here` marker sitting above/below the real app.
- When you remove a component, remove its now-dead data fetch too — its `lib/*`
  fetcher, its slot in the `page.tsx` `Promise.all` fan-out, and its props — so
  you don't keep paying for data nothing renders (see "Keep API usage lean").
- If it's not obvious from the user's flow which starter pieces should stay, ask
  before deleting wholesale rather than guessing.

## When the SDK breaks, call the API directly

This app is built on the Flynet SDK (`@flynetdev/core` / `@flynetdev/react`). If
the SDK is in your way — a missing method, a type that lags the API (e.g.
`flynetMerchantId` is still typed required), a bug, or a version mismatch —
don't get stuck on it. Fall back to calling the Blackbird REST API directly with
the member access token (`Authorization: Bearer <token>` for member calls,
`X-API-Key` for Discovery).

The full API reference, in an LLM-friendly form, is at
<https://flynet-dev-portal.mintlify.app/llms.txt>. Fetch it to find the right
endpoint, request shape, and scopes, then make the call with `fetch` against the
configured base URL (`API_BASE_URL` / `AUTH_BASE_URL`, defaulting to production).

## Keep API usage lean

Blackbird's APIs are rate-limited and metered, and this page fans out — one list
call plus a locations and a check-in lookup per restaurant on every render. Don't
refetch data that barely changed; reach for the cheapest layer that still looks
live.

- **Server `fetch`: cache with `next: { revalidate }`.** The raw Discovery
  fetches in `lib/locations.ts` and `lib/check-ins.ts` set a `revalidate` window
  so Next.js serves them from its Data Cache across requests and users instead of
  hitting the API on every page load. Use a long window for data that rarely
  moves (locations: 1h), a short one for data that drifts (check-in counts: 5m).
  New server-side `fetch` calls should pass a `revalidate` too.
- **SDK calls that ignore fetch options: wrap in `unstable_cache`.** The
  Discovery SDK client doesn't forward Next's `fetch` cache options, so the
  restaurant list in `page.tsx` is wrapped in `unstable_cache(..., { revalidate })`
  to land in the Data Cache anyway. Do the same for any SDK call you can't pass
  `next: { revalidate }` to directly.
- **Client queries: set `staleTime`, skip focus refetches.** `member-panel.tsx`
  hands `FlynetProvider` a `QueryClient` with `staleTime` and
  `refetchOnWindowFocus: false`, so React Query reuses cached profile/wallet data
  instead of refetching on every mount or tab focus. Tune via the provider's
  `queryClient`, not per-call.
- **Refetch on the event, not a timer.** After a mutation (e.g. the payment),
  invalidate just the affected query key — as `PaySection` does with
  `walletsQueryKey`. Don't add `setInterval`/polling to keep data fresh.
- **Fetch once per resource per render.** Keep the `Promise.all` fan-out in
  `page.tsx`; don't re-request the same data inside child components.

## Redirect URI whitelisting

The redirect URI (ngrok URL or deployed domain + `/callback`) must be
whitelisted for the OAuth app. The human does this at
<https://make.flynet.org/> (sign in with their Slack email). Direct
them there; it isn't something you can do for them.
