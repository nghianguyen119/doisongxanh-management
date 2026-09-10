import { describe, expect, it } from "vitest";
import { formatVN, parseVNInput, toVNInputValue } from "./time";

/**
 * These must hold no matter what TZ the server runs in — that is the whole
 * point of the module. Vitest inherits the machine TZ, so the assertions are
 * written against absolute UTC instants.
 */
describe("time (Asia/Ho_Chi_Minh, UTC+7)", () => {
  it("formats an instant as Vietnam wall-clock time", () => {
    // 07:30Z is 14:30 in Vietnam
    expect(formatVN(new Date("2026-09-10T07:30:00Z"))).toBe("10/09/2026 14:30");
  });

  it("crosses the date boundary correctly", () => {
    // 18:00Z is 01:00 the NEXT day in Vietnam
    expect(formatVN(new Date("2026-09-10T18:00:00Z"))).toBe("11/09/2026 01:00");
  });

  it("parses a datetime-local value as Vietnam wall time", () => {
    expect(parseVNInput("2026-09-10T14:30")?.toISOString()).toBe(
      "2026-09-10T07:30:00.000Z",
    );
  });

  it("round-trips input value -> instant -> input value", () => {
    const value = "2026-12-31T23:59";
    const instant = parseVNInput(value)!;
    expect(toVNInputValue(instant)).toBe(value);
  });

  it("returns null for empty or malformed input instead of Invalid Date", () => {
    expect(parseVNInput("")).toBeNull();
    expect(parseVNInput(null)).toBeNull();
    expect(parseVNInput("not-a-date")).toBeNull();
    expect(parseVNInput("2026-13-45T99:99")).toBeNull();
  });

  it("toVNInputValue is empty for a missing date", () => {
    expect(toVNInputValue(null)).toBe("");
  });
});
