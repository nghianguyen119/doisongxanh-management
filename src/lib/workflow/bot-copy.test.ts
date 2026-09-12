import { describe, expect, it } from "vitest";
import { BTN, ONBOARDING_TASK, copy, taskCardText } from "./bot-copy";

describe("bot-copy", () => {
  it("builds a Vietnamese task card with heading, title and due", () => {
    const text = taskCardText(
      {
        id: "t1",
        title: "Tưới cây sảnh",
        description: "Tưới đủ nước",
        priority: "high",
        // 07:30Z — the employee must read this as 14:30, their local time,
        // whatever timezone the server happens to run in.
        dueAt: new Date("2026-09-10T07:30:00Z"),
      },
      "🔔 Bạn có công việc mới:",
    );
    expect(text).toContain("🔔 Bạn có công việc mới:");
    expect(text).toContain("📋 Tưới cây sảnh");
    expect(text).toContain("📝 Tưới đủ nước");
    expect(text).toContain("Mức ưu tiên: Cao");
    expect(text).toContain("⏰ Hạn: 10/09/2026 14:30");
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
    expect(BTN.start("abc").payload).toBe("task:start:abc");
    expect(BTN.issue("abc").title).toContain("Báo sự cố");
  });

  it("builds a copy-ready invite with the employee name and code", () => {
    const text = copy.invite("Nguyễn Văn A", "MKTP");
    expect(text).toContain("Nguyễn Văn A");
    expect(text).toContain("MKTP");
    expect(text).toContain("quan tâm OA");
  });

  it("explains the buttons in the onboarding guide", () => {
    for (const btn of ["Bắt đầu", "Đã xong", "Báo sự cố", "Chi tiết"]) {
      expect(copy.onboardingGuide).toContain(btn);
    }
  });

  it("has a non-empty onboarding task", () => {
    expect(ONBOARDING_TASK.title).toContain("làm quen");
    expect(ONBOARDING_TASK.description.length).toBeGreaterThan(20);
  });
});
