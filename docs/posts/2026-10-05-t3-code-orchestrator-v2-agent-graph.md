---
title: 'T3 Code Orchestrator V2：多 Agent 为什么需要一张可恢复的任务图'
date: 2026-10-05
slug: 't3-code-orchestrator-v2-agent-graph'
author: 范伟彬
description: '从 T3 Code 近期发布的 Orchestrator V2 出发，拆解多 Agent 工作台怎样统一线程、运行、子任务、队列和跨模型协作，并说明 nightly 版本的迁移与使用边界。'
categories:
  - AI
  - 开源项目
tags:
  - T3 Code
  - AI Agent
  - Orchestrator
  - Codex
  - Claude Code
---

当编码 Agent 从“问一句、答一句”变成长时间运行的工作流，最难的部分很快不再是聊天框，而是状态管理：任务正在执行、等待审批，还是被限额中断？子 Agent 已经结束，为什么父任务还没结束？切换模型之后，之前的工具调用和文件状态还在不在？应用重启后，排队的消息会不会重复发送？

T3 Code 在 10 月 3 日发布首个 Orchestrator V2 nightly，重写的正是这层编排系统。它不是新模型，而是位于 Codex、Claude Code、Cursor、OpenCode、Pi 等 Agent 之上的控制面：负责启动和停止运行、保存队列、追踪子任务、连接远程机器，并把不同 provider 的事件整理成一套可恢复的状态。

截至 10 月 5 日核验，T3 Code 仓库约有 2.51 万 Star、6500 个 Fork；这只能说明开发者关注度，不代表 V2 已经成熟。更值得关注的是，首个 V2 nightly 发布后一天内仍有多个版本连续修复队列、子任务、SQLite 写锁和连接恢复问题。它既展示了多 Agent 工具正在补哪块基础设施，也提醒使用者：当前 V2 仍属于快速迭代的预发布版本。

## Agent 工作台不能只把所有消息塞进一个数组

单 Agent 聊天可以近似理解为一条消息列表。多 Agent 系统却至少要分清五类对象：

| 对象 | 它回答的问题 |
| --- | --- |
| `AppThread` | 用户眼里这是哪一段持续对话？ |
| `Run` | 哪一次用户请求正在执行，最终状态是什么？ |
| `ExecutionNode` | 这次运行里有哪些工具、审批、子 Agent 和后台任务？ |
| `ProviderThread` | Codex、Claude 等 provider 各自保存的原生会话在哪里？ |
| `ContextTransfer` | 分叉、合并或切换 provider 时，哪些上下文被转移了？ |

可以把它类比成软件项目和外包团队。`AppThread` 是项目档案，`Run` 是一张正式工单，`ExecutionNode` 是工单下面的开发、测试和审批子任务；`ProviderThread` 则是每家外包团队自己的工作记录。项目可以更换承包方，但不能假装不同团队天然共享同一本内部笔记。

V2 因此把一次运行组织成执行图，而不是只看最后一条 assistant 消息。根节点代表用户可见的这一轮工作，工具调用、审批和子 Agent 都是它下面的节点。子节点结束不会自动把父运行标记为完成；只有根节点结束，用户看到的这一轮才真正结束。

这个区别看似抽象，却直接决定界面是否会“提前完成”。例如子 Agent 已经返回评审结果，但父 Agent 还要根据结果修改代码、等待测试并提交。若系统只收到一个 `completed` 就关闭整轮任务，后面的状态会丢失，停止按钮、通知和恢复逻辑也会全部错位。

## 持久化的不是结果，而是“已经接受了什么意图”

Orchestrator V2 的另一个关键变化，是把命令、事件、投影和外部副作用拆开。

用户点击“发送”后，编排器先记录一条已经接受的意图，并在同一个数据库事务里写入事件、界面需要的投影、命令回执以及待执行的 effect。随后，effect worker 才去启动 provider、创建检查点或执行其他外部操作，执行结果再作为新事件回流。

这像餐厅先打印一张带唯一编号的订单，再交给后厨。即使前台断线重连，同一个订单编号也不应该让后厨重复做一份；如果厨房做到一半停电，系统也能区分“订单已经接下”和“菜已经完成”。

对 Agent 工作台而言，这能解决三个常见问题：

- 客户端重试时，同一个命令不会被重复执行；
- 服务重启后，服务器仍知道哪些消息在排队、哪些工作已经中断；
- provider 返回的原始事件可以保留自己的含义，不必硬改成另一家 provider 的事件格式。

T3 Code 还把队列放到服务器端。排队消息能够跨重启保存，用户可以修改、重排或删除，并选择新消息是立即干预当前运行，还是留到下一轮。这比在浏览器内存里保存一个“待发送文本”更接近真正的任务系统。

## `delegate_task` 比“中途换模型”可靠在哪里

V2 提供了一个本地的 T3 Code MCP。正在工作的 Agent 可以调用 `delegate_task`，把独立任务交给另一个 provider 或模型，并选择等待结果还是继续工作。子任务会得到自己的 T3 线程、运行状态和 provider 原生历史；父任务拿到的是明确的结果转移，而不是把两个 Agent 的输出混进同一段对话。

比如让 Claude 负责梳理需求、Codex 负责实现，可以有两种做法：

1. 在同一个线程中直接从 Claude 切换到 Codex；
2. 让父 Agent 通过 `delegate_task` 创建一个 Codex 子任务，完成后把结果交回父任务。

官方明确更推荐第二种。跨 provider 切换时，新 provider 只会拿到受预算限制的一部分消息；之前的推理、工具调用及结果、附件和一部分工作状态不会完整迁移。`delegate_task` 则把边界说清楚：子任务只收到调用时给出的任务说明和可选角色说明，不会偷偷复制父线程全部历史；完成后再把结果作为可追踪的上下文转移回来。

这不是“多 Agent 一定比单 Agent 强”的性能结论，而是一种状态隔离方式。它适合任务可以明确切分、结果能够书面交接的场景，例如独立代码审查、资料检索、测试设计和实现验证。若子任务高度依赖父 Agent 未写出的隐含推理，拆分反而可能丢上下文。

## 同一条线程换 provider，为什么仍然会有损

V2 允许在两轮之间切换 provider、账户、模型或选项。同一 provider 内换模型，通常可以继续使用原生会话；跨 provider 时则需要做上下文交接。

内部设计把“用户看到的线程”和“provider 自己的线程”分开。同一条 `AppThread` 可以先关联 Codex 的 `ProviderThread C1`，再关联 Claude 的 `ProviderThread L1`。返回 Codex 时，系统优先恢复 C1，并补充一份 Claude 工作期间的增量摘要；恢复失败或设置不兼容时，才创建新的 provider 线程并传递完整摘要。

这种设计避免把 Codex 的 turn ID 冒充成 Claude 的 turn ID，也承认摘要不是原始状态。它能传递结论，却无法完整搬运另一家 provider 的隐藏推理、工具进程和临时会话。因此，跨 provider 切换适合“上一位已经把结论写清楚”的节点，不适合在复杂工具调用进行到一半时换人。

## 最小核验：稳定版和 V2 nightly 不是同一个版本

T3 Code 官方文档提供 `npx` 试用方式。下面两条命令已在 Node.js 24.19.0 环境运行，只读取版本，不会启动 Agent：

```bash
npx --yes t3@latest --version
npx --yes t3@nightly --version
```

10 月 5 日得到的输出是：

```text
t3 v0.0.45
t3 v0.0.46-nightly.20261004.2652
```

这一步很重要：npm 的 `latest` 仍指向稳定版 0.0.45，Orchestrator V2 位于 `nightly` 通道。不要看到仓库主分支或 nightly 文档，就默认稳定安装已经具备相同能力。

真正启动前还需要在同一台执行机器上安装并登录至少一个 provider CLI。远程手机、Web 或桌面客户端只是控制端，代码、Git、终端和 provider 凭据仍属于服务器所在的环境。换句话说，手机可以接管家里工作站上的 Agent，但不会把工作区和密钥搬到手机本地。

## 现在适合谁试，谁应该先等稳定版

如果你已经同时使用两种以上编码 Agent，或者经常遇到长任务中断、排队消息丢失、子任务状态不清和远程接管困难，V2 值得在独立环境里评估。它最有价值的不是“又支持了几个模型”，而是把 provider 差异、任务生命周期和恢复语义放进了显式数据模型。

但不要直接把现有主环境切到 nightly：

- V1 首次迁移到 V2 时会复制数据库并做一次性导入，之后 V1 与 V2 新产生的对话不会互相同步；
- provider 的活动会话、旧检查点、diff、工具活动、审批历史和计划不会随迁移完整带过来；
- V2 服务端只接受 V2 客户端，当前移动端需要 beta 版本；
- Codex、Claude Code、OpenCode、Pi 等都有最低版本要求，旧版本只能降级或无法使用部分能力；
- 跨 provider 交接有损，不能把摘要当作完整运行状态；
- 项目 README 仍明确提醒项目处于很早期，频繁 nightly 修复也印证了这一点。

另外，Agent 可以通过 MCP 创建和管理任务，但不能批准自己的权限请求。这个限制值得保留：编排能力越强，越不能让执行者同时成为自己的审批者。

T3 Code Orchestrator V2 展示了一个正在形成的分层：模型负责推理，provider harness 负责与模型和工具交互，编排器负责状态、队列、恢复和协作。真正能长期运行的 Agent 系统，往往不是把单次回答做得更花哨，而是能在崩溃、切换、并行和人工介入之后，仍然说清楚“谁做了什么、现在该继续哪一步”。

## 原始资料

- [T3 Code 源码仓库与项目说明](https://github.com/pingdotgg/t3code)
- [T3 Code Orchestrator V2 首个 nightly 发布说明（2026-10-03）](https://github.com/pingdotgg/t3code/releases/tag/v0.0.46-nightly.20261003.2610)
- [T3 Code 最新发布列表](https://github.com/pingdotgg/t3code/releases)
- [T3 Code V1 → V2 迁移说明](https://github.com/pingdotgg/t3code/issues/14871)
- [Orchestration V2 架构目标与关键约束](https://github.com/pingdotgg/t3code/blob/4ee6bfd50ef4a089440d5c3662db2298da9cc50e/docs/orchestration-v2/README.md)
- [V2 核心图模型与数据结构](https://github.com/pingdotgg/t3code/blob/4ee6bfd50ef4a089440d5c3662db2298da9cc50e/docs/orchestration-v2/core-graph-and-data-model.md)
- [Orchestrator MCP 与 `delegate_task`](https://github.com/pingdotgg/t3code/blob/4ee6bfd50ef4a089440d5c3662db2298da9cc50e/docs/orchestration-v2/orchestrator-mcp-server.md)
- [T3 Code 内部架构与持久化副作用队列](https://github.com/pingdotgg/t3code/blob/4ee6bfd50ef4a089440d5c3662db2298da9cc50e/docs/internals/overview.md)
- [T3 Code 安装与 provider 要求](https://github.com/pingdotgg/t3code/blob/4ee6bfd50ef4a089440d5c3662db2298da9cc50e/docs/user/install.md)
