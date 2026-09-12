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
    expect(code).toMatch(/^[BCDGHKLMNPQRSTVX]{4}$/);

    const zaloUserId = `e2e-zalo-${uniq()}`;
    await simulatorOpen(page, zaloUserId);
    // The code is found anywhere in the message, not only on its own.
    await simulatorSendText(page, `Mã mời của tôi là ${code} nhé`);
    await expect(page.getByText(/Đã kết nối tài khoản/).first()).toBeVisible();

    await page.goto(`/employees/${employeeId}`);
    await expect(page.getByText("Đã kết nối").first()).toBeVisible();
    await expect(page.getByText(zaloUserId)).toBeVisible();

    await page.getByRole("button", { name: "Hủy kết nối" }).click();
    await expect(page.getByText("Chưa kết nối Zalo.")).toBeVisible();
  });

  test("treats an unlinked user as a client, not an employee", async ({
    page,
  }) => {
    const zaloUserId = `e2e-zalo-${uniq()}`;
    await simulatorOpen(page, zaloUserId);
    await simulatorSendText(page, "Tôi muốn tư vấn dịch vụ");
    await expect(
      page.getByText(/Cảm ơn bạn đã liên hệ Đời Sống Xanh/).first()
    ).toBeVisible();

    // The message shows up in the portal client inbox after a reload.
    await page.reload();
    await expect(page.getByText("Tin nhắn khách hàng")).toBeVisible();
    await expect(
      page.getByText("Tôi muốn tư vấn dịch vụ").first()
    ).toBeVisible();
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
  test("start -> done -> manager verifies", async ({ page }) => {
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

    // Assignment already puts the task in "Cần làm"; the employee starts
    // directly, there is no acceptance step.
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe(
      "assigned"
    );

    await simulatorSendText(page, `task:start:${taskId}`);
    await expect(page.getByText(/Đã bắt đầu công việc/).first()).toBeVisible();
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe(
      "in_progress"
    );

    await simulatorSendText(page, `task:done:${taskId}`);
    await expect(
      page.getByText(/đã được báo hoàn thành/).first()
    ).toBeVisible();
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe("done");
    expect((await taskRow(taskId))?.completed_at).not.toBeNull();

    await page.goto(`/tasks/${taskId}`);
    await expect(
      page.locator("main main").getByText("Đã xong", { exact: true }).first()
    ).toBeVisible();

    // Every Zalo message is recorded with its delivery state.
    await expect(page.getByText("Thông báo Zalo").first()).toBeVisible();
    await expect(page.getByText("Đã gửi Zalo").first()).toBeVisible();
    await page.getByRole("button", { name: "Xác nhận hoàn thành" }).click();
    await expect(
      page.getByText("Đã xác nhận hoàn thành").first()
    ).toBeVisible();
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

  test("records a failed delivery when the employee is not linked", async ({
    page,
  }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("nolink"),
      phone: e2ePhone(),
    });

    // Assigning to an invited employee is allowed, but there is no Zalo id,
    // so the timeline must say the notification never went out.
    await createTaskViaUi(page, {
      title: e2eTitle("nolink"),
      assigneeId: employeeId,
    });

    // The create form warns immediately, and the timeline keeps the reason.
    await expect(page.getByText(/chưa gửi được Zalo/).first()).toBeVisible();
    await expect(page.getByText("Thông báo Zalo").first()).toBeVisible();
    await expect(page.getByText(/Gửi Zalo thất bại/).first()).toBeVisible();
    await expect(page.getByText(/nhân viên chưa kết nối Zalo/).first()).toBeVisible();
  });

  test("routes free messages when several tasks are open", async ({ page }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("multi"),
      phone: e2ePhone(),
    });
    const zaloUserId = `e2e-zalo-${uniq()}`;

    await page.getByPlaceholder("Zalo user id").fill(zaloUserId);
    await page.getByRole("button", { name: "Gắn" }).click();
    await expect(page.getByText("Đã kết nối").first()).toBeVisible();

    const titleA = e2eTitle("multi-a");
    const titleB = e2eTitle("multi-b");
    const taskA = await createTaskViaUi(page, {
      title: titleA,
      assigneeId: employeeId,
    });
    const taskB = await createTaskViaUi(page, {
      title: titleB,
      assigneeId: employeeId,
    });

    await simulatorOpen(page, zaloUserId);
    await simulatorSendText(page, "đã tưới xong");
    await expect(page.getByText(/Trả lời SỐ/).first()).toBeVisible();
    await expect(page.getByText(titleA, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(titleB, { exact: false }).first()).toBeVisible();

    // Task B was assigned second, so it is option 2.
    await simulatorSendText(page, "2");
    await expect(
      page.getByText(new RegExp(`Đã ghi nhận vào việc.*${titleB}`)).first()
    ).toBeVisible();

    // The pick sticks: the next note goes to B without a new list.
    await simulatorSendText(page, "thêm một ghi chú");
    await expect(
      page.getByText(new RegExp(`Đã ghi nhận vào việc.*${titleB}`)).nth(1)
    ).toBeVisible();

    // A photo follows the same active task.
    await page.getByRole("button", { name: /Gửi ảnh/ }).click();
    await expect(page.getByText(/Đã ghi nhận vào việc/).last()).toBeVisible();

    await page.goto(`/tasks/${taskB}`);
    await expect(page.getByText("đã tưới xong")).toBeVisible();
    await expect(page.getByText("thêm một ghi chú")).toBeVisible();
    await expect(page.locator('img[alt="đính kèm"]')).toHaveCount(1);

    await page.goto(`/tasks/${taskA}`);
    await expect(page.getByText("đã tưới xong")).toHaveCount(0);
  });
});
