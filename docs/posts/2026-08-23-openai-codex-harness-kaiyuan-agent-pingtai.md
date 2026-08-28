---
title: 'OpenAI 全面开源 Codex Harness：从终端编码工具到可编程 Agent 平台'
date: 2026-08-23
slug: 'openai-codex-harness-kaiyuan-agent-pingtai'
author: 范伟彬
description: '2026 年 8 月 20 日，OpenAI 以 Apache-2.0 协议全面开源了支撑 Codex 编码 Agent 的底层执行引擎 Harness——包含 codex exec 命令行工具、官方 Codex SDK 与可承载持久化会话的 app-server。这意味着开发者不再只能把 Codex 当成一个聊天式编码助手来用，而是可以把它的任务理解、长对话记忆、工具调用、人机审批与事件流这一整套"Agent 执行循环"直接嵌入自己的产品。本文梳理这次开源的背景与动机、三大组件的架构分工、与 Claude Code、DeepSeek Harness 等同类产品的差异，并给出用 TypeScript SDK 从零搭建一个自定义审批型编码 Agent 的实战示例。'
categories:
  - AI
  - 开发者工具
tags:
  - OpenAI
  - Codex
  - Harness
  - Agent
  - 开源
  - SDK
  - Claude Code
---

# OpenAI 全面开源 Codex Harness：从终端编码工具到可编程 Agent 平台

## 一、发生了什么

2026 年 8 月 20 日，OpenAI 在其开发者博客上宣布，将支撑 Codex 编码 Agent 运行的底层执行框架 **Harness** 以 **Apache-2.0** 协议全面开源。这次开源不是简单地把某个工具的源码丢上 GitHub，而是把 Codex 内部"驱动 Agent 跑起来"的那套核心机制拆出来，做成三个可以独立使用的组件：

- **`codex exec`**：面向脚本和 CI 场景的命令行工具，非交互式运行一个有边界的任务，返回结构化结果；
- **官方 Codex SDK**（目前提供 TypeScript 版本，`@openai/codex-sdk`）：给应用代码提供直接的编程接口，可以在自己的后端里启动、驱动、恢复一段 Agent 对话；
- **`app-server`**：核心执行引擎服务，支持持久化会话、实时事件流与人机审批（human-in-the-loop）流程，适合需要完整拥有产品界面和交互逻辑的场景。

OpenAI 官方博客用一句话点出了这次开源的动机：**"一个能干活的 Agent，远不止一个提示词加一次模型响应"**（a capable agent is more than a prompt and a model response）。真正决定一个编码 Agent 好不好用的，往往不是模型本身聪明多少，而是模型外面那层"壳"——怎么管理多轮对话状态、怎么在恰当的时机调用工具、怎么在执行有风险的操作前暂停下来等人确认、怎么把执行进度实时推给前端界面。这层壳，就是 Harness。

这次开源紧跟在 8 月 13 日 DeepSeek 开源自家 Harness（`dsh`，"一切皆插件"架构）之后一周左右，两家头部厂商几乎前后脚把编码 Agent 的"发动机"开放出来，本身就是一个值得记录的行业信号：**编码 Agent 的竞争焦点，正在从"模型能力"向"Agent 执行框架"扩散。**

## 二、为什么要开源"壳"，而不是继续把它锁在产品里

在 Harness 开源之前，Codex 对大多数开发者来说是一个相对封闭的黑盒：你能通过 CLI、IDE 插件或者 Web 界面使用它，但如果想把"Codex 式的编码 Agent 能力"嵌入到自己的产品里——比如做一个内部运维平台、一个税务处理系统、一个云管理工具——你能做的很有限，最多是调用底层模型 API，然后自己从零搭建任务理解、工具调用、审批中断这一整套逻辑。

而这一整套逻辑，恰恰是最难写对、最容易踩坑的部分。OpenAI 官方博客给了一个很有说服力的数字：仅仅通过优化 Harness 层的"保留推理"（retained reasoning）和"上下文压缩"（context compaction）机制，就让 GPT-5.6 Sol 模型在 ARC-AGI-3 基准上的得分从 13.3% 提升到了 38.3%，同时把输出 token 消耗降低到了原来的六分之一。换句话说，同一个模型，换一套更好的执行框架，效果和成本可以有数量级的差异。这也是为什么 OpenAI 选择把这套框架本身拿出来开源，而不是继续把它当作 Codex 产品的私有护城河——**当"壳"本身能创造如此大的价值差异时，让更多开发者基于它构建产品，比自己关起门来做一个封闭工具更划算**：它能让 Codex 的执行范式渗透进更多企业内部系统，反过来又能沉淀出更多真实场景的调优数据。

官方博客里举了一个具体的落地案例：一家名为 Relay 的运维仪表盘产品，用 Agent 辅助运营人员做发货决策，但**关键的写操作必须经过人工审批**——应用层负责界面、业务上下文、MCP 工具的接入与同意流程，Codex 层只负责 Agent 循环本身和沙箱化执行，两者职责分得很清楚。类似的企业落地还包括 Cisco 把它用在云管理工具的 App Builder 里，以及 Thrive Holdings 和 Crete 合作的报税工作流——处理了 7000 份报税单，把处理时间缩短了约三分之一。

## 三、三大组件怎么分工：一张架构图看懂

Harness 开源后，整个 Codex 平台可以理解为清晰的三层：

```
┌─────────────────────────────────────────────┐
│  应用层（你的产品）                            │
│  界面 / 业务上下文 / 自有 MCP 工具 / 审批与同意流程 │
└─────────────────────────────────────────────┘
                    │  通过 SDK / app-server 协议交互
┌─────────────────────────────────────────────┐
│  Codex Harness（本次开源的部分）                │
│  Agent 循环 · 会话状态 · 工具调用 · 沙箱执行      │
│  事件流 · 人机审批 · 长对话记忆与压缩             │
└─────────────────────────────────────────────┘
                    │  调用
┌─────────────────────────────────────────────┐
│  模型访问层（不在本次开源范围内）                 │
│  GPT-5.6 系列等 Codex 使用的模型                │
└─────────────────────────────────────────────┘
```

需要特别说明的是，**开源的只是"壳"，不是模型本身**——这和 DeepSeek Harness、以及国内一些完全开源模型+框架的项目不同，Codex Harness 开源的执行框架仍然需要调用 OpenAI 的模型服务（通过 ChatGPT 订阅或 API Key 鉴权），你可以自由改造、嵌入、二次分发这套框架代码，但跑在框架背后的大脑还是闭源模型。

三个组件按使用场景分工：

| 场景 | 用哪个组件 | 特点 |
| --- | --- | --- |
| 脚本 / CI 流水线里跑一次性任务 | `codex exec` | 非交互、有边界、返回结构化输出，适合"跑完就走"的一次性调用 |
| 应用后端需要精细控制任务生命周期 | Codex SDK | 直接编程接口，可以维护一个 `Thread` 反复 `run()`，持续对话 |
| 要做完整产品，自己拥有界面和审批逻辑 | `app-server` | 支持持久化会话、实时事件流、人机审批，是最重的一层但也最灵活 |

## 四、动手试一下：用 TypeScript SDK 搭一个带审批的编码 Agent

`codex exec` 更适合"一把梭"式的自动化任务，而如果你想把编码 Agent 嵌进自己的应用里、并保留人工审批的能力，官方 SDK 是更合适的入口。以下是一个从安装到跑通的最小示例。

### 4.1 安装

```bash
# CLI 本体（codex exec 依赖它）
npm install -g @openai/codex

# TypeScript SDK，用于在自己的代码里驱动 Agent
npm install @openai/codex-sdk
```

SDK 要求 Node.js 18 及以上版本。鉴权上支持两种方式：用 ChatGPT Plus/Pro/Business/Enterprise 账号登录，或者配置 API Key——具体取决于你的用量场景和账号类型。

### 4.2 最小可运行示例：启动一个会话并连续对话

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();

// 一个 Thread 就是一段可以持续对话的会话
const thread = codex.startThread({
  // 限定 Agent 能碰到哪些目录，做基本的沙箱边界
  workingDirectory: "./my-service",
});

// 第一轮：让它诊断一个失败的测试
const turn1 = await thread.run(
  "帮我看一下 test/order.spec.ts 里失败的用例，定位原因并给出修复方案，先不要直接改代码"
);
console.log(turn1.output);

// 第二轮：基于同一个会话上下文，确认后再执行修改
const turn2 = await thread.run("方案没问题，按刚才的思路把代码改掉，并跑一遍相关测试");
console.log(turn2.output);
```

`thread.run()` 可以在同一个 `Thread` 实例上反复调用，SDK 会维护多轮对话的上下文——这也是官方博客里强调的"长对话记忆"能力在代码层面的体现：你不需要自己拼接历史消息，Harness 已经处理好了状态管理和必要时的上下文压缩。

### 4.3 加入人工审批：拦截高风险操作

如果要做成一个产品功能，通常不希望 Agent 未经确认就执行写操作（比如 `git push`、删除文件、调用会产生真实副作用的工具）。这正是 `app-server` 这一层想解决的问题：它会在 Agent 打算执行"有后果的动作"之前，把这个意图通过事件流推给你的应用，由应用决定是放行还是拒绝，再把结果回传给 Harness 继续执行。这个模式和文中提到的 Relay 运维仪表盘的做法完全一致——**Agent 负责调查、解释、调用工具，人负责点最后那个"确认"按钮**，业务系统始终掌握着写操作的最终开关。

对于只是想快速跑批处理任务、不需要人工介入的场景（比如 CI 里跑一次代码扫描并生成报告），`codex exec` 反而更省心：

```bash
codex exec "扫描 src/ 目录，找出所有未处理的 Promise rejection，生成一份 markdown 清单" \
  --output report.md
```

## 五、和 Claude Code、DeepSeek Harness 比，差在哪

把最近密集出现的几个"编码 Agent 底座"放在一起看，会更清楚这次开源在生态里的位置：

- **Claude Code**：目前仍以完整产品的形态提供，Agent 循环、工具体系相对封闭，开发者主要通过 Hooks、MCP、Skills 这些扩展点去定制行为，而不是拿到执行引擎本身的源码。
- **DeepSeek Harness（`dsh`）**：8 月 13 日开源，核心理念是"一切皆插件"（Everything is a Plugin）——连模型、工具、沙箱、会话调度、Web 界面都是插件，宿主本身几乎是空的，插件之间通过共享上下文 `ctx` 协作，卸载插件时副作用会被原样撤销。它的开源程度更彻底，连模型接入方式都是插件化、可替换的。
- **Codex Harness**：这次开源的是执行引擎本身（`codex exec` / SDK / `app-server`），但模型访问层不在开源范围内，本质上是"框架开源、大脑闭源"的模式，更接近于给企业提供一套可以嵌入自有产品的"Agent 中间件"，而不是一个完全自主可控、可换脑的开源生态。

三者代表了编码 Agent 开源化的三种不同姿态：**完全封闭产品化**（Claude Code）、**框架与模型都开放的彻底插件化**（DeepSeek Harness）、**框架开放但模型仍闭源的中间路线**（Codex Harness）。对开发者来说，选哪一个取决于你更看重"开箱即用"还是"底层可控"：如果只是想要一个好用的编码助手，产品化方案依然省心；如果想把编码 Agent 的能力当作基础设施嵌入自己的系统，Codex Harness 和 DeepSeek Harness 这类开源执行框架给出的自由度明显更大。

## 六、对开发者意味着什么

站在实际使用的角度，这次开源至少打开了三类新的可能性：

1. **把编码 Agent 嵌入内部工具，而不是让员工去开外部聊天窗口。** 像 Cisco 那样，把 Harness 接进已有的云管理平台、运维仪表盘、CI 系统里，Agent 的输出直接作用于自有业务上下文，而不是复制粘贴进出一个独立的对话界面。
2. **审批流程可以按自己的业务规则定制。** `app-server` 暴露的事件流意味着"哪些操作需要人工确认"这件事完全由应用层决定，可以做成分级审批（比如只读操作自动放行、写操作需要审批、删除类操作需要双人复核），而不是被产品方预设的一套规则绑死。
3. **框架层面的优化收益是真实存在的。** 前面提到的 ARC-AGI-3 从 13.3% 到 38.3%、token 消耗降到六分之一，说明"怎么组织上下文、什么时候压缩历史、什么时候保留完整推理链"这些工程细节，本身就是能被持续打磨、能产生复合收益的领域——这也给了社区一个明确的优化方向：不一定非要等更强的模型，把 Harness 层做得更聪明本身就有巨大空间。

## 七、总结与展望

OpenAI 这次把 Codex Harness 开源出来，和一周前 DeepSeek 开源自家 Harness 放在一起看，勾勒出一个正在成型的行业共识：**编码 Agent 的竞争，正在从"谁的模型更强"扩展到"谁的执行框架更好用、更可嵌入"**。当模型能力的迭代速度已经快到让人应接不暇（本月国内外密集发布的十余个新模型就是证明），单纯比拼跑分的边际收益正在递减，而"怎么把模型接入真实业务、怎么管好长任务的状态和风险"这件事，反而成了下一个可以被系统性优化、也更容易在企业场景里产生复合价值的战场。

对开发者而言，比记住这条新闻本身更值得做的，是花点时间实际跑一遍 SDK 示例、感受一下"Agent 循环"被拆解成可编程组件之后的样子——无论最终选择 Codex Harness、DeepSeek Harness 还是继续用产品化的 Claude Code，理解这套底层机制，都会让你在设计自己的 Agent 化产品时，少走一些"重新发明轮子"的弯路。

## 参考来源

- [Codex as a platform: build on the open agent harness — OpenAI Developers](https://developers.openai.com/blog/codex-as-a-platform)
- [OpenAI Open Sources Codex Harness Framework — Open Source For You](https://www.opensourceforu.com/2026/08/openai-open-sources-codex-harness/)
- [OpenAI open-sources Codex core framework, enabling developers to build their own AI agent applications — BigGo Finance](https://finance.biggo.com/news/7ca9b7b6-430a-4561-975c-ef920e39f73a)
- [From Software Engineering to Harness Engineering: What OpenAI's Codex Actually Builds](https://kenhuangus.substack.com/p/from-software-engineering-to-harness)
- [OpenAI Fully Open-Sources Codex Harness — AI Disruption](https://aidisruption.ai/p/openai-fully-open-sources-codex-harness)
- [openai/codex — GitHub](https://github.com/openai/codex)
- [@openai/codex-sdk — npm](https://www.npmjs.com/package/@openai/codex-sdk)
- [codex/sdk/typescript/README.md at main · openai/codex](https://github.com/openai/codex/blob/main/sdk/typescript/README.md)
