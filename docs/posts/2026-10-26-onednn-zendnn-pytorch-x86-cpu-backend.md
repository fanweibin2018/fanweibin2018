---
title: 'oneDNN 接入 ZenDNN：AMD 与 Intel 统一 PyTorch CPU 路径，为什么还不是自动提速'
date: 2026-10-26
slug: 'onednn-zendnn-pytorch-x86-cpu-backend'
author: 范伟彬
description: 'AMD 与 Intel 正把 PyTorch 的 x86 CPU 优化收拢到 oneDNN。本文结合刚合入的源码，解释统一后端如何按厂商与指令集选择内核，实测 ZenDNN 构建入口，并说明默认关闭、算子覆盖和硬件验证边界。'
categories:
  - AI
  - 技术
  - 开源
tags:
  - oneDNN
  - ZenDNN
  - PyTorch
  - AMD
  - Intel
  - CPU 推理
---

在同一套 PyTorch 代码里，换一台 Intel 服务器或 AMD 服务器，理想情况应该只是底层自动选择不同的高性能内核，而不是应用团队维护两套插件、环境变量和发布包。

AMD 与 Intel 在 **2026 年 10 月 20 日**宣布，双方将把面向 PyTorch 的 x86 CPU 优化收拢到 oneDNN：oneDNN 成为共同的开源加速路径，AMD 则把 ZenDNN 优化接入其中。几乎同时，oneDNN 主分支合入了 ZenDNN 构建与分发支持。

这项变化值得关注，但目前更准确的说法是：**统一路径已经出现，统一交付仍在进行。** 当前源码中的 ZenDNN 后端默认关闭，只面向 Linux x86_64，并且运行时只会在满足条件的 AMD CPU 上接管部分算子。普通 PyTorch 用户还不能把这次公告理解成“现有 wheel 从今天起在所有 AMD 机器上自动变快”。

## 过去为什么会有两条路

PyTorch 上层看到的是 `Linear`、`matmul`、卷积等算子，CPU 真正执行时却需要处理指令集、数据类型、张量布局、线程运行时与融合方式。oneDNN 就是这些底层实现的候选库之一，它把一次计算表示成 primitive，再根据硬件和输入条件选择具体内核。

ZenDNN 解决的是同一层问题，但重点放在 AMD Zen CPU。它提供针对矩阵乘、注意力、MoE 分组矩阵乘等场景的低开销接口和 AMD 平台调优。过去，框架若想同时利用两边的优化，往往需要分别接入 oneDNN 和 ZenDNN，或者依赖额外的 PyTorch 插件。

新的结构可以简化为：

```text
PyTorch 算子
    ↓
oneDNN primitive 与统一调度
    ↓
检查 CPU 厂商、指令集、数据类型、形状和后处理
    ├─ 条件满足：ZenDNN 内核
    └─ 条件不满足：oneDNN 现有 JIT、BRGEMM、GEMM 或参考实现
```

这里统一的不是一份对所有 CPU 都相同的机器码，而是**选择内核的入口**。像快递平台统一了下单接口，实际运输仍可以由不同线路完成；应用不用知道每家承运商的内部流程，但平台必须根据地址和货物选择能完成任务的线路。

## 源码里已经发生了什么

我把 oneDNN 固定在提交 [`0a1028a`](https://github.com/uxlfoundation/oneDNN/tree/0a1028a095dfe1641cc9a64f9de699add4bd6859)，把 ZenDNN 固定在提交 [`918235f`](https://github.com/amd/ZenDNN/tree/918235f6bd4142db2d2c476edeba0ad23a9b0994)。oneDNN 中与这次整合直接相关的四个提交于 10 月 21 日进入主分支，依次补齐了源码构建、已安装包发现、固定 ZenDNN 版本以及静态安装处理。

当前构建开关是 `ONEDNN_X64_USE_ZEN`，默认值为 `OFF`。开启后，构建系统先寻找已安装的 ZenDNN；找不到时，再从指定源码构建。默认要求 ZenDNN **6.1.1** 或更高版本，并把 AOCL-DLP、AOCL-Utils 等依赖一并接入。

运行时不是看到“x86_64”就使用 ZenDNN。以矩阵乘实现为例，Zen 候选虽然排在其他 x86 内核之前，但初始化阶段还会检查：

- CPU 厂商必须是 AMD；
- 至少支持 AVX-512 Core；
- 张量维度、数据类型和布局在当前实现范围内；
- 融合的激活、求和或二元后处理能够由 Zen 路径正确表达。

任何一项不满足，这个候选就返回“不支持”，调度器继续尝试后面的 BRGEMM、普通 GEMM 或参考实现。因此，把 Zen 候选排在前面并不会让 Intel CPU 误走 AMD 内核，也不会为了追求加速而拒绝原本可以运行的形状。

固定提交里已经能看到 Zen 路径接入矩阵乘、低精度矩阵乘、前向全连接和重排；实验性的分组矩阵乘也有对应入口。这不是“oneDNN 所有算子已经全部换成 ZenDNN”。卷积、归一化、训练反向等大量路径仍要分别看当前实现，覆盖范围也会继续变化。

## 我实际验证了哪一层

验证环境是一台 Intel Xeon Platinum 8573C 虚拟机，使用 GCC 13.3.0、CMake 4.1.2。执行的核心配置是：

```bash
cmake -S oneDNN -B build -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DONEDNN_X64_USE_ZEN=ON \
  -DONEDNN_ZENDNN_SOURCE=/path/to/ZenDNN \
  -DONEDNN_BUILD_TESTS=OFF \
  -DONEDNN_BUILD_EXAMPLES=ON \
  -DONEDNN_BUILD_GRAPH=OFF \
  '-DONEDNN_ENABLE_PRIMITIVE=MATMUL;INNER_PRODUCT;REORDER'

cmake --build build --target primitives-matmul-cpp --parallel 8
```

配置阶段成功识别 ZenDNN 6.1.1，建立外部依赖和 oneDNN 的链接关系。构建目标完成了 379 个步骤，示例程序退出码为 0；开启 verbose 后，三个 Zen 矩阵乘候选都以“只支持 AMD CPU”为由退出，Intel 主机最终选择 `brg_matmul:avx512_core`，符合源码中的厂商门槛。

我还做了一个负向验证：把 `ONEDNN_CPU_RUNTIME` 改成 `SEQ`，配置会直接失败，提示 ZenDNN 路径只支持 OpenMP。也就是说，开关不是一段“尽量链接、失败就悄悄忽略”的脚本，关键环境不符合时会在构建阶段拒绝产生一个容易误判的二进制。

这次验证能证明新入口可以配置、编译并保持非 AMD 主机的回退行为；它**不能证明 AMD CPU 上的性能提升**。当前环境没有 Zen 4 或更新的 AMD 服务器，也没有在相同功耗、线程数、NUMA 与内存配置下做 A/B 测试，因此本文不提供吞吐提升数字。

## 为什么“编译进去了”仍不等于“应用用到了”

从 PyTorch 应用到 Zen 内核，中间至少有四道门：

1. 安装的 PyTorch 必须本身启用了 oneDNN；
2. PyTorch 所带的 oneDNN 必须用 Zen 开关构建；
3. 运行机器必须通过 AMD 厂商和指令集检查；
4. 当前算子的形状、数据类型、布局和融合条件必须落在 Zen 实现范围内。

这也是为什么只看 `torch.backends.mkldnn.is_available()` 不够。它只能说明 PyTorch 有 oneDNN 后端，不能说明某次运算最终选择了哪个实现。oneDNN 的 verbose 输出会记录 primitive、数据格式、具体 implementation 和执行时间，更适合用来确认实际路径。

下面的 PyTorch 代码可用于检查一个显式转换到 MKLDNN 布局的全连接层。它是环境诊断示例；输出中的实现名要以目标服务器实际结果为准。

```python
import torch
from torch.utils.mkldnn import to_mkldnn

print("PyTorch:", torch.__version__)
print("oneDNN available:", torch.backends.mkldnn.is_available())
print("CPU capability:", torch.backends.cpu.get_cpu_capability())

model = to_mkldnn(torch.nn.Linear(1024, 1024).eval())
x = torch.randn(8, 1024).to_mkldnn()

with torch.inference_mode():
    model(x)  # 预热
    with torch.backends.mkldnn.verbose(
        torch.backends.mkldnn.VERBOSE_ON_CREATION
    ):
        y = model(x)

print(y.to_dense().shape)
```

生产环境还应固定线程数并重复多种真实形状。只跑一个方阵很容易得到错误结论：模型中的小批量全连接、长序列矩阵乘、量化权重和 MoE 分组矩阵乘，对缓存、内存带宽和线程调度的压力完全不同。

## 谁现在需要行动

### 普通 PyTorch 用户

不用因为公告立刻重编整个框架。先记录当前 PyTorch 版本、CPU 型号、oneDNN 可用性和 verbose 输出，等待所使用的官方或供应商发行包明确说明已启用该路径。真正迁移时，对同一模型比较输出误差、延迟分位数、吞吐、内存和启动开销。

### 发行版与框架维护者

需要评估的不是一个布尔开关，而是一条新的构建供应链：CMake 版本、OpenMP、ZenDNN 版本、AOCL 依赖、静态/动态链接和许可证文件都会进入发布流程。当前源码还明确拒绝 Windows，首次源码构建也需要下载依赖。

### 运行 AMD CPU 推理的团队

这条路线最值得跟踪，但测试必须回到自己的输入分布。先用 verbose 确认真正命中 Zen implementation，再与关闭 Zen 开关的同一 oneDNN 提交比较；同时保留不支持形状的回退测试。若只比较两个不同版本的 PyTorch，很难区分差异究竟来自 ZenDNN、oneDNN 其他提交，还是 Inductor 与算子融合变化。

## 真正重要的变化是什么

这次合作最现实的价值，不是 AMD 和 Intel 已经给出一个统一的性能数字，而是 PyTorch 的 CPU 优化开始减少“厂商专用旁路”：AMD 内核可以进入 oneDNN 的同一个候选列表，用相同 primitive 语义参与选择和回退。

对应用开发者，这有机会降低跨 x86 服务器部署时的分支数量；对框架维护者，它把更多兼容性、构建和回归测试压力集中到公共项目里。代价是统一入口背后的条件依然很多，而且当前交付状态仍处早期。

因此，现在最合理的判断不是“CPU AI 从此一套代码自动跑满”，而是：**统一调度的地基已经落到源码，下一步要看 PyTorch 发行包何时启用、算子覆盖怎样扩展，以及 AMD 硬件上的独立实测能否证明收益。**

## 原始资料

- [AMD：AMD and Intel Collaborate to Simplify AI Development on x86 CPUs with PyTorch](https://newsroom.amd.com/news/amd-intel-collaborate-simplify-ai-development-on-x86-cpus-pytorch/)
- [Intel：AMD and Intel Collaborate to Simplify AI Development on x86 CPUs Using PyTorch](https://www.intel.com/content/www/us/en/newsroom/news/data-center/amd-intel-simplify-x86-ai-development-with-pytorch.html)
- [oneDNN 固定源码提交](https://github.com/uxlfoundation/oneDNN/tree/0a1028a095dfe1641cc9a64f9de699add4bd6859)
- [oneDNN：首次合入 ZenDNN 源码构建支持](https://github.com/uxlfoundation/oneDNN/commit/22517c04865b9465f92a5b10053e297477f6d26f)
- [oneDNN：ZenDNN 构建选项与限制](https://github.com/uxlfoundation/oneDNN/blob/0a1028a095dfe1641cc9a64f9de699add4bd6859/doc/getting_started/build_options.md#onednn_x64_use_zen)
- [oneDNN：Zen 矩阵乘的运行时检查](https://github.com/uxlfoundation/oneDNN/blob/0a1028a095dfe1641cc9a64f9de699add4bd6859/src/cpu/x64/zen64/matmul/zen_matmul.cpp)
- [ZenDNN 固定源码提交](https://github.com/amd/ZenDNN/tree/918235f6bd4142db2d2c476edeba0ad23a9b0994)
- [PyTorch：MKLDNN 后端文档](https://docs.pytorch.org/docs/stable/notes/mkldnn.html)
- [oneDNN：Verbose Mode](https://uxlfoundation.github.io/oneDNN/dev_guide_verbose.html)
