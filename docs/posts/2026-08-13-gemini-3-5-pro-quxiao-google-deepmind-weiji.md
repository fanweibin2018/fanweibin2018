---
title: 'Gemini 3.5 Pro 被曝"悄悄取消"：算力、人才与编程能力差距压垮谷歌的一场三重危机'
date: 2026-08-13
slug: 'gemini-3-5-pro-quxiao-google-deepmind-weiji'
description: '2026 年 8 月，研究机构 SemiAnalysis 判断谷歌旗舰模型 Gemini 3.5 Pro 已被"悄悄取消"——距离 5 月 I/O 大会承诺的发布时间已延期超过 70 天，一度在 LMArena 上线又在 30 分钟内被撤下。与此同时，DeepMind CEO Demis Hassabis 卸任转任董事长，Jeff Dean 等四人出走创业，Noam Shazeer 跳槽 OpenAI，联合创始人 Sergey Brin 时隔多年重返一线亲自督战编程能力。本文基于 SemiAnalysis、Fortune、Axios、CNBC、腾讯新闻等信源，拆解 Gemini 3.5 Pro 延期取消背后的编程能力差距、TPU 算力分配矛盾与人才流失三条主线，并给出开发者在模型生态剧烈波动期如何搭建多供应商容灾路由的实践示例。'
author: 范伟彬
tags:
  - Google DeepMind
  - Gemini
  - Gemini 3.5 Pro
  - Sergey Brin
  - Demis Hassabis
  - TPU
  - 人才流失
  - 大模型竞争
categories:
  - AI
  - 行业动态
---

# Gemini 3.5 Pro 被曝"悄悄取消"：算力、人才与编程能力差距压垮谷歌的一场三重危机

2026 年 5 月的 Google I/O 大会上，谷歌信誓旦旦地表示 Gemini 3.5 Pro 将在"下个月"发布。三个多月过去，这款旗舰模型始终没有正式亮相，只在 7 月 31 日于评测平台 LMArena 上短暂现身约 30 分钟便被撤下，随后官方的说法一直停留在"仍在与合作伙伴做封闭测试"。半导体与 AI 产业研究机构 SemiAnalysis 在 8 月的报告中给出了更直接的判断：Gemini 3.5 Pro 已经被"悄悄取消"，谷歌的核心工程资源正在转向代号更靠后的 Gemini 4，而目前顶替门面的是本应只是过渡产品的 Gemini 3.6 Flash。谷歌发言人 Logan Kilpatrick 随后公开反驳，称 SemiAnalysis 的分析"流于表面"，但截至目前谷歌仍未给出 Gemini 3.5 Pro 的确切上市时间，也未正面否认"取消"这个判断本身。

这不是一次孤立的产品跳票。把过去三个月的碎片信息拼在一起——模型延期、创始人紧急出山、CEO 卸任、四名重量级研究员集体出走、王牌架构师跳槽竞争对手、超两成 TPU 算力被合同锁定给 Anthropic——会看到一幅更完整的图景：谷歌在这一轮大模型竞赛中正同时遭遇技术、人事、算力三条战线的压力。对每天依赖 Gemini、Claude、GPT 系列做开发的工程师来说，这场危机不只是八卦，它直接关系到"该不该把生产系统绑死在单一模型供应商上"这个非常现实的问题。

## 一、背景：从"下月发布"到"悄悄取消"的三个月

Gemini 3.5 Pro 的时间线值得完整还原一遍。5 月 I/O 大会上，谷歌把它定位为对标 Claude Opus、GPT-5.6 Sol 的下一代旗舰模型，承诺"下月推出"；进入 6、7 月后发布节点一再顺延，直到 7 月 31 日模型才第一次以匿名形式出现在 LMArena 竞技场上，供用户盲测打分，但仅仅上线约 30 分钟就被下架，官方没有给出解释。8 月初，SemiAnalysis 在追踪各家实验室算力与模型路线图的报告中判断，这次"闪现"更像是一次内部测试的意外泄露，而不是发布前奏，并明确写下"已被悄悄取消"的结论。

支撑这一判断的核心证据是能力评估：SemiAnalysis 认为 Gemini 3.5 Pro 目前展现出的实际水平，大致只相当于 Anthropic 去年 11 月发布的 Claude Opus 4.5，而不是一款应该在 2026 年下半年对标 GPT-5.6 Sol、Claude Opus 5 的旗舰模型。作为参照，目前顶着"过渡产品"名义在线上服务用户的 Gemini 3.6 Flash，在综合榜单上只能排到第 8、9 位，与头部模型在编程、推理、Agent 任务上的差距是肉眼可见的——这也是为什么谷歌迟迟不愿意把 3.5 Pro 以"旗舰"身份仓促推出：一旦正式发布就要直接接受与 Claude、GPT 的正面评测对比，而不是继续躲在"内测中"的模糊状态里。

## 二、技术细节解析：编程能力差距、算力错配与人才出走

### 1. 编程能力是这次危机最直接的导火索

多份报道指出，Gemini 3.5 Pro 迟迟无法定档的核心症结之一是编程能力没有达到内部设定的目标。放在整个行业的坐标系里看这个差距更直观：目前 Terminal-Bench 2.1 上，GPT-5.6 Sol 以 89.5% 领先，Claude Opus 5 紧随其后为 89.1%；SWE-bench Verified 上 Claude Fable 5 以 95.0% 排在第一位。这些基准测的都是模型能否在真实终端环境和真实 GitHub issue 上独立完成端到端的编码任务，而这恰恰是 Gemini 3.5 Pro 相对薄弱的维度。对一家把"Agent 编码能力"作为下一代模型核心卖点的公司来说，这道题答不好，直接决定了模型敢不敢按原计划发布。

### 2. TPU 算力被合同锁定给最大的竞争对手之一

比技术差距更具讽刺意味的是算力分配问题。今年早些时候，谷歌与 Anthropic 达成了一份规模空前的算力合作：谷歌计划从 2027 年起分阶段向 Anthropic 交付规模达 5GW 级别的 TPU 集群，谷歌对 Anthropic 的投资最高达 400 亿美元，而 Anthropic 对谷歌云的采购承诺则高达 2000 亿美元。摩根士丹利的预测显示，到 2027 年 TPU 对外销售有望拿下全球 AI 加速芯片市场约 20% 的份额——这意味着相当一部分本可以留给谷歌自家前沿模型团队的 TPU 产能，正被合同条款导向了 Claude 背后的 Anthropic。对 DeepMind 的模型团队而言，这是一种结构性的资源错位：一边是自家旗舰模型迟迟拿不出手，一边是为竞争对手训练模型提供算力保障。

### 3. 一个夏天流失掉的，是过去十年攒下的核心班底

人才流失是三条主线里最引人注目的一条。8 月初，DeepMind CEO Demis Hassabis 宣布卸任 CEO，转任董事长并兼任 Alphabet 首席科学家，日常运营交由高级副总裁 Koray Kavukcuoglu 接手，直接向 Sundar Pichai 汇报——这是 DeepMind 历史上第一次设立独立于执行层之外的董事长职位。几乎同一时间，在谷歌工作 27 年的传奇工程师 Jeff Dean 联合 Sanjay Ghemawat、Oriol Vinyals、Quoc Le 四人一起出走，创办专注于用 AI 自动化科研的 Discovery Loop。再往前追溯到 6 月，Transformer 论文《Attention Is All You Need》的作者之一、曾被谷歌以 27 亿美元代价"买回"的 Noam Shazeer，在回归不到两年后又转投 OpenAI。据报道，仅 Shazeer 和另一位研究员 John Jumper 的离职消息公布当天，就蒸发了 Alphabet 约 2250 亿美元市值——市场用真金白银给这场人才危机打了分。

### 4. 联合创始人时隔多年重新坐进"驾驶舱"

面对这一连串压力，Sergey Brin 的角色变化是整条叙事里最戏剧性的一笔。这位自 2019 年后基本淡出日常管理的谷歌联合创始人，在 2023 年 ChatGPT 引发行业地震后就已经开始"几乎每天"亲自修改代码，而进入 2026 年 4 月，他更进一步，亲自牵头组建了一支突击小组，专门冲刺 Gemini 的编码能力短板。对一家市值万亿级的公司来说，创始人重新下场改代码本身就是一个强烈的信号：常规的组织流程已经不足以在这轮竞速中追上对手，需要用非常规手段抢时间。

## 三、实践指南：在模型生态剧烈波动期，如何给应用装上"容灾开关"

Gemini 3.5 Pro 的跳票不是第一起，也不会是最后一起。对独立开发者和团队来说，与其去猜哪家实验室会不会如期发布，不如把"模型供应商可能随时掉链子"当成需要在架构层面处理的既定风险。一个简单但足够实用的做法，是在应用和具体模型之间加一层按能力分级、按可用性降级的路由层，而不是把 API 调用硬编码指向某一个特定模型。示例（Python 伪代码，思路可以直接套用到 LiteLLM、OpenRouter 等现成网关上）：

```python
# model_router.py —— 面向多供应商的容灾路由示例
from dataclasses import dataclass
from typing import Callable

@dataclass
class ModelCandidate:
    name: str
    call: Callable[[str], str]
    strength: str  # "coding" / "reasoning" / "general"

# 按任务类型 + 优先级排好候选列表，而不是写死单一模型
CODING_CANDIDATES = [
    ModelCandidate("claude-opus-5", call_claude_opus5, "coding"),
    ModelCandidate("gpt-5.6-sol", call_gpt56_sol, "coding"),
    ModelCandidate("gemini-3.6-flash", call_gemini36_flash, "coding"),
]

def dispatch(task_type: str, prompt: str, max_retries: int = 3) -> str:
    candidates = CODING_CANDIDATES if task_type == "coding" else GENERAL_CANDIDATES
    last_err = None
    for candidate in candidates[:max_retries]:
        try:
            return candidate.call(prompt)
        except (RateLimitError, ModelUnavailableError, TimeoutError) as e:
            last_err = e
            log.warning(f"{candidate.name} 不可用，降级到下一候选：{e}")
            continue
    raise RuntimeError(f"全部候选模型均不可用: {last_err}")
```

几个可以直接落地的要点：

- **按任务类型而不是按供应商组织候选列表**：编码类任务优先走当前编程基准领先的模型，摘要、翻译等通用任务可以路由到成本更低的模型，这样即使某一家实验室的旗舰模型延期或降级，业务逻辑不需要跟着重写。
- **把"模型不可用"当作一等公民的异常类型来处理**：限流、超时、模型下线都应该有明确的降级路径，而不是让整个功能因为单一 API 报错而中断。
- **定期用真实基准复核候选顺序**：Terminal-Bench、SWE-bench 这类榜单几乎每个月都有变化，路由层的优先级列表应该是配置项而不是写死在代码里的常量，方便随着行业格局调整。
- **不要把关键业务逻辑和某个供应商的专有能力强耦合**：这次谷歌自身都需要靠创始人下场救场，足以说明即便是最头部的实验室，模型路线图也可能被内部因素打乱。

## 四、总结与展望

把这几条线索放在一起看，谷歌眼下面对的不是某一个孤立的产品失误，而是编程能力没追上、算力被合同分走一部分给了竞争对手、核心班底在同一个夏天大规模出走这三重压力同时叠加的结果。作为回应，谷歌选择的路径不是硬撑着把 Gemini 3.5 Pro 仓促推向市场，而是让它事实上"沉没"，转而把工程资源集中投向下一代的 Gemini 4——据 Sundar Pichai 的说法，这将是谷歌"迄今为止最宏大的一次预训练"，编码能力和自主 Agent 被明确列为优先目标，目前该模型已进入预训练阶段，但尚无公开的基准数据、定价或发布时间。

对开发者而言，这场危机最值得记住的不是"谁又输给了谁"，而是它再次证明了当前大模型行业的格局仍然极不稳定：市值万亿的公司也可能在几个月内经历 CEO 换岗、核心团队集体出走、旗舰产品悄悄下架。在这样的环境下，把生产系统的技术选型和某一家实验室的路线图深度绑定，本身就是一种需要主动管理的风险。无论最终等到的是 Gemini 4 的惊艳发布，还是谷歌继续在编程能力上落后一个身位，提前搭好多供应商容灾路由，都是眼下性价比最高的应对方式。

## 参考来源

- [谷歌创始人布林紧急接管 Gemini 团队，但"3.5 Pro 已被取消"（腾讯新闻）](https://news.qq.com/rain/a/20260811A09Q1K00)
- [Gemini 3.5 Pro Shelved - Cancelled according to SemiAnalysis（X / Pankaj Kumar）](https://x.com/pankajkumar_dev/status/2086803310238167242)
- [Google Shelves Gemini 3.5 Pro After Delays, Pivoting to Gemini 4（NPowerUser）](https://nokiapoweruser.com/google-shelves-gemini-3-5-pro-pivot-gemini-4/)
- [Demis Hassabis steps down as Google DeepMind CEO（TechBriefly）](https://techbriefly.com/2026/08/06/demis-hassabis-steps-down-google-deepmind-ceo/)
- [Behind the exit of DeepMind's CEO: low morale, a talent exodus, and model delays（Fortune）](https://fortune.com/2026/08/10/how-stalled-models-missed-deadlines-and-staff-burnout-lead-to-the-unraveling-of-googles-deepmind/)
- [Jeff Dean and Sanjay Ghemawat Depart Google to Co-Found Discovery Loop（Tech Times）](https://www.techtimes.com/articles/323197/20260805/jeff-dean-sanjay-ghemawat-depart-google-co-found-discovery-loop.htm)
- [Google Gemini co-lead Noam Shazeer leaves for OpenAI（CNBC）](https://www.cnbc.com/2026/06/18/google-gemini-co-lead-noam-shazeer-leaves-for-openai.html)
- [Google is expanding its AI empire — and losing the people who built it（CNBC）](https://www.cnbc.com/amp/2026/08/05/google-is-expanding-its-ai-empire-and-losing-the-people-who-built-it.html)
- [租下 22 万颗英伟达 GPU 的同一天，Anthropic 向谷歌 TPU 承诺了 2000 亿美元（钛媒体）](https://www.tmtpost.com/7978008.html)
- [What Google has teased about Gemini 4（9to5Google）](https://9to5google.com/2026/07/26/google-gemini-4-teases/)
- [Best AI Coding Agents (August 2026): Scored Leaderboard（MorphLLM）](https://www.morphllm.com/best-ai-coding-agents-2026)
