---
title: 'Elephant-Goldfish：为什么写设计和审设计，不该是同一个 AI 会话'
date: 2026-10-24
slug: 'elephant-goldfish-ai-spec-review'
author: 范伟彬
description: 'Google 刚开源的 Elephant-Goldfish Model 把 AI 编程拆成深上下文设计与零上下文审查。本文解释它怎样减少共同盲区、如何接入 Codex 等工具，并实测仓库校验，厘清隔离、成本和成熟度边界。'
categories:
  - AI
  - 技术
  - 开源
tags:
  - Elephant-Goldfish Model
  - Google
  - AI 编程
  - Spec-Driven Development
  - 多智能体
  - Codex
---

AI 写设计文档时最危险的情况，不一定是它不知道答案，而是它把讨论中形成的假设带进了审查阶段：同一个会话先决定架构，再回头检查自己的架构，往往会自动补全设计文档里没有写出来的背景，甚至替先前的选择辩护。

Google 在 **2026 年 10 月 22 日**公开了 Elephant-Goldfish Model（EGM）插件，尝试用一个直接的结构解决这个问题：让“记得很多”的 Elephant 会话负责访谈、权衡和写规格；再让一组没有前序对话的 Goldfish 子智能体，只凭规格、审查标准和明确指定的源码做反向检查。

它不是新的代码模型，也不承诺替开发者自动完成整个项目。它更像一套把设计、审查和实现分开的工作规程：**先把意图写成可交付的文件，再用不共享作者记忆的读者证明这份文件真的自洽。**

## 同一个长会话为什么容易漏掉问题

假设你和 AI 讨论“给订单系统增加批量退款”。对话里已经说过：

- 退款请求必须幂等；
- 单次最多 100 笔；
- 部分失败时不能回滚已成功的外部支付；
- 后台任务需要能够断点恢复。

经过二十轮讨论，AI 写出的设计文档却只留下“异步处理批量退款”。让同一个会话复查时，它可能认为幂等键、上限和恢复策略“前面都讲过”，于是给出通过结论。换一个只看到设计文档的读者，这些缺口会立刻暴露。

这就是 EGM 的两种角色：

| 角色 | 可见上下文 | 主要任务 |
| --- | --- | --- |
| Elephant | 项目历史、架构、用户需求和讨论过程 | 探索需求、比较方案、形成设计规格 |
| Goldfish | 审查人格、目标文档、标准及明确列出的源码 | 检查文档是否自包含、简单、可落地 |
| Human | 设计与审查产物 | 决定取舍、接受或驳回问题、承担最终责任 |

这里的 Goldfish 不是能力更弱的模型。“金鱼记忆”指它不继承作者会话，而不是不给它资料。它仍应读取目标文档、审查规则，以及设计里引用的真实代码；缺的是作者在聊天中形成的隐性解释。

## EGM 把一次功能开发拆成五段

EGM 当前仓库提供 7 个 Skill，主流程可以归纳为五段：

1. `egm-brainstorm` 先访谈需求，再从六个角度攻击早期想法；
2. `egm-draft` 把讨论转换为提交到 `docs/designs/` 的设计文件；
3. `egm-review` 依次做简化检查、理解测试、设计批评和实现就绪检查；
4. `egm-resolve` 让人逐项接受、修改或反驳审查意见；
5. 实现完成后，`egm-drift-report` 对比规格与代码，寻找后续偏离。

审查不是让十个 Agent 同时发表意见就结束。官方流程给不同阶段分配了不同问题：

- **Zoom Out**：有没有把简单问题设计复杂，仓库里是否已有可复用能力；
- **Comprehension**：一个没有参加讨论的人，能否仅靠文档解释系统；
- **Design Critic**：故障、扩展、数据一致性和边界条件是否交代清楚；
- **Implementation Readiness**：文件路径、接口签名、迁移步骤与测试计划是否能在当前源码中找到依据；
- **Style / Structural**：文档结构和表达是否妨碍执行。

多视角本身不是重点，**不同审查者之间不共享作者的对话偏差**才是重点。最终问题仍需汇总、去重并由人处理，否则只会把一次含糊的设计变成一堆含糊的评论。

## 一份最小设计怎样暴露隐性信息

下面是一个刻意不完整的示意规格，不是 EGM 官方样例：

```markdown
## 批量退款

新增 POST /refunds/batch，收到订单列表后异步调用支付渠道。
任务完成后更新订单状态，并向运营后台展示结果。

## Implementation Plan

1. 修改退款接口。
2. 增加后台任务。
3. 添加测试。
```

作者会话可能知道所有背景，零上下文审查者却只能根据文本追问：

- 重试时用什么键去重，谁生成这个键；
- 支付成功、订单状态写入失败时怎样恢复；
- “完成”是全部成功，还是允许部分成功；
- 任务并发、批次上限和渠道限流在哪里定义；
- “修改退款接口”具体对应哪个文件和函数；
- 哪些测试证明断点恢复不会重复退款。

这些并不是让设计文档无限膨胀。Zoom Out 审查还会反向删除没有现实需求支撑的队列、缓存或抽象层。EGM 的理想状态不是“文档越长越好”，而是让实现所需的信息都能从文件和源码回指，不依赖某次聊天的记忆。

## 如何在现有工具里试用

仓库把同一套 `skills/`、`agents/` 和审查标准适配到 Antigravity、Claude Code、Codex、Claude Cowork 与 ChatGPT。以 Codex 为例，官方给出的安装命令是：

```bash
codex plugin marketplace add google/elephant-goldfish-model
codex plugin add egm@egm
```

安装后需要开启新会话，再按 Brainstorm、Draft、Review 的顺序处理一个真实功能。项目特别提醒，不要只复制 `skills/`：审查 Skill 在运行时还会读取 `agents/` 人格文件和 `resources/document_standards/`，缺少这些目录会得到一个看似安装成功、实际无法完整审查的残缺插件。

第一次试用不必挑全新系统。更合适的是选择一个已有代码、准备增加中等规模功能的仓库，然后比较三件事：

1. 未经 Goldfish 审查的初稿遗漏了哪些约束；
2. 审查意见中有多少能指向真实源码或测试，而不是泛泛建议；
3. 设计确认后，实现阶段返工是否减少。

不要只统计“发现了多少问题”。如果审查者生成大量无法复现、与现有代码不符的问题，评论数量越多反而越拖慢开发。

## 我验证了什么

我把源码固定在提交 [`d651fe8`](https://github.com/google/elephant-goldfish-model/tree/d651fe86c12dccc5272274e002674fb8eec4c547)，使用 Python 3.12.14 安装仓库声明的 `pytest` 与 `PyYAML`，执行：

```bash
pytest tests/unit -q -rA
```

结果是 **49 项单元测试全部通过**。这些测试覆盖：

- 7 个 Skill 的 frontmatter 与加载体积；
- 相对 Markdown 链接；
- Agent Plugins、Codex 和 Claude 的清单一致性；
- 各 Skill 是否配有测试场景；
- Claude 适配层是否限制审查者工具和插件读取范围；
- JSONL 轨迹中的特殊 Unicode 分隔符处理。

这能证明当前仓库的打包结构、链接和一部分适配约束是自洽的，**不能证明 Goldfish 一定能发现真实设计缺陷**。审查质量仍取决于模型、提供的源码、规格质量和人格提示。

项目自己的测试记录称，Antigravity、Claude Code 和 Codex 已完成端到端夹具验证；ChatGPT Work 与 Claude Cowork 仍列有云端轨迹核验缺口。这些是项目维护者记录，不是我本次独立复测的性能结论。为了不消耗外部模型额度，我没有运行需要认证账户的 live 多智能体集成测试，也没有把一次模拟审查包装成真实 Goldfish 结果。

## 与普通多 Agent 审查有什么不同

EGM 最容易被误解成“多叫几个 Agent 看一遍”。它真正增加的是可检查的边界：

- 规格是仓库文件，不是埋在聊天记录里的结论；
- 每类审查者有明确职责，不是重复问“有没有问题”；
- 子智能体必须使用新会话，不能继承作者讨论；
- 审查分阶段执行，先判断值不值得做，再检查怎样实现；
- 实现之后还有规格漂移检查，而不是合并后遗忘设计。

它与 Agent Skills 规范也不是同一层问题。Agent Skills 解决“如何把一套知识和流程封装给不同客户端发现、加载”；EGM 则使用 Skill、人格和文档标准实现一套具体的软件设计方法。前者更像插件格式，后者更像装进插件里的工作制度。

## 什么时候值得用，什么时候会变成负担

EGM 更适合这些任务：

- 会触及多个模块、数据模型或外部接口；
- 团队成员需要异步理解设计；
- 失败代价较高，值得在写代码前暴露边界条件；
- 设计会长期演化，需要让后续 Agent 读取可信规格。

下面几类工作通常不值得跑完整流程：

- 明确的一行配置修改；
- 已有测试直接描述预期行为的小缺陷；
- 只需要探索、还没有形成稳定需求的实验；
- 无法给审查者访问相关源码，却期待它核对实现细节。

成本也很实际。多轮子智能体会增加 Token、等待时间和审查噪声；设计文件可能比代码变化更大；如果所有 Goldfish 使用同一模型与近似提示，所谓“独立”仍不等于真正多样。更重要的是，新会话只隔离对话历史，并不自动隔离文件系统、项目级指令、外部记忆或工具权限。仓库文档也明确提醒：**上下文新鲜不是安全沙箱。**

## 值得带走的不是动物名字

即使不安装 EGM，也可以先采用它最有价值的一条原则：写完设计后，另开一个没有前序聊天的新会话，只给它设计文档、审查标准和必要源码，要求它先复述理解，再找缺口。

如果它无法准确解释系统，不要急着让另一个 Agent 开始编码。对 AI 编程来说，一份能被陌生读者独立还原的规格，比“作者会话记得所有事情”更接近可以长期复用的工程资产。

## 原始资料

- [Google Open Source Blog：Introducing the Elephant-Goldfish Model plugin](https://opensource.googleblog.com/2026/10/introducing-elephant-goldfish-model-plugin.html)
- [Elephant-Goldfish Model 源码仓库](https://github.com/google/elephant-goldfish-model)
- [EGM Architecture & System Lifecycle](https://github.com/google/elephant-goldfish-model/blob/d651fe86c12dccc5272274e002674fb8eec4c547/docs/designs/architecture.md)
- [EGM Goldfish Review Protocol](https://github.com/google/elephant-goldfish-model/blob/d651fe86c12dccc5272274e002674fb8eec4c547/docs/designs/review.md)
- [EGM Testing Playbook](https://github.com/google/elephant-goldfish-model/blob/d651fe86c12dccc5272274e002674fb8eec4c547/TESTING.md)
- [Codex integration](https://github.com/google/elephant-goldfish-model/blob/d651fe86c12dccc5272274e002674fb8eec4c547/docs/codex.md)
