import { test, expect } from "@playwright/test";
import { cleanupE2E, e2eName, e2ePhone, e2eTitle, taskRow } from "./util";
import {
  cardColumn,
  createEmployeeViaUi,
  createTaskViaUi,
  dragCard,
} from "./ui";

test.use({ viewport: { width: 2200, height: 1000 } });
test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanupE2E();
});

test.describe("kanban board", () => {
  test("renders the five status columns", async ({ page }) => {
    await page.goto("/kanban");
    for (const title of [
      "Cần làm",
      "Đang làm",
      "Sự cố",
      "Chờ xác nhận",
      "Hoàn thành",
    ]) {
      await expect(
        page.getByRole("heading", { name: title, level: 2 })
      ).toBeVisible();
    }
    await expect(page.getByText("Bảng tiến độ").first()).toBeVisible();
  });

  test("drag assigned -> done records completed_at, then verifies", async ({
    page,
  }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("kb"),
      phone: e2ePhone(),
    });
    const title = e2eTitle("kb");
    const taskId = await createTaskViaUi(page, { title, assigneeId: employeeId });

    await page.goto("/kanban");
    await expect(
      page.locator(`[data-slot="kanban-item"][data-value="${taskId}"]`)
    ).toBeVisible();
    expect(await cardColumn(page, taskId)).toBe("assigned");

    await dragCard(page, taskId, "done");
    await expect.poll(() => cardColumn(page, taskId)).toBe("done");
    await expect.poll(async () => (await taskRow(taskId))?.status).toBe("done");
    expect((await taskRow(taskId))?.completed_at).not.toBeNull();

    await dragCard(page, taskId, "verified");
    await expect.poll(() => cardColumn(page, taskId)).toBe("verified");
    await expect
      .poll(async () => (await taskRow(taskId))?.status)
      .toBe("verified");
  });

  test("refuses to move an unassigned card forward", async ({ page }) => {
    const title = e2eTitle("kbdraft");
    const taskId = await createTaskViaUi(page, { title });

    await page.goto("/kanban");
    expect(await cardColumn(page, taskId)).toBe("assigned");
    await dragCard(page, taskId, "done");
    await expect(page.locator("[data-sonner-toast]").first()).toContainText(
      /Cần giao việc cho nhân viên/
    );
    await expect.poll(() => cardColumn(page, taskId)).toBe("assigned");
    expect((await taskRow(taskId))?.status).toBe("assigned");
    expect((await taskRow(taskId))?.assignee_id).toBeNull();
  });

  test("a failed move reverts with a toast instead of crashing", async ({
    page,
  }) => {
    const employeeId = await createEmployeeViaUi(page, {
      name: e2eName("kbabort"),
      phone: e2ePhone(),
    });
    const title = e2eTitle("kbabort");
    const taskId = await createTaskViaUi(page, { title, assigneeId: employeeId });

    await page.route("**/kanban", (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        request.headers()["next-action"]
      ) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto("/kanban");
    expect(await cardColumn(page, taskId)).toBe("assigned");
    await dragCard(page, taskId, "done");
    await expect(page.locator("[data-sonner-toast]").first()).toContainText(
      /Không thể lưu thay đổi/
    );
    await expect.poll(() => cardColumn(page, taskId)).toBe("assigned");
    await expect(page.locator('[data-slot="kanban"]')).toBeVisible();
    expect((await taskRow(taskId))?.status).toBe("assigned");
  });
});
