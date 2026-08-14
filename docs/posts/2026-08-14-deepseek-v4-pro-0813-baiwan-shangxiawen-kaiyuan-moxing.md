---
title: 'DeepSeek V4 Pro 0813 转正：1.6T 参数、百万 token 上下文的开源模型能打赢 Opus 5 吗'
date: 2026-08-14
slug: 'deepseek-v4-pro-0813-baiwan-shangxiawen-kaiyuan-moxing'
description: '2026 年 8 月 12～13 日，DeepSeek 悄悄把 V4 Pro 从预览版转为正式可用（GA），代号 0813。这是一个 1.6 万亿参数、每 token 仅激活 490 亿参数的 MoE 模型，用 Compressed Sparse Attention 与 Heavily Compressed Attention 混合注意力架构把百万 token 上下文的推理成本压到 V3.2 的 27%、KV 缓存压到 10% 以内，权重以 MIT 协议开放。本文基于 Artificial Analysis、Hugging Face、OpenRouter、TechTimes、OfficeChai 等信源，拆解 V4 Pro 的混合注意力、mHC 残差结构、Muon 优化器等技术细节，梳理其对 Opus 5、GPT-5.6 Sol、Kimi K3 等模型的跑分对比，并给出用 vLLM/SGLang 本地部署与 API 调用的实践指南。'
author: 范伟彬
tags:
  - DeepSeek
  - DeepSeek V4 Pro
  - 开源模型
  - MoE
  - 长上下文
  - 混合注意力
  - vLLM
categories:
  - AI
  - 开源模型
---

# DeepSeek V4 Pro 0813 转正：1.6T 参数、百万 token 上下文的开源模型能打赢 Opus 5 吗

2026 年 8 月 12 日到 13 日之间，DeepSeek 没有发官方博客、没有开发布会，只是悄悄把 API 里的 `deepseek-v4-pro` 端点从预览状态切换成了正式可用（GA），版本号定格在 "0813"。这标志着从 4 月 24 日 V4 系列开放权重首次亮相以来持续了近四个月的预览期正式结束。低调归低调，这次更新的分量却不小：V4 Pro 0813 是一个总参数 1.6 万亿、每个 token 只激活约 490 亿参数的 MoE 模型，原生支持 1,048,576 token（约 100 万）的上下文窗口和最高 384,000 token 的单次输出，权重以 MIT 协议开放在 Hugging Face 上，vendor 报出的跑分显示它在多项 Agentic 编程基准上相较预览版有数十个百分点的跃升,部分指标甚至反超了 Claude Opus 4.8。

对每天要在"用闭源旗舰模型换质量"还是"用开源模型换成本"之间做权衡的开发者来说，V4 Pro 0813 值得关注的不是"又一个百万上下文模型"这么简单——它是目前公开的开源权重模型里，第一个把"百万 token 上下文"和"可接受的推理成本"同时做到工程可用级别、并且公开了完整架构细节的产品级模型。本文基于 DeepSeek 官方模型卡片、arXiv 技术报告、Artificial Analysis 独立评测、Hugging Face、OpenRouter 等信源，拆解它是怎么做到的。

## 一、背景：长上下文的老问题，和这次给出的新答案

标准 Transformer 的注意力计算量和显存占用都随上下文长度平方增长，这是长上下文推理成本居高不下的根本原因。行业里已有的缓解方案大体分两类：一类是稀疏注意力，只计算部分 token 对之间的关系，牺牲一定精度换效率；另一类是各种 KV 缓存压缩，减小长序列的显存占用。但把两者都做到极致、同时保证 100 万 token 上下文下模型质量不明显下降，一直是工程难题。

DeepSeek 在 V4 系列里给出的答案是把两条路线做成一套"混合"架构，而不是二选一。根据 arXiv 上的技术报告《DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence》，在 100 万 token 上下文设置下，V4 Pro 相比上一代 V3.2，单 token 推理所需 FLOPs 只有 27%，KV 缓存占用只有 10%。这也是为什么 DeepSeek 敢把上下文窗口直接开到 100 万 token 作为默认配置，而不是像很多模型那样把超长上下文做成"技术上支持但没人用得起"的营销数字。

值得一提的是，这次 GA 版本发布得异常低调——没有官方博客、没有新闻稿，只是在北京时间 8 月 13 日晚上 11 点左右悄悄上线，这也让不少评测机构在文章标题里加上了"跑分有待第三方独立验证"的提醒。这提醒开发者：vendor 自报的跑分可以作为参考，但生产环境选型前，最好用自己的真实任务集做一轮回归测试。

## 二、技术细节解析

### 1. 混合注意力：Compressed Sparse Attention + Heavily Compressed Attention

V4 Pro 的核心创新是同时使用两种注意力路径：

- **Compressed Sparse Attention（CSA，压缩稀疏注意力）**：沿序列轴做 4:1 的 token 级压缩，通过一个带学习位置偏置的 softmax 门控池化函数实现；一个专门的 Lightning Indexer 会为每个 query 挑选 top-512 个压缩后的 block，同时对最近的 128 个未压缩 token 保留滑动窗口，兼顾长程依赖和局部细节。
- **Heavily Compressed Attention（HCA，重压缩注意力）**：压缩比进一步提高到 128:1，实现无需稀疏选择开销的"稠密注意力"，覆盖整个上下文。

模型第 0～1 层只使用 HCA，第 2～60 层在 CSA 和 HCA 之间交替排列。这种分层设计的直觉是：浅层负责建立全局粗粒度的上下文感知，深层则需要更细粒度的稀疏检索能力来定位具体信息。最终效果是，在 100 万 token 上下文场景下，相比标准 8-head GQA（BF16）方案，KV 缓存能减少 98%。

### 2. 训练侧的两个新组件：mHC 残差结构与 Muon 优化器

除了推理侧的注意力优化，V4 系列在训练架构上也做了两处改动：

- **Manifold-Constrained Hyper-Connections（mHC，流形约束超连接）**：用"多条并行分支的逐 token 混合"替代传统残差连接，每条分支通过 Sinkhorn 归一化投影到一个学习出来的流形上，用于增强梯度流动和表征多样性。
- **Muon 优化器**：用基于矩阵动量和 Newton-Schulz 正交化的 Muon 优化器替代 AdamW，官方称其能带来更快的收敛速度和更低的学习率敏感性。

这两项改动都不是这次 0813 更新独有的，而是整个 V4 系列的训练基座设计，但它们是理解"为什么一个 1.6T 参数模型能在合理时间内训练收敛"的关键背景。

### 3. 参数规模与工程规格

- 总参数量 1.6 万亿，每个 token 激活约 490 亿参数（MoE 架构，896 个专家）；
- 预训练数据规模超过 32 万亿 token；
- 上下文窗口默认 100 万 token，单次最大输出 384,000 token；
- 权重以 FP8 存储，RoPE 相关维度保留 BF16 精度；完整 instruct 权重（FP4+FP8 混合）磁盘占用约 862GB；
- API 侧暴露三种运行模式：标准非思考模式、高强度推理模式，以及最大强度的 V4-Pro-Max 配置，默认以"high"强度开启思考过程。

### 4. 跑分表现：Agentic 编程大涨，综合分仍落后一线闭源模型

在 Artificial Analysis Intelligence Index（综合十项基准的评测指数）上，V4 Pro 0813 拿到 53 分，在收录的 106 个模型中排名第三梯队，明显高于同类模型 27 分的中位数，与 Z.AI 的 GLM-5.2 持平。但对比一线闭源模型仍有差距：Claude Opus 5 以 63 分领先，Claude Fable 5（62）、GPT-5.6 Sol 与 Grok 4.6（61）、Kimi K3（60）依次排在后面——10 分的差距，对应的是大约 39 倍的单任务成本差异。

不过在开发者最关心的 Agentic 编程类基准上，V4 Pro 0813 相较预览版的进步非常显著：DeepSWE 从 12.8 分跳到 62.7 分，CyberGym 从 52.7 分跳到 83.3 分，Terminal-Bench 2.1 从 72.1 分跳到 87.9 分。据 vendor 数据，V4 Pro 0813 在 Terminal-Bench 2.1、CyberGym、DeepSWE、AutomationBench 几项上反超了 Claude Opus 4.8，在 Agents' Last Exam 上打平。当然如前所述，这些数字目前主要是厂商自报或分析机构整理，尚缺乏独立第三方复现，实际选型时建议保留一定折扣。

其他公开基准包括：GPQA Diamond 93%（Grok 4.6 高强度模式 95% 领先）、MMLU-Pro 87.5、LiveCodeBench（最大推理模式）93.5、GDPval-AA v2 55%（Opus 5 为 67%）、SciCode 49%（Fable 5 为 60%）。

### 5. 定价

不同渠道给出的价格略有差异：DeepSeek 官方 API／OpenRouter 报价约为输入 $0.435/百万 token、输出 $0.87/百万 token，命中缓存的输入 token 价格可降到 $0.004/百万 token（降幅约 99%）；第三方评测平台 Artificial Analysis 按其评测流程实测出的等效价格略高（输入约 $1.32、输出约 $3.96/百万 token），差异大概率来自评测任务里思考模式消耗的 token 量和缓存命中率不同。综合来看，即便按偏高的估算，V4 Pro 0813 单任务成本依然显著低于 Opus 5 一类闭源旗舰模型。

## 三、实践指南：本地部署与 API 调用

DeepSeek-V4-Pro 的权重开放在 Hugging Face（`deepseek-ai/DeepSeek-V4-Pro`），官方明确支持 Transformers、vLLM、SGLang 以及 Docker Model Runner 几条部署路径，也可以直接通过 HuggingChat 体验。

**用 Transformers 快速加载：**

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("deepseek-ai/DeepSeek-V4-Pro")
model = AutoModelForCausalLM.from_pretrained(
    "deepseek-ai/DeepSeek-V4-Pro",
    device_map="auto",
)
```

**用 vLLM 起一个 OpenAI 兼容的推理服务（多卡）：**

```bash
vllm serve deepseek-ai/DeepSeek-V4-Pro \
  --tensor-parallel-size 8 \
  --max-model-len 1048576
```

**通过官方 API 调用（OpenAI 兼容接口，指定推理强度）：**

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.deepseek.com/v1",
    api_key="YOUR_DEEPSEEK_API_KEY",
)

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "user", "content": "帮我审查这段 Python 代码里的并发问题"},
    ],
    extra_body={"reasoning_effort": "high"},  # 可选 standard / high / max
)
print(response.choices[0].message.content)
```

几个落地时值得注意的取舍点：

- **1.6T 参数模型的自部署门槛很高**：即便只激活 490 亿参数，完整权重仍要加载 1.6T 参数对应的显存/内存，862GB 的磁盘占用意味着自部署基本只适合有多机多卡集群的团队，绝大多数开发者更适合直接调用官方或第三方托管的 API（DeepSeek 官方、OpenRouter、SiliconFlow 等）。
- **百万 token 上下文不等于该用满上下文**：即使推理成本已经大幅优化，超长上下文依然会拉高延迟和费用，对大多数 Agent 任务，更实际的做法是结合检索/摘要控制实际送入的上下文长度，把百万级窗口留给真正需要处理长文档、长代码库的场景。
- **跑分要自己复核**：官方和分析机构给出的 Agentic 编程跃升数据非常亮眼，但截至发稿，还没有独立第三方复现这些具体分数，生产选型前建议先用自己的任务集（比如真实的 SWE 场景、内部代码库）跑一轮对比，而不是直接依据榜单排名切换模型。
- **缓存命中率是控制成本的关键杠杆**：输入 token 命中缓存后价格降幅接近 99%，对有大量重复上下文（如固定 system prompt、长期会话）的 Agent 应用，设计合理的 prompt 缓存策略比换模型对成本的影响更直接。

## 四、总结与展望

DeepSeek V4 Pro 0813 的转正，延续了 DeepSeek 一贯的技术路线：不追求单一榜单分数的极致领先，而是把工程效率做到能落地的程度——这次的重点是用 CSA + HCA 混合注意力架构，把百万 token 上下文的推理成本压到前代的 27%、KV 缓存压到 10% 以内，配合 mHC 残差结构和 Muon 优化器支撑起 1.6 万亿参数规模的训练稳定性。综合智能指数上它仍落后 Opus 5、Fable 5 等一线闭源模型大约 10 分，但考虑到接近 40 倍的成本差异，以及在 Agentic 编程类基准上相较自家预览版的显著提升，它对成本敏感、需要长上下文处理能力、又不介意自行验证跑分的团队，是一个值得放进选型池的开源选项。

接下来值得持续关注的有两点：一是社区和独立评测机构能否复现官方公布的 Agentic 编程跃升数据，这决定了这些数字的可信度；二是随着 100 万 token 上下文成为开源模型的新常态，围绕长上下文的检索增强、缓存策略、Agent 记忆管理等配套工具链会如何演化——毕竟"上下文窗口够大"只是第一步，"怎么把这么大的窗口真正用出效果"才是接下来的工程重点。

## 参考来源

- [deepseek-ai/DeepSeek-V4-Pro（Hugging Face 模型卡片）](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro)
- [DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence（arXiv 技术报告）](https://arxiv.org/abs/2606.19348)
- [DeepSeek V4 GA: Architecture, Inference Efficiency, and What the Grayscale Test Reveals（Hugging Face 博客）](https://huggingface.co/blog/ResterChed/deepseek-v4-ga-architecture)
- [DeepSeek V4 Pro 0813 Goes GA: Benchmark Claims Await Independent Proof（TechTimes）](https://www.techtimes.com/articles/324241/20260813/deepseek-v4-pro-0813-goes-ga-benchmark-claims-await-independent-proof.htm)
- [DeepSeek v4-0813-Pro Benchmarks: Model Scores One Point Higher Than Flash On Artificial Analysis Intelligence Index（OfficeChai）](https://officechai.com/ai/deepseek-v4-0813-pro-benchmarks/)
- [DeepSeek V4 Pro 0813 (max) - Intelligence, Performance & Price Analysis（Artificial Analysis）](https://artificialanalysis.ai/models/deepseek-v4-pro)
- [DeepSeek V4 Pro 0813 - API Pricing & Benchmarks（OpenRouter）](https://openrouter.ai/deepseek/deepseek-v4-pro-0813)
