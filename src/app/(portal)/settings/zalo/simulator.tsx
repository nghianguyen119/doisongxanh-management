"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type LinkedEmployee = { id: string; name: string; zaloUserId: string };
type LogRow = {
  id: string;
  direction: "in" | "out";
  eventName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

const DEMO_IMAGE = "https://s120-ava-talk.zadn.vn/placeholder.jpg";

export function Simulator({ linked }: { linked: LinkedEmployee[] }) {
  const [zaloUserId, setZaloUserId] = useState(
    linked[0]?.zaloUserId ?? "zalo-demo-1",
  );
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [thread, setThread] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/dev/zalo-inbound?zaloUserId=${encodeURIComponent(zaloUserId)}`,
      );
      if (!cancelled && res.ok) {
        const data = (await res.json()) as { thread?: LogRow[] };
        setThread(data.thread ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zaloUserId]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/dev/zalo-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zaloUserId, ...body }),
      });
      if (res.ok) setThread((await res.json()).thread ?? []);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 p-5">
      <h2 className="mb-3 font-semibold">Mô phỏng Zalo (điện thoại nhân viên)</h2>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Zalo user:</span>
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
            <option value={zaloUserId}>{zaloUserId}</option>
          )}
        </select>
        <input
          value={zaloUserId}
          onChange={(e) => setZaloUserId(e.target.value)}
          className={`${inputClass} w-44`}
          placeholder="hoặc nhập id mới"
        />
      </div>

      <div className="mb-3 h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
        {thread.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có tin nhắn.</p>
        )}
        {thread.map((row) => (
          <div
            key={row.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              row.direction === "out"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}
          >
            <div className="whitespace-pre-wrap">
              {renderPayload(row)}
            </div>
            <div
              className={`mt-1 text-[10px] ${row.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
            >
              {row.direction === "out" ? "OA →" : "→ OA"} · {row.eventName}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập tin nhắn của nhân viên…"
            className={inputClass}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim())
                send({ kind: "text", text });
            }}
          />
          <Button
            disabled={busy || !text.trim()}
            onClick={() => send({ kind: "text", text })}
          >
            Gửi
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => send({ kind: "image", imageUrls: [DEMO_IMAGE] })}
          >
            📷 Gửi ảnh
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => send({ kind: "follow" })}
          >
            + Follow OA
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => send({ kind: "unfollow" })}
          >
            − Unfollow
          </Button>
        </div>

        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="SĐT để chia sẻ (user_info)"
            className={inputClass}
          />
          <Button
            variant="outline"
            disabled={busy || !phone.trim()}
            onClick={() => send({ kind: "user_info", phone })}
          >
            Chia sẻ SĐT
          </Button>
        </div>
      </div>
    </Card>
  );
}

function renderPayload(row: LogRow): string {
  const p = row.payload as {
    text?: string;
    buttons?: Array<{ title: string }>;
  };
  if (p.text && p.buttons?.length) {
    return `${p.text}\n[ ${p.buttons.map((b) => b.title).join(" | ")} ]`;
  }
  if (p.text) return p.text;
  return JSON.stringify(row.payload);
}
