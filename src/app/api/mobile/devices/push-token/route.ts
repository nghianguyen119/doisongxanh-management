import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, noContent, requireMobile } from "@/lib/mobile/api";
import { registerPushToken } from "@/lib/mobile/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().trim().max(4096),
});

/** Refresh (or clear, with an empty string) this device's FCM token. */
export async function POST(req: NextRequest) {
  const auth = await requireMobile(req);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Dữ liệu không hợp lệ.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Dữ liệu không hợp lệ.");

  await registerPushToken({
    deviceId: auth.session.device.id,
    token: parsed.data.token || null,
  });
  return noContent();
}
