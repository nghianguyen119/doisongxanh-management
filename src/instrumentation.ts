import * as Sentry from "@sentry/nextjs";

/**
 * Next calls `register` once per server instance, before requests are served.
 * Init Sentry for the runtime we are actually in.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Server errors that Next catches (Server Components, route handlers, server
 * actions) are forwarded here; Sentry adds the request/route context.
 */
export const onRequestError = Sentry.captureRequestError;
