# TDD 规范

本仓库严格遵循测试驱动开发（TDD）流程。所有新功能和 bug 修复必须先写测试，再写实现。

## 流程

### 1. 先写失败测试

在编写任何实现代码之前，先写一个会失败的测试，锁定你期望的行为：

```ts
// ❌ 错误：先写实现再补测试
export function normalizePath(path: string) { ... }
// 然后才写测试...

// ✅ 正确：先写失败测试
it("removes leading ./ from file paths", () => {
  expect(normalizePath("./src/a.ts")).toBe("src/a.ts");
});
```

### 2. 运行测试确认失败

执行测试命令，确认测试确实失败（不是因为其他原因）：

```bash
pnpm --filter @app/review-backend test path/to/test.ts
```

失败信息应该指向"函数未定义"或"行为不符合预期"，而不是语法错误。

### 3. 写最小实现

只写让测试通过的最少代码。不要添加测试没有覆盖的功能。

### 4. 运行测试确认通过

```bash
pnpm --filter @app/review-backend test path/to/test.ts
```

### 5. 重构

测试通过后，可以重构代码。重构后再次运行测试确认没有回归。

## 测试文件位置

- 后端测试：`packages/review-backend/tests/`
- 前端测试：`packages/review-app/tests/`
- E2E 测试：`packages/review-app/tests/e2e/`

## 测试命名规范

```ts
// 使用 describe + it，描述行为而非实现
describe("normalizeProviderOutput", () => {
  it("converts JSON output into a review finding", () => { ... });
  it("returns empty list for invalid JSON", () => { ... });
  it("downgrades finding without line numbers to file-level", () => { ... });
});
```

## Mock 规范

- LLM 调用必须 mock，不依赖真实模型输出。
- git 操作在单元测试中 mock，在集成测试中使用临时仓库。
- Electron IPC 在前端测试中 mock（`window.reviewWorkbenchApi`）。

## 禁止事项

- 不要在没有测试的情况下提交实现代码。
- 不要跳过"运行测试确认失败"步骤。
- 不要写测试之后不运行就提交。
