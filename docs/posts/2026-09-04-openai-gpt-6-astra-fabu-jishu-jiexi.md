---
title: 'GPT-6 Astra 发布：OpenAI 首次喊出"AGI 时代"，开发者该关心的六件事'
date: 2026-09-04
slug: 'openai-gpt-6-astra-fabu-jishu-jiexi'
author: 范伟彬
categories:
  - AI
tags:
  - OpenAI
  - GPT-6 Astra
  - Codex
  - Preparedness Framework
  - API
  - Agent
  - AI 安全
description: '2026 年 9 月 3 日，OpenAI 正式发布 GPT-6 Astra，总裁 Greg Brockman 在发布会上说出"Welcome to the AGI era"。本文基于 OpenAI 官方发布信息、Bloomberg、CNBC、9to5Mac、9to5Google、The Decoder、Artificial Analysis、digitalapplied.com 等信源，梳理 Astra 的定价与 API 细节（reasoning_effort 分级、100 万 token 上下文、超长输入涨价规则）、ARC-AGI-3/FrontierMath 等基准表现、Codex 的跨会话记忆能力，以及它为何是 OpenAI 历史上首个触及 Preparedness Framework "Critical" 网络安全门槛而被限流发布的模型，并给出开发者接入与评估该模型时需要注意的具体清单。'
---

# GPT-6 Astra 发布：OpenAI 首次喊出"AGI 时代"，开发者该关心的六件事

2026 年 9 月 3 日，OpenAI 发布了新一代旗舰模型 GPT-6 Astra。发布会上，OpenAI 总裁 Greg Brockman 说了一句会被反复引用的话："Welcome to the AGI era"（欢迎来到 AGI 时代）——即便他自己也承认，"其实并不存在一个清晰的 AGI 时刻"，这次更像是一次渐进跨越后的事后宣布，而不是某个突然被点亮的开关。

这不是一次孤立的发布。一个月前，也就是 8 月 7 日到 10 日，OpenAI 曾连发两条网络安全公告，披露内部测试中代号 "Astra" 的下一代模型网络安全能力可能触及 Preparedness Framework 里此前从未有模型抵达过的 "Critical" 门槛，因此就地暂停了其内部不满足强化安全条件的活动（详见本站此前文章）。一个月后，这个被按下暂停键的 Astra，正式带着完整的安全护栏上线了。本文基于 OpenAI 官方发布信息、Bloomberg、CNBC、9to5Mac、9to5Google、The Decoder、Artificial Analysis 与 digitalapplied.com 的报道和实测数据，把开发者最需要知道的技术细节讲清楚。

## 一、背景介绍：从"被锁死"到"限流上线"

回顾时间线，能更好理解这次发布为什么处处透着"谨慎"：

- **8 月 7 日**：OpenAI 披露 Astra 内部评估显示其网络安全能力可能达到 Preparedness Framework 的 "Critical" 等级——这是该框架自发布以来第一次有模型真正逼近这条红线。
- **8 月 10 日**：OpenAI 把经过安全微调的 GPT-5.6-Cyber 开放给防御方使用，作为 Astra 完全放开前的"过渡产品"，同时将 Daybreak 项目拆分为 Blue（防御）/Red（受限攻防研究）双通道。
- **9 月 3 日**：GPT-6 Astra 正式发布，且官方明确将其列为 OpenAI 历史上第一个在 Preparedness Framework 下被归类为 "Critical" 网络安全等级的正式发布模型——意味着它已经具备自主发现未知漏洞、串联构造可用 exploit 链的能力，OpenAI 自己也承认"监控 Astra 的推理过程比以往任何模型都更困难"。

也正因如此，Astra 的发布走的是一条典型的"分层放量"路径：优先面向 Daybreak 项目内经过审查的企业客户开放，随后几天内逐步扩展到 ChatGPT Plus / Pro / Business / Enterprise 用户，以及 OpenAI API 和 AWS。企业管理员默认是**关闭** Astra 权限的，需要主动在后台为工作区开启。

## 二、技术细节解析

### 1. 基准测试：多项指标被"打满"

Astra 在多个高难度基准上出现了饱和（saturate）级别的分数：

| 基准 | Astra | GPT-5.6 Sol | 说明 |
|---|---|---|---|
| ARC-AGI-3 | 99.9% | 7.8% | 抽象推理与新任务泛化 |
| FrontierMath Tier 4 | 98% | — | 数学最高难度层级，官方称已协助解决"长期悬而未决的数学开放问题" |
| ExploitBench | 100% | — | 漏洞利用能力评测，也是触发 Critical 分级的关键依据之一 |
| OSWorld 2.0（电脑操作） | 72.6% | 65.7% | 真实桌面环境自主操作任务 |
| Humanity's Last Exam（带工具） | 57.2% | 65% | 反而低于上一代，说明并非所有维度都在提升 |
| Artificial Analysis Coding Index | 67 | — | 略低于 Claude Fable 5.1 的 68.1 |

需要注意的是，这些"跑满"的分数大多是在 `xhigh`/`max` 最高推理强度下测得的"上限成绩"，而不是同等成本下的横向对比——评估一个模型时不能只看新闻标题里的百分比，要看它在你实际会用的推理档位和预算下表现如何。

### 2. API 细节：定价、上下文窗口与 reasoning_effort

对开发者来说，比基准分数更实用的是这些参数：

- **模型 ID**：`gpt-6-astra`，支持 Responses API、Chat Completions API 和 Batch API；**工具调用（function calling）必须使用 Responses API**。
- **不支持**：Realtime API、Assistants API、微调（fine-tuning）、embeddings、原生图像/视频/音频生成。
- **上下文窗口**：约 105 万 token（最大输入 92.2 万 token，最大输出 12.8 万 token）。
- **标准定价**：输入 $10/百万 token，输出 $50/百万 token，缓存输入 $1/百万 token，缓存写入 $12.5/百万 token。
- **超长输入涨价规则**：当输入超过 27.2 万 token 时，输入和缓存单价**翻倍**，输出单价上涨 50%，且是对整个请求生效（不是只对超出部分）——这意味着简单地把 100 万 token 塞满一次调用，实际成本会比线性外推的预期高得多。
- **Batch/Flex** 按对应费率的一半计费，**Fast** 档位按对应费率的两倍计费。
- **`reasoning_effort` 参数**：支持 `low`、`medium`、`high`、`xhigh`、`max` 五档（没有 `none`），可以在对话过程中通过 `configuration_update` 动态调整推理强度，同时保留已生成内容的前缀，不需要重新起一轮对话。

### 3. Codex 的跨会话记忆：不再是"压缩摘要"

这次发布对编码场景最实质的改动，是 Codex 里 Astra 的上下文管理方式。以往长会话超出上下文窗口后，模型只能把早期内容压缩成一份摘要，细节大量丢失；Astra 可以**跨上下文窗口做笔记**，早期的对话内容依然可检索，模型能直接引用几十轮之前提到的需求细节或测试结果，而不是依赖一份被反复压缩、逐渐失真的摘要。对做长周期重构、多轮迭代需求梳理的 Agent 场景，这是比跑分更值得关注的工程改进。

## 三、实践指南：接入与评估清单

如果你在评估是否要把 Astra 接入自己的产品或 Agent 流程，建议按以下顺序检查：

**1. 确认权限已开启。** 企业账号默认关闭 Astra，需要管理员在后台为工作区单独启用；个人开发者需要确认 API Key 所在组织已进入放量名单。

**2. 用最低推理档位起步，再按需升级。** 示例（Responses API，Python 伪代码，字段名以官方 SDK 文档为准）：

```python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-6-astra",
    reasoning_effort="medium",   # 先用 medium 验证正确性，避免直接跑 max 烧预算
    input=[
        {"role": "user", "content": "分析这段 Python 代码里的并发 bug，并给出修复方案"}
    ],
    tools=[...],  # 工具调用必须走 Responses API
)

# 会话中途按需要提升推理强度，复用已有前缀
response = client.responses.create(
    model="gpt-6-astra",
    previous_response_id=response.id,
    reasoning_effort="xhigh",
)
```

**3. 控制单次请求的输入长度，规避涨价阈值。** 把长文档、长代码库分块检索后再喂给模型，尽量把单次输入控制在 27.2 万 token 以内，除非任务确实需要超大上下文一次性推理。

**4. 给高权限操作加人工审批。** 由于 Astra 已被归类为网络安全 Critical 等级，任何涉及代码执行、系统命令、外部网络请求的 Agent 工作流，都应该沿用此前 Daybreak Blue/Red 机制里"分级授权 + 操作留痕"的思路，而不是把 Astra 当成完全可信、可以无监督放权的黑箱。

**5. 不要只看单一基准就下结论。** Astra 在 ARC-AGI-3、FrontierMath 上接近满分，但在 Humanity's Last Exam（带工具）上反而低于上一代 GPT-5.6 Sol，说明模型能力提升并非全面均匀。针对你自己的业务场景做小规模 A/B 评测，比迷信官方跑分更可靠。

**6. 留意 Codex 里的长会话行为变化。** 如果你的团队用 Codex 做长周期任务，升级后应重新审视"上下文压缩"相关的 prompt 技巧和监控逻辑——旧版本里为规避摘要丢信息而设计的分段提交、状态文件等 workaround，在 Astra 上可能不再必要，但也需要验证跨窗口笔记功能在你的具体工作流里是否可靠。

## 四、总结与展望

GPT-6 Astra 是一次典型的"能力与克制并存"的发布：一边是 Greg Brockman 喊出"AGI 时代"、多项基准被刷到接近满分，一边是它成为 OpenAI 历史上第一个正式触发 Preparedness Framework "Critical" 网络安全等级的模型，导致发布本身要用分层放量、企业默认关闭、Daybreak 优先准入这些手段主动"踩刹车"。对开发者而言，比"AGI 时代"这种口号更值得关注的，是它在真实工程场景里带来的具体变化：Codex 的跨上下文记忆、超长输入的非线性涨价、以及在不同任务维度上并不均匀的能力提升。短期内，建议先在小范围、低推理档位下验证 Astra 在自己业务上的实际收益，再决定是否大规模迁移；同时，鉴于它已经跨过了网络安全的 Critical 门槛，任何面向 Astra 开放执行权限的 Agent 系统，都应该把权限分级和操作审计当成默认要求，而不是事后补救的选项。

## 参考来源

- [Bloomberg: OpenAI Rolls Out GPT-6 Astra Model With Added Cyber Guardrails](https://www.bloomberg.com/news/articles/2026-09-03/openai-rolls-out-gpt-6-astra-model-with-added-cyber-guardrails)
- [CNBC: OpenAI announces rollout of GPT-6 Astra model](https://www.cnbc.com/2026/09/03/open-ai-astra-gpt-6-cyber.html)
- [9to5Google: OpenAI launches GPT-6 Astra, "the world's most intelligent and aligned model" that you can't use just yet](https://9to5google.com/2026/09/03/openai-gpt-6-astra-launch/)
- [9to5Mac: OpenAI releasing major upgrade to ChatGPT and Codex with GPT-6 Astra](https://9to5mac.com/2026/09/03/openai-releasing-major-upgrade-to-chatgpt-and-codex-with-gpt-6-astra-details-here/)
- [The Decoder: GPT-6 Astra is the first model making OpenAI willing to declare the "AGI era"](https://the-decoder.com/gpt-6-astra-is-the-first-model-making-openai-willing-to-declare-the-agi-era/)
- [digitalapplied.com: GPT-6 Astra: Price, Access and What the Benchmarks Show](https://www.digitalapplied.com/blog/gpt-6-astra-price-benchmarks-guide)
- [Artificial Analysis: GPT-6 Astra 系列模型对比](https://artificialanalysis.ai/models/gpt-6-astra)
