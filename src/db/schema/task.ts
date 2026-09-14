import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  actorType,
  attachmentKind,
  taskEventType,
  taskPriority,
  taskStatus,
} from "./enums";
import { user } from "./auth";
import { employee } from "./employee";

export const task = pgTable(
  "task",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Human-facing code (`DSX-1`). DB-generated so parallel creates are safe. */
    refNo: serial().notNull(),
    title: text().notNull(),
    description: text(),
    status: taskStatus().notNull().default("assigned"),
    priority: taskPriority().notNull().default("normal"),
    assigneeId: uuid().references(() => employee.id, { onDelete: "set null" }),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    dueAt: timestamp({ withTimezone: true }),
    assignedAt: timestamp({ withTimezone: true }),
    /** When the employee pressed “Bắt đầu” on the mobile app. */
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    /** When a manager verified the completed work (status `verified`). */
    verifiedAt: timestamp({ withTimezone: true }),
    /** Throttles the due-date nudges sent by /api/cron/reminders. */
    lastRemindedAt: timestamp({ withTimezone: true }),
    /**
     * Employee confirmation of the current assignment («Đã nhận»). It is a
     * task field, not a status: work actions stay governed by `status`.
     */
    acknowledgedAt: timestamp({ withTimezone: true }),
    acknowledgedBy: uuid().references(() => employee.id, {
      onDelete: "set null",
    }),
    /**
     * How many times the backend has re-alerted this assignment's active
     * batch. Reset on re-assignment or a material update.
     */
    escalationLevel: integer().notNull().default(0),
    /**
     * Identifier of the current mobile alert batch, sent to the device in the
     * push payload and echoed back on `POST /api/mobile/ack`. Null when no
     * loud alert is active (normal notifications never set it).
     */
    alertDeliveryId: text(),
    /** How many pushes the current alert batch has sent (cap ~10). */
    alertAttempts: integer().notNull().default(0),
    /** Throttles the mobile alert repeat loop (~2 minutes). */
    lastAlertAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("task_status_idx").on(t.status),
    index("task_assignee_idx").on(t.assigneeId),
    index("task_due_idx").on(t.dueAt),
    uniqueIndex("task_ref_no_unique").on(t.refNo),
  ],
);

/**
 * Append-only timeline for a task. Every manager action and every employee
 * reply becomes a row here; the task detail page renders these in order.
 */
export const taskEvent = pgTable(
  "task_event",
  {
    id: uuid().primaryKey().defaultRandom(),
    taskId: uuid()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    type: taskEventType().notNull(),
    actorType: actorType().notNull(),
    /** user.id when actorType=manager, employee.id when actorType=employee */
    actorId: text(),
    /** free-form: { from, to, text, reason, ... } */
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_event_task_idx").on(t.taskId, t.createdAt)],
);

export const taskAttachment = pgTable(
  "task_attachment",
  {
    id: uuid().primaryKey().defaultRandom(),
    taskId: uuid()
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    eventId: uuid().references(() => taskEvent.id, { onDelete: "set null" }),
    kind: attachmentKind().notNull().default("image"),
    url: text().notNull(),
    source: text().notNull().default("zalo"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_attachment_task_idx").on(t.taskId)],
);

export const taskRelations = relations(task, ({ one, many }) => ({
  assignee: one(employee, {
    fields: [task.assigneeId],
    references: [employee.id],
  }),
  events: many(taskEvent),
  attachments: many(taskAttachment),
}));

export const taskEventRelations = relations(taskEvent, ({ one, many }) => ({
  task: one(task, { fields: [taskEvent.taskId], references: [task.id] }),
  attachments: many(taskAttachment),
}));

export const taskAttachmentRelations = relations(taskAttachment, ({ one }) => ({
  task: one(task, { fields: [taskAttachment.taskId], references: [task.id] }),
  event: one(taskEvent, {
    fields: [taskAttachment.eventId],
    references: [taskEvent.id],
  }),
}));
