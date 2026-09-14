import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, taskEvent } from "@/db/schema";
import { env } from "@/env";
import { OPEN_TASK_STATUSES, taskRef } from "@/lib/labels";
import { notifyMobileTask } from "@/lib/mobile/notify";
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
 * Delivers through whichever channel the employee actually uses: Zalo when
 * linked, and/or the Android app's devices. Idempotent: `task.lastRemindedAt`
 * throttles repeats, so running it more often than needed is harmless.
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
    .select({ task, employee })
    .from(task)
    .innerJoin(employee, eq(employee.id, task.assigneeId))
    .where(
      and(
        inArray(task.status, OPEN_TASK_STATUSES),
        isNotNull(task.dueAt),
        lt(task.dueAt, new Date(now + DUE_SOON_MS)),
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
    const card = taskToCard(row.task);

    // Zalo channel: only when the employee linked their Zalo account.
    const zalo = row.employee.zaloUserId
      ? await sendReminder(card, row.employee.zaloUserId, overdue)
      : ({ ok: false as const, error: "not_linked" });

    // Android app channel: urgent overdue work joins the loud-alert chain;
    // everything else is a normal one-shot reminder.
    const loud =
      overdue && row.task.priority === "urgent" && row.task.alertDeliveryId;
    const mobile = await notifyMobileTask({
      employeeId: row.employee.id,
      kind: loud ? "task_alert" : "task_reminder",
      task: {
        id: row.task.id,
        ref: taskRef(row.task.refNo),
        title: row.task.title,
        dueAt: row.task.dueAt,
      },
      deliveryId: loud ? (row.task.alertDeliveryId as string) : undefined,
    });

    // Record the outcome either way: a failed reminder keeps the task in the
    // candidate set, so the manager must be able to see it is not reaching
    // the employee. A logging failure must not abort the remaining reminders.
    try {
      await db.insert(taskEvent).values({
        taskId: row.task.id,
        type: "notification",
        actorType: "system",
        payload: {
          kind: "reminder",
          ok: zalo.ok,
          error: zalo.ok ? null : zalo.error,
          overdue,
          mobile: { ok: mobile.ok, error: mobile.ok ? null : mobile.error },
        },
      });
    } catch (err) {
      console.error("[reminders] failed to record delivery outcome", err);
    }
    if (!zalo.ok && !mobile.ok) continue;

    await db
      .update(task)
      .set({ lastRemindedAt: new Date() })
      .where(eq(task.id, row.task.id));
    sent++;
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
