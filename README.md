# Flynet Starter

A minimal Next.js app built on the [Flynet SDK](https://www.npmjs.com/package/@flynetdev/core).
Clone it, add an API key, and you have real Blackbird restaurant data rendering
through the SDK. Use it as the starting point for your own integration.

## No laptop setup? Build in the cloud

Don't have Node.js installed — or don't want to deal with ngrok? You don't have
to. There are two cloud paths, and you can use both. Both run from **your own
fork** of this repo, so [fork it first](https://github.com/PROPAGANDAnow/flynet-starter/fork)
(or use your existing fork).

- **Build in a Codespace** to *iterate*. On your fork, click **Code ▸ Codespaces
  ▸ Create codespace on main**. It runs the app in your browser with Node
  preinstalled and gives every port a public HTTPS URL — so sign-in works with
  **no local install and no ngrok**. Open the running app, click **⚙ Dev Setup**
  (bottom-right), and the drawer walks you through your Blackbird credentials.
  One Codespaces-only step: flip port **3000** to **Public** in the Ports panel
  so the OAuth redirect can reach you (the drawer reminds you).

- **Deploy to Vercel** to *ship a durable demo link*. Import your fork at
  [vercel.com/new](https://vercel.com/new), then set `FLYNET_API_KEY`,
  `FLYNET_CLIENT_ID`, and `FLYNET_CLIENT_SECRET` in the project — you do **not**
  need to set `REDIRECT_URI`, the app derives it from your Vercel production URL.
  Whitelist `https://<your-app>.vercel.app/callback` (see below) and you're live.
  Pushes auto-deploy, so "deploy on every change" comes for free.

Both flows act on whatever fork you open them from, so they keep working for
anyone who forks this starter. If you do have Node locally, the classic
Quickstart below still works.

## Prerequisites

- Node 20 or newer
- npm
- A Flynet **Discovery API key** (request one through the Flynet developer portal)

## Quickstart

```bash
git clone <your-fork-url> flynet-starter
cd flynet-starter
npm install
cp .env.example .env.local      # then set FLYNET_API_KEY in .env.local
npm run dev
```

Open http://localhost:3000.

**You'll know it worked when** the page shows a list of real Blackbird
restaurants. Before you add a key, it shows a short setup notice instead of
crashing — that's expected.

## What's here

```
app/
  layout.tsx              imports the component theme (@flynetdev/react/styles.css)
  page.tsx                the whole flow: server-side Discovery + the member section
  member-panel.tsx        the member components (wallet, passport), client-side
  api/auth/login/         starts the OAuth authorization-code + PKCE flow (SDK FlynetOAuth)
  callback/               the registered redirect URI; exchanges the code, sets cookies
  api/auth/logout/        clears the session cookies
  flynet-proxy/           same-origin proxy for the browser-side member components
components/               Blackbird-branded building blocks (see below)
lib/auth.ts               shared OAuth config: scopes, cookie names, FlynetOAuth factory
middleware.ts             silent refresh: rotates the refresh token when the access token expires
.env.example              every variable explained
```

`page.tsx` reads your API key on the **server** and calls Discovery there, so the
key never reaches the browser. That is the one rule to keep: the Discovery API
key is server-only.

## Where your code goes

`app/page.tsx` has a marked spot:

```tsx
{/* 👉 Your code goes here. */}
```

Drop in another component, a new route, or your own logic. The full component
catalog and hooks (`WalletBadge`, `CheckInFeed`, `RestaurantCard`,
`NearbyLocations`, `useWallet`, …) are in
[`@flynetdev/react`](https://www.npmjs.com/package/@flynetdev/react).

## The component library

`components/` ships branded building blocks styled with the Blackbird design
tokens (wired into Tailwind via `tailwind.config.ts` + `app/globals.css` —
use the semantic classes like `bg-surface-low` and `text-muted`, never raw
hexes):

| Component | What it renders |
|---|---|
| `RestaurantCard` | A Discovery restaurant — photo with gradient protection, name, cuisine tags, price tier. Server-safe. |
| `UserCard` | The signed-in member — avatar (or monogram), name, email, account-status tag. |
| `Tag` | Pill label with `neutral` / `primary` / `success` / `failure` tones. |
| `BBPayButton` | Blackbird Pay — purple pill, optional USD amount. Wire `onPay` to your payment flow. |
| `LoginButton` | "Sign in with Blackbird" — bird mark on black, points at your OAuth start route. |
| `BirdMark` | The bird logo as an inline SVG (brand rule: black or white surfaces only, never purple). |

## The member section

The wallet and passport need a member token. There are two ways to get one:

1. **Sign in with Blackbird (default).** With `FLYNET_CLIENT_ID`, `FLYNET_CLIENT_SECRET`, and
   `REDIRECT_URI` set, the page shows a sign-in button. It runs the full OAuth
   authorization-code + PKCE flow server-side via the SDK's `FlynetOAuth`
   helper: tokens are stored in HttpOnly cookies, the access token auto-renews
   from the rotating refresh token (middleware), and `/api/auth/logout` signs
   out. `REDIRECT_URI` must exactly match a redirect URI registered for your
   OAuth app.

   > **Local dev needs a tunnel.** The Blackbird edge rejects `localhost` /
   > `127.0.0.1` redirect URIs before they reach the OAuth server, so the
   > sign-in flow can't complete on a bare localhost URL. First time with
   > ngrok, make a free account at
   > [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup) and run
   > `ngrok config add-authtoken <token>` once (it won't tunnel without it).
   > Then run `ngrok http 3000`, whitelist `https://<your-subdomain>.ngrok.app/callback`
   > for your OAuth app at
   > [make.flynet.org](https://make.flynet.org/) (sign in
   > with your Slack email), set it as `REDIRECT_URI`, and open the app through
   > the ngrok URL — the session
   > cookies are host-scoped, so the whole flow has to run on that host.
   >
   > In a **Codespace** you can skip ngrok entirely: the forwarded port already
   > has a public URL, so the Dev Setup drawer detects it and sets `REDIRECT_URI`
   > for you (just flip port 3000 to Public). On **Vercel**, `REDIRECT_URI` is
   > derived from the production URL automatically — you only whitelist it.
2. **Pin a token.** Set `ACCESS_TOKEN` in `.env.local` (scopes `read:profile` +
   `read:wallets`) and it takes precedence — no sign-in needed. Access tokens
   expire after 60 minutes, so this is for quick poking, not sessions.

The member components fetch from the browser, and the Blackbird edge only
accepts registered origins — so the starter routes those calls through a
same-origin proxy (`app/flynet-proxy/`).

## Switching environments

The starter targets **production** by default. To run against staging, set the
three optional env vars in `.env.local` — `API_BASE_URL`, `AUTH_BASE_URL`, and
`AUTH_AUDIENCE` (values in `.env.example`) — and swap in your staging credential
set. Production access is gated by partner approval; you receive a separate
`client_id`, `client_secret`, API key, registered redirect URI, and merchant id
at production sign-off. Staging and production credentials are not
interchangeable. Everything else (the proxy, the OAuth routes, the payment
route) picks the environment up from those vars.

## Next steps

- **OAuth / member sign-in** — `concepts/oauth` in the Flynet developer portal
  (mirrored in `docs/llms.txt`).
- **All the components and hooks** — [`@flynetdev/react`](https://www.npmjs.com/package/@flynetdev/react).
- **Field-level API reference** — the Flynet developer portal.
