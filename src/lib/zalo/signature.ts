import { createHash } from "node:crypto";
import { env } from "@/env";

/**
 * Verify a Zalo OA webhook signature.
 *   mac = SHA256(appId + rawBody + timestamp + OASecretKey)
 * Header: `X-ZEvent-Signature: mac=<hex>`
 *
 * Returns true when ZALO_OA_SECRET is unset (mock/dev) so local testing and
 * the simulator work without credentials.
 */
export function verifyZaloSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestamp: string | undefined,
): boolean {
  if (!env.ZALO_OA_SECRET || !env.ZALO_APP_ID) return true;
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
