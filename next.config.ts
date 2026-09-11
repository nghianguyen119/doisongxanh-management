import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  images: {
    // Zalo CDN hosts for attachment thumbnails sent by employees.
    remotePatterns: [
      { protocol: "https", hostname: "**.zadn.vn" },
      { protocol: "https", hostname: "**.zaloapp.com" },
      { protocol: "https", hostname: "**.zdn.vn" },
    ],
  },
};

/**
 * Sentry build integration (source maps only). The build-time vars are read
 * from `process.env` because `next.config.ts` runs before the app, and on a
 * CI/Vercel build the runtime vars from `src/env.ts` may not exist yet.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  // Error reporting only (tracesSampleRate: 0), so navigation spans — and the
  // hook that feeds them — are not needed.
  suppressOnRouterTransitionStartWarning: true,
  sourcemaps: {
    // Without a token there is nothing to upload; skip it instead of warning.
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
