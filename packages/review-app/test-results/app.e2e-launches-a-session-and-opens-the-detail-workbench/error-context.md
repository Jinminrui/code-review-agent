# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.e2e.spec.ts >> launches a session and opens the detail workbench
- Location: tests/app.e2e.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('仓库')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "Unexpected Application Error!" [level=2] [ref=e3]
  - heading "Cannot read properties of undefined (reading 'listRepositories')" [level=3] [ref=e4]
  - generic [ref=e5]: "TypeError: Cannot read properties of undefined (reading 'listRepositories') at Object.listRepositories (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:61:27550) at http://127.0.0.1:4173/assets/index-D5gXcj4V.js:61:29017 at di (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:92811) at im (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:108055) at Da (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:107939) at im (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:108821) at Da (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:107939) at im (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:108821) at Da (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:107939) at im (http://127.0.0.1:4173/assets/index-D5gXcj4V.js:48:108035)"
  - paragraph [ref=e6]: 💿 Hey developer 👋
  - paragraph [ref=e7]:
    - text: You can provide a way better UX than this when your app throws errors by providing your own
    - code [ref=e8]: ErrorBoundary
    - text: or
    - code [ref=e9]: errorElement
    - text: prop on your route.
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("launches a session and opens the detail workbench", async ({ page }) => {
  4  |   await page.goto("http://127.0.0.1:4173");
> 5  |   await page.getByLabel("仓库").selectOption("/repo");
     |                               ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  6  |   await page.getByLabel("Base 分支").selectOption("main");
  7  |   await page.getByLabel("Target 分支").selectOption("feature");
  8  |   await page.getByRole("button", { name: "开始审查" }).click();
  9  |   await expect(page.getByText("当前状态：finished")).toBeVisible();
  10 | 
  11 |   await page.goto("http://127.0.0.1:4173/#/sessions");
  12 |   await expect(page.getByText("历史会话")).toBeVisible();
  13 | });
  14 | 
```