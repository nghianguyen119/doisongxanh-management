import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated environment variables. Import from here instead of reading
 * `process.env` directly so a missing/misspelled var fails fast at boot.
 */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),

    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.string().url(),

    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
    ALLOWED_MANAGER_EMAILS: z.string().optional().default(""),

    ZALO_TRANSPORT: z.enum(["mock", "live"]).default("mock"),
    ZALO_APP_ID: z.string().optional().default(""),
    ZALO_APP_SECRET: z.string().optional().default(""),
    ZALO_OA_SECRET: z.string().optional().default(""),
    ZALO_OA_ACCESS_TOKEN: z.string().optional().default(""),
    ZALO_OA_REFRESH_TOKEN: z.string().optional().default(""),

    /** Bearer token guarding /api/cron/reminders. Unset = endpoint disabled. */
    CRON_SECRET: z.string().optional().default(""),

    /**
     * "true" opens the manager portal without sign-in. Requires
     * NODE_ENV != "production" and a fake admin user is assumed. Never
     * enabled in production, even if the flag slips through.
     */
    AUTH_BYPASS: z.string().optional().default("false"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ALLOWED_MANAGER_EMAILS: process.env.ALLOWED_MANAGER_EMAILS,
    ZALO_TRANSPORT: process.env.ZALO_TRANSPORT,
    ZALO_APP_ID: process.env.ZALO_APP_ID,
    ZALO_APP_SECRET: process.env.ZALO_APP_SECRET,
    ZALO_OA_SECRET: process.env.ZALO_OA_SECRET,
    ZALO_OA_ACCESS_TOKEN: process.env.ZALO_OA_ACCESS_TOKEN,
    ZALO_OA_REFRESH_TOKEN: process.env.ZALO_OA_REFRESH_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    AUTH_BYPASS: process.env.AUTH_BYPASS,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: false,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.NODE_ENV === "test",
});

/** Manager emails allowed into the portal, normalised to lowercase. */
export const allowedManagerEmails = (env.ALLOWED_MANAGER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * An empty allowlist means "any Google account", which is only acceptable
 * while setting up locally. Keep the escape hatch out of production.
 */
export function isManagerEmailAllowed(email: string): boolean {
  if (allowedManagerEmails.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return allowedManagerEmails.includes(email.trim().toLowerCase());
}

/**
 * The Zalo simulator injects arbitrary employee actions with no auth, so it
 * requires both the mock transport and a non-production build.
 */
export function isSimulatorEnabled(): boolean {
  return env.ZALO_TRANSPORT === "mock" && process.env.NODE_ENV !== "production";
}

/**
 * AUTH_BYPASS lets the portal be browsed without a session in dev. Requires
 * a non-production build so the flag can never unlock production.
 */
export function isDevAuthBypassed(): boolean {
  return env.AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production";
}
