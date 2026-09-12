import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

import { cn } from "@/lib/utils";
import {
  assignTaskAction,
  cancelTaskAction,
  unassignTaskAction,
  verifyTaskAction,
} from "@/lib/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actorLabel,
  eventPayload,
  lastEventOfType,
  type ActorContext,
  type TaskLifecycle,
  type TaskRow,
} from "./derive";

function relative(date: Date) {
  return formatDistanceToNow(date, { addSuffix: true, locale: vi });
}

type Assignee = { id: string; name: string; zaloUserId: string | null };

/**
 * The contextual "what now" panel. The four lifecycle action forms are always
 * mounted here — only their buttons toggle — so a successful mutation can
 * re-render the page without dropping its toast.
 */
export function NextAction({
  task,
  closed,
  lifecycle,
  employees,
  actorCtx,
}: {
  task: TaskRow;
  closed: boolean;
  lifecycle: TaskLifecycle;
  employees: Assignee[];
  actorCtx: ActorContext;
}) {
  const assigneeName = task.assignee?.name ?? null;
  const assigneeItems = employees.map((employee) => ({
    value: employee.id,
    label: employee.zaloUserId
      ? employee.name
      : `${employee.name} (chưa kết nối Zalo)`,
  }));

  const doneAt = lifecycle.doneAt;
  const inProgressAt = lifecycle.steps[1].at;
  const issue = lastEventOfType(task.events, "issue_reported");
  const issueText = issue ? eventPayload(issue).text : undefined;

  let heading: string;
  let detail: string;
  let hint: string | null = null;

  if (task.status === "verified") {
    heading = "Đã xác nhận hoàn thành";
    const verifiedBy = lifecycle.verifiedEvent
      ? actorLabel(
          lifecycle.verifiedEvent.actorType,
          lifecycle.verifiedEvent.actorId,
          actorCtx,
        )
      : null;
    const parts = [
      doneAt && assigneeName ? `${assigneeName} hoàn thành ${relative(doneAt)}` : null,
      lifecycle.verifiedAt && verifiedBy
        ? `${verifiedBy} xác nhận ${relative(lifecycle.verifiedAt)}`
        : null,
    ].filter(Boolean);
    detail = parts.length > 0 ? `${parts.join(" · ")}.` : "Công việc đã khép lại.";
  } else if (task.status === "cancelled") {
    heading = "Công việc đã huỷ";
    const cancelledBy = lifecycle.cancelledEvent
      ? actorLabel(
          lifecycle.cancelledEvent.actorType,
          lifecycle.cancelledEvent.actorId,
          actorCtx,
        )
      : null;
    detail = lifecycle.cancelledAt
      ? `${cancelledBy ?? "Quản lý"} huỷ ${relative(lifecycle.cancelledAt)}.`
      : "Công việc đã bị huỷ.";
    const reason = lifecycle.cancelledEvent
      ? eventPayload(lifecycle.cancelledEvent).reason
      : undefined;
    if (reason) hint = `Lý do: ${reason}`;
  } else if (task.status === "done") {
    heading = "Chờ xác nhận";
    detail = doneAt
      ? `${assigneeName ?? "Nhân viên"} báo hoàn thành ${relative(doneAt)}. Kiểm tra kết quả rồi xác nhận.`
      : "Nhân viên đã báo hoàn thành. Kiểm tra kết quả rồi xác nhận.";
  } else if (task.status === "blocked") {
    heading = "Đang gặp sự cố";
    detail = issueText
      ? `${assigneeName ?? "Nhân viên"}: “${issueText}”${
          issue ? ` (${relative(issue.createdAt)})` : ""
        }`
      : `${assigneeName ?? "Nhân viên"} báo gặp sự cố${
          inProgressAt ? ` ${relative(inProgressAt)}` : ""
        }.`;
    hint = "Liên hệ nhân viên hoặc giao lại công việc để tiếp tục.";
  } else if (task.status === "in_progress") {
    heading = "Đang thực hiện";
    detail = inProgressAt
      ? `${assigneeName ?? "Nhân viên"} bắt đầu ${relative(inProgressAt)}.`
      : `${assigneeName ?? "Nhân viên"} đang thực hiện công việc.`;
  } else if (task.assigneeId) {
    heading = "Chờ bắt đầu";
    detail = task.assignedAt
      ? `Đã giao cho ${assigneeName ?? "nhân viên"} ${relative(task.assignedAt)}. Nhân viên bắt đầu từ Zalo.`
      : `Đã giao cho ${assigneeName ?? "nhân viên"}. Nhân viên bắt đầu từ Zalo.`;
  } else {
    heading = "Chưa giao việc";
    detail = "Chọn nhân viên để gửi thẻ giao việc qua Zalo.";
  }

  if (task.status === "cancelled") {
    hint = hint
      ? `${hint} Giao lại cho nhân viên để mở lại công việc.`
      : "Giao lại cho nhân viên để mở lại công việc.";
  }

  const showAssign = task.status !== "verified";
  const showVerify = task.status === "done";
  const showControls = showAssign || showVerify;
  const hasSecondary = (task.assigneeId && task.status === "assigned") || !closed;

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div
        className={cn(
          "grid gap-5 p-5",
          showControls && "@xl:grid-cols-[minmax(0,1fr)_320px] @xl:items-start",
        )}
      >
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Việc cần làm tiếp theo
          </h2>
          <p className="mt-2 text-sm font-medium">{heading}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {detail}
          </p>
          {hint && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {hint}
            </p>
          )}
        </div>

        <div className={cn("space-y-4", !showControls && "hidden")}>
          <ActionForm
            action={verifyTaskAction}
            toastId="task-verify"
            successMessage="Đã xác nhận hoàn thành"
          >
            <input type="hidden" name="taskId" value={task.id} />
            {showVerify && (
              <SubmitButton className="w-full">
                Xác nhận hoàn thành
              </SubmitButton>
            )}
          </ActionForm>

          <ActionForm
            action={assignTaskAction}
            toastId="task-assign"
            successMessage="Đã giao việc"
            className="space-y-2"
          >
            <input type="hidden" name="taskId" value={task.id} />
            {showAssign && (
              <>
                <Field>
                  <FieldLabel htmlFor="assigneeId">
                    {task.assigneeId ? "Giao lại cho" : "Giao cho"}
                  </FieldLabel>
                  <Select
                    name="assigneeId"
                    required
                    items={assigneeItems}
                  >
                    <SelectTrigger id="assigneeId" className="w-full">
                      <SelectValue placeholder="— Chọn nhân viên —" />
                    </SelectTrigger>
                    <SelectContent>
                      {assigneeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <SubmitButton
                  variant={task.assigneeId ? "outline" : "default"}
                  className="w-full"
                >
                  Giao / Gửi lại Zalo
                </SubmitButton>
              </>
            )}
          </ActionForm>
        </div>
      </div>

      <div
        className={cn(
          "border-t bg-muted/30 px-5 py-3.5",
          !hasSecondary && "hidden",
        )}
      >
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Thao tác
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ActionForm
            action={unassignTaskAction}
            toastId="task-unassign"
            successMessage="Đã bỏ giao"
          >
            <input type="hidden" name="taskId" value={task.id} />
            {task.assigneeId && task.status === "assigned" && (
              <SubmitButton variant="outline" size="sm">
                Bỏ giao (về Cần làm)
              </SubmitButton>
            )}
          </ActionForm>

          <ActionForm
            action={cancelTaskAction}
            toastId="task-cancel"
            successMessage="Đã huỷ công việc"
          >
            <input type="hidden" name="taskId" value={task.id} />
            {!closed && (
              <SubmitButton variant="destructive" size="sm">
                Huỷ công việc
              </SubmitButton>
            )}
          </ActionForm>
        </div>
      </div>
    </Card>
  );
}
