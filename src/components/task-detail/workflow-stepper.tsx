import {
  CheckIcon,
  ProhibitIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { formatDistanceStrict } from "date-fns";
import { vi } from "date-fns/locale";

import { TASK_STATUS_LABEL } from "@/lib/labels";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  actorLabel,
  type ActorContext,
  type LifecycleStep,
  type TaskLifecycle,
  type TaskRow,
} from "./derive";

function markerClass(step: LifecycleStep) {
  if (step.blocked) {
    return "border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400";
  }
  if (step.current) {
    return "border-primary/40 bg-primary/10 text-primary";
  }
  if (step.reached) {
    return "border-border bg-muted text-foreground/60";
  }
  return "border-border bg-card text-muted-foreground/50";
}

function StepMarker({ step }: { step: LifecycleStep }) {
  if (step.blocked) {
    return <WarningIcon className="size-3.5" weight="fill" />;
  }
  if (step.reached && !step.current) {
    return <CheckIcon className="size-3" weight="bold" />;
  }
  if (step.current) {
    return <span className="size-2 rounded-full bg-primary" />;
  }
  return <span className="size-1.5 rounded-full bg-muted-foreground/30" />;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate text-sm font-medium tabular-nums",
          tone,
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The lifecycle state machine as a calm four-step track. Reached steps keep
 * their real timestamps; `blocked` hangs a warning marker off "Đang làm" and
 * `cancelled` gets a terminal banner above the track.
 */
export function WorkflowStepper({
  task,
  lifecycle,
  closed,
  overdue,
  actorCtx,
}: {
  task: TaskRow;
  lifecycle: TaskLifecycle;
  closed: boolean;
  overdue: boolean;
  actorCtx: ActorContext;
}) {
  const now = new Date();
  const cancelled = task.status === "cancelled";
  const finishedAt =
    lifecycle.verifiedAt ?? lifecycle.cancelledAt ?? task.updatedAt;

  const duration = formatDistanceStrict(task.createdAt, closed ? finishedAt : now, {
    locale: vi,
  });

  let deadlineLabel = "Hạn";
  let deadlineValue = "Không có";
  let deadlineTone: string | undefined;
  if (closed) {
    deadlineLabel = task.status === "verified" ? "Xác nhận" : "Đã huỷ";
    deadlineValue = formatVN(finishedAt, "dd/MM HH:mm");
  } else if (task.dueAt) {
    deadlineLabel = overdue ? "Quá hạn" : "Còn lại";
    deadlineValue = formatDistanceStrict(task.dueAt, now, { locale: vi });
    deadlineTone = overdue ? "text-destructive" : undefined;
  }

  const cancelledBy =
    lifecycle.cancelledEvent &&
    actorLabel(
      lifecycle.cancelledEvent.actorType,
      lifecycle.cancelledEvent.actorId,
      actorCtx,
    );

  return (
    <Card className="gap-0 overflow-hidden p-0">
      {cancelled && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/40 px-5 py-3 text-sm">
          <ProhibitIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">Công việc đã huỷ</span>
          {lifecycle.cancelledAt && (
            <span className="text-muted-foreground">
              lúc {formatVN(lifecycle.cancelledAt, "dd/MM HH:mm")}
            </span>
          )}
          {cancelledBy && (
            <span className="text-muted-foreground">bởi {cancelledBy}</span>
          )}
        </div>
      )}

      <div className="px-5 pt-5 pb-4">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Tiến trình
        </h2>
        <ol className="mt-5 grid grid-cols-4">
          {lifecycle.steps.map((step, index) => (
            <li
              key={step.stage}
              className="relative"
              aria-current={step.current ? "step" : undefined}
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 right-1/2 h-px w-full",
                    step.reached ? "bg-foreground/15" : "bg-border",
                  )}
                />
              )}
              <div className="relative z-10 flex flex-col items-center px-1">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    markerClass(step),
                  )}
                >
                  <StepMarker step={step} />
                </span>
                <span
                  className={cn(
                    "mt-2 text-center text-[11px] font-medium tracking-tight @lg:text-xs",
                    step.current
                      ? "text-foreground"
                      : step.reached
                        ? "text-foreground/70"
                        : "text-muted-foreground",
                  )}
                >
                  {TASK_STATUS_LABEL[step.stage]}
                </span>
                <span
                  className="mt-0.5 text-center text-[11px] text-muted-foreground tabular-nums"
                  title={
                    step.at ? formatVN(step.at) : "Chưa có mốc thời gian"
                  }
                >
                  {step.at ? formatVN(step.at, "dd/MM HH:mm") : "—"}
                </span>
                {step.blocked && (
                  <span className="mt-1.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    Gặp sự cố
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 border-t bg-muted/30 px-5 py-4">
        <Stat
          label={closed ? "Thời lượng" : "Đã mở"}
          value={duration}
        />
        <Stat
          label={deadlineLabel}
          value={deadlineValue}
          tone={deadlineTone}
        />
        <Stat label="Ghi nhận" value={String(task.events.length)} />
      </dl>
    </Card>
  );
}
