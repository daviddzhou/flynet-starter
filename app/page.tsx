import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { FlynetDiscoveryClient, FlynetError } from "@flynetdev/core";
import type { Restaurant } from "@flynetdev/react";
import { LoginButton, LogoutButton, RestaurantCard } from "../components";
import { OpenDevSetupButton } from "../components/dev-drawer";
import { ACCESS_COOKIE } from "../lib/auth";
import { listRestaurantLocations } from "../lib/locations";
import { getRestaurantCheckInCount } from "../lib/check-ins";
import { listRestaurantSpecials } from "../lib/specials";
import { listRestaurantChallenges } from "../lib/challenges";
import { env } from "../lib/env";
import { MemberPanel } from "./member-panel";

// The whole starter in one screen:
//   1. Read restaurants from Flynet Discovery (server-side, with your API key).
//   2. The member section: an ACCESS_TOKEN env var wins if set; otherwise the
//      OAuth session cookie (set by the sign-in flow); otherwise a sign-in button.
//
// Discovery runs HERE, on the server. The API key is read from the environment
// and never reaches the browser — that is the one security rule that matters.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const apiKey = env.FLYNET_API_KEY;
  const { auth_error: authError } = await searchParams;
  const cookieToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  const accessToken = env.ACCESS_TOKEN || cookieToken;
  const signedInViaOAuth = !env.ACCESS_TOKEN && Boolean(cookieToken);

  return (
    <main className="mx-auto max-w-2xl space-y-10 p-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          Flynet Starter
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Build on Blackbird
        </h1>
        <p className="mt-2 text-muted">
          Real restaurant data from the Flynet API, rendered with the SDK.
        </p>
      </header>

      {await renderRestaurants(apiKey)}

      {authError ? <AuthErrorNotice error={authError} /> : null}

      {accessToken ? (
        <>
          <MemberPanel accessToken={accessToken} />
          {signedInViaOAuth ? <LogoutButton href="/api/auth/logout" /> : null}
        </>
      ) : (
        <SignInNotice />
      )}

      {/* 👉 Your code goes here.
          The branded building blocks live in ./components — RestaurantCard,
          UserCard, Tag, BBPayButton, LoginButton. The SDK's own catalog and
          hooks live in @flynetdev/react. */}
    </main>
  );
}

// The SDK client doesn't forward Next's `fetch` cache options, so wrap the whole
// call in unstable_cache: the trimmed list lands in Next's Data Cache and is
// reused across requests and users, revalidating hourly instead of re-hitting
// Discovery on every render. Restaurant data barely moves, so an hour is safe.
const loadRestaurants = unstable_cache(
  async (apiKey: string, serverURL: string | undefined) => {
    // API_BASE_URL switches environments; unset means production.
    const discovery = new FlynetDiscoveryClient({ apiKey, serverURL });
    // The list includes unpublished records with blank names (production has
    // many, and blank names sort first) — over-fetch and keep the first 8
    // that are actually presentable.
    const listed = await discovery.restaurants.listRestaurants({
      pageSize: 50,
    });
    return listed.restaurants
      .filter((restaurant) => restaurant.name)
      .slice(0, 8);
  },
  ["discovery-restaurants"],
  { revalidate: 3600 },
);

async function renderRestaurants(apiKey: string | undefined): Promise<ReactNode> {
  if (!apiKey) return <SetupNotice />;
  try {
    const restaurants = await loadRestaurants(apiKey, env.API_BASE_URL);
    // Locations, check-in counts, specials, and challenges are separate
    // Discovery resources — fetch them in parallel, one call per listed
    // restaurant (raw fetch; see lib/locations.ts, lib/check-ins.ts,
    // lib/specials.ts, lib/challenges.ts). A failed lookup just drops that bit
    // of the card (the location line, the check-in stat, the offers, or the
    // challenges row).
    const [locations, checkInCounts, specials, challenges] = await Promise.all([
      Promise.all(
        restaurants.map((restaurant) =>
          listRestaurantLocations(apiKey, restaurant.id).catch(() => []),
        ),
      ),
      Promise.all(
        restaurants.map((restaurant) =>
          getRestaurantCheckInCount(apiKey, restaurant.id).catch(() => null),
        ),
      ),
      Promise.all(
        restaurants.map((restaurant) =>
          listRestaurantSpecials(apiKey, restaurant.id).catch(() => []),
        ),
      ),
      Promise.all(
        restaurants.map((restaurant) =>
          listRestaurantChallenges(apiKey, restaurant.id).catch(() => []),
        ),
      ),
    ]);
    return (
      <Section title="Restaurants">
        <div className="grid gap-4 sm:grid-cols-2">
          {(restaurants as Restaurant[]).map((restaurant, i) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              locations={locations[i]}
              checkInCount={checkInCounts[i]}
              specials={specials[i]}
              challenges={challenges[i]}
            />
          ))}
        </div>
      </Section>
    );
  } catch (error) {
    const message =
      error instanceof FlynetError
        ? `${error.kind}: ${error.message}`
        : "Unexpected error.";
    return (
      <Notice tone="error" title="Couldn't load restaurants">
        {message} Check that <Code>FLYNET_API_KEY</Code> in <Code>.env.local</Code> is a
        valid Flynet key.
      </Notice>
    );
  }
}

function SetupNotice() {
  // The Dev Setup drawer only exists in dev builds (see layout.tsx). In dev,
  // make the big call to action "open the drawer"; in production there's no
  // drawer, so fall back to pointing at the hosting env vars.
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">
        Get started
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        Add your Blackbird credentials
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {isDev
          ? "This app needs your Discovery API key and OAuth credentials to load real restaurant and member data. The Dev Setup drawer walks you through each one and verifies it before saving."
          : "Set FLYNET_API_KEY and your OAuth credentials in your hosting environment variables, then redeploy to see real Blackbird data."}
      </p>
      {isDev ? (
        <OpenDevSetupButton className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg transition duration-150 hover:opacity-90 active:bg-primary-dim">
          <span className="text-base leading-none">⚙</span>
          Open Dev Setup
        </OpenDevSetupButton>
      ) : null}
    </div>
  );
}

function SignInNotice() {
  return (
    <Notice title="Your Blackbird account">
      <span className="block">
        Sign in with Blackbird to see your wallet and passport. The OAuth flow
        runs server-side with your <Code>FLYNET_CLIENT_ID</Code> /{" "}
        <Code>FLYNET_CLIENT_SECRET</Code> and keeps the tokens in HttpOnly cookies.
        Setting <Code>ACCESS_TOKEN</Code> in <Code>.env.local</Code> skips the
        flow entirely.
      </span>
      <span className="mt-4 block">
        <LoginButton href="/api/auth/login" />
      </span>
    </Notice>
  );
}

function AuthErrorNotice({ error }: { error: string }) {
  if (error === "redirect_uri_unset") {
    return (
      <Notice tone="error" title="Set your redirect URI first">
        <Code>REDIRECT_URI</Code> isn&apos;t set, so sign-in would fall back to a{" "}
        <Code>localhost</Code> callback that Blackbird hasn&apos;t whitelisted.
        Open <strong>⚙ Dev Setup</strong> and set <Code>REDIRECT_URI</Code> to
        your tunnel (or deployed) URL + <Code>/callback</Code>, then try again.
      </Notice>
    );
  }
  if (error === "handshake_cookie_missing") {
    return (
      <Notice tone="error" title="Open the app on the same host it redirects back to">
        Sign-in came back without its handshake cookie. That cookie is
        host-scoped, so this means the flow <em>started</em> on a different host
        than the callback landed on — almost always opening the app on{" "}
        <Code>localhost:3000</Code> while <Code>REDIRECT_URI</Code> points at
        your tunnel. Open the app at your tunnel (or deployed) URL and start
        sign-in <strong>there</strong>, so the whole round-trip runs on one host.
      </Notice>
    );
  }
  if (error.startsWith("provider_")) {
    const reason = error.replace("provider_", "");
    return (
      <Notice tone="error" title="Blackbird rejected the sign-in">
        The OAuth provider returned <Code>{reason}</Code>.{" "}
        {reason === "access_denied"
          ? "That's the consent screen being dismissed — try again and approve it."
          : "Check your OAuth app's client id and that this redirect URI is whitelisted."}
      </Notice>
    );
  }
  return (
    <Notice tone="error" title="Sign-in didn't complete">
      The OAuth flow failed (<Code>{error}</Code>). Check <Code>FLYNET_CLIENT_ID</Code>,{" "}
      <Code>FLYNET_CLIENT_SECRET</Code>, and <Code>REDIRECT_URI</Code> in{" "}
      <Code>.env.local</Code>, then try again.
    </Notice>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-[0.16em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Notice({
  title,
  tone = "info",
  children,
}: {
  title: string;
  tone?: "info" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 text-sm leading-relaxed ${
        tone === "error"
          ? "border-failure/40 text-failure"
          : "border-white/10 text-muted"
      }`}
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/10 px-1 py-0.5 text-foreground">
      {children}
    </code>
  );
}
