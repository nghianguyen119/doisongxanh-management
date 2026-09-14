import {
  DeviceMobileIcon,
  PlusIcon,
  ProhibitIcon,
} from "@phosphor-icons/react/ssr";

import {
  generatePairCodeAction,
  revokeMobileDeviceAction,
} from "@/lib/actions/mobile";
import { formatVN } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";

export type MobileDeviceInfo = {
  id: string;
  deviceName: string | null;
  platform: "android" | "ios";
  lastSeenAt: Date | null;
  pushToken: string | null;
};

export type ActivePairCode = {
  code: string;
  expiresAt: Date;
} | null;

/**
 * Pairing panel for the Android employee app: issue a 6-digit code the
 * manager reads out, show paired phones, and revoke a lost one.
 */
export function MobileCard({
  employeeId,
  devices,
  activePairCode,
}: {
  employeeId: string;
  devices: MobileDeviceInfo[];
  activePairCode: ActivePairCode;
}) {
  const connected = devices.length > 0;

  return (
    <Card id="ung-dung" className="scroll-mt-24 gap-0 p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
        <h2 className="font-semibold">Ứng dụng nhân viên</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
            connected
              ? "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "border-border bg-muted/50 text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          {connected ? `${devices.length} thiết bị` : "Chưa ghép nối"}
        </span>
      </div>

      <div className="space-y-5 p-5">
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Mã ghép nối
          </h3>
          {activePairCode ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-2xl font-semibold tracking-[0.3em]">
                  {activePairCode.code}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Hết hạn {formatVN(activePairCode.expiresAt)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton value={activePairCode.code} label="Sao chép mã" />
                <ActionForm
                  action={generatePairCodeAction}
                  toastId="employee-pair-code"
                  successMessage="Đã tạo mã ghép nối mới"
                >
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <SubmitButton variant="outline" size="sm">
                    Tạo mã khác
                  </SubmitButton>
                </ActionForm>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Nhân viên mở app, chọn «Ghép nối thiết bị» và nhập mã này. Mã
                dùng một lần, hết hạn sau 15 phút.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tạo mã rồi đọc cho nhân viên để ghép điện thoại với tài khoản.
                Mã dùng một lần và hết hạn sau 15 phút.
              </p>
              <ActionForm
                action={generatePairCodeAction}
                toastId="employee-pair-code"
                successMessage="Đã tạo mã ghép nối"
              >
                <input type="hidden" name="employeeId" value={employeeId} />
                <SubmitButton variant="outline">
                  <PlusIcon data-icon="inline-start" />
                  Tạo mã ghép nối
                </SubmitButton>
              </ActionForm>
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-border/70 pt-4">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Thiết bị đã ghép nối
          </h3>
          {connected ? (
            <ul className="space-y-2">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <DeviceMobileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {device.deviceName ?? "Điện thoại"}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({device.platform === "ios" ? "iOS" : "Android"})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {device.lastSeenAt
                          ? `Hoạt động ${formatVN(device.lastSeenAt)}`
                          : "Chưa mở app"}
                        {" · "}
                        {device.pushToken
                          ? "Đã bật thông báo"
                          : "Chưa bật thông báo"}
                      </p>
                    </div>
                  </div>
                  <ActionForm
                    action={revokeMobileDeviceAction}
                    toastId="employee-mobile-revoke"
                    successMessage="Đã thu hồi thiết bị"
                  >
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <input type="hidden" name="deviceId" value={device.id} />
                    <SubmitButton variant="outline" size="sm">
                      <ProhibitIcon data-icon="inline-start" />
                      Thu hồi
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <DeviceMobileIcon className="mt-0.5 size-4 shrink-0" />
              Nhân viên chưa ghép điện thoại. Tạo mã ghép nối ở trên để bắt
              đầu.
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}
