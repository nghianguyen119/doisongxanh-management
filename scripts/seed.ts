import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { employee, user } from "@/db/schema";
import { createTask } from "@/lib/workflow/task-service";
import { generateInvite } from "@/lib/workflow/employee-linking";

/**
 * Idempotent-ish demo seed. Safe to run on an empty DB; re-running creates
 * duplicate tasks but not duplicate users/employees (matched by email/phone).
 */
async function main() {
  const managerEmail = "quanly@doisongxanh.local";

  let manager = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, managerEmail),
  });
  if (!manager) {
    [manager] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        name: "Quản lý Demo",
        email: managerEmail,
        emailVerified: true,
        role: "admin",
      })
      .returning();
    console.log("• created demo manager:", managerEmail);
  }

  const demoEmployees = [
    { name: "Nguyễn Văn A", phone: "0900000001", zaloUserId: "zalo-demo-1", status: "active" as const },
    { name: "Trần Thị B", phone: "0900000002", zaloUserId: null, status: "invited" as const },
    { name: "Lê Văn C", phone: "0900000003", zaloUserId: null, status: "invited" as const },
  ];

  const created: Record<string, string> = {};
  for (const e of demoEmployees) {
    let row = await db.query.employee.findFirst({
      where: (t, { eq }) => eq(t.phone, e.phone),
    });
    if (!row) {
      [row] = await db
        .insert(employee)
        .values({ ...e, createdBy: manager.id })
        .returning();
      console.log("• created employee:", e.name);
      if (!e.zaloUserId) {
        const { code } = await generateInvite(row.id, manager.id);
        console.log(`   invite code for ${e.name}: ${code}`);
      }
    }
    created[e.name] = row.id;
  }

  await createTask({
    title: "Tưới cây khu vực sảnh chính",
    description: "Kiểm tra độ ẩm đất, tưới đủ nước, dọn lá rụng.",
    priority: "normal",
    dueAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    assigneeId: created["Nguyễn Văn A"],
    createdBy: manager.id,
  });
  console.log("• created + assigned task to Nguyễn Văn A");

  await createTask({
    title: "Thay chậu cây tầng 2",
    description: "3 chậu bị nứt, thay chậu mới cùng kích thước.",
    priority: "high",
    createdBy: manager.id,
  });
  console.log("• created unassigned task");

  console.log("\nSeed done. Sign in with a Google account listed in ALLOWED_MANAGER_EMAILS.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
