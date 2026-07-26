/**
 * 模块职责：解析桌面端 provider 能力配置，避免把环境变量解析散落在主进程。
 * 边界约束：默认值只描述当前兼容 endpoint 的能力；不支持时可通过环境变量关闭。
 */
export type OpenAiProviderCapabilities = {
  structuredOutput: boolean;
  toolCalling: boolean;
  usage: boolean;
  cancellation: boolean;
};

export type OpenAiProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function resolveOpenAiProviderConfig(env: NodeJS.ProcessEnv = process.env): OpenAiProviderConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  return {
    baseUrl: env.OPENAI_BASE_URL ?? "https://token-plan-cn.xiaomimimo.com/v1",
    apiKey,
    model: env.OPENAI_MODEL ?? "mimo-v2.5-pro"
  };
}

export function resolveOpenAiProviderCapabilities(
  env: NodeJS.ProcessEnv = process.env
): OpenAiProviderCapabilities {
  return {
    structuredOutput: readBoolean(env.OPENAI_STRUCTURED_OUTPUT, true),
    toolCalling: readBoolean(env.OPENAI_TOOL_CALLING, true),
    usage: readBoolean(env.OPENAI_USAGE, true),
    cancellation: readBoolean(env.OPENAI_CANCELLATION, true)
  };
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() !== "false";
}
