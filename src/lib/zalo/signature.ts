import { createHash } from "node:crypto";
import { env } from "@/env";

/**
 * Verify a Zalo OA webhook signature.
 *   mac = SHA256(appId + rawBody + timestamp + OASecretKey)
 * Header: `X-ZEvent-Signature: mac=<hex>`
 *
 * Fails CLOSED in live mode: without a verified signature anyone who learns
 * an employee's Zalo user id could mark tasks done or file fake issue
 * reports, so a live deployment missing ZALO_OA_SECRET rejects everything
 * rather than trusting the caller. Verification is skipped only when the
 * transport is `mock`, where the simulator posts unsigned events.
 */
export function verifyZaloSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestamp: string | undefined,
): boolean {
  if (env.ZALO_TRANSPORT === "mock") return true;

  if (!env.ZALO_OA_SECRET || !env.ZALO_APP_ID) {
    console.error(
      "[zalo] refusing webhook: ZALO_TRANSPORT=live requires ZALO_APP_ID and ZALO_OA_SECRET",
    );
    return false;
  }
  if (!signatureHeader || !timestamp) return false;

  const provided = signatureHeader.replace(/^mac=/, "").trim().toLowerCase();
  const expected = createHash("sha256")
    .update(env.ZALO_APP_ID + rawBody + timestamp + env.ZALO_OA_SECRET)
    .digest("hex");

  return timingSafeEqualHex(provided, expected);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
