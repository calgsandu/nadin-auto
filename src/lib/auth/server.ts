import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL ?? process.env.NEON_AUTH_URL;
const cookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ?? process.env.NEON_AUTH_SECRET_URL;

if (!baseUrl) {
  throw new Error("Missing NEON_AUTH_BASE_URL or NEON_AUTH_URL");
}

if (!cookieSecret) {
  throw new Error("Missing NEON_AUTH_COOKIE_SECRET or NEON_AUTH_SECRET_URL");
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    // "lax" so the session cookie is sent on the top-level cross-site
    // navigation back from OAuth providers (Google). The default "strict"
    // drops the cookie on that redirect, causing an infinite sign-in loop.
    sameSite: "lax",
  },
});
