import { expect, test } from "@playwright/test";
test("launches a session and opens the detail workbench", async ({ page }) => {
    await page.goto("http://127.0.0.1:4173");
    await page.getByLabel("仓库").selectOption("/repo");
    await page.getByLabel("Base 分支").selectOption("main");
    await page.getByLabel("Target 分支").selectOption("feature");
    await page.getByRole("button", { name: "开始审查" }).click();
    await expect(page.getByText("当前状态：finished")).toBeVisible();
    await page.goto("http://127.0.0.1:4173/#/sessions");
    await expect(page.getByText("历史会话")).toBeVisible();
});
