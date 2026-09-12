import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { employee, task, zaloConversation } from "@/db/schema";
import { OPEN_TASK_STATUSES, taskRef } from "@/lib/labels";
import { getZaloClient } from "@/lib/zalo/factory";
import { preview } from "@/lib/zalo/log";
import { BUTTON_PAYLOAD, COMMAND_PAYLOAD } from "@/lib/zalo/types";
import { BTN, copy, taskNoticeText, type TaskLabelInput } from "./bot-copy";
import * as clients from "./client-conversation";
import * as linking from "./employee-linking";
import { parseTaskPick, pickPage, sortOpenTasks } from "./task-pick";
import * as tasks from "./task-service";
import type { TaskResult } from "./task-service";
import * as notify from "./notification-service";
import { onboardEmployee } from "./onboarding";
import { ACTION_TARGET_STATUS, isClosed } from "./task-status";

/**
 * A half-finished flow ("we asked for an issue description") is abandoned
 * after this long. Without it an employee who taps "Báo sự cố" and then
 * wanders off stays stuck forever: every later message would be swallowed as
 * an issue note.
 */
const STATE_TTL_MS = 30 * 60 * 1000;

/**
 * Identical button payloads arriving inside this window are the same physical
 * tap retried on a slow connection; only the first one is handled.
 */
const TAP_DEDUPE_MS = 10 * 1000;

/** The de-dupe marker stored in the conversation context. */
type TapMark = { lastTap: string; lastTapAt: number };

type EmployeeRow = typeof employee.$inferSelect;
type ConvRow = typeof zaloConversation.$inferSelect;
type TaskRow = typeof task.$inferSelect;

/** Conversation context: in-flight flow task + the sticky "current task". */
type ConvContext = {
  taskId?: string;
  /** Where the next free-form message goes; null once the task is gone. */
  activeTaskId?: string | null;
  /** Last button tap (`<action>:<taskId>`) and when it was handled. */
  lastTap?: string;
  lastTapAt?: number;
  /** The numbered list the employee is choosing from. */
  pick?: {
    options: string[];
    page: number;
    text?: string;
    urls?: string[];
  };
};

const LIST_COMMANDS = [
  "ds",
  "danh sách",
  "danh sach",
  "ds việc",
  "ds viec",
  "đổi việc",
  "doi viec",
  "chọn việc",
  "chon viec",
];

function isListCommand(text: string) {
  return LIST_COMMANDS.includes(text.trim().toLowerCase());
}

/** Dedupe key for list/menu taps; "Xem thêm" sends the plain "ds" payload. */
const LIST_TAP_KEY = "cmd:list";

async function say(zaloUserId: string, text: string) {
  await getZaloClient().sendText(zaloUserId, text);
}

async function findEmployee(zaloUserId: string): Promise<EmployeeRow | null> {
  return (
    (await db.query.employee.findFirst({
      where: eq(employee.zaloUserId, zaloUserId),
    })) ?? null
  );
}

/** `DSX-12 · Tưới cây sảnh` for messages that name a task. */
function taskLabel(t: TaskRow): TaskLabelInput {
  return { ref: taskRef(t.refNo), title: t.title };
}

/** Plain-text form of the same label, for the fallback copy functions. */
function namedRow(t: TaskRow): string {
  return `${taskRef(t.refNo)} · ${t.title}`;
}

/** Reads the conversation cursor, treating a stale in-flight state as idle. */
async function getConversation(zaloUserId: string): Promise<ConvRow> {
  const [row] = await db
    .insert(zaloConversation)
    .values({ zaloUserId })
    .onConflictDoUpdate({
      // No-op update so the row always comes back, new or existing.
      target: zaloConversation.zaloUserId,
      set: { zaloUserId },
    })
    .returning();

  const expired =
    row.state !== "idle" &&
    Date.now() - row.updatedAt.getTime() > STATE_TTL_MS;

  if (expired) {
    await setState(zaloUserId, "idle");
    return { ...row, state: "idle", context: {} };
  }
  return row;
}

async function setState(
  zaloUserId: string,
  state: ConvRow["state"],
  context: Record<string, unknown> = {},
) {
  console.log(
    `[zalo:state] user=${zaloUserId} -> ${state}${
      Object.keys(context).length ? ` ctx=${preview(context)}` : ""
    }`,
  );
  await db
    .insert(zaloConversation)
    .values({ zaloUserId, state, context })
    .onConflictDoUpdate({
      target: zaloConversation.zaloUserId,
      set: { state, context, turn: 0, updatedAt: new Date() },
    });
}

async function openTasksFor(employeeId: string) {
  return db.query.task.findMany({
    where: and(
      eq(task.assigneeId, employeeId),
      inArray(task.status, OPEN_TASK_STATUSES),
    ),
    orderBy: desc(task.assignedAt),
  });
}

/** Tasks in the order the picker lists them: most urgent first. */
async function sortedOpenTasks(employeeId: string) {
  return sortOpenTasks(await openTasksFor(employeeId));
}

/** A task that is still open and still assigned to this employee. */
async function findOpenAssigned(
  employeeId: string,
  taskId: string,
): Promise<TaskRow | null> {
  const t = await tasks.getTask(taskId);
  if (!t || t.assigneeId !== employeeId) return null;
  return OPEN_TASK_STATUSES.includes(t.status) ? t : null;
}

/**
 * Atomically claims a button tap (`<action>:<taskId>`) in the conversation
 * context. Returns false when the same tap was already handled inside the
 * window, so concurrent deliveries of one physical tap — or a flurry of taps
 * on a slow connection — are processed once. `setState()` replaces the whole
 * context, so the caller must re-write the claim afterwards.
 */
async function claimTap(
  zaloUserId: string,
  tapKey: string,
  now: number,
): Promise<boolean> {
  const since = now - TAP_DEDUPE_MS;
  const result = await db.execute(sql`
    insert into zalo_conversation (zalo_user_id, context)
    values (
      ${zaloUserId},
      jsonb_build_object('lastTap', ${tapKey}::text, 'lastTapAt', ${now}::bigint)
    )
    on conflict (zalo_user_id) do update
      set context = zalo_conversation.context
            || jsonb_build_object('lastTap', ${tapKey}::text, 'lastTapAt', ${now}::bigint),
          updated_at = now()
      where zalo_conversation.context->>'lastTap' is distinct from ${tapKey}
         or coalesce((zalo_conversation.context->>'lastTapAt')::bigint, 0) < ${since}
    returning zalo_user_id
  `);
  return (result.rowCount ?? 0) > 0;
}

/** Patches the conversation context without touching its state. */
async function mergeContext(
  zaloUserId: string,
  patch: Record<string, unknown>,
) {
  const conv = await db.query.zaloConversation.findFirst({
    where: eq(zaloConversation.zaloUserId, zaloUserId),
  });
  const context = { ...((conv?.context ?? {}) as ConvContext), ...patch };
  await db
    .insert(zaloConversation)
    .values({ zaloUserId, context })
    .onConflictDoUpdate({
      target: zaloConversation.zaloUserId,
      set: { context, updatedAt: new Date() },
    });
}

/**
 * Runs a button/command reply at most once per dedupe window. Zalo delivers a
 * rapid burst of taps on "Xem thêm" / "Việc của tôi" as a burst of identical
 * messages; without this each tap answers with another full menu.
 */
async function oncePerTap(
  zaloUserId: string,
  tapKey: string,
  run: (tap: TapMark) => Promise<unknown>,
) {
  const now = Date.now();
  if (!(await claimTap(zaloUserId, tapKey, now))) {
    console.log(`[zalo:task] tap=${tapKey} duplicate tap -> ignored`);
    return;
  }
  const tap: TapMark = { lastTap: tapKey, lastTapAt: now };
  try {
    await run(tap);
  } finally {
    // setState() replaces the context, so re-write the claim afterwards; a
    // failure here must not swallow the action's reply.
    try {
      await mergeContext(zaloUserId, tap);
    } catch (err) {
      console.error("[zalo:task] failed to record tap de-dup", err);
    }
  }
}

/** Records a free-form text/photo against a task, naming it in the ack. */
async function applyFreeMessage(
  zaloUserId: string,
  emp: EmployeeRow,
  target: TaskRow,
  content: { text?: string; urls?: string[] },
) {
  const text = content.text ?? "[hình ảnh]";
  console.log(
    `[zalo:task] free update task=${target.id} from=${emp.id} ` +
      `text="${preview(text)}" files=${content.urls?.length ?? 0}`,
  );
  await tasks.addEmployeeComment({
    taskId: target.id,
    employeeId: emp.id,
    text,
    attachmentUrls: content.urls,
  });
  await mergeContext(zaloUserId, { activeTaskId: target.id });
  return say(
    zaloUserId,
    taskNoticeText(taskLabel(target), { heading: copy.commentAckHeading }),
  );
}

/**
 * Makes `target` the active task, shows its full card (same buttons as an
 * assignment) and records any note/photo sent before the choice.
 */
async function selectTask(
  zaloUserId: string,
  emp: EmployeeRow,
  target: TaskRow,
  parked: { text?: string; urls?: string[] },
  tap?: TapMark,
) {
  await setState(zaloUserId, "idle", { activeTaskId: target.id, ...(tap ?? {}) });
  await notify.sendPickedCard(tasks.taskToCard(target), zaloUserId);
  if (parked.text || parked.urls?.length) {
    return applyFreeMessage(zaloUserId, emp, target, parked);
  }
}

/** Sends the task menu and parks the message until a choice arrives. */
async function askTaskPick(
  zaloUserId: string,
  employeeId: string,
  open: TaskRow[],
  page: number,
  pending: { text?: string; urls?: string[] },
) {
  const { slice, page: safePage, total, hasMore } = pickPage(open, page);
  await setState(zaloUserId, "awaiting_task_pick", {
    pick: {
      options: slice.map((t) => t.id),
      page: safePage,
      ...pending,
    },
  });
  // Buttons, not a numbered list: one tap picks the task, and "Xem thêm" pages
  // on with the same "ds" command that typing used to require.
  const buttons = slice.map((t) => BTN.pick(t.id, t.title, taskRef(t.refNo)));
  if (hasMore) buttons.push(BTN.more());
  await getZaloClient().sendButtons(
    zaloUserId,
    copy.pickMenu(total),
    buttons,
  );
}

/** "ds" / "đổi việc": show the list, or route to the only task there is. */
async function listOpenTasks(
  zaloUserId: string,
  employeeId: string,
  page: number,
  pending: { text?: string; urls?: string[] },
) {
  const open = await sortedOpenTasks(employeeId);
  if (open.length === 0) return say(zaloUserId, copy.noActiveTask);
  if (open.length === 1) {
    await mergeContext(zaloUserId, { activeTaskId: open[0].id });
    return say(
      zaloUserId,
      taskNoticeText(taskLabel(open[0]), {
        heading: copy.oneTaskHeading,
        closing: copy.oneTaskClosing,
      }),
    );
  }
  return askTaskPick(zaloUserId, employeeId, open, page, pending);
}

/**
 * Turns a rejected mutation into something the employee can understand. The
 * service already sent the happy-path acknowledgement.
 */
async function reportFailure(zaloUserId: string, res: TaskResult) {
  if (res.ok) return;
  console.log(
    `[zalo:task] rejected from=${zaloUserId} reason=${res.reason} task=${res.task?.id ?? "?"}`,
  );
  await say(
    zaloUserId,
    res.reason === "not_found"
      ? copy.noActiveTask
      : copy.taskClosed(res.task ? namedRow(res.task) : undefined),
  );
}

/**
 * Same idea, but for Zalo button actions where a duplicate tap is expected.
 * A lost race with the tap that succeeded must not produce a reply — the
 * employee already got the acknowledgement for it.
 */
async function reportActionFailure(
  zaloUserId: string,
  action: string,
  res: TaskResult,
) {
  if (res.ok) return;
  const status = res.task?.status;
  if (status && status === ACTION_TARGET_STATUS[action]) {
    console.log(
      `[zalo:task] action=${action} task=${res.task?.id ?? "?"} lost race, already ${status} -> no reply`,
    );
    return;
  }
  console.log(
    `[zalo:task] action=${action} rejected from=${zaloUserId} reason=${res.reason} task=${res.task?.id ?? "?"} status=${status ?? "?"}`,
  );
  if (res.reason === "not_found") return say(zaloUserId, copy.noActiveTask);
  if (status && isClosed(status)) {
    return say(
      zaloUserId,
      copy.taskClosed(res.task ? namedRow(res.task) : undefined),
    );
  }
  return say(
    zaloUserId,
    copy.taskStateChanged(res.task ? namedRow(res.task) : undefined),
  );
}

// ---------------------------------------------------------------------------
// Entry points (called by dispatch.ts)
// ---------------------------------------------------------------------------

export async function handleInboundText(zaloUserId: string, text: string) {
  // Linked employee vs anyone else (customer) is decided by the employee
  // lookup only. An unlinked user must never be assumed to be an employee.
  const emp = await findEmployee(zaloUserId);
  if (!emp) return handleUnlinkedText(zaloUserId, text);

  const button = BUTTON_PAYLOAD.decode(text);
  if (button) return handleTaskAction(zaloUserId, button.action, button.taskId);

  // The "Việc của tôi" button works from any state, so it must never be
  // swallowed as an issue description or completion note.
  if (text.trim() === COMMAND_PAYLOAD.myTasks) {
    return oncePerTap(zaloUserId, COMMAND_PAYLOAD.myTasks, () =>
      listOpenTasks(zaloUserId, emp.id, 0, {}),
    );
  }

  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as ConvContext;

  switch (conv.state) {
    case "awaiting_task_pick":
      return handlePickReply(zaloUserId, emp, text, ctx);

    case "awaiting_issue_text": {
      if (!ctx.taskId) break;
      console.log(
        `[zalo:task] issue report task=${ctx.taskId} from=${emp.id} text="${preview(text)}"`,
      );
      const res = await tasks.reportIssue({
        taskId: ctx.taskId,
        employeeId: emp.id,
        text,
      });
      await setState(zaloUserId, "idle");
      return reportFailure(zaloUserId, res);
    }
  }

  return handleIdleText(zaloUserId, emp, text);
}

export async function handleInboundImage(zaloUserId: string, urls: string[]) {
  const emp = await findEmployee(zaloUserId);
  if (!emp) return clients.handleClientImage(zaloUserId, urls);

  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as ConvContext;

  if (conv.state === "awaiting_issue_text" && ctx.taskId) {
    // Photo first, description still to come — attach it to the issue.
    console.log(
      `[zalo:task] issue photo task=${ctx.taskId} from=${emp.id} files=${urls.length}`,
    );
    const res = await tasks.reportIssue({
      taskId: ctx.taskId,
      employeeId: emp.id,
      text: "[hình ảnh sự cố]",
      attachmentUrls: urls,
    });
    await setState(zaloUserId, "idle");
    return reportFailure(zaloUserId, res);
  }

  if (conv.state === "awaiting_task_pick" && ctx.pick) {
    // More photos while choosing: keep them with the pending content so the
    // pick applies everything at once.
    await mergeContext(zaloUserId, {
      pick: { ...ctx.pick, urls: [...(ctx.pick.urls ?? []), ...urls] },
    });
    return say(zaloUserId, copy.taskPickImageHeld);
  }

  if (ctx.activeTaskId) {
    const active = await findOpenAssigned(emp.id, ctx.activeTaskId);
    if (active) return applyFreeMessage(zaloUserId, emp, active, { urls });
    await mergeContext(zaloUserId, { activeTaskId: null });
  }

  const open = await sortedOpenTasks(emp.id);
  if (open.length === 0) return say(zaloUserId, copy.noActiveTask);
  if (open.length === 1) {
    return applyFreeMessage(zaloUserId, emp, open[0], { urls });
  }
  return askTaskPick(zaloUserId, emp.id, open, 0, { urls });
}

export async function handleFollow(zaloUserId: string) {
  const emp = await findEmployee(zaloUserId);
  if (emp) {
    // Following the OA again does not undo a manager's decision to disable
    // the account; only an explicit re-activation in the portal does.
    if (emp.status === "inactive") {
      console.log(
        `[zalo:link] follow from=${zaloUserId} employee=${emp.id} inactive -> notice`,
      );
      return say(zaloUserId, copy.accountInactive);
    }
    console.log(
      `[zalo:link] follow from=${zaloUserId} employee=${emp.id} already linked`,
    );
    return say(zaloUserId, copy.help);
  }
  console.log(`[zalo:link] follow from=${zaloUserId} unlinked -> greeting`);
  return say(zaloUserId, copy.followGreeting);
}

export async function handleUnfollow(zaloUserId: string) {
  const emp = await findEmployee(zaloUserId);
  if (emp) {
    console.log(
      `[zalo:link] unfollow from=${zaloUserId} employee=${emp.id} -> inactive`,
    );
    await db
      .update(employee)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(employee.id, emp.id));
  } else {
    console.log(`[zalo:link] unfollow from=${zaloUserId} (no linked employee)`);
  }
}

export async function handleUserInfo(
  zaloUserId: string,
  info: { name?: string; phone?: string },
) {
  if (await findEmployee(zaloUserId)) {
    console.log(`[zalo:link] user_info from=${zaloUserId} already linked, ignored`);
    return;
  }
  // Sharing contact details no longer links an account: the invite code is
  // the only self-service signal, so treat this as a customer reaching out.
  return clients.handleClientInfo(zaloUserId, info);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function handleTaskAction(
  zaloUserId: string,
  action: string,
  taskId: string,
) {
  const emp = await findEmployee(zaloUserId);
  if (!emp) {
    // Unreachable from handleInboundText (unlinked text goes to the client
    // flow); keep it defensive for a stale call.
    console.log(
      `[zalo:task] action=${action} from=${zaloUserId} not linked -> ignored`,
    );
    return;
  }

  // Retries of the same tap on a slow connection: claim it atomically so a
  // burst — or concurrent deliveries — is handled once.
  const tapKey = `${action}:${taskId}`;
  return oncePerTap(zaloUserId, tapKey, (tap) =>
    dispatchTaskAction(zaloUserId, emp, action, taskId, tap),
  );
}

async function dispatchTaskAction(
  zaloUserId: string,
  emp: EmployeeRow,
  action: string,
  taskId: string,
  tap: TapMark,
) {
  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as ConvContext;

  const t = await db.query.task.findFirst({ where: eq(task.id, taskId) });
  if (!t) {
    console.log(`[zalo:task] action=${action} task=${taskId} not found`);
    return say(zaloUserId, copy.noActiveTask);
  }
  if (t.assigneeId !== emp.id) {
    console.log(
      `[zalo:task] action=${action} task=${taskId} not assigned to employee=${emp.id}`,
    );
    return say(zaloUserId, copy.taskNotYours);
  }

  // Zalo buttons live in the chat forever; refuse taps on a finished task
  // rather than resurrecting it.
  if (isClosed(t.status)) {
    console.log(
      `[zalo:task] action=${action} task=${taskId} ignored: closed (${t.status})`,
    );
    return say(zaloUserId, copy.taskClosed(namedRow(t)));
  }

  // The action already took effect (a delayed duplicate tap): the first tap
  // was acknowledged, so answering again would only spam the chat.
  const target = ACTION_TARGET_STATUS[action];
  if (target && t.status === target) {
    console.log(
      `[zalo:task] action=${action} task=${taskId} already ${t.status} -> ignored`,
    );
    return;
  }

  console.log(
    `[zalo:task] action=${action} task=${taskId} employee=${emp.id} status=${t.status}`,
  );

  switch (action) {
    case "start": {
      const res = await tasks.startTask({ taskId, employeeId: emp.id });
      if (res.ok) await mergeContext(zaloUserId, { activeTaskId: taskId });
      return reportActionFailure(zaloUserId, action, res);
    }
    case "done": {
      // Photos/notes are sent before this tap and stored as comments; the
      // completion itself needs no follow-up question. Clear any half-finished
      // flow so the next message cannot be mistaken for it.
      const res = await tasks.completeTask({ taskId, employeeId: emp.id });
      if (res.ok) {
        await setState(zaloUserId, "idle", { activeTaskId: taskId, ...tap });
      }
      return reportActionFailure(zaloUserId, action, res);
    }
    case "issue":
      await setState(zaloUserId, "awaiting_issue_text", {
        taskId,
        activeTaskId: taskId,
        ...tap,
      });
      return say(
        zaloUserId,
        taskNoticeText(taskLabel(t), {
          heading: copy.issueHeading,
          closing: copy.issueClosing,
        }),
      );
    case "pick":
      // Menu tap: switch the active task and show its full card.
      return selectTask(
        zaloUserId,
        emp,
        t,
        { text: ctx.pick?.text, urls: ctx.pick?.urls },
        tap,
      );
    case "progress":
      // Make this task the active one; the next note/photo is the report.
      await setState(zaloUserId, "idle", { activeTaskId: taskId, ...tap });
      return say(
        zaloUserId,
        taskNoticeText(taskLabel(t), {
          heading: copy.progressHeading,
          closing: copy.progressClosing,
        }),
      );
    default:
      return say(zaloUserId, copy.help);
  }
}

async function handleUnlinkedText(zaloUserId: string, text: string) {
  // The only thing that turns an unknown Zalo user into an employee is an
  // invite code. Scan the whole message for one, so "mã của tôi là BCDF"
  // works too; everything else is a customer message.
  const code = linking.parseInviteCode(text);
  if (!code) return clients.handleClientText(zaloUserId, text);

  const res = await linking.linkByInviteCode(zaloUserId, code);
  console.log(
    `[zalo:link] code attempt from=${zaloUserId} code=${code} -> ${
      res.ok ? `linked employee=${res.employeeId}` : `failed (${res.reason})`
    }`,
  );
  if (res.ok) {
    await setState(zaloUserId, "idle");
    await say(zaloUserId, copy.linkSuccess(res.name));
    await onboardEmployee(res.employeeId);
    return;
  }
  return say(
    zaloUserId,
    res.reason === "already_linked"
      ? copy.alreadyLinked
      : res.reason === "inactive"
        ? copy.accountInactive
        : copy.linkNotFound,
  );
}

/**
 * Free text with no flow in progress: route it to the sticky task, to the
 * only open task, or ask which task when several are open.
 */
async function handleIdleText(
  zaloUserId: string,
  emp: EmployeeRow,
  text: string,
) {
  if (isListCommand(text)) {
    return oncePerTap(zaloUserId, LIST_TAP_KEY, () =>
      listOpenTasks(zaloUserId, emp.id, 0, {}),
    );
  }

  const conv = await getConversation(zaloUserId);
  const ctx = conv.context as ConvContext;

  if (ctx.activeTaskId) {
    const active = await findOpenAssigned(emp.id, ctx.activeTaskId);
    if (active) return applyFreeMessage(zaloUserId, emp, active, { text });
    await mergeContext(zaloUserId, { activeTaskId: null });
  }

  const open = await sortedOpenTasks(emp.id);
  if (open.length === 0) {
    console.log(`[zalo:task] text from=${emp.id} with no open task`);
    return say(zaloUserId, copy.noActiveTask);
  }
  if (open.length === 1) {
    return applyFreeMessage(zaloUserId, emp, open[0], { text });
  }
  return askTaskPick(zaloUserId, emp.id, open, 0, { text });
}

/**
 * Answer to the menu message: a number applies the parked content (or just
 * switches the sticky task), `ds` pages on, anything else is kept as content.
 */
async function handlePickReply(
  zaloUserId: string,
  emp: EmployeeRow,
  text: string,
  ctx: ConvContext,
) {
  const pick = ctx.pick;
  if (!pick) {
    await setState(zaloUserId, "idle");
    return handleIdleText(zaloUserId, emp, text);
  }

  if (isListCommand(text)) {
    return oncePerTap(zaloUserId, LIST_TAP_KEY, () =>
      listOpenTasks(zaloUserId, emp.id, pick.page + 1, {
        text: pick.text,
        urls: pick.urls,
      }),
    );
  }

  const choice = parseTaskPick(text, pick.options.length);
  if (!choice) {
    console.log(
      `[zalo:task] pick from=${emp.id} not a number: "${preview(text)}"`,
    );
    const parked = [pick.text, text].filter(Boolean).join("\n");
    await mergeContext(zaloUserId, { pick: { ...pick, text: parked } });
    return say(zaloUserId, copy.taskPickInvalid);
  }

  const target = await findOpenAssigned(emp.id, pick.options[choice - 1]);
  if (!target) {
    // The list is stale (task verified/reassigned while waiting): rebuild it.
    console.log(
      `[zalo:task] pick from=${emp.id} option ${choice} no longer open`,
    );
    const open = await sortedOpenTasks(emp.id);
    if (open.length === 0) {
      await setState(zaloUserId, "idle");
      return say(zaloUserId, copy.noActiveTask);
    }
    if (open.length === 1) {
      return applyFreeMessage(zaloUserId, emp, open[0], {
        text: pick.text,
        urls: pick.urls,
      });
    }
    return askTaskPick(zaloUserId, emp.id, open, 0, {
      text: pick.text,
      urls: pick.urls,
    });
  }

  return selectTask(zaloUserId, emp, target, {
    text: pick.text,
    urls: pick.urls,
  });
}
