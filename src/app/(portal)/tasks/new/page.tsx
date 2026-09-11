import Link from "next/link";
import { listActiveEmployeesForSelect } from "@/lib/queries";
import { createTaskAction } from "@/lib/actions/tasks";
import { PageHeader, inputClass } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateTimePicker } from "@/components/date-time-picker";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { EMPLOYEE_STATUS_LABEL } from "@/lib/labels";

export default async function NewTaskPage() {
  const employees = await listActiveEmployeesForSelect();

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Tạo công việc"
        description="Giao ngay cho nhân viên để gửi thông báo qua Zalo."
      />
      <Card className="gap-0 p-5">
        <form action={createTaskAction} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="title">Tiêu đề</FieldLabel>
            <input id="title" name="title" required className={inputClass} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Mô tả</FieldLabel>
            <textarea
              id="description"
              name="description"
              rows={4}
              className={inputClass}
            />
            <FieldDescription>
              Nội dung nhân viên sẽ nhận qua Zalo.
            </FieldDescription>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="priority">Ưu tiên</FieldLabel>
              <select
                id="priority"
                name="priority"
                defaultValue="normal"
                className={inputClass}
              >
                <option value="low">Thấp</option>
                <option value="normal">Bình thường</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="dueAt">Hạn hoàn thành</FieldLabel>
              <DateTimePicker id="dueAt" name="dueAt" />
              <FieldDescription>Giờ Việt Nam.</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="assigneeId">Giao cho</FieldLabel>
            <select
              id="assigneeId"
              name="assigneeId"
              defaultValue=""
              className={inputClass}
            >
              <option value="">— Chưa giao —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({EMPLOYEE_STATUS_LABEL[e.status]}
                  {e.zaloUserId ? "" : ", chưa kết nối Zalo"})
                </option>
              ))}
            </select>
            <FieldDescription>
              Bỏ trống để tạo nháp và giao sau. Nhân viên phải đã kết nối Zalo.
            </FieldDescription>
          </Field>
          <div className="flex items-center gap-2">
            <Button type="submit">Tạo công việc</Button>
            <Button
              variant="outline"
              render={<Link href="/tasks" />}
              nativeButton={false}
            >
              Quay lại
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
