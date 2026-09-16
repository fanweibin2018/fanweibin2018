---
title: 'Pion 上线：当 AI Agent 真的拿到银行账户、电话和一家公司的经营权'
date: 2026-09-16
slug: 'andon-labs-pion-ai-agent-yunying-zhenshi-gongsi'
author: 范伟彬
categories:
  - AI
  - Agent
tags:
  - Andon Labs
  - Pion
  - AI Agent
  - Vending-Bench
  - Claude
  - AI 安全
  - 自主性评估
description: '2026 年 9 月 14 日，AI 安全公司 Andon Labs 上线云平台 Pion，允许长时任务 Agent 通过安全终端、邮件、电话、银行账户和浏览器等真实工具，完全自主运营一家公司。本文基于 Andon Labs 官方博客、产品页面及 IEEE Spectrum 对其此前"AI 便利店/咖啡馆"实验的深度报道，拆解 Pion 的双层 Agent 架构、Vending-Bench 系列评估体系背后的方法论，以及"把真实商业风险交给模型"这件事目前真正踩到的坑，并给出普通开发者可以借鉴的自主性分级测试思路。'
---

# Pion 上线：当 AI Agent 真的拿到银行账户、电话和一家公司的经营权

如果说过去一年 AI Agent 的故事大多发生在代码仓库、浏览器标签页和沙箱环境里，那么 2026 年 9 月 14 日上线的 Pion，把这件事往前又推了一大步：这一次，Agent 拿到的不是一个只读的测试账号，而是真实的银行账户、真实的电话号码、真实的供应商邮箱，以及一家真实公司的经营权。做这件事的公司叫 Andon Labs，一家专注"用真实世界任务测量 AI 自主性"的 AI 安全创业公司。这不是一次孤立的产品发布，而是他们从 2024 年底一路测下来的自主性评估工作，第一次被打包成一个任何人都可以申请体验的云平台。对于每天在琢磨"要不要让自己的 Agent 再多拿一点权限"的开发者来说，Andon Labs 这两年踩过的坑，可能比再看一遍 benchmark 跑分更有参考价值。

## 一、背景介绍：从一台自动贩卖机开始的自主性研究

Andon Labs 的核心问题从一开始就很朴素："AI 系统什么时候能够自主地在现实世界里获取资源？"要回答这个问题，靠传统的静态评测集是不够的——真实世界的意外情况太多，没法提前穷举。于是他们从 2024 年底开始构建了一个叫 Vending-Bench 的评估工具：让模型自主经营一台真实的自动贩卖机，处理进货、定价、和供应商沟通、应对突发情况。

早期的结果相当"下饭"：在模拟环境里，Claude Sonnet 3.5（2024 年那一代模型）曾经离谱地向 FBI"报案"，声称自己发现了"网络财务犯罪"——只是因为它把一次正常的账目波动理解成了犯罪线索。这类啼笑皆非的失败模式，恰恰是 Andon Labs 认为最有价值的产出：它们暴露的是模型在长时任务里的真实脆弱性，而不是精心设计的 benchmark 里可以被针对性优化掉的弱点。

转折点出现在 2025 年 5 月，Claude Opus 4 在 Vending-Bench 上首次超越了人类基准线。此后模型能力的提升被他们量化成了一个具体的数字：**平均每一代新模型，能让这台虚拟贩卖机的月度盈利能力提升约 822 美元**。这个数字后来在 Vending-Bench 2（升级版评估体系）里被反复引用，成了 Andon Labs 衡量"模型进步在商业自主性上到底值多少钱"的一把标尺。

2025 年初，他们把这套评估从模拟搬进了现实：在 Anthropic 办公室里部署了一台真实的自动贩卖机。起初 AI 表现同样不理想，但随着模型迭代，这台贩卖机最终真的开始盈利。尝到甜头之后，2026 年 4 月，Andon Labs 把赌注加大了两个数量级——他们把两家真实的实体商业，交给了两个不同的 Agent 全权打理。

## 二、Andon Market 与 Andon Café：两场仍未盈利的真实实验

**Andon Market**，一家位于旧金山的实体零售店，由 AI"店长"Luna 负责订单管理、库存决策和供应商沟通，人类员工 Felix Carson 负责实际执行。SFGate 记者实地探访时记录下了几个很有代表性的细节：

- Luna 反复把地板上嵌入式的电源盖板误认成"散落的杯垫"，多次要求员工把它们"收拾干净"；
- 记者试图打电话向 Luna 订购一瓶 Olipop 汽水，Luna 把"Olipop"听成了"lollipop"（棒棒糖），沟通卡在这个误解上迟迟推进不下去；
- 店铺初始运营资金 10 万美元，探访时已经消耗到只剩 6 万美元，核心问题是**模型调用的 token 成本，比商店实际销售额烧得还快**；
- 货架上堆着木制四子棋、二手书、中国跳棋、皂液分配器——用记者的话说，"基本上是圣诞节白象交换礼物的大杂烩"，探访当天晴朗的工作日下午，店里没有其他顾客。

员工 Felix 的评价很直接："几乎是我在运营这家店，然后有一个 AI 在旁边检查清单"，但他也承认 Luna "算是个还不错的经理"。

**Andon Café**，一家位于斯德哥尔摩的咖啡馆，由 AI"店长"Mona 负责预算、采购和菜单设计。这里的失败模式换了一种形式：项目初期用 Google Gemini 模型驱动时，Mona 采购决策失误导致大量食材浪费；切换到 OpenAI 的 GPT 模型之后，问题走向了另一个极端——**过度矫正**，Mona 一度把整个菜单砍到只剩"芝士吐司"一个选项。

普林斯顿大学研究员 Sayash Kapoor 在评价这类实验时指出，它们最大的价值不在于证明 Agent 有多强，而在于"更全面地理解这些 Agent 目前仍然会撞到的边界在哪里"——他特别强调，模型的**可靠性改善速度，明显慢于能力指标的提升速度**。这也解释了为什么 Andon Market 和 Andon Café 到今天（2026 年 9 月）都仍未实现盈利：能把"人类基准线"跑赢的是单点能力测试，而一家真实商业需要的是数百个环节都不掉链子的持续可靠性，这恰恰是当前模型最薄弱的地方。

## 三、Pion 的技术架构：一个监督 Agent + 一群业务 Agent

有了两年的真实数据积累，Andon Labs 在 9 月 14 日把这套能力开放成了产品——Pion，一个允许持久运行（long-running）的 Agent 完全自主运营真实企业的云平台。目前以"研究预览"形式发布，通过 waitlist 邀请制逐步开放，申请表单需要填写业务类型（新创业还是已有生意）、一到两句话的业务描述、预期年收入区间，以及可选的 X 账号。

从公开的产品描述看，Pion 采用了一个**两层 Agent 架构**：

- **上层：Andonos**，扮演"监管 Agent"的角色，负责整体协调和监督下层业务 Agent 的运营；
- **下层：业务 Agent**，具体执行库存管理、定价决策、客户沟通等日常经营任务。

支撑这套架构运转的是一组内建的真实世界工具：**安全终端（sandboxed terminal）、邮件、电话、银行账户接入、浏览器**。这个工具清单本身就很说明问题——它不是给 Agent 一个"模拟银行 API"去过家家，而是直接对接真实的资金账户和真实的通信渠道。目前底层模型主要基于 Anthropic 的 Claude，产品页面上写明"最适合软件类业务"，但零售、餐饮等其他行业也在测试范围内，并且特别欢迎已有真实业务的创始人接入试用，而不只是从零开始的模拟场景。

Andon Labs 在发布信息里保持了少见的坦诚：他们明确说明 Andon Market 和 Andon Café 这两个"活广告"项目**至今尚未盈利**，Pion 目前仍处于试验阶段，而不是一个"接入即赚钱"的成熟商业方案。这种坦诚本身，配合此前贩卖机实验里那些近乎荒诞的失败案例，构成了 Andon Labs 独特的产品叙事：与其说是在卖一个自动化工具，不如说是在公开地做一场"给 AI 自主性设置越来越高的赌注"的长期实验，并把过程和结果都摆在台面上。

## 四、实践指南：给普通开发者的自主性分级测试思路

大多数团队显然不会真的把公司银行账户交给一个 Agent，但 Andon Labs 这套"用真实世界任务、循序渐进地测试自主性边界"的方法论，对任何在构建 Agent 系统的团队都有直接的借鉴意义。核心思路可以总结为三点：

1. **用真实场景而不是静态 benchmark 来发现失败模式**。Luna 把电源盖板认成杯垫、把 Olipop 听成 lollipop，这类问题几乎不可能出现在传统的选择题式评测集里，只有在真实、开放、充满噪音的环境中长时间运行才会暴露出来。
2. **给 Agent 的自主权限应该分级放开，并且每一级都要有真实资金/资源的敞口测试**，而不是一次性给满权限再事后复盘。Andon Labs 从模拟贩卖机，到真实贩卖机，再到实体商店和咖啡馆，走的正是这样一条"敞口逐步放大"的路径。
3. **把监督角色本身也做成 Agent 架构的一部分**，而不是完全依赖人工事后审查。Pion 里 Andonos 监督业务 Agent 的两层设计，本质上是把"人在回路"这件事，往"AI 在回路"的方向做了一次工程化的尝试——当然，这也意味着监督 Agent 本身的可靠性，会成为新的风险敞口，需要单独评估。

下面是一个简化的示例，示范如何把"用真实资金敞口测试自主性"这个思路，落到一个具体的分级测试框架里：

```python
# 简化示例：借鉴 Andon Labs 的思路，
# 为 Agent 的自主经营权限设计一套"资金敞口分级"测试框架

from dataclasses import dataclass


@dataclass
class AutonomyStage:
    name: str
    max_real_dollars_at_risk: float   # 该阶段允许暴露的真实资金上限
    requires_human_shadow: bool       # 是否需要人工"影子监督"同步跟进
    min_reliable_runs: int            # 进入下一阶段前，需要达到的连续无重大失误运行次数


STAGES = [
    AutonomyStage("模拟环境（无真实资金）", 0, False, 20),
    AutonomyStage("真实小额资金（如单台设备）", 500, True, 10),
    AutonomyStage("真实中等资金（单一门店/账户）", 50_000, True, 5),
    AutonomyStage("真实规模化资金（多门店/多账户）", 500_000, False, 3),
]


def can_advance(stage_index: int, consecutive_clean_runs: int) -> bool:
    """判断是否可以从当前阶段晋级到下一阶段"""
    stage = STAGES[stage_index]
    if consecutive_clean_runs < stage.min_reliable_runs:
        print(f"[拒绝] 当前处于「{stage.name}」，还需 "
              f"{stage.min_reliable_runs - consecutive_clean_runs} 次无重大失误运行")
        return False
    print(f"[通过] 「{stage.name}」阶段考核完成，可进入下一资金敞口等级")
    return True


# 示例：某 Agent 在"真实小额资金"阶段已连续 7 次无重大失误运行
can_advance(stage_index=1, consecutive_clean_runs=7)
```

这段代码的重点同样不在实现细节，而在于它体现的原则：**任何一次真实资金敞口的扩大，都应该以一段时间内可验证的可靠运行记录作为门槛**，而不是靠一次亮眼的 benchmark 分数就直接放行。Sayash Kapoor 的判断放在这里同样成立——可靠性的提升速度落后于能力指标，意味着"晋级门槛"必须单独针对可靠性设计，不能简单套用能力评测的分数。

## 五、总结与展望

Pion 的上线，把"AI Agent 能不能自主经营一家公司"这个问题，从一个学术实验，往前推进成了一个任何团队都可以申请体验的产品。但 Andon Labs 自己给出的答案其实相当克制：两年积累下来的经验是，模型能力确实在稳步提升——Vending-Bench 上每代模型带来约 822 美元的月度盈利能力增量就是证据——但可靠性的追赶速度远远慢于能力增长，真实世界里那些电源盖板、Olipop、菜单过度矫正之类的"意外",目前依然防不胜防。

对于普通开发者而言，Pion 和 Andon Labs 这两年的实验给出的最直接的启示，或许不是"要不要现在就把银行账户交给 Agent"，而是**如何为自己的 Agent 系统设计一套渐进式、可验证的自主性晋级机制**——用真实但可控的小额敞口去发现问题，用连续无失误的运行记录作为晋级门槛，而不是在一次漂亮的 demo 之后就直接放开全部权限。毕竟正如 Andon Market 里那位人类员工所说的，眼下更贴近现实的图景，可能还是"人在旁边真正运营，AI 在一旁检查清单"，而不是相反。

## 参考来源

- [Andon Labs: Why we built Pion](https://andonlabs.com/blog/why-we-built-pion)
- [Andon Labs: Pion 产品页](https://andonlabs.com/pion)
- [IEEE Spectrum: Inside Andon Lab's Store, Agentic AI Meets Its Limits](https://spectrum.ieee.org/andon-labs-agentic-ai-businesses)
- [AI/TLDR: Pion — Andon Labs opens a cloud platform](https://ai-tldr.dev/releases/andonlabs-pion/)
- [Slashdot/SFGate 转载：A Visit to San Francisco's AI-run Store](https://news.symplexia.com/2026/09/technology-innovation/technology/a-visit-to-san-franciscos-ai-run-store-no-customers-nothing-useful-and-losing-money-fast-slashdot/)
- [daily.dev：Inside Andon Lab's Store, Agentic AI Meets Its Limits](https://daily.dev/posts/inside-andon-lab-s-store-agentic-ai-meets-its-limits-giogyjsgr)
