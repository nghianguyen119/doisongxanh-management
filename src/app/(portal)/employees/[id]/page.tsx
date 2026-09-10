import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getEmployeeDetail } from "@/lib/queries";
import {
  generateInviteAction,
  linkManualAction,
  setEmployeeStatusAction,
} from "@/lib/actions/employees";
import {
  EMPLOYEE_STATUS_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from "@/lib/labels";
import { Badge, Button, Card, PageHeader, inputClass } from "@/components/ui";

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const data = await getEmployeeDetail(id);
  if (!data) notFound();
  const { employee: e, tasks, activeInvite } = data;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={e.name}
        description={e.position ?? undefined}
        action={<Badge>{EMPLOYEE_STATUS_LABEL[e.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">Kết nối Zalo</h2>
          {e.zaloUserId ? (
            <p className="text-sm">
              ✅ Đã kết nối
              <span className="block text-xs text-muted">
                Zalo user id: {e.zaloUserId}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">Chưa kết nối.</p>
          )}

          <div className="border-t border-border pt-3">
            <p className="mb-1 text-sm font-medium">Cách 1 · Mã mời</p>
            {activeInvite ? (
              <p className="text-sm">
                Mã: <span className="font-mono text-base">{activeInvite.code}</span>
                <span className="block text-xs text-muted">
                  Hết hạn {format(activeInvite.expiresAt, "dd/MM/yyyy HH:mm")}.
                  Nhân viên gửi mã này cho Zalo OA.
                </span>
              </p>
            ) : (
              <form action={generateInviteAction}>
                <input type="hidden" name="employeeId" value={e.id} />
                <Button type="submit" variant="ghost">
                  Tạo mã mời
                </Button>
              </form>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-1 text-sm font-medium">Cách 2 · Chia sẻ SĐT</p>
            <p className="text-xs text-muted">
              Nhân viên nhắn cho OA và bấm “chia sẻ số điện thoại”. Hệ thống khớp
              với SĐT {e.phone ? <b>{e.phone}</b> : "(chưa có — hãy cập nhật)"}.
            </p>
          </div>

          <div className="border-t border-border pt-3">
            <p className="mb-1 text-sm font-medium">Cách 3 · Nhập Zalo ID</p>
            <form action={linkManualAction} className="flex gap-2">
              <input type="hidden" name="employeeId" value={e.id} />
              <input
                name="zaloUserId"
                placeholder="Zalo user id"
                required
                className={inputClass}
              />
              <Button type="submit" variant="ghost">
                Gắn
              </Button>
            </form>
          </div>

          <div className="border-t border-border pt-3">
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
              <Button type="submit" variant="ghost">
                Lưu
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Công việc</h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted">Chưa có công việc nào.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.title}
                  </Link>{" "}
                  <Badge tone={TASK_STATUS_TONE[t.status]}>
                    {TASK_STATUS_LABEL[t.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
