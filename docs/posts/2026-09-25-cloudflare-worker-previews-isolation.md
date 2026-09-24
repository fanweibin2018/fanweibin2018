---
title: 'Cloudflare Worker Previews：分支预览环境隔离了什么，又共享了什么'
date: 2026-09-25
slug: 'cloudflare-worker-previews-isolation'
author: 范伟彬
description: 'Cloudflare Worker Previews 为分支和 Pull Request 提供独立 URL、配置与观测数据。本文梳理 Wrangler 配置、数据隔离边界和接入 CI 前容易忽略的生产资源风险。'
categories:
  - 云原生
  - DevOps
tags:
  - Cloudflare Workers
  - Wrangler
  - CI/CD
  - Agent
  - 测试环境
---

# Cloudflare Worker Previews：分支预览环境隔离了什么，又共享了什么

同一个 Worker 的两个 Pull Request 同时测试登录和上传功能时，如果它们写进同一份测试数据，一条测试就可能改变另一条测试的结果。Cloudflare 在 2026 年 9 月 22 日发布 Worker Previews，给分支提供独立代码、配置、URL 和观测数据；这让“预览环境”开始覆盖一部分后端状态，而不是只给前端一个临时地址。

不过，“独立预览”不等于自动复制一套完整生产基础设施。Cloudflare 的[发布说明](https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/)和[资源隔离文档](https://developers.cloudflare.com/workers/previews/resources/)列出了共享边界。接入之前，先逐个核对绑定和触发器，才能知道一次测试会影响哪些数据。

## 从分支到可分享的部署

Worker Preview 跟随当前分支部署。官方文档要求 Wrangler 4.135.0 或更高版本。开发者在分支执行：

```bash
pnpm add -D wrangler@latest
pnpm exec wrangler preview
```

`main` 分支仍用 `wrangler deploy` 发布生产；功能分支使用 `wrangler preview` 创建或更新同一个 Worker 下的分支 Preview。每个预览有两种地址：稳定的 Preview URL 会跟随该预览的最新部署更新；不可变的 Deployment URL 对应特定一次部署，适合在 Pull Request 评论里记录某个确定版本。

若接入 Workers Builds，Cloudflare 可以在 Pull Request 中自动创建 Preview 并留言地址。已有 GitHub Actions 的团队也能从工作流执行 Preview 命令。官方[自动化示例](https://developers.cloudflare.com/workers/previews/automation-examples/)要求为 Cloudflare API Token 配置所需资源权限，并特别提醒：来自 fork 的 Pull Request 默认拿不到仓库 Secrets。不能为了让预览流水线“都跑起来”而让不可信分支接触部署凭据。

## 配置要明确写出预览的行为

生产设置放在配置顶层，分支预览使用 `previews` 区块覆盖变量和资源绑定。以 Wrangler 的 TOML 配置为例：

```toml
name = "my-worker"
compatibility_date = "2026-09-22"

[vars]
APP_ENV = "production"
API_URL = "https://api.example.com"

[previews.vars]
APP_ENV = "preview"
API_URL = "https://api.staging.example.com"
```

这是一个有意区分环境的起点。Preview 不继承生产设置；配置不完整时，不应默认认为它会自动指向安全的测试后端。把预览要用的环境变量、绑定和入口一并纳入版本控制，也方便团队审查某个分支究竟连向哪套依赖。

密钥不能写进配置或 Git 仓库，需要通过 Wrangler 命令单独设置。部署前还应确认每个 PR 是否有权接触对应机密。即使 Preview 自己有单独的密钥槽位，错误的自动化流程仍可能把生产 Token 注入预览部署。

## 隔离不是“克隆生产账号里的所有数据”

Cloudflare 为 Preview 自动创建独立的 Durable Objects namespace 和 Containers 实例。这样分支之间的对象状态可以各自保存；部署到某个 Preview 后，状态会在该 Preview 后续部署间保留，直到它被删除。每个 Preview 也能独立查看日志、指标和 traces，调试时不必把不同分支的遥测混在一起。

但账户级资源通常按绑定的 ID 或名称决定是否共享。两个 Preview 如果都绑定到同一个 KV namespace 或 D1 database ID，就会读写同一份 KV 数据或 D1 行。要隔离这类资源，需要在 Preview 配置里绑定不同的测试资源。仅仅看到两个不同的预览 URL，不能推导出数据库已经分开。

跨 Worker 的 Service Binding 也指向被绑定 Worker 的生产部署。Workflows 绑定会使用现有 Workflow 及其绑定，并不会自动创建预览专属实例。因此，测试 Worker 调用生产 Service 或 Workflow 时，URL 独立也不会阻止请求进入生产代码或状态系统。合并前应列出每个绑定的目标，确认它是否允许从测试流量到达生产服务。

## 会触达生产的触发器需要单独设计

Preview 不会创建自己的 Cron Trigger；路由和定时任务仍然面向生产。Queue 可以作为 Preview 的生产者，但当前 Preview 不能作为 Queue 消费者。如果 Preview 把测试消息发送到生产 Queue，生产消费者可能会拿到它。这不是隔离失效，而是触发器的目标依照平台设计仍在生产侧。

需要测试定时逻辑时，Cloudflare 建议把业务逻辑放到可复用函数，由生产 `scheduled()` 和受保护的测试路由共同调用；然后在 Preview URL 上触发测试路由。不要为了验收定时任务而给预览也连上真实生产 Cron。测试 Queue 消费者时，先部署一个独立的非生产 Workflow 或队列消费者，再把 Preview 接过去。

## Preview URL 本身也需要访问控制

Preview URL 默认是公开的。测试数据、未发布功能或内部页面如果不能对公众开放，应通过 Cloudflare Access 限制访问。自定义域名可以让 Cookie、OAuth 回调和 CORS 更接近正式站点的行为，但也意味着应仔细检查 DNS、回调白名单及认证配置，确保没有把正式会话或凭证暴露给不受信任的参与者。

每个 Worker 的 Preview 数量也有限：Free 计划为 100 个，付费计划为 500 个；每个 Preview 保存最多 100 次部署。达到上限后，平台会删除最久未部署的 Preview 或最旧部署。因此，PR 关闭后的清理不只是整洁问题，也是可预测地保留有效环境的一部分。

## 接入前的实用检查

我的建议是先选一个无生产写入的服务，升级项目依赖中的 Wrangler 至 4.135.0 或更高版本，配置 Preview 专用变量，再为 KV、D1 和对象存储创建单独测试资源。然后在两个并发分支执行写入测试，验证数据、密钥和日志确实各自隔离。最后再接 Pull Request 自动化和 URL 发布。

做配置审查时，至少逐项回答：预览的每个 binding 指向哪个资源；生产 Queue 或 Service 是否可能收到测试请求；密钥是否只对可信工作流开放；公开 URL 是否经过 Access 保护；关闭分支后预览状态如何清理。Worker Previews 提供的是创建分支环境的机制，安全边界仍取决于绑定目标和工作流授权。

## 参考资料

- [Cloudflare：Introducing Worker Previews](https://blog.cloudflare.com/worker-previews/)
- [Cloudflare Changelog：Test every pull request in an isolated environment with Worker Previews](https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/)
- [Cloudflare Docs：Previews](https://developers.cloudflare.com/workers/previews/)
- [Cloudflare Docs：Resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)
- [Cloudflare Docs：Automation examples](https://developers.cloudflare.com/workers/previews/automation-examples/)
- [Cloudflare Docs：Test and debug](https://developers.cloudflare.com/workers/previews/test-and-debug/)
