import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { actorType, taskEventType } from "@/db/schema";
import { TASK_EVENT_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { BentoCard, BentoHeader } from "./bento-card";
import {
  STATUS_DOT_CLASS,
  STATUS_TEXT_CLASS,
  statusFromPayload,
} from "./status-colors";

export type ActivityEntry = {
  id: string;
  type: (typeof taskEventType.enumValues)[number];
  actorType: (typeof actorType.enumValues)[number];
  payload: Record<string, unknown>;
  createdAt: Date;
  taskId: string;
  taskTitle: string;
};

const ACTOR_LABEL: Record<ActivityEntry["actorType"], string> = {
  manager: "Quản lý",
  employee: "Nhân viên",
  system: "Hệ thống",
};

const MAX_VISIBLE = 8;

function dotClass(entry: ActivityEntry): string {
  const to = statusFromPayload(entry.payload);
  if (entry.type === "status_changed" && to) return STATUS_DOT_CLASS[to];
  if (entry.type === "issue_reported") return STATUS_DOT_CLASS.blocked;
  if (entry.type === "created" || entry.type === "assigned")
    return STATUS_DOT_CLASS.assigned;
  if (entry.type === "reminder_sent" || entry.type === "notification")
    return STATUS_DOT_CLASS.in_progress;
  return "bg-muted-foreground/40";
}

export function ActivityTile({
  recent,
  className,
}: {
  recent: ActivityEntry[];
  className?: string;
}) {
  const visible = recent.slice(0, MAX_VISIBLE);

  return (
    <BentoCard className={className}>
      <div className="relative flex flex-1 flex-col p-6 @3xl/main:p-7">
        <BentoHeader label="Hoạt động gần đây" />

        {visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">
              Chưa có hoạt động nào được ghi nhận.
            </p>
          </div>
        ) : (
          <ol className="mt-5 flex flex-1 flex-col">
            {visible.map((entry, index) => {
              const to = statusFromPayload(entry.payload);
              return (
                <li
                  key={entry.id}
                  className="relative flex gap-3.5 pb-5 last:pb-0"
                >
                  {index < visible.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-4 bottom-0 left-[3px] w-px bg-border"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 mt-1.5 size-[7px] shrink-0 rounded-full ring-4 ring-card",
                      dotClass(entry),
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm">
                        <span className="font-medium">
                          {TASK_EVENT_LABEL[entry.type]}
                        </span>
                        {to && (
                          <>
                            <span className="text-muted-foreground"> → </span>
                            <span
                              className={cn(
                                "font-medium",
                                STATUS_TEXT_CLASS[to],
                              )}
                            >
                              {TASK_STATUS_LABEL[to]}
                            </span>
                          </>
                        )}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(entry.createdAt, {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      <Link
                        href={`/tasks/${entry.taskId}`}
                        className="hover:text-foreground hover:underline"
                      >
                        {entry.taskTitle}
                      </Link>
                      <span className="mx-1.5 text-border">·</span>
                      <span className="text-xs">
                        {ACTOR_LABEL[entry.actorType]}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </BentoCard>
  );
}
