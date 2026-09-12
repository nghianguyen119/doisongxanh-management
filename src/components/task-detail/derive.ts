import type { taskEvent } from "@/db/schema";
import type { getTaskDetail } from "@/lib/queries";
import type { TaskStatus } from "@/lib/workflow/task-status";

export type TaskEventRow = typeof taskEvent.$inferSelect;
export type TaskRow = NonNullable<
  Awaited<ReturnType<typeof getTaskDetail>>
>["task"];

/** Shapes of the `task_event.payload` JSONB the UI reads back. */
export type TaskEventPayload = {
  text?: string;
  to?: string;
  note?: string;
  reason?: string;
  kind?: string;
  ok?: boolean;
  error?: string | null;
  fields?: string[];
  assigneeId?: string;
  overdue?: boolean;
  manual?: boolean;
};

export function eventPayload(event: TaskEventRow): TaskEventPayload {
  return (event.payload ?? {}) as TaskEventPayload;
}

/** First `status_changed` event that moved the task into `to`. */
export function firstStatusEvent(
  events: TaskEventRow[],
  to: TaskStatus,
): TaskEventRow | undefined {
  return events.find(
    (event) => event.type === "status_changed" && eventPayload(event).to === to,
  );
}

export function lastEventOfType(
  events: TaskEventRow[],
  type: TaskEventRow["type"],
): TaskEventRow | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) return events[i];
  }
  return undefined;
}

export type LifecycleStage = "assigned" | "in_progress" | "done" | "verified";

export type LifecycleStep = {
  stage: LifecycleStage;
  /** When the task entered the stage, if that is knowable from real data. */
  at: Date | null;
  /** A stage the task has already passed through. */
  reached: boolean;
  current: boolean;
  /** `blocked` is an interruption that hangs off the in-progress step. */
  blocked: boolean;
};

export type TaskLifecycle = {
  steps: LifecycleStep[];
  currentIndex: number | null;
  doneAt: Date | null;
  verifiedAt: Date | null;
  cancelledAt: Date | null;
  verifiedEvent: TaskEventRow | null;
  cancelledEvent: TaskEventRow | null;
};

const STAGES: LifecycleStage[] = ["assigned", "in_progress", "done", "verified"];

/**
 * Reads the lifecycle straight from the row plus its event log. Nothing here
 * is inferred beyond what the data can prove: a stage without a timestamp is
 * shown as unknown instead of being back-filled from a neighbouring stage.
 */
export function buildLifecycle(
  task: TaskRow,
  events: TaskEventRow[],
): TaskLifecycle {
  const inProgressAt =
    firstStatusEvent(events, "in_progress")?.createdAt ?? null;
  const doneEvent = firstStatusEvent(events, "done");
  const verifiedEvent = firstStatusEvent(events, "verified") ?? null;
  const cancelledEvent = firstStatusEvent(events, "cancelled") ?? null;

  const doneAt = task.completedAt ?? doneEvent?.createdAt ?? null;
  const verifiedAt = verifiedEvent?.createdAt ?? null;
  const cancelledAt = cancelledEvent?.createdAt ?? null;

  const times: Record<LifecycleStage, Date | null> = {
    assigned: task.assignedAt ?? task.createdAt,
    in_progress: inProgressAt,
    done: doneAt,
    verified: verifiedAt,
  };

  const reached: Record<LifecycleStage, boolean> = {
    assigned: true,
    in_progress:
      times.in_progress !== null ||
      task.status === "in_progress" ||
      task.status === "blocked",
    done:
      times.done !== null ||
      task.status === "done" ||
      task.status === "verified",
    verified: times.verified !== null || task.status === "verified",
  };

  const currentIndex =
    task.status === "assigned"
      ? 0
      : task.status === "in_progress" || task.status === "blocked"
        ? 1
        : task.status === "done"
          ? 2
          : task.status === "verified"
            ? 3
            : null;

  return {
    steps: STAGES.map((stage, index) => ({
      stage,
      at: times[stage],
      reached: reached[stage],
      current: currentIndex === index,
      blocked: task.status === "blocked" && stage === "in_progress",
    })),
    currentIndex,
    doneAt,
    verifiedAt,
    cancelledAt,
    verifiedEvent,
    cancelledEvent,
  };
}

export type ActorContext = {
  employeeName: Map<string, string>;
  managerName: Map<string, string>;
  assigneeId: string | null;
  assigneeName: string | null;
};

export function actorLabel(
  actorType: string,
  actorId: string | null,
  ctx: ActorContext,
): string {
  if (actorType === "employee") {
    const known = actorId ? ctx.employeeName.get(actorId) : undefined;
    if (known) return known;
    if (actorId && actorId === ctx.assigneeId && ctx.assigneeName) {
      return ctx.assigneeName;
    }
    return "Nhân viên";
  }
  if (actorType === "manager") {
    const known = actorId ? ctx.managerName.get(actorId) : undefined;
    return known ?? "Quản lý";
  }
  return "Hệ thống";
}
