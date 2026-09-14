import { NextResponse } from "next/server";
import { env } from "@/env";
import { SESSION_COOKIE } from "@/lib/zalo-login";

export const runtime = "nodejs";

/** Drop the Zalo session cookie and return to the test page. */
export async function GET() {
  const res = NextResponse.redirect(new URL("/zalo-login", env.NEXT_PUBLIC_APP_URL));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
