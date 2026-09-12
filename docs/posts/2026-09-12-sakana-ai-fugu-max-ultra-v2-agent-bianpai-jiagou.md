---
title: 'Sakana AI 发布 Fugu Max / Ultra v2：当"更大的模型"让位于"更会指挥的模型"'
date: 2026-09-12
slug: 'sakana-ai-fugu-max-ultra-v2-agent-bianpai-jiagou'
author: 范伟彬
categories:
  - AI
  - 开发者工具
tags:
  - Sakana AI
  - Fugu
  - Agent 编排
  - 模型路由
  - 多智能体系统
  - 强化学习
  - 成本优化
description: '2026 年 9 月 11 日，Sakana AI 发布 Fugu Max 与 Fugu Ultra v2 两款"协调器模型"——它们本身是训练出来的语言模型，但作用不是直接回答问题，而是把用户请求拆解、动态搭建智能体脚手架，再分发给由开源权重和专用模型组成的池子去执行。本文基于 Sakana 官方发布页、MarkTechPost、AlphaSignal、OrcaRouter、AI/TLDR 等信源，梳理这套"协调器优先于单体模型"架构的设计动机、训练方法、基准表现与定价，并给出接入其 OpenAI 兼容 API 的实践代码与选型建议。'
---

# Sakana AI 发布 Fugu Max / Ultra v2：当"更大的模型"让位于"更会指挥的模型"

过去两年，几乎所有值得报道的大模型新闻都在讲同一个故事的不同版本：谁的参数更大、上下文更长、跑分更高、单 token 更便宜。但 2026 年 9 月 11 日 Sakana AI 发布的 Fugu Max 和 Fugu Ultra v2，讲的是一个不太一样的故事——它们不是"又一个基础模型"，而是一层专门训练出来、负责**指挥**其他模型干活的"协调器"（orchestrator）。这个方向如果跑通，可能会让"模型路由/编排"从一个工程技巧升级成独立的、可以单独做 scaling 的技术路线。这也是本站在过去一个月密集报道的 GPT-6 Astra、Claude Fable 5.1、DeepSeek V4.1-Flash 等"单体模型竞赛"之外，第一次遇到值得单开一篇细讲的"编排层"新闻。

## 一、背景介绍：为什么"路由"突然值得单独做一个模型

对接入过多个大模型 API 的开发者来说，"路由"并不陌生：简单任务扔给便宜模型，复杂任务才调用贵的旗舰模型，业界已经有 OpenRouter、Martian、NotDiamond 这类路由/网关服务在做类似的事情。但这类产品大多数是**规则或轻量分类器**做路由决策——本质上是"选择题"，从有限的几个候选模型里挑一个。

Sakana AI 这次做的是另一件事：把"路由决策"本身变成一个**训练出来的语言模型能力**。Fugu 系列模型收到用户请求后，不是直接生成答案，而是先理解任务、动态设计一套"智能体脚手架"（agent scaffold）——决定这个任务需要几个角色、每个角色调用池子里的哪个模型、彼此之间怎么通信、要不要相互验证——然后把执行结果综合成最终答案返回给用户。用户看到的还是一个单一的 OpenAI 兼容 API 端点，但背后可能已经调度了好几个不同的开源权重模型协同完成了任务。

这套思路并非凭空而来。Sakana 官方在发布页中引用了自家团队此前发表的三篇论文作为技术基础：

- **TRINITY**（arXiv 2512.04695）：探索"进化出轻量级协调器，为思考者（thinker）、工作者（worker）、验证者（verifier）分配角色"的方法；
- **Conductor**（arXiv 2512.04388）：研究"训练一个智能语言协调代理，管理多个智能体之间的通信"；
- **Fugu 技术报告**（arXiv 2606.21228）：正式提出"协调器模型家族"（orchestrator model family）概念，即模型本身是语言模型，但训练目标是理解查询并动态设计智能体脚手架来解决问题，而不是直接输出答案。

这次发布的 Fugu Max（定位性价比）和 Fugu Ultra v2（定位极致能力）共享同一套"协调层架构"，只是训练目标和调用的模型池不同——用 Sakana 的话说，是"同一套核心编排架构，服务于两个不同的目标"。

## 二、技术细节解析：协调器到底"协调"了什么

### 1. 架构：模型之上的模型

传统 MoE（Mixture-of-Experts）是在**权重层面**做路由——门控网络（gating network）在同一个模型内部决定每个 token 该激活哪几个专家子网络，专家和门控是联合训练、联合部署的同一份权重。而 Fugu 做的路由发生在**模型之上、API 之间**：它本身作为一个独立训练的语言模型，输出的不是最终答案的 token，而是"任务该怎么拆、该调用池子里哪些模型、以什么顺序组织"的决策与脚手架，再由这套脚手架去实际调用一群相互独立、可以来自不同厂商的模型。可以理解成：MoE 是"一个模型内部的专家分工"，Fugu 是"一群独立模型之间的项目经理"。

模型池方面，公开信息显示 Fugu Max 集成了"数量空前的开源权重与专用模型"，其中包括 NVIDIA Nemotron 系列——这也印证了 Sakana 与 NVIDIA 之间的合作关系。Fugu Ultra v2 的评测特意排除了 Anthropic Fable 5 / Fable 5.1、OpenAI GPT-6 Astra 等厂商旗舰模型，也就是说它达到的分数完全来自"编排一群非旗舰模型"，而不是靠转包给更强的模型来"作弊"刷分。

### 2. 训练方法：不是提示工程,是真的在训练协调能力

值得注意的是，Fugu 的协调器并非靠一套写死的提示词模板或规则引擎实现，官方技术报告披露训练范式融合了三类方法：

- **大规模微调（large-scale fine-tuning）**：让模型学会理解任务类型、识别需要哪些能力；
- **进化算法（evolutionary algorithms）**：这与 TRINITY 论文中"进化出协调器"的思路一致，通过对大量脚手架变体进行选择迭代，找到更高效的任务分解与角色分配方式；
- **强化学习（reinforcement learning）**：以最终任务完成质量、成本、延迟等作为奖励信号，直接优化协调决策本身。

这意味着"该把这个任务交给哪个模型、要不要引入验证者角色二次检查"这类决策，是被当作一个可优化的学习问题来训练的，而不是人工写死的分支逻辑——这也是它区别于 OpenRouter 这类"路由网关"产品的核心差异：后者的路由策略通常是可解释、可配置的规则或轻量分类器，Fugu 的路由策略是一个黑盒式的、训练出来的策略网络。

### 3. 一个诚实但也值得警惕的"不透明"设计

第三方测评者 OrcaRouter 在实测后指出一个耐人寻味的细节：Sakana 官方明确表示"故意不公开"每次请求具体路由到了池子里的哪个模型。也就是说，开发者拿到的是一个端到端的结果和一个总账单，但看不到这次调用背后到底是哪几个模型在干活、各自贡献了多少。这对习惯了"我知道我在用哪个模型"的开发者来说是一个心智转变——某种程度上，接入 Fugu 更像是把一部分基础设施决策外包给了 Sakana，而不是单纯换了一个模型供应商。这个不透明性目前还没有独立的第三方复现和审计，是采用前需要认真评估的风险点。

## 三、基准表现与定价：数字说话

| 指标 | Fugu Max | Fugu Ultra v2 |
| --- | --- | --- |
| 定位 | 成本优先 | 能力优先 |
| 输入价格（常规上下文） | $2 / 百万 token | $5 / 百万 token |
| 输出价格（常规上下文） | $6 / 百万 token | $30 / 百万 token |
| 缓存输入价格 | — | $0.50 / 百万 token |
| 超长上下文（>272K）价格 | — | $10 / $45 / 百万 token |
| 相对同级模型价格优势 | 比 Sonnet 5、GPT 5.6 Terra、Kimi K3 低 40%–60% | — |
| Chartography 基准得分 | — | 48.3（对比 Opus 5 的 27.3、Fable 5 的 29.5） |
| DeepSWE 基准得分 | — | 74.3 |
| 领先基准数量 | 六项基准取得最佳综合得分（含 Terminal Bench 2.1、GPQAD） | 八项基准中五项取得最佳或并列最佳 |

需要提醒的是，以上基准数据来自 Sakana 官方发布内容及转述媒体，目前尚缺乏独立第三方复现；Chartography、DeepSWE 这类基准本身的代表性和抗污染能力，也是评估任何新模型时都应保持的常规审慎态度。

## 四、实践指南：如何接入并做出选型决策

### 1. 接入方式：与切换现有模型几乎无缝

Fugu Max / Ultra v2 都使用 OpenAI 兼容 API，官方强调"从一个版本切换到另一个版本只需要改一行参数"，并且已经上架 Sakana 自家控制台、OpenRouter 和 Vercel AI Gateway。以 Python 为例，接入方式和调用任何 OpenAI 兼容端点没有区别：

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.sakana.ai/v1",  # 实际以官方文档为准
    api_key="YOUR_SAKANA_API_KEY",
)

response = client.chat.completions.create(
    model="fugu-max",  # 换成 "fugu-ultra-v2" 即可切换到能力优先版本
    messages=[
        {"role": "system", "content": "你是一个负责代码审查和方案设计的助手。"},
        {"role": "user", "content": "帮我审查这段 Rust 异步代码，并给出并发安全性方面的建议。"},
    ],
    temperature=0.3,
)

print(response.choices[0].message.content)
```

### 2. 一个简单的成本感知降级封装

由于 Fugu Max 和 Ultra v2 定位不同，实践中比较合理的做法是按任务复杂度动态选择，而不是一刀切绑定某个版本。可以参考下面这种轻量封装思路（示意代码，需按官方 SDK 实际接口调整）：

```python
def call_fugu(messages, complexity: str = "simple"):
    """根据任务复杂度选择 Fugu 版本，简单任务优先走 Max 控制成本。"""
    model = "fugu-ultra-v2" if complexity == "hard" else "fugu-max"
    try:
        return client.chat.completions.create(model=model, messages=messages)
    except Exception as e:
        # Max 不可用或超时时降级到 Ultra v2，反之亦然，按业务容忍度决定降级方向
        fallback = "fugu-max" if model == "fugu-ultra-v2" else "fugu-ultra-v2"
        return client.chat.completions.create(model=fallback, messages=messages)
```

这里的 `complexity` 判断可以用一个便宜的小模型或简单规则（如输入长度、是否含代码块、是否要求多步推理）预先打标，避免所有请求都默认打到 Ultra v2 造成成本失控。

### 3. 选型评估清单

在把 Fugu 这类协调器模型接入生产环境之前，建议至少确认以下几点：

- **可观测性诉求**：如果你的合规或调试流程需要知道每次请求具体用了哪个底层模型，Fugu 目前"故意不公开路由"的策略可能不满足要求；
- **延迟敏感度**：多智能体协调天然意味着可能存在多轮内部调用，相比直接调用单一模型，端到端延迟和延迟的方差都值得实测；
- **成本护栏**：即使 Fugu Max 单价更低，协调器如果误判任务复杂度、错误地升级调用更贵的内部模型，实际账单仍可能超出预期，需要在自己这一层加监控和硬性预算上限；
- **供应链依赖**：官方将"避免供应商锁定"作为卖点之一（因为池子里是可替换的开源权重模型），但从开发者角度看，你实际上是把依赖从"某个模型厂商"转移成了"Sakana 这一层协调器"，这本身也是一种新的锁定。

## 五、总结与展望

Fugu Max / Ultra v2 释放的信号，比它们的跑分数字更值得关注：当单体模型的 scaling law 收益逐渐进入边际递减、而推理成本又是所有 AI 产品绕不开的现实约束时，"训练一个专门负责指挥和编排的模型"正在成为一条独立于"堆参数"之外的新路线。这和本站近期报道过的多篇文章形成了有意思的呼应——无论是 Claude 平台把 Agent 工具全面铺开，还是 A2A 协议并入 AAIF 与 MCP 合并，都在指向同一个方向：单一模型的能力边界之外，**编排层**正在成为下一个竞争焦点。

但技术叙事和工程现实之间还有距离。Fugu 目前最大的争议点——路由决策不透明、缺乏独立第三方复现——恰恰是生产环境采纳新基础设施时最在意的两件事。对国内开发者而言，短期内更现实的做法是：持续关注这类"协调器模型"的独立评测和开源复现进展（TRINITY、Conductor 论文提供的方法论本身是公开的，即便 Sakana 的具体实现细节不公开），同时在自己的系统里，用前文提到的简单成本感知封装，先把"路由"这件事的主动权握在自己手里，再逐步评估是否要把这一层交给像 Fugu 这样的专用协调器模型。

## 参考来源

- [Sakana AI 官方发布：Introducing Fugu Max and Fugu Ultra v2](https://sakana.ai/fugu-max-release/)
- [MarkTechPost: Sakana AI Launches Fugu Max and Fugu Ultra v2 for Cheaper, Stronger Multi-Agent Orchestration](https://www.marktechpost.com/2026/09/10/sakana-ai-launches-fugu-max-and-fugu-ultra-v2-for-cheaper-stronger-multi-agent-orchestration/)
- [AlphaSignal: Sakana AI Splits Fugu Into Max and Ultra v2 to Cut Costs 60%](https://alphasignal.ai/news/sakana-ai-splits-fugu-into-max-and-ultra-v2-to-cut-costs-60)
- [OrcaRouter: Sakana Fugu Ultra v2 — a smaller pool, a higher score](https://www.orcarouter.ai/blog/fugu-ultra-v2-explained)
- [AI/TLDR: Fugu Max and Fugu Ultra v2 — Sakana's router …](https://ai-tldr.dev/releases/sakana-fugu-max/)
- [AI/TLDR: Fugu Ultra v2 — Sakana AI's Orchestration Model](https://ai-tldr.dev/models/fugu-ultra-v2/)
- [Sakana AI Fugu 技术报告（arXiv 2606.21228）](https://arxiv.org/abs/2606.21228)
- [TRINITY 论文（arXiv 2512.04695）](https://arxiv.org/abs/2512.04695)
- [Conductor 论文（arXiv 2512.04388）](https://arxiv.org/abs/2512.04388)
