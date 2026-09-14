import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { employee } from "./employee";
import { mobileNotificationKind, mobilePlatform } from "./enums";
import { task } from "./task";

/**
 * Short-lived 6-digit code a manager reads out to an employee so the Android
 * app can pair. Single-use; issuing a new one revokes the previous.
 */
export const mobilePairCode = pgTable(
  "mobile_pair_code",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    code: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mobile_pair_code_employee_idx").on(t.employeeId),
    index("mobile_pair_code_code_idx").on(t.code),
  ],
);

/**
 * A paired phone. The raw bearer token is shown to the device once; only its
 * SHA-256 hash is stored, so a DB leak cannot be replayed against the API.
 */
export const mobileDevice = pgTable(
  "mobile_device",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    deviceName: text(),
    platform: mobilePlatform().notNull().default("android"),
    /** FCM registration token; null until the app registers it. */
    pushToken: text(),
    pushTokenUpdatedAt: timestamp({ withTimezone: true }),
    lastSeenAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mobile_device_token_hash_unique").on(t.tokenHash),
    index("mobile_device_employee_idx").on(t.employeeId),
  ],
);

/**
 * Inbox for the app's header bell (`GET /api/mobile/notifications`). Rows are
 * written whenever the backend notifies the employee; `readAt` powers the
 * unread badge. `kind` mirrors the push `data.kind` categories the app knows.
 */
export const mobileNotification = pgTable(
  "mobile_notification",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    kind: mobileNotificationKind().notNull().default("task"),
    title: text().notNull(),
    body: text().notNull(),
    taskId: uuid().references(() => task.id, { onDelete: "cascade" }),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mobile_notification_employee_idx").on(t.employeeId, t.createdAt),
  ],
);

/**
 * Per-device bookkeeping so the inbox/badge can target a specific phone and
 * a failed send does not block the others.
 */
export const mobileDeviceRelations = relations(mobileDevice, ({ one }) => ({
  employee: one(employee, {
    fields: [mobileDevice.employeeId],
    references: [employee.id],
  }),
}));

export const mobilePairCodeRelations = relations(mobilePairCode, ({ one }) => ({
  employee: one(employee, {
    fields: [mobilePairCode.employeeId],
    references: [employee.id],
  }),
}));

export const mobileNotificationRelations = relations(
  mobileNotification,
  ({ one }) => ({
    employee: one(employee, {
      fields: [mobileNotification.employeeId],
      references: [employee.id],
    }),
    task: one(task, {
      fields: [mobileNotification.taskId],
      references: [task.id],
    }),
  }),
);
