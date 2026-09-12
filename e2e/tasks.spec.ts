import { test, expect } from "@playwright/test";
import { cleanupE2E, e2eName, e2ePhone, e2eTitle, taskRow } from "./util";
import { createEmployeeViaUi, createTaskViaUi } from "./ui";

test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanupE2E();
});

async function makeEmployee(page: Parameters<typeof createEmployeeViaUi>[0]) {
  return createEmployeeViaUi(page, {
    name: e2eName("task-owner"),
    phone: e2ePhone(),
  });
}

test.describe("tasks", () => {
  test("creates an assigned task with a timeline", async ({ page }) => {
    const employeeId = await makeEmployee(page);
    const title = e2eTitle("assigned");
    const taskId = await createTaskViaUi(page, {
      title,
      assigneeId: employeeId,
      priority: "high",
    });

    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(
      page.locator("main").getByText("Cần làm", { exact: true }).first()
    ).toBeVisible();
    const timeline = page.locator("main ol");
    await expect(timeline.getByText("Tạo công việc", { exact: true })).toBeVisible();
    await expect(timeline.getByText("Giao việc", { exact: true })).toBeVisible();

    const row = await taskRow(taskId);
    expect(row?.status).toBe("assigned");
    expect(row?.assignee_id).toBe(employeeId);
  });

  test("creates an unassigned task in the same Cần làm state", async ({
    page,
  }) => {
    const title = e2eTitle("draft");
    const taskId = await createTaskViaUi(page, { title });
    await expect(
      page.locator("main").getByText("Cần làm", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.locator("main").getByText("Chưa giao", { exact: true }).first()
    ).toBeVisible();
    const row = await taskRow(taskId);
    expect(row?.status).toBe("assigned");
    expect(row?.assignee_id).toBeNull();
  });

  test("edits title and priority", async ({ page }) => {
    const title = e2eTitle("edit");
    await createTaskViaUi(page, { title });
    await page.getByRole("button", { name: "Sửa nội dung công việc" }).click();
    const updated = `${title} updated`;
    await page.getByLabel("Tiêu đề").fill(updated);
    await page.getByLabel("Ưu tiên").selectOption("urgent");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByRole("heading", { name: updated, level: 1 })).toBeVisible();
    await expect(
      page.locator("main ol").getByText("Sửa nội dung", { exact: true })
    ).toBeVisible();
    await expect(
      page.locator("main").getByText("Khẩn", { exact: true }).first()
    ).toBeVisible();
  });

  test("assigns and unassigns a task", async ({ page }) => {
    const name = e2eName("task-owner");
    const employeeId = await createEmployeeViaUi(page, {
      name,
      phone: e2ePhone(),
    });
    const title = e2eTitle("assign");
    const taskId = await createTaskViaUi(page, { title });

    await expect(
      page.locator("main").getByText("Chưa giao", { exact: true }).first()
    ).toBeVisible();

    await page.locator('select[name="assigneeId"]').selectOption(employeeId);
    await page.getByRole("button", { name: "Giao / Gửi lại Zalo" }).click();
    await expect(page.locator("main").getByRole("link", { name })).toBeVisible();
    expect((await taskRow(taskId))?.status).toBe("assigned");
    expect((await taskRow(taskId))?.assignee_id).toBe(employeeId);

    await page.getByRole("button", { name: "Bỏ giao (về Cần làm)" }).click();
    await expect(
      page.locator("main").getByText("Chưa giao", { exact: true }).first()
    ).toBeVisible();
    const row = await taskRow(taskId);
    expect(row?.status).toBe("assigned");
    expect(row?.assignee_id).toBeNull();
  });

  test("cancels a task from the row menu", async ({ page }) => {
    const title = e2eTitle("cancel");
    const taskId = await createTaskViaUi(page, { title });
    await page.goto("/tasks");
    await page.getByPlaceholder("Tìm theo tiêu đề...").fill(title);
    await expect(page).toHaveURL(/filters=/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    const row = page.locator("tr", { hasText: title });
    await row.getByRole("button", { name: "Thao tác" }).click();
    await page.getByRole("menuitem", { name: "Huỷ công việc" }).click();
    await expect(row.getByText("Đã huỷ", { exact: true })).toBeVisible();
    expect((await taskRow(taskId))?.status).toBe("cancelled");
  });

  test("bulk cancels selected tasks", async ({ page }) => {
    const tag = `bulk${Date.now().toString(36)}`;
    const a = `E2E bulk ${tag} a`;
    const b = `E2E bulk ${tag} b`;
    await createTaskViaUi(page, { title: a });
    await createTaskViaUi(page, { title: b });
    await page.goto("/tasks");
    await page.getByPlaceholder("Tìm theo tiêu đề...").fill(`E2E bulk ${tag}`);
    await expect(page).toHaveURL(/filters=/);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.locator("thead").getByRole("checkbox").click();
    await expect(page.getByText(/Đã chọn 2 công việc/)).toBeVisible();
    await page.getByRole("button", { name: "Huỷ công việc" }).click();
    await expect(page.getByText(/Đã chọn 2 công việc/)).toHaveCount(0);
    await expect(page.locator("tr", { hasText: a }).getByText("Đã huỷ", { exact: true })).toBeVisible();
    await expect(page.locator("tr", { hasText: b }).getByText("Đã huỷ", { exact: true })).toBeVisible();
  });

  test("filters by title and by status facet", async ({ page }) => {
    const title = e2eTitle("filter");
    await createTaskViaUi(page, { title });
    await page.goto("/tasks");
    await page.getByPlaceholder("Tìm theo tiêu đề...").fill(title);
    await expect(page).toHaveURL(/filters=/);
    const row = page.locator("tr", { hasText: title });
    await expect(row).toBeVisible();

    await page.getByRole("toolbar").getByRole("button", { name: "Trạng thái" }).click();
    await page.getByRole("option", { name: "Cần làm" }).click();
    await page.keyboard.press("Escape");
    await expect(row).toBeVisible();
    await expect(page.getByText("Không có dữ liệu.")).toHaveCount(0);
  });

  test("sorts by due date from the column header", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Hạn", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: "Tăng dần" }).click();
    await expect(page).toHaveURL(/sort=due\.asc/);
  });
});
