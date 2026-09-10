import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { employeeStatus } from "./enums";
import { user } from "./auth";

/**
 * A field worker. Employees never log into the web portal; their only
 * interface is the company Zalo OA. `zaloUserId` is null until the employee
 * is linked (see src/lib/workflow/employee-linking.ts for the 3 methods).
 */
export const employee = pgTable(
  "employee",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    phone: text(),
    position: text(),
    note: text(),
    status: employeeStatus().notNull().default("invited"),
    zaloUserId: text().unique(),
    zaloDisplayName: text(),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("employee_status_idx").on(t.status)],
);

/**
 * Short-lived code an employee sends to the OA to link their Zalo account
 * to an `employee` row.
 */
export const employeeInvite = pgTable(
  "employee_invite",
  {
    id: uuid().primaryKey().defaultRandom(),
    employeeId: uuid()
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    code: text().notNull().unique(),
    expiresAt: timestamp().notNull(),
    consumedAt: timestamp(),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("employee_invite_code_idx").on(t.code)],
);

export const employeeRelations = relations(employee, ({ many }) => ({
  invites: many(employeeInvite),
}));

export const employeeInviteRelations = relations(employeeInvite, ({ one }) => ({
  employee: one(employee, {
    fields: [employeeInvite.employeeId],
    references: [employee.id],
  }),
}));
