---
title: 'openTPU：AI 写出的加速器，怎样证明自己真的在 FPGA 上跑'
date: 2026-10-09
slug: 'opentpu-ai-accelerator-fpga-verification'
author: 范伟彬
description: '拆解 openTPU 从 Python 内核、编译器、公开 ISA、位精确模拟器到 SystemVerilog RTL 和真实 FPGA 卡的验证链，并记录固定提交后的 116 项本地测试结果与性能边界。'
categories:
  - AI
  - 技术
  - 开源项目
tags:
  - openTPU
  - FPGA
  - AI 加速器
  - SystemVerilog
  - 可复现性
---

让 AI 写一个能做矩阵乘法的 Verilog 模块并不稀奇。真正困难的是把它一路变成可编译的指令、能装载真实模型权重的运行时、能过时序约束的 FPGA 位流，再证明模拟器与板卡算出的每一位都一致。

[openTPU](https://github.com/FeSens/openTPU) 正在尝试把这条链放进一个仓库。项目 9 月 24 日创建，10 月 8 日的[最新数学与量化修复提交](https://github.com/FeSens/openTPU/commit/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25)继续更新浮点近似、量化审计和真实板卡验证。10 月 9 日清晨查看时，仓库有 534 个 Star；两天前的 [Hacker News 讨论](https://news.ycombinator.com/item?id=49980715)获得了 340 分和 399 条评论。这些数字只能说明开发者关注度突然上升，不能证明项目已经被生产采用。

openTPU 自称“由 AI 开发的开源 AI 加速器”。这个故事很吸引人，但仓库不能独立证明每一行代码由谁生成。更值得看的，是它有没有把 AI 生成硬件最容易缺失的部分补齐：**明确的软硬件契约、跨层对照测试，以及真实设备上的闭环。**

## 它不是一个 RTL 演示，而是一条完整路径

openTPU 把一个模型算子落到硬件，大致经过六层：

| 层次 | 仓库里的实现 | 主要问题 |
| --- | --- | --- |
| 模型内核 | Python 中的 `ol` 内核语言 | attention、MLP 怎样写成可组合算子 |
| 编译器 | 布局、循环、寄存器和融合规则 | 算子怎样变成确定的指令与数据搬运 |
| ISA | 每条指令固定为 8 个 32 位字 | 软件与硬件到底约定了什么 |
| ISA 模拟器 | Python 位精确模型 | 没有 FPGA 时怎样得到参考结果 |
| RTL | SystemVerilog | 同一条指令怎样在电路里执行 |
| 板卡运行时 | PCIe 驱动、监控、诊断和模型工具 | 位流、权重与主机怎样真正协作 |

普通硬件 Demo 常在“RTL 能仿真”处结束；普通推理框架则从已经存在的 GPU 或 NPU 开始。openTPU 把两端接在一起，所以可以从一段 Python 内核顺着编译结果读到指令，再对照模拟器和 RTL。

仓库 README 给出的简化 MLP 示意很能说明这件事；下面省略了 `rmsnorm`、`silu` 等辅助函数，不能单独运行：

```python
from opentpu import language as ol

@ol.jit
def mlp(h, gamma, w_gate, w_up, w_down, out, eps):
    x = ol.load(h)
    xs = ol.quantize(rmsnorm(x, ol.load(gamma), eps))
    g = ol.dot(xs, w_gate)
    u = ol.dot(xs, w_up)
    a = ol.all_gather(silu(g) * u)
    y = ol.all_gather(ol.dot(a, w_down))
    if ol.program_id() == 0:
        ol.store(out, x + y)
```

这不是把 Python 动态翻译给某个闭源后端。`ol.load` 会落成 DRAM 到片上存储的 `LD` 指令，`ol.quantize` 落成 `QACT`，`ol.dot` 落成矩阵单元的 `MM`。布局变化就是显式的数据搬运，不存在一个看不见的调度器在背后重新安排内存。

可以把它理解为透明厨房：Python 内核是菜单，ISA 是标准化工单，模拟器与 RTL 是两位按同一工单做菜的厨师。只有两边约定检查的结果一致，才有资格继续送到真实板卡。

## 为什么“位精确”比“能输出正确答案”更有分量

大模型推理中，一个 token 相同并不代表底层实现正确。两个实现可能在 logits 上已经发生偏差，只是最大值碰巧仍指向同一个 token；误差经过更多层或更长上下文后，才突然改变输出。

openTPU 因此维护三种参照：

1. Hugging Face 的浮点模型，用来观察量化造成的整体偏差；
2. 按 openTPU 数值规则执行的 ISA 模拟器，用来定义软件侧的精确行为；
3. RTL 或 FPGA 板卡，用来检查硬件是否逐位实现了同一行为。

这里的“同一行为”还包括许多容易被忽略的角落：浮点加法的零符号、次正规数是否 flush to zero、倒数和平方根倒数的近似步骤、量化舍入的平局，以及 4 位权重的每一种编码。

10 月 8 日的修复提交就是一个很具体的例子。作者没有只写“提高精度”，而是同时修改：

- `exp2` 的七阶多项式系数；
- `recip` 与 `rsqrt` 最后一次牛顿迭代的校正形式；
- RTL、Python 数值模型和 ISA 文档；
- 覆盖指数范围、量化边界与零符号的测试；
- 真实板卡与 ISA 模拟器的对照记录。

提交记录称，6 组板卡验证在 103 到 128 个步骤中得到 0 ulp 差异，板卡与 ISA 模拟器的 logits 位级一致。这是作者在指定板卡上的测试记录，我没有相同硬件，不能把它当成独立复现；但把修改、数值契约、反例测试和板卡结果放在同一个提交里，至少让这项主张有了可审计路径。

## 这颗“TPU”里面其实很朴素

名字叫 TPU，不代表它是 Google TPU 的兼容实现，也不代表已经是一颗流片的 ASIC。openTPU 当前运行在 Xilinx Kintex-7 FPGA 卡上，更准确地说，它是一套面向大模型推理的开放式加速器架构。

核心结构刻意保持简单：

- DMA 负责 DRAM 与片上存储之间的数据搬运；
- 矩阵单元用 int8 激活与 int8 或 4 位权重做乘加；
- 向量单元处理 fp32 的归一化、指数和逐元素运算；
- 量化器把结果重新压回 int8；
- sequencer 每周期发出一条指令。

它没有缓存，也没有隐藏调度。代价是程序员和编译器必须显式安排每次搬运；好处是一次推理为什么慢，可以从 trace 里看到到底在等 DRAM、矩阵单元还是另一条指令。这种透明度很适合学习体系结构，也适合验证 AI 生成的优化有没有偷偷破坏约束。

项目还实现了一个类似 Triton 的小型内核语言、在线 softmax attention、4 位权重量化、MoE 专家从主机存储流式换入，以及能显示 roofline、时间线和逐指令状态的 Lens profiler。它覆盖的已经不是单个算子，而是从编译到观测的一套小型系统。

## 我实际复现了什么

我把仓库固定在提交 `8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25`，使用 Python 3.12 安装 `pytest`、`numpy` 与 `textual`，运行不需要 Verilator、模型权重或 FPGA 的五组测试：

```bash
git clone https://github.com/FeSens/openTPU.git
cd openTPU
git checkout 8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25

uv venv .venv
uv pip install --python .venv/bin/python pytest textual numpy

TEST_TMP="$PWD/.pytest-run"
mkdir -p "$TEST_TMP"
.venv/bin/python -m pytest -q -k 'not rtl' \
  --basetemp="$TEST_TMP" \
  tests/test_isa.py tests/test_compiler.py tests/test_fp.py \
  tests/test_quant.py tests/test_kernels.py
```

结果为：

```text
116 passed, 1 deselected
```

这 116 项覆盖指令编码和模拟、编译器降级、浮点近似与边界、权重量化以及常用内核。被排除的一项是需要 RTL 环境的位精确测试。因此，这次复现能说明 Python 参考实现、编译器和相关数值规则在当前环境中自洽，**不能证明 SystemVerilog 已通过 Verilator，更不能替代真实 FPGA 验证。**

如果想继续往下走，安装 Verilator 后可以运行 RTL 测试；下载模型权重后，`tools/validate.py` 可以比较量化 golden、ISA 模拟器与 RTL。README 提到，一次完整模型验证在 16 核主机上可能需要 2 到 14 分钟，Gemma 4 的内存峰值可到 16 GB。不要把“所有东西都能在笔记本运行”理解成每一步都轻量。

## 吞吐数字应该怎样读

项目 README 报告的性能来自一张带双通道 DDR3 的 Inspur YPCB-00338 卡，核心频率 133.33 MHz。测试使用 512-token 提示词，再贪心生成 64 个 token；“device”只计算加速器周期，“wall”还包括主机。

| 模型与权重 | 作者报告的 wall decode | 需要注意 |
| --- | ---: | --- |
| LFM2.5-230M，int8 | 52.3 tok/s | 模型很小，不能外推到数十亿参数模型 |
| LFM2.5-230M，4 位权重 + int8 head | 82.1 tok/s | 速度提高伴随可测量的困惑度损失 |
| Qwen3-0.6B，int8 | 21.3 tok/s | 受 DDR3 带宽约束 |
| Qwen3.5-0.8B，4 位权重 + int8 head | 23.3 tok/s | 仍是作者自测，不是横向基准 |

这些数据说明设计已经跑过真实权重，也说明 4 位权重减少内存流量后可能提高解码速度。它们不能直接回答“比某张 GPU 更快或更省电”，因为项目没有给出同一模型、同一量化质量、同一批量和同一功耗条件下的对照；FPGA 卡、主机与软件栈的成本也没有进入表格。

对这个项目而言，现阶段最有价值的结果并不是 82.1 tok/s，而是模拟器、RTL 和板卡之间建立了可追踪的对应关系。前者很容易被下一次优化刷新，后者才决定项目能否继续可靠迭代。

## 适合谁上手

如果你想从软件视角补齐 AI 芯片知识，openTPU 比一份数千页的商用 GPU 文档更容易建立全局图：仓库规模仍允许沿着一个 `ol.dot` 读到 ISA、模拟器和 RTL，再用测试确认理解。

它也适合研究这几个问题：

- AI Agent 生成 RTL 后，应该怎样设计能失败的验收闭环；
- 量化格式怎样同时影响编译器、存储布局、乘法单元和模型误差；
- attention 的数据搬运怎样与矩阵、向量流水重叠；
- 没有隐式调度时，性能瓶颈怎样出现在 trace 中。

但它还不适合作为现成的生产推理卡方案。仓库目前没有正式 Release 或稳定标签，主分支一天内就可能改变数值契约；完整位流构建需要特定 FPGA 工具和板卡；性能与功耗缺少独立对照；支持的模型、算子和 4 GiB 板载内存也都有明确限制。

“AI 能不能设计运行 AI 的芯片”是个很大的问题。openTPU 目前给出的不是最终答案，而是一种更可检验的问法：**AI 写完 RTL 之后，能不能让同一份程序在编译器、模拟器、RTL 和真实板卡上逐层对得上。** 对任何准备把 Agent 引入硬件设计的人，这条验证链比“由 AI 开发”四个字更值得复用。

## 原始资料

- [openTPU 仓库与 README](https://github.com/FeSens/openTPU/tree/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25)
- [10 月 8 日数学、量化与板卡验证提交](https://github.com/FeSens/openTPU/commit/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25)
- [公开 ISA 与数值规则](https://github.com/FeSens/openTPU/blob/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25/docs/isa.md)
- [`ol` 内核语言与编译器说明](https://github.com/FeSens/openTPU/blob/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25/docs/compiler.md)
- [量化格式与精度测试](https://github.com/FeSens/openTPU/blob/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25/docs/quant.md)
- [板卡架构、测试方法与历史结果](https://github.com/FeSens/openTPU/blob/8eaa48064f6f408eae9df6a0d3c58b3c7e66ea25/docs/board.md)
- [Hacker News：OpenTPU 讨论串](https://news.ycombinator.com/item?id=49980715)
