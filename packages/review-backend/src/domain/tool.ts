import { z } from "zod";

export const toolNameSchema = z.enum([
  "file_read",
  "file_find",
  "code_search",
  "code_comment",
  "file_read_diff",
  "task_done"
]);

export const toolCallSchema = z.object({
  id: z.string(),
  name: toolNameSchema,
  arguments: z.record(z.unknown())
});

export const toolResultSchema = z.object({
  toolCallId: z.string(),
  content: z.string(),
  isError: z.boolean().optional()
});

export const toolDefinitionSchema = z.object({
  name: toolNameSchema,
  description: z.string(),
  parameters: z.record(z.unknown())
});

export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolResult = z.infer<typeof toolResultSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type ToolName = z.infer<typeof toolNameSchema>;
