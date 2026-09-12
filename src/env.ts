import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { parseManagerEmails } from "@/lib/manager-emails";

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

    /**
     * Build-time only: uploads source maps during `pnpm build`. Leave unset
     * and Sentry still reports errors, just with minified stack traces.
     */
    SENTRY_AUTH_TOKEN: z.string().optional().default(""),
    SENTRY_ORG: z.string().optional().default(""),
    SENTRY_PROJECT: z.string().optional().default(""),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    /** Empty disables Sentry everywhere; the DSN is not a secret. */
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional().default(""),
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
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  emptyStringAsUndefined: false,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.NODE_ENV === "test",
});

/** Manager emails allowed into the portal, normalised to lowercase. */
export const allowedManagerEmails = parseManagerEmails(
  env.ALLOWED_MANAGER_EMAILS ?? "",
);

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
 * The real-send tester on /settings/zalo makes live OA API calls with the
 * token stored in `zalo_oa_token`, so it is local/non-production only.
 */
export function isRealSendTesterEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * AUTH_BYPASS lets the portal be browsed without a session in dev. Requires
 * a non-production build so the flag can never unlock production.
 */
export function isDevAuthBypassed(): boolean {
  return env.AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production";
}
