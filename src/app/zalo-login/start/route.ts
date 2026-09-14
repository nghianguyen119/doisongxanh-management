import { NextResponse } from "next/server";
import { env, isZaloLoginConfigured } from "@/env";
import {
  buildAuthorizeUrl,
  generatePkce,
  generateState,
  OAUTH_COOKIE_MAX_AGE_SECONDS,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/zalo-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
};

function backToPage(error: string) {
  const url = new URL("/zalo-login", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * Kick off Zalo Login: create the PKCE pair + CSRF state, stash them in
 * one-time cookies, and hand the browser over to Zalo's permission page.
 */
export async function GET() {
  if (!isZaloLoginConfigured()) {
    return backToPage("not_configured");
  }

  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/zalo-login/callback`;

  const authorizeUrl = buildAuthorizeUrl({
    appId: env.ZALO_LOGIN_APP_ID,
    redirectUri,
    codeChallenge: challenge,
    state,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(VERIFIER_COOKIE, verifier, cookieOptions);
  res.cookies.set(STATE_COOKIE, state, cookieOptions);
  return res;
}
