import { getDashboardData } from "@/lib/queries";
import type { TaskStatus } from "@/lib/workflow/task-status";
import { ActivityTile } from "@/components/dashboard/activity-tile";
import { HeroTile } from "@/components/dashboard/hero-tile";
import { IssueQueueTile } from "@/components/dashboard/issue-queue-tile";
import { OverdueTile } from "@/components/dashboard/overdue-tile";
import { StatusMixTile } from "@/components/dashboard/status-mix-tile";
import { WorkloadTile } from "@/components/dashboard/workload-tile";

export default async function DashboardPage() {
  const { statusCounts, overdue, workload, recent, blocked } =
    await getDashboardData();

  const counts: Record<TaskStatus, number> = {
    assigned: statusCounts.assigned ?? 0,
    in_progress: statusCounts.in_progress ?? 0,
    blocked: statusCounts.blocked ?? 0,
    done: statusCounts.done ?? 0,
    verified: statusCounts.verified ?? 0,
    cancelled: statusCounts.cancelled ?? 0,
  };
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-6 @3xl/main:gap-5 @4xl/main:grid-cols-12">
      <HeroTile
        counts={counts}
        overdueCount={overdue.length}
        className="@xl/main:col-span-6 @4xl/main:col-span-8"
      />

      <StatusMixTile
        counts={counts}
        total={total}
        className="@xl/main:col-span-3 @4xl/main:col-span-4"
      />

      <WorkloadTile
        workload={workload.map((entry) => ({
          employeeId: entry.employeeId,
          name: entry.name,
          open: Number(entry.open),
        }))}
        className="@xl/main:col-span-3 @4xl/main:col-span-4 @4xl/main:row-span-2"
      />

      <OverdueTile
        overdue={overdue}
        className="@xl/main:col-span-6 @4xl/main:col-span-8"
      />

      <IssueQueueTile
        blocked={blocked}
        className="@xl/main:col-span-6 @4xl/main:col-span-8"
      />

      <ActivityTile
        recent={recent}
        className="@xl/main:col-span-6 @4xl/main:col-span-12"
      />
    </div>
  );
}
