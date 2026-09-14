import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";

import { getEmployeeDetail } from "@/lib/queries";
import { formatVN } from "@/lib/time";
import { Card } from "@/components/ui/card";
import { deriveEmployeeStats } from "@/components/employee-detail/derive";
import { KpiStrip } from "@/components/employee-detail/kpi-strip";
import { MobileCard } from "@/components/employee-detail/mobile-card";
import { ProfileHero } from "@/components/employee-detail/profile-hero";
import { TaskLedger } from "@/components/employee-detail/task-ledger";
import { ZaloCard } from "@/components/employee-detail/zalo-card";
import { EmployeeProfileForm } from "./employee-profile-form";
import { EmployeeStatusForm } from "./employee-status-form";

function tasksByAssigneeHref(employeeId: string) {
  const filters = encodeURIComponent(
    JSON.stringify([{ id: "assignee", value: [employeeId] }]),
  );
  return `/tasks?filters=${filters}`;
}

function statusHint(status: "invited" | "active" | "inactive") {
  switch (status) {
    case "active":
      return "Nhân viên nhận thông báo và nhắc hạn qua Zalo.";
    case "inactive":
      return "Đang tạm ngừng. Công việc đang mở sẽ không còn được nhắc qua Zalo.";
    default:
      return "Chưa kết nối Zalo. Tạo mã mời ở thẻ Kết nối Zalo.";
  }
}

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const data = await getEmployeeDetail(id);
  if (!data) notFound();
  const { employee: e, tasks, activeInvite, mobileDevices, activePairCode } =
    data;
  const now = new Date();
  const stats = deriveEmployeeStats(tasks, now);

  return (
    <div className="@container mx-auto w-full max-w-6xl space-y-5">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Danh sách nhân viên
      </Link>

      <ProfileHero employee={e} stats={stats} now={now} />

      <KpiStrip employeeId={e.id} stats={stats} />

      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_336px] @4xl:items-start">
        <TaskLedger
          tasks={tasks}
          employeeStatus={e.status}
          allHref={tasksByAssigneeHref(e.id)}
          now={now}
        />

        <aside className="space-y-5">
          <Card className="gap-0 p-0">
            <div className="flex items-baseline justify-between gap-2 border-b border-border/70 px-5 py-4">
              <h2 className="font-semibold">Hồ sơ nhân viên</h2>
              <span className="text-xs text-muted-foreground">
                Cập nhật {formatVN(e.updatedAt)}
              </span>
            </div>
            <div className="p-5">
              <EmployeeProfileForm
                employee={{
                  id: e.id,
                  name: e.name,
                  phone: e.phone,
                  position: e.position,
                  note: e.note,
                }}
              />
            </div>
          </Card>

          <ZaloCard employee={e} activeInvite={activeInvite} />

          <MobileCard
            employeeId={e.id}
            devices={mobileDevices}
            activePairCode={activePairCode}
          />

          <Card id="trang-thai" className="scroll-mt-24 gap-0 p-0">
            <div className="border-b border-border/70 px-5 py-4">
              <h2 className="font-semibold">Trạng thái hoạt động</h2>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {statusHint(e.status)}
              </p>
              <EmployeeStatusForm
                employeeId={e.id}
                defaultStatus={e.status}
                openTasks={stats.open}
                tasksHref={tasksByAssigneeHref(e.id)}
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
