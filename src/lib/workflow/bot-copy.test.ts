import { describe, expect, it } from "vitest";
import { BTN, taskCardText } from "./bot-copy";

describe("bot-copy", () => {
  it("builds a Vietnamese task card with heading, title and due", () => {
    const text = taskCardText(
      {
        id: "t1",
        title: "Tưới cây sảnh",
        description: "Tưới đủ nước",
        priority: "high",
        dueAt: new Date("2026-09-10T08:30:00"),
      },
      "🔔 Bạn có công việc mới:",
    );
    expect(text).toContain("🔔 Bạn có công việc mới:");
    expect(text).toContain("📋 Tưới cây sảnh");
    expect(text).toContain("📝 Tưới đủ nước");
    expect(text).toContain("Mức ưu tiên: Cao");
    expect(text).toContain("10/09/2026 08:30");
  });

  it("omits the description line when there is none", () => {
    const text = taskCardText(
      { id: "t2", title: "X", priority: "normal", dueAt: null },
      "H",
    );
    expect(text).not.toContain("📝");
    expect(text).toContain("Hạn: Không có hạn");
  });

  it("encodes button payloads bound to the task id", () => {
    expect(BTN.accept("abc").payload).toBe("task:accept:abc");
    expect(BTN.issue("abc").title).toContain("Báo sự cố");
  });
});
