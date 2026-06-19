# Domain Docs

本文件说明工程技能在探索代码库时应如何读取本仓库的领域文档。

## 布局

本仓库使用 single-context 的领域文档布局。

## 探索前读取

- 仓库根目录的 `CONTEXT.md`。
- `docs/adr/` 中与当前工作区域相关的 ADR。

如果这些文件不存在，继续执行即可。不要因为缺失而报错，也不要预先建议创建。`/domain-modeling` 技能会在真正明确术语或架构决策时按需创建这些文件。

## 文件结构

single-context 仓库的目标结构：

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-another-example-decision.md
└── packages/
```

## 使用 glossary 中的词汇

当输出中需要命名领域概念时，例如 issue 标题、重构建议、排查假设或测试名称，应使用 `CONTEXT.md` 中定义的术语。不要漂移到 glossary 明确避免的同义词。

如果需要的概念还不在 glossary 中，这通常是一个信号：要么正在发明项目未使用的语言，需要重新考虑；要么确实存在领域建模缺口，可以记录给 `/domain-modeling`。

## 标出 ADR 冲突

如果输出内容和现有 ADR 冲突，应明确指出，而不是静默覆盖：

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because..._
