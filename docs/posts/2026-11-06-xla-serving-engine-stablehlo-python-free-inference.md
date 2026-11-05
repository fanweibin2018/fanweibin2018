---
title: 'XLA Serving Engine 开源：Python 训练的模型，怎样交给 C++ 直接服务'
date: 2026-11-06
slug: 'xla-serving-engine-stablehlo-python-free-inference'
author: 范伟彬
description: 'Google 开源的 XLA Serving Engine 把 JAX 或 PyTorch 模型导出为 StableHLO、Orbax 权重和服务策略，再由 C++ 运行时直接执行。本文拆解模型包、动态批处理与 PJRT 路径，并实测 0.0.13 的 CPU 导出和推理。'
source: 'https://opensource.googleblog.com/2026/11/supercharging-xla-inference-xla-serving-engine.html'
categories:
  - AI
  - 技术
  - 开源
tags:
  - XLA Serving Engine
  - OpenXLA
  - StableHLO
  - JAX
  - 模型推理
---

# XLA Serving Engine 开源：Python 训练的模型，怎样交给 C++ 直接服务

Google 在 11 月 5 日开源了 [XLA Serving Engine（XSE）](https://opensource.googleblog.com/2026/11/supercharging-xla-inference-xla-serving-engine.html)。它做的事很具体：模型仍可用 JAX、Flax、Keras 3，或通过 torchax 用 PyTorch 编写和训练；发布时把计算图、权重与服务策略打成一个模型包；线上请求则由 C++ 运行时接收、组批并交给 XLA 执行，关键请求路径不需要 Python 解释器。

这不是“把 Python 重写成 C++”的代码迁移工具。模型作者依然在 Python 中工作，XSE 把两端连接起来的桥梁是 StableHLO、Orbax 和 PJRT。它现在最值得关注的地方，也不是厂商给出的吞吐数字，而是把过去经常散落在导出脚本、服务启动参数和平台专用代码里的约定，收进了一个可以检查、版本化和部署的模型包。

它也不是新的大模型推理引擎。官方把推荐系统、排序模型、视觉或多模态编码器、Encoder 类语言模型，以及固定短步数解码列为主要场景；对于长上下文、自回归生成和分页 KV Cache，项目明确建议继续使用 vLLM 或 SGLang。

## Python 服务慢在哪里

假设一个推荐模型每次只给一个候选商品打分。真正的模型计算可能很短，服务却还要依次完成：解析 gRPC 请求、校验张量、查 embedding、等待更多请求组成批次、调用设备、拆分结果并序列化返回。

如果这些工作都放在一个 Python 进程里，短请求的固定开销容易盖过模型计算；增加线程又会碰到 GIL。常见补救是启动多个 Python 进程，但每个进程可能各自加载权重或 embedding 表，还要增加进程间通信和设备所有权协调。

可以把它想成餐厅出餐。模型计算是炒菜，Python 服务还兼任接单、拼桌、传菜和结账。客人一次点一桌菜时，炒菜占大头；客人不断单点一道菜时，接单和传菜就可能成为瓶颈。XSE 没有改变菜谱，而是把前台和传菜改成单个多线程 C++ 流水线，并把“最多等多久再拼桌”写进随模型发布的配置。

## 一个请求实际经过什么

XSE 的路径可以拆成四层：

1. **Python 导出模型。** `jax.export` 把函数降低为 StableHLO，Orbax 保存参数；导出时还声明输入名称、类型、动态批维度和目标平台。
2. **模型包保存契约。** `manifest.pb` 索引函数和权重，`orchestration.pb` 描述预处理、模型与后处理的调用顺序，批处理和预热请求也随包保存。
3. **C++ 运行时加载。** 运行时根据 CPU、CUDA 或 TPU 选择对应 lowering，通过 PJRT/IFRT 编译和执行；也可加载预先编译好的可执行文件。
4. **gRPC 层处理请求。** 服务端把短时间内到达的请求沿批维度合并，执行一次模型调用，再把结果按原请求拆回去。

这里的 StableHLO 不是模型权重，而是一个相对稳定的张量计算中间表示。它像一份与具体灶具分离的菜谱：前端框架负责写出菜谱，XLA 再针对 CPU、GPU 或 TPU 生成可执行代码。Orbax checkpoint 则保存真正的参数。二者分开后，同一个模型包可以包含多种平台的 lowering，但运行时仍会在目标机器上做 JIT 编译。

## 模型包不只是“一个图加一份权重”

一个最小模型包大致包含：

```text
classifier/
├── manifest.pb
├── orchestration.pb
├── checkpoint/
├── history.txtpb
└── orbax_model_version.txt
```

`manifest.pb` 是索引，指出包里有哪些 StableHLO 函数、权重和补充文件；`checkpoint/` 是 Orbax 参数；`orchestration.pb` 把一个对外签名映射到预处理、模型与后处理步骤；最后写入的 `orbax_model_version.txt` 表示该版本已经完整落盘。`history.txtpb` 记录导出和后续修改，便于追查批处理参数何时被改过。

这套设计的价值在于，服务策略能随模型版本一起走。例如同一个包可以提供 `score` 与 `embed` 两个签名；`score` 开启动态批处理，`embed` 不开启。部署者不必再猜“这个模型应该用多大 batch、输入字段到底叫什么”。

但模型包也不是任意硬件都能直接运行的万能二进制。导出时没有生成某个平台的 lowering，加载到该平台就会失败；保留 StableHLO 时，目标机器还要支付 JIT 编译和首次请求延迟。要彻底避开线上编译，需要提前编译，而且当前 AOT 路径要求具体形状，并建议每个平台分别导出。

## 动态批处理为什么既能加速，也会拖慢

XSE 把批处理配置写在 `ServingConfig` 中。比如允许批次为 8 或 32、最多等待 2 毫秒：5 条请求会补齐到 8，一阵突发的 20 条单行请求可以合并并补齐到 32。

这样做减少了设备调用次数，却引入了两个成本：等待窗口和填充计算。如果客户端本来已经一次发送 128 条样本，服务端再等一轮并重新组批，尾延迟可能反而变差。官方基准也显示，在大请求、较低并发下关闭服务端批处理更快。

所以批处理不是一个“开启即加速”的布尔开关，至少要同时观察：

- 客户端一次带多少样本；
- 请求到达是否足够密集；
- 允许的 p99 延迟；
- 补齐到允许批次后浪费多少计算；
- 预处理应该逐请求执行，还是和模型一起组批。

XSE 的优势是把这些选择做成模型包里的显式契约，并允许用 `xsm-cli update` 修改，不必重新导出计算图。

## 实测 0.0.13：多平台导出与 CPU 执行通过

我使用 11 月 3 日发布的 [XSE 0.0.13](https://github.com/openxla/xla-serving/releases/tag/v0.0.13)，在 Linux x86-64、Python 3.12.14 的 CPU 环境复现官方小型分类器。安装的是 PyPI 正式包：

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install \
  xla-saved-model==0.0.13 \
  xla-saved-model-runner==0.0.13 \
  flax grpcio
```

模型主体与官方快速开始一致，关键导出部分如下：

```python
xla_saved_model.save(
    xla_saved_model.JaxModel(
        apply_fn_bundle=xla_saved_model.ApplyFnBundle(
            apply_fn=apply_fn,
            input_polymorphic_shapes={"features": "b, _"},
            jax_export_kwargs={"platforms": ["cpu", "cuda", "tpu"]},
        ),
        params=params,
    ),
    export_path="/tmp/classifier",
    serving_configs=[
        xla_saved_model.ServingConfig(
            serving_signature="serving_default",
            input_signature={
                "features": jax.ShapeDtypeStruct(("b", 16), jnp.float32)
            },
        )
    ],
)
```

这里的 `b` 是符号批维度，因此同一份函数可以接收不同批大小。导出后，`xsm-cli show` 报告模型包清单为 7 KiB，其中内嵌 StableHLO 为 3,742 字节、参数共 4 组，lowering 平台为 `cpu,cuda,tpu`。随后用 `xla-saved-model-runner` 加载该包，C++ Interpreter 在 CPU 上完成 JIT，输入 `(3, 16)` 得到 `(3, 1)` 输出：

```text
signatures: ['serving_default']
shape: (3, 1)
scores: [0.4741997, 0.3876366, 0.3182795]
```

这次复现验证了“Python 导出—检查模型包—C++ Interpreter 执行”这条核心路径。当前环境没有 Docker，因此没有运行预构建 gRPC 服务镜像，也没有验证 GPU、TPU 或多机服务；上面的通过结果不能扩展成完整生产链路已经验证。

## 官方性能数字应该怎样读

项目公布的 DLRM-DCNv2 基准使用单个 Cloud TPU v6e 芯片，给服务端固定 8 个主机 CPU 核，在同一模型、权重、协议与硬件下比较 XSE 和几种 Python 服务。以 `p99 ≤ 20 ms` 为约束：

| 每请求样本数 | XSE | 最佳 Python | 差距 |
|---:|---:|---:|---:|
| 1 | 30,100 样本/秒 | 6,100 样本/秒 | 5.0× |
| 16 | 83,400 样本/秒 | 42,400 样本/秒 | 2.0× |
| 128 | 92,400 样本/秒 | 81,000 样本/秒 | 1.14× |

每个点取三次 30 秒运行的中位数，基准代码已公开。结果很符合机制预期：请求越小，解析、组批、GIL 和进程协调所占比例越高，C++ 路径收益越明显；客户端已经大批量提交时，差距大幅缩小。

但这些仍是项目方在单一 TPU 机型、特定推荐模型与自选 Python 实现上的结果，不是独立验证，也不能推出任意视觉、文本或 GPU 服务都会提升 2 到 5 倍。尤其是 Python 3.13/3.14 的 free-threaded 构建、自定义 C++ 算子和不同缓存局部性都没有覆盖。更合理的用法是先复用公开压测框架，把自己的请求大小、硬件和尾延迟目标代进去，而不是直接把倍数写进容量规划。

## 哪些团队值得试，哪些不必急

如果已经用 JAX 训练推荐、排序、视觉编码或小型固定形状模型，并且线上大量请求很短、并发高，XSE 值得做一次影子流量对比。它还适合不希望生产容器携带 Python 环境，或希望在 C++ 服务里直接嵌入推理运行时的团队。

如果当前 Python 服务的吞吐和尾延迟都满足目标，请求本身已经充分组批，迁移收益可能不够抵消新的构建、模型包和 C++ 运维链路。长文本生成则不应因为“C++ 更快”就迁移；缺少连续批处理和分页 KV Cache，才是它与专用 LLM 引擎的根本差异。

上手前还要注意这些边界：

1. **版本仍早。** 当前正式版只有 0.0.13，Python 包把开发状态标为 Beta；模型包兼容性与运维经验都需要继续观察。
2. **二进制平台有限。** 预构建原生 wheel 面向 Linux x86-64 和 Python 3.12—3.14；aarch64 需要从源码构建，冷构建会编译 XLA，成本不低。
3. **“无 Python”只指请求路径。** 导出仍在 Python 侧完成，客户端也可以是 Python；它解决的是服务运行时，不是把整个机器学习栈变成 C++。
4. **JIT 与 AOT 是两套取舍。** 保留 StableHLO 更便携，但启动时会编译；AOT 降低冷启动，却要求固定形状、平台与拓扑管理。
5. **服务能力还没有全部打通。** 当前独立 gRPC 服务尚未暴露 AOT 的拓扑标签和禁止 JIT 回退选项，部分高级能力仍主要面向直接嵌入 C++ Interpreter 的用户。
6. **数据处理不会自动消失。** 特征查表、分词和后处理仍要明确放在主机、TensorFlow 阶段或 C++ CompositeModel 中；只替换模型执行器不能自动修复慢预处理。

XSE 真正带来的新东西，是让 StableHLO 不只停留在“框架到编译器”的交换格式，而是进一步成为可部署服务包的计算核心。对短请求、高并发、JAX 原生的线上模型，它提供了一条不用维护 Python 多进程服务的现实路径；对普通低流量 API 和长文本大模型，它并不是更时髦的默认答案。

## 原始资料

- [Google Open Source Blog：XLA Serving Engine 开源公告](https://opensource.googleblog.com/2026/11/supercharging-xla-inference-xla-serving-engine.html)
- [OpenXLA 官方仓库](https://github.com/openxla/xla-serving)
- [XSE 0.0.13 发布与二进制包](https://github.com/openxla/xla-serving/releases/tag/v0.0.13)
- [0.0.13 固定版本快速开始](https://github.com/openxla/xla-serving/blob/v0.0.13/docs/quickstart.md)
- [模型包、签名、编排和平台概念](https://github.com/openxla/xla-serving/blob/v0.0.13/docs/concepts.md)
- [动态批处理配置](https://github.com/openxla/xla-serving/blob/v0.0.13/docs/guides/batching.md)
- [AOT 编译的要求与限制](https://github.com/openxla/xla-serving/blob/v0.0.13/docs/guides/aot.md)
- [DLRM 服务基准、方法与原始结果](https://github.com/openxla/xla-serving/blob/v0.0.13/docs/benchmarks/dlrm_serving.md)
