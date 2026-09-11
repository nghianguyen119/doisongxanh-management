import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";

const dsn = env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
