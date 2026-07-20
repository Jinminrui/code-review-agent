# 使用 OpenAI-compatible 协议而非绑定特定 LLM 服务

## 状态

已采纳

## 背景

需要选择 LLM 调用方式：

1. 绑定 OpenAI SDK
2. 绑定 Anthropic SDK
3. 实现 OpenAI-compatible HTTP 协议
4. 抽象多 provider 适配层

## 决策

实现 OpenAI-compatible HTTP 协议（`/chat/completions`），支持任何兼容该协议的服务。

## 原因

1. OpenAI-compatible 是事实标准，大多数 LLM 服务（OpenAI、DeepSeek、Moonshot、Groq 等）都兼容。
2. 使用原生 `fetch` 调用，不引入额外 SDK 依赖。
3. 用户可自由选择 LLM 服务，只需配置 baseUrl、apiKey、model。
4. 保持 provider 接口简洁：`review()` 和 `chat()` 两个方法。

## 后果

- 不支持 OpenAI 独有的高级功能（如 Assistants API）。
- 不支持 Anthropic 独有的 features（如 extended thinking）。
- 如需支持非兼容协议的 provider，需要扩展 `LlmProvider` 接口。
