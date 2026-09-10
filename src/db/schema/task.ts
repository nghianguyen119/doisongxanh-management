import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    title: text().notNull(),
    description: text(),
    status: taskStatus().notNull().default("new"),
    priority: taskPriority().notNull().default("normal"),
    assigneeId: uuid().references(() => employee.id, { onDelete: "set null" }),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    dueAt: timestamp(),
    assignedAt: timestamp(),
    completedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index("task_status_idx").on(t.status),
    index("task_assignee_idx").on(t.assigneeId),
    index("task_due_idx").on(t.dueAt),
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
    createdAt: timestamp().notNull().defaultNow(),
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
    createdAt: timestamp().notNull().defaultNow(),
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
