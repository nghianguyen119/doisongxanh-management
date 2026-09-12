import { TaskDetail } from "@/components/task-detail";
import { TaskModal } from "@/components/task-modal";

/**
 * Clicking a kanban card soft-navigates to `/tasks/[id]`; from the board this
 * intercepted route renders the task detail in a dialog instead. A hard load
 * of the task URL still renders the standalone page above.
 */
export default async function InterceptedTaskDetailPage({
  params,
}: PageProps<"/tasks/[id]">) {
  const { id } = await params;

  return (
    <TaskModal expandHref={`/tasks/${id}`}>
      <TaskDetail id={id} />
    </TaskModal>
  );
}
