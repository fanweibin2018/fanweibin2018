---
title: 'Fable 5.2 不该跑完全程：用 Advisor 把强模型留给关键决策'
date: 2026-11-10
slug: 'claude-fable-5-2-advisor-model-routing'
author: 范伟彬
description: 'Claude Fable 5.2 的实用变化不只是能力提升，而是被放到 Advisor 和 Orchestrator 的决策层。本文解释模型路由、成本、安全回退与使用边界。'
source: 'https://www.anthropic.com/claude-fable-and-mythos-5-2'
categories:
  - AI
  - 技术
tags:
  - Claude Fable 5.2
  - Claude Mythos 5.2
  - Anthropic
  - AI Agent
  - 模型安全
---

# Fable 5.2 不该跑完全程：用 Advisor 把强模型留给关键决策

Anthropic 在 11 月 9 日发布 Claude Fable 5.2 和 Claude Mythos 5.2。官方没有建议开发者把日常工作全部切到这组新模型，反而把 Opus 5.5 定位为多数编程和知识任务的起点，再让 Fable 在难度真正上升时充当主模型、Advisor 或 Orchestrator。

这才是 5.2 对普通开发团队最可行动的变化：最强模型不必包办每一步，可以只在定方案、处理顽固错误和交付前审查时介入。站内 9 月已经介绍过 5.1 版本“同一底层模型、两套安全入口”的结构；5.2 沿用了这套结构，新增的信息是能力、价格和产品角色都更明确地指向了**分层路由**。

## 路由模型前，先看清两套门禁

Fable 与 Mythos 仍然是同一个底层模型的两种部署配置。可以把它们想成同一座实验室的两个入口：里面的仪器相同，但公开入口会检查来访目的，并锁住一部分高风险房间；专业入口可以进入更多区域，不过先要核验身份和用途。

这也解释了为什么不能把 Fable 简单理解成“缩水版”。根据 Anthropic 的系统卡，Fable 的限制至少分为三层：

1. 生物与化学风险请求会经过分类器；
2. 网络攻击相关的特定有害活动会被拦截；
3. 少量可能直接加速前沿大模型研发的能力也受限制，例如某些机器学习加速器的内核开发。

第三层容易被误读。系统卡同时说明，这组限制不应影响绝大多数传统 AI/ML 研究、普通编程和一般软件开发。也就是说，它针对的是一小段被 Anthropic 判断为可能显著加速前沿模型研发的任务，而不是笼统封锁“写 CUDA”或“做机器学习”。

被拦截也不一定只是返回拒绝。在 Anthropic 自有产品中，部分请求会透明地回退到较早的 Claude Opus 模型；API 开发者需要主动选择是否使用这种回退，不同云平台的行为还可能不同。这一点会直接影响工程判断：如果应用依赖确定的模型版本，就不能只记录最终回答，还应记录实际执行模型、回退状态和安全策略结果。

## 为什么日常任务不该全部切到 Fable

Anthropic 给 Fable 5.2 和 Mythos 5.2 的定价都是每百万输入 token 8 美元、输出 token 40 美元；可选的 Fast mode 最多把生成速度提高到 2.5 倍，价格则变成每百万输入 token 16 美元、输出 token 80 美元。官方还称，新版本在预发布测试中输出速度最多比 5.1 快 30%。这些速度与效果数字来自厂商和合作测试，不等同于在自己的代码库、工具链和并发条件下已经复现。

更关键的是，Anthropic 自己也没有建议把所有工作都切到 Fable。官方把 Opus 5.5 称为多数编程和知识任务的日常起点，把 Fable/Mythos 留给最困难、最开放、需要长程判断的技术问题。

这是合理的。写一个明确的转换函数、补一段测试或整理已有资料，瓶颈通常不在模型能否提出前沿研究级方案。真正适合升级到 Fable 的任务更像这些：

- 需求仍然模糊，需要先判断问题应该怎样拆；
- 多个技术约束互相牵制，局部修复容易制造新问题；
- 要长时间调用工具、反复实验，并在失败后重定路线；
- 最终方案需要跨代码、硬件、论文或大量异构资料做综合判断。

因此，实用的模型路由不是“永远用最强”，而是把 Fable 放在**高杠杆的决策点**。

## Advisor：让强模型审关键节点，而不是包办每一步

Claude Code 新增的 Advisor 正好体现了这种分层。主模型继续处理大部分执行工作，在确定方案、连续报错或准备宣布完成时，再把完整对话和工具结果交给更强的顾问模型审查。

官方文档给出的 Fable Advisor 配置是：

```text
/advisor fable
```

也可以只在一次会话启动时指定：

```bash
claude --advisor fable
```

这不是一个免费的“第二意见”。Fable 5.2 作为 Advisor 需要 Claude Code 2.1.321 或更高版本及相应访问权限；Advisor 目前是实验功能，只支持 Anthropic API，不支持 AWS、Google Cloud 或 Microsoft Foundry 上的对应托管入口。每次咨询都会重新读取完整会话，顾问侧不会复用前一次咨询的输入缓存，因此长会话里反复调用可能迅速增加 token 消耗。

可以把它理解为代码评审：不必让资深架构师亲手输入每一行，但在设计定稿、疑难错误和交付前检查时，让他看到完整上下文。短任务没有多少决策空间，启用 Advisor 反而只是增加延迟和成本；如果任务的每一步都需要 Fable 的能力，直接把主模型切过去更简单。

## 先用一个小脚本估算“升级成本”

下面的 Python 脚本按官方标价计算一次调用的理论成本。它只使用标准库，可以直接运行：

```python
from decimal import Decimal

PRICES = {
    "standard": (Decimal("8"), Decimal("40")),
    "fast": (Decimal("16"), Decimal("80")),
}


def estimate(mode: str, input_tokens: int, output_tokens: int) -> Decimal:
    input_price, output_price = PRICES[mode]
    return (
        Decimal(input_tokens) * input_price
        + Decimal(output_tokens) * output_price
    ) / Decimal("1000000")


if __name__ == "__main__":
    for mode in PRICES:
        amount = estimate(mode, input_tokens=100_000, output_tokens=10_000)
        print(f"{mode}: ${amount:.2f}")
```

本文实际运行得到：

```text
standard: $1.20
fast: $2.40
```

这个结果不能直接当成 Claude Code 会话账单。提示缓存、工具返回、重试、主模型调用和 Advisor 每次重新读取完整会话都会改变实际费用。它的用途是先建立数量级：Fast mode 是用近似翻倍的单价换取更快生成；长上下文的顾问调用也不是“只付那几句建议”的价格。

## 三个电子原型说明了什么，又没有说明什么

Anthropic 与电路板公司 Diode 的实验能更具体地说明 Fable 适合哪类任务。团队只给出简短需求，Fable 5.2 为 USB 扬声电话、家庭语音助手和掌上虚拟宠物完成了规格、原理图、四层电路板布线、外壳 CAD、固件和物料清单。Diode 按设计文件制造并组装后，三个原型都能工作，没有修改电路。

这里真正有信息量的不是“三个设备”这个数字，而是模型能跨过多个工程层次：读取芯片数据手册、优先布高电流和高速信号、在布线失败时推倒重来、检查外壳干涉、处理工厂的可制造性规则。单纯生成一张看似完整的原理图并不难，保持上游选择与下游装配之间的约束一致，才是长程技术工作的难点。

但这项实验仍然是 Anthropic 与合作方组织的案例，不是独立的大规模评测。官方明确说这些是早期原型，尚不知道长期使用表现，也没有验证能否通过商业认证。PCB Gym 的 69% 和 BenchCAD 2.1 的 83.5% 同样属于特定工具与测试条件下的结果，不能推出“模型已经能独立替代硬件工程团队”。更稳妥的结论是：它开始能承担从模糊需求到可制造原型的连续工作，但人类仍负责制造、测试、认证和最终责任。

## 选择 Fable、Mythos 还是保持 Opus

可以用下面这套简单判断：

| 任务 | 更合适的起点 | 原因 |
| --- | --- | --- |
| 明确的日常编程、资料整理 | Opus 5.5 或更小模型 | 成本低，通常不需要前沿级长程判断 |
| 大型重构、开放式研究、跨工具工程 | Fable 5.2 | 需要处理模糊目标和长依赖链 |
| 日常执行中偶尔出现关键决策 | 主模型 + Fable Advisor | 把高成本能力集中在决策点 |
| 经授权的高级网络安全或生物研究 | Mythos 5.2 | 限制较少，但必须通过相应验证计划 |
| 对延迟敏感且收益足以覆盖价格 | Fable/Mythos Fast mode | 更快生成，单价约为标准模式两倍 |

迁移前还应做三项自己的验证：用真实任务而不是公开榜单测成功率；记录模型回退与安全拦截；把完整会话成本和人工复核时间一起计算。特别是涉及安全、生物或物理设备时，模型给出一条可执行路线，并不等于路线已经安全、合法或通过工程验收。

Fable 5.2 与 Mythos 5.2 最值得关注的变化，是“能力”和“访问边界”开始被明确拆开。对普通开发团队来说，真正可行动的结论也很朴素：不要因为新模型更强就全量替换，而要先找到那些**一次错误决策会让后面几十步都走偏**的节点，再决定是切换主模型、启用 Advisor，还是申请受控的专业访问。

## 原始资料

- [Anthropic：Claude Fable 5.2 与 Claude Mythos 5.2 发布说明](https://www.anthropic.com/claude-fable-and-mythos-5-2)
- [Claude Fable 5.2 & Claude Mythos 5.2 System Card（PDF）](https://assets.claude.com/27d60918d218125e7504bc7354c4b4626ec56b11.pdf)
- [Claude Code：Advisor 官方文档](https://code.claude.com/docs/en/advisor)
- [Anthropic：Fable 5.2 端到端电子原型实验](https://www.anthropic.com/research/claude-electronics-design)
