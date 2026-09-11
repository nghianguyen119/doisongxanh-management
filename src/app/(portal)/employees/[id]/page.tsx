import Link from "next/link";
import { notFound } from "next/navigation";
import { formatVN, formatVNShort } from "@/lib/time";
import { getEmployeeDetail } from "@/lib/queries";
import {
  generateInviteAction,
  linkManualAction,
  setEmployeeStatusAction,
  updateEmployeeAction,
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Hồ sơ nhân viên</h2>
            <span className="text-xs text-muted-foreground">
              Cập nhật {formatVN(e.updatedAt)}
            </span>
          </div>
          <form action={updateEmployeeAction} className="space-y-3">
            <input type="hidden" name="employeeId" value={e.id} />
            <Field>
              <FieldLabel htmlFor="name">Tên</FieldLabel>
              <input
                id="name"
                name="name"
                required
                defaultValue={e.name}
                className={inputClass}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Số điện thoại</FieldLabel>
              <input
                id="phone"
                name="phone"
                defaultValue={e.phone ?? ""}
                className={inputClass}
              />
              <FieldDescription>
                Dùng để nhân viên tự kết nối bằng cách chia sẻ SĐT trên Zalo.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="position">Vị trí</FieldLabel>
              <input
                id="position"
                name="position"
                defaultValue={e.position ?? ""}
                className={inputClass}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="note">Ghi chú</FieldLabel>
              <textarea
                id="note"
                name="note"
                rows={3}
                defaultValue={e.note ?? ""}
                className={inputClass}
              />
            </Field>
            <Button type="submit">Lưu thay đổi</Button>
          </form>
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
              <CopyButton value={e.zaloUserId} label="Sao chép ID" />
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
              <form action={generateInviteAction}>
                <input type="hidden" name="employeeId" value={e.id} />
                <Button type="submit" variant="outline">
                  Tạo mã mời
                </Button>
              </form>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium">Cách 2 · Chia sẻ SĐT</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Nhân viên nhắn cho OA và bấm “chia sẻ số điện thoại”. Hệ thống
                khớp với SĐT{" "}
                {e.phone ? <b>{e.phone}</b> : "(chưa có — hãy cập nhật)"}.
              </p>
              {e.phone && <CopyButton value={e.phone} label="Sao chép SĐT" />}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium">Cách 3 · Nhập Zalo ID</p>
            <form action={linkManualAction} className="flex gap-2">
              <input type="hidden" name="employeeId" value={e.id} />
              <input
                name="zaloUserId"
                placeholder="Zalo user id"
                required
                className={inputClass}
              />
              <Button type="submit" variant="outline">
                Gắn
              </Button>
            </form>
          </div>

          <div className="border-t pt-3">
            <p className="mb-2 text-sm font-medium">Trạng thái</p>
            <form action={setEmployeeStatusAction} className="flex gap-2">
              <input type="hidden" name="employeeId" value={e.id} />
              <select
                name="status"
                defaultValue={e.status}
                className={inputClass}
              >
                <option value="invited">Chờ kết nối</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng</option>
              </select>
              <Button type="submit" variant="outline">
                Lưu
              </Button>
            </form>
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
