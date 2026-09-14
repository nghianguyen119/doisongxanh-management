import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { db } from "@/db";
import {
  employee,
  mobileDevice,
  mobilePairCode,
  type employee as employeeTable,
} from "@/db/schema";

/**
 * Device pairing and bearer-token auth for the Android employee app.
 *
 * A manager generates a short-lived 6-digit code (portal UI) and reads it to
 * the employee. `POST /api/mobile/pair` exchanges it for a long-lived device
 * token. Only the token's SHA-256 hash is stored, so the DB cannot be replayed
 * against the API.
 */

const PAIR_CODE_TTL_MS = 15 * 60 * 1000;
const TOKEN_PREFIX = "dsxm_";
const makePairCode = customAlphabet("0123456789", 6);

export type PairCodeState = {
  code: string;
  expiresAt: Date;
};

export type PairFailure = "invalid" | "expired" | "inactive";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a fresh code, dropping any still-active one so a code read out weeks
 * ago cannot be redeemed after the employee asks for a new one.
 */
export async function generatePairCode(
  employeeId: string,
  createdBy: string | null,
): Promise<PairCodeState> {
  await db
    .delete(mobilePairCode)
    .where(
      and(
        eq(mobilePairCode.employeeId, employeeId),
        isNull(mobilePairCode.consumedAt),
      ),
    );

  const code = makePairCode();
  const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MS);
  await db
    .insert(mobilePairCode)
    .values({ employeeId, code, expiresAt, createdBy });
  return { code, expiresAt };
}

export async function getActivePairCode(
  employeeId: string,
): Promise<PairCodeState | null> {
  const row = await db.query.mobilePairCode.findFirst({
    where: and(
      eq(mobilePairCode.employeeId, employeeId),
      isNull(mobilePairCode.consumedAt),
      gt(mobilePairCode.expiresAt, new Date()),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
  return row ? { code: row.code, expiresAt: row.expiresAt } : null;
}

export type ConsumedPairCode =
  | { ok: true; employee: typeof employeeTable.$inferSelect }
  | { ok: false; reason: PairFailure };

/**
 * Redeem a code. The conditional `UPDATE` makes redemption single-use even if
 * two devices submit the same code at once.
 */
export async function consumePairCode(
  rawCode: string,
): Promise<ConsumedPairCode> {
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, reason: "invalid" };

  const row = await db.query.mobilePairCode.findFirst({
    where: eq(mobilePairCode.code, code),
    with: { employee: true },
  });
  if (!row || row.consumedAt) return { ok: false, reason: "invalid" };
  if (row.expiresAt.getTime() < Date.now())
    return { ok: false, reason: "expired" };
  if (row.employee.status === "inactive")
    return { ok: false, reason: "inactive" };

  const [consumed] = await db
    .update(mobilePairCode)
    .set({ consumedAt: new Date() })
    .where(
      and(eq(mobilePairCode.id, row.id), isNull(mobilePairCode.consumedAt)),
    )
    .returning({ id: mobilePairCode.id });
  if (!consumed) return { ok: false, reason: "invalid" };

  // Pairing a phone is proof the employee is actually using the system; an
  // invited account becomes active the same way a Zalo link does.
  if (row.employee.status === "invited") {
    await db
      .update(employee)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(employee.id, row.employeeId));
    row.employee.status = "active";
  }

  return { ok: true, employee: row.employee };
}

export type IssuedDevice = {
  token: string;
  device: typeof mobileDevice.$inferSelect;
};

export async function issueDeviceToken(input: {
  employeeId: string;
  deviceName?: string | null;
  platform: "android" | "ios";
  pushToken?: string | null;
}): Promise<IssuedDevice> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const now = new Date();
  const [device] = await db
    .insert(mobileDevice)
    .values({
      employeeId: input.employeeId,
      tokenHash: hashDeviceToken(token),
      deviceName: input.deviceName?.trim() || null,
      platform: input.platform,
      pushToken: input.pushToken?.trim() || null,
      pushTokenUpdatedAt: input.pushToken?.trim() ? now : null,
      lastSeenAt: now,
    })
    .returning();
  return { token, device };
}

export type MobileSession = {
  device: typeof mobileDevice.$inferSelect;
  employee: typeof employeeTable.$inferSelect;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the device + employee behind an `Authorization: Bearer` header.
 * Returns null for missing/revoked tokens; callers answer 401 so the app
 * clears its session and asks to re-pair.
 */
export async function authenticateMobile(
  req: Request,
): Promise<MobileSession | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const device = await db.query.mobileDevice.findFirst({
    where: eq(mobileDevice.tokenHash, hashDeviceToken(token)),
    with: { employee: true },
  });
  if (!device || device.revokedAt) return null;
  if (device.employee.status === "inactive") return null;

  // Throttle the lastSeen write: the portal only shows a rough "lần cuối".
  const lastSeen = device.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - lastSeen > 5 * 60 * 1000) {
    await db
      .update(mobileDevice)
      .set({ lastSeenAt: new Date() })
      .where(eq(mobileDevice.id, device.id));
  }

  return { device, employee: device.employee };
}

export async function registerPushToken(input: {
  deviceId: string;
  token: string | null;
}): Promise<void> {
  const token = input.token?.trim() || null;
  await db
    .update(mobileDevice)
    .set({
      pushToken: token,
      pushTokenUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(mobileDevice.id, input.deviceId));
}

export async function revokeDevice(input: {
  deviceId: string;
  employeeId?: string;
}): Promise<boolean> {
  const [row] = await db
    .update(mobileDevice)
    .set({ revokedAt: new Date(), pushToken: null, updatedAt: new Date() })
    .where(
      and(
        eq(mobileDevice.id, input.deviceId),
        isNull(mobileDevice.revokedAt),
        input.employeeId
          ? eq(mobileDevice.employeeId, input.employeeId)
          : undefined,
      ),
    )
    .returning({ id: mobileDevice.id });
  return Boolean(row);
}

export async function listDevices(employeeId: string) {
  return db.query.mobileDevice.findMany({
    where: and(
      eq(mobileDevice.employeeId, employeeId),
      isNull(mobileDevice.revokedAt),
    ),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
}
