"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireUser } from "@/lib/session";
import {
  generateInvite,
  linkByManualZaloId,
  parsePhone,
} from "@/lib/workflow/employee-linking";

const employeeProfileSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên nhân viên").max(120),
  phone: z.string().optional(),
  position: z.string().optional(),
  note: z.string().optional(),
});

function readEmployeeProfile(formData: FormData) {
  const parsed = employeeProfileSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    position: formData.get("position") || undefined,
    note: formData.get("note") || undefined,
  });

  const phone = parsed.phone ? parsePhone(parsed.phone) : null;
  if (parsed.phone && !phone) {
    throw new Error("Số điện thoại không hợp lệ (ví dụ: 0912 345 678).");
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
    throw new Error("Số điện thoại này đã thuộc về nhân viên khác.");
  }
}

export async function createEmployeeAction(formData: FormData) {
  const user = await requireUser();
  const profile = readEmployeeProfile(formData);
  await assertPhoneAvailable(profile.phone);

  const [row] = await db
    .insert(employee)
    .values({ ...profile, createdBy: user.id })
    .returning();

  revalidatePath("/employees");
  redirect(`/employees/${row.id}`);
}

export async function generateInviteAction(formData: FormData) {
  const user = await requireUser();
  const employeeId = z.string().uuid().parse(formData.get("employeeId"));
  await generateInvite(employeeId, user.id);
  revalidatePath(`/employees/${employeeId}`);
}

export async function updateEmployeeAction(formData: FormData) {
  await requireUser();
  const employeeId = z.string().uuid().parse(formData.get("employeeId"));
  const profile = readEmployeeProfile(formData);
  await assertPhoneAvailable(profile.phone, employeeId);

  const [row] = await db
    .update(employee)
    .set({ ...profile, updatedAt: new Date() })
    .where(eq(employee.id, employeeId))
    .returning({ id: employee.id });

  if (!row) throw new Error("Không tìm thấy nhân viên.");

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
}

export async function linkManualAction(formData: FormData) {
  await requireUser();
  const employeeId = z.string().uuid().parse(formData.get("employeeId"));
  const zaloUserId = z.string().min(1).parse(formData.get("zaloUserId"));
  const res = await linkByManualZaloId(employeeId, zaloUserId.trim());
  if (!res.ok) {
    throw new Error(
      res.reason === "already_linked"
        ? "Zalo ID này đã gắn với nhân viên khác."
        : "Không kết nối được.",
    );
  }
  revalidatePath(`/employees/${employeeId}`);
}

export async function setEmployeeStatusAction(formData: FormData) {
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
export async function unlinkZaloAction(formData: FormData) {
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

  if (!row) throw new Error("Không tìm thấy nhân viên.");

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
}
