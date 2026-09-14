import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { consumePairCode, issueDeviceToken, type PairFailure } from "@/lib/mobile/auth";
import { jsonError } from "@/lib/mobile/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pairSchema = z.object({
  code: z.string().trim().min(1).max(32),
  deviceName: z.string().trim().max(120).optional(),
  platform: z.enum(["android", "ios"]).default("android"),
  pushToken: z.string().trim().max(4096).optional(),
});

const FAILURE_MESSAGE: Record<PairFailure, string> = {
  invalid: "Mã ghép nối không đúng. Vui lòng kiểm tra lại với quản lý.",
  expired: "Mã ghép nối đã hết hạn. Vui lòng xin mã mới.",
  inactive:
    "Tài khoản của bạn đang tạm ngưng. Vui lòng liên hệ quản lý để mở lại.",
};

/**
 * Exchange a manager-issued 6-digit code for a long-lived device token.
 * No auth: this is the bootstrap call the app makes before it has a token.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Dữ liệu ghép nối không hợp lệ.");
  }

  const parsed = pairSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Dữ liệu ghép nối không hợp lệ.");
  }

  const consumed = await consumePairCode(parsed.data.code);
  if (!consumed.ok) {
    return jsonError(400, FAILURE_MESSAGE[consumed.reason]);
  }

  const { token } = await issueDeviceToken({
    employeeId: consumed.employee.id,
    deviceName: parsed.data.deviceName,
    platform: parsed.data.platform,
    pushToken: parsed.data.pushToken,
  });

  return NextResponse.json({
    token,
    employee: {
      id: consumed.employee.id,
      name: consumed.employee.name,
      position: consumed.employee.position,
    },
  });
}
