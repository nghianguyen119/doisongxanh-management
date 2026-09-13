import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = {
  EMPLOYEE_LINK_SECRET: "employee-link-secret",
  BETTER_AUTH_SECRET: "better-auth-secret-at-least-16-chars",
};

vi.mock("@/env", () => ({ env: envMock }));

const { signEmployeeLinkToken, verifyEmployeeLinkToken } = await import(
  "./employee-link"
);

const EMPLOYEE_ID = "11111111-2222-4333-8444-555555555555";

function realToken(body: string, secret: string) {
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

beforeEach(() => {
  envMock.EMPLOYEE_LINK_SECRET = "employee-link-secret";
  envMock.BETTER_AUTH_SECRET = "better-auth-secret-at-least-16-chars";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signEmployeeLinkToken / verifyEmployeeLinkToken", () => {
  it("round-trips the employee id", () => {
    const token = signEmployeeLinkToken(EMPLOYEE_ID);
    expect(verifyEmployeeLinkToken(token)).toEqual({
      employeeId: EMPLOYEE_ID,
    });
  });

  it("produces a url-safe token", () => {
    const token = signEmployeeLinkToken(EMPLOYEE_ID);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("respects a custom ttl", () => {
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    const token = signEmployeeLinkToken(EMPLOYEE_ID, 1);

    spy.mockReturnValue(now + 23 * 60 * 60 * 1000);
    expect(verifyEmployeeLinkToken(token)).not.toBeNull();

    spy.mockReturnValue(now + 25 * 60 * 60 * 1000);
    expect(verifyEmployeeLinkToken(token)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signEmployeeLinkToken(EMPLOYEE_ID, -1);
    expect(verifyEmployeeLinkToken(token)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signEmployeeLinkToken(EMPLOYEE_ID);
    const [body, sig] = token.split(".");
    const flip = body[0] === "e" ? "f" : "e";
    const tampered = `${flip}${body.slice(1)}.${sig}`;
    expect(verifyEmployeeLinkToken(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signEmployeeLinkToken(EMPLOYEE_ID);
    const [body, sig] = token.split(".");
    const flip = sig[0] === "A" ? "B" : "A";
    const tampered = `${body}.${flip}${sig.slice(1)}`;
    expect(verifyEmployeeLinkToken(tampered)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const body = Buffer.from(
      JSON.stringify({ employeeId: EMPLOYEE_ID, exp: Date.now() + 1000 }),
      "utf8",
    ).toString("base64url");
    const token = realToken(body, "some-other-secret");
    expect(verifyEmployeeLinkToken(token)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const bad of [
      "",
      "abc",
      "a.b",
      "a.b.c",
      "..",
      "!!!.???",
      signEmployeeLinkToken(EMPLOYEE_ID).replace(".", ""),
    ]) {
      expect(verifyEmployeeLinkToken(bad)).toBeNull();
    }
  });

  it("rejects a correctly signed non-JSON payload", () => {
    const body = Buffer.from("definitely not json", "utf8").toString(
      "base64url",
    );
    expect(
      verifyEmployeeLinkToken(realToken(body, "employee-link-secret")),
    ).toBeNull();
  });

  it("rejects a correctly signed payload with a non-uuid employee id", () => {
    for (const employeeId of ["", "not-a-uuid", "1234", "a".repeat(36)]) {
      const body = Buffer.from(
        JSON.stringify({ employeeId, exp: Date.now() + 1000 }),
        "utf8",
      ).toString("base64url");
      expect(
        verifyEmployeeLinkToken(realToken(body, "employee-link-secret")),
      ).toBeNull();
    }
  });

  it("rejects a correctly signed payload without an expiry", () => {
    const body = Buffer.from(
      JSON.stringify({ employeeId: EMPLOYEE_ID }),
      "utf8",
    ).toString("base64url");
    expect(
      verifyEmployeeLinkToken(realToken(body, "employee-link-secret")),
    ).toBeNull();
  });

  it("falls back to BETTER_AUTH_SECRET when the dedicated secret is empty", () => {
    envMock.EMPLOYEE_LINK_SECRET = "";
    const token = signEmployeeLinkToken(EMPLOYEE_ID);
    expect(verifyEmployeeLinkToken(token)).toEqual({
      employeeId: EMPLOYEE_ID,
    });

    envMock.EMPLOYEE_LINK_SECRET = "employee-link-secret";
    expect(verifyEmployeeLinkToken(token)).toBeNull();
  });

  it("refuses to sign with an invalid employee id", () => {
    expect(() => signEmployeeLinkToken("not-a-uuid")).toThrow();
  });

  it("fails closed when no secret is configured anywhere", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    envMock.EMPLOYEE_LINK_SECRET = "";
    envMock.BETTER_AUTH_SECRET = "";
    expect(() => signEmployeeLinkToken(EMPLOYEE_ID)).toThrow();
    expect(verifyEmployeeLinkToken("whatever.signature")).toBeNull();
  });
});
