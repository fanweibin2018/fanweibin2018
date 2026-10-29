---
title: 'Mistral Large 4 开放权重：49B 激活参数为什么仍不是“49B 模型”'
date: 2026-10-30
slug: 'mistral-large-4-dual-sparsity-deployment-boundary'
author: 范伟彬
description: 'Mistral Large 4 的开放权重已经发布。本文拆解 MoE 与稀疏注意力这两层稀疏机制，实测官方配置文件，并从权重体积、上下文、推理框架与许可证说明它适合谁部署。'
source: 'https://huggingface.co/blog/mistral-large4'
categories:
  - AI
  - 技术
  - 开源
tags:
  - Mistral Large 4
  - MoE
  - vLLM
  - 稀疏注意力
  - 开放权重
---

# Mistral Large 4 开放权重：49B 激活参数为什么仍不是“49B 模型”

Mistral Large 4 的权重在 **2026 年 10 月 29 日**正式公开。它不是当天才第一次亮相：Mistral 早在 10 月 6 日就开放了 API 预览，并预告月底发布权重。现在真正发生的变化，是 1 万亿参数的模型文件、架构配置和推理支持已经能被下载、检查与自行部署。

最容易误读的数字是“每个 Token 激活 49B 参数”。这不等于它能像 49B 稠密模型一样装进显存。官方 FP8 检查点约 **1.06 TB**，混合精度的 NVFP4 版本也约 **610 GB**；当前 vLLM 配方验证的 FP8 部署需要 8 张 GB300/B300 或 16 张 H200，NVFP4 则可用 4 张 Blackwell GPU。它把每一步计算做稀疏了，却没有让其余权重凭空消失。

这一区别决定了它更像面向数据中心的开放权重基础设施，而不是新一代“家用本地大模型”。

## 从 10 月 6 日预览到 10 月 29 日权重落地

10 月 6 日的公告主要提供 API 预览和厂商基准成绩，模型结构只披露到约 1T 总参数、52B 激活参数的层面。10 月 29 日公开的模型卡进一步解释了口径：语言模型每个 Token 激活约 **49B** 参数；算上嵌入层和输出层则是 **52B**，所以仓库名使用 `1T-A52B`。

同时公开的还有两个官方检查点：FP8，以及将路由专家压到 NVFP4、其余重要部分保留较高精度的混合版本。Hugging Face、Transformers、vLLM 和 llama.cpp 给出了首日适配，读者终于可以把发布时的架构说法与真实配置对上。

至于“代码、安全、视觉理解比某模型高多少”之类的成绩，仍应谨慎阅读。多数数字来自 Mistral、Hugging Face 或合作推理团队的测试；它们能说明官方怎样定位模型，不能代替在自己的任务、提示词、工具链和成本约束下复测。

## 第一层稀疏：128 位专家，每次只请 4 位

Mistral Large 4 的文本解码器共有 72 层。第一层使用普通的稠密前馈网络，后面 71 层都是 Mixture-of-Experts（MoE）：每层有 128 个可路由专家，路由器为当前 Token 选择其中 4 个，另有 1 个共享专家始终参与计算。

可以把它想成一栋有 128 个专科诊室的医院。每位患者只会去 4 个最相关的诊室，再经过一个所有人都要看的综合门诊，所以一次问诊的计算量远小于同时调用 128 位医生。

但医院仍要保留全部诊室。下一枚 Token 可能被路由到另一组专家，推理服务必须能访问所有专家权重。**激活参数描述的是一次前向计算用了多少，不是模型文件只需要保存多少。** 这就是 49B 激活参数与 610 GB 至 1.06 TB 检查点并不矛盾的原因。

MoE 也不是免费的加速。不同 GPU 持有不同专家时，Token 需要跨卡交换；负载不均还会让少数专家成为瓶颈。因此高效部署不仅需要张量并行，还要处理专家并行、通信、路由和批处理。

## 第二层稀疏：不是缩小专家，而是少翻上下文

模型的另一层稀疏发生在注意力里，与 MoE 是两件不同的事。

Mistral Large 4 组合了 Multi-head Latent Attention（MLA）和 DeepSeek Sparse Attention（DSA）。MLA 先把 Key/Value 状态压进较小的潜在表示；DSA 再为每个查询从历史中挑出最多 **2,048 个位置**参与注意力，而不是让每层都遍历全部长上下文。

如果 MoE 像“只找几位专家”，稀疏注意力就像“先由索引员从百万页档案中挑出最相关的 2,048 页，再让专家阅读”。前者减少前馈网络计算，后者减少长上下文注意力计算，不能把二者合并成一个模糊的“稀疏所以便宜”。

公开配置还显示，模型会让部分后层复用第 35 层的 KV 状态。这样做继续压低 KV Cache 的增长速度。1M 上下文因此在架构上可声明，并不代表任意硬件都能以高并发、低延迟跑满 1M。

vLLM 的公开配方给出的边界更务实：检查点声明 **1,048,576 Token** 上限，但配方只验证到 **256K**，示例也把 `--max-model-len` 设为 256K。上线时还要为 KV Cache、激活值、批处理和并发请求留显存，不能只按权重能否装下做决定。

## 实测配置：不用下载 1 TB 权重，也能核对结构

为了区分宣传口径与实际文件，我固定到本次检查时 Hugging Face 仓库的提交 `f12dabdc0c1e99e7f7924461a6f308859b05af4d`，只下载 2.9 KB 的 `params.json`，没有下载模型权重。

下面的脚本会读取官方配置，验证层数、专家路由、DSA 上限、上下文和跨层 KV 复用。它只做结构检查，**不代表已经运行模型或复现性能**。

```bash
REV=f12dabdc0c1e99e7f7924461a6f308859b05af4d

curl -fL \
  "https://huggingface.co/mistralai/Mistral-Large-4-1T-A52B/resolve/${REV}/params.json" \
  -o params.json

python - params.json <<'PY'
import json
import sys

p = json.load(open(sys.argv[1], encoding="utf-8"))
moe = p["moe"]
sources = [int(x) for x in p["kv_sharing"]["source_layers_str"].split(",")]
consumers = [i for i, source in enumerate(sources) if i != source]

assert len(sources) == p["n_layers"]
print("decoder layers:", p["n_layers"])
print("MoE layers:", p["n_layers"] - moe["first_k_dense_replace"])
print("routed experts:", f'{moe["num_experts_per_tok"]}/{moe["num_experts"]}')
print("shared experts:", moe["num_shared_experts"])
print("DSA top-k:", p["dsa"]["topk"])
print("context tokens:", p["max_position_embeddings"])
print("KV-sharing consumers:", consumers)
print("draft layers:", p["mtp"]["n_layers"])
PY
```

我实际运行得到：72 个解码层、71 个 MoE 层、每个 Token 路由到 128 个专家中的 4 个并额外调用 1 个共享专家；DSA 的 `topk` 是 2,048；最大位置数为 1,048,576；第 39、43、47、51、55、59、63、67、71 层复用第 35 层的 KV；内置草稿模型有 3 层。

这段检查有两个用途：一是快速发现模型卡、推理框架和实际配置是否口径一致；二是在接入新模型前，把决定显存和内核支持的结构参数变成可审查的事实。它不能回答模型质量、吞吐或真实 1M 上下文效果，这些仍需要完整硬件实测。

## DSpark：小草稿先猜，主模型再验

检查点还内置一个 3 层的 DSpark 草稿器，用于推测解码。普通自回归生成每一步都要让大模型产出一个 Token；推测解码会先让较小的草稿器提出一组候选，再由主模型并行验证，接受正确前缀，错误处则回到主模型结果。

这像让助理先把下一句话的几个词写在便签上，主笔一次审完。猜得准时能少做多次昂贵的串行解码；猜不准时仍要付出草稿和验证成本。vLLM 公布了其 GB300 与 MI350 测试中的加速结果，但这些是特定检查点、批量、上下文与硬件下的工程测试，不应直接外推到其他部署。

## 能下载不等于现在就能低成本部署

当前需要同时注意四条边界。

第一是硬件。vLLM 配方列出的 FP8 检查点约 1.06 TB，在 8 张 GB300/B300 上每卡仅权重就约占 128 GiB；H200 因单卡容量较小，配方使用 16 卡。NVFP4 检查点约 610 GB，8 卡时每卡约 76 GiB，并可在一组 4 卡 Blackwell 系统上运行。这里还没有计入充足的 KV Cache、运行时缓冲和并发余量。

第二是软件成熟度。截至 10 月 29 日，vLLM 的模型配方明确写着：正式版和 nightly wheel 都还没有包含这套支持，推荐使用专用的 `vllm/vllm-openai:mistral-large-4` 镜像。模型卡上的通用 `pip install vllm` 示例很简洁，但真正部署前应以模型专用配方为准，而不是假定任意已安装版本都能启动。

第三是上下文。1M 是配置上限，不是免费容量。长上下文会增加预填充时间、KV 占用和请求排队；若业务只需要 32K 或 128K，主动降低上限通常能换来更好的并发与故障余量。

第四是许可证。它使用 Mistral Ecosystem Open-Weight License，而不是常见的 Apache-2.0。许可证允许使用、复制、修改和分发，但如果许可方或其关联方经营 Model-as-a-Service 业务，商业使用需要另行取得 Mistral 的商业许可；内部使用与 Mistral 官方产品有例外。计划对外售卖托管推理前，应让法务按实际业务模式审查原文。

## 谁值得上手，谁更适合先用 API

如果你有 4 至 8 张新一代高显存 GPU，需要在私有环境处理代码、文档、图像或安全数据，并且愿意针对 vLLM 的专用镜像做验证，那么这次开放权重有实际价值：模型结构、精度方案、推理栈和使用策略都能由自己控制。

如果目标只是评估回答质量，先用 Mistral API 或托管推理更合理。它能把“模型是否适合任务”与“团队是否能维护 600 GB 至 1 TB 级推理集群”分开判断。

如果只有单张消费级 GPU，也不应被“49B 激活”误导。社区量化会降低磁盘和内存门槛，但模型仍要保存大量不同时刻可能被调用的专家权重；极限量化、CPU 卸载和低速本地运行也不能代表数据中心检查点的质量与吞吐。

Mistral Large 4 最值得关注的地方，不是又一个更大的参数数字，而是它把 MoE 路由、稀疏长上下文、跨层 KV 复用和内置草稿模型放进同一套开放权重系统。它让研究者和基础设施团队有了新的可检查对象，也把一个事实写得很清楚：**计算稀疏不等于存储免费，架构上支持不等于部署上轻松。**

## 原始资料

- [Hugging Face：Mistral Large 4 权重、架构与推理支持](https://huggingface.co/blog/mistral-large4)
- [Mistral Large 4 官方模型卡与使用说明](https://huggingface.co/mistralai/Mistral-Large-4-1T-A52B)
- [Mistral：10 月 6 日 API 预览公告](https://mistral.ai/news/mistral-large-4/)
- [vLLM：Mistral Large 4 首日推理支持](https://vllm.ai/blog/2026-10-29-mistral-large-4)
- [vLLM 模型配方：检查点、硬件与验证边界](https://recipes.vllm.ai/mistralai/Mistral-Large-4-1T-A52B)
- [固定版本的官方 `params.json`](https://huggingface.co/mistralai/Mistral-Large-4-1T-A52B/blob/f12dabdc0c1e99e7f7924461a6f308859b05af4d/params.json)
- [Mistral Ecosystem Open-Weight License](https://huggingface.co/mistralai/Mistral-Large-4-1T-A52B/blob/main/LICENSE)
