import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * The company operates in Vietnam. Every date the app *shows* (portal + Zalo
 * bot) and every wall-clock time a manager *types* is interpreted in this
 * timezone, regardless of the server's TZ.
 *
 * Why this matters: date-fns `format()` and `new Date("2026-09-10T14:30")`
 * both use the server's local timezone. On a UTC-deployed server a deadline
 * entered as 14:30 would be stored as 14:30Z (= 21:30 in Vietnam) and every
 * overdue/reminder comparison would be 7 hours out. Always go through the
 * helpers here instead of calling date-fns directly on a raw Date.
 */
export const APP_TZ = "Asia/Ho_Chi_Minh";

/** Format an instant as Vietnam wall-clock time. */
export function formatVN(date: Date, pattern = "dd/MM/yyyy HH:mm"): string {
  return format(new TZDate(date, APP_TZ), pattern);
}

export function formatVNDate(date: Date): string {
  return formatVN(date, "dd/MM/yyyy");
}

export function formatVNTime(date: Date): string {
  return formatVN(date, "HH:mm");
}

/** Short "10/09 14:30" used in dense tables. */
export function formatVNShort(date: Date): string {
  return formatVN(date, "dd/MM HH:mm");
}

/**
 * Parse the value of an `<input type="datetime-local">` ("2026-09-10T14:30")
 * as Vietnam wall-clock time and return the corresponding UTC instant.
 * Returns null for empty/malformed input rather than an Invalid Date.
 */
export function parseVNInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  );
  if (!m) return null;

  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  const zoned = new TZDate(y, mo - 1, d, h, mi, s, 0, APP_TZ);

  const instant = new Date(zoned.getTime());
  if (Number.isNaN(instant.getTime())) return null;

  // The Date constructor silently rolls invalid components over ("2026-13-45"
  // becomes Feb 2027), so reject anything that did not survive the trip.
  if (
    zoned.getFullYear() !== y ||
    zoned.getMonth() !== mo - 1 ||
    zoned.getDate() !== d ||
    zoned.getHours() !== h ||
    zoned.getMinutes() !== mi
  ) {
    return null;
  }
  return instant;
}

/**
 * Render an instant as a `datetime-local` input value in Vietnam time, so
 * edit forms round-trip through parseVNInput unchanged.
 */
export function toVNInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return formatVN(date, "yyyy-MM-dd'T'HH:mm");
}
