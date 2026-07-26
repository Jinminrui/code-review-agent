/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { expect, test } from "@playwright/test";

test("launches a session and opens the detail workbench", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("button", { name: "选择仓库" }).click();
  await expect(page.getByText("/repo")).toBeVisible();
  await expect(page.locator("select").first().locator("option")).toHaveCount(3);
  await page.locator("select").nth(0).selectOption("main");
  await expect(page.locator("select").nth(1).locator("option")).toHaveCount(3);
  await page.locator("select").nth(1).selectOption("feature");
  await page.getByRole("button", { name: "$ start-review" }).click();
  await expect(page.getByText("已完成").first()).toBeVisible();

  await page.goto("http://127.0.0.1:4173/#/sessions");
  await expect(page.getByText("审查历史")).toBeVisible();
});
