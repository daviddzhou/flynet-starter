import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { FlynetDiscoveryClient, FlynetError } from "@flynetdev/core";
import type { Restaurant } from "@flynetdev/react";
import { BirdMark, LoginButton, LogoutButton } from "../components";
import { OpenDevSetupButton } from "../components/dev-drawer";
import { PassportQuest } from "../components/passport-quest";
import { ACCESS_COOKIE } from "../lib/auth";
import { getRestaurantCheckInCount } from "../lib/check-ins";
import { env } from "../lib/env";
import { listRestaurantLocations } from "../lib/locations";
import { buildPassportQuest, prioritizeRestaurantsForTaste } from "../lib/quest";
import { MemberPanel } from "./member-panel";

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
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-6 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-background-darker text-foreground">
            <BirdMark size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Passport Quest
            </p>
            <p className="text-sm text-muted">
              Consumer discovery powered by Flynet
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-surface-low px-3 py-1.5 text-xs font-medium text-muted">
            Configurable quest window
          </span>
          {accessToken ? (
            signedInViaOAuth ? (
              <LogoutButton href="/api/auth/logout" />
            ) : (
              <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                Access token active
              </span>
            )
          ) : (
            <LoginButton href="/api/auth/login" />
          )}
        </div>
      </header>

      {await renderPassportQuest(apiKey, Boolean(accessToken))}

      {authError ? <AuthErrorNotice error={authError} /> : null}

      <section className="grid gap-5">
        {accessToken ? (
          <MemberPanel accessToken={accessToken} />
        ) : (
          <SignInNotice />
        )}
      </section>
    </main>
  );
}

async function renderPassportQuest(
  apiKey: string | undefined,
  signedIn: boolean,
): Promise<ReactNode> {
  if (!apiKey) return <SetupNotice />;
  try {
    const discovery = new FlynetDiscoveryClient({
      apiKey,
      serverURL: env.API_BASE_URL,
    });
    const listed = await discovery.restaurants.listRestaurants({
      pageSize: 100,
    });
    const restaurants = prioritizeRestaurantsForTaste(
      (listed.restaurants as Restaurant[]).filter((restaurant) => restaurant.name),
    ).slice(0, 75);

    const [locations, checkInCounts] = await Promise.all([
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
    ]);

    const quest = buildPassportQuest(
      restaurants.map((restaurant, index) => ({
        restaurant,
        locations: locations[index],
        checkInCount: checkInCounts[index],
      })),
    );

    if (quest.stops.length < 5) {
      return (
        <Notice title="Quest needs more restaurant data" tone="error">
          Discovery returned {quest.stops.length} presentable restaurants. Add a
          valid <Code>FLYNET_API_KEY</Code> in Dev Setup and refresh.
        </Notice>
      );
    }

    return <PassportQuest quest={quest} signedIn={signedIn} />;
  } catch (error) {
    const message =
      error instanceof FlynetError
        ? `${error.kind}: ${error.message}`
        : "Unexpected error.";
    return (
      <Notice tone="error" title="Could not load Passport Quest">
        {message} Check that <Code>FLYNET_API_KEY</Code> in Dev Setup is a
        valid Flynet key.
      </Notice>
    );
  }
}

function SetupNotice() {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div className="rounded-[2rem] border border-primary/30 bg-primary/10 p-8 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-primary-bright">
        Setup needed
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Add your Flynet credentials
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Passport Quest needs the Discovery API key to generate a real route. The
        Dev Setup drawer verifies credentials and keeps secret values out of the
        UI.
      </p>
      {isDev ? (
        <OpenDevSetupButton className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg transition duration-150 hover:opacity-90 active:bg-primary-dim">
          Open Dev Setup
        </OpenDevSetupButton>
      ) : null}
    </div>
  );
}

function SignInNotice() {
  return (
    <Notice title="OAuth personalization layer">
      <span className="block">
        The demo works with a local guest profile when you skip sign-in. Connect
        Blackbird to show member context from <Code>/users/me</Code> and make the
        personalization story stronger.
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
        <Code>REDIRECT_URI</Code> is not set, so sign-in cannot use the current
        tunnel callback. Open <strong>Dev Setup</strong> and set it to your
        public URL plus <Code>/callback</Code>, then try again.
      </Notice>
    );
  }
  return (
    <Notice tone="error" title="Sign-in did not complete">
      The OAuth flow failed (<Code>{error}</Code>). Check{" "}
      <Code>FLYNET_CLIENT_ID</Code>, <Code>FLYNET_CLIENT_SECRET</Code>, and{" "}
      <Code>REDIRECT_URI</Code> in Dev Setup, then try again.
    </Notice>
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
      className={`rounded-3xl border p-5 text-sm leading-relaxed ${
        tone === "error"
          ? "border-failure/40 bg-failure/5 text-failure"
          : "border-white/10 bg-surface-low text-muted"
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
