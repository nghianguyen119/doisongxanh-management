"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { ActionResultState } from "@/lib/action-state";
import {
  generateInvite,
  linkByManualZaloId,
  parsePhone,
} from "@/lib/workflow/employee-linking";
import { onboardEmployee } from "@/lib/workflow/onboarding";

const employeeProfileSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên nhân viên").max(120),
  phone: z.string().optional(),
  position: z.string().optional(),
  note: z.string().optional(),
});

/**
 * Form state for the employee create/edit forms, consumed with `useActionState`.
 * Validation failures must be returned rather than thrown: production redacts
 * thrown server-action errors (React #441 in the error boundary), so the
 * friendly message would never reach the manager.
 */
export type EmployeeFormState = ActionResultState;

/** An error we produced for the user; safe to display verbatim. */
class UserInputError extends Error {}

function toFormError(err: unknown): string {
  if (err instanceof UserInputError) return err.message;
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
  }
  console.error("[employees] unexpected form error", err);
  return "Không thể lưu thay đổi. Vui lòng thử lại.";
}

function readEmployeeProfile(formData: FormData) {
  const parsed = employeeProfileSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    position: formData.get("position") || undefined,
    note: formData.get("note") || undefined,
  });

  const phone = parsed.phone ? parsePhone(parsed.phone) : null;
  if (parsed.phone && !phone) {
    throw new UserInputError(
      "Số điện thoại không hợp lệ (ví dụ: 0912 345 678).",
    );
  }

  return {
    name: parsed.name,
    phone,
    position: parsed.position?.trim() ? parsed.position.trim() : null,
    note: parsed.note?.trim() ? parsed.note.trim() : null,
  };
}

/** Phones are the matching key for Zalo linking, so they must stay unique. */
async function assertPhoneAvailable(phone: string | null, excludeId?: string) {
  if (!phone) return;
  const existing = await db.query.employee.findFirst({
    where: eq(employee.phone, phone),
  });
  if (existing && existing.id !== excludeId) {
    throw new UserInputError("Số điện thoại này đã thuộc về nhân viên khác.");
  }
}

export async function createEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const user = await requireUser();

  let newId: string;
  try {
    const profile = readEmployeeProfile(formData);
    await assertPhoneAvailable(profile.phone);

    const [row] = await db
      .insert(employee)
      .values({ ...profile, createdBy: user.id })
      .returning({ id: employee.id });
    newId = row.id;
  } catch (err) {
    return { error: toFormError(err) };
  }

  revalidatePath("/employees");
  return { success: true, redirectTo: `/employees/${newId}` };
}

export async function generateInviteAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  try {
    const user = await requireUser();
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    await generateInvite(employeeId, user.id);
    revalidatePath(`/employees/${employeeId}`);
    return { success: true };
  } catch (err) {
    return { error: toFormError(err) };
  }
}

export async function updateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  await requireUser();

  try {
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    const profile = readEmployeeProfile(formData);
    await assertPhoneAvailable(profile.phone, employeeId);

    const [row] = await db
      .update(employee)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(employee.id, employeeId))
      .returning({ id: employee.id });

    if (!row) return { error: "Không tìm thấy nhân viên." };

    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    return { success: true };
  } catch (err) {
    return { error: toFormError(err) };
  }
}

export async function linkManualAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  try {
    await requireUser();
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    const zaloUserId = z.string().min(1).parse(formData.get("zaloUserId"));
    const res = await linkByManualZaloId(employeeId, zaloUserId.trim());
    if (!res.ok) {
      return {
        error:
          res.reason === "already_linked"
            ? "Zalo ID này đã gắn với nhân viên khác."
            : "Không kết nối được.",
      };
    }
    await onboardEmployee(employeeId);
    revalidatePath(`/employees/${employeeId}`);
    return { success: true };
  } catch (err) {
    return { error: toFormError(err) };
  }
}

export async function setEmployeeStatusAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  try {
    await requireUser();
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    const status = z
      .enum(["invited", "active", "inactive"])
      .parse(formData.get("status"));
    await db
      .update(employee)
      .set({ status, updatedAt: new Date() })
      .where(eq(employee.id, employeeId));
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees");
    return { success: true };
  } catch (err) {
    return { error: toFormError(err) };
  }
}

/** Bulk variant used by the table's selection action bar. */
export async function setEmployeesStatusAction(formData: FormData) {
  await requireUser();
  const ids = z
    .array(z.string().uuid())
    .min(1)
    .parse(JSON.parse(String(formData.get("employeeIds"))));
  const status = z
    .enum(["invited", "active", "inactive"])
    .parse(formData.get("status"));

  await db
    .update(employee)
    .set({ status, updatedAt: new Date() })
    .where(inArray(employee.id, ids));

  revalidatePath("/employees");
}

/**
 * Detaches the Zalo account so the employee can re-link with another one.
 * They go back to `invited` until a new link succeeds.
 */
export async function unlinkZaloAction(
  _prev: ActionResultState,
  formData: FormData,
): Promise<ActionResultState> {
  try {
    await requireUser();
    const employeeId = z.string().uuid().parse(formData.get("employeeId"));
    const [row] = await db
      .update(employee)
      .set({
        zaloUserId: null,
        zaloDisplayName: null,
        status: "invited",
        updatedAt: new Date(),
      })
      .where(eq(employee.id, employeeId))
      .returning({ id: employee.id });

    if (!row) return { error: "Không tìm thấy nhân viên." };

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees");
    return { success: true };
  } catch (err) {
    return { error: toFormError(err) };
  }
}
