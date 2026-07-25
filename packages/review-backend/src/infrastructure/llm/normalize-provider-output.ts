import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reviewFindingSchema } from "../../domain/review-finding.js";

const providerOutputSchema = z.object({
  findings: z
    .array(
      z.object({
        severity: z.enum(["high", "medium", "low"]),
        category: z.string(),
        summary: z.string(),
        explanation: z.string(),
        file: z.string().optional(),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
        evidence: z.string().optional(),
        suggestion: z.string().optional(),
        confidenceSignals: z.array(z.string()).default([])
      })
    )
    .default([])
});

export function normalizeProviderOutput(input: {
  content: string;
  fallbackFile: string;
}) {
  // provider 输出是不可信的外部数据：先解析结构，再通过 schema 生成统一 finding。
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(input.content);
  } catch {
    return [];
  }

  const parsed = providerOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return [];
  }

  return parsed.data.findings.map((finding) =>
    reviewFindingSchema.parse({
      id: randomUUID(),
      ...finding,
      file: finding.file ?? input.fallbackFile,
      status: finding.startLine ? "line-level" : "file-level"
    })
  );
}
