"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { requireUser } from "@/lib/session";
import {
  generateInvite,
  linkByManualZaloId,
  normalizePhone,
} from "@/lib/workflow/employee-linking";

const createSchema = z.object({
  name: z.string().min(1, "Nhập tên nhân viên"),
  phone: z.string().optional(),
  position: z.string().optional(),
  note: z.string().optional(),
});

export async function createEmployeeAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    position: formData.get("position") || undefined,
    note: formData.get("note") || undefined,
  });

  const [row] = await db
    .insert(employee)
    .values({
      name: parsed.name,
      phone: parsed.phone ? normalizePhone(parsed.phone) : null,
      position: parsed.position ?? null,
      note: parsed.note ?? null,
      createdBy: user.id,
    })
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
