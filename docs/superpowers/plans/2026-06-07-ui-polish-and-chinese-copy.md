# UI Polish And Chinese Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成导航当前态、hover、空状态和全站中文文案收口，让前端界面更像一个完整产品。

**Architecture:** 不改现有页面骨架，只在 `AppShell`、各页面文案和局部状态显示层做细节增强。通过精确页面测试锁定中文标签与导航选中态，再做实现与全量回归。

**Tech Stack:** React 19、TypeScript 5、React Router、Tailwind CSS、Vitest、Testing Library

---

## File Structure Map

- Modify: `packages/review-app/src/components/layout/app-shell.tsx`
- Modify: `packages/review-app/src/components/session/session-progress.tsx`
- Modify: `packages/review-app/src/components/session/review-summary-panel.tsx`
- Modify: `packages/review-app/src/components/session/risk-file-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`
- Modify: `packages/review-app/src/components/session/diff-empty-state.tsx`
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`
- Modify: `packages/review-app/src/pages/session-history-page.tsx`
- Modify: `packages/review-app/src/pages/settings-page.tsx`
- Modify: `packages/review-app/src/components/settings/provider-profile-form.tsx`
- Modify: `packages/review-app/src/components/settings/privacy-settings-form.tsx`
- Modify: `packages/review-app/tests/review-session-page.test.tsx`
- Modify: `packages/review-app/tests/settings-page.test.tsx`
- Modify: `packages/review-app/tests/session-history-page.test.tsx`

### Task 1: 用测试锁定中文文案与导航态

**Files:**
- Modify: `packages/review-app/tests/review-session-page.test.tsx`
- Modify: `packages/review-app/tests/settings-page.test.tsx`
- Modify: `packages/review-app/tests/session-history-page.test.tsx`

- [ ] **Step 1: 为主工作台测试改成中文断言**
- [ ] **Step 2: 为设置页补页面头区与中文标题断言**
- [ ] **Step 3: 为历史页补空状态或卡片小标题断言**
- [ ] **Step 4: 运行精确测试确认先失败**

### Task 2: 实现导航态与中文文案

**Files:**
- Modify: `packages/review-app/src/components/layout/app-shell.tsx`
- Modify: `packages/review-app/src/components/session/session-progress.tsx`
- Modify: `packages/review-app/src/components/session/review-summary-panel.tsx`
- Modify: `packages/review-app/src/components/session/risk-file-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`
- Modify: `packages/review-app/src/components/session/diff-empty-state.tsx`

- [ ] **Step 1: 用 `NavLink` 实现导航当前态与 hover**
- [ ] **Step 2: 把工作台分区名统一改为中文**
- [ ] **Step 3: 把 severity / 定位状态改为中文显示**
- [ ] **Step 4: 把 diff 空状态和 loading 改为中文**

### Task 3: 收口历史页与设置页细节

**Files:**
- Modify: `packages/review-app/src/pages/session-history-page.tsx`
- Modify: `packages/review-app/src/pages/settings-page.tsx`
- Modify: `packages/review-app/src/components/settings/provider-profile-form.tsx`
- Modify: `packages/review-app/src/components/settings/privacy-settings-form.tsx`

- [ ] **Step 1: 历史页补中文页头小标题与空状态**
- [ ] **Step 2: 设置页补页面头区并统一中文**
- [ ] **Step 3: 给设置卡片和历史卡片补 hover 细节**

### Task 4: 回归验证

**Files:**
- Test: `packages/review-app/tests/review-session-page.test.tsx`
- Test: `packages/review-app/tests/settings-page.test.tsx`
- Test: `packages/review-app/tests/session-history-page.test.tsx`

- [ ] **Step 1: 运行页面相关测试**
- [ ] **Step 2: 运行前端全量测试**
- [ ] **Step 3: 运行前端构建**
