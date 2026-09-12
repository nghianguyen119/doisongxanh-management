import { describe, expect, it } from "vitest";
import { parseTaskPick, pickPage, sortOpenTasks } from "./task-pick";

describe("parseTaskPick", () => {
  it("accepts a plain number, with or without the word số", () => {
    expect(parseTaskPick("2", 3)).toBe(2);
    expect(parseTaskPick(" số 3 ", 3)).toBe(3);
    expect(parseTaskPick("so 1", 3)).toBe(1);
  });

  it("rejects out-of-range numbers", () => {
    expect(parseTaskPick("0", 3)).toBeNull();
    expect(parseTaskPick("4", 3)).toBeNull();
    expect(parseTaskPick("99", 3)).toBeNull();
  });

  it("rejects numbers followed by text", () => {
    expect(parseTaskPick("2 cây", 3)).toBeNull();
    expect(parseTaskPick("xong rồi", 3)).toBeNull();
    expect(parseTaskPick("", 3)).toBeNull();
  });
});

describe("sortOpenTasks", () => {
  it("orders by due date, undated last, then by longest waiting", () => {
    const t = (id: string, dueAt: string | null, assignedAt: string) => ({
      id,
      dueAt: dueAt ? new Date(dueAt) : null,
      assignedAt: new Date(assignedAt),
    });

    const sorted = sortOpenTasks([
      t("late", "2026-09-20T00:00:00Z", "2026-09-01T00:00:00Z"),
      t("none", null, "2026-09-01T00:00:00Z"),
      t("soon", "2026-09-12T00:00:00Z", "2026-09-05T00:00:00Z"),
      t("same-due-older", "2026-09-12T00:00:00Z", "2026-09-02T00:00:00Z"),
    ]);

    expect(sorted.map((x) => x.id)).toEqual([
      "same-due-older",
      "soon",
      "late",
      "none",
    ]);
  });

  it("falls back to assignedAt when no task has a due date", () => {
    const t = (id: string, assignedAt: string) => ({
      id,
      dueAt: null,
      assignedAt: new Date(assignedAt),
    });

    const sorted = sortOpenTasks([
      t("second", "2026-09-02T00:00:00Z"),
      t("first", "2026-09-01T00:00:00Z"),
    ]);

    expect(sorted.map((x) => x.id)).toEqual(["first", "second"]);
  });
});

describe("pickPage", () => {
  const rows = Array.from({ length: 8 }, (_, i) => i + 1);

  it("slices three per page and reports the rest", () => {
    const first = pickPage(rows, 0);
    expect(first.slice).toEqual([1, 2, 3]);
    expect(first.hasMore).toBe(true);
    expect(first.total).toBe(8);

    const last = pickPage(rows, 2);
    expect(last.slice).toEqual([7, 8]);
    expect(last.hasMore).toBe(false);
  });

  it("clamps an over-generated page", () => {
    expect(pickPage(rows, 9).page).toBe(2);
    expect(pickPage(rows, -1).page).toBe(0);
  });
});
