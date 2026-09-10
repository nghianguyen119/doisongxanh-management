import { notFound } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { getTaskDetail, listActiveEmployeesForSelect } from "@/lib/queries";
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
  verifyTaskAction,
} from "@/lib/actions/tasks";
import { Badge, Button, Card, Field, PageHeader, inputClass } from "@/components/ui";

export default async function TaskDetailPage({
  params,
}: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const data = await getTaskDetail(id);
  if (!data) notFound();
  const { task: t, managerName } = data;
  const employees = await listActiveEmployeesForSelect();

  function actorLabel(actorType: string, actorId: string | null) {
    if (actorType === "employee") return t.assignee?.name ?? "Nhân viên";
    if (actorType === "manager")
      return actorId ? (managerName.get(actorId) ?? "Quản lý") : "Quản lý";
    return "Hệ thống";
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        description={t.description ?? undefined}
        action={
          <Badge tone={TASK_STATUS_TONE[t.status]}>
            {TASK_STATUS_LABEL[t.status]}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">Diễn tiến</h2>
            <ol className="space-y-3">
              {t.events.map((e) => {
                const payload = e.payload as {
                  text?: string;
                  to?: string;
                  note?: string;
                  reason?: string;
                };
                return (
                  <li key={e.id} className="text-sm">
                    <div className="text-xs text-muted">
                      {format(e.createdAt, "dd/MM/yyyy HH:mm")} ·{" "}
                      {actorLabel(e.actorType, e.actorId)} ·{" "}
                      {TASK_EVENT_LABEL[e.type]}
                    </div>
                    {payload.to && (
                      <div>
                        → {TASK_STATUS_LABEL[
                          payload.to as keyof typeof TASK_STATUS_LABEL
                        ] ?? payload.to}
                      </div>
                    )}
                    {payload.text && <div>“{payload.text}”</div>}
                    {payload.note && <div>Ghi chú: {payload.note}</div>}
                    {payload.reason && <div>Lý do: {payload.reason}</div>}
                  </li>
                );
              })}
            </ol>
          </Card>

          {t.attachments.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Hình ảnh đính kèm</h2>
              <div className="grid grid-cols-3 gap-2">
                {t.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block aspect-square overflow-hidden rounded-lg border border-border"
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

          <Card>
            <h2 className="mb-3 font-semibold">Gửi lời nhắn cho nhân viên</h2>
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
              <p className="text-sm text-muted">
                Nhân viên chưa kết nối Zalo nên chưa gửi được lời nhắn.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Nhân viên</dt>
                <dd>{t.assignee?.name ?? "Chưa giao"}</dd>
              </div>
              <div>
                <dt className="text-muted">Ưu tiên</dt>
                <dd>{TASK_PRIORITY_LABEL[t.priority]}</dd>
              </div>
              <div>
                <dt className="text-muted">Hạn</dt>
                <dd>
                  {t.dueAt ? format(t.dueAt, "dd/MM/yyyy HH:mm") : "Không có"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3">
            <form action={assignTaskAction} className="space-y-2">
              <input type="hidden" name="taskId" value={t.id} />
              <Field label={t.assigneeId ? "Giao lại cho" : "Giao cho"}>
                <select name="assigneeId" required className={inputClass}>
                  <option value="">— Chọn nhân viên —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" variant="ghost" className="w-full">
                Giao / Gửi lại Zalo
              </Button>
            </form>

            {t.status === "done" && (
              <form action={verifyTaskAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <Button type="submit" className="w-full">
                  Xác nhận hoàn thành
                </Button>
              </form>
            )}

            {t.status !== "cancelled" && t.status !== "verified" && (
              <form action={cancelTaskAction}>
                <input type="hidden" name="taskId" value={t.id} />
                <Button type="submit" variant="danger" className="w-full">
                  Huỷ công việc
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
