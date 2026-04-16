---
title: 'Git 规范流程'
date: 2025-08-10
slug: 'git-gui-fan-liu-cheng'
categories:
  - '开发工具'
tags:
  - 'Git'
  - 'Git Flow'
  - '代码规范'
  - '团队协作'
  - 'Commit'
source: halo
description: '分支名 用途说明 合并来源 推送规则 main / master 生产环境上线分支，仅用于发布版本。 release/ 严格保护，需 PR + Code Review develop 开发集成分支，日常合并功能分支 fe'
---

# **📌 1. 分支管理策略（Git Flow 扩展）**

|  |  |  |  |
| --- | --- | --- | --- |
| 分支名 | 用途说明 | 合并来源 | 推送规则 |
| `main / master` | 生产环境上线分支，仅用于发布版本。 | `release/*` | 严格保护，需 PR + Code Review |
| `develop` | 开发集成分支，日常合并功能分支 | `feature/*` | 需 PR，建议 Code Review |
| `feature/*` | 功能开发分支，如 feature/user-login | 无 | 完成后提交 PR 到 `develop` |
| `bugfix/*` | 紧急修复线上问题分支，如 bugfix/fix-null-pointer | 无 | PR 到 `develop` 和 `main` |
| `release/*` | 发布准备分支，用于测试和打 tag，如 release/v1.0.0 | `develop` | PR 到 `main` 和 `develop` |
| `hotfix/*` | 线上紧急修复分支，直接从 main 创建，完成后合并回 main 和 develop | `main` | PR 到 `main` 和 `develop` |

# **📌 2. 提交规范（Commit Convention）**

推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 标准：

**提交格式：**

```
<type>(<scope>): <subject>
<空行>
<body>
<空行>
<footer>
```

**示例：**

```
feat(auth): add login validation logic

- Add validation for empty username and password
- Refactor AuthController to separate concerns

BREAKING CHANGE: Login now requires non-empty fields.
```

**常见** `type` **类型：**

| type | 说明 |
| --- | --- |
| feat | 新功能 |
| fix | bug 修复 |
| chore | 构建、依赖更新等非功能改动 |
| docs | 文档变更 |
| style | 代码格式修改 |
| refactor | 重构代码不改变功能 |
| perf | 性能优化 |
| test | 测试相关改动 |
| build | 构建系统或 CI 相关 |
| ci | 持续集成配置修改 |
| revert | 回滚提交 |

# **📌 3. Pull Request（PR）规范**

**标题**：清晰描述变更内容，建议包含类型前缀（如 feat/auth: ...）

**描述**：说明变更目的、影响模块、是否涉及 DB 变更、配置文件变动等。

**关联 Issue**：PR 应与 Jira 或 GitHub/Gitee Issue 关联。

**Code Review**：

- 至少 1 人 Review
- 对关键模块建议多人 Review

**自动检查**：

- 单元测试覆盖率达标
- Sonar/Qodana 等静态扫描通过
- CI 构建成功

# **📌 4. 版本发布（Tagging）**

- 使用语义化版本号`v<major>.<minor>.<patch>`，例如 `v1.2.3`
- 发布到 `release/*` 分支后，打 tag 并推送到远程仓库
- 示例命令：

```
git checkout release/v1.2.3
git pull
git tag v1.2.3
git push origin v1.2.3
```
