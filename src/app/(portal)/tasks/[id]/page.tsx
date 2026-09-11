import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  BellIcon,
  ChatCircleIcon,
  ClockIcon,
  PaperclipIcon,
  PencilSimpleIcon,
  PlusCircleIcon,
  UserPlusIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { formatVN, toVNInputValue } from "@/lib/time";
import { getTaskDetail, listActiveEmployeesForSelect } from "@/lib/queries";
import { taskPriority } from "@/db/schema";
import { isClosed } from "@/lib/workflow/task-status";
import {
  TASK_EVENT_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import {
  assignTaskAction,
  cancelTaskAction,
  commentTaskAction,
  unassignTaskAction,
  updateTaskAction,
  verifyTaskAction,
} from "@/lib/actions/tasks";
import { PageHeader, inputClass } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateTimePicker } from "@/components/date-time-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

function EventIcon({ type }: { type: keyof typeof TASK_EVENT_LABEL }) {
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
    default:
      return <ClockIcon className={className} />;
  }
}

export default async function TaskDetailPage({
  params,
}: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const data = await getTaskDetail(id);
  if (!data) notFound();
  const { task: t, managerName } = data;
  const employees = await listActiveEmployeesForSelect();
  const closed = isClosed(t.status);
  const overdue = t.overdue && !closed;

  function actorLabel(actorType: string, actorId: string | null) {
    if (actorType === "employee") return t.assignee?.name ?? "Nhân viên";
    if (actorType === "manager")
      return actorId ? (managerName.get(actorId) ?? "Quản lý") : "Quản lý";
    return "Hệ thống";
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/tasks"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Danh sách công việc
      </Link>

      <PageHeader
        title={t.title}
        description={t.description ?? undefined}
        action={
          <Badge className={TASK_STATUS_TONE[t.status]}>
            {TASK_STATUS_LABEL[t.status]}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <Card className="gap-0 p-5">
            <h2 className="mb-4 font-semibold">Diễn tiến</h2>
            {t.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có ghi nhận nào.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l pl-5">
                {t.events.map((e) => {
                  const payload = e.payload as {
                    text?: string;
                    to?: string;
                    note?: string;
                    reason?: string;
                  };
                  return (
                    <li key={e.id} className="relative text-sm">
                      <span className="absolute top-0.5 -left-[1.65rem] flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground">
                        <EventIcon type={e.type} />
                      </span>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">
                          {TASK_EVENT_LABEL[e.type]}
                        </span>
                        <time
                          className="text-xs text-muted-foreground"
                          title={formatVN(e.createdAt)}
                        >
                          {formatDistanceToNow(e.createdAt, {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </time>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {actorLabel(e.actorType, e.actorId)}
                      </div>
                      {payload.to && (
                        <div className="mt-1">
                          →{" "}
                          {TASK_STATUS_LABEL[
                            payload.to as keyof typeof TASK_STATUS_LABEL
                          ] ?? payload.to}
                        </div>
                      )}
                      {payload.text && <div className="mt-1">“{payload.text}”</div>}
                      {payload.note && (
                        <div className="mt-1">Ghi chú: {payload.note}</div>
                      )}
                      {payload.reason && (
                        <div className="mt-1">Lý do: {payload.reason}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {t.attachments.length > 0 && (
            <Card className="gap-0 p-5">
              <h2 className="mb-3 font-semibold">Hình ảnh đính kèm</h2>
              <div className="grid grid-cols-3 gap-2">
                {t.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block aspect-square overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-90"
                  >
                    {/* next/image needs known hosts (see next.config.ts) */}
                    <Image
                      src={a.url}
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
            <h2 className="mb-3 font-semibold">
              Gửi lời nhắn cho nhân viên
            </h2>
            {t.assignee?.zaloUserId ? (
              <form action={commentTaskAction} className="flex gap-2">
                <input type="hidden" name="taskId" value={t.id} />
                <input
                  name="text"
                  required
                  placeholder="Nội dung sẽ gửi qua Zalo…"
                  className={inputClass}
                />
                <Button type="submit">Gửi</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nhân viên chưa kết nối Zalo nên chưa gửi được lời nhắn.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="gap-0 p-5">
            <h2 className="mb-3 font-semibold">Thông tin</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Trạng thái</dt>
                <dd>
                  <Badge className={TASK_STATUS_TONE[t.status]}>
                    {TASK_STATUS_LABEL[t.status]}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Nhân viên</dt>
                <dd className="text-right">
                  {t.assignee ? (
                    <Link
                      href={`/employees/${t.assignee.id}`}
                      className="hover:underline"
                    >
                      {t.assignee.name}
                    </Link>
                  ) : (
                    "Chưa giao"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Ưu tiên</dt>
                <dd>{TASK_PRIORITY_LABEL[t.priority]}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Hạn</dt>
                <dd
                  className={overdue ? "font-medium text-destructive" : undefined}
                >
                  {t.dueAt ? formatVN(t.dueAt) : "Không có"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
                <dt className="text-muted-foreground">Tạo</dt>
                <dd className="text-muted-foreground">
                  {formatVN(t.createdAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <dt className="text-muted-foreground">Cập nhật</dt>
                <dd className="text-muted-foreground">
                  {formatVN(t.updatedAt)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="gap-3 p-5">
            <form action={assignTaskAction} className="space-y-2">
              <input type="hidden" name="taskId" value={t.id} />
              <Field>
                <FieldLabel htmlFor="assigneeId">
                  {t.assigneeId ? "Giao lại cho" : "Giao cho"}
                </FieldLabel>
                <select
                  id="assigneeId"
                  name="assigneeId"
                  required
                  className={inputClass}
                >
                  <option value="">— Chọn nhân viên —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.zaloUserId ? "" : " (chưa kết nối Zalo)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" variant="outline" className="w-full">
                Giao / Gửi lại Zalo
              </Button>
            </form>

            {t.assigneeId && !closed && (
              <form action={unassignTaskAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <Button type="submit" variant="ghost" className="w-full">
                  Bỏ giao (về Mới tạo)
                </Button>
              </form>
            )}

            {t.status === "done" && (
              <form action={verifyTaskAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <Button type="submit" className="w-full">
                  Xác nhận hoàn thành
                </Button>
              </form>
            )}

            {!closed && (
              <form action={cancelTaskAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <Button type="submit" variant="destructive" className="w-full">
                  Huỷ công việc
                </Button>
              </form>
            )}
          </Card>

          {!closed && (
            <Card className="gap-0 p-5">
              <Collapsible>
                <CollapsibleTrigger
                  render={
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    />
                  }
                >
                  Sửa nội dung công việc
                  <PencilSimpleIcon />
                </CollapsibleTrigger>
              <CollapsibleContent>
                <form action={updateTaskAction} className="mt-3 space-y-3">
                  <input type="hidden" name="taskId" value={t.id} />
                  <Field>
                    <FieldLabel htmlFor="edit-title">Tiêu đề</FieldLabel>
                    <input
                      id="edit-title"
                      name="title"
                      required
                      defaultValue={t.title}
                      className={inputClass}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-description">Mô tả</FieldLabel>
                    <textarea
                      id="edit-description"
                      name="description"
                      rows={3}
                      defaultValue={t.description ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-priority">Ưu tiên</FieldLabel>
                    <select
                      id="edit-priority"
                      name="priority"
                      defaultValue={t.priority}
                      className={inputClass}
                    >
                      {taskPriority.enumValues.map((p) => (
                        <option key={p} value={p}>
                          {TASK_PRIORITY_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-dueAt">Hạn hoàn thành</FieldLabel>
                    <DateTimePicker
                      id="edit-dueAt"
                      name="dueAt"
                      defaultValue={toVNInputValue(t.dueAt)}
                    />
                    <FieldDescription>Giờ Việt Nam.</FieldDescription>
                  </Field>
                  <Button type="submit" variant="outline" className="w-full">
                    Lưu thay đổi
                  </Button>
                </form>
              </CollapsibleContent>
            </Collapsible>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}
