import { listActiveEmployeesForSelect } from "@/lib/queries";
import { createTaskAction } from "@/lib/actions/tasks";
import { Button, Card, Field, PageHeader, inputClass } from "@/components/ui";
import { EMPLOYEE_STATUS_LABEL } from "@/lib/labels";

export default async function NewTaskPage() {
  const employees = await listActiveEmployeesForSelect();

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Tạo công việc"
        description="Giao ngay cho nhân viên để gửi thông báo qua Zalo."
      />
      <Card>
        <form action={createTaskAction} className="space-y-4">
          <Field label="Tiêu đề">
            <input name="title" required className={inputClass} />
          </Field>
          <Field label="Mô tả" hint="Nội dung nhân viên sẽ nhận qua Zalo.">
            <textarea name="description" rows={4} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ưu tiên">
              <select name="priority" defaultValue="normal" className={inputClass}>
                <option value="low">Thấp</option>
                <option value="normal">Bình thường</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn</option>
              </select>
            </Field>
            <Field label="Hạn hoàn thành" hint="Giờ Việt Nam.">
              <input type="datetime-local" name="dueAt" className={inputClass} />
            </Field>
          </div>
          <Field
            label="Giao cho"
            hint="Bỏ trống để tạo nháp và giao sau. Nhân viên phải đã kết nối Zalo."
          >
            <select name="assigneeId" defaultValue="" className={inputClass}>
              <option value="">— Chưa giao —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({EMPLOYEE_STATUS_LABEL[e.status]})
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit">Tạo công việc</Button>
        </form>
      </Card>
    </div>
  );
}
