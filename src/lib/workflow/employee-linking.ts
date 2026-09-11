import { customAlphabet } from "nanoid";
import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { employee, employeeInvite } from "@/db/schema";
import { getZaloClient } from "@/lib/zalo/factory";

/**
 * Invite codes are 4 Vietnamese consonants. F, J, W, Z are dropped (they are
 * not in the Vietnamese alphabet), as are vowels and digits, so a code never
 * reads as a word and is unambiguous when read aloud over the phone.
 */
const CONSONANTS = "BCDGHKLMNPQRSTVX";
const INVITE_CODE_RE = new RegExp(`[${CONSONANTS}]{4}`, "i");
const makeCode = customAlphabet(CONSONANTS, 4);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Consumed invites are useful as history for a while, then cleaned up. */
const CONSUMED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type LinkResult =
  | { ok: true; employeeId: string; name: string }
  | {
      ok: false;
      reason: "not_found" | "already_linked" | "expired" | "inactive";
    };

/** Normalise a VN phone: strip separators, 84xxxxxxxxx / +84 -> 0xxxxxxxxx. */
export function normalizePhone(input: string): string {
  let p = input.replace(/[^\d]/g, "");
  if (p.startsWith("84")) p = "0" + p.slice(2);
  return p;
}

/** A normalised VN number: 10-digit mobile or 11-digit landline starting with 0. */
export function isValidPhone(phone: string): boolean {
  return /^0\d{9,10}$/.test(phone);
}

/** Normalise user input, returning null when it is empty or not a valid VN phone. */
export function parsePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = normalizePhone(input);
  return normalized && isValidPhone(normalized) ? normalized : null;
}

/**
 * Finds an invite code anywhere in a free-form message, so an employee can
 * write "mã của tôi là BCDF" instead of sending the code on its own.
 * Returns the upper-cased code, or null when there is no match.
 */
export function parseInviteCode(text: string): string | null {
  const match = INVITE_CODE_RE.exec(text);
  return match ? match[0].toUpperCase() : null;
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

  await db
    .delete(employeeInvite)
    .where(
      and(
        eq(employeeInvite.employeeId, employeeId),
        isNotNull(employeeInvite.consumedAt),
        lt(
          employeeInvite.consumedAt,
          new Date(Date.now() - CONSUMED_RETENTION_MS),
        ),
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
  // A deactivated account must be re-enabled by a manager, not by an old code.
  if (invite.employee.status === "inactive")
    return { ok: false, reason: "inactive" };
  if (invite.employee.zaloUserId && invite.employee.zaloUserId !== zaloUserId)
    return { ok: false, reason: "already_linked" };

  await finalizeLink(invite.employeeId, zaloUserId);
  await db
    .update(employeeInvite)
    .set({ consumedAt: new Date() })
    .where(eq(employeeInvite.id, invite.id));

  return { ok: true, employeeId: invite.employeeId, name: invite.employee.name };
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
