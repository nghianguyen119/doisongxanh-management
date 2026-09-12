import { desc, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { env, isRealSendTesterEnabled, isSimulatorEnabled } from "@/env";
import { PageHeader } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { listRecentClientMessages } from "@/lib/queries";
import { formatVNShort } from "@/lib/time";
import { describeInbound } from "@/lib/zalo/log";
import { RealTester } from "./real-tester";
import { Simulator } from "./simulator";

export default async function ZaloSettingsPage() {
  const token = await db.query.zaloOaToken.findFirst();
  const linked = await db.query.employee.findMany({
    where: isNotNull(employee.zaloUserId),
    orderBy: desc(employee.updatedAt),
  });
  const clientMessages = await listRecentClientMessages();

  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/zalo/webhook`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Zalo OA"
        description="Trạng thái kết nối Official Account và công cụ mô phỏng."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-0 p-5">
          <h2 className="mb-2 font-semibold">Cấu hình</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chế độ</dt>
              <dd className="font-medium">
                {env.ZALO_TRANSPORT === "live" ? "Thật (live)" : "Mô phỏng (mock)"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Access token</dt>
              <dd>
                {token
                  ? `hết hạn ${token.expiresAt.toLocaleString("vi-VN")}`
                  : "chưa có"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 break-all rounded-lg bg-background p-2 text-xs">
            Webhook URL: {webhookUrl}
          </p>
        </Card>

        <Card className="gap-0 p-5">
          <h2 className="mb-2 font-semibold">Nhân viên đã kết nối</h2>
          {linked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có ai.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {linked.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{e.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {e.zaloUserId}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 gap-0 p-5">
        <h2 className="font-semibold">Tin nhắn khách hàng</h2>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">
          Tin nhắn Zalo từ người chưa kết nối nhân viên. Bot đã tự động phản hồi;
          quản lý trả lời thủ công trong ứng dụng Zalo OA.
        </p>
        {clientMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có tin nhắn nào.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {clientMessages.map((m) => (
              <li
                key={m.id}
                className="border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.zaloUserId}
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatVNShort(m.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 break-words">
                  {describeInbound(m.eventName, m.payload)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isSimulatorEnabled() ? (
        <div className="mt-6">
          <Simulator
            linked={linked.map((e) => ({
              id: e.id,
              name: e.name,
              zaloUserId: e.zaloUserId!,
            }))}
          />
        </div>
      ) : (
        <Card className="mt-6 gap-0 p-5 text-sm text-muted-foreground">
          Công cụ mô phỏng chỉ hoạt động khi <code>ZALO_TRANSPORT=mock</code> và
          không chạy ở chế độ production.
        </Card>
      )}

      {isRealSendTesterEnabled() && (
        <div className="mt-6">
          <RealTester
            linked={linked.map((e) => ({
              id: e.id,
              name: e.name,
              zaloUserId: e.zaloUserId!,
            }))}
          />
        </div>
      )}
    </div>
  );
}
