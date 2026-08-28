---
title: 'Ox Alpha 揭秘实录：开发者靠 Tokenizer 指纹，在官方承认前就"猜"出了 GLM-5.3-Flash'
date: 2026-08-28
slug: 'ox-alpha-tokenizer-zhiwen-shenfen-jiemi'
author: 范伟彬
categories:
  - AI
  - 大模型
tags:
  - Z.ai
  - 智谱
  - GLM-5.3-Flash
  - Ox Alpha
  - OpenRouter
  - 模型指纹
  - Tokenizer
  - 大模型评测
description: '2026 年 8 月 20 日，一个匿名模型 stealth/ox-alpha 悄悄出现在 OpenRouter 上：免费、100 万 token 上下文、编程基准分数直接反超 GPT-5.6 和 Claude Fable 5，却没人知道它是谁做的。接下来六天里，开发者社区没有等官方声明，而是用差分 token 计数做"Tokenizer 指纹"比对，外加 API 报错方言、视频计费方式等旁证，在 8 月 26 日 Z.ai 正式确认之前，就已经把矛头精准锁定在 GLM 系列上——最终答案是新模型 GLM-5.3-Flash（320B/18B MoE，MIT 协议开源）。本文基于 dev.to、isimplifyme、CellCog、Bloomberg 等信源报道，拆解这套"黑盒模型身份鉴定"方法论的具体做法，并给出可直接运行的差分 token 计数代码与 GLM-5.3-Flash 调用示例。'
---

# Ox Alpha 揭秘实录：开发者靠 Tokenizer 指纹，在官方承认前就"猜"出了 GLM-5.3-Flash

2026 年 8 月 20 日，模型聚合平台 OpenRouter 上悄悄多了一个陌生条目：`stealth/ox-alpha`。没有厂商署名，没有发布公告，唯一惹眼的是它的能力——100 万 token 上下文，完全免费，且在开发者们的非正式跑分里，DeepSWE 一类的编程 Agent 基准直接反超了 GPT-5.6 和 Claude Fable 5。这种"来路不明但战斗力惊人"的模型在 2026 年已经不是第一次出现，但这一次不同的是：在 Z.ai 于 8 月 26 日正式承认 Ox Alpha 就是新模型 GLM-5.3-Flash 之前，开发者社区已经通过一套系统的黑盒指纹分析方法，把答案提前锁定了。这次"民间侦探破案"的过程，比模型本身的发布更值得被记录下来——它展示了一整套可复用的、用来鉴定匿名 API 背后真实身份的技术手段。

## 一、背景：为什么厂商要"隐姓埋名"发模型

"隐身模型"（stealth model）策略近年在大模型圈并不罕见：厂商把还未正式定名、定价的模型匿名挂到 OpenRouter 或竞技场类平台上，免费或低价开放给真实用户使用，借此在正式发布前收集大规模、贴近生产环境的真实反馈和边界案例，而不必提前暴露品牌、路线图或商业化节奏。对 Z.ai 而言，这次以 `stealth/ox-alpha` 之名试跑六天（8 月 20 日至 26 日），换来的是不计其数免费的真实工作负载压测——包括游戏开发者 Jessica Doering 用它一次性搭出一个带订单管理、原料库存与烘焙失败判定的完整披萨店模拟小游戏"Pizza Rush"这样的复杂多系统任务。但硬币的另一面是：只要模型对外提供 API 访问，它的"行为特征"就必然会泄露给足够细心的观察者，而 2026 年的开发者社区显然已经把"给匿名模型开盲盒"练成了一门手艺。

## 二、技术细节解析：如何在没有源码、没有厂商声明的情况下"验明正身"

### 1. 核心方法：差分 Token 计数（Differential Token Counting）

绝大多数 Chat Completions 类 API 在返回结果时都会带上 `prompt_tokens` 字段，这个数字由两部分构成：模型自带的隐藏对话模板（system 前缀、角色标记等固定开销）加上用户输入内容本身的 token 数。这里有一个关键的数学技巧：如果分别请求"基线文本 BASE"和"基线文本 + 探针字符串 probe"两次，两次返回的 `prompt_tokens` 之差，会精确抵消掉模板固定开销，只剩下探针字符串本身在该模型词表下的 token 数。这个差值就是模型词表（tokenizer）独有的"指纹"，与厂商是否公开身份无关——因为分词方式是模型架构和训练时就固定死的底层属性，无法通过接口层的匿名化掩盖。

研究者据此设计了 95 条探针字符串，覆盖二十多种自然语言（中文、泰语、印地语、孟加拉语、阿拉伯语、俄语等）、十五条覆盖十三种代码格式的探针（Python、TypeScript、Rust、Go、Java、C、HTML、CSS、YAML、TOML、Dockerfile、Shell、SQL）、结构化数据与数字格式，以及 emoji ZWJ 序列、组合变音符号、国际音标、数学符号等 Unicode 边界情况——这些正是不同厂商词表之间最容易出现分歧的地方，比笼统地丢一段自然语言进去更有区分度。

### 2. 候选词表比对与结果

拿到 Ox Alpha 在 95 条探针上的 token 计数后，研究者用同样的方法预先跑出了十四个候选模型（对应十三种不同词表，因为小米 MiMo 的分词器被发现与 Qwen2.5 完全字节级一致）各自的探针 token 数，逐一比对差异：候选集覆盖了 GLM-4.5/GLM-4、Qwen 系列、DeepSeek-V3.1、Kimi K2、MiniMax-M1、Yi-1.5、混元、文心 4.5、Seed-OSS、Llama-3.1、GPT-OSS 等主流公开词表。

比对结果非常悬殊：GLM-4.5 在 95 条探针中命中 84 条精确匹配，平均绝对误差仅 1.08 个 token；排名第二的 Llama-3.1 只命中 46 条，平均绝对误差高达 3.83。等到 GLM-5 系列词表正式可获取后，用同样方法重新比对，Ox Alpha 与 GLM-5 词表做到了 95/95 全部精确匹配，平均绝对误差 0.00——这已经不是"疑似"，而是数学意义上的确定性证据。仅这一项分析总共只消耗了 126 次 API 调用，且全部发生在 Ox Alpha 免费试用窗口期内，成本几乎为零。

### 3. 交叉验证：不止 Tokenizer 一处破绽

除了 token 计数，社区还叠加了多路旁证互相印证，让结论更加牢靠：

- **固定隐藏开销**：Ox Alpha 在几乎所有请求里都会额外多报 75 个 prompt token（另有研究给出约 90 个、其中 64 个来自缓存的数字），与它在系统层加了一段固定隐藏提示词或模板的假设吻合，且这个数字本身也具有指纹价值。
- **多模态计费方式**：Ox Alpha 处理视频输入时的 token 计费方式，在四段不同测试视频上都与 Z.ai 的 GLM-5V-Turbo 完全一致，说明二者共享同一套多模态 tokenizer 实现，而不只是文本词表恰好相似。
- **特殊 token 转义行为**：研究者把 25 个特殊 token 字面量（如 `<think>`、`</think>` 等推理分隔符）当作普通用户输入发给 Ox Alpha，25 项中有 23 项的计数结果与 GLM 系列的转义逻辑完全一致，仅 `<think>`/`</think>` 两项出现偏差——这恰好符合"该模型是具备推理能力的新版本，这两个 token 可能被提升为专属特殊 token"的猜测，后来也确实被证实。
- **报错方言与代码指纹**：一次异常请求触发的报错栈信息中，混入了与智谱云 API 内部实现相符的 Java 类路径字符串，报错码风格也与已知的 GLM API 方言一致，进一步印证了归属。

四条独立证据链——tokenizer 指纹、固定开销、多模态计费、报错方言——分别来自完全不同的观测维度，却指向同一个结论，这正是黑盒模型指纹分析可信度的来源：单一证据可能是巧合，但四条互不相关的证据同时指向一处，几乎不可能是巧合。8 月 26 日，Bloomberg 报道 Z.ai 正式确认 Ox Alpha 是"GLM 系列的新迭代版本"，五小时后 OpenRouter 生产目录中上线了正式条目 `z-ai/glm-5.3-flash`，MIT 协议的权重同步登陆 Hugging Face（`zai-org/GLM-5.3-Flash`）——民间的推理，被验证为完全正确。

## 三、实践指南：自己动手做一次模型指纹比对，以及如何调用 GLM-5.3-Flash

### 1. 用 Python 复现差分 Token 计数的核心逻辑

下面是一个精简版实现，演示如何对任意兼容 OpenAI 协议的 Chat Completions 接口做差分探针分析。实战中把 `PROBES` 换成更完整的多语言 / 代码 / Unicode 探针集，并对每个候选模型都跑一遍同样流程，即可复现文中的比对结果：

```python
import requests

API_URL = "https://openrouter.ai/api/v1/chat/completions"
API_KEY = "YOUR_API_KEY"
MODEL = "stealth/ox-alpha"  # 换成任意想鉴定的目标模型

BASE_TEXT = "Reply with the single word: OK."
PROBES = [
    "混合专家架构在稀疏激活场景下的路由稳定性",
    "def quicksort(arr): return arr if len(arr) <= 1 else ...",
    "🧑‍🚀🧑🏽‍🤝‍🧑🏿",  # emoji ZWJ 序列，词表边界高发区
    "<think>",
    "</think>",
]

def prompt_tokens(text: str) -> int:
    resp = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": text}],
            "max_tokens": 1,
        },
        timeout=30,
    )
    return resp.json()["usage"]["prompt_tokens"]

base_count = prompt_tokens(BASE_TEXT)
for probe in PROBES:
    combined_count = prompt_tokens(BASE_TEXT + probe)
    probe_token_count = combined_count - base_count
    print(f"{probe[:20]!r:24} -> {probe_token_count} tokens")
```

拿到目标模型每条探针的 token 数后，只需把同一批探针在候选模型（例如通过 Hugging Face 的 `tokenizers` 库本地加载公开词表）上离线跑一遍分词，比较两组计数的精确匹配率与平均绝对误差，命中率最高、误差最小的候选就是最可能的真实身份。需要强调的是，这套技术仅适用于你自己有权限调用、且服务条款允许分析的 API（例如公开试用的 stealth 模型），不要用于绕过访问控制或侵犯他人服务条款的场景。

### 2. 调用正式发布的 GLM-5.3-Flash

Ox Alpha 揭晓身份后，模型本体没有变化，只是换了名字、定价和归属方。GLM-5.3-Flash 的核心参数是 320B 总参数 / 18B 激活参数的 MoE 架构，首次在 GLM 系列中引入"稀疏+线性"混合注意力机制，训练语料达 30 万亿 token，原生支持文本、图像、视频多模态输入，上下文窗口 104.8576 万 token，最大输出 13.1072 万 token，权重以 MIT 协议开源在 Hugging Face（`zai-org/GLM-5.3-Flash`），并提供 SGLang、vLLM、TokenSpeed、KTransformers 的首发部署支持。API 调用示例：

```bash
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "z-ai/glm-5.3-flash",
    "messages": [
      {"role": "user", "content": "帮我实现一个基于差分 token 计数的模型指纹比对函数"}
    ],
    "max_tokens": 2048
  }'
```

几点提醒：一是目前限时优惠价为每百万 token 输入 0.075 美元、输出 0.25 美元（截至 9 月 9 日），恢复常规价后为输入 0.15 美元、输出 0.50 美元，缓存输入价格更低，适合大规模跑 Agent 流水线前先做成本估算；二是官方公布的 DeepSWE v1.1（63.4 分）、AutomationBench（48.8 分）等基准显示其在部分编程 Agent 场景已反超 Claude Opus 4.8，但 Terminal-Bench 2.1（84.3 分）仍略低于对手的 85.0 分，属于"总体领先、局部持平"的格局，具体到自己的任务类型仍建议先做小规模 AB 测试再决定是否切换；三是这次"先隐身跑六天、再官宣转正"的节奏本身也值得留意——今后再遇到 OpenRouter 上突然冒出的高性能匿名模型，本文这套指纹比对方法可以直接拿来复用，不必等厂商公告。

## 四、总结与展望

Ox Alpha 事件最有价值的部分，不是"又一个国产大模型刷新了编程基准"，而是它意外验证了一件事：在生成式 AI 高度同质化竞争的当下，一个模型即使被刻意隐去身份，其分词方式、隐藏模板开销、多模态计费逻辑、报错文本方言这些"运行时指纹"依然会诚实地暴露它的血统。这套方法论的价值不止于满足好奇心——对于需要在多个模型供应商之间做选型、审计供应链、或验证某个"神秘评测第一"模型是否真的来自其宣称厂商的团队来说，差分 token 计数加多路旁证交叉验证，是一套成本极低（本次分析仅耗费 126 次 API 调用）却证据链条严密的黑盒鉴定手段，且已有完整可复现的代码与探针数据集公开在案。可以预见，随着"隐身模型先试跑、后官宣"这种打法被越来越多厂商采用，"模型指纹分析"很可能会从少数极客的业余爱好，逐渐变成 AI 供应链尽职调查里的一项标准动作。而对于普通开发者，GLM-5.3-Flash 本身也是一次实打实可用的能力升级——MIT 协议、百万级上下文、具备竞争力的 Agent 基准表现和相当亲民的价格，值得在自己的编程 Agent 或长文档处理流水线中纳入评估候选。

## 参考来源

- [I Tried the Mysterious Ox Alpha Model. Then I Fell Down the Rabbit Hole of Who Actually Made It. — DEV Community](https://dev.to/sizzlebop/i-tried-the-mysterious-ox-alpha-model-then-i-fell-down-the-rabbit-hole-of-who-actually-made-it-a4j)
- [The Tokenizer Is a Fingerprint: Identifying the Lab Behind a Stealth Model from Token Counts Alone — isimplifyme](https://isimplifyme.com/whitepapers/the-tokenizer-is-a-fingerprint)
- [GLM-5.3-Flash Is Ox Alpha: The Reveal, the Specs, and the Real Pricing — CellCog](https://cellcog.ai/blog/glm-5-3-flash/)
- [What Is Ox Alpha? The Stealth Model, Revealed as GLM-5.3-Flash — CellCog](https://cellcog.ai/blog/what-is-ox-alpha/)
- [Mystery Ox Alpha Model Revealed To Be From Chinese Lab Z.AI — Officechai](https://officechai.com/ai/ox-alpha-z-ai/)
- [Mystery 'Ox Alpha' Model That Took Silicon Valley by Storm Revealed as China's Z.ai New Release — BigGo Finance](https://finance.biggo.com/news/07b9d082-1051-4f9d-9409-ca10f89aa673)
- [Chubby♨️ on X: Bloomberg confirmation of Ox Alpha as GLM-5.3 Flash](https://x.com/kimmonismus/status/2092561180128608672)
