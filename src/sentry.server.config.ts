import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";

const dsn = env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Error reporting only; performance tracing would spend quota silently.
    tracesSampleRate: 0,
    // Do not attach cookies / auth headers to error events.
    sendDefaultPii: false,
  });
}
