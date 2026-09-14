import { NextResponse, type NextRequest } from "next/server";
import { env, isZaloLoginConfigured } from "@/env";
import {
  exchangeCode,
  fetchProfile,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signLoginSession,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/zalo-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backToPage(error: string) {
  const url = new URL("/zalo-login", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function clearOauthCookies(res: NextResponse): NextResponse {
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(VERIFIER_COOKIE);
  return res;
}

/**
 * Zalo redirects here after the user grants/denies permission. Verifies the
 * CSRF `state`, swaps the code for an access token, reads the profile, and
 * stores a signed session cookie. Any failure lands back on the test page
 * with a machine-readable `?error=` for the message shown there.
 */
export async function GET(req: NextRequest) {
  if (!isZaloLoginConfigured()) {
    return backToPage("not_configured");
  }

  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    // Zalo sends error=access_denied (and friends) when the user cancels.
    return clearOauthCookies(backToPage("cancelled"));
  }

  const code = params.get("code");
  const state = params.get("state");
  const storedState = req.cookies.get(STATE_COOKIE)?.value;
  const verifier = req.cookies.get(VERIFIER_COOKIE)?.value;

  if (!code || !state || !storedState || !verifier) {
    return clearOauthCookies(backToPage("invalid"));
  }
  if (state !== storedState) {
    return clearOauthCookies(backToPage("state_mismatch"));
  }

  const token = await exchangeCode({
    appId: env.ZALO_LOGIN_APP_ID,
    appSecret: env.ZALO_LOGIN_APP_SECRET,
    code,
    codeVerifier: verifier,
  });
  if (!token) {
    return clearOauthCookies(backToPage("token_exchange_failed"));
  }

  const profile = await fetchProfile(token.accessToken);
  if (!profile) {
    return clearOauthCookies(backToPage("profile_failed"));
  }

  const res = clearOauthCookies(
    NextResponse.redirect(new URL("/zalo-login", env.NEXT_PUBLIC_APP_URL)),
  );
  res.cookies.set(
    SESSION_COOKIE,
    signLoginSession({
      zaloUserId: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      exp: Date.now() + SESSION_TTL_MS,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    },
  );
  return res;
}
