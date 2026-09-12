import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowsClockwiseIcon,
  BellIcon,
  ChatCircleIcon,
  ClockIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  UserPlusIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";

import {
  NOTIFICATION_KIND_LABEL,
  TASK_EVENT_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/labels";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  actorLabel,
  eventPayload,
  type ActorContext,
  type TaskEventRow,
} from "./derive";

const FIELD_LABEL: Record<string, string> = {
  title: "tiêu đề",
  description: "mô tả",
  priority: "ưu tiên",
  dueAt: "hạn",
};

function EventIcon({ type }: { type: TaskEventRow["type"] }) {
  const className = "size-3";
  switch (type) {
    case "created":
      return <PlusCircleIcon className={className} />;
    case "updated":
      return <PencilSimpleIcon className={className} />;
    case "assigned":
      return <UserPlusIcon className={className} />;
    case "status_changed":
      return <ArrowsClockwiseIcon className={className} />;
    case "comment":
      return <ChatCircleIcon className={className} />;
    case "issue_reported":
      return <WarningIcon className={className} />;
    case "attachment_added":
      return <PaperclipIcon className={className} />;
    case "reminder_sent":
      return <BellIcon className={className} />;
    case "notification":
      return <PaperPlaneTiltIcon className={className} />;
    default:
      return <ClockIcon className={className} />;
  }
}

/** Activity log: every payload semantic the event table records stays visible. */
export function ActivityTimeline({
  events,
  actorCtx,
}: {
  events: TaskEventRow[];
  actorCtx: ActorContext;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Diễn tiến</h2>
        <span className="text-xs text-muted-foreground">
          {events.length} ghi nhận
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có ghi nhận nào.
        </p>
      ) : (
        <ol className="mt-2 divide-y">
          {events.map((event) => {
            const payload = eventPayload(event);
            const failedNotification =
              event.type === "notification" && payload.ok === false;
            const unassigned =
              event.type === "status_changed" &&
              payload.reason === "unassigned";
            const label = unassigned
              ? "Bỏ giao"
              : TASK_EVENT_LABEL[event.type];
            const assignedName =
              event.type === "assigned" && payload.assigneeId
                ? actorCtx.employeeName.get(payload.assigneeId)
                : undefined;
            const fields = payload.fields
              ?.map((field) => FIELD_LABEL[field])
              .filter(Boolean);

            return (
              <li key={event.id} className="flex gap-3 py-3.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-muted/40",
                    failedNotification
                      ? "border-destructive/20 text-destructive"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <EventIcon type={event.type} />
                </span>

                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0">
                      <span className="font-medium">{label}</span>
                      {payload.to && (
                        <>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">
                            {TASK_STATUS_LABEL[
                              payload.to as keyof typeof TASK_STATUS_LABEL
                            ] ?? payload.to}
                          </span>
                        </>
                      )}
                    </p>
                    <time
                      className="shrink-0 text-xs text-muted-foreground tabular-nums"
                      title={formatVN(event.createdAt)}
                    >
                      {formatDistanceToNow(event.createdAt, {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </time>
                  </div>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {actorLabel(event.actorType, event.actorId, actorCtx)}
                    {assignedName && <> · giao cho {assignedName}</>}
                  </p>

                  {event.type === "notification" && (
                    <div className="mt-1.5 space-y-0.5 text-xs break-words">
                      {payload.kind && (
                        <div className="text-muted-foreground">
                          {NOTIFICATION_KIND_LABEL[
                            payload.kind as keyof typeof NOTIFICATION_KIND_LABEL
                          ] ?? payload.kind}
                        </div>
                      )}
                      <div
                        className={
                          payload.ok
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-destructive"
                        }
                      >
                        {payload.ok
                          ? "Đã gửi Zalo"
                          : `Gửi Zalo thất bại: ${
                              payload.error === "not_linked"
                                ? "nhân viên chưa kết nối Zalo"
                                : (payload.error ?? "không rõ nguyên nhân")
                            }`}
                      </div>
                    </div>
                  )}

                  {payload.text && (
                    <p className="mt-1.5 text-sm leading-relaxed break-words">
                      “{payload.text}”
                    </p>
                  )}
                  {payload.note && (
                    <p className="mt-1.5 text-xs break-words">
                      Ghi chú: {payload.note}
                    </p>
                  )}
                  {fields && fields.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Đã sửa: {fields.join(", ")}
                    </p>
                  )}
                  {payload.reason && !unassigned && (
                    <p className="mt-1.5 text-xs break-words">
                      Lý do: {payload.reason}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
