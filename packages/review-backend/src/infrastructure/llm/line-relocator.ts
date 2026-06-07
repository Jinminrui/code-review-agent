import type { LlmProvider } from "../../domain/provider.js";
import type { ReviewFinding } from "../../domain/review-finding.js";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "relocator" });

const RELOCATE_PROMPT = `你是一位代码行定位专家。根据审查发现的问题和完整的文件内容，确定问题指向的精确行范围。

问题信息：
- 文件: {{file}}
- 摘要: {{summary}}
- 证据: {{evidence}}

文件内容:
\`\`\`
{{fileContent}}
\`\`\`

请用 JSON 格式响应：
{ "startLine": <行号>, "endLine": <行号> }

如果无法确定精确行号，响应：
{ "startLine": null, "endLine": null }`;

export async function relocateFinding(input: {
  provider: Pick<LlmProvider, "id" | "review">;
  finding: ReviewFinding;
  fileContent: string;
  signal?: AbortSignal;
}): Promise<ReviewFinding> {
  const { finding, fileContent } = input;

  // Already has line numbers, no need to relocate
  if (finding.startLine && finding.status === "line-level") {
    return finding;
  }

  // No evidence to work with
  if (!finding.evidence && !finding.summary) {
    return { ...finding, status: "file-level" };
  }

  try {
    const t0 = Date.now();
    const prompt = RELOCATE_PROMPT.replace("{{file}}", finding.file)
      .replace("{{summary}}", finding.summary)
      .replace("{{evidence}}", finding.evidence ?? finding.summary)
      .replace("{{fileContent}}", fileContent.slice(0, 50000));

    const result = await input.provider.review({ prompt, signal: input.signal });
    const parsed = JSON.parse(result.content);

    if (parsed.startLine && parsed.endLine) {
      log.info(`行号重定位成功: ${finding.file}:${parsed.startLine}-${parsed.endLine}, ${Date.now() - t0}ms`);
      return {
        ...finding,
        startLine: parsed.startLine,
        endLine: parsed.endLine,
        status: "line-level"
      };
    }

    log.info(`行号重定位未找到精确位置: ${finding.file}, ${Date.now() - t0}ms`);
    return { ...finding, status: "file-level" };
  } catch (error) {
    log.warn(`行号重定位失败: ${finding.file}`);
    return { ...finding, status: "file-level" };
  }
}
