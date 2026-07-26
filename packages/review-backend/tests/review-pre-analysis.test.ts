/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it } from "vitest";
import {
  buildReviewPreAnalysis,
  reviewPreAnalysisSchema
} from "../src/application/review-pre-analysis.js";
import type { ParsedDiffFile } from "../src/infrastructure/git/parse-unified-diff.js";

function diffFile(overrides: Partial<ParsedDiffFile> & Pick<ParsedDiffFile, "path">): ParsedDiffFile {
  return {
    isNew: false,
    isDeleted: false,
    isBinary: false,
    insertions: 0,
    deletions: 0,
    hunks: [],
    ...overrides
  };
}

describe("buildReviewPreAnalysis", () => {
  it("builds sorted file facts, totals, languages and sensitive path hints", () => {
    const result = buildReviewPreAnalysis([
      diffFile({ path: "src/auth/session.ts", insertions: 8, deletions: 2 }),
      diffFile({ path: "assets/logo.png", isBinary: true }),
      diffFile({ path: "db/migrations/001-create-user.sql", isNew: true, insertions: 4 }),
      diffFile({ path: "package.json", insertions: 1, deletions: 1 })
    ]);

    expect(result.files).toEqual([
      {
        path: "assets/logo.png",
        changeType: "modified",
        isBinary: true,
        language: "image",
        insertions: 0,
        deletions: 0
      },
      {
        path: "db/migrations/001-create-user.sql",
        changeType: "added",
        isBinary: false,
        language: "sql",
        insertions: 4,
        deletions: 0
      },
      {
        path: "package.json",
        changeType: "modified",
        isBinary: false,
        language: "json",
        insertions: 1,
        deletions: 1
      },
      {
        path: "src/auth/session.ts",
        changeType: "modified",
        isBinary: false,
        language: "typescript",
        insertions: 8,
        deletions: 2
      }
    ]);
    expect(result.totals).toEqual({
      filesChanged: 4,
      insertions: 13,
      deletions: 3
    });
    expect(result.sensitivePathHints).toEqual([
      { path: "db/migrations/001-create-user.sql", categories: ["database"] },
      { path: "package.json", categories: ["dependency"] },
      { path: "src/auth/session.ts", categories: ["authentication"] }
    ]);
    expect(result.sensitivePathHints.every((hint) => !("riskLevel" in hint))).toBe(true);
  });

  it("only classifies current changed paths", () => {
    const result = buildReviewPreAnalysis([
      diffFile({
        path: "docs/overview.md",
        oldPath: "src/auth/legacy.ts"
      }),
      diffFile({ path: "src/plain.ts" })
    ]);

    expect(result.sensitivePathHints).toEqual([]);
    expect(result.sensitivePathHints.every((hint) => result.files.some((file) => file.path === hint.path))).toBe(true);
  });

  it("matches sensitive paths case-insensitively including Dockerfile variants", () => {
    const result = buildReviewPreAnalysis([
      diffFile({ path: "SRC/AUTH/SESSION.TS" }),
      diffFile({ path: "PACKAGE.JSON" }),
      diffFile({ path: "Dockerfile.dev" }),
      diffFile({ path: "DOCKERFILE" })
    ]);

    expect(result.sensitivePathHints).toEqual([
      { path: "DOCKERFILE", categories: ["deployment"] },
      { path: "Dockerfile.dev", categories: ["deployment"] },
      { path: "PACKAGE.JSON", categories: ["dependency"] },
      { path: "SRC/AUTH/SESSION.TS", categories: ["authentication"] }
    ]);
  });

  it("does not treat a generic policy module as an authorization hint", () => {
    const result = buildReviewPreAnalysis([diffFile({ path: "src/retry/policy.ts" })]);

    expect(result.sensitivePathHints).toEqual([]);
  });

  it("does not treat generic schema paths as database hints", () => {
    const result = buildReviewPreAnalysis([
      diffFile({ path: "src/zod/schema.ts" }),
      diffFile({ path: "src/api/schema.graphql" }),
      diffFile({ path: "config/schema.json" })
    ]);

    expect(result.sensitivePathHints).toEqual([
      { path: "config/schema.json", categories: ["configuration"] }
    ]);
  });

  it("keeps database hints for explicit database contexts", () => {
    const result = buildReviewPreAnalysis([
      diffFile({ path: "src/sql/query.ts" }),
      diffFile({ path: "src/database/schema.ts" }),
      diffFile({ path: "migrations/2026-add-user.ts" }),
      diffFile({ path: "queries/users.sql" }),
      diffFile({ path: "src/tasks/user-migration.ts" })
    ]);

    expect(result.sensitivePathHints).toEqual([
      { path: "migrations/2026-add-user.ts", categories: ["database"] },
      { path: "queries/users.sql", categories: ["database"] },
      { path: "src/database/schema.ts", categories: ["database"] },
      { path: "src/sql/query.ts", categories: ["database"] },
      { path: "src/tasks/user-migration.ts", categories: ["database"] }
    ]);
  });

  it("keeps multiple sensitive categories in a stable order", () => {
    const files = [diffFile({ path: "src/auth/config/policy.ts" })];

    expect(buildReviewPreAnalysis(files).sensitivePathHints).toEqual([
      {
        path: "src/auth/config/policy.ts",
        categories: ["authentication", "authorization", "configuration"]
      }
    ]);
    expect(buildReviewPreAnalysis(files).sensitivePathHints).toEqual(
      buildReviewPreAnalysis(files).sensitivePathHints
    );
  });

  it("reports deleted and renamed file facts", () => {
    const result = buildReviewPreAnalysis([
      diffFile({ path: "src/removed.ts", isDeleted: true, deletions: 3 }),
      diffFile({ path: "src/renamed.ts", oldPath: "src/original.ts" })
    ]);

    expect(result.files).toEqual([
      {
        path: "src/removed.ts",
        changeType: "deleted",
        isBinary: false,
        language: "typescript",
        insertions: 0,
        deletions: 3
      },
      {
        path: "src/renamed.ts",
        oldPath: "src/original.ts",
        changeType: "renamed",
        isBinary: false,
        language: "typescript",
        insertions: 0,
        deletions: 0
      }
    ]);
  });

  it("returns output accepted by the public schema", () => {
    const result = buildReviewPreAnalysis([
      diffFile({ path: "src/auth/session.ts", insertions: 1 })
    ]);

    expect(reviewPreAnalysisSchema.safeParse(result)).toEqual({
      success: true,
      data: result
    });
  });

  it("rejects blank current and old paths", () => {
    expect(() => buildReviewPreAnalysis([diffFile({ path: "" })])).toThrow(
      "变更文件路径不能为空"
    );
    expect(() =>
      buildReviewPreAnalysis([diffFile({ path: "src/current.ts", oldPath: "\t" })])
    ).toThrow("变更文件旧路径不能为空");
  });

  it("rejects values that would produce schema-invalid output", () => {
    expect(() =>
      buildReviewPreAnalysis([diffFile({ path: "src/a.ts", insertions: -1 })])
    ).toThrow();
  });

  it("rejects blank paths through schema safeParse", () => {
    const invalidResult = {
      files: [
        {
          path: " ",
          changeType: "modified",
          isBinary: false,
          language: "unknown",
          insertions: 0,
          deletions: 0
        }
      ],
      totals: { filesChanged: 1, insertions: 0, deletions: 0 },
      sensitivePathHints: []
    };

    expect(reviewPreAnalysisSchema.safeParse(invalidResult).success).toBe(false);
  });

  it("returns the same result without mutating the input", () => {
    const files = [
      diffFile({ path: "z.ts", oldPath: "old-z.ts", insertions: 1 }),
      diffFile({ path: "a.ts", deletions: 1 })
    ];
    const originalFiles = structuredClone(files);

    const first = buildReviewPreAnalysis(files);
    const second = buildReviewPreAnalysis(files);

    expect(second).toEqual(first);
    expect(files).toEqual(originalFiles);

    first.files[0]!.path = "changed-after-analysis.ts";
    expect(files).toEqual(originalFiles);
  });

  it("returns an empty change set for an empty diff", () => {
    expect(buildReviewPreAnalysis([])).toEqual({
      files: [],
      totals: {
        filesChanged: 0,
        insertions: 0,
        deletions: 0
      },
      sensitivePathHints: []
    });
  });
});
