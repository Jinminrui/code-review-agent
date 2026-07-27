/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ChatMessage } from "../../domain/provider.js";
import type { ReviewPlan } from "../../domain/review-plan.js";
import type { ReviewPreAnalysis } from "../../application/review-pre-analysis.js";

export const REVIEW_PLAN_SYSTEM_PROMPT = `你是代码审查的 Plan 阶段，只负责生成可执行、可校验的结构化审查计划。

约束：
1. 只依据用户消息中的预分析事实、受控 diff 摘要和允许文件范围规划。
2. 每个变更文件必须有且只有一个文件子计划，order 决定审查顺序。
3. 每个子计划必须包含至少一个 check；每个 check 必须包含 completionCriteria、allowedFiles 和 evidenceTargets。
4. unit.file 必须是变更文件；所有 relatedFiles 和 allowedFiles 必须位于允许文件范围内。
5. 不得请求工具、执行审查、生成 finding，也不得补充消息中不存在的文件。
6. 只返回 JSON 对象，不要使用 Markdown 代码块或解释性文字。
7. 所有描述性文本（包括 changeSetSummary、riskAreas、description、completionCriteria 和 evidenceTargets）必须使用中文；文件路径、字段名和内部 ID 保持原样。

输出字段必须符合 ReviewPlan：version、changeSetSummary、riskAreas、units，以及修订时可选的 revision。budget 可以省略，由系统填入确定性默认值。`;

export type ReviewPlanPromptInput = {
  preAnalysis: ReviewPreAnalysis;
  diffSummary: string;
  allowedFiles: readonly string[];
  revision?: {
    currentPlan: ReviewPlan;
    trigger: { type: string; reason: string };
  };
};

export function buildReviewPlanMessages(input: ReviewPlanPromptInput): ChatMessage[] {
  const controlledInput = {
    preAnalysis: input.preAnalysis,
    diffSummary: input.diffSummary,
    allowedFiles: [...input.allowedFiles],
    ...(input.revision
      ? {
          revision: {
            currentPlan: input.revision.currentPlan,
            trigger: input.revision.trigger
          }
        }
      : {})
  };

  return [
    { role: "system", content: REVIEW_PLAN_SYSTEM_PROMPT },
    {
      role: "user",
      content: `请根据以下受控输入生成 ReviewPlan：\n${JSON.stringify(controlledInput, null, 2)}`
    }
  ];
}
