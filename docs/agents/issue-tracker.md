# Issue tracker：GitHub

本仓库的 issues 和 PRD 通过 GitHub Issues 管理。所有 issue 相关操作默认使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文可使用 heredoc。
- **读取 issue**：`gh issue view <number> --comments`，同时按需获取 labels 和 comments。
- **列出 issues**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并按需添加 `--label` 和 `--state` 过滤。
- **评论 issue**：`gh issue comment <number> --body "..."`
- **添加 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭 issue**：`gh issue close <number> --comment "..."`

在仓库 clone 内运行时，`gh` 会根据 `git remote -v` 自动推断 GitHub 仓库。

## PR 是否作为 triage 入口

**PRs as a request surface：no。**

本仓库不把外部 PR 作为需求或问题的 triage 入口。后续 `/triage` 只处理 GitHub Issues。

如果未来改为 `yes`，外部 PR 会和 issues 使用同一套 labels 与状态流转，并可通过 `gh pr` 系列命令读取、评论、加标签和关闭。

## 当技能要求“发布到 issue tracker”

创建一个 GitHub issue。

## 当技能要求“获取相关 ticket”

运行 `gh issue view <number> --comments`。
