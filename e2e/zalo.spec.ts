import { test, expect } from "@playwright/test";
import {
  cleanupE2E,
  e2eName,
  e2ePhone,
  e2eTitle,
  taskRow,
  uniq,
} from "./util";
import {
  createEmployeeViaUi,
  createTaskViaUi,
  simulatorOpen,
  simulatorSendText,
} from "./ui";

test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanupE2E();
});

test.describe("zalo linking", () => {
  test("links with an invite code and can unlink again", async ({ page }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("invite"),
      phone: e2ePhone(),
    });

    await page.getByRole("button", { name: "Tạo mã mời" }).click();
    const codeLocator = page.locator("span.font-mono.text-base").first();
    await expect(codeLocator).toBeVisible();
    const code = (await codeLocator.innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    const zaloUserId = `e2e-zalo-${uniq()}`;
    await simulatorOpen(page, zaloUserId);
    await simulatorSendText(page, code);
    await expect(page.getByText(/Đã kết nối tài khoản/).first()).toBeVisible();

    await page.goto(`/employees/${employeeId}`);
    await expect(page.getByText("Đã kết nối").first()).toBeVisible();
    await expect(page.getByText(zaloUserId)).toBeVisible();

    await page.getByRole("button", { name: "Hủy kết nối" }).click();
    await expect(page.getByText("Chưa kết nối Zalo.")).toBeVisible();
  });

  test("links by sharing a phone number", async ({ page }) => {
    const phone = e2ePhone();
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("phone"),
      phone,
    });

    const zaloUserId = `e2e-zalo-${uniq()}`;
    await simulatorOpen(page, zaloUserId);
    await page.getByPlaceholder("SĐT để chia sẻ (user_info)").fill(phone);
    await page.getByRole("button", { name: "Chia sẻ SĐT" }).click();
    await expect(
      page.getByText(/Đã xác minh số điện thoại/).first()
    ).toBeVisible();

    await page.goto(`/employees/${employeeId}`);
    await expect(page.getByText("Đã kết nối").first()).toBeVisible();
  });

  test("an inactive employee cannot link with an old code", async ({ page }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("inactive"),
      phone: e2ePhone(),
    });

    await page.getByRole("button", { name: "Tạo mã mời" }).click();
    const codeLocator = page.locator("span.font-mono.text-base").first();
    await expect(codeLocator).toBeVisible();
    const code = (await codeLocator.innerText()).trim();

    await page.locator('select[name="status"]').selectOption("inactive");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(
      page.locator("main main").getByText("Ngừng", { exact: true }).first()
    ).toBeVisible();

    await simulatorOpen(page, `e2e-zalo-${uniq()}`);
    await simulatorSendText(page, code);
    await expect(page.getByText(/đang tạm ngưng/).first()).toBeVisible();

    await page.goto(`/employees/${employeeId}`);
    await expect(page.getByText("Chưa kết nối Zalo.")).toBeVisible();
  });

  test("unfollow deactivates and follow does not reactivate", async ({
    page,
  }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("follow"),
      phone: e2ePhone(),
    });
    const zaloUserId = `e2e-zalo-${uniq()}`;

    await page.getByPlaceholder("Zalo user id").fill(zaloUserId);
    await page.getByRole("button", { name: "Gắn" }).click();
    await expect(page.getByText("Đã kết nối").first()).toBeVisible();

    await simulatorOpen(page, zaloUserId);
    await page.getByRole("button", { name: /Unfollow/ }).click();
    await page.goto(`/employees/${employeeId}`);
    await expect(
      page.locator("main main").getByText("Ngừng", { exact: true }).first()
    ).toBeVisible();

    await simulatorOpen(page, zaloUserId);
    await page.getByRole("button", { name: /Follow OA/ }).click();
    await expect(page.getByText(/đang tạm ngưng/).first()).toBeVisible();

    await page.goto(`/employees/${employeeId}`);
    await expect(
      page.locator("main main").getByText("Ngừng", { exact: true }).first()
    ).toBeVisible();
  });
});

test.describe("task lifecycle over Zalo", () => {
  test("accept -> start -> done -> manager verifies", async ({ page }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("life"),
      phone: e2ePhone(),
    });
    const zaloUserId = `e2e-zalo-${uniq()}`;

    await page.getByPlaceholder("Zalo user id").fill(zaloUserId);
    await page.getByRole("button", { name: "Gắn" }).click();
    await expect(page.getByText("Đã kết nối").first()).toBeVisible();

    const title = e2eTitle("lifecycle");
    const taskId = await createTaskViaUi(page, {
      title,
      assigneeId: employeeId,
    });

    await simulatorOpen(page, zaloUserId);

    await simulatorSendText(page, `task:accept:${taskId}`);
    await expect(page.getByText(/NHẬN việc/).first()).toBeVisible();
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe(
      "accepted"
    );

    await simulatorSendText(page, `task:start:${taskId}`);
    await expect(page.getByText(/Đã bắt đầu công việc/).first()).toBeVisible();
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe(
      "in_progress"
    );

    await simulatorSendText(page, `task:done:${taskId}`);
    await expect(page.getByText(/gửi 1 ảnh kết quả/).first()).toBeVisible();
    await simulatorSendText(page, "bỏ qua");
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe("done");
    expect((await taskRow(taskId))?.completed_at).not.toBeNull();

    await page.goto(`/tasks/${taskId}`);
    await expect(
      page.locator("main main").getByText("Đã xong", { exact: true }).first()
    ).toBeVisible();
    await page.getByRole("button", { name: "Xác nhận hoàn thành" }).click();
    await expect(
      page.locator("main main").getByText("Đã xác nhận", { exact: true }).first()
    ).toBeVisible();

    // Verified work is frozen: no edit form, no cancel.
    await expect(
      page.getByRole("button", { name: "Sửa nội dung công việc" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Huỷ công việc" })
    ).toHaveCount(0);
  });
});
