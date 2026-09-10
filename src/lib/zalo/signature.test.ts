import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const envMock = {
  ZALO_TRANSPORT: "live" as "live" | "mock",
  ZALO_APP_ID: "app-1",
  ZALO_OA_SECRET: "oa-secret",
};

vi.mock("@/env", () => ({ env: envMock }));

const { verifyZaloSignature } = await import("./signature");

function sign(body: string, timestamp: string) {
  return createHash("sha256")
    .update(envMock.ZALO_APP_ID + body + timestamp + envMock.ZALO_OA_SECRET)
    .digest("hex");
}

afterEach(() => {
  envMock.ZALO_TRANSPORT = "live";
  envMock.ZALO_APP_ID = "app-1";
  envMock.ZALO_OA_SECRET = "oa-secret";
  vi.restoreAllMocks();
});

describe("verifyZaloSignature", () => {
  const body = '{"event_name":"user_send_text"}';
  const ts = "1757500000000";

  it("accepts a correctly signed request", () => {
    expect(verifyZaloSignature(body, `mac=${sign(body, ts)}`, ts)).toBe(true);
  });

  it("accepts the bare hex form without the mac= prefix", () => {
    expect(verifyZaloSignature(body, sign(body, ts), ts)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const mac = `mac=${sign(body, ts)}`;
    expect(verifyZaloSignature(body + "x", mac, ts)).toBe(false);
  });

  it("rejects a replayed signature bound to another timestamp", () => {
    const mac = `mac=${sign(body, ts)}`;
    expect(verifyZaloSignature(body, mac, "1757509999999")).toBe(false);
  });

  it("rejects a missing signature or timestamp", () => {
    expect(verifyZaloSignature(body, null, ts)).toBe(false);
    expect(verifyZaloSignature(body, `mac=${sign(body, ts)}`, undefined)).toBe(
      false,
    );
  });

  /**
   * The important one: a live deployment that forgot ZALO_OA_SECRET must
   * reject everything rather than trust unauthenticated callers, who could
   * otherwise complete tasks on any employee's behalf.
   */
  it("fails CLOSED in live mode when the secret is not configured", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    envMock.ZALO_OA_SECRET = "";
    expect(verifyZaloSignature(body, `mac=whatever`, ts)).toBe(false);

    envMock.ZALO_OA_SECRET = "oa-secret";
    envMock.ZALO_APP_ID = "";
    expect(verifyZaloSignature(body, `mac=whatever`, ts)).toBe(false);
  });

  it("skips verification only for the mock transport", () => {
    envMock.ZALO_TRANSPORT = "mock";
    expect(verifyZaloSignature(body, null, undefined)).toBe(true);
  });
});
