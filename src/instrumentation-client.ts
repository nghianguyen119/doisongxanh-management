import * as Sentry from "@sentry/nextjs";

/**
 * Client-side Sentry init. This file runs before hydration.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is read straight from `process.env` (the supported
 * pattern for inlining public vars) instead of `src/env.ts`, because that
 * module also carries server-only vars and must not enter the browser bundle.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Error reporting only; performance tracing would spend quota silently.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
