import { describe, expect, it } from "vitest";
import { taskStatus } from "@/db/schema";
import {
  TRANSITIONS,
  canTransition,
  isClosed,
  statusesAllowedToReach,
} from "./task-status";

describe("task status transitions", () => {
  it("covers every status in the enum", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(
      [...taskStatus.enumValues].sort(),
    );
  });

  it("only ever names real statuses as targets", () => {
    for (const targets of Object.values(TRANSITIONS)) {
      for (const t of targets) {
        expect(taskStatus.enumValues).toContain(t);
      }
    }
  });

  /**
   * The reason this module exists: a Zalo button from an old message stays
   * tappable forever, so a finished task must refuse to move.
   */
  it("refuses every employee action on a verified task", () => {
    for (const to of taskStatus.enumValues) {
      expect(canTransition("verified", to)).toBe(false);
    }
  });

  it("lets a cancelled task only be revived by re-assigning it", () => {
    expect(canTransition("cancelled", "assigned")).toBe(true);
    expect(canTransition("cancelled", "done")).toBe(false);
    expect(canTransition("cancelled", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "verified")).toBe(false);
  });

  it("allows the normal happy path", () => {
    expect(canTransition("assigned", "accepted")).toBe(true);
    expect(canTransition("accepted", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "done")).toBe(true);
    expect(canTransition("done", "verified")).toBe(true);
  });

  it("allows reporting an issue at any point while the work is live", () => {
    for (const from of ["assigned", "accepted", "in_progress", "done"] as const) {
      expect(canTransition(from, "blocked")).toBe(true);
    }
  });

  it("lets a manager reject completed work back to in_progress", () => {
    expect(canTransition("done", "in_progress")).toBe(true);
  });

  it("returns only unstarted work to the backlog", () => {
    expect(canTransition("assigned", "new")).toBe(true);
    expect(canTransition("accepted", "new")).toBe(false);
    expect(canTransition("in_progress", "new")).toBe(false);
    expect(canTransition("blocked", "new")).toBe(false);
  });

  it("only verifies work that was reported done", () => {
    const canVerify = statusesAllowedToReach("verified");
    expect(canVerify).toEqual(["done"]);
  });

  it("statusesAllowedToReach is the inverse of canTransition", () => {
    for (const to of taskStatus.enumValues) {
      const allowed = statusesAllowedToReach(to);
      for (const from of taskStatus.enumValues) {
        expect(allowed.includes(from)).toBe(canTransition(from, to));
      }
    }
  });

  it("marks exactly the terminal statuses as closed", () => {
    expect(isClosed("verified")).toBe(true);
    expect(isClosed("cancelled")).toBe(true);
    expect(isClosed("done")).toBe(false);
    expect(isClosed("blocked")).toBe(false);
  });
});
