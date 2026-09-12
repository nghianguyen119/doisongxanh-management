import { notFound } from "next/navigation";

import { TASK_STATUS_LABEL, TASK_STATUS_TONE, taskRef } from "@/lib/labels";
import { getTaskDetail, listActiveEmployeesForSelect } from "@/lib/queries";
import { isClosed } from "@/lib/workflow/task-status";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/task-detail/activity-timeline";
import { buildLifecycle, type ActorContext } from "@/components/task-detail/derive";
import { NextAction } from "@/components/task-detail/next-action";
import { TaskSidebar } from "@/components/task-detail/task-sidebar";
import { WorkflowStepper } from "@/components/task-detail/workflow-stepper";

/**
 * The full task page body, shared by the standalone `/tasks/[id]` page and the
 * intercepted modal so there is only one place to change it.
 *
 * The page is organised around the lifecycle state machine: identity, then the
 * stepper, then the contextual next action, then the event log beside the
 * task's reference data.
 */
export async function TaskDetail({ id }: { id: string }) {
  const data = await getTaskDetail(id);
  if (!data) notFound();
  const { task: t, managerName } = data;
  const employees = await listActiveEmployeesForSelect();
  const closed = isClosed(t.status);
  const overdue = t.overdue && !closed;

  const employeeName = new Map(employees.map((e) => [e.id, e.name]));
  if (t.assignee) employeeName.set(t.assignee.id, t.assignee.name);
  const actorCtx: ActorContext = {
    employeeName,
    managerName,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
  };
  const lifecycle = buildLifecycle(t, t.events);

  return (
    <div className="@container space-y-5">
      <header className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {taskRef(t.refNo)}
          </span>
          <Badge className={TASK_STATUS_TONE[t.status]}>
            {TASK_STATUS_LABEL[t.status]}
          </Badge>
          {overdue && <Badge variant="destructive">Quá hạn</Badge>}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-pretty">
          {t.title}
        </h1>
        {t.description && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t.description}
          </p>
        )}
      </header>

      <WorkflowStepper
        task={t}
        lifecycle={lifecycle}
        closed={closed}
        overdue={overdue}
        actorCtx={actorCtx}
      />

      <NextAction
        task={t}
        closed={closed}
        lifecycle={lifecycle}
        employees={employees}
        actorCtx={actorCtx}
      />

      <div className="grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_300px] @3xl:items-start">
        <ActivityTimeline events={t.events} actorCtx={actorCtx} />
        <TaskSidebar task={t} closed={closed} overdue={overdue} />
      </div>
    </div>
  );
}
