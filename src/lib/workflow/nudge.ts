import { formatVN } from "@/lib/time";

/**
 * Rules for "hối quản lý" (nudging a manager when work is stuck waiting).
 * Mirrors `src/lib/nudge.ts` in the app so the server can enforce what the UI
 * already gates: three escalating levels, a cooldown per level, only during
 * working hours, and a daily cap.
 *
 * Locked only because the app keeps a local copy until it trusts the backend;
 * the server is the source of truth and returns `nextNudgeAt` after a send.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

export type NudgeLevel = 1 | 2 | 3;

export interface NudgeLevelRule {
  level: NudgeLevel;
  afterMs: number;
  cooldownMs: number;
}

export const NUDGE_LEVELS: NudgeLevelRule[] = [
  { level: 1, afterMs: 30 * MINUTE_MS, cooldownMs: 30 * MINUTE_MS },
  { level: 2, afterMs: 2 * HOUR_MS, cooldownMs: HOUR_MS },
  { level: 3, afterMs: 4 * HOUR_MS, cooldownMs: 4 * HOUR_MS },
];

export const NUDGE_DAILY_CAP = 3;
export const WORK_START_HOUR = 7;
export const WORK_END_HOUR = 18;

export function nudgeLevelFor(waitingMs: number): NudgeLevelRule {
  let rule = NUDGE_LEVELS[0];
  for (const info of NUDGE_LEVELS) {
    if (waitingMs >= info.afterMs) rule = info;
  }
  return rule;
}

/** Wall-clock hour in Vietnam, 0-23, regardless of server timezone. */
export function vnHour(date: Date): number {
  return Number(formatVN(date, "H"));
}

export function isWithinWorkHours(date: Date): boolean {
  const hour = vnHour(date);
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

/** The next 07:00 Vietnam time strictly after `date`. */
export function nextWorkStart(date: Date): Date {
  const key = formatVN(date, "yyyy-MM-dd");
  const todayStart = new Date(`${key}T07:00:00+07:00`);
  const day = 24 * 60 * MINUTE_MS;
  return date.getTime() < todayStart.getTime()
    ? todayStart
    : new Date(todayStart.getTime() + day);
}

export function vnDayKey(date: Date): string {
  return formatVN(date, "yyyy-MM-dd");
}
