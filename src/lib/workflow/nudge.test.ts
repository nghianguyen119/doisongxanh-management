import { describe, expect, it } from "vitest";
import {
  HOUR_MS,
  MINUTE_MS,
  NUDGE_DAILY_CAP,
  NUDGE_LEVELS,
  isWithinWorkHours,
  nextWorkStart,
  nudgeLevelFor,
  vnDayKey,
} from "./nudge";

describe("nudge rules", () => {
  it("escalates through the three levels by waiting time", () => {
    expect(nudgeLevelFor(0).level).toBe(1);
    expect(nudgeLevelFor(29 * MINUTE_MS).level).toBe(1);
    expect(nudgeLevelFor(30 * MINUTE_MS).level).toBe(1);
    expect(nudgeLevelFor(2 * HOUR_MS).level).toBe(2);
    expect(nudgeLevelFor(4 * HOUR_MS).level).toBe(3);
    expect(nudgeLevelFor(3 * 24 * HOUR_MS).level).toBe(3);
  });

  it("keeps a cooldown per level", () => {
    expect(NUDGE_LEVELS.map((l) => l.cooldownMs)).toEqual([
      30 * MINUTE_MS,
      HOUR_MS,
      4 * HOUR_MS,
    ]);
    expect(NUDGE_DAILY_CAP).toBe(3);
  });

  it("bounds working hours to 07:00-17:59 Vietnam time", () => {
    // 00:00 UTC = 07:00 Vietnam.
    expect(isWithinWorkHours(new Date("2026-09-14T00:00:00Z"))).toBe(true);
    // 10:59 UTC = 17:59 Vietnam.
    expect(isWithinWorkHours(new Date("2026-09-14T10:59:00Z"))).toBe(true);
    // 11:00 UTC = 18:00 Vietnam.
    expect(isWithinWorkHours(new Date("2026-09-14T11:00:00Z"))).toBe(false);
    // 23:00 UTC = 06:00 next day Vietnam.
    expect(isWithinWorkHours(new Date("2026-09-14T23:00:00Z"))).toBe(false);
  });

  it("returns the next 07:00 Vietnam instant", () => {
    // 20:00 Vietnam -> tomorrow 07:00 (+07:00).
    const evening = new Date("2026-09-14T13:00:00Z");
    expect(nextWorkStart(evening).toISOString()).toBe(
      "2026-09-15T00:00:00.000Z",
    );
    // 05:00 Vietnam -> today 07:00.
    const dawn = new Date("2026-09-14T22:00:00Z");
    expect(nextWorkStart(dawn).toISOString()).toBe(
      "2026-09-15T00:00:00.000Z",
    );
  });

  it("keys days by Vietnam wall-clock date", () => {
    // 17:00 UTC = 00:00 next day in Vietnam.
    expect(vnDayKey(new Date("2026-09-14T16:59:00Z"))).toBe("2026-09-14");
    expect(vnDayKey(new Date("2026-09-14T17:00:00Z"))).toBe("2026-09-15");
  });
});
