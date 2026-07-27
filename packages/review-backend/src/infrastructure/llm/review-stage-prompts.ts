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
5. 只调用 submit_review_plan 工具提交结果，不要在普通文本中输出结果，也不要调用其他工具。
6. 工具参数必须是 JSON 对象，不是 JSON 字符串；数字、数组和对象必须保持原生类型，不得序列化成字符串。
7. 必须提交完整计划；version 使用数字 1，units 使用数组。最小合法形状为 {"version":1,"changeSetSummary":{...},"riskAreas":[],"units":[]}；budget 可以省略，由系统填入确定性默认值。
8. 所有描述性文本（包括 changeSetSummary、riskAreas、description、completionCriteria 和 evidenceTargets）必须使用中文；文件路径、字段名和内部 ID 保持原样。

输出字段必须符合 ReviewPlan：version、changeSetSummary、riskAreas、units，以及修订时可选的 revision。`;

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
