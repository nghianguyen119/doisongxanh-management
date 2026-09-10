import { describe, expect, it, vi } from "vitest";

// queries.ts pulls in the db client; the filter parser itself is pure.
vi.mock("@/db", () => ({ db: {} }));

const { parseTaskFilters } = await import("./queries");

/**
 * These values arrive straight from the query string. Anything that is not
 * dropped here reaches a Postgres enum or uuid column, where a bad value is a
 * 500 rather than an ignored filter.
 */
describe("parseTaskFilters", () => {
  it("keeps a valid status and assignee", () => {
    expect(
      parseTaskFilters({
        status: "in_progress",
        assigneeId: "11111111-2222-3333-4444-555555555555",
      }),
    ).toEqual({
      status: "in_progress",
      assigneeId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it("drops a status that is not in the enum", () => {
    expect(parseTaskFilters({ status: "bogus" }).status).toBeUndefined();
    expect(parseTaskFilters({ status: "DONE" }).status).toBeUndefined();
  });

  it("drops a malformed assignee id", () => {
    expect(parseTaskFilters({ assigneeId: "1; drop table task" }).assigneeId)
      .toBeUndefined();
    expect(parseTaskFilters({ assigneeId: "123" }).assigneeId).toBeUndefined();
  });

  it("ignores repeated params (arrays) and missing values", () => {
    expect(parseTaskFilters({ status: ["done", "new"] }).status).toBeUndefined();
    expect(parseTaskFilters({})).toEqual({
      status: undefined,
      assigneeId: undefined,
    });
  });
});
