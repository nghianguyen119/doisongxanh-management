import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, taskEvent } from "@/db/schema";
import { env } from "@/env";
import { OPEN_TASK_STATUSES } from "@/lib/labels";
import { sendReminder } from "@/lib/workflow/notification-service";
import { taskToCard } from "@/lib/workflow/task-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nudge when a task falls due within this window, or is already overdue. */
const DUE_SOON_MS = 2 * 60 * 60 * 1000;
/** Never nudge the same task more often than this. */
const REMIND_EVERY_MS = 12 * 60 * 60 * 1000;

/**
 * Due-date nudges. Point a scheduler (Vercel Cron, GitHub Actions, systemd
 * timer, ...) at this hourly:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/reminders
 *
 * Idempotent: `task.lastRemindedAt` throttles repeats, so running it more
 * often than needed is harmless.
 */
export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const due = await db
    .select({ task, zaloUserId: employee.zaloUserId })
    .from(task)
    .innerJoin(employee, eq(employee.id, task.assigneeId))
    .where(
      and(
        inArray(task.status, OPEN_TASK_STATUSES),
        isNotNull(task.dueAt),
        lt(task.dueAt, new Date(now + DUE_SOON_MS)),
        isNotNull(employee.zaloUserId),
        eq(employee.status, "active"),
        // Never reminded yet, or not since the throttle window.
        or(
          isNull(task.lastRemindedAt),
          lt(task.lastRemindedAt, new Date(now - REMIND_EVERY_MS)),
        ),
      ),
    )
    .limit(200);

  let sent = 0;
  for (const row of due) {
    const overdue = !!row.task.dueAt && row.task.dueAt.getTime() < now;
    const res = await sendReminder(
      taskToCard(row.task),
      row.zaloUserId!,
      overdue,
    );

    // Record the outcome either way: a failed reminder keeps the task in the
    // candidate set, so the manager must be able to see it is not reaching
    // the employee.
    await db.insert(taskEvent).values({
      taskId: row.task.id,
      type: "notification",
      actorType: "system",
      payload: {
        kind: "reminder",
        ok: res.ok,
        error: res.ok ? null : res.error,
        overdue,
      },
    });
    if (!res.ok) continue;

    await db
      .update(task)
      .set({ lastRemindedAt: new Date() })
      .where(eq(task.id, row.task.id));
    sent++;
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
