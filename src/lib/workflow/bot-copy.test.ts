import { describe, expect, it } from "vitest";
import {
  BTN,
  ONBOARDING_TASK,
  copy,
  taskCardText,
  taskNoticeText,
} from "./bot-copy";

describe("bot-copy", () => {
  const sampleTask = {
    id: "t1",
    ref: "DSX-1",
    title: "Tưới cây sảnh",
    description: "Tưới đủ nước",
    priority: "high" as const,
    // 07:30Z — the employee must read this as 14:30, their local time,
    // whatever timezone the server happens to run in.
    dueAt: new Date("2026-09-10T07:30:00Z"),
  };

  it("builds a professional task card", () => {
    const text = taskCardText(sampleTask, {
      heading: copy.assignedHeading,
      closing: copy.assignedClosing,
    });
    expect(text).toContain("📌 Công việc mới được giao");
    expect(text).toContain("DSX-1 · Tưới cây sảnh");
    expect(text).toContain("Ưu tiên: Cao");
    expect(text).toContain("Hạn hoàn thành: 10/09/2026 14:30");
    expect(text).toContain("Mô tả: Tưới đủ nước");
    expect(text).toContain("cập nhật trạng thái khi hoàn thành");
  });

  it("omits description and due date when there is none", () => {
    const text = taskCardText(
      { id: "t2", ref: "DSX-2", title: "X", priority: "normal", dueAt: null },
      { heading: "H" },
    );
    expect(text).not.toContain("Mô tả:");
    expect(text).toContain("Hạn hoàn thành: Không có");
  });

  it("builds short lifecycle notices with reference and title", () => {
    const notice = taskNoticeText(sampleTask, {
      heading: copy.doneHeading,
      closing: copy.doneClosing,
    });
    expect(notice).toContain("✅ Đã báo hoàn thành");
    expect(notice).toContain("DSX-1 · Tưới cây sảnh");
    expect(notice).toContain("Quản lý sẽ kiểm tra");
  });

  it("encodes button payloads bound to the task id", () => {
    expect(BTN.start("abc").payload).toBe("task:start:abc");
    expect(BTN.issue("abc").title).toContain("Báo sự cố");
    expect(BTN.progress("abc").payload).toBe("task:progress:abc");
    expect(BTN.progress("abc").title).toContain("Báo cáo tiến độ");
    expect(BTN.myTasks().payload).toBe("cmd:my_tasks");
  });

  it("builds the task picker buttons with truncated titles", () => {
    const pick = BTN.pick(
      "abc",
      "Tưới cây ở sảnh chính và ban công tầng hai rất dài",
    );
    expect(pick.payload).toBe("task:pick:abc");
    expect(pick.title.length).toBeLessThanOrEqual(30);
    expect(BTN.pick("abc", "Tưới cây", "DSX-7").title).toContain("DSX-7");
    expect(BTN.more().payload).toBe("ds");
    expect(copy.pickMenu(5)).toContain("5 việc");
  });

  it("builds a copy-ready invite with the employee name and code", () => {
    const text = copy.invite("Nguyễn Văn A", "MKTP");
    expect(text).toContain("Nguyễn Văn A");
    expect(text).toContain("MKTP");
    expect(text).toContain("quan tâm OA");
  });

  it("explains the buttons in the onboarding guide", () => {
    for (const btn of ["Bắt đầu", "Đã xong", "Báo sự cố", "Việc của tôi"]) {
      expect(copy.onboardingGuide).toContain(btn);
    }
  });

  it("has a non-empty onboarding task", () => {
    expect(ONBOARDING_TASK.title).toContain("làm quen");
    expect(ONBOARDING_TASK.description.length).toBeGreaterThan(20);
  });

  it("names the task in the fallback replies", () => {
    for (const text of [
      copy.taskClosed("DSX-1 · Tưới cây sảnh"),
      copy.taskStateChanged("DSX-1 · Tưới cây sảnh"),
    ]) {
      expect(text).toContain("DSX-1 · Tưới cây sảnh");
    }
  });

  it("falls back gracefully when the task label is gone", () => {
    expect(copy.taskClosed()).toContain("Công việc đã kết thúc");
    expect(copy.taskStateChanged()).toContain("Công việc vừa thay đổi");
  });
});
