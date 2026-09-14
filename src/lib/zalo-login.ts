import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/env";

/**
 * Zalo Login (OAuth v4 + PKCE) for employees. Distinct from the OA transport
 * (src/lib/zalo/*) which talks to the company Official Account; this lets a
 * person sign in to the web with their personal Zalo account.
 *
 * Flow:
 *   1. GET /zalo-login/start  -> generate PKCE pair + state, redirect to the
 *      Zalo permission page (https://oauth.zaloapp.com/v4/permission).
 *   2. Zalo redirects to /zalo-login/callback?code=...&state=...
 *   3. callback exchanges the code (POST .../v4/access_token, `secret_key`
 *      header) then reads the profile (GET https://graph.zalo.me/v2.0/me).
 *
 * The profile `id` is the same personal Zalo id stored on `employee.zaloUserId`
 * by the OA linking flow, so it is the join key between the two products.
 */

const AUTHORIZE_URL = "https://oauth.zaloapp.com/v4/permission";
const TOKEN_URL = "https://oauth.zaloapp.com/v4/access_token";
const PROFILE_URL = "https://graph.zalo.me/v2.0/me";

/** One-time OAuth state cookies (cleared right after the callback). */
export const STATE_COOKIE = "zalo_login_state";
export const VERIFIER_COOKIE = "zalo_login_verifier";
/** Signed session cookie; its presence means "logged in with Zalo". */
export const SESSION_COOKIE = "zalo_login_session";

/** The OAuth state/verifier pair only needs to survive a single round-trip. */
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;
/** Match the Better Auth portal session: 30 days. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ZaloLoginToken = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type ZaloLoginProfile = {
  id: string;
  name?: string;
  avatar?: string;
};

export type ZaloLoginSession = {
  zaloUserId: string;
  name?: string;
  avatar?: string;
  exp: number;
};

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("app_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function exchangeCode(input: {
  appId: string;
  appSecret: string;
  code: string;
  codeVerifier: string;
}): Promise<ZaloLoginToken | null> {
  const body = new URLSearchParams({
    code: input.code,
    app_id: input.appId,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: input.appSecret,
      },
      body,
    });
  } catch (err) {
    console.error("[zalo-login] token exchange network error:", String(err));
    return null;
  }

  const rawText = await res.text();
  console.log(
    `[zalo-login] <- token exchange http=${res.status}`,
    JSON.stringify({
      headers: Object.fromEntries(res.headers.entries()),
      body: rawText,
    }),
  );

  let json: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: unknown;
  } | null = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    console.error("[zalo-login] token exchange: non-JSON body:", rawText);
    return null;
  }

  if (!json || !json.access_token) {
    console.error(
      `[zalo-login] token exchange failed http=${res.status}`,
      JSON.stringify(json),
    );
    return null;
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

export async function fetchProfile(
  accessToken: string,
): Promise<ZaloLoginProfile | null> {
  const url = new URL(PROFILE_URL);
  url.searchParams.set("fields", "id,name,picture");

  let res: Response;
  try {
    res = await fetch(url, { headers: { access_token: accessToken } });
  } catch (err) {
    console.error("[zalo-login] profile fetch network error:", String(err));
    return null;
  }

  const rawText = await res.text();
  console.log(
    `[zalo-login] <- profile http=${res.status}`,
    JSON.stringify({
      headers: Object.fromEntries(res.headers.entries()),
      body: rawText,
    }),
  );

  let json: {
    id?: string;
    name?: string;
    picture?: { data?: { url?: string } };
    error?: unknown;
  } | null = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    console.error("[zalo-login] profile: non-JSON body:", rawText);
    return null;
  }

  if (!json || !json.id) {
    console.error(
      `[zalo-login] profile fetch failed http=${res.status}`,
      JSON.stringify(json),
    );
    return null;
  }

  return { id: json.id, name: json.name, avatar: json.picture?.data?.url };
}

function sessionSecret(): string {
  return env.BETTER_AUTH_SECRET;
}

function hmac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function signLoginSession(session: ZaloLoginSession): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url",
  );
  const signature = hmac(body, sessionSecret()).toString("base64url");
  return `${body}.${signature}`;
}

/**
 * Verifies the signed session token, or returns null for anything malformed,
 * tampered with or expired. Never throws (the page renders a friendly message
 * on null). Mirrors src/lib/employee-link.ts.
 */
export function verifyLoginSession(
  token: string | undefined,
): ZaloLoginSession | null {
  const secret = sessionSecret();
  if (!secret || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = hmac(body, secret);
  const provided = Buffer.from(signature, "base64url");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { zaloUserId, name, avatar, exp } = parsed as Partial<ZaloLoginSession>;
  if (typeof zaloUserId !== "string" || zaloUserId.length === 0) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= Date.now()) {
    return null;
  }

  return {
    zaloUserId,
    name: typeof name === "string" ? name : undefined,
    avatar: typeof avatar === "string" ? avatar : undefined,
    exp,
  };
}
