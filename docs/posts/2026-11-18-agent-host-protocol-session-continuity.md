---
title: 'Agent Host Protocol：关掉编辑器，Agent 为什么还能在手机上继续'
date: 2026-11-18
slug: 'agent-host-protocol-session-continuity'
author: 范伟彬
description: 'GitHub 公开了支撑跨编辑器、桌面端与手机继续 Agent 会话的 Agent Host Protocol。本文拆解 Host、Channel、纯 Reducer、预写协调与断线重放，并给出固定 1.1.0 规范的可复现验证。'
source: 'https://github.blog/engineering/engineering-principles/building-the-agent-host-protocol-for-sessions-that-continue-across-devices/'
categories:
  - AI
  - 技术
  - 开源
tags:
  - Agent Host Protocol
  - AI Agent
  - GitHub Copilot
  - VS Code
  - 分布式状态
---

# Agent Host Protocol：关掉编辑器，Agent 为什么还能在手机上继续

一个编码 Agent 正在修改项目，你关掉 VS Code 去吃饭，路上用手机批准它执行测试，回到电脑后还能看到同一段对话、工具调用和代码改动——这件事不能只靠“把聊天记录存进数据库”完成。

真正困难的是：Agent 进程应该活在哪里？两个客户端同时操作时谁说了算？手机断网期间 Agent 继续工作，恢复连接后怎样补齐状态，又不把已经批准过的工具重复执行？

GitHub 在 11 月 17 日公开了其 Agent Host Protocol（AHP）的实际落地过程。AHP 把 Agent 会话从某个编辑器窗口里拆出来，交给独立 Host 持有，再让 VS Code、Copilot 桌面应用、手机或自建客户端连接同一个会话。协议规范 1.1.0 于 11 月 12 日发布，仓库同时提供 Rust、TypeScript、Kotlin、Go、Swift 和 .NET 客户端。

它解决的不是“模型怎样思考”，而是**多个界面怎样安全、连续地操作同一个 Agent 会话**。

## 先把 Agent 从窗口里搬出去

传统编辑器插件通常与窗口同生共死。关闭窗口、升级编辑器或切换远程环境，插件宿主也会重启。即使把消息保存下来，正在运行的命令、等待批准的工具和未完成的流式输出仍然可能丢失。

AHP 把系统分成三层：

1. **Client**：VS Code、手机、网页或团队自建面板，只负责显示状态和发出操作；
2. **Agent Host**：独立进程或云端服务，持有权威会话状态、排序所有操作并连接真实工作区；
3. **Agent backend**：Copilot、Claude Code 或其他 Agent，负责推理、调用工具和生成结果。

可以把 Host 理解成会议室，而客户端只是不同的门。你从电脑门离开，会议并不会结束；手机从另一扇门进来，看到的仍是同一块白板。文件编辑和命令也发生在 Host 所在的工作区，不会因为手机加入就转移到手机上执行。

AHP 只规定客户端到 Host 的协调层。单个 Agent 的提示、流式内容和工具协议可以继续使用 Agent Client Protocol（ACP）或厂商自己的接口。MCP 则解决 Agent 怎样发现和调用外部工具。三者关注点不同，不能因为名字里都有“协议”就互相替代。

## Channel：客户端不用下载整个世界

AHP 用 URI 标识不同状态区域，称为 Channel：

- `ahp-root://` 保存可用 Agent、模型和全局配置；
- `ahp-session:/<uuid>` 保存会话标题、生命周期、工作目录和 Chat 列表；
- `ahp-chat:/<cid>` 保存具体对话的 Turn、流式响应、工具调用和待处理输入；
- Terminal、Changeset、Automation 等能力可以使用各自的扩展 Channel。

客户端只订阅自己需要的 Channel。手机上的任务列表可以只读取轻量 Session 摘要，不必下载每段终端输出；打开某个 Chat 后，再订阅其完整状态。这既减少传输，也把协议扩展从“给一个巨型对象不断加字段”变成“按能力增加 Channel”。

每个 Channel 的状态都由不可变 State 和 Action 组成。比如用户发送消息不是让客户端直接改一堆字段，而是发出 `chat/turnStarted`；工具等待确认、确认通过、输出增量和 Turn 完成，也分别是有类型的 Action。

## 为什么要用纯 Reducer

同一种 Action 会在客户端和 Host 上交给同一个纯 Reducer：

```text
nextState = reducer(currentState, action)
```

Reducer 不访问网络、不写文件，也不直接调用模型。它只根据旧状态和 Action 计算新状态；真正启动 Agent、执行工具等副作用由 Host 的另一层处理。

这条分工让状态同步变得可推演。只要客户端和 Host 从同一快照开始、按同一顺序应用同一批 Action，就应得到相同状态。它也让“批准工具”不再只是一个按钮点击事件，而是可记录、排序、拒绝和重放的状态转换。

但纯 Reducer 本身没有解决延迟。假设手机点下“批准”后必须等服务器往返一次才更新界面，弱网下会像按钮失灵。AHP 因此采用 **write-ahead reconciliation（预写协调）**。

客户端维护三份概念上的数据：

- `confirmedState`：Host 已确认的状态；
- `pendingActions`：本地已经操作、尚未收到 Host 回声的 Action；
- `optimisticState`：在已确认状态上重新应用所有待确认 Action，界面始终渲染这一份。

用户操作会立刻进入 `pendingActions`，所以界面马上变化。Host 收到后检查当前权威状态，为 Action 分配递增的 `serverSeq`，再广播给所有订阅者。发起操作的客户端收到自己的回声后，把它从待确认队列移入已确认状态；其他客户端则把这条外来 Action 应用到自己的已确认状态，再把本地尚未确认的操作重新叠上去。

如果两台设备同时批准同一个工具，Host 可以接受第一条、拒绝第二条。被拒绝的回声包含原因，第二台设备移除对应的乐观操作，界面便回到权威结果。协议提供的是一致的协调方式，不是“所有并发修改都自动合并”。

## 断线重连不是重新加载聊天记录

每个权威 Action 都带有 `serverSeq`。客户端断线后保留最后看到的序号；重连时发送 `lastSeenServerSeq` 和订阅列表。

如果缺口仍在 Host 的重放缓冲区里，Host 按顺序返回漏掉的 Action。若离线太久，缓冲区已经淘汰那段历史，Host 改发新快照。两种情况下客户端都会以 Host 返回的数据重置已确认状态，并清理本地待确认队列。

这与“重新请求一次消息列表”不同。Agent 的流式输出、工具确认、取消操作和会话状态都在同一条有序 Action 流里；客户端恢复的是状态机位置，而不只是文本记录。

边界也很明确：普通协议 Notification 不参与重放，客户端重连后需要重新获取 Session 列表；Host 进程本身崩溃时，规范要求把正在执行的 Turn 视为失败，是否能恢复工作进程取决于 Host 的持久化和运行环境。AHP 解决客户端断线，不等于自动提供进程快照或灾难恢复。

## 本地复现一次“手机断线后追上进度”

官方仓库把文档首页的演示做成了确定性测试。下面固定到 AHP 1.1.0 的发布提交，运行其中 8 项状态协调测试：

```bash
git clone https://github.com/microsoft/agent-host-protocol.git
cd agent-host-protocol
git checkout a501ea480fde1adc2675243039cb6195085f4b96

npm ci
node --import tsx --test scripts/homepage-notebook.test.ts
```

这些测试会检查：本地乐观操作在 Host 回声前保持 pending；手机离线期间漏掉进度；重连请求携带 `lastSeenServerSeq`；漏掉的 Action 按序重放；缺口超出缓冲区时改用快照，最终仍与其他客户端收敛。

我在 Linux x86-64、Node.js 24.22.1 上实际运行，结果为 `8 passed, 0 failed`。同一固定提交下，另外执行了 TypeScript 类型检查、ESLint、版本与变更日志校验，以及包含 Reducer、Schema、版本协商和重连场景的测试集合：`664 passed, 0 failed`，`reducers.ts` 的语句、分支、函数和行覆盖率均为 100%。

这证明的是协议仓库的状态转换与一致性测试在该环境通过，不代表 GitHub 云端 Agent、手机网络或真实工作区已经被独立端到端复现。

## 1.1.0 稳定了什么，又没有稳定什么

AHP 1.1.0 增加了 Host 路径风格元数据、Chat 初始标题、模型厂商字段，以及实验性的流量控制类型。它的握手会协商双方都支持的协议版本；未知的可选字段和新的状态位应保持向前兼容。

不过，协议版本稳定不等于整个 Agent 产品已经标准化：

- AHP 不规定模型路由、上下文压缩和 Agent Loop；
- 不规定工具 Schema，也不替代工具权限检查；
- 不负责 Agent 与 Agent 之间的协作；
- 自定义方法和 `_meta` 可以帮助产品快速扩展，也可能形成厂商特有行为；
- Host 拥有工作区和会话权威，因此其认证、令牌保存、目录权限和工具审批仍是核心安全边界。

官方将 TypeScript 的 VS Code Host 与 Rust 的 GitHub Host 视为协议可移植性的现实检验，但两个实现能互通仍不意味着所有第三方 Host、Client 和扩展已经完全一致。接入时应固定协议版本，跑官方一致性测试，并专门验证断线、重复批准、并发取消和未知 Action 等失败路径。

## 什么时候值得接入 AHP

AHP 适合这些产品：

- Agent 需要脱离单个编辑器窗口长期运行；
- 同一会话要在桌面、网页、手机或团队面板之间切换；
- 多个客户端都可能批准工具、取消任务或查看代码改动；
- 团队想复用现成 Agent Host，而不是为每个界面重新集成 Agent SDK。

如果产品只有一个 CLI、一个用户和短会话，直接调用 Agent SDK 或 ACP 通常更简单。为了“看起来像平台”而引入 Host、订阅、Action 日志和重连缓冲，会增加持久化、权限和并发测试成本。

AHP 真正值得关注的地方，不是又多了一个 Agent 缩写，而是它把“会话连续性”从某个应用的隐藏实现，拆成了可以讨论、实现和测试的公开状态协议。模型可以继续快速变化，客户端也可以不断增加；中间那份关于谁拥有状态、操作怎样排序、断线后如何追上的约定，终于不必每个产品各写一遍。

## 原始资料

- [GitHub Engineering：AHP 如何支撑跨设备 Agent 会话](https://github.blog/engineering/engineering-principles/building-the-agent-host-protocol-for-sessions-that-continue-across-devices/)
- [Agent Host Protocol 官方仓库](https://github.com/microsoft/agent-host-protocol)
- [AHP 1.1.0 发布记录](https://github.com/microsoft/agent-host-protocol/releases/tag/spec%2Fv1.1.0)
- [状态模型与 Channel 说明](https://github.com/microsoft/agent-host-protocol/blob/a501ea480fde1adc2675243039cb6195085f4b96/docs/guide/state-model.md)
- [预写协调与断线重放](https://github.com/microsoft/agent-host-protocol/blob/a501ea480fde1adc2675243039cb6195085f4b96/docs/guide/reconciliation.md)
- [AHP 与 ACP 的职责边界](https://github.com/microsoft/agent-host-protocol/blob/a501ea480fde1adc2675243039cb6195085f4b96/docs/guide/ahp-and-acp.md)
- [本文验证使用的固定源码提交](https://github.com/microsoft/agent-host-protocol/tree/a501ea480fde1adc2675243039cb6195085f4b96)
