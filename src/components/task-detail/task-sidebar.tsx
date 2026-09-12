import Image from "next/image";
import Link from "next/link";
import { PencilSimpleIcon } from "@phosphor-icons/react/ssr";

import { taskPriority } from "@/db/schema";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  taskRef,
} from "@/lib/labels";
import { formatVN, toVNInputValue } from "@/lib/time";
import { commentTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { inputClass } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateTimePicker } from "@/components/date-time-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { TaskRow } from "./derive";

/** Side column: the task ledger, its images, the Zalo composer and the editor. */
export function TaskSidebar({
  task,
  closed,
  overdue,
}: {
  task: TaskRow;
  closed: boolean;
  overdue: boolean;
}) {
  const priorityItems = taskPriority.enumValues.map((priority) => ({
    value: priority,
    label: TASK_PRIORITY_LABEL[priority],
  }));

  return (
    <div className="space-y-4">
      <Card className="gap-0 p-5">
        <h2 className="text-sm font-semibold">Thông tin</h2>
        <dl className="mt-3.5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Mã việc</dt>
            <dd className="font-mono text-xs">{taskRef(task.refNo)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd>
              <Badge className={TASK_STATUS_TONE[task.status]}>
                {TASK_STATUS_LABEL[task.status]}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Nhân viên</dt>
            <dd className="text-right">
              {task.assignee ? (
                <Link
                  href={`/employees/${task.assignee.id}`}
                  className="hover:underline"
                >
                  {task.assignee.name}
                </Link>
              ) : (
                "Chưa giao"
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Ưu tiên</dt>
            <dd>{TASK_PRIORITY_LABEL[task.priority]}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Hạn</dt>
            <dd
              className={overdue ? "font-medium text-destructive" : undefined}
            >
              {task.dueAt ? formatVN(task.dueAt) : "Không có"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-2.5 text-xs">
            <dt className="text-muted-foreground">Tạo</dt>
            <dd className="text-muted-foreground">
              {formatVN(task.createdAt)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">Cập nhật</dt>
            <dd className="text-muted-foreground">
              {formatVN(task.updatedAt)}
            </dd>
          </div>
        </dl>
      </Card>

      {task.attachments.length > 0 && (
        <Card className="gap-0 p-5">
          <h2 className="text-sm font-semibold">Hình ảnh đính kèm</h2>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {task.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-square overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-90"
              >
                {/* next/image needs known hosts (see next.config.ts) */}
                <Image
                  src={attachment.url}
                  alt="đính kèm"
                  fill
                  sizes="120px"
                  className="object-cover"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </Card>
      )}

      <Card className="gap-0 p-5">
        <h2 className="text-sm font-semibold">Gửi lời nhắn cho nhân viên</h2>
        {task.assignee?.zaloUserId ? (
          <ActionForm
            action={commentTaskAction}
            toastId="task-comment"
            successMessage="Đã gửi lời nhắn cho nhân viên"
            className="mt-3.5 flex gap-2"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <input
              name="text"
              required
              placeholder="Nội dung sẽ gửi qua Zalo…"
              className={inputClass}
            />
            <SubmitButton>Gửi</SubmitButton>
          </ActionForm>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nhân viên chưa kết nối Zalo nên chưa gửi được lời nhắn.
          </p>
        )}
      </Card>

      {!closed && (
        <Card className="gap-0 p-5">
          <Collapsible>
            <CollapsibleTrigger
              render={
                <Button variant="outline" className="w-full justify-between" />
              }
            >
              Sửa nội dung công việc
              <PencilSimpleIcon />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ActionForm
                action={updateTaskAction}
                toastId="task-update"
                successMessage="Đã lưu thay đổi"
                className="mt-3 space-y-3"
              >
                <input type="hidden" name="taskId" value={task.id} />
                <Field>
                  <FieldLabel htmlFor="edit-title">Tiêu đề</FieldLabel>
                  <input
                    id="edit-title"
                    name="title"
                    required
                    defaultValue={task.title}
                    className={inputClass}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-description">Mô tả</FieldLabel>
                  <textarea
                    id="edit-description"
                    name="description"
                    rows={3}
                    defaultValue={task.description ?? ""}
                    className={inputClass}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-priority">Ưu tiên</FieldLabel>
                  <Select
                    name="priority"
                    defaultValue={task.priority}
                    items={priorityItems}
                  >
                    <SelectTrigger id="edit-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-dueAt">Hạn hoàn thành</FieldLabel>
                  <DateTimePicker
                    id="edit-dueAt"
                    name="dueAt"
                    defaultValue={toVNInputValue(task.dueAt)}
                  />
                  <FieldDescription>Giờ Việt Nam.</FieldDescription>
                </Field>
                <SubmitButton variant="outline" className="w-full">
                  Lưu thay đổi
                </SubmitButton>
              </ActionForm>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}
