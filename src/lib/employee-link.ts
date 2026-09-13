import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

/**
 * Signed, expiring tokens for the public read-only "Việc của tôi" page
 * (`/my/tasks`). The token is the only credential that page accepts, so it
 * must be unforgeable: `<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`.
 *
 * The HMAC key is `EMPLOYEE_LINK_SECRET`, falling back to
 * `BETTER_AUTH_SECRET` when the dedicated var is unset (see src/env.ts), so
 * links work with zero configuration. Rotating either secret invalidates
 * every previously issued link.
 */

const DEFAULT_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TokenPayload = { employeeId: string; exp: number };

function linkSecret(): string {
  return env.EMPLOYEE_LINK_SECRET || env.BETTER_AUTH_SECRET;
}

function hmac(payloadPart: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadPart).digest();
}

export function signEmployeeLinkToken(
  employeeId: string,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const secret = linkSecret();
  if (!secret) {
    throw new Error(
      "Cannot sign employee link: EMPLOYEE_LINK_SECRET and BETTER_AUTH_SECRET are both empty.",
    );
  }
  if (!UUID_RE.test(employeeId)) {
    throw new Error("Cannot sign employee link: employeeId is not a uuid.");
  }

  const payload: TokenPayload = {
    employeeId,
    exp: Date.now() + ttlDays * MS_PER_DAY,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = hmac(body, secret).toString("base64url");
  return `${body}.${signature}`;
}

/**
 * Returns the token's employeeId, or null for anything malformed, tampered
 * with or expired. Never throws: the public page renders a friendly message
 * on null.
 */
export function verifyEmployeeLinkToken(
  token: string,
): { employeeId: string } | null {
  const secret = linkSecret();
  if (!secret || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = hmac(body, secret);
  const provided = Buffer.from(signature, "base64url");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { employeeId, exp } = parsed as Partial<TokenPayload>;
  if (typeof employeeId !== "string" || !UUID_RE.test(employeeId)) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= Date.now()) {
    return null;
  }

  return { employeeId };
}
