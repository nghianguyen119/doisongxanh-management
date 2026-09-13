"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { inputClass } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  generateEmployeeLinkAction,
  sendEmployeeLinkAction,
} from "@/lib/actions/employee-link";

/**
 * Preview of the future employee experience: a read-only "Việc của tôi" page
 * opened from a Zalo URL button. Sending only ever targets the explicit Zalo
 * id entered here (use your own to see exactly what the employee receives),
 * never the employee's linked account.
 */
export function EmployeeLinkTester({
  employees,
}: {
  employees: { id: string; name: string }[];
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [zaloUserId, setZaloUserId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateEmployeeLinkAction({ employeeId, baseUrl });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(res.url);
      toast.success("Đã tạo liên kết");
    });
  }

  function sendToMe() {
    startTransition(async () => {
      const res = await sendEmployeeLinkAction({
        employeeId,
        zaloUserId,
        baseUrl,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(res.url);
      toast.success(
        res.transport === "mock"
          ? "Đã ghi vào hộp thư mô phỏng (xem trình mô phỏng bên dưới)"
          : "Đã gửi tin nhắn Zalo — hãy mở Zalo để xem",
      );
    });
  }

  return (
    <Card className="gap-0 p-5">
      <h2 className="font-semibold">Xem trước: nhân viên xem việc qua liên kết</h2>
      <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
        Tạo liên kết đọc-only (hết hạn sau 30 ngày) mở trang{" "}
        <code>/my/tasks</code> cho một nhân viên — giống cách nhân viên sẽ theo
        dõi công việc trong tương lai. Tin nhắn thử chỉ gửi đến đúng Zalo ID
        bạn nhập, không tự gửi cho nhân viên.
      </p>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Nhân viên:</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className={`${inputClass} w-auto`}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Zalo ID của bạn:</span>
          <input
            value={zaloUserId}
            onChange={(e) => setZaloUserId(e.target.value)}
            className={`${inputClass} w-56`}
            placeholder="Dán Zalo ID của bạn"
          />
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className={`${inputClass} w-64`}
            placeholder="URL công khai (tùy chọn, cho dev/tunnel)"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Chưa biết Zalo ID? Nhắn bất kỳ cho Zalo công ty rồi xem ở mục “Tin
          nhắn khách hàng” phía trên.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            disabled={pending || !employeeId}
            onClick={generate}
          >
            Tạo liên kết
          </Button>
          <Button
            disabled={pending || !employeeId || !zaloUserId.trim()}
            onClick={sendToMe}
          >
            Gửi thử cho tôi
          </Button>
        </div>
      </div>

      {url && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-background p-2">
          <code className="min-w-0 flex-1 text-xs break-all">{url}</code>
          <CopyButton value={url} label="Sao chép liên kết" />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium underline underline-offset-4"
          >
            Mở
          </a>
        </div>
      )}
    </Card>
  );
}
