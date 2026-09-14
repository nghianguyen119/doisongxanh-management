import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { employee, task } from "@/db/schema";
import { env } from "@/env";
import { OPEN_TASK_STATUSES, taskRef } from "@/lib/labels";
import { notifyMobileTask } from "@/lib/mobile/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-push an unacknowledged alert roughly every 2 minutes. */
const REPEAT_MS = 2 * 60 * 1000;
/** Stop after ~10 attempts so a dead device cannot alert forever. */
const MAX_ATTEMPTS = 10;

/**
 * Loud-alert escalation for the employee app. The app repeats the alarm
 * locally, but a killed app cannot — this endpoint re-sends the push until
 * the employee presses «Đã nhận» (`POST /api/mobile/ack`, which clears
 * `alertDeliveryId`).
 *
 * Point a scheduler at it every minute or two:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/mobile-alerts
 *
 * Idempotent: `lastAlertAt` + `alertAttempts` throttle and cap repeats.
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

  const now = new Date();
  const due = await db
    .select({ task, employee })
    .from(task)
    .innerJoin(employee, eq(employee.id, task.assigneeId))
    .where(
      and(
        isNotNull(task.alertDeliveryId),
        isNull(task.acknowledgedAt),
        inArray(task.status, OPEN_TASK_STATUSES),
        lt(task.alertAttempts, MAX_ATTEMPTS),
        or(
          isNull(task.lastAlertAt),
          lt(task.lastAlertAt, new Date(now.getTime() - REPEAT_MS)),
        ),
        eq(employee.status, "active"),
      ),
    )
    .limit(200);

  let sent = 0;
  for (const row of due) {
    const attempts = row.task.alertAttempts + 1;
    const res = await notifyMobileTask({
      employeeId: row.employee.id,
      kind: "task_alert",
      task: {
        id: row.task.id,
        ref: taskRef(row.task.refNo),
        title: row.task.title,
        dueAt: row.task.dueAt,
      },
      deliveryId: row.task.alertDeliveryId as string,
      // The assignment already put an alert row in the inbox.
      inbox: false,
    });
    if (!res.ok) continue;

    await db
      .update(task)
      .set({
        alertAttempts: attempts,
        escalationLevel: attempts,
        lastAlertAt: new Date(),
      })
      .where(eq(task.id, row.task.id));
    sent++;
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent });
}
