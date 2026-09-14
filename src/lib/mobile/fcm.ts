import { createSign } from "node:crypto";
import { env } from "@/env";

/**
 * Minimal FCM HTTP v1 sender (data-only, high priority) without pulling in
 * `firebase-admin`. Auth is a service-account JWT exchanged for an OAuth2
 * access token, cached until shortly before it expires.
 *
 * The whole module degrades to a no-op when `FIREBASE_*` env vars are unset,
 * so the app still works through the inbox (`GET /api/mobile/notifications`)
 * while push credentials are not configured.
 */

type FcmResult = { ok: true } | { ok: false; error: string };

export type FcmData = Record<string, string>;

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

export function isFcmConfigured(): boolean {
  return Boolean(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY,
  );
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function serviceAccountPrivateKey(): string {
  // Env vars cannot carry real newlines; the PEM is stored with `\n` escapes.
  return env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
}

async function getAccessToken(): Promise<string> {
  if (
    cachedAccessToken &&
    cachedAccessToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedAccessToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer
    .sign(serviceAccountPrivateKey())
    .toString("base64url");
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `FCM OAuth ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedAccessToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

/**
 * Send one data-only message. All values become strings because FCM rejects
 * non-string data. The app renders it through `src/lib/push.ts`.
 */
export async function sendFcmDataMessage(
  deviceToken: string,
  data: FcmData,
  options: { ttlSeconds?: number } = {},
): Promise<FcmResult> {
  if (!isFcmConfigured()) {
    return { ok: false, error: "fcm_not_configured" };
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            data,
            android: {
              priority: "high",
              ttl: `${options.ttlSeconds ?? 3600}s`,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `fcm_${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
