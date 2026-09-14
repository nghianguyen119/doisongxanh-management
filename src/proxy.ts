import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isDevAuthBypassed } from "@/env";

/**
 * Next.js 16 renamed `middleware` -> `proxy` (nodejs runtime, not edge).
 * This is only an optimistic gate based on cookie presence; real
 * authorization happens in server components via `requireUser()`.
 *
 * `/my` is the employee-facing read-only page; it authenticates with its own
 * signed token and must stay reachable without a manager session.
 * `/zalo-login` is the Zalo OAuth test page, reachable without a session too.
 */
const PUBLIC_PATHS = ["/login", "/my", "/zalo-login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (isDevAuthBypassed()) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Guard everything except Next internals, auth API, the mobile API (its own
  // bearer tokens), the Zalo webhook, dev/cron endpoints and static assets.
  matcher: [
    "/((?!api/auth|api/mobile|api/zalo|api/dev|api/cron|_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
