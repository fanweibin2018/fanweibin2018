---
title: 'OpenAI 自研推理芯片 Jalapeño 首秀：单卡 13.4 PFLOPS，为什么大厂都在放弃"训练推理一体"？'
date: 2026-08-27
slug: 'openai-jalapeno-tuili-xinpian-jiegou-jiexi'
author: 范伟彬
categories:
  - AI
  - 硬件
tags:
  - OpenAI
  - Jalapeño
  - 自研芯片
  - Broadcom
  - 推理优化
  - AI Infra
  - HBM4
description: 'OpenAI 于 2026 年 8 月 25 日公布了与 Broadcom 联合设计的自研推理芯片 Jalapeño 的首批基准测试结果：在 SemiAnalysis 的 InferenceX 基准下，用 GPT-OSS-120B、DeepSeek R1、Kimi K2.5 等开源模型实测，Jalapeño 相比 Nvidia GB200/GB300 机架系统实现了 1.5～1.9 倍的每瓦吞吐提升与 1.7～3.6 倍的端到端延迟下降，单卡算力 13.4 PFLOPS（MXFP4）、216GB HBM4、15.4TB/s 带宽。本文基于 OpenAI 官方博客及多家科技媒体报道，拆解 Jalapeño 的架构设计理念、实测数据、供应链与量产节奏，并分析这波"训练推理分离"的自研芯片浪潮对开发者和 AI 基础设施格局意味着什么。'
---

# OpenAI 自研推理芯片 Jalapeño 首秀：单卡 13.4 PFLOPS，为什么大厂都在放弃"训练推理一体"？

2026 年 8 月 25 日，OpenAI 在官方博客上公布了自研推理芯片 **Jalapeño** 的第一批基准测试结果。这是 OpenAI 硬件战略从"传闻"走向"实锤"的关键一步：过去两年，OpenAI 与 Broadcom 的芯片合作只停留在供应链爆料和 10GW 部署协议的新闻标题里；这一次，OpenAI 亲自放出了具体到小数点后一位的性能数字，并且明确表示测试用的不是自家闭源模型，而是 GPT-OSS-120B、DeepSeek R1-670B、Kimi K2.5-1T 这几个业界公认的开源大模型——这本身就是一个值得玩味的信号：OpenAI 想让所有人都能验证这个数字，而不是自说自话。

对开发者而言，这不是一条可以划过去的"友商动态"。推理成本占据了几乎所有 AI 应用的最大变量成本，谁能把每 token 的推理成本压下来，谁就能在 API 定价、产品体验（延迟）、并发承载能力上同时占优。Jalapeño 释放的信号，某种程度上预示着未来一两年 AI 基础设施的走向。

## 一、背景：为什么大厂纷纷去做"推理专用"芯片

在过去几年的 AI 硬件叙事里，Nvidia 的 GPU（如 H100、B200、GB200/GB300）几乎是训练和推理通吃的"全能选手"——同一套架构既能跑大规模预训练，也能扛线上推理流量。这种通用性带来了灵活性，但也意味着芯片设计必须在训练所需的高精度大规模矩阵乘法和推理所需的低延迟、高吞吐、KV Cache 密集访问之间做妥协。

Jalapeño 走的是完全相反的路线：**它只为推理而生**，不考虑训练场景。这一点与 Google 的 TPU v7（Ironwood）主打推理效率、Amazon Trainium2 侧重训练成本、Broadcom 为 Meta 定制的 MTIA 系列一脉相承——2026 年的自研芯片竞赛，已经从"要不要自己做芯片"进化到"训练和推理该不该用同一颗芯片"。

OpenAI 硬件负责人 Richard Ho 在发布中给出的理由很直接：现有的通用机架系统（以 Nvidia GB200/GB300 为代表）在吞吐和延迟之间往往只能二选一——堆高吞吐通常要靠增大 batch size，但这会拉长排队和响应时间；要压低延迟又必须缩小 batch，从而牺牲每瓦能处理的总请求量。Jalapeño 的设计目标，就是用一套架构同时拿到两头的好处。

据 The Register 等媒体披露，Jalapeño 的设计周期只有约九个月，OpenAI 内部承认这在很大程度上得益于用自家大模型辅助芯片设计（EDA 流程中的验证、布局布线优化等环节），这也是 AI 反哺芯片行业的一个具体案例。

## 二、架构细节：把"数据搬运"当成头号敌人

传统认知里，芯片性能常被简化为"算力多少 TFLOPS"，但 OpenAI 在介绍 Jalapeño 时反复强调的核心设计理念是**最小化数据移动和通信延迟**，而不是单纯堆算力。这背后的逻辑是：大模型推理，尤其是解码（decode）阶段，本质上是一个内存带宽受限（memory-bound）而非算力受限（compute-bound）的过程——每生成一个 token，都要把巨大的 KV Cache 重新访问一遍，真正的矩阵计算量相对很小。算力再强，如果数据在芯片内部、芯片之间来回搬运的开销压不下去，端到端延迟照样降不下来。

围绕这个理念，Jalapeño 的几个关键设计点：

- **大容量 SRAM 本地缓存**：把 KV Cache 等关键中间状态尽量"钉"在计算单元附近的片上存储，减少跨芯片、跨机架的远程访问。
- **预填充（prefill）与解码（decode）两阶段联合优化**：这两个阶段的计算特征差异很大（prefill 算力密集、decode 带宽密集），Jalapeño 没有像很多方案那样只优化其中一段，而是针对两者分别做了通路设计。
- **面向大规模并行推理的互联架构**：单个 Jalapeño 系统由 **128 颗加速器**组成一个机架级集群，通过定制互联拉平通信延迟。

**单芯片规格**（据 The Register 等信源整理）：
- 算力：**13.4 PFLOPS**（MXFP4 精度）
- 显存：**216GB HBM4**，来自 6 颗 HBM4 堆栈
- 带宽：**15.4 TB/s**
- 制程：台积电（TSMC）**3nm**
- 功耗：设计上限 700W，测试期间实际运行控制在 550W 以下

**系统级规格**（128 卡机架）：
- 总算力：**1.7 ExaFLOPS**（4-bit 精度）
- 总显存：**27.5 TB** HBM4
- 总带宽：接近 **2 PB/s**

对比同代 Nvidia AMD 机架系统，OpenAI 与第三方评测都承认 Jalapeño 单卡算力其实**不占优**（比顶配机架系统低 1.46～2 倍），显存容量也略少（约低 12%），但它的**显存带宽达到对手的 115%**——这恰恰印证了上面"带宽优先于算力"的设计取舍：与其把晶体管都堆给算力，不如优先保证数据能喂得进来。

## 三、实测数据：InferenceX 基准下的真实表现

OpenAI 没有自己攒一套评测标准，而是采用了独立芯片分析机构 **SemiAnalysis** 的 **InferenceX** 基准——这是目前业内比较受认可的第三方推理硬件评测体系，测试维度覆盖吞吐、延迟、能效三个轴。测试对象选择了三个开源模型，规格跨度很大：

| 测试模型 | 参数规模 | 类型 |
|---|---|---|
| GPT-OSS-120B | 120B | OpenAI 自家开源模型 |
| DeepSeek R1 | 670B | 推理模型，MoE 架构 |
| Kimi K2.5 | 1T | 超大规模 MoE |

核心结果（相对 Nvidia GB200/GB300 机架系统）：

- **每瓦吞吐（throughput per kilowatt）**：提升 **1.5×～1.9×**
- **端到端延迟（end-to-end latency）**：降低 **1.7×～3.6×**
- **超低延迟场景**：速度快 **2.1×～4.1×**

值得注意的是这里的对比口径——OpenAI 强调的是"同一套架构同时拿到吞吐和延迟两头的好处"，而不是单项指标的极限值。这意味着在实际线上服务场景中（既要扛并发又要保证响应速度），Jalapeño 相比通用 GPU 机架的综合优势可能比单看某一项指标更明显。

## 四、供应链与量产节奏：Broadcom + 三星，2026 年底小批量

Jalapeño 不是 OpenAI 从头到尾独立造出来的芯片，而是一个典型的"Fabless 设计 + 合作伙伴代工"模式：

- **架构设计**：OpenAI 主导，自家模型深度参与了 EDA 辅助设计流程
- **ASIC 设计合作**：Broadcom（博通），双方在这颗芯片上"紧密合作"（OpenAI 官方用词）
- **晶圆代工**：台积电（TSMC），3nm 制程
- **HBM4 供应**：据 TrendForce 等供应链媒体报道，三星电子（Samsung Electronics）大概率是 Jalapeño 的 HBM4 主要供应商

这与 2025 年 10 月 OpenAI 和 Broadcom 签署的 **10GW 部署协议**是同一条主线——那份协议当时只公布了总规模和时间窗口，Jalapeño 就是这份协议下的第一代产品落地。

量产节奏方面，OpenAI 硬件负责人 Richard Ho 给出的时间表相对保守：

- **2026 年底**：极小规模部署，性质更接近内部验证和小流量灰度
- **2027 年**：更大规模量产部署
- 据爆料，第二代芯片可能在数月内完成流片（tape-out），第三代的开发已经启动

也就是说，Jalapeño 短期内不会立刻改变开发者调用 OpenAI API 时背后跑的硬件——现阶段绝大部分线上流量仍然由 Nvidia GPU 承载,真正规模化替换要等到 2027 年之后。

## 五、对开发者意味着什么

即便 Jalapeño 现在还没有直接触达开发者，这个方向对 API 使用者仍然有几层现实影响，值得提前纳入判断：

**1. 推理成本曲线可能进一步下探。** 如果自研推理芯片能在 2027 年形成规模化产能，OpenAI 在推理侧的边际成本会显著低于纯靠 Nvidia GPU 采购。结合今年以来"每单位智能成本下降约 50%"的行业趋势，API 定价大概率会延续降价通道，长上下文、高并发的应用会更早受益。

**2. 延迟敏感型应用的可行性边界会扩大。** 端到端延迟降低 1.7～3.6 倍，意味着实时语音（比如 OpenAI 自己的 GPT-Live/Realtime API）、低延迟 Agent 循环、高频交互类产品的体验天花板会被推高。如果你在做这类对首字延迟敏感的产品，这是一个值得关注的基础设施先兆。

**3. "训练推理分离"会进一步推动模型部署的专用化。** 随着 Jalapeño 这类推理专用芯片成熟，云厂商和大模型厂商更有动力把模型按"训练用什么、推理用什么"拆开优化，这可能反过来影响模型架构本身的设计（比如更适配 MoE 稀疏推理、更依赖大 KV Cache 复用的架构会更受硬件厂商青睐）。

**4. 硬件多元化会削弱对单一供应商的依赖，但也带来碎片化。** 如果 OpenAI、Google（TPU）、Amazon（Trainium）、Meta（MTIA）都在把推理负载迁移到自研芯片上，中间层的推理框架（vLLM、SGLang、TensorRT-LLM 等）适配不同硬件后端的复杂度会显著上升。做基础设施或者自建推理服务的团队，需要提前关注这些框架对新硬件后端的支持进度，避免被单一硬件生态锁死。

## 六、简单验证一下"每瓦吞吐"和"延迟"两个指标的关系

对做推理优化的工程师来说，Jalapeño 强调的"用同一套架构同时拿到吞吐和延迟两头好处"这个说法值得亲自验证一下背后的逻辑，而不是照单全收。以下是一个简化的思路，帮助理解为什么"批大小（batch size）"是这场博弈的核心变量：

```python
# 简化模型：估算不同 batch size 下的吞吐与延迟权衡
# 仅用于说明原理，非真实硬件参数

def estimate_throughput_and_latency(batch_size, compute_time_per_token_ms=0.8,
                                     fixed_overhead_ms=15, memory_bw_factor=1.0):
    """
    compute_time_per_token_ms: 单 token 计算耗时（受算力限制）
    fixed_overhead_ms: 调度、通信等固定开销
    memory_bw_factor: 内存带宽越高，这个系数越接近 1（瓶颈越小）
    """
    # batch 越大，单请求分摊到的固定开销越小，但排队等待时间线性增加
    per_request_latency = fixed_overhead_ms + batch_size * compute_time_per_token_ms * memory_bw_factor
    throughput_tokens_per_sec = (batch_size * 1000) / per_request_latency
    return throughput_tokens_per_sec, per_request_latency


for bw_factor, label in [(1.0, "普通带宽 (对标 Nvidia 机架)"), (1.0 / 1.15, "高带宽 (对标 Jalapeño +15% 带宽)")]:
    print(f"\n--- {label} ---")
    for batch in [8, 32, 128, 512]:
        tput, lat = estimate_throughput_and_latency(batch, memory_bw_factor=bw_factor)
        print(f"batch={batch:4d}  吞吐≈{tput:8.1f} tokens/s  单请求延迟≈{lat:7.2f} ms")
```

这段代码不是在还原 Jalapeño 的真实内部实现（OpenAI 没有公开到这个粒度），而是用一个最简化的模型说明一个工程直觉：**内存带宽系数每提高一点，在同样的 batch size 下延迟下降的幅度会被放大**，这正是 Jalapeño 把带宽做到对手 115%、却在算力上做出妥协的原因——对推理这个内存受限的场景，带宽的边际收益比算力更高。如果你在自建推理服务，遇到"加大 batch 提吞吐、但延迟涨得比预期快"的情况，第一反应也应该是去查内存带宽利用率，而不是急着换算力更强的卡。

## 七、总结与展望

Jalapeño 的首批基准数据释放了几个明确信号：第一，OpenAI 的芯片战略已经从纸面协议走到了可验证的实测数据阶段，2026 年底的小规模部署会是检验这些数字能否在真实生产环境复现的第一个节点；第二，"训练推理分离"正在从个别厂商的实验变成行业共识，Google TPU、Amazon Trainium、Meta MTIA、OpenAI Jalapeño 共同构成了 2026 年这一波自研芯片浪潮的主力阵容，Nvidia 通用 GPU 的护城河正在被推理这个细分场景率先撬动；第三，对开发者而言，短期内这不会改变你调用 API 的方式，但中长期看，它大概率会转化为更低的推理成本和更低的响应延迟，值得在做长期技术选型和成本预测时纳入考量。

值得持续关注的后续节点包括：2026 年底的小批量部署是否会伴随 API 定价调整、SemiAnalysis 是否会发布更细粒度的第三方复测数据、以及 Broadcom 的第二代芯片流片进展。

## 参考来源

- [Jalapeño's first results show industry-leading speed and efficiency in AI inference | OpenAI 官方博客](https://openai.com/index/jalapeno-first-results/)
- [OpenAI's upcoming Jalapeño chip looks like it'll be an inference beast | The Register](https://www.theregister.com/systems/2026/08/25/openais-upcoming-jalapeno-chip-looks-like-itll-be-an-inference-beast/5292052)
- [OpenAI's Jalapeño chip is built for fast inference at scale, benchmarks show | TechCrunch](https://techcrunch.com/2026/08/25/openais-jalapeno-chip-is-built-for-fast-inference-at-scale-benchmarks-show/)
- [News: OpenAI Debuts Jalapeño AI Inference Chip, with Samsung Reportedly Supplying HBM4 | TrendForce](https://www.trendforce.com/news/2026/08/26/news-openai-debuts-jalapeno-ai-inference-chip-with-samsung-reportedly-supplying-hbm4/)
- [OpenAI reveals how Jalapeño Chip performs, wider deployment coming in 2027 | Business Today](https://www.businesstoday.in/technology/news/story/openai-reveals-how-jalapeno-chip-performs-wider-deployment-coming-in-2027-551378-2026-08-26)
- [OpenAI Jalapeño chip beats Nvidia GB300 in benchmark tests | Quartz](https://qz.com/openai-jalapeno-chip-nvidia-benchmark-results-082626)
