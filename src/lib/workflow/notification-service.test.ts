import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendText: vi.fn(),
  sendButtons: vi.fn(),
}));

vi.mock("@/lib/zalo/factory", () => ({
  getZaloClient: () => ({
    sendText: mocks.sendText,
    sendButtons: mocks.sendButtons,
  }),
}));

const { notifyAssigned, notifyDoneAck } = await import(
  "./notification-service"
);

describe("notification-service", () => {
  it("reports a successful send", async () => {
    mocks.sendText.mockResolvedValueOnce({ messageId: "1" });
    await expect(notifyDoneAck("u1")).resolves.toEqual({ ok: true });
  });

  it("reports the failure reason instead of throwing", async () => {
    mocks.sendText.mockRejectedValueOnce(
      new Error("Zalo send failed: outside the 7-day window"),
    );
    await expect(notifyDoneAck("u1")).resolves.toEqual({
      ok: false,
      error: "Zalo send failed: outside the 7-day window",
    });
  });

  it("uses the button template for assignment cards", async () => {
    mocks.sendButtons.mockResolvedValueOnce({ messageId: "2" });
    const res = await notifyAssigned(
      { id: "t1", title: "Tưới cây", priority: "normal", dueAt: null },
      "u1",
    );
    expect(res).toEqual({ ok: true });
    expect(mocks.sendButtons).toHaveBeenCalledOnce();
  });
});
