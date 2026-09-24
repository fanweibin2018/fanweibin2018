---
title: 'GitHub Actions 停用 Node 20：先分清 Action 运行时和项目 Node 版本'
date: 2026-09-24
slug: 'github-actions-node20-node24-runtime'
author: 范伟彬
description: 'GitHub Actions 已不再提供 Node 20 来运行 JavaScript Actions。本文拆解 runs.using 与 setup-node 的区别，并给出工作流维护者和 Action 作者各自的迁移清单。'
categories:
  - DevOps
  - 开发工具
tags:
  - GitHub Actions
  - Node.js
  - CI/CD
  - 自托管 Runner
---

# GitHub Actions 停用 Node 20：先分清 Action 运行时和项目 Node 版本

如果你今天看到 GitHub Actions 出现 Node 20 停用提示，或某个自托管 Runner 开始无法执行 JavaScript Action，第一反应可能是把工作流里的所有 `20` 换成 `24`。这一步很容易改错地方。

GitHub 在 2026 年 9 月 23 日宣布，Runner 不再提供 Node 20 来运行 JavaScript Actions，相关 Action 现在由 Node 24 执行，临时回退开关也已移除。[官方通知](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)还指出，Node 24 不兼容 macOS 13.4 及更早系统，也不正式支持 ARM32。对维护 CI 的人来说，先辨认工作流中的 Node 20 属于哪一层，比全局搜索替换更重要。

## 工作流里的两个 Node 版本各管一件事

看下面这段配置：

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: node --version
```

`actions/checkout@v4` 和 `actions/setup-node@v4` 是 Action。若它们是 JavaScript Action，其代码在 Runner 内由对应的 Action Runtime 执行。

`node-version: 20` 则是 `setup-node` 安装并设置给后续 `run` 步骤的 Node 版本。项目编译、测试或部署命令可以继续使用它，直到项目自身准备好升级。这两个配置虽然都出现 Node 版本数字，却控制不同的运行过程。

可以把一次任务想成两层：Runner 先启动 Action，Action 再为项目步骤安装 Node。前一层升级到 Node 24，不会自动把后一层也升级。反过来，把 `node-version` 改为 24，也不会修复一个声明只支持 Node 20 的旧 Action。

## 工作流使用者应检查什么

第一步是盘点 `uses:`，尤其是第三方 Action、本地 Action 和复合 Action 内嵌的 `uses:`。确认引用版本是否已发布 Node 24 兼容版本，再依据维护者说明升级引用。复合 Action 自己没有统一的 JavaScript 运行时声明，但它可能调用 JavaScript Action，所以也要展开检查。

可以先快速找到工作流中的 Action 引用：

```bash
rg -n 'uses:' .github/workflows
```

这只是入口；若仓库有复合 Action，还需要搜索它们的 `action.yml` 和 `action.yaml`。审核结果时，区分标签版本与实际提交：组织可以按供应链规范固定到 commit SHA，再在确认 Node 24 兼容后更新 SHA。

第二步检查执行平台。使用 GitHub-hosted Runner 的项目通常由平台提供兼容 Runtime；使用 self-hosted Runner 的项目还需要检查 Runner 版本、操作系统和 CPU 架构。特别是仍运行在旧 macOS 或 ARM32 主机上的 Runner，需要制定迁移或替换计划。不要把“动作引用已更新”当成主机兼容性也已解决。

第三步做完整回归：至少触发一条有代表性的工作流，让 checkout、缓存、依赖安装、编译、测试和部署都实际运行。仅看 YAML 中的版本字符串，无法证明复合 Action 的间接依赖、第三方 Action 或构建机已经兼容。

## Action 作者需要更新运行时声明

如果你维护的是 JavaScript Action，检查 `action.yml` 中的 `runs.using`。GitHub 的[元数据语法](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)支持 `node24` 声明。仅修改声明还不够：Action 的依赖、打包产物和代码也要在 Node 24 环境中构建与验证，然后发布新的 Action 版本，供调用方升级。

```yaml
runs:
  using: node24
  main: dist/index.js
```

若 Action 对外发布了多个主要版本，应遵循项目现有的兼容和发布约定。使用者通常要更新 `uses: owner/action@vN` 的引用；维护者则要确保这个引用指向包含新版运行时声明的发布。两边都完成，迁移链条才闭合。

## 这个仓库里的 `node-version: 20` 要不要改？

本仓库的 Pages 部署和新闻校验工作流都使用 `actions/setup-node@v4`，随后声明 `node-version: 20`。前者是 Action，后者是构建时使用的项目 Node。因这次 Action Runtime 停用通知，并不能推出 VitePress 构建也必须立即改用 Node 24。

我建议把两项工作拆开安排：先检查各 Action 和 Runner 对 Node 24 的支持；再单独评估 VitePress、pnpm、锁文件及生产构建在项目 Node 版本上的兼容性。完成构建验证后，才决定是否提升 `node-version`。这样出错时能清楚知道是 Action 执行环境变化，还是应用构建运行时变化。

对自托管 Runner，也要留意 Node 24 带来的系统和架构要求。若任务卡在初始化阶段，错误发生在项目脚本启动以前，应先看 Runner 是否能启动所需 Action Runtime；如果已经进入项目脚本，再检查 `node-version`、包管理器和构建日志。按故障发生阶段分类，通常比盲目修改依赖更快定位问题。

## 建议的迁移顺序

今天可以先列出每个工作流的 `uses:`、Action 版本、Runner 标签，以及项目的 `node-version`，然后在低风险工作流上升级 Action 并跑完整构建。自托管环境另外验证 Runner 软件、macOS 版本和架构。项目 Node 版本应作为独立变更评估，并锁定版本、重建依赖、运行项目原有的构建验证后再推广。

维护 Action 的团队则需要发布 Node 24 兼容版本，并通知仓库维护者更新引用。GitHub 的弃用公告提供了升级背景；具体 Action 是否兼容，应以它自己的发布说明和源码为准。迁移记录最好写明验证过的 Action 版本、Runner 环境和工作流结果，下一次 Runtime 迁移时才有可复用的清单。

## 参考资料

- [GitHub Changelog：Node 20 is no longer available in GitHub Actions](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/)
- [GitHub Changelog：Deprecation of Node 20 on GitHub Actions runners](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
- [GitHub Docs：Metadata syntax reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)
- [GitHub Docs：Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
