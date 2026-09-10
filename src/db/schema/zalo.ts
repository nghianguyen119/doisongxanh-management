import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { conversationState, zaloDirection } from "./enums";

/**
 * Single-row store (id = "default") for the OA access/refresh token pair so
 * refreshes survive restarts. See src/lib/zalo/token-manager.ts.
 */
export const zaloOaToken = pgTable("zalo_oa_token", {
  id: text().primaryKey().default("default"),
  accessToken: text().notNull(),
  refreshToken: text().notNull(),
  expiresAt: timestamp().notNull(),
  updatedAt: timestamp().notNull().defaultNow(),
});

/**
 * Raw inbound/outbound message log. Also acts as the outbox for the mock
 * transport (the /settings/zalo simulator reads from here).
 */
export const zaloMessageLog = pgTable(
  "zalo_message_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    direction: zaloDirection().notNull(),
    zaloUserId: text(),
    eventName: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    error: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("zalo_message_log_created_idx").on(t.createdAt)],
);

/**
 * Per-employee conversation cursor for the inbound state machine
 * (src/lib/workflow/conversation.ts). `context` carries e.g. the taskId the
 * employee is currently reporting on.
 */
export const zaloConversation = pgTable("zalo_conversation", {
  zaloUserId: text().primaryKey(),
  state: conversationState().notNull().default("idle"),
  context: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  /** step counter, handy for timeouts / debugging */
  turn: integer().notNull().default(0),
  updatedAt: timestamp().notNull().defaultNow(),
});
