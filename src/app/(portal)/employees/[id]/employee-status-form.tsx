"use client";

import * as React from "react";
import Link from "next/link";
import { WarningIcon } from "@phosphor-icons/react";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { setEmployeeStatusAction } from "@/lib/actions/employees";
import { EMPLOYEE_STATUS_LABEL } from "@/lib/labels";

const STATUSES = ["invited", "active", "inactive"] as const;

/**
 * Status control with a contextual warning: reassigning open tasks only
 * matters once the manager actually picks "Ngừng", not merely on page view.
 */
export function EmployeeStatusForm({
  employeeId,
  defaultStatus,
  openTasks,
  tasksHref,
}: {
  employeeId: string;
  defaultStatus: (typeof STATUSES)[number];
  openTasks: number;
  tasksHref: string;
}) {
  const [status, setStatus] = React.useState<string>(defaultStatus);

  return (
    <div className="space-y-2.5">
      <ActionForm
        action={setEmployeeStatusAction}
        toastId="employee-status"
        successMessage="Đã cập nhật trạng thái"
        className="flex gap-2"
      >
        <input type="hidden" name="employeeId" value={employeeId} />
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {EMPLOYEE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <SubmitButton variant="outline">Lưu</SubmitButton>
      </ActionForm>

      {status === "inactive" && openTasks > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <WarningIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Còn <b>{openTasks}</b> việc đang mở. Nên giao lại trước khi ngừng
            hoạt động.{" "}
            <Link
              href={tasksHref}
              className="font-medium underline underline-offset-4"
            >
              Xem danh sách
            </Link>
          </span>
        </p>
      )}
    </div>
  );
}
