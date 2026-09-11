import { test, expect } from "@playwright/test";

const PAGES: [path: string, heading: string][] = [
  ["/dashboard", "Tổng quan"],
  ["/tasks", "Công việc"],
  ["/tasks/new", "Tạo công việc"],
  ["/employees", "Nhân viên"],
  ["/kanban", "Bảng tiến độ"],
  ["/settings/zalo", "Zalo OA"],
];

test.describe("portal pages", () => {
  for (const [path, heading] of PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      // SidebarInset is itself a <main>; the page title lives in the inner one.
      await expect(
        page
          .locator("main main")
          .getByRole("heading", { name: heading, level: 1 })
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
