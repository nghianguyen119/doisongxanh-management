import { describe, expect, it, vi } from "vitest";

// employee-linking imports the db client and the Zalo client factory; the pure
// phone helpers below need neither.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/zalo/factory", () => ({ getZaloClient: () => ({}) }));

const { normalizePhone, isValidPhone, parsePhone } = await import(
  "./employee-linking"
);

describe("normalizePhone", () => {
  it("strips separators", () => {
    expect(normalizePhone("0912 345 678")).toBe("0912345678");
    expect(normalizePhone("0912.345.678")).toBe("0912345678");
  });

  it("turns +84 / 84 prefixes into a local 0", () => {
    expect(normalizePhone("+84 912 345 678")).toBe("0912345678");
    expect(normalizePhone("84912345678")).toBe("0912345678");
  });
});

describe("isValidPhone", () => {
  it("accepts 10-digit mobiles and 11-digit landlines", () => {
    expect(isValidPhone("0912345678")).toBe(true);
    expect(isValidPhone("02412345678")).toBe(true);
  });

  it("rejects short, long or non-numeric input", () => {
    expect(isValidPhone("01239123")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("+84912345678")).toBe(false);
  });
});

describe("parsePhone", () => {
  it("normalises valid input", () => {
    expect(parsePhone("+84 912 345 678")).toBe("0912345678");
  });

  it("returns null for empty or invalid input", () => {
    expect(parsePhone(null)).toBeNull();
    expect(parsePhone(undefined)).toBeNull();
    expect(parsePhone("")).toBeNull();
    expect(parsePhone("abc")).toBeNull();
    expect(parsePhone("01239123")).toBeNull();
  });
});
