---
title: 'Cognition 发布 SWE-2：把强化学习堆到万亿参数级别之后，编程 Agent 到底变强了多少'
date: 2026-09-14
slug: 'cognition-swe-2-kimi-k3-agent-coding-jiagou-jiexi'
author: 范伟彬
categories:
  - AI
  - 开发者工具
tags:
  - Cognition
  - SWE-2
  - Devin
  - Kimi K3
  - 强化学习
  - Agent Coding
  - 基准测试
description: '2026 年 9 月 10 日，Devin 背后的公司 Cognition 发布编程 Agent 模型 SWE-2，在 Kimi K3（2.8 万亿参数）基座上做强化学习后训练，号称是首次把 RL 规模化到"万亿参数级别"，并首次为同一模型提供 medium/high/max 三档推理强度。本文基于 Cognition 官方博客、MarkTechPost、OrcaRouter、MindStudio 等信源，梳理 SWE-2 的训练方法、基准表现、定价与一个容易被忽视的"体面"——它在旧基准上领先，却在最新、最难的 Terminal-Bench 4 上大幅落后，并给出 Devin CLI 的实践用法与选型建议。'
---

# Cognition 发布 SWE-2：把强化学习堆到万亿参数级别之后，编程 Agent 到底变强了多少

如果你最近在关注编程类 AI Agent，大概已经注意到这个赛道正在从"模型比拼"演变成"模型 + 训练方法 + 服务成本"的三重比拼。2026 年 9 月 10 日，Devin 背后的公司 Cognition 发布了新一代编程模型 **SWE-2**——不是又一次"跑分创新高"，而是官方明确定位为**首次把强化学习规模化到"万亿参数级别"**的一次训练方法尝试。更有意思的是，独立测评和分析文章几天内就扒出了它跑分表里一个不太体面的细节：它在旧基准上领先对手，却在最新、最能反映真实长任务能力的基准上大幅落后。这恰好是一篇值得深入拆解的技术新闻——既有真实的工程创新，也有值得警惕的"基准选择性展示"。

## 一、背景介绍：从 SWE-1.7 到 SWE-2，Devin 背后的模型迭代逻辑

Cognition 是自主编程 Agent 产品 **Devin** 的开发公司。和大多数 AI 编程工具不同，Devin 从一开始就不是"在通用大模型上包一层壁纸"，而是自己训练专用的编程模型系列，命名为 **SWE**（Software Engineer）。上一代 SWE-1.7 已经在 Devin Desktop、CLI、Web、Fusion 等产品形态里跑了一段时间，但其基座模型规模有限，在复杂、长链路任务上的表现始终落后于 Claude、GPT 等旗舰模型的 Agent 模式。

SWE-2 的思路是"借基座，练本事"：不再从零训练一个基础模型，而是选择 Moonshot AI 的 **Kimi K3**——一个已经针对 Agent 编程做过大量强化学习的 2.8 万亿参数混合专家（MoE）模型——作为基座，在此之上继续做 Cognition 自己的 RL 后训练。按照官方说法，这是 SWE 系列第一次把 RL 训练规模扩展到"多万亿参数区间"，也是第一个在同一次 RL 训练中，同时产出 medium / high / max 三档推理强度的 SWE 模型。这个背景，恰好呼应了本站之前报道过的两个趋势：一是像 Sakana Fugu 那样"站在别人肩膀上做编排/后训练"正在成为一条独立技术路线；二是 DeepSeek、Kimi 等开源权重模型正越来越多地被下游公司拿来做专用后训练的基座，而不是直接当作终端产品竞争对手。

## 二、技术细节解析：SWE-2 到底训练了什么

### 1. 基座：Kimi K3 的 MoE 架构

Kimi K3 是一个 2.8 万亿参数的 MoE 模型，但每个 token 实际激活的参数量远小于总参数量（分析文章给出的量级大约是原基座 SWE-1.7 的 3 倍左右）。这意味着 SWE-2 在推理成本上并不是简单地按总参数量线性增长，MoE 的稀疏激活特性是它敢喊出"更便宜"的硬件基础。

### 2. 核心创新：把"帕累托前沿"直接写进奖励函数

这是 SWE-2 技术报告里最值得展开讲的部分。Cognition 没有用传统的"任务成功就给 1 分"这种二元奖励，而是设计了一个显式考虑成本的奖励函数：

```
R = S − λ_e · C
```

其中：
- `S`：任务是否成功（二元结果）；
- `C`：这次 rollout 的实际成本（美元开销 + 耗时）；
- `e`：推理强度档位（medium / high / max）；
- `λ_e`：针对每个档位单独调优的系数，让它正好匹配该档位在"成功率-成本"帕累托曲线上的斜率。

直白地说：模型在训练时就被明确告知"用更多算力换更高成功率是否值得"，而且这个"值得"的标准是按 medium/high/max 三个档位分别校准的，而不是用一套统一标准。这也是为什么 SWE-2 能同时提供三档推理强度——它们不是同一个模型简单调温度或截断步数得到的三个版本，而是在同一次 RL 训练里针对不同成本敏感度联合优化出来的结果。

配合这个奖励函数，Cognition 还引入了自 SWE-1.6 以来使用的**长度加权基线**（length-weighted baseline）——通过让梯度范数与 rollout 长度相关联，降低训练中的梯度方差，官方表示这"在不增加额外成本的前提下显著稳定了训练"。

### 3. 推理基础设施：不仅是训练技巧，也是工程活

值得一提的是，SWE-2 的效率提升不完全来自训练算法，还有不少来自推理侧的工程优化：

- **投机解码（Speculative Decoding）**：使用名为 DSpark 的方案，配合 SpecForge 训练的草稿模型，在 RL 训练阶段就把"接受长度"（acceptance length）提升了 15%；
- **低精度推理**：对 MLA 层的 K/Q/V 计算采用 NVFP4/FP8 量化，并做了量化感知训练（QAT），减少精度损失；
- **Prefill 延迟调度**：官方称使 TPM（每分钟 token 数）和 TPS（每秒 token 数）提升 10%~20%。

这套组合拳的效果体现在效率数字上：官方给出 medium 档位下，SWE-2 达到"首次编辑"平均只需 18 步，而 SWE-1.7 需要 48 步——差距接近 3 倍。官方把这归因于"更高的智能让模型能判断代码库里哪些部分真正重要"，即更聚焦的探索路径,而不是单纯的解码速度提升。

## 三、基准表现与定价：亮眼的表格，和藏在表格外的隐忧

### 1. 官方基准对比

| 基准 | SWE-2 | Claude Fable 5.1 | GPT-6 Astra | SWE-1.7 |
|---|---|---|---|---|
| FrontierCode 1.1 Main | 50.0% | 50.9% | 53.3% | 42.0% |
| DeepSWE 1.1 | 73.0% | 67.4% | 74.1% | 37.7% |
| Terminal-Bench 2.1 | 92.8% | 91.4% | 89.9% | 81.5% |
| **Terminal-Bench 4** | **27.3%** | **55.8%** | **57.9%** | 7.6% |

前三行看起来非常漂亮：在 FrontierCode 上以 50.0% 逼近 Fable 5.1 的 50.9%，官方据此宣称"仅差一个百分点，成本却便宜 64%"；在 Terminal-Bench 2.1 上甚至反超 Fable 5.1 和 GPT-6 Astra。

但独立分析文章（OrcaRouter）指出了一个关键问题：**Terminal-Bench 2.1 是已经退役的旧版基准，而 Terminal-Bench 4 才是当前更难、更能反映真实长任务能力的版本**。在 Terminal-Bench 4 上，SWE-2 只拿到 27.3%，比 Fable 5.1 低了 28.5 个百分点，比 GPT-6 Astra 低了 30.6 个百分点——从 2.1 到 4，SWE-2 掉了约 65.5 个百分点，而竞品只掉了 32~36 个百分点。换句话说，**SWE-2 领先的那一行是旧基准，落后的那一行才是新基准**，这种"选择性亮点"的表格排布方式值得开发者在看发布博客时多留一分警惕。

### 2. 第三方复测：KingBench 3 与 8 任务实测

由于 Artificial Analysis 等第三方评测平台截至发稿还没有收录 SWE-2，MindStudio 用一套名为 KingBench 3 的 8 任务基准做了独立测试：

| 模型 | 得分 |
|---|---|
| SWE-2 | 83.75%（67/80） |
| DeepSeek V4.1 Flash | 81.25%（65/80） |
| Kimi K3（基座，未后训练） | 77.5% |

8 项任务逐一对比中，SWE-2 对 DeepSeek V4.1 Flash 是"3 胜 2 负 3 平"，整体略有优势但并非压倒性。实测中 SWE-2 在多阶段复合任务（例如"生成数据集 → 微调模型 → 部署 Web 界面"这类流水线任务）上拿到满分 10/10，在需要交互式可视化的任务（3D 材质小球、可折叠桌子动画）上也优于 DeepSeek。但测试者也提到一个实操层面的槽点：**SWE-2 在开始动手前会问过多确认性问题**，在追求全自动化的工作流里会造成明显摩擦。

至于 SWE-2 相对基座 Kimi K3 的提升，多份分析给出的一致结论是"稳定加 5 分左右"——RL 后训练确实在多个基准上带来实打实的收益，只是幅度没有官方营销语言给人的印象那么颠覆性。

### 3. 定价与获取方式

SWE-2 没有独立的按 token 计费的公开 API 价格——它目前只捆绑在 Devin 产品内，定价方式是"每次 rollout 平均花费的美元数"这种内部指标，而不是行业通用的每百万 token 价格，这也是分析文章指出"64% 更便宜"这个说法难以被外部直接验证的原因之一（它比较的是 Devin 内部两次不同模型跑同一基准的总花费，而不是标准化的 API 单价）。目前可获取方式：

- 已上线 **Devin Desktop、Devin CLI**，逐步推广到 **Devin Web、Fusion**；
- 打包在 **Devin Pro**（20 美元/月）中，SWE-2 的使用额度在 **2026 年 10 月 10 日前免费**，之后按 Devin 的常规计费规则计入套餐额度。

## 四、实践指南：如何用 Devin CLI 试用 SWE-2，以及如何评估要不要换

### 1. 用 Devin CLI 快速上手

Devin CLI 是目前接触 SWE-2 门槛最低的方式。基本用法：

```bash
# 进入项目目录后直接进入交互式 REPL
devin

# 带初始指令启动，直接进入 REPL 继续对话
devin -- "check out this code and suggest a feasible, helpful feature"

# 非交互模式：打印结果到 stdout 后退出，适合写进 CI 脚本
devin -p "list all TODO comments in the codebase"

# 会话中随时切换到 SWE-2 的某个推理档位
/model swe-2-high

# 需要更长时间跑复杂任务时，把当前会话交接到 Devin Cloud 继续跑
/handoff
```

Devin CLI 还提供 `--permission-mode` 参数控制自动化程度：默认 `normal` 模式下，只读操作（如搜索文件）自动通过，任何写入或执行 shell 命令都需要人工确认；`accept-edits` 模式则会在工作目录范围内自动批准文件写入/编辑，但 shell 命令仍需确认。对于刚接触 SWE-2、还不确定它的"过度确认"倾向会不会影响效率的团队，建议先用默认的 `normal` 模式跑几轮，观察它到底会打断你多少次，再决定是否放开权限。

### 2. 用官方的奖励函数思路，自己做一次"值不值得升档"的估算

SWE-2 训练时用的 `R = S − λ_e·C` 这套逻辑，其实也可以直接搬来指导日常使用中"该选 medium 还是 max"的决策。下面是一个简化的 Python 小脚本，模拟这个决策过程：

```python
# 简化模拟：三档推理强度下的"成功率-成本"权衡
# 数字为示意值，实际请替换为你自己业务场景的实测数据
effort_levels = {
    "medium": {"success_rate": 0.62, "cost_usd": 0.08, "avg_steps": 18},
    "high":   {"success_rate": 0.74, "cost_usd": 0.22, "avg_steps": 35},
    "max":    {"success_rate": 0.81, "cost_usd": 0.55, "avg_steps": 60},
}

def pareto_score(success_rate: float, cost_usd: float, lam: float) -> float:
    """R = S - lam * C，lam 越大表示你越在意成本"""
    return success_rate - lam * cost_usd

# lam 是你自己团队对"1 美元成本"的容忍度，值越小说明越不在乎钱、更在乎成功率
for lam in (0.5, 2.0, 5.0):
    print(f"\n当 lambda={lam}（成本敏感度）时各档位得分：")
    for level, stats in effort_levels.items():
        score = pareto_score(stats["success_rate"], stats["cost_usd"], lam)
        print(f"  {level:>6}: R={score:.3f}  (成功率={stats['success_rate']}, 成本=${stats['cost_usd']})")
```

这个脚本的意义不是给出一个"标准答案"，而是提醒开发者：与其直接相信官方"64% 更便宜"这类归一化后的营销数字，更靠谱的做法是拿自己团队真实的任务类型，实测各档位的成功率和成本，再套进这个公式里算一遍——尤其是在你的场景更接近 Terminal-Bench 4（长链路、多步骤、需要持续自主决策）而不是 Terminal-Bench 2.1（相对短链路）时，SWE-2 官方数字的参考价值需要打个折扣。

### 3. 选型建议 Checklist

- 如果你的任务是**短链路、明确边界的单文件/单模块修改**，SWE-2 的 FrontierCode/Terminal-Bench 2.1 数据具备一定参考价值，值得在 Devin Pro 的免费额度期（10 月 10 日前）内实测；
- 如果你的任务是**跨多个服务、长时间自主运行、需要模型自己规划任务分解**的场景，优先参考 Terminal-Bench 4 这类更新、更难的基准，SWE-2 目前的 27.3% 明显落后于 Fable 5.1 和 GPT-6 Astra，不建议直接替换现有方案；
- 如果你的团队高度依赖**全自动无人值守**流水线，注意 SWE-2 实测中"过多确认性问题"的槽点，先用 `normal` 权限模式观察打断频率再决定是否上生产；
- 无论官方数字多亮眼，在关键决策前，尽量找到或自己跑一次**非官方、可复现的第三方评测**（如本文引用的 KingBench 3），单一厂商自证的基准表格永远只是参考的起点，不是终点。

## 五、总结与展望

SWE-2 是一个技术上真实有创新、但营销上有选择性的典型案例。它证明了"借开源权重基座做专用 RL 后训练"这条路线（本站近期报道的 Sakana Fugu、DeepSeek 生态等新闻都在印证这一趋势）在编程 Agent 领域同样走得通，而且把强化学习训练规模推到了万亿参数级别，配合帕累托前沿显式建模的奖励函数、投机解码与低精度推理的工程优化，确实带来了实打实的效率提升（首次编辑步数从 48 步降到 18 步）。

但它同时也提醒所有关注 AI Agent 新闻的开发者一件更重要的事：**基准测试的"新旧版本"和"选择性展示"，正在成为判断一次模型发布价值时必须警惕的陷阱**。一张漂亮的对比表格里，往往同时藏着"已退役的旧基准上的胜利"和"当前最难基准上的落后"，只看官方博客给出的排序和加粗数字，很容易得出与事实相反的结论。对于要把编程 Agent 真正用进生产流程的团队来说，比追新模型更重要的能力，是建立一套自己的、贴近真实业务场景的评测习惯——这件事本身，可能比任何一次具体的模型发布都更值得投入时间。

## 参考来源

- [Cognition 官方博客：Introducing SWE-2: Pushing the Pareto Frontier](https://cognition.com/blog/swe-2)
- [MarkTechPost: Cognition Releases SWE-2, A Kimi K3 Post-Trained Coding Model That Matches Fable 5.1 on FrontierCode at 64% Lower Cost](https://www.marktechpost.com/2026/09/12/cognition-releases-swe-2-a-kimi-k3-post-trained-coding-model-that-matches-fable-5-1-on-frontiercode-at-64-lower-cost/)
- [OrcaRouter: Cognition SWE-2 — Frontier Coding at 64% Off, Plus a Trap](https://www.orcarouter.ai/blog/cognition-swe-2-release)
- [MindStudio: Cognition SWE-2 — Benchmarks, Pricing, and Real Test Results](https://www.mindstudio.ai/blog/cognition-swe-2-coding-model)
- [CellCog: Cognition SWE-2 — Benchmarks, the 64% Cost Claim, and the Row It Loses](https://cellcog.ai/blog/cognition-swe-2/)
- [AiCybr: Cognition SWE-2 — Benchmarks, Kimi K3 Base, RL Training and Devin Availability](https://aicybr.com/blog/cognition-swe-2-coding-model-benchmarks-training)
- [Devin CLI 官方文档](https://docs.devin.ai/cli)
- [QAInsights: Devin CLI Tutorial — Essential Commands, Models, and My Experience](https://qainsights.com/devin-cli-tutorial-essential-commands-models-and-my-experience-building-iamspeed-dev/)
