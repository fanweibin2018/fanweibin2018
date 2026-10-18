---
title: 'Zephon：训练任务换了 GPU 数，为什么实验结论也会跟着变'
date: 2026-10-19
slug: 'zephon-elastic-deterministic-data-loading'
author: 范伟彬
description: '拆解 Zephon 如何用固定逻辑 lane、顺序决策与并行执行分离、flush 后有限重放，让在线分词、混合和 packing 在改变 GPU 数后仍产生相同全局批次；附 CPU 可复现的断点恢复实验与适用边界。'
categories:
  - AI
  - 技术
  - 开源
tags:
  - Zephon
  - PyTorch
  - TorchTitan
  - 分布式训练
  - 数据加载
  - 可复现性
---

同一个模型、同一份数据、同一个随机种子，只因为训练任务从 16 张 GPU 恢复到 8 张，后半程看到的数据顺序就可能变了。此时两条 loss 曲线的差异，究竟来自你想验证的新数据配方，还是来自 GPU 数变化？

DatologyAI 的 Zephon 正在解决这个很少被拿到台前的问题。论文在 10 月 2 日公开后，PyTorch 官方博客于 **2026 年 10 月 16 日**介绍了它与 TorchTitan 的集成：训练可以在线完成分词、混合、过滤和序列 packing，并在数据并行规模改变、执行进程数改变或断点恢复后，继续产生相同的**全局训练批次**。

这不是让模型计算完全可复现的魔法。Zephon 只固定“模型接下来吃到什么”，浮点规约顺序、内核选择等仍可能让 loss 和权重出现细微差异。但对昂贵的消融实验来说，先排除数据流这个隐藏变量，已经很有价值。

## 问题不只是 shuffle 的随机种子

如果数据加载只是“第 1000 个样本进来，第 1000 个样本出去”，记录一个索引就能恢复。但基础模型训练的数据管道通常不是这种一进一出：

| 操作 | 输入与输出关系 | 为什么会破坏简单索引 |
| --- | --- | --- |
| 分词与切分 | 1 → n | 一篇长文会变成数量不定的多个序列 |
| 过滤 | 1 → 0 | 被丢弃的样本数取决于前面读到了什么 |
| packing | n → 1 | 多段短文本共用一个固定长度序列，内部有未填满的 bin |
| shuffle buffer | n → n | 输出顺序取决于缓冲区当时保存的内容 |
| 数据混合 | n → m | 为维持配比，需要持续记录各来源已经消耗多少 |

这类管道的下一个输出，不只取决于“当前读到哪条”，还取决于未填满的 packing bin、shuffle 缓冲区和混合计数器。论文称它为**有状态的 n-to-m 管道**。

常见的规避办法是提前把所有数据分词、混合并 pack 好，落盘成最终训练序列。它确实把问题重新变成了可索引的一进一出，但每次改过滤器、配比或模板都要重做一份数据。训练实验失败后，这份通常只读一遍的中间数据也就失去了价值；视频等模态若先展开成原始张量，体积更可能难以接受。

在线处理省掉了反复物化，却引入了新的问题：如果 16 个 rank 各自维护一份局部状态，恢复成 8 个 rank 后，原来的状态应该怎么合并？简单地按新 GPU 数重新切分样本，会立刻改变 packing 与 shuffle 的历史。

## Zephon 的核心：把“逻辑数据流”从“今天有几张卡”里拆出来

Zephon 的设计可以分成三层。

### 1. Accumulator 决定顺序，worker 只做重活

每个算子被拆成两部分：单线程 accumulator 按顺序看到记录，负责决定哪些文本装进同一个 bin、哪些样本被过滤；无状态 worker 并行完成解码、分词等昂贵计算。

worker 可以先后以任意顺序返回，系统会用编号把结果重新排回逻辑顺序。于是把分词 worker 从 4 个增加到 8 个，只是性能调节，不应该再改变训练语义。

这很像餐厅只有一位叫号员决定出餐顺序，后厨可以临时增加厨师。菜可能完成得有早有晚，但传菜口仍按号码交付；增加厨师不会让 12 号桌突然排到 8 号桌前面。

### 2. Lane 是固定的逻辑泳道，不等于 GPU rank

Zephon 不直接按当前 GPU 数切数据，而是预先把全局数据流划成固定数量的 lane。每条 lane 有独立、确定的样本序列与算子状态；GPU 数变化时，只重新分配“哪个 rank 负责哪些 lane”，lane 本身不变。

假设一开始选了 32 条 lane：

- 8 个数据并行 rank 时，每个 rank 可以负责 4 条；
- 16 个 rank 时，每个负责 2 条；
- 32 个 rank 时，每个负责 1 条。

只要训练每一步消费完整的 lane 窗口，把各 rank 的局部批次合起来，得到的全局批次就仍然相同。这里的代价也很明确：lane 数必须提前选择，并能被计划使用的数据并行规模整除。为了“以后可能扩到 16 张卡”就设置几千条 lane，会增加恢复开销，并不划算。

### 3. Checkpoint 不保存整个缓冲区，而是有限重放

直接序列化每个 packing bin 和 shuffle buffer，状态格式会与算子实现紧密耦合。Zephon 采用另一条路：周期性向管道发送 flush 标记，让有状态算子排空手里的内容，回到干净边界；checkpoint 记录进度与仍在途的输入。

恢复时，它从最近一次 flush 开始重放，重建算子状态，再丢弃训练循环已经消费的结果。因为重放窗口受到 flush 间隔约束，恢复成本不会随着已经训练的 token 数无限增长。PyTorch 文章称其实验中的 checkpoint 只有数 MiB；这是项目方在自身测试里的结果，不是所有管道的固定大小。

## WorkSource 与 Pipeline：把“吃什么”和“怎么加工”分开

Zephon 要求先描述数据集，再由 `WorkSource` 决定课程——来源如何混合、以什么顺序读取——最后用 `Pipeline` 描述解码、分词、packing、shuffle 和 batch。

这种分离不只是 API 整洁。做数据消融时，可以保持加工步骤不变，只调整混合权重；测试新的 tokenizer 时，也不必重写课程逻辑。多来源混合还提供 token/byte 采样估计，目标比例按 token 而不是文档条数计算，避免一篇长代码文件和一条短新闻都被算作“一个样本”。

README 中的典型管道大致如下：

```python
pipeline = (
    Pipeline(source)
    .tokenize(tokenizer_id="gpt2", field="text", parallelism=4)
    .pack_flat(max_length=2048, algorithm="wrap")
    .shuffle(buffer_size=1024, seed=42)
    .batch(microbatch_size=8)
)
```

每个算子可以单独设置并行度。IO 密集的读取、CPU 密集的分词和有状态 packing 不必共享一个笼统的 `num_workers`。

## 我在 CPU 上复现了什么

我把 Zephon 源码固定在提交 [`0f9230bafe6d436342201d8b4eb68414fc7d822a`](https://github.com/datologyai/zephon/tree/0f9230bafe6d436342201d8b4eb68414fc7d822a)，在 Python 3.12.14 的独立环境中安装项目，然后运行了仓库的真实集成用例：先用 4 个 worker 消费数据并保存 checkpoint，再以 8 个 worker 恢复。结果是 **1 项通过、0 失败**。

```bash
python -m pytest --run-integration -q \
  'tests/integration/test_elastic_continuation.py::test_checkpoint_resume_with_workers_change_no_batch[4-8-inline]'
```

随后我把同一行为缩成了一个只用公开管道入口的最小脚本。它使用项目测试自带的 `__fallback__` tokenizer，只为验证恢复语义，不代表生产分词配置：

```python
from zephon import Pipeline
from zephon.io import Dataset, InMemoryShard
from zephon.types import SampleRecord
from zephon.work import StaticMixtureWorkSource


def make_pipeline(max_workers: int) -> Pipeline:
    rows = [{"text": f"sample-{i}"} for i in range(96)]
    dataset = Dataset.from_dict("demo", {0: InMemoryShard(rows)})
    source = StaticMixtureWorkSource(
        [dataset], {"demo": 1.0}, chunk_size=8, seed=42,
        shuffle_shards=False, shuffle_within_shard=False,
    )
    return (
        Pipeline(source)
        .decode_text()
        .tokenize(
            tokenizer_id="__fallback__",
            field="text",
            parallelism=4,
            preserve_upstream_payload=True,
        )
        .options(
            deterministic=True,
            canonical_replicas=1,
            max_workers=max_workers,
        )
    )


def read(pipe: Pipeline, limit: int | None = None):
    output = []
    iterator = iter(pipe)
    try:
        for item in iterator:
            assert isinstance(item, SampleRecord)
            output.append(item.payload["text"])
            if limit is not None and len(output) == limit:
                return output, pipe.checkpoint()
    finally:
        iterator.close()
    return output, None


baseline, _ = read(make_pipeline(max_workers=4))
prefix, checkpoint = read(make_pipeline(max_workers=4), limit=64)
assert checkpoint is not None

resumed = make_pipeline(max_workers=8)
resumed.restore(checkpoint)
suffix, _ = read(resumed)

assert prefix + suffix == baseline
print(f"OK: {len(baseline)} samples, 4 workers -> 8 workers, exact match")
```

实际输出为：

```text
OK: 96 samples, 4 workers -> 8 workers, exact match
```

这项复现证明固定提交在这个小型内存数据集上，改变执行 worker 数后能够从 checkpoint 得到与不中断基线相同的 96 条输出。它没有验证多机网络、远端对象存储、GPU rank 重分配、超大 shuffle buffer 或项目的吞吐数字。

官方的 TorchTitan 仓库另有 CPU-only demo，会同时验证数据并行规模 `2 → 1` 和 `1 → 2`，并比较每个全局 step 的 SHA-256。完整 TorchTitan 环境依赖更多训练组件，因此我没有把未运行的 demo 结果写成自己的验证。

## 项目方的大规模结果该怎样读

PyTorch 文章描述了一组 1B 参数模型实验：先在 16 张 GPU 上训练，在第 150 step 保存 checkpoint，再分别用 8、32、64 张 GPU 恢复。普通加载器改变了后续全局批次，loss 曲线各自分开；Zephon 的逐 step 批次 SHA-256 与基线一致，曲线重合。

另一组从头训练 20B token 的实验中，项目方报告普通加载器随 GPU 数变化，使 DCLM Core v1 分数最大相差 0.82、FineWeb 评测最大相差 0.64；使用 Zephon 后，两组差距分别为 0.05 和 0.011。这些数字来自 Zephon 团队的实验，说明“GPU 拓扑可能成为消融实验的混杂变量”，但还不是第三方独立复测。

论文在文本与视觉语言管道上把 Zephon 与其他加载器比较，并报告吞吐具有竞争力。不过真正应该优先验证的不是排行榜，而是自己的管道能否持续喂饱 GPU：在线分词、图片解码和重放都在训练节点消耗 CPU、内存与存储带宽，任何一个环节都可能把节省的离线预处理成本换成 GPU 等待。

## 上手前必须接受的边界

Zephon 目前是 beta 软件，代码使用 Apache 2.0 许可。它已经支持本地与多种对象存储、Hugging Face、Parquet、MDS、LitData、Vortex 和 Lance 等来源，也提供 TorchTitan 与 Megatron-LM 参考集成，但还不该被理解成无条件替换 `DataLoader` 的稳定标准件。

至少要留意这些条件：

1. **相同的是全局批次，不是最终权重。** GPU 数改变后，浮点规约顺序和内核仍可能变化。
2. **恢复时数据配方必须固定。** 数据、tokenizer、随机种子、混合比例、上下文长度与全局 batch size 都不能悄悄改变；可以调整的是 worker 并行度等性能参数。
3. **lane 数要提前规划。** 它必须兼容可能使用的数据并行规模；选得太少限制弹性，选得过多增加状态与恢复开销。
4. **集成覆盖仍有限。** 当前 TorchTitan 适配器只支持在线原始文本路径，复杂视觉语言任务需要按文档自行验证算子与 checkpoint 行为。
5. **研究结论仍在演进。** 论文预印本提交于 10 月 2 日，并标明正在为 VLDB 2027 修订；性能与正确性主张主要来自作者团队。

## 谁现在值得试

如果团队在做昂贵的数据配比、过滤或 packing 消融，训练任务又经常被抢占、扩缩容，Zephon 切中的是一个真实成本：不必为了保持实验公平而预先物化每一种数据配方，也不必因为恢复时 GPU 数不同就放弃前半段训练。

如果数据早已离线 pack 好、集群规模固定、单次训练很短，普通可索引加载器更简单。小团队也不该为了“理论上的弹性”引入一套尚在 beta 的状态协议。

Zephon 最值得借鉴的观念，是把数据加载从辅助 IO 提升为实验语义的一部分。GPU 拓扑和 worker 数本应只是性能参数；当它们能改变模型看到的数据时，系统其实已经替你修改了实验。固定逻辑 lane、让 accumulator 掌管顺序、用有限重放恢复状态，正是在把这条边界重新画清楚。

## 原始资料

- [PyTorch：Bringing Elastically Deterministic Data Loading to TorchTitan with Zephon](https://pytorch.org/blog/bringing-elastically-deterministic-data-loading-to-torchtitan-with-zephon/)
- [Zephon 源码仓库](https://github.com/datologyai/zephon)
- [固定提交：0f9230b](https://github.com/datologyai/zephon/tree/0f9230bafe6d436342201d8b4eb68414fc7d822a)
- [Zephon 论文：Elastic Determinism for Online, Stateful Foundation Model Data Loading Pipelines](https://arxiv.org/abs/2610.03087)
- [TorchTitan + Zephon 集成与 CPU demo](https://github.com/datologyai/torchtitan-zephon/tree/main/examples/zephon)
- [Zephon User Guide](https://datologyai.github.io/zephon/)
