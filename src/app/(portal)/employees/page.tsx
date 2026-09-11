import Link from "next/link";
import { listEmployees } from "@/lib/queries";
import { createEmployeeAction } from "@/lib/actions/employees";
import { EMPLOYEE_STATUS_LABEL } from "@/lib/labels";
import {
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  inputClass,
} from "@/components/ui";

export default async function EmployeesPage() {
  const employees = await listEmployees();

  return (
    <div>
      <PageHeader
        title="Nhân viên"
        description="Danh sách nhân viên và trạng thái kết nối Zalo."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Tên</th>
                <th className="px-4 py-2 font-medium">SĐT</th>
                <th className="px-4 py-2 font-medium">Zalo</th>
                <th className="px-4 py-2 font-medium">Việc mở</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-background">
                  <td className="px-4 py-2">
                    <Link
                      href={`/employees/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.name}
                    </Link>
                    {e.position && (
                      <span className="block text-xs text-muted-foreground">
                        {e.position}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{e.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    {e.zaloUserId ? "✅ Đã kết nối" : "—"}
                  </td>
                  <td className="px-4 py-2">{Number(e.open)}</td>
                  <td className="px-4 py-2">
                    <Badge>{EMPLOYEE_STATUS_LABEL[e.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">Thêm nhân viên</h2>
          <form action={createEmployeeAction} className="space-y-3">
            <Field label="Tên">
              <input name="name" required className={inputClass} />
            </Field>
            <Field
              label="Số điện thoại"
              hint="Dùng để nhân viên tự kết nối bằng cách chia sẻ SĐT trên Zalo."
            >
              <input name="phone" className={inputClass} />
            </Field>
            <Field label="Vị trí">
              <input name="position" className={inputClass} />
            </Field>
            <Button type="submit" className="w-full">
              Thêm
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
