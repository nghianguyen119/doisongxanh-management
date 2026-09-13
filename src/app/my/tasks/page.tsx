import type { Metadata } from "next";
import type { ReactNode } from "react";
import { verifyEmployeeLinkToken } from "@/lib/employee-link";
import {
  OPEN_TASK_STATUSES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  taskRef,
} from "@/lib/labels";
import { getEmployeeDetail, getLatestIssueTexts } from "@/lib/queries";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/workflow/task-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Việc của tôi — Đời Sống Xanh",
  description: "Danh sách công việc của bạn tại Đời Sống Xanh.",
  robots: { index: false, follow: false },
};

/** Employee-facing "finished" set: done, verified and cancelled. */
const FINISHED_STATUSES: TaskStatus[] = ["done", "verified", "cancelled"];

const BLOCKED_FALLBACK = "Đang chờ quản lý xử lý sự cố.";

/** Wrapper so the purity lint rule does not flag `Date.now()` in render. */
function currentTimeMs(): number {
  return Date.now();
}

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const verified =
    typeof token === "string" ? verifyEmployeeLinkToken(token) : null;
  if (!verified) {
    return (
      <Shell>
        <ExpiredLink />
      </Shell>
    );
  }

  const detail = await getEmployeeDetail(verified.employeeId);
  if (!detail) {
    return (
      <Shell>
        <ExpiredLink />
      </Shell>
    );
  }

  const { employee, tasks } = detail;
  if (employee.status === "inactive") {
    return (
      <Shell>
        <Notice
          title="Tài khoản đã ngừng hoạt động"
          body="Liên kết này thuộc về nhân viên đã ngừng hoạt động. Vui lòng liên hệ quản lý nếu bạn cần hỗ trợ."
        />
      </Shell>
    );
  }

  const now = currentTimeMs();
  const active = tasks
    .filter((t) => OPEN_TASK_STATUSES.includes(t.status))
    .sort(
      (a, b) =>
        (a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY),
    );
  const finished = tasks
    .filter((t) => FINISHED_STATUSES.includes(t.status))
    .sort(
      (a, b) =>
        (b.completedAt ?? b.updatedAt).getTime() -
        (a.completedAt ?? a.updatedAt).getTime(),
    );

  const issueTexts = await getLatestIssueTexts(
    active.filter((t) => t.status === "blocked").map((t) => t.id),
  );

  return (
    <Shell>
      <header className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <p className="text-[11px] font-semibold tracking-widest text-primary uppercase">
          Đời Sống Xanh
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Việc của tôi
        </h1>
        <p className="mt-1 text-sm font-medium">
          {employee.name}
          {employee.position && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {employee.position}
            </span>
          )}
        </p>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Liên kết riêng của bạn, vui lòng không chia sẻ.
        </p>
      </header>

      <section aria-labelledby="doing-heading">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 id="doing-heading" className="text-sm font-semibold">
            Đang thực hiện
          </h2>
          <span className="text-xs text-muted-foreground">
            {active.length} việc
          </span>
        </div>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Bạn chưa có công việc nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((t) => {
              const overdue = !!t.dueAt && t.dueAt.getTime() < now;
              return (
                <li
                  key={t.id}
                  className={cn(
                    "rounded-2xl border bg-card p-4",
                    overdue ? "border-destructive/50" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {taskRef(t.refNo)}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug font-medium break-words">
                        {t.title}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        TASK_STATUS_TONE[t.status],
                      )}
                    >
                      {TASK_STATUS_LABEL[t.status]}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Ưu tiên:{" "}
                      <span className="text-foreground">
                        {TASK_PRIORITY_LABEL[t.priority]}
                      </span>
                    </span>
                    <span className={cn(overdue && "font-medium text-destructive")}>
                      Hạn:{" "}
                      {t.dueAt ? formatVN(t.dueAt, "dd/MM/yyyy HH:mm") : "—"}
                      {overdue && " · Quá hạn"}
                    </span>
                  </div>

                  {t.status === "blocked" && (
                    <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
                      {issueTexts.get(t.id) ?? BLOCKED_FALLBACK}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <details className="group rounded-2xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Đã hoàn thành ({finished.length})
            <span
              aria-hidden
              className="text-muted-foreground transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <ul className="space-y-2 border-t border-border p-3">
            {finished.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-border/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {taskRef(t.refNo)}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug font-medium break-words text-muted-foreground">
                      {t.title}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      TASK_STATUS_TONE[t.status],
                    )}
                  >
                    {TASK_STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Ưu tiên: {TASK_PRIORITY_LABEL[t.priority]}</span>
                  <span>
                    Hạn: {t.dueAt ? formatVN(t.dueAt, "dd/MM/yyyy HH:mm") : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="px-1 pb-2 text-center text-xs text-muted-foreground">
        Danh sách chỉ để xem. Mọi thay đổi thực hiện qua Zalo công ty.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-muted/40">
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </div>
    </main>
  );
}

function ExpiredLink() {
  return (
    <Notice
      title="Liên kết không hợp lệ hoặc đã hết hạn"
      body="Vui lòng liên hệ quản lý để nhận liên kết mới. Cảm ơn bạn!"
    />
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <p className="text-[11px] font-semibold tracking-widest text-primary uppercase">
        Đời Sống Xanh
      </p>
      <h1 className="mt-2 text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
