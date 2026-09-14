import { NextResponse } from "next/server";
import { authenticateMobile, type MobileSession } from "./auth";

/** Shared response helpers for the `/api/mobile/*` route handlers. */

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export type MobileAuth =
  | { session: MobileSession }
  | { response: NextResponse };

/**
 * Resolve the bearer token or short-circuit with the 401 the app expects
 * (it clears the session and sends the employee back to pairing).
 */
export async function requireMobile(req: Request): Promise<MobileAuth> {
  const session = await authenticateMobile(req);
  if (!session) {
    return {
      response: jsonError(
        401,
        "Phiên làm việc đã hết hạn. Vui lòng ghép nối lại thiết bị.",
      ),
    };
  }
  return { session };
}
