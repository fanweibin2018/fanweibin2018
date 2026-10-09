---
title: 'EmbeddingGemma 2：一套向量，怎样同时搜索文字、图片、声音和视频'
date: 2026-10-10
slug: 'embeddinggemma-2-multimodal-local-search'
author: 范伟彬
description: '拆解 EmbeddingGemma 2 如何用模块化编码器把文本、代码、图片、视频和音频映射到同一向量空间，并通过固定模型提交的本地实测说明任务提示词、Matryoshka 截断、存储成本与使用边界。'
categories:
  - AI
  - 技术
  - 开源模型
tags:
  - EmbeddingGemma 2
  - 多模态检索
  - 向量搜索
  - RAG
  - 本地 AI
---

在电脑里输入“海边日落时的浪声”，同时找出一张照片、一段视频和一份录音，通常要串联文字、图像和音频模型。每个模型都有自己的向量坐标系，文字向量不能直接拿去和声音向量比较，系统还要处理多套索引、模型和相似度阈值。

Google DeepMind 在 **2026 年 10 月 6 日**发布的 [EmbeddingGemma 2](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/) 尝试把这件事变成一套模型：文本、代码、图片、视频和音频最终都进入同一个 768 维向量空间。它不生成答案，而是回答一个更基础的问题：**这些内容在语义上有多接近？**

模型权重已经在 [Hugging Face](https://huggingface.co/google/embeddinggemma-2) 开放，采用 Apache 2.0 许可证。它的价值不只是“又多支持了几种输入”，而是让本地搜索、代码检索和多模态 RAG 可以共享一份索引协议。

## 向量空间像一座统一编号的仓库

Embedding 模型会把内容变成一串数字。可以把它想成给仓库里的每件物品分配一个坐标：关于极光的提问和极光说明应该靠得近，数据库文档和面包配方应该离得远。

以前分别使用文字、图片和音频模型，像是三个仓库各自编号。文字仓库的“货架 20”与图片仓库的“货架 20”没有关系，跨模态搜索还需要额外的对齐模型。

EmbeddingGemma 2 仍然用不同入口处理不同数据，但把结果投射到同一个空间：

| 输入 | 负责处理的部分 | 累计参数量 |
| --- | --- | ---: |
| 文本、代码 | 130M 主干与 140M embedding 层 | 270M |
| 图片、视觉文档、视频帧 | 再加载 170M 视觉编码器 | 440M |
| 原始音频 | 再加载 300M 音频编码器 | 570M |
| 全部模态 | 文本、视觉、音频都加载 | 740M |

专用编码器负责把像素、声音或文字转换成模型可处理的表示，随后共享主干与投影层把它们放到统一的 768 维坐标系。于是文字查询可以直接与图片或录音计算余弦相似度，不必先把图片生成文字描述，也不必先把录音转写成文本。

这并不表示模型“理解”了一切，更不表示不同模态的检索精度完全相同。统一的是输出坐标系，不是任务难度。

## 查询和资料不是同一种句子

模型卡特别强调了任务提示词。文字查询和待检索文档虽然都是字符串，但角色不同：

- 查询表达“我想找什么”；
- 文档表达“我这里有什么”；
- 分类、聚类和语义相似度又是另外的目标。

使用 `sentence-transformers` 时，可以分别传入 `SearchQuery` 和 `Document`。这些提示只用于文本；图片、视频和音频不需要加文字前缀。真实文档如果有标题，官方建议整理成 `title: ... | text: ...`，因为标题本身也是重要的检索信号。

如果把查询和文档全部用同一种方式编码，程序仍能得到向量，但会丢掉训练时提供的任务信息。模型卡明确指出，省略提示仍可工作，但检索精度会下降；具体下降多少需要用自己的数据测量。

## 768 维不一定要全部保存

模型使用了 Matryoshka Representation Learning。这个名字来自俄罗斯套娃：768 维向量的前 512、256 或 128 维被训练成仍然有用的较小表示，而不是随便删除尾部数字。

假设保存 100 万条 `float32` 向量，不计算向量数据库索引和元数据，仅原始向量大约占用：

| 维度 | 原始向量空间 | 相对 768 维 |
| ---: | ---: | ---: |
| 768 | 2.861 GiB | 1× |
| 512 | 1.907 GiB | 1.5× 压缩 |
| 256 | 0.954 GiB | 3× 压缩 |
| 128 | 0.477 GiB | 6× 压缩 |

官方模型卡报告，在其评测条件下，256 维在多语言文本、代码和部分多模态任务上保留了大部分 768 维效果；128 维的下降更明显，尤其不适合直接假设所有多模态任务都能无损使用。厂商评测只能帮助确定试验起点，最终维度仍要用自己的查询和资料集测召回率。

还有一条硬规则：**查询和资料必须采用同一维度，并在截断后重新归一化。** 不能拿 256 维查询直接搜索 768 维索引。

## 固定模型提交做一次文本检索

我固定了模型提交 `914f7f89142e33e77833254d9c9b90c3cef7303b`，在 Python 3.12、`sentence-transformers 6.1.0`、`transformers 5.19.0` 和 CPU 环境中运行下面的代码。测试关闭视觉与音频编码器，实际加载参数为 **271,002,624**。

```python
from sentence_transformers import SentenceTransformer

MODEL_ID = "google/embeddinggemma-2"
REVISION = "914f7f89142e33e77833254d9c9b90c3cef7303b"

documents = [
    "title: aurora | text: The northern lights are caused by charged particles from the sun.",
    "title: database | text: PostgreSQL stores rows in tables and supports transactional queries.",
    "title: bread | text: Yeast produces carbon dioxide that makes bread dough rise.",
]
query = "What causes the northern lights?"

model = SentenceTransformer(
    MODEL_ID,
    revision=REVISION,
    config_kwargs={"vision_config": None, "audio_config": None},
)

for dim in (768, 256, 128):
    query_vector = model.encode(
        query,
        prompt_name="SearchQuery",
        truncate_dim=dim,
        normalize_embeddings=True,
    )
    document_vectors = model.encode(
        documents,
        prompt_name="Document",
        truncate_dim=dim,
        normalize_embeddings=True,
    )
    scores = model.similarity(query_vector, document_vectors)[0].tolist()
    rank = sorted(range(len(scores)), key=scores.__getitem__, reverse=True)
    print(dim, [round(score, 6) for score in scores], rank)
```

输出如下：

```text
768 [0.852262, 0.57589, 0.633743] [0, 2, 1]
256 [0.871236, 0.599914, 0.628533] [0, 2, 1]
128 [0.900415, 0.709261, 0.746023] [0, 2, 1]
```

三个维度都把极光文档排在第一位。不同维度的绝对相似度不能直接互相比较；这次小测试只能证明接口可运行，并说明截断后排序在这组三条资料上没有变化，不能证明 128 维在真实数据集上与 768 维等价。

本次文本模式首次运行仍下载了当前约 **1.49 GB** 的统一 `safetensors` 检查点，尽管运行时只加载约 271M 参数。模块化加载能减少运行时模型规模，并不保证当前每种工具链都能按模态分别下载权重；磁盘、内存和启动时间要分开测量。

## 哪些场景值得尝试

### 本地代码搜索

自然语言查询、函数说明和源代码可以进入同一文本空间。官方报告的 MTEB Code 分数从上一代的 68.76 提升到 78.68，但这是 Google 在模型卡所列条件下的结果，不是我对大型代码库的独立验证。实际使用仍要检查语言、仓库规模、代码切块和查询类型。

### 私有媒体资料库

商品图片、操作视频、客服录音和文字说明可以建立同一套检索入口。例如外贸团队可以用一句产品描述寻找图片和视频素材，用语音备注寻找对应的商品资料。数据留在本地的前提是编码、索引、检索和后续生成整个链路都在本地，不能只因为 embedding 模型在本地就宣称系统已经完全私密。

### 多模态 RAG 的召回层

EmbeddingGemma 2 负责从资料库找出候选内容，生成模型负责阅读候选并回答。它不会检查事实，也不会阻止错误资料进入上下文。检索分数、权限过滤、时间范围和结构化条件仍应由应用层处理。

## 上手前要记住的边界

- **8,192 token 是共同预算。** 文字、图片、视频帧和音频混合输入会一起占用上下文，长视频仍需要分段和时间戳索引。
- **向量相似不等于精确匹配。** 商品编号、日期、金额、权限和状态应继续使用数据库过滤，不能全部交给语义检索。
- **截断维度要用自己的数据验证。** 256 维省空间，不代表对每种语言、声音或图片类别都保持同样召回率。
- **共享空间也会携带偏差。** 模型卡明确指出 embedding 的风险会在下游分类、检索和排序中体现，生产使用需要做公平性和内容过滤测试。
- **许可不只看 SPDX 标签。** 权重标注为 Apache 2.0，但模型卡同时要求遵守 Gemma Prohibited Use Policy，部署前仍应阅读完整条款。

EmbeddingGemma 2 最适合解决的不是“让模型再多看一种文件”，而是把多种内容的第一步筛选统一起来。对需要在本地搜索代码、商品素材、录音和视频的应用，这能明显减少模型与索引的组合数量；至于它是否真的比多套专用模型更准、更省，还需要拿自己的数据集回答。

## 原始资料

- [EmbeddingGemma 2 发布说明](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/)
- [EmbeddingGemma 2 模型卡](https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2)
- [Google 开发者指南](https://developers.googleblog.com/embeddinggemma-2-the-developer-guide/)
- [Hugging Face 模型与固定提交](https://huggingface.co/google/embeddinggemma-2/tree/914f7f89142e33e77833254d9c9b90c3cef7303b)

