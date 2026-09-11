import Link from "next/link";
import { notFound } from "next/navigation";
import { formatVN, formatVNShort } from "@/lib/time";
import { getEmployeeDetail } from "@/lib/queries";
import {
  generateInviteAction,
  linkManualAction,
  unlinkZaloAction,
} from "@/lib/actions/employees";
import {
  EMPLOYEE_STATUS_LABEL,
  EMPLOYEE_STATUS_TONE,
  OPEN_TASK_STATUSES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { PageHeader, inputClass } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmployeeProfileForm } from "./employee-profile-form";
import { EmployeeStatusForm } from "./employee-status-form";

function tasksByAssigneeHref(employeeId: string) {
  const filters = encodeURIComponent(
    JSON.stringify([{ id: "assignee", value: [employeeId] }]),
  );
  return `/tasks?filters=${filters}`;
}

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const data = await getEmployeeDetail(id);
  if (!data) notFound();
  const { employee: e, tasks, activeInvite } = data;
  const openTasks = tasks.filter((t) =>
    OPEN_TASK_STATUSES.includes(t.status),
  ).length;

  return (
    <div>
      <PageHeader
        title={e.name}
        description={e.position ?? undefined}
        action={
          <Badge className={EMPLOYEE_STATUS_TONE[e.status]}>
            {EMPLOYEE_STATUS_LABEL[e.status]}
          </Badge>
        }
      />

      {openTasks > 0 && (
        <Card className="mb-6 gap-0 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          Nhân viên còn <b>{openTasks}</b> việc đang mở.{" "}
          {e.status === "inactive" &&
            "Các việc này sẽ không còn được nhắc qua Zalo. "}
          <Link
            href={tasksByAssigneeHref(e.id)}
            className="font-medium underline underline-offset-4"
          >
            Xem danh sách
          </Link>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Hồ sơ nhân viên</h2>
            <span className="text-xs text-muted-foreground">
              Cập nhật {formatVN(e.updatedAt)}
            </span>
          </div>
          <EmployeeProfileForm
            employee={{
              id: e.id,
              name: e.name,
              phone: e.phone,
              position: e.position,
              note: e.note,
            }}
          />
        </Card>

        <Card className="gap-4 p-5">
          <h2 className="font-semibold">Kết nối Zalo</h2>

          {e.zaloUserId ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Đã kết nối
                </span>
                <span className="block text-xs text-muted-foreground">
                  {e.zaloDisplayName ? `${e.zaloDisplayName} · ` : ""}
                  {e.zaloUserId}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CopyButton value={e.zaloUserId} label="Sao chép ID" />
                <ActionForm
                  action={unlinkZaloAction}
                  toastId="employee-unlink"
                  successMessage="Đã hủy kết nối Zalo"
                >
                  <input type="hidden" name="employeeId" value={e.id} />
                  <SubmitButton variant="outline" size="sm">
                    Hủy kết nối
                  </SubmitButton>
                </ActionForm>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa kết nối Zalo.</p>
          )}

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium">Cách 1 · Mã mời</p>
            {activeInvite ? (
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  Mã:{" "}
                  <span className="font-mono text-base font-semibold">
                    {activeInvite.code}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Hết hạn {formatVN(activeInvite.expiresAt)}. Nhân viên gửi mã
                    này cho Zalo OA.
                  </span>
                </div>
                <CopyButton value={activeInvite.code} label="Sao chép mã" />
              </div>
            ) : (
              <ActionForm
                action={generateInviteAction}
                toastId="employee-invite"
                successMessage="Đã tạo mã mời"
              >
                <input type="hidden" name="employeeId" value={e.id} />
                <SubmitButton variant="outline">Tạo mã mời</SubmitButton>
              </ActionForm>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium">Cách 2 · Nhập Zalo ID</p>
            <ActionForm
              action={linkManualAction}
              toastId="employee-link"
              successMessage="Đã kết nối Zalo"
              className="flex gap-2"
            >
              <input type="hidden" name="employeeId" value={e.id} />
              <input
                name="zaloUserId"
                placeholder="Zalo user id"
                required
                className={inputClass}
              />
              <SubmitButton variant="outline">Gắn</SubmitButton>
            </ActionForm>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium">Trạng thái</p>
            <EmployeeStatusForm
              employeeId={e.id}
              defaultStatus={e.status}
              openTasks={openTasks}
              tasksHref={tasksByAssigneeHref(e.id)}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-6 gap-0 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Công việc</h2>
          <span className="text-sm text-muted-foreground">
            {openTasks}/{tasks.length} việc mở
          </span>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có công việc nào.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <Link
                  href={`/tasks/${t.id}`}
                  className="font-medium hover:underline"
                >
                  {t.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{TASK_PRIORITY_LABEL[t.priority]}</span>
                  <span>·</span>
                  <span>
                    {t.dueAt ? formatVNShort(t.dueAt) : "Không hạn"}
                  </span>
                  <Badge className={TASK_STATUS_TONE[t.status]}>
                    {TASK_STATUS_LABEL[t.status]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
