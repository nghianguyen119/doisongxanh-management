import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { employee, employeeInvite, task, user } from "@/db/schema";
import { createTask } from "@/lib/workflow/task-service";
import { generateInvite } from "@/lib/workflow/employee-linking";

/**
 * Demo seed. Employees are upserted by phone and tasks by title, so running it
 * twice neither duplicates rows nor resets work that happened in the app.
 * NOTE: it does overwrite employee profile fields with the demo values.
 */
const MANAGER_EMAIL = "quanly@doisongxanh.local";

type EmployeeStatus = "invited" | "active" | "inactive";

interface DemoEmployee {
  name: string;
  phone: string;
  position: string;
  note?: string;
  status: EmployeeStatus;
  zaloUserId?: string;
  zaloDisplayName?: string;
}

const DEMO_EMPLOYEES: DemoEmployee[] = [
  {
    name: "Nguyễn Văn An",
    phone: "0900000001",
    position: "Tổ trưởng khu vực",
    note: "Phụ trách sảnh chính và điều phối ca làm việc.",
    status: "active",
    zaloUserId: "zalo-demo-1",
    zaloDisplayName: "An Nguyễn",
  },
  {
    name: "Trần Thị Bích",
    phone: "0900000002",
    position: "Nhân viên chăm sóc cây",
    status: "invited",
  },
  {
    name: "Lê Văn Cường",
    phone: "0900000003",
    position: "Nhân viên kỹ thuật",
    status: "invited",
  },
  {
    name: "Phạm Thị Dung",
    phone: "0900000004",
    position: "Nhân viên văn phòng",
    note: "Kiêm theo dõi vật tư và lịch bảo trì.",
    status: "active",
    zaloUserId: "zalo-demo-4",
    zaloDisplayName: "Dung Phạm",
  },
  {
    name: "Hoàng Văn Em",
    phone: "0900000005",
    position: "Nhân viên tưới cây",
    status: "active",
    zaloUserId: "zalo-demo-5",
    zaloDisplayName: "Em Hoàng",
  },
  {
    name: "Vũ Thị Hoa",
    phone: "0900000006",
    position: "Nhân viên vệ sinh",
    note: "Tạm nghỉ từ tháng trước.",
    status: "inactive",
  },
  {
    name: "Đặng Văn Hùng",
    phone: "0900000007",
    position: "Kỹ thuật viên điện",
    note: "Ưu tiên xử lý sự cố chiếu sáng.",
    status: "active",
    zaloUserId: "zalo-demo-7",
    zaloDisplayName: "Hùng Đặng",
  },
  {
    name: "Bùi Thị Lan",
    phone: "0900000008",
    position: "Nhân viên chăm sóc cây",
    status: "active",
    zaloUserId: "zalo-demo-8",
    zaloDisplayName: "Lan Bùi",
  },
  {
    name: "Ngô Văn Minh",
    phone: "0900000009",
    position: "Nhân viên khuôn viên",
    status: "invited",
  },
  {
    name: "Đỗ Thị Ngọc",
    phone: "0900000010",
    position: "Giám sát chất lượng",
    note: "Kiểm tra chất lượng sau khi hoàn thành.",
    status: "active",
    zaloUserId: "zalo-demo-10",
    zaloDisplayName: "Ngọc Đỗ",
  },
  {
    name: "Trịnh Văn Phúc",
    phone: "0900000011",
    position: "Nhân viên bảo trì",
    status: "inactive",
  },
  {
    name: "Lý Thị Quỳnh",
    phone: "0900000012",
    position: "Nhân viên chăm sóc cây",
    status: "invited",
  },
];

interface DemoTask {
  title: string;
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
  dueInHours?: number;
  assigneePhone?: string;
}

const DEMO_TASKS: DemoTask[] = [
  {
    title: "Tưới cây khu vực sảnh chính",
    description: "Kiểm tra độ ẩm đất, tưới đủ nước, dọn lá rụng.",
    priority: "normal",
    dueInHours: 6,
    assigneePhone: "0900000001",
  },
  {
    title: "Thay chậu cây tầng 2",
    description: "3 chậu bị nứt, thay chậu mới cùng kích thước.",
    priority: "high",
  },
  {
    title: "Kiểm tra hệ thống tưới tự động",
    description: "Rà soát van và đầu phun, ghi lại các vị trí rò rỉ.",
    priority: "high",
    dueInHours: 24,
    assigneePhone: "0900000007",
  },
  {
    title: "Dọn vệ sinh hành lang tầng 1",
    description: "Quét dọn, lau kính và sắp xếp lại khu vực chờ.",
    priority: "normal",
    dueInHours: 30,
    assigneePhone: "0900000005",
  },
  {
    title: "Cắt tỉa cây cảnh tầng 3",
    description: "Cắt tỉa cành khô và tạo tán cho dãy cây ban công.",
    priority: "normal",
    dueInHours: 48,
    assigneePhone: "0900000008",
  },
  {
    title: "Bảo trì đèn chiếu sáng sân trước",
    description: "Thay bóng hỏng và kiểm tra đường dây ngoài trời.",
    priority: "urgent",
    dueInHours: 12,
    assigneePhone: "0900000007",
  },
  {
    title: "Kiểm kê vật tư làm vườn",
    description: "Đếm phân bón, đất và dụng cụ; đề xuất mua thêm.",
    priority: "low",
    dueInHours: 72,
    assigneePhone: "0900000010",
  },
  {
    title: "Lên lịch chăm sóc cây tháng tới",
    description: "Phân bổ nhân sự và tần suất tưới theo từng khu vực.",
    priority: "normal",
  },
  {
    title: "Vệ sinh mái kính tầng 4",
    description: "Loại bỏ lá rụng và bụi bám để lấy sáng cho tầng dưới.",
    priority: "high",
    dueInHours: 36,
    assigneePhone: "0900000004",
  },
];

async function main() {
  let manager = await db.query.user.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.email, MANAGER_EMAIL),
  });
  if (!manager) {
    [manager] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        name: "Quản lý Demo",
        email: MANAGER_EMAIL,
        emailVerified: true,
        role: "admin",
      })
      .returning();
    console.log("• tạo quản lý demo:", MANAGER_EMAIL);
  }

  const employeeIdByPhone = new Map<string, string>();

  for (const e of DEMO_EMPLOYEES) {
    const existing = await db.query.employee.findFirst({
      where: eq(employee.phone, e.phone),
    });

    const profile = {
      name: e.name,
      position: e.position,
      note: e.note ?? null,
      status: e.status,
      zaloUserId: e.zaloUserId ?? null,
      zaloDisplayName: e.zaloDisplayName ?? null,
    };

    let row: typeof employee.$inferSelect;
    if (existing) {
      [row] = await db
        .update(employee)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(employee.id, existing.id))
        .returning();
      console.log("• cập nhật nhân viên:", e.name);
    } else {
      [row] = await db
        .insert(employee)
        .values({ ...profile, phone: e.phone, createdBy: manager.id })
        .returning();
      console.log("• tạo nhân viên:", e.name);
    }

    employeeIdByPhone.set(e.phone, row.id);

    if (!row.zaloUserId) {
      const activeInvite = await db.query.employeeInvite.findFirst({
        where: and(
          eq(employeeInvite.employeeId, row.id),
          isNull(employeeInvite.consumedAt),
          gt(employeeInvite.expiresAt, new Date()),
        ),
      });
      if (!activeInvite) {
        const { code } = await generateInvite(row.id, manager.id);
        console.log(`   mã mời cho ${e.name}: ${code}`);
      }
    }
  }

  for (const t of DEMO_TASKS) {
    const existing = await db.query.task.findFirst({
      where: eq(task.title, t.title),
    });
    if (existing) {
      console.log("• công việc đã tồn tại:", t.title);
      continue;
    }

    await createTask({
      title: t.title,
      description: t.description,
      priority: t.priority ?? "normal",
      dueAt:
        t.dueInHours !== undefined
          ? new Date(Date.now() + t.dueInHours * 60 * 60 * 1000)
          : null,
      assigneeId: t.assigneePhone
        ? (employeeIdByPhone.get(t.assigneePhone) ?? null)
        : null,
      createdBy: manager.id,
    });
    console.log("• tạo công việc:", t.title);
  }

  console.log(
    `\nSeed hoàn tất: ${DEMO_EMPLOYEES.length} nhân viên, ${DEMO_TASKS.length} công việc.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
