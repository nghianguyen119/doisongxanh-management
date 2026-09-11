import { describe, expect, it, vi } from "vitest";

// queries.ts pulls in the db client; the normalizers themselves are pure.
vi.mock("@/db", () => ({ db: {} }));

const { normalizeTaskFilters, normalizeEmployeeFilters } = await import(
  "./queries"
);

/**
 * These values arrive straight from the URL (the `filters` nuqs param).
 * Anything that is not dropped here reaches a Postgres enum or uuid column,
 * where a bad value is a 500 rather than an ignored filter.
 */
describe("normalizeTaskFilters", () => {
  it("keeps valid statuses, priorities, assignees and title", () => {
    expect(
      normalizeTaskFilters([
        { id: "title", value: "  schema  " },
        { id: "status", value: ["in_progress", "bogus", "DONE"] },
        { id: "priority", value: ["high", "nope"] },
        {
          id: "assignee",
          value: ["11111111-2222-3333-4444-555555555555", "123", "1; drop"],
        },
      ]),
    ).toEqual({
      title: "schema",
      statuses: ["in_progress"],
      priorities: ["high"],
      assigneeIds: ["11111111-2222-3333-4444-555555555555"],
    });
  });

  it("ignores missing filters and non-array list values", () => {
    expect(normalizeTaskFilters(null)).toEqual({
      title: null,
      statuses: [],
      priorities: [],
      assigneeIds: [],
    });
    expect(
      normalizeTaskFilters([{ id: "status", value: "done" }]).statuses,
    ).toEqual([]);
  });
});

describe("normalizeEmployeeFilters", () => {
  it("keeps a valid status and trims the name", () => {
    expect(
      normalizeEmployeeFilters([
        { id: "name", value: "  An  " },
        { id: "status", value: ["active", "bogus"] },
      ]),
    ).toEqual({ name: "An", statuses: ["active"] });
  });

  it("drops everything that is not in the enum", () => {
    expect(
      normalizeEmployeeFilters([{ id: "status", value: ["ACTIVE"] }]),
    ).toEqual({ name: null, statuses: [] });
  });
});
