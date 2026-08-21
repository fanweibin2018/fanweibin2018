---
title: 'Stripe 70 亿美元收购 OpenRouter：当支付基础设施盯上 AI 模型路由'
date: 2026-08-21
slug: 'stripe-shougou-openrouter-ai-moxing-luyou'
author: 范伟彬
description: '2026 年 8 月 19 日，Stripe 正式宣布收购 AI 模型路由平台 OpenRouter，交易金额超过 70 亿美元，较其三个月前 13 亿美元的融资估值溢价 5.4 倍。OpenRouter 用一个统一 API 网关连接 400 多个模型、80 多家供应商，服务了 800 万开发者。这笔收购意味着什么：为什么"模型路由"突然成了支付巨头愿意砸重金的赛道？本文梳理收购始末，拆解 OpenRouter 的路由与计费机制，并给出接入其 API 的实战示例，聊聊多模型时代开发者该如何看待这类"中立层"基础设施的价值与风险。'
categories:
  - AI
  - 开发者工具
tags:
  - OpenRouter
  - Stripe
  - AI 网关
  - 模型路由
  - API
  - 开发者工具
  - 并购
---

# Stripe 70 亿美元收购 OpenRouter：当支付基础设施盯上 AI 模型路由

## 一、发生了什么

2026 年 8 月 19 日，支付巨头 Stripe 正式宣布将收购 AI 模型路由平台 OpenRouter，交易金额超过 70 亿美元（Axios 此前报道的版本是"超过 80 亿美元的现金加股票"，双方均未公布确切数字）。这个价格本身就是一个信号：OpenRouter 在今年 5 月完成 B 轮融资时的估值只有 13 亿美元，三个月后被以 5.4 倍溢价收购，而且这个数字还是从今年 7 月一度传出的 100 亿美元报价"砍"下来的——原因是同期至少有六家竞争对手在这几个月里也上线了类似的模型路由产品，市场竞争让估值迅速回落。

OpenRouter 是做什么的？简单说，它是一个 AI 模型的"统一入口"：开发者只需要接入 OpenRouter 一个 API，就能调用来自 80 多家供应商的 400 多个模型——OpenAI、Anthropic、Google、Meta、DeepSeek、阿里通义千问等等都在其中，不用为每一家单独签合同、单独维护一套 SDK、单独处理计费对账。官方口径是它已经服务了全球 800 万开发者，NVIDIA、Zoom、Lovable 都是其客户。

Stripe CEO Patrick Collison 在官方公告里的表态很直白："Token 正在成为企业用 AI 构建产品的核心货币……我们和 OpenRouter 一起，将帮助企业通过智能路由请求来最大化盈利能力。"OpenRouter 联合创始人兼 CEO Alex Atallah 则从技术趋势的角度回应："智能会是多模型的（multi-model）——没有哪一个模型能在所有任务上都是最优解，开发者需要一个中立的层来编排和管理它们。"

这句话点出了这次收购背后真正的行业逻辑，也是这篇文章想重点聊的东西。

## 二、为什么"模型路由"值 70 亿美元

过去两年，大模型领域发生了一个微妙但重要的结构性变化：**没有一个模型能永远保持断层领先**。Claude、GPT、Gemini、DeepSeek、Qwen、Kimi、GLM 轮番刷新各类榜单，价格战和性能竞赛同时进行，仅今年 8 月国内外就密集发布了 Gemini 3.7 Flash、DeepSeek-V4-Pro-0813、GLM-5.3 等十余个新模型或新版本。对于一个真正在生产环境跑 AI 应用的团队来说，这意味着：

- **今天最划算的模型，三个月后大概率不是最划算的那个**。价格、延迟、上下文窗口、特定任务的能力排名一直在变。
- **单一供应商锁定的风险在放大**。某个 API 挂了、限流了、涨价了，业务不能跟着停摆。
- **不同任务适合不同模型**：代码调试、长文摘要、多模态理解、Agent 工具调用，往往不是同一个模型的强项。

于是"模型路由层"（AI Gateway / Model Router）这个中间件品类应运而生——它做的事情本质上类似于 CDN 之于网站、负载均衡器之于后端服务：把"选哪个具体模型"这件事从业务代码里抽象出来，变成一个可以动态调整、按策略降级、统一计费的基础设施层。OpenRouter 正是这个赛道里跑得最快的一个。

而 Stripe 看中的，是这个中间层天然长在"钱"的必经之路上。Token 消耗本身就是一种计量与计费问题——你调用了多少 token、该向最终用户收多少钱、不同模型的成本如何分摊，这套账目和信用卡支付、SaaS 订阅计费在会计逻辑上高度相似。Stripe 过去十几年建立的核心能力就是"帮别人算清楚钱该怎么流动"，收购 OpenRouter 相当于把这套能力从"美元/欧元的流动"延伸到了"token 的流动"，卡住企业在 AI 时代花钱和赚钱的两端。用 Stripe 公告里的话说：帮企业"同时管理盈利能力的两端——最大化收入效能、最小化成本"。

## 三、OpenRouter 到底怎么用：技术拆解

抛开收购新闻本身，OpenRouter 的产品设计对任何要接入多模型的开发者都值得了解一下，因为它已经事实上成为了一种行业范式。

### 3.1 统一 API：兼容 OpenAI 格式，一行 base_url 切换

OpenRouter 最大的易用性优势是**完全兼容 OpenAI 的 Chat Completions 接口格式**，这意味着如果你的项目已经在用 OpenAI 的 SDK，接入 OpenRouter 几乎是"改一行配置"的成本：

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-你的密钥",
)

response = client.chat.completions.create(
    model="anthropic/claude-sonnet-5",  # 也可以换成 openai/gpt-5.6、google/gemini-3.7-flash 等
    messages=[
        {"role": "user", "content": "用一句话解释什么是模型路由"}
    ],
)
print(response.choices[0].message.content)
```

TypeScript / JavaScript 同理，官方也提供了 Agent SDK，封装了多轮对话和工具调用的上层逻辑，适合直接拿来搭 Agent。

### 3.2 Auto Router：让平台替你选模型

如果不想自己在业务代码里写死具体模型，可以把 `model` 参数设为 `openrouter/auto`，交给平台的 **Auto Router** 自动选择：

```python
response = client.chat.completions.create(
    model="openrouter/auto",
    messages=[{"role": "user", "content": "帮我 review 这段 Python 代码的性能瓶颈"}],
)
```

Auto Router 的工作机制挺有意思，大致分三步：

1. **任务分类**：先把请求自动归类到约 30 种任务类型里（比如 `code:debugging`、`qa_knowledge` 等）；
2. **按真实市场花费排序**：不是用官方跑分榜单排序，而是统计过去 7 天内 OpenRouter 社区在该任务类型上"真金白银花在哪个模型上"，用真实付费行为而不是 benchmark 分数做排名；
3. **带降级的路由**：选出排名靠前的候选模型作为主选项，并保留次优模型作为自动失败转移（fallback）备份；如果分类或排名服务本身不可用，会优雅降级到一组默认模型，保证服务不中断。

对多轮对话，Auto Router 还有"会话粘性"：记住上一轮落在了哪个模型上，后续轮次优先沿用，除非任务类型发生了明显变化——避免同一个对话里模型来回跳导致的语气/风格不一致。

如果不想完全交给平台决定，还可以通过 `allowed_models`（白名单）、`excluded_models`（黑名单）、`cost_tier`（成本档位）等参数收窄路由范围，在"完全自动"和"完全手动"之间找平衡点。

### 3.3 计费模式：不在 token 单价上加价，而是对"钱怎么进来"收费

这一点值得单独说一下，因为它其实也解释了 Stripe 为什么会看上它。OpenRouter 对每个模型的 token 单价**按供应商原价透传，不加价**——通过 OpenRouter 调用某个模型的成本和你直接找该厂商 API 是一样的。它真正的收入来源是"资金进出"环节的手续费：

- **用信用卡购买 Credits**：收取 5.5% 的手续费，单笔最低 0.8 美元（这意味着小额充值的实际费率会更高，比如充值 5 美元，0.8 美元的最低费用相当于 16% 的实际费率）；
- **BYOK（Bring Your Own Key，即用自己在各厂商那里申请的密钥、只通过 OpenRouter 做统一编排）**：每月前 100 万次请求免费，超出部分收取 5% 的使用费；企业版把免费额度提高到每月 500 万次。

换句话说，OpenRouter 的商业模式本质上是在"token 这种新型货币"的流动路径上收过路费——这和 Stripe 在传统支付链路上收取交易手续费，是同一种生意逻辑，只是标的物从"美元"换成了"token"。这也是为什么这次收购被很多分析文章形容为"支付基础设施在往上游延伸，把 AI 模型路由变成了一个支付基础设施问题"。

## 四、对开发者意味着什么：便利与风险的两面

站在使用者角度，这次收购短期内不会改变 OpenRouter 现有产品的接口和用法，但值得留意几个趋势性的问题：

**利好的一面：**
- 如果 Stripe 把 OpenRouter 的计费能力和自己成熟的账单、税务、订阅管理系统打通，企业级用户未来有可能在同一张账单里同时看到"支付收入"和"AI 成本支出"，对做 To B SaaS、尤其是那些把 AI 功能包装成按量计费产品的团队会是实打实的效率提升。
- Stripe 的基础设施和合规能力（尤其是在企业采购、跨境结算、反欺诈方面）过去是 OpenRouter 作为创业公司难以独立建设的短板，被收购后大概率会补齐。

**需要警惕的一面：**
- **中立性问题**。OpenRouter 的价值主张之一就是"中立的多模型编排层"——不依附于任何一家模型厂商。被支付巨头收购后，它是否会在路由策略、定价、数据处理上继续保持中立，还是逐渐向 Stripe 自身的生态（比如优先绑定使用 Stripe 支付的客户）倾斜，目前还是未知数。
- **依赖集中度风险**。据统计已有 800 万开发者、大量像 NVIDIA、Zoom 这样的企业客户在用它做多模型编排，一旦大量 AI 流量都要经过这一个网关，它本身的可用性、故障恢复能力、供应商中立承诺，就从"锦上添花的便利工具"变成了"关键路径上的单点依赖"。如果你的生产系统重度依赖某个类似网关，做好多网关或者直连关键供应商的降级预案，仍然是审慎的工程实践。

## 五、总结与展望

这次收购与其说是一次孤立的商业新闻，不如说是"多模型时代"这个大趋势下的一个必然产物的缩影：当没有任何一个 LLM 能永远保持性能与价格上的绝对优势时，"选择用哪个模型"本身就变成了一个需要持续优化的工程与商业问题，而不再是一次性的技术选型。OpenRouter、以及它背后代表的这整个"AI 网关"品类（包括 Cloudflare AI Gateway、Portkey、LiteLLM 等同类产品），正在把这个问题标准化、基础设施化。

对开发者而言，比记住这一条并购新闻更重要的，是它背后指向的一个实践建议：**如果你的产品还在把某个具体模型的调用硬编码进业务逻辑，现在是一个不错的时机去评估一层路由抽象**——不一定非要用 OpenRouter，但"让模型可插拔、让 fallback 和成本策略可配置"这件事本身，在模型迭代速度只会越来越快的接下来几年里，大概率会从"加分项"变成"基本功"。而当支付公司都开始把 token 计费当成自己的下一块阵地时，这个信号已经足够清楚：AI 基础设施的下半场，拼的不只是模型能力本身，还有谁能把"多模型、多供应商"这件事的复杂度，封装得足够干净。

## 参考来源

- [Stripe Agrees to Acquire OpenRouter — Stripe Newsroom](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter)
- [Stripe Acquires OpenRouter for $7B+, Turning Model Routing Into a Payments Infrastructure Problem — Yahoo Finance](https://finance.yahoo.com/technology/ai/articles/stripe-acquires-openrouter-7b-turning-091812340.html)
- [Stripe will reportedly acquire AI gateway startup OpenRouter for $7B+ — TechCrunch](https://techcrunch.com/2026/08/16/stripe-will-reportedly-acquire-ai-gateway-startup-openrouter-for-7b/)
- [Stripe Finalizes Deal to Acquire AI Startup OpenRouter for Over $7 Billion — Bloomberg](https://www.bloomberg.com/news/articles/2026-08-16/stripe-nears-deal-to-buy-ai-firm-openrouter-for-over-7-billion)
- [Stripe Bets Over $8 Billion On OpenRouter's AI Model Traffic — Forbes](https://www.forbes.com/sites/janakirammsv/2026/08/19/stripe-bets-over-8-billion-on-openrouters-ai-model-traffic/)
- [Stripe Reportedly Acquires OpenRouter for Over $7 Billion. What Changes for Developers — Memeburn](https://memeburn.com/stripe-reportedly-acquires-openrouter-for-over-7-billion-what-changes-for-developers/)
- [OpenRouter Quickstart 文档](https://openrouter.ai/docs/quickstart)
- [OpenRouter Model Routing 文档](https://openrouter.ai/docs/features/model-routing)
- [OpenRouter Pricing (2026): When the 5.5% Fee Pays Back](https://omidsaffari.com/blog/openrouter-pricing)
