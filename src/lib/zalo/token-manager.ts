import { eq } from "drizzle-orm";
import { db } from "@/db";
import { zaloOaToken } from "@/db/schema";
import { env } from "@/env";

const OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token";
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const ROW_ID = "default";

/**
 * Returns a valid OA access token, refreshing (and persisting) it when it is
 * within REFRESH_SKEW_MS of expiry. The token pair lives in `zalo_oa_token`
 * so refreshes survive restarts; env vars only bootstrap the first row.
 */
export async function getAccessToken(): Promise<string> {
  let row = await db.query.zaloOaToken.findFirst({
    where: eq(zaloOaToken.id, ROW_ID),
  });

  if (!row) {
    if (!env.ZALO_OA_REFRESH_TOKEN) {
      console.error(
        "[zalo:token] not initialised: no zalo_oa_token row and ZALO_OA_REFRESH_TOKEN is unset",
      );
      throw new Error(
        "Zalo OA not initialised: set ZALO_OA_ACCESS_TOKEN and ZALO_OA_REFRESH_TOKEN, then restart.",
      );
    }
    console.log("[zalo:token] bootstrap: creating row from env refresh token");
    [row] = await db
      .insert(zaloOaToken)
      .values({
        id: ROW_ID,
        accessToken: env.ZALO_OA_ACCESS_TOKEN || "bootstrap",
        refreshToken: env.ZALO_OA_REFRESH_TOKEN,
        expiresAt: new Date(0), // force an immediate refresh
      })
      .returning();
  }

  if (row.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return row.accessToken;
  }

  console.log(
    `[zalo:token] refreshing (expires_at=${row.expiresAt.toISOString()})`,
  );
  return refresh(row.refreshToken);
}

async function refresh(refreshToken: string): Promise<string> {
  const started = Date.now();
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: env.ZALO_APP_SECRET,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      app_id: env.ZALO_APP_ID,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string;
    error?: number;
    error_description?: string;
  };

  const ms = Date.now() - started;

  if (!data.access_token) {
    console.error(
      `[zalo:token] refresh FAILED http=${res.status} in ${ms}ms: ` +
        `${data.error_description ?? JSON.stringify(data)}`,
    );
    throw new Error(
      `Zalo token refresh failed: ${data.error_description ?? JSON.stringify(data)}`,
    );
  }

  const expiresAt = new Date(
    Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000,
  );

  await db
    .update(zaloOaToken)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(zaloOaToken.id, ROW_ID));

  console.log(
    `[zalo:token] refreshed http=${res.status} in ${ms}ms ` +
      `expires_at=${expiresAt.toISOString()} rotated=${Boolean(data.refresh_token)}`,
  );

  return data.access_token;
}
