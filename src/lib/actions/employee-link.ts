"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { env } from "@/env";
import { signEmployeeLinkToken } from "@/lib/employee-link";
import { requireUser } from "@/lib/session";
import { getZaloClient } from "@/lib/zalo/factory";

/**
 * Manager-only helpers behind /settings/zalo for the read-only employee page
 * (`/my/tasks`). They generate a shareable link and can send the URL button to
 * an explicit Zalo id (normally the manager's own, to preview what the
 * employee receives). They never default to the employee's linked Zalo id, so
 * a misconfigured call cannot message a real employee.
 */

export type EmployeeLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type EmployeeLinkSendResult =
  | { ok: true; url: string; transport: "mock" | "live"; messageId: string }
  | { ok: false; error: string };

const baseUrlSchema = z
  .string()
  .trim()
  .url("URL công khai không hợp lệ.")
  .optional()
  .or(z.literal(""));

const inputSchema = z.object({
  employeeId: z.string().uuid("Nhân viên không hợp lệ."),
  baseUrl: baseUrlSchema,
});

const sendSchema = z.object({
  employeeId: z.string().uuid("Nhân viên không hợp lệ."),
  zaloUserId: z.string().trim().min(1, "Chưa có Zalo ID người nhận."),
  baseUrl: baseUrlSchema,
});

function linkFor(employeeId: string, baseUrl?: string): string {
  const base = (baseUrl?.trim() || env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
  return `${base}/my/tasks?token=${encodeURIComponent(
    signEmployeeLinkToken(employeeId),
  )}`;
}

async function employeeExists(employeeId: string): Promise<boolean> {
  const row = await db.query.employee.findFirst({
    where: eq(employee.id, employeeId),
    columns: { id: true },
  });
  return !!row;
}

export async function generateEmployeeLinkAction(
  input: unknown,
): Promise<EmployeeLinkResult> {
  await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  }
  if (!(await employeeExists(parsed.data.employeeId))) {
    return { ok: false, error: "Không tìm thấy nhân viên." };
  }

  return { ok: true, url: linkFor(parsed.data.employeeId, parsed.data.baseUrl) };
}

export async function sendEmployeeLinkAction(
  input: unknown,
): Promise<EmployeeLinkSendResult> {
  await requireUser();

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  }
  if (!(await employeeExists(parsed.data.employeeId))) {
    return { ok: false, error: "Không tìm thấy nhân viên." };
  }

  const url = linkFor(parsed.data.employeeId, parsed.data.baseUrl);
  try {
    const client = getZaloClient();
    const { messageId } = await client.sendButtons(
      parsed.data.zaloUserId,
      "Việc của bạn đã sẵn sàng. Bấm nút bên dưới để xem danh sách.",
      [{ title: "Xem việc của tôi", url }],
    );
    return { ok: true, url, transport: client.transport, messageId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
