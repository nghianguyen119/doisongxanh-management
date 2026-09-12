import {
  LinkBreakIcon,
  LinkSimpleIcon,
  PlusIcon,
} from "@phosphor-icons/react/ssr";

import {
  generateInviteAction,
  linkManualAction,
  unlinkZaloAction,
} from "@/lib/actions/employees";
import { copy } from "@/lib/workflow/bot-copy";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import type { EmployeeStatus } from "./derive";

export type ZaloEmployee = {
  id: string;
  name: string;
  status: EmployeeStatus;
  zaloUserId: string | null;
  zaloDisplayName: string | null;
};

export type ActiveInvite = {
  code: string;
  expiresAt: Date;
} | null;

/**
 * The Zalo transport panel: link state, invite-code path and the manual
 * fallback. Copy stays in `bot-copy.ts` so the portal and the bot agree.
 */
export function ZaloCard({
  employee,
  activeInvite,
}: {
  employee: ZaloEmployee;
  activeInvite: ActiveInvite;
}) {
  const linked = Boolean(employee.zaloUserId);

  return (
    <Card id="zalo" className="scroll-mt-24 gap-0 p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
        <h2 className="font-semibold">Kết nối Zalo</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
            linked
              ? "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "border-border bg-muted/50 text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              linked ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          {linked ? "Đã kết nối" : "Chưa kết nối"}
        </span>
      </div>

      <div className="space-y-5 p-5">
        {employee.zaloUserId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <LinkSimpleIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {employee.zaloDisplayName ?? "Tài khoản Zalo"}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {employee.zaloUserId}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <CopyButton value={employee.zaloUserId} label="Sao chép ID" />
              <ActionForm
                action={unlinkZaloAction}
                toastId="employee-unlink"
                successMessage="Đã hủy kết nối Zalo"
              >
                <input type="hidden" name="employeeId" value={employee.id} />
                <SubmitButton variant="outline" size="sm">
                  Hủy kết nối
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <LinkBreakIcon className="mt-0.5 size-4 shrink-0" />
            Nhân viên chưa kết nối Zalo. Dùng mã mời hoặc nhập Zalo ID thủ công.
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Cách 1 · Mã mời
          </h3>
          {activeInvite ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-lg font-semibold tracking-[0.25em]">
                  {activeInvite.code}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Hết hạn {formatVN(activeInvite.expiresAt)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton
                  value={activeInvite.code}
                  label="Sao chép mã"
                />
                <CopyButton
                  value={copy.invite(employee.name, activeInvite.code)}
                  label="Sao chép tin nhắn mời"
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Nhân viên gửi mã này cho Zalo OA để kết nối.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tạo mã rồi gửi cho nhân viên qua tin nhắn. Mã hết hạn thì tạo
                mã mới.
              </p>
              <ActionForm
                action={generateInviteAction}
                toastId="employee-invite"
                successMessage="Đã tạo mã mời"
              >
                <input type="hidden" name="employeeId" value={employee.id} />
                <SubmitButton variant="outline">
                  <PlusIcon data-icon="inline-start" />
                  Tạo mã mời
                </SubmitButton>
              </ActionForm>
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-border/70 pt-4">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Cách 2 · Nhập Zalo ID
          </h3>
          <ActionForm
            action={linkManualAction}
            toastId="employee-link"
            successMessage="Đã kết nối Zalo"
            className="flex gap-2"
          >
            <input type="hidden" name="employeeId" value={employee.id} />
            <input
              name="zaloUserId"
              placeholder="Zalo user id"
              required
              className={inputClass}
            />
            <SubmitButton variant="outline">Gắn</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </Card>
  );
}
