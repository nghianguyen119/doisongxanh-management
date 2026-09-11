import { expect, type Page } from "@playwright/test";

export async function createEmployeeViaUi(
  page: Page,
  input: { name: string; phone: string; position?: string }
) {
  await page.goto("/employees");
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();
  const drawer = page.locator('[data-slot="drawer-popup"]');
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Tên").fill(input.name);
  await drawer.getByLabel("Số điện thoại").fill(input.phone);
  if (input.position) {
    await drawer.getByLabel("Vị trí").fill(input.position);
  }
  await drawer.getByRole("button", { name: "Thêm nhân viên" }).click();
  await page.waitForURL(/\/employees\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() as string;
}

export async function createTaskViaUi(
  page: Page,
  input: {
    title: string;
    assigneeId?: string;
    priority?: "low" | "normal" | "high" | "urgent";
  }
) {
  await page.goto("/tasks/new");
  await page.getByLabel("Tiêu đề").fill(input.title);
  if (input.priority) {
    await page.getByLabel("Ưu tiên").selectOption(input.priority);
  }
  if (input.assigneeId) {
    await page.getByLabel("Giao cho").selectOption(input.assigneeId);
  }
  await page.getByRole("button", { name: "Tạo công việc" }).click();
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() as string;
}

export async function simulatorOpen(page: Page, zaloUserId: string) {
  await page.goto("/settings/zalo");
  await page.getByPlaceholder("hoặc nhập id mới").fill(zaloUserId);
  await expect(page.getByText("Mô phỏng Zalo")).toBeVisible();
}

export async function simulatorSendText(page: Page, text: string) {
  await page.getByPlaceholder("Nhập tin nhắn của nhân viên…").fill(text);
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
}

export async function dragCard(page: Page, taskId: string, toColumn: string) {
  // Scope to the board: an in-flight drop animation keeps a copy of the card
  // in the drag overlay portal.
  const card = page.locator(
    `[data-slot="kanban-board"] [data-slot="kanban-item"][data-value="${taskId}"]`
  );
  const target = page.locator(
    `[data-slot="kanban-column"][data-value="${toColumn}"] [data-slot="kanban-column-content"]`
  );
  // Cards are disabled while a previous move is still saving.
  await expect(card).not.toHaveAttribute("data-disabled", "true");
  // The drop animation keeps a portal copy of the card on top of the board;
  // pressing through it would swallow the next drag.
  await expect(
    page.locator('[data-slot="kanban-item"][data-dragging="true"]')
  ).toHaveCount(0);
  await card.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const targetBox = await target.boundingBox();
  if (!cardBox || !targetBox) throw new Error("missing bounding boxes");
  const sx = cardBox.x + cardBox.width / 2;
  const sy = cardBox.y + cardBox.height - 6;
  const tx = targetBox.x + targetBox.width / 2;
  const ty = targetBox.y + Math.min(60, targetBox.height / 2);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 15, sy - 5, { steps: 5 });
  await page.mouse.move(tx, ty, { steps: 25 });
  await page.mouse.move(tx, ty + 4, { steps: 5 });
  await page.mouse.up();
}

export async function cardColumn(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const item = document.querySelector(
      `[data-slot="kanban-board"] [data-slot="kanban-item"][data-value="${id}"]`
    );
    return (
      item?.closest('[data-slot="kanban-column"]')?.getAttribute("data-value") ??
      null
    );
  }, taskId);
}
