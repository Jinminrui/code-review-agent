import { buildReviewSummary } from "./build-review-summary.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import { filterReviewFiles } from "../infrastructure/filter/file-filter.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { logger } from "../infrastructure/logging/logger.js";
import { normalizeProviderOutput } from "../infrastructure/llm/normalize-provider-output.js";
import { generateReviewPlan } from "../infrastructure/llm/plan-generator.js";
import { relocateFinding } from "../infrastructure/llm/line-relocator.js";
import { runToolUseLoop } from "../infrastructure/llm/tool-use-loop.js";
import { buildReviewUnits } from "../infrastructure/planner/review-unit-planner.js";

type SessionStore = {
  createSession(input: {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
  }): Promise<{ sessionId: string }>;
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
};

export async function* streamReviewSession(
  input: {
    input: ReviewSessionInput;
    dependencies: {
      provider: Pick<LlmProvider, "id" | "review" | "chat">;
      gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff" | "lsFiles" | "grep">;
      sessionStore: SessionStore;
    };
  }
): AsyncGenerator<ReviewSessionEvent, void, void> {
  const { repositoryPath, baseRef, targetRef, contextBudgetTokens } = input.input;

  const session = await input.dependencies.sessionStore.createSession({
    repositoryPath,
    baseRef,
    targetRef
  });
  const log = logger.child({ sid: session.sessionId.slice(0, 8) });
  log.info(`${repositoryPath} [${baseRef}...${targetRef}] 开始审查`);

  const startedEvent = {
    type: "session-started" as const,
    sessionId: session.sessionId
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
  yield startedEvent;

  // Read diff
  const diffStartTime = Date.now();
  const allDiffFiles = targetRef === "WORKSPACE"
    ? await input.dependencies.gitClient.readWorkspaceDiff()
    : await input.dependencies.gitClient.readDiff(baseRef, targetRef);
  log.info(`读取 diff 完成: ${allDiffFiles.length} 个文件, ${Date.now() - diffStartTime}ms`);

  // Filter files
  const diffFiles = filterReviewFiles({
    files: allDiffFiles as ParsedDiffFile[],
    config: {
      extensionAllowlist: [
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".go", ".py", ".java", ".kt", ".rs", ".c", ".cpp", ".h", ".hpp",
        ".rb", ".php", ".swift", ".dart", ".lua", ".sh", ".bash",
        ".sql", ".graphql", ".proto",
        ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".css", ".scss",
        ".md", ".txt"
      ],
      excludePatterns: [
        "**/node_modules/**", "**/vendor/**", "**/*.lock",
        "**/dist/**", "**/build/**", "**/*.min.js", "**/*.min.css"
      ],
      excludeTestFiles: false
    }
  });

  const units = buildReviewUnits(diffFiles);
  const findings: ReviewFinding[] = [];
  const diffByFile: Record<string, { original: string; modified: string }> = {};
  let hasUnitFailure = false;

  for (const unit of units) {
    const unitLog = log.child({ file: unit.primaryFile });
    try {
      const context = await collectUnitContext({
        gitClient: input.dependencies.gitClient,
        baseRef,
        targetRef,
        unit
      });
      diffByFile[unit.primaryFile] = {
        original: context.beforeContent,
        modified: context.afterContent
      };

      let unitFindings: ReviewFinding[];
      const t0 = Date.now();

      if (input.dependencies.provider.chat) {
        // Generate plan for large changes
        const diffText = buildDiffText(unit.primaryFile, diffFiles);
        const diffLineCount = diffText.split("\n").length;
        let planGuidance = "";

        if (diffLineCount > 50) {
          const plan = await generateReviewPlan({
            provider: input.dependencies.provider,
            diff: diffText,
            fileContent: context.afterContent
          });
          planGuidance = `\n\nReview plan:\n- Risk points: ${plan.riskPoints.map((r) => `${r.area} (${r.riskLevel})`).join(", ") || "none identified"}\n- Strategy: ${plan.reviewStrategy}\n- Complexity: ${plan.estimatedComplexity}`;
          unitLog.info(`计划生成: ${plan.riskPoints.length} 个风险点, 复杂度=${plan.estimatedComplexity}`);
        }

        // Tool-use loop
        const systemPrompt = buildSystemPrompt(unit.primaryFile) + planGuidance;
        const initialUserMessage = buildReviewPrompt({
          filePath: unit.primaryFile,
          diff: diffText,
          beforeContent: context.beforeContent,
          afterContent: context.afterContent,
          contextBudgetTokens
        });

        const loopResult = await runToolUseLoop({
          provider: input.dependencies.provider,
          systemPrompt,
          initialUserMessage,
          toolExecutorContext: {
            gitClient: input.dependencies.gitClient,
            baseRef,
            targetRef,
            repositoryPath,
            diffFiles
          }
        });
        unitFindings = loopResult.findings;
        unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${loopResult.totalRounds} 轮, ${Date.now() - t0}ms`);
      } else {
        // Single-shot path
        const prompt = JSON.stringify({ task: "review", contextBudgetTokens, unit, context });
        const result = await input.dependencies.provider.review({ prompt });
        unitFindings = normalizeProviderOutput({ content: result.content, fallbackFile: unit.primaryFile });
        unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${Date.now() - t0}ms`);
      }

      // Relocate findings without line numbers
      unitFindings = await Promise.all(
        unitFindings.map((finding) =>
          finding.startLine
            ? Promise.resolve(finding)
            : relocateFinding({
                provider: input.dependencies.provider,
                finding,
                fileContent: context.afterContent
              })
        )
      );

      findings.push(...unitFindings);

      const unitCompletedEvent = {
        type: "unit-completed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        findingsCount: unitFindings.length,
        findings: unitFindings
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitCompletedEvent);
      yield unitCompletedEvent;
    } catch (error) {
      hasUnitFailure = true;
      unitLog.warn(`审查失败: ${error instanceof Error ? error.message : "未知错误"}`);
      const unitFailedEvent = {
        type: "unit-failed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        reason: error instanceof Error ? error.message : "unknown error"
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitFailedEvent);
      yield unitFailedEvent;
    }
  }

  const finishedEvent = {
    type: "session-finished" as const,
    sessionId: session.sessionId,
    totalFindings: findings.length,
    status: hasUnitFailure ? ("partial" as const) : ("finished" as const)
  };
  const summary = buildReviewSummary({
    findings,
    changedFiles: units.map((unit) => unit.primaryFile)
  });
  await input.dependencies.sessionStore.appendEvent(session.sessionId, finishedEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: finishedEvent.status,
    repositoryPath,
    baseRef,
    targetRef,
    summary,
    findings,
    diffByFile
  });

  log.info(`审查结束: ${finishedEvent.status}, ${findings.length} 个问题, ${summary.highSeverityCount} 个高风险`);
  yield finishedEvent;
}

function buildSystemPrompt(filePath: string): string {
  return `你是一位资深代码审查专家。请仔细审查文件 "${filePath}" 的代码变更。

你的任务：
1. 分析 diff 中的潜在 bug、安全问题、性能问题和代码质量问题。
2. 需要时使用工具获取更多上下文（读取文件、搜索代码等）。
3. 使用 code_comment 工具提交发现的问题。
4. 审查完成后调用 task_done。

要求：
- 关注真实问题，不要纠结代码风格。
- 提供具体的行号引用和证据。
- 考虑边界情况和错误处理。
- 全面但避免误报。
- 所有输出必须使用中文。`;
}

function buildReviewPrompt(input: {
  filePath: string;
  diff: string;
  beforeContent: string;
  afterContent: string;
  contextBudgetTokens: number;
}): string {
  return `请审查文件 "${input.filePath}" 的以下代码变更：

## Diff
\`\`\`diff
${input.diff}
\`\`\`

## 变更后的文件内容
\`\`\`
${input.afterContent.slice(0, 50000)}
\`\`\`

请审查这些变更并报告发现的问题。`;
}

function buildDiffText(filePath: string, diffFiles: ParsedDiffFile[]): string {
  const file = diffFiles.find((f) => f.path === filePath);
  if (!file) return "";

  return file.hunks
    .map((h) => {
      const lines = h.lines.map((l) => {
        const prefix = l.type === "added" ? "+" : l.type === "deleted" ? "-" : " ";
        return prefix + l.content;
      });
      return `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${lines.join("\n")}`;
    })
    .join("\n");
}
