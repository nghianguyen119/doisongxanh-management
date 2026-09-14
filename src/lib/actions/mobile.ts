"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generatePairCode, revokeDevice } from "@/lib/mobile/auth";
import { requireUser } from "@/lib/session";
import type { ActionResultState } from "@/lib/action-state";

/**
 * Portal actions for the Android employee app: issuing a pairing code and
 * revoking a paired phone. See `src/components/employee-detail/mobile-card.tsx`.
 */

function toActionError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
  }
  console.error("[mobile] unexpected form error", err);
  return "Không thể thực hiện. Vui lòng thử lại.";
}

export async function generatePairCodeAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  try {
    const user = await requireUser();
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    await generatePairCode(employeeId, user.id);
    revalidatePath(`/employees/${employeeId}`);
    return { success: true };
  } catch (err) {
    return { error: toActionError(err) };
  }
}

export async function revokeMobileDeviceAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  try {
    await requireUser();
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    const deviceId = z.string().uuid().parse(formData.get("deviceId"));
    const revoked = await revokeDevice({ deviceId, employeeId });
    if (!revoked) {
      return { error: "Thiết bị không tồn tại hoặc đã được thu hồi." };
    }
    revalidatePath(`/employees/${employeeId}`);
    return { success: true };
  } catch (err) {
    return { error: toActionError(err) };
  }
}
