import { test, expect } from "@playwright/test";
import {
  cleanupE2E,
  e2eName,
  e2ePhone,
  sql,
  taskRow,
} from "./util";
import { createEmployeeViaUi, createTaskViaUi } from "./ui";

test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanupE2E();
});

test.describe("employees", () => {
  test("creates an employee from the drawer", async ({ page }) => {
    const name = e2eName("create");
    const phone = e2ePhone();
    await createEmployeeViaUi(page, { name, phone, position: "E2E vị trí" });
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("Chưa kết nối Zalo.")).toBeVisible();

    await page.goto("/employees");
    await page.getByPlaceholder("Tìm theo tên...").fill(name);
    await expect(page.getByRole("link", { name })).toBeVisible();
  });

  test("rejects an invalid phone", async ({ page }) => {
    await page.goto("/employees");
    await page.getByRole("button", { name: "Thêm nhân viên" }).click();
    const drawer = page.locator('[data-slot="drawer-popup"]');
    await drawer.getByLabel("Tên").fill(e2eName("badphone"));
    await drawer.getByLabel("Số điện thoại").fill("01239123");
    await drawer.getByRole("button", { name: "Thêm nhân viên" }).click();
    // The message is rendered inline; production redacts thrown action errors.
    await expect(drawer.getByText(/không hợp lệ/)).toBeVisible();
    await expect(page.getByText("Không thực hiện được")).toHaveCount(0);
    await expect(drawer).toBeVisible();
  });

  test("rejects a duplicate phone", async ({ page }) => {
    const phone = e2ePhone();
    await createEmployeeViaUi(page, { name: e2eName("dup-a"), phone });
    await page.goto("/employees");
    await page.getByRole("button", { name: "Thêm nhân viên" }).click();
    const drawer = page.locator('[data-slot="drawer-popup"]');
    await drawer.getByLabel("Tên").fill(e2eName("dup-b"));
    await drawer.getByLabel("Số điện thoại").fill(phone);
    await drawer.getByRole("button", { name: "Thêm nhân viên" }).click();
    await expect(
      drawer.getByText(/đã thuộc về nhân viên khác/)
    ).toBeVisible();
    await expect(page.getByText("Không thực hiện được")).toHaveCount(0);
  });

  test("edits the profile and persists it", async ({ page }) => {
    const phone = e2ePhone();
    const id = await createEmployeeViaUi(page, {
      name: e2eName("edit"),
      phone,
    });
    const newName = e2eName("edited");
    await page.getByLabel("Tên").fill(newName);
    await page.getByLabel("Ghi chú").fill("E2E note");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: newName, level: 1 })
    ).toBeVisible();
    const rows = await sql<{ note: string | null; phone: string | null }>(
      "select note, phone from employee where id = $1",
      [id]
    );
    expect(rows[0]?.note).toBe("E2E note");
    expect(rows[0]?.phone).toBe(phone);
  });

  test("warns when deactivating with open tasks and links to the filtered list", async ({
    page,
  }) => {
    const phone = e2ePhone();
    const id = await createEmployeeViaUi(page, {
      name: e2eName("warn"),
      phone,
    });
    await createTaskViaUi(page, { title: `E2E warn ${Date.now()}`, assigneeId: id });
    await page.goto(`/employees/${id}`);

    // Opening the profile only reports the open work, it does not imply a
    // deactivation is coming.
    await expect(page.getByText(/còn\s*1\s*việc đang mở/i)).toBeVisible();
    await expect(
      page.getByText(/Nên giao lại trước khi ngừng hoạt động/)
    ).toHaveCount(0);

    // The reassignment warning appears once "Ngừng" is actually selected.
    await page.locator('select[name="status"]').selectOption("inactive");
    await expect(
      page.getByText(/Nên giao lại trước khi ngừng hoạt động/)
    ).toBeVisible();
    const href = await page
      .getByRole("link", { name: "Xem danh sách" })
      .last()
      .getAttribute("href");
    expect(href).toContain("/tasks?filters=");
  });

  test("activates and deactivates from the row action menu", async ({
    page,
  }) => {
    const name = e2eName("rowact");
    await createEmployeeViaUi(page, { name, phone: e2ePhone() });
    await page.goto("/employees");
    await page.getByPlaceholder("Tìm theo tên...").fill(name);
    // The URL filter is throttle-debounced; wait until the server-rendered
    // table actually narrowed down before touching the row.
    await expect(page).toHaveURL(/filters=/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    const row = page.locator("tr", { hasText: name });

    await row.getByRole("button", { name: "Thao tác" }).click();
    await page.getByRole("menuitem", { name: "Kích hoạt" }).click();
    await expect(
      row.getByText("Đang hoạt động", { exact: true })
    ).toBeVisible();

    await row.getByRole("button", { name: "Thao tác" }).click();
    await page.getByRole("menuitem", { name: "Ngừng hoạt động" }).click();
    await expect(row.getByText("Ngừng", { exact: true })).toBeVisible();
  });

  test("bulk deactivates selected rows", async ({ page }) => {
    const tag = `bulk${Date.now().toString(36)}`;
    const a = e2eName(tag);
    const b = e2eName(tag);
    await createEmployeeViaUi(page, { name: a, phone: e2ePhone() });
    await createEmployeeViaUi(page, { name: b, phone: e2ePhone() });
    await page.goto("/employees");
    await page.getByPlaceholder("Tìm theo tên...").fill(`E2E ${tag}`);
    await expect(page).toHaveURL(/filters=/);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.locator("thead").getByRole("checkbox").click();
    await expect(page.getByText(/Đã chọn 2 nhân viên/)).toBeVisible();
    await page.getByRole("button", { name: "Ngừng hoạt động" }).click();
    await expect(page.getByText(/Đã chọn 2 nhân viên/)).toHaveCount(0);
    await expect(page.locator("tr", { hasText: a }).getByText("Ngừng", { exact: true })).toBeVisible();
    await expect(page.locator("tr", { hasText: b }).getByText("Ngừng", { exact: true })).toBeVisible();
  });

  test("filters by name and sorts server-side", async ({ page }) => {
    const name = e2eName("filter");
    await createEmployeeViaUi(page, { name, phone: e2ePhone() });
    await page.goto("/employees");
    await page.getByPlaceholder("Tìm theo tên...").fill(name);
    await expect(page).toHaveURL(/filters=/);
    await expect(page.locator("tr", { hasText: name })).toBeVisible();

    await page.getByRole("button", { name: "Tên", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: "Giảm dần" }).click();
    await expect(page).toHaveURL(/sort=name\.desc/);
  });

  test("changes page size through the table pagination", async ({ page }) => {
    await page.goto("/employees");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "20" }).click();
    await expect(page).toHaveURL(/perPage=20/);
  });

  test("assignee options mark employees without Zalo", async ({ page }) => {
    const phone = e2ePhone();
    await createEmployeeViaUi(page, { name: e2eName("nozalo"), phone });
    await page.goto("/tasks/new");
    const options = await page
      .locator('select[name="assigneeId"] option')
      .allInnerTexts();
    expect(options.some((option) => option.includes("chưa kết nối Zalo"))).toBe(
      true
    );
  });
});

test.describe("employee detail tasks", () => {
  test("lists the assigned task and shows the open counter", async ({ page }) => {
    const phone = e2ePhone();
    const id = await createEmployeeViaUi(page, {
      name: e2eName("list"),
      phone,
    });
    const title = `E2E listed ${Date.now()}`;
    const taskId = await createTaskViaUi(page, { title, assigneeId: id });
    await page.goto(`/employees/${id}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByText("1/1 việc mở")).toBeVisible();
    const row = await taskRow(taskId);
    expect(row?.status).toBe("assigned");
  });
});
