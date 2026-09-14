import { task, taskAttachment, taskEvent } from "@/db/schema";
import { taskRef } from "@/lib/labels";

/**
 * Serializers for the mobile API. Shapes mirror `src/types.ts` in
 * `doisongxanh-app`, which is generated from `docs/api-contract.md` — keep the
 * three in sync.
 */

type TaskRow = typeof task.$inferSelect;
type TaskEventRow = typeof taskEvent.$inferSelect;
type TaskAttachmentRow = typeof taskAttachment.$inferSelect;

export interface MobileTaskSummary {
  id: string;
  ref: string;
  title: string;
  status: TaskRow["status"];
  priority: TaskRow["priority"];
  dueAt: string | null;
  overdue: boolean;
  description: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  completedAt?: string | null;
  verifiedAt?: string | null;
  attachmentCount?: number;
  startedAt?: string | null;
  escalationLevel?: number;
}

export interface MobileTaskEvent {
  id: string;
  type: string;
  actorType: TaskEventRow["actorType"];
  text: string | null;
  createdAt: string;
}

export interface MobileTaskAttachment {
  id: string;
  kind: TaskAttachmentRow["kind"];
  url: string;
  createdAt: string;
}

export interface MobileTaskDetail extends MobileTaskSummary {
  events: MobileTaskEvent[];
  attachments: MobileTaskAttachment[];
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function serializeTaskSummary(
  row: TaskRow,
  attachmentCount = 0,
): MobileTaskSummary {
  return {
    id: row.id,
    ref: taskRef(row.refNo),
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueAt: iso(row.dueAt),
    overdue: row.dueAt !== null && row.dueAt.getTime() < Date.now(),
    description: row.description,
    acknowledged: row.acknowledgedAt !== null,
    acknowledgedAt: iso(row.acknowledgedAt),
    completedAt: iso(row.completedAt),
    verifiedAt: iso(row.verifiedAt),
    attachmentCount,
    startedAt: iso(row.startedAt),
    escalationLevel: row.escalationLevel,
  };
}

export function eventText(row: TaskEventRow): string | null {
  const text = row.payload?.text;
  return typeof text === "string" && text.trim() ? text : null;
}

export function serializeTaskDetail(
  row: TaskRow,
  events: TaskEventRow[],
  attachments: TaskAttachmentRow[],
): MobileTaskDetail {
  return {
    ...serializeTaskSummary(row, attachments.length),
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      actorType: event.actorType,
      text: eventText(event),
      createdAt: event.createdAt.toISOString(),
    })),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      url: attachment.url,
      createdAt: attachment.createdAt.toISOString(),
    })),
  };
}
