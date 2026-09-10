import { customAlphabet } from "nanoid";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { employee, employeeInvite } from "@/db/schema";
import { getZaloClient } from "@/lib/zalo/factory";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type LinkResult =
  | { ok: true; employeeId: string; name: string }
  | { ok: false; reason: "not_found" | "already_linked" | "expired" };

/** Normalise a VN phone: strip separators, 84xxxxxxxxx / +84 -> 0xxxxxxxxx. */
export function normalizePhone(input: string): string {
  let p = input.replace(/[^\d]/g, "");
  if (p.startsWith("84")) p = "0" + p.slice(2);
  return p;
}

export async function generateInvite(
  employeeId: string,
  createdBy: string | null,
): Promise<{ code: string; expiresAt: Date }> {
  // Issuing a new code revokes any earlier one, so a code read out over the
  // phone weeks ago cannot still be redeemed by whoever overheard it.
  await db
    .delete(employeeInvite)
    .where(
      and(
        eq(employeeInvite.employeeId, employeeId),
        isNull(employeeInvite.consumedAt),
      ),
    );

  const code = makeCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db
    .insert(employeeInvite)
    .values({ employeeId, code, expiresAt, createdBy });
  return { code, expiresAt };
}

export async function linkByInviteCode(
  zaloUserId: string,
  rawCode: string,
): Promise<LinkResult> {
  const code = rawCode.trim().toUpperCase();
  const invite = await db.query.employeeInvite.findFirst({
    where: eq(employeeInvite.code, code),
    with: { employee: true },
  });

  if (!invite || invite.consumedAt) return { ok: false, reason: "not_found" };
  if (invite.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };
  if (invite.employee.zaloUserId && invite.employee.zaloUserId !== zaloUserId)
    return { ok: false, reason: "already_linked" };

  await finalizeLink(invite.employeeId, zaloUserId);
  await db
    .update(employeeInvite)
    .set({ consumedAt: new Date() })
    .where(eq(employeeInvite.id, invite.id));

  return { ok: true, employeeId: invite.employeeId, name: invite.employee.name };
}

export async function linkByPhone(
  zaloUserId: string,
  rawPhone: string,
): Promise<LinkResult> {
  const phone = normalizePhone(rawPhone);
  const emp = await db.query.employee.findFirst({
    where: and(eq(employee.phone, phone), isNull(employee.zaloUserId)),
  });
  if (!emp) return { ok: false, reason: "not_found" };

  await finalizeLink(emp.id, zaloUserId);
  return { ok: true, employeeId: emp.id, name: emp.name };
}

/** Portal action: manager pastes a Zalo user id onto an employee record. */
export async function linkByManualZaloId(
  employeeId: string,
  zaloUserId: string,
): Promise<LinkResult> {
  const clash = await db.query.employee.findFirst({
    where: eq(employee.zaloUserId, zaloUserId),
  });
  if (clash && clash.id !== employeeId)
    return { ok: false, reason: "already_linked" };

  const emp = await finalizeLink(employeeId, zaloUserId);
  return { ok: true, employeeId, name: emp?.name ?? "" };
}

async function finalizeLink(employeeId: string, zaloUserId: string) {
  let displayName: string | undefined;
  try {
    const profile = await getZaloClient().getUserProfile(zaloUserId);
    displayName = profile?.name;
  } catch {
    // profile lookup is best-effort
  }

  const [row] = await db
    .update(employee)
    .set({
      zaloUserId,
      zaloDisplayName: displayName,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(employee.id, employeeId))
    .returning();
  return row;
}
