---
title: 'Inkling 2 Mini：把 12 层 Transformer 循环三次，换来一台 Mac 能装下的多模态模型'
date: 2026-11-21
slug: 'inkling-2-mini-looped-transformer-local-inference'
author: 范伟彬
description: 'Thinking Machines 发布约 20GB 的 Inkling 2 Mini。本文拆解它如何用共享权重反复执行中间层、为何 3.4B 激活参数不等于轻计算，并给出可复现的配置检查与本地试用边界。'
source: 'https://thinkingmachines.ai/news/inkling-2-mini/'
categories:
  - AI
  - 技术
  - 开源
  - 大模型
tags:
  - Inkling 2 Mini
  - Thinking Machines
  - 循环 Transformer
  - MoE
  - 本地推理
  - Ollama
---

# Inkling 2 Mini：把 12 层 Transformer 循环三次，换来一台 Mac 能装下的多模态模型

Thinking Machines 在 11 月 20 日发布了 Inkling 2 Mini：一个可接收文字与图片、输出文字的开放权重模型。它的检查点约 20GB，官方给出的本地门槛是 32GB 以上内存的 Apple 芯片 Mac，或约 32GB 显存的其他平台。真正值得关注的不是又多了一个“本地模型”，而是它用一套不太常见的办法拆开了“模型占多少内存”和“每个 token 做多少计算”这两个问题。

Inkling 2 Mini 只有 24 层实体权重，却把中间 12 层连续执行三遍。模型因此要完成 48 次层计算，但不需要保存 48 套不同权重。可以把它想成一家只有 24 个工位的编辑部：前 6 个工位做初审，中间 12 个工位把稿件复审三轮，最后 6 个工位定稿。编辑人数没变，稿件却经历了更多轮加工。

这也让它与 7 月发布的第一代 Inkling 有了清楚的分工：第一代是需要大型服务器承载的 975B 总参数模型；Mini 的重点则是用循环层和原生低精度权重，把多模态模型塞进一台高配个人电脑。它不是旧模型的简单量化版，而是一套为本地推理重新设计的架构。

## 24 层权重为什么能做 48 层的计算

模型的执行顺序是：

1. 第 0～5 层运行一次；
2. 第 6～17 层构成循环核心，共运行三次；
3. 第 18～23 层运行一次。

于是每个 token 经过的逻辑层数是：

```text
6 + 12 × 3 + 6 = 48
```

三次循环不是把同一输入原样再算两遍。Hugging Face 对实现的说明显示，后一次循环会读取前一次留下的消息，并用学习得到的门控决定保留当前输入还是吸收上一轮结果。也就是说，它更接近“在同一份草稿上逐轮修改”，而不是把三份互不相干的答案放在一起投票。

每层的前馈部分还是稀疏 MoE：一共有 128 个专家，每个 token 只路由到其中 8 个。官方把模型规格写成 26.4B 总参数、3.4B 激活参数；考虑循环层的额外两次执行后，每个 token 实际经历的有效激活参数约为 5.4B。

这里最容易产生一个误解：5.4B 激活参数并不代表它会像普通 5B 模型一样快。共享权重减少的是需要存储的不同参数，三轮循环仍然要做真实计算，还要为每次层访问维护缓存与短卷积状态。官方模型卡也明确提醒，单看激活参数会低估每个 token 的计算量，而不同本地运行时的速度差异目前仍很大。

| 指标 | Inkling 2 Mini 的含义 |
| --- | --- |
| 26.4B 总参数 | 磁盘与内存需要容纳的全部模型参数规模 |
| 3.4B 激活参数 | 不计重复循环时，一次层路径实际调用的参数规模 |
| 5.4B 有效激活参数 | 把循环层多执行两次计入后的官方口径 |
| 48 次层访问 | 每个 token 的真实逻辑深度，不等于保存了 48 套权重 |

## 循环层和“多写思维链”不是一回事

普通推理模型常通过输出更多思维链 token 换取计算时间；这些 token 可见、会占用上下文，也会增加解码延迟。Inkling 2 Mini 的循环发生在生成单个 token 的内部，同一 token 在中间层多走两轮，不需要先把中间步骤写出来。

这不是“免费思考”。内部计算依然要付费，只是计算从输出序列转移到了隐藏状态。Thinking Machines 还发布了一个可调整循环次数的研究版本，允许用一轮或两轮换速度，但官方表示尚未对它做深入评估。对普通使用者而言，固定三轮的主模型才是更稳妥的起点，不能把研究版本理解成已经验证好的动态算力开关。

循环还带来一个值得继续研究的边界：只看可见思维链，未必能观察模型在隐藏层里完成的全部推理。官方为此做了监控性实验，但这些结果仍来自模型发布方，不能据此推出循环模型已经解决了推理可解释性问题。

## 先做一个不下载 20GB 权重的配置检查

在决定是否下载模型前，可以只读取 Hugging Face 上不到几 KB 的 `config.json`，核对本地运行时将要面对的架构。下面脚本只使用 Python 标准库，不会下载权重：

```python
import json
from urllib.request import Request, urlopen

url = "https://huggingface.co/thinkingmachines/Inkling-2-Mini/raw/main/config.json"
req = Request(url, headers={"User-Agent": "inkling2-mini-preflight/1.0"})
with urlopen(req, timeout=30) as response:
    config = json.load(response)

text = config["text_config"]
loop = text["loop_config"]
physical = text["num_hidden_layers"]
looped = loop["core_end"] - loop["core_start"]
logical = physical + looped * (loop["num_passes"] - 1)

assert config["model_type"] == "inkling2_loop"
assert (physical, looped, loop["num_passes"], logical) == (24, 12, 3, 48)
assert (text["n_routed_experts"], text["num_experts_per_tok"]) == (128, 8)
print(f"physical={physical}, looped={looped}x{loop['num_passes']}, logical={logical}")
print(f"experts={text['num_experts_per_tok']}/{text['n_routed_experts']}, max_context={text['model_max_length']}")
```

我在 11 月 21 日用 Python 3 运行了这段代码，得到：

```text
physical=24, looped=12x3, logical=48
experts=8/128, max_context=1048576
```

这一步只能证明公开配置与文章描述一致，不能验证模型效果。它的价值是让你在下载前确认运行时必须支持 `inkling2_loop`、循环次数、专家路由和最长上下文等关键字段，而不是看到“兼容 Transformers”就默认所有旧版本都能加载。

## 在 32GB Mac 上怎样试用

Ollama 已提供约 20GB 的模型包。当前页面要求使用预览版，并给出以下启动方式：

```bash
curl -fsSL 'https://ollama.com/download/Ollama.dmg?channel=preview' -o Ollama.dmg
open Ollama.dmg
ollama run inkling-2-mini
```

启动后，可以从另一个终端调用本地接口：

```bash
curl http://localhost:11434/api/chat \
  -d '{
    "model": "inkling-2-mini",
    "messages": [{"role": "user", "content": "用中文解释这段代码可能出现的竞态条件"}]
  }'
```

这组命令来自 Ollama 当天的模型页面。当前验证环境没有 32GB 可用的 Apple 统一内存，也不应为一次文章校验下载约 20GB 权重，因此我没有把它冒充成本地生成质量实测。实际试用时还要为系统、运行时、KV Cache 和输入图片预留空间；“检查点约 20GB”不等于 20GB 内存就能稳定运行。

如果使用 Linux 或 Windows，Hugging Face 给出了 `llama.cpp` 的 IQ4_NL GGUF 与 SGLang 路径。但循环架构支持刚上线，安装命令和兼容版本仍可能快速变化，最好按模型页的当天说明选择运行时，不要套用第一代 Inkling 的旧部署脚本。

## 它适合哪些任务

Inkling 2 Mini 更适合作为本地工作模型，而不是知识库的最终裁判：

- 在代码仓库内做修改建议、测试生成和有限范围的工具调用；
- 处理不便上传到第三方服务的图片、文档与文本；
- 为 RAG、聊天机器人或视觉工作流做离线原型；
- 研究共享层、可变循环次数以及隐藏计算与可见思维链之间的关系。

官方给出的 SWE-bench、MCP Atlas、长上下文和视觉基准结果说明了它希望覆盖的方向，但大部分数字来自发布方使用特定代理框架、提示词和工具配置进行的评测。它们适合用来挑选测试任务，不应直接当成你自己的代码库、中文资料或硬件上已经复现的性能。

尤其不要把“支持 1M token 上下文”理解成 32GB Mac 可以轻松塞入 1M token。模型权重只是固定开销，KV Cache 会随上下文增长；不同精度、并发数和运行时对内存的消耗也不同。真正部署前，应从几千 token 开始记录峰值内存和生成速度，再逐步提高输入长度。

## 限制比跑分更值得先看

Thinking Machines 在模型卡里列出的限制相当具体：

- 事实回忆和知识密集问题弱于 Inkling 2 Small，而且更可能自信地给出错误答案；
- 调试代码时可能陷入长推理循环，反复检查却没有进展，因此应限制输出 token 和 Agent 回合数；
- 工具调用不如大模型可靠，可能未经确认删除或覆盖文件，也可能错误报告执行结果；
- 中文输出可能出现句子截断或中英文混杂；
- 即使把 reasoning effort 调到最低，也不能完全关闭内部推理；
- 循环模型的本地运行时支持很新，速度会随硬件和实现明显变化。

如果把它接入编码 Agent，至少应在沙箱中运行，把删除、覆盖、付款和外部发布设为必须人工确认，并保存工具调用日志。模型能装进个人电脑，降低的是部署门槛，不是操作风险。

## 值不值得现在上手

如果你有 32GB 以上的 Apple 芯片 Mac，并且需要本地多模态、编码或 Agent 原型，Inkling 2 Mini 值得进入候选清单。它最有价值的地方不是某一个榜单名次，而是提供了一份可以下载、检查和修改的循环 Transformer 实现：用更少的不同权重换取更深的逐 token 计算。

如果你的首要需求是中文知识问答、稳定的长任务执行或最低延迟，则应先做自己的小型评测，再与同体量稠密模型和其他 MoE 模型比较。官方自己也写明，Inkling 2 Mini 没有在开放权重模型已有能力之外带来“实质性跃升”。这是一条有意思的架构路线和一个实用的新选择，还不是无需验证的默认答案。

## 原始资料

- [Thinking Machines：Inkling 2 Mini 发布说明](https://thinkingmachines.ai/news/inkling-2-mini/)
- [Thinking Machines：Inkling 2 Mini 模型卡](https://thinkingmachines.ai/model-card/inkling-2-mini/)
- [Hugging Face：模型仓库与公开配置](https://huggingface.co/thinkingmachines/Inkling-2-Mini)
- [Hugging Face：循环架构与推理支持说明](https://huggingface.co/blog/inkling2mini)
- [Ollama：Inkling 2 Mini 本地运行页面](https://ollama.com/library/inkling-2-mini)
