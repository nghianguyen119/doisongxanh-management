import { type NextRequest } from "next/server";
import { noContent, requireMobile } from "@/lib/mobile/api";
import { revokeDevice } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke the current device. The app clears its session regardless. */
export async function POST(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  await revokeDevice({ deviceId: auth.session.device.id });
  return noContent();
}
