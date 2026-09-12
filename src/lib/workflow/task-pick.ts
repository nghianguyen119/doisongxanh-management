/**
 * Pure helpers for the multi-task conversation picker: when an employee has
 * several open tasks, free-form messages are answered with a button menu and
 * the employee taps the task. A numbered reply still works as a fallback for
 * old messages. Kept free of DB/Zalo imports so the parsing, ordering and
 * paging rules are unit-testable.
 */

/**
 * Three per page leaves room for a "Xem thêm" button in the same Zalo message
 * (CS messages allow at most 4-5 buttons).
 */
export const TASK_PICK_PAGE_SIZE = 3;

/** 1-based selection, accepts "2", "số 2" or "so 2". Null if out of range. */
export function parseTaskPick(text: string, optionCount: number): number | null {
  const match = /^(?:số\s*|so\s*)?(\d{1,2})$/.exec(text.trim().toLowerCase());
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= optionCount ? n : null;
}

/** Due date first (soonest, no-deadline last), then longest-waiting task. */
export function sortOpenTasks<
  T extends { dueAt: Date | null; assignedAt: Date | null },
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueAt?.getTime();
    const bd = b.dueAt?.getTime();
    if (ad !== bd) {
      if (ad === undefined) return 1; // undated tasks go last
      if (bd === undefined) return -1;
      return ad - bd;
    }
    return (a.assignedAt?.getTime() ?? 0) - (b.assignedAt?.getTime() ?? 0);
  });
}

export function pickPage<T>(
  tasks: T[],
  page: number,
  size = TASK_PICK_PAGE_SIZE,
) {
  const total = tasks.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * size;
  return {
    slice: tasks.slice(start, start + size),
    page: safePage,
    total,
    hasMore: safePage < pageCount - 1,
  };
}
