---
title: 'GPT-6.1 Sol 的关键不只是接近 Astra：Agent 成本开始由缓存命中决定'
date: 2026-10-02
slug: 'gpt-6-1-sol-agent-prompt-cache-cost'
author: 范伟彬
description: '拆解 GPT-6.1 Sol 的能力、定价与提示词缓存机制，并用可复算的十轮 Agent 账单说明何时能省、何时反而会多花钱。'
categories:
  - AI
  - 技术
tags:
  - GPT-6.1 Sol
  - OpenAI
  - AI Agent
  - Prompt Caching
  - API 成本
---

# GPT-6.1 Sol 的关键不只是接近 Astra：Agent 成本开始由缓存命中决定

一个编码 Agent 连续工作十轮，每一轮都要重新带上系统规则、工具定义、仓库说明和前面的对话。模型真正反复“阅读”的输入，往往比它新写出的代码多得多。此时，选模型不能只看每百万输入 Token 的标价，还要看这些重复内容能否命中缓存。

OpenAI 在 **2026 年 9 月 29 日**发布 [GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/)。它沿用 GPT-6 Sol 的标准输入、输出价格，却把缓存输入从每百万 Token 0.20 美元降到 0.10 美元；OpenAI 同时称，它在编码 Agent、电脑操作和专业工作评测中接近 GPT-6 Astra，而标准输入、输出单价只有 Astra 的五分之一。

这次更新对长任务的实际影响，不只是“更强的中档模型”。如果 Agent 能稳定复用上下文，GPT-6.1 Sol 的缓存读取价格只有普通输入的二十分之一，模型账单的决定因素会从“总共传了多少 Token”变成“有多少 Token 是稳定前缀”。

## 先看清它在产品线里的位置

GPT-6.1 Sol 的 API 模型名是 `gpt-6.1-sol`，支持 Responses API 和 Chat Completions；工具调用要使用 Responses API。官方模型页列出的上下文窗口是 1,050,000 Token，单次最多输出 128,000 Token。

标准处理档位下，不超过 272K 输入 Token 的价格如下，单位都是美元/百万 Token：

| 模型 | 普通输入 | 缓存读取 | 缓存写入 | 输出 |
|---|---:|---:|---:|---:|
| GPT-6.1 Sol | 2.00 | 0.10 | 2.50 | 10.00 |
| GPT-6 Astra | 10.00 | 1.00 | 12.50 | 50.00 |

这里最容易漏看的是“缓存写入”。第一次把一段前缀放进缓存，并不是按普通输入计费，而是按 1.25 倍收费。只有后续请求再次命中相同前缀，才会获得低价读取。因此，一段只用一次的长材料不但省不了钱，还会因为写缓存多付 25%。

当输入超过 272K Token 时，GPT-6.1 Sol 的标准档输入、缓存读取和缓存写入价格分别升为 4.00、0.20 和 5.00 美元，输出升为 15.00 美元。1.05M 上下文是容量上限，不是鼓励把所有资料一次塞进去；先控制上下文，再谈缓存，通常比单纯换模型更有效。

## 缓存像给重复资料办了一张借阅卡

可以把提示词缓存想成图书馆寄存。第一次把一摞资料编目入库，要多做一次整理，所以写入价格高；以后在有效期内拿同一摞资料，只付很低的借阅费。只要把其中一页改了、顺序换了，或者借阅点没有落在相同边界上，系统就可能找不到原来的那一摞。

对 GPT-5.6 及之后的模型，OpenAI 提供两种断点方式：

- **隐式缓存**：系统在符合条件的最新消息末尾选择断点，适合一直追加消息的对话。
- **显式缓存**：开发者在稳定内容末尾标记断点，把用户问题、时间戳和每轮变化的材料放在断点之后。

下面是官方字段结构的简化示意。真正需要复用的是第一段稳定规则，而不是当前用户问题：

```json
{
  "model": "gpt-6.1-sol",
  "reasoning": { "effort": "low", "context": "all_turns" },
  "prompt_cache_options": { "mode": "explicit" },
  "input": [
    {
      "role": "developer",
      "content": [{
        "type": "input_text",
        "text": "稳定的系统规则、工具说明和共享参考资料……",
        "prompt_cache_breakpoint": { "mode": "explicit" }
      }]
    },
    {
      "role": "user",
      "content": "本轮会变化的问题……"
    }
  ]
}
```

显式模式下如果没有设置断点，请求不会创建缓存写入。可缓存前缀至少需要 1,024 个可见输入 Token；一次请求最多创建四次缓存写入。顶层 `instructions` 不能放显式断点，想缓存开发者规则，要像示例一样放进 developer 消息的 `input_text` 内容块。

## 十轮 Agent 任务能省多少

假设一个 Agent 有 100,000 Token 的稳定前缀，每轮再增加 2,000 Token 的动态输入，并生成 2,000 Token 输出，共运行十轮。下面的脚本只使用 Python 标准库，按官方标准档费率比较“不缓存”和“首轮写入、后九轮全部命中”的账单。我在 Python 3.12 中实际运行过。

```python
PRICES = {
    "GPT-6.1 Sol": {
        "input": 2.00, "cached": 0.10,
        "write": 2.50, "output": 10.00,
    },
    "GPT-6 Astra": {
        "input": 10.00, "cached": 1.00,
        "write": 12.50, "output": 50.00,
    },
}

PREFIX = 100_000
DYNAMIC = 2_000
OUTPUT = 2_000
REQUESTS = 10
MILLION = 1_000_000

for model, p in PRICES.items():
    uncached = REQUESTS * (
        (PREFIX + DYNAMIC) * p["input"]
        + OUTPUT * p["output"]
    ) / MILLION

    cached = (
        PREFIX * p["write"]
        + DYNAMIC * p["input"]
        + OUTPUT * p["output"]
        + (REQUESTS - 1) * (
            PREFIX * p["cached"]
            + DYNAMIC * p["input"]
            + OUTPUT * p["output"]
        )
    ) / MILLION

    saving = 1 - cached / uncached
    print(
        f"{model:13} no-cache=${uncached:.3f} "
        f"cached=${cached:.3f} saving={saving:.1%}"
    )
```

实际输出是：

```text
GPT-6.1 Sol   no-cache=$2.240 cached=$0.580 saving=74.1%
GPT-6 Astra   no-cache=$11.200 cached=$3.350 saving=70.1%
```

这不是通用账单预测，而是一个边界清楚的算例：使用标准处理档，输入未超过 272K，十轮输出长度相同，不计搜索、容器等工具费用，而且假设后九轮的稳定前缀全部命中。它揭示了两个容易被单价表遮住的事实：缓存只降低重复输入，不会降低输出价格；命中率一旦下降，结果会迅速向“不缓存”靠拢。

对稳定前缀本身，GPT-6.1 Sol 写一次、读九次的费率相当于普通处理 1.7 次，而不缓存要处理十次。只复用一次也已经比处理两次便宜，但如果首轮之后前缀就被改写，缓存写入费会变成纯额外成本。

## 哪些改动最容易打掉命中

缓存不是一块可以任意查询的长期记忆，而是对请求开头进行前缀匹配。下面几类看似无害的改动，都会影响复用：

1. 把当前时间、用户 ID 或随机内容放到系统规则开头。
2. 每轮重排工具顺序，修改工具 Schema，或删掉暂时不用的工具。
3. 重写早期消息，而不是在对话末尾追加新消息。
4. 在隐式和显式模式之间切换，却没有保留相同断点。
5. 对历史进行压缩或截断，导致原有前缀发生变化。

更稳妥的做法是把工具定义、固定规则和共享资料放在最前面；把租户信息、日期和本轮任务放到断点之后。工具暂时不用时，优先通过 `tool_choice` 或 `allowed_tools` 限制调用，不要反复修改完整工具列表。需要改变推理强度时，可以在支持的 GPT-6 模型中追加 `configuration_update`，避免重写前缀。

缓存也不是必然命中。GPT-6.1 Sol 的缓存前缀在最近一次写入或复用后至少保留 30 分钟；缓存状态位于具体机器，路由和机器负载仍可能影响结果。缓存 Token 也照常计入每分钟 Token 限额。因此，生产环境要看 API 返回的缓存用量和实际费用，不能把纸面折扣直接当成预算。

## “接近 Astra”不等于可以全面替代 Astra

OpenAI 报告 GPT-6.1 Sol 在 DeepSWE 1.1 上以约五分之一任务成本匹配 Astra，在 OSWorld 2.0 离线集的最高推理档位只差 2.1 个百分点；但这些都是发布方在特定运行框架、推理强度和任务集上的结果。官方也注明，研究环境或 API 的评测输出可能与生产产品不同。

差距在高难任务上仍然存在。Terminal-Bench Science 0.1 中，GPT-6.1 Sol 最高推理档的平均任务成本是 5.47 美元，Astra 是 23.80 美元，但 Astra 仍以 68.1% 得到测试模型中的最高分。对昂贵的科学工作、一次失败成本很高的复杂推理，较高的模型单价可能仍值得；对大量编码、文档和业务 Agent，应该先用自己的任务做“成功率 × 单次成本”评估，而不是只比较官方总分。

系统卡还把 GPT-6.1 Sol 按 OpenAI 的 Preparedness Framework 视为网络安全 Critical、生物与化学 High，并沿用 Astra 的防护栈。这说明它的能力边界不能只按“中档模型”理解。涉及命令执行、凭据和外部系统写入时，仍要在模型之外保留最小权限、审批、沙箱和审计。

## 谁适合现在迁移

已经在用 GPT-6 Sol 跑编码 Agent、电脑操作或长文档流程的团队，最值得先做 A/B 测试：标准输入、输出单价没有变化，缓存读取价格减半，能力上又有官方评测中的明确提升。测试时应同时记录任务成功率、总输入、缓存写入、缓存读取、输出和工具费用，而不是只看一轮回答质量。

如果任务只有一问一答、输入很短，缓存优势几乎体现不出来，GPT-6 Luna 或其他更轻模型可能更合适。如果每轮都要替换大部分上下文，先重构请求结构，比直接迁移到 GPT-6.1 Sol 更重要。

GPT-6.1 Sol 带来的真正变化，是高能力 Agent 的成本不再能用一张“输入价 + 输出价”表算完。模型选择、上下文布局和缓存命中已经变成同一个工程问题：把稳定信息放对位置，可能比把模型降一档更省钱；把前缀频繁改写，再低的缓存单价也只是纸面数字。

## 原始资料

- [GPT-6.1 Sol 发布说明（2026-09-29）](https://openai.com/index/introducing-gpt-6-1-sol/)
- [GPT-6.1 Sol 模型页](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
- [OpenAI API 更新日志（2026-09-29）](https://developers.openai.com/api/docs/changelog)
- [OpenAI API 定价](https://developers.openai.com/api/docs/pricing)
- [提示词缓存机制与显式断点](https://developers.openai.com/api/docs/guides/prompt-caching)
- [GPT-6.1 Sol 系统卡补充](https://deploymentsafety.openai.com/gpt-6-1-sol)
