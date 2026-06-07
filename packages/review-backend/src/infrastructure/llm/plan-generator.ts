import type { LlmProvider } from "../../domain/provider.js";
import { type ReviewPlan, DEFAULT_REVIEW_PLAN, reviewPlanSchema } from "../../domain/review-plan.js";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "plan" });

const PLAN_PROMPT = `你是一位代码审查规划专家。分析以下 diff 并生成结构化的审查计划。

请用 JSON 格式响应：
{
  "riskPoints": [
    { "area": "风险区域描述", "riskLevel": "high|medium|low", "reasoning": "为什么有风险" }
  ],
  "reviewStrategy": "审查策略简述",
  "estimatedComplexity": "low|medium|high"
}

重点关注：
- 安全敏感变更（认证、输入校验、数据泄露）
- 错误处理缺失
- 性能问题
- 逻辑错误或边界情况
- 破坏性变更

所有字段必须使用中文。

Diff:
\`\`\`
{{diff}}
\`\`\`

变更后的文件内容:
\`\`\`
{{fileContent}}
\`\`\``;

export async function generateReviewPlan(input: {
  provider: Pick<LlmProvider, "id" | "review">;
  diff: string;
  fileContent: string;
  signal?: AbortSignal;
}): Promise<ReviewPlan> {
  const prompt = PLAN_PROMPT.replace("{{diff}}", input.diff.slice(0, 30000)).replace(
    "{{fileContent}}",
    input.fileContent.slice(0, 30000)
  );

  try {
    const t0 = Date.now();
    const result = await input.provider.review({ prompt, signal: input.signal });
    log.info(`计划生成完成: ${Date.now() - t0}ms`);

    const parsed = JSON.parse(result.content);
    return reviewPlanSchema.parse(parsed);
  } catch (error) {
    log.warn(`计划生成失败，使用默认计划: ${error instanceof Error ? error.message : "未知错误"}`);
    return DEFAULT_REVIEW_PLAN;
  }
}
