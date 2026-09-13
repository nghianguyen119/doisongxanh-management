"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  sendZaloTestAction,
  type ZaloTestKind,
  type ZaloTestResult,
} from "@/lib/actions/zalo";

type LinkedEmployee = { id: string; name: string; zaloUserId: string };
type TestRun = { id: number; label: string; result: ZaloTestResult };

const BUTTON_TEMPLATES: { kind: ZaloTestKind; label: string }[] = [
  { kind: "assigned", label: "🔔 Giao việc mới" },
  { kind: "updated", label: "✏️ Cập nhật việc" },
  { kind: "started", label: "▶️ Đã bắt đầu" },
  { kind: "reminder_due", label: "⏰ Nhắc sắp hạn" },
  { kind: "reminder_overdue", label: "🔴 Nhắc quá hạn" },
];

export function RealTester({ linked }: { linked: LinkedEmployee[] }) {
  const [zaloUserId, setZaloUserId] = useState(linked[0]?.zaloUserId ?? "");
  const [text, setText] = useState("");
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [pending, startTransition] = useTransition();

  function send(kind: ZaloTestKind, label: string, customText?: string) {
    startTransition(async () => {
      let result: ZaloTestResult;
      try {
        result = await sendZaloTestAction({
          zaloUserId,
          kind,
          text: customText || undefined,
        });
      } catch (err) {
        result = {
          ok: false,
          kind,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      setRuns((prev) =>
        [{ id: Date.now(), label, result }, ...prev].slice(0, 6),
      );
    });
  }

  return (
    <Card className="gap-0 p-5">
      <h2 className="font-semibold">Gửi thật (live) để kiểm tra template</h2>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">
        Gửi trực tiếp qua API Zalo công ty bằng access token trong database — kể cả
        khi chế độ đang là <code>mock</code>. Chỉ hiện khi chạy local. Mỗi lần
        gửi được ghi vào <code>zalo_message_log</code>.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Người nhận:</span>
        <select
          value={zaloUserId}
          onChange={(e) => setZaloUserId(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          {linked.map((e) => (
            <option key={e.id} value={e.zaloUserId}>
              {e.name} ({e.zaloUserId})
            </option>
          ))}
          {!linked.some((e) => e.zaloUserId === zaloUserId) && (
            <option value={zaloUserId}>{zaloUserId || "—"}</option>
          )}
        </select>
        <input
          value={zaloUserId}
          onChange={(e) => setZaloUserId(e.target.value)}
          className={`${inputClass} w-52`}
          placeholder="hoặc nhập Zalo user id"
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Tin văn bản</h3>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nội dung (trống = lời nhắn mặc định)"
              className={inputClass}
            />
            <Button
              variant="outline"
              disabled={pending || !zaloUserId.trim()}
              onClick={() => send("text", "Tin văn bản", text)}
            >
              Gửi
            </Button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium">Template có nút</h3>
          <div className="flex flex-wrap gap-2">
            {BUTTON_TEMPLATES.map((t) => (
              <Button
                key={t.kind}
                variant="outline"
                disabled={pending || !zaloUserId.trim()}
                onClick={() => send(t.kind, t.label)}
              >
                {t.label}
              </Button>
            ))}
            <Button
              variant="outline"
              disabled={pending || !zaloUserId.trim()}
              onClick={() =>
                send("request_user_info", "📇 Xin thông tin (request_user_info)")
              }
            >
              📇 Xin thông tin
            </Button>
          </div>
        </div>
      </div>

      {runs.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          {runs.map((run) => (
            <li key={run.id} className="flex items-start gap-2">
              <span className="shrink-0">
                {run.result.ok ? "✅" : "❌"}
              </span>
              <span className="shrink-0">{run.label}</span>
              <span className="break-all text-muted-foreground">
                {run.result.ok
                  ? `message_id=${run.result.messageId}`
                  : run.result.error}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
