import { desc, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { employee } from "@/db/schema";
import { env, isSimulatorEnabled } from "@/env";
import { Card, PageHeader } from "@/components/ui";
import { Simulator } from "./simulator";

export default async function ZaloSettingsPage() {
  const token = await db.query.zaloOaToken.findFirst();
  const linked = await db.query.employee.findMany({
    where: isNotNull(employee.zaloUserId),
    orderBy: desc(employee.updatedAt),
  });

  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/zalo/webhook`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Zalo OA"
        description="Trạng thái kết nối Official Account và công cụ mô phỏng."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
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

        <Card>
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
        <Card className="mt-6 text-sm text-muted-foreground">
          Công cụ mô phỏng chỉ hoạt động khi <code>ZALO_TRANSPORT=mock</code> và
          không chạy ở chế độ production.
        </Card>
      )}
    </div>
  );
}
