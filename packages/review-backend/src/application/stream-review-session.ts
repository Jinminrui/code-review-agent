import { buildReviewSummary } from "./build-review-summary.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { logger } from "../infrastructure/logging/logger.js";
import { normalizeProviderOutput } from "../infrastructure/llm/normalize-provider-output.js";
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

  const diffStartTime = Date.now();
  const diffFiles = targetRef === "WORKSPACE"
    ? await input.dependencies.gitClient.readWorkspaceDiff()
    : await input.dependencies.gitClient.readDiff(baseRef, targetRef);
  log.info(`读取 diff 完成: ${diffFiles.length} 个文件, ${Date.now() - diffStartTime}ms`);

  const units = buildReviewUnits(diffFiles as ParsedDiffFile[]);
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
        const systemPrompt = buildSystemPrompt(unit.primaryFile);
        const initialUserMessage = buildReviewPrompt({
          filePath: unit.primaryFile,
          diff: buildDiffText(unit.primaryFile, diffFiles),
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
            repositoryPath
          }
        });
        unitFindings = loopResult.findings;
        unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${loopResult.totalRounds} 轮, ${Date.now() - t0}ms`);
      } else {
        const prompt = JSON.stringify({
          task: "review",
          contextBudgetTokens,
          unit,
          context
        });
        const result = await input.dependencies.provider.review({ prompt });
        unitFindings = normalizeProviderOutput({
          content: result.content,
          fallbackFile: unit.primaryFile
        });
        unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${Date.now() - t0}ms`);
      }

      findings.push(...unitFindings);

      const unitCompletedEvent = {
        type: "unit-completed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        findingsCount: unitFindings.length
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
  return `You are an expert code reviewer. Review the code changes in file "${filePath}" carefully.

Your task:
1. Analyze the diff for potential bugs, security issues, performance problems, and code quality concerns.
2. Use the provided tools to gather additional context when needed (read files, search code, etc.).
3. Submit your findings using the code_comment tool.
4. Call task_done when you have finished reviewing.

Guidelines:
- Focus on real issues, not style preferences.
- Provide specific line references and evidence.
- Consider edge cases and error handling.
- Be thorough but avoid false positives.`;
}

function buildReviewPrompt(input: {
  filePath: string;
  diff: string;
  beforeContent: string;
  afterContent: string;
  contextBudgetTokens: number;
}): string {
  return `Review the following code changes in "${input.filePath}":

## Diff
\`\`\`diff
${input.diff}
\`\`\`

## File Content (after changes)
\`\`\`
${input.afterContent.slice(0, 50000)}
\`\`\`

Please review these changes and report any issues found.`;
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
