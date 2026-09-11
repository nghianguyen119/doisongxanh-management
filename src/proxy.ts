import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isDevAuthBypassed } from "@/env";

/**
 * Next.js 16 renamed `middleware` -> `proxy` (nodejs runtime, not edge).
 * This is only an optimistic gate based on cookie presence; real
 * authorization happens in server components via `requireUser()`.
 */
const PUBLIC_PATHS = ["/login"];

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
  // Guard everything except Next internals, auth API, the Zalo webhook,
  // dev endpoints and static assets.
  matcher: [
    "/((?!api/auth|api/zalo|api/dev|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
