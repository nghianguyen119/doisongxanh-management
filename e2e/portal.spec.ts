import { test, expect } from "@playwright/test";

const PAGES: [path: string, heading: string, level: 1 | 2][] = [
  // The dashboard leans on the header's "Tổng quan"; its first heading is the
  // status-mix tile, so it is matched at level 2 instead of the page title.
  ["/dashboard", "Tình hình công việc", 2],
  ["/tasks", "Công việc", 1],
  ["/tasks/new", "Tạo công việc", 1],
  ["/employees", "Nhân viên", 1],
  ["/kanban", "Bảng tiến độ", 1],
  ["/settings/zalo", "Zalo công ty", 1],
];

test.describe("portal pages", () => {
  for (const [path, heading, level] of PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      // SidebarInset is itself a <main>; the page content lives in the inner one.
      await expect(
        page
          .locator("main main")
          .getByRole("heading", { name: heading, level })
      ).toBeVisible();
      await expect(page.getByText("Không thực hiện được")).toHaveCount(0);
    });
  }

  test("site header shows the renamed board title", async ({ page }) => {
    await page.goto("/kanban");
    await expect(
      page.locator("header").getByText("Bảng tiến độ")
    ).toBeVisible();
  });
});
