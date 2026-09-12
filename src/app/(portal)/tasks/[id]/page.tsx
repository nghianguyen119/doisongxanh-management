import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";

import { TaskDetail } from "@/components/task-detail";

export default async function TaskDetailPage({
  params,
}: PageProps<"/tasks/[id]">) {
  const { id } = await params;

  return (
    <div className="max-w-3xl">
      <Link
        href="/tasks"
        className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Danh sách công việc
      </Link>

      <TaskDetail id={id} />
    </div>
  );
}
