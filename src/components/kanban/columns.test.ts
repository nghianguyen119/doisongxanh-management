import { describe, expect, it } from "vitest";
import { taskStatus } from "@/db/schema";
import { KANBAN_COLUMNS } from "./columns";

describe("kanban columns", () => {
  it("has unique column ids", () => {
    const ids = KANBAN_COLUMNS.map((column) => column.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps every non-cancelled status to exactly one column", () => {
    const boardStatuses = taskStatus.enumValues.filter(
      (status) => status !== "cancelled"
    );
    for (const status of boardStatuses) {
      const matches = KANBAN_COLUMNS.filter((column) =>
        column.statuses.includes(status)
      );
      expect(matches, `status "${status}"`).toHaveLength(1);
    }
  });

  it("keeps cancelled work off the board", () => {
    expect(
      KANBAN_COLUMNS.some((column) => column.statuses.includes("cancelled"))
    ).toBe(false);
  });

  it("only drops a card into a status the column itself shows", () => {
    for (const column of KANBAN_COLUMNS) {
      expect(column.statuses).toContain(column.status);
    }
  });
});
