import { expect, test } from "@playwright/test";

test("launches a session and opens the detail workbench", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await page.getByLabel("仓库").selectOption("/repo");
  await page.getByLabel("基线分支").selectOption("main");
  await page.getByLabel("目标分支").selectOption("feature");
  await page.getByRole("button", { name: "开始 Code Review" }).click();
  await expect(page.getByText("当前状态：Completed")).toBeVisible();

  await page.goto("http://127.0.0.1:4173/#/sessions");
  await expect(page.getByText("Code Review 历史")).toBeVisible();
});
