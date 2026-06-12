import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "./auth";
import { env } from "./env";

// The one place that decides which member token a server-side caller uses —
// same precedence as the homepage: a pinned ACCESS_TOKEN env var wins,
// otherwise the OAuth session cookie set by the sign-in flow.
//
// Kept separate from lib/auth.ts because next/headers can't be bundled into
// middleware, which imports that file.
export async function resolveAccessToken(): Promise<string | undefined> {
  if (env.ACCESS_TOKEN) return env.ACCESS_TOKEN;
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}
