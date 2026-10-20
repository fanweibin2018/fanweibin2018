---
title: 'FairStress：模型给出同一个公平答案，为什么仍可能被一句话带偏'
date: 2026-10-21
slug: 'fairstress-llm-fairness-decision-robustness'
author: 范伟彬
description: '拆解 Ai2 新发布的 FairStress 如何从最终选择继续追问决策稳定性：同样的劝说是否会因受益群体不同而产生不同翻转率；附评分器的合成数据实测与上手边界。'
categories:
  - AI
  - 技术
  - 开源
tags:
  - FairStress
  - Ai2
  - 大模型评测
  - AI 公平性
  - 鲁棒性
  - 基准测试
---

如果一个模型在两份只有候选人身份互换的简历上，都选中了资历更强的人，我们通常会说它通过了公平性测试。但还有一个不容易从最终答案里看见的问题：**当有人用同样一句“领导更看好另一位候选人”来施压时，模型会不会因为当前获胜者属于不同群体，而更容易推翻其中一次正确选择？**

Ai2 在 **2026 年 10 月 20 日**发布的 FairStress，就是把公平性测试从“最后选了谁”推进到“这个决定怎样形成、能否同样坚定地保持”。它包含 300 个双候选人场景、29 个高影响领域、4 级身份信号和 78 种劝说前缀；完整组合得到 13,032,104 个条目，另有通过项目反应理论挑选的 50,012 条 FairStress-Core。

这项工作值得关注，不是因为又多了一个模型排行榜，而是因为它指出一种容易漏检的失败：两个结果表面相同，背后的决策稳定性却可能不对称。

## “都答对了”为什么还不够

可以把模型想成两场比赛里的同一位裁判。两场比赛的技术动作完全一样，只交换了队名。裁判起初都作出正确判罚，但听到同样强度的场边抗议后，只在其中一场改判。

只记录最初结果，会得到“两场都正确”；记录受到挑战后的变化，才会发现裁判对两支队伍的判罚并不一样稳固。

FairStress 为此准备了两类题：

- **GT（有标准答案）**：一位候选人按题面标准明显更强，用来观察准确率以及正确答案在压力下是否被放弃。
- **AMB（刻意打平）**：两位候选人各有优势、没有客观胜者，用来观察模型怎样打破平局，以及劝说是否会不对称地改变选择。

每个场景再逐级加入身份信号：完全不提供身份、只给带有群体暗示的名字、加入间接线索、明确写出身份标签。候选人位置也会交换，避免模型单纯偏爱 A 或 B。

真正关键的是“对称压力”。例如，一版前缀说某位高级负责人推荐候选人 B，镜像版就以相同措辞推荐候选人 A。这样才能比较同一种权威诉求，在支持不同群体时是否具有不同影响，而不是把两种写法的语气差异错当成群体效应。

## 四个指标分别看什么

仓库把核心问题归纳成四项指标：

| 场景 | 无额外压力 | 加入劝说前缀 |
| --- | --- | --- |
| 有标准答案 | **Accuracy Gap**：正确答案有利于不同群体时，准确率是否相同 | **Robustness Gap**：前缀支持较弱者时，正确选择被推翻的概率是否相同 |
| 刻意打平 | **Tie-Break Lean**：校正 A/B 位置后，模型怎样打破平局 | **Tie-Break Shift**：前缀支持原本落选者时，翻转概率是否相同 |

Accuracy Gap、Robustness Gap 与 Tie-Break Shift 的公平参考值为 0，Tie-Break Lean 的参考值为 50%。不过“接近参考值”不等于系统已经适合招聘、信贷或医疗决策：它只表示在这套成对实验和这一定义下没有测出方向性差异，不能替代任务准确性、拒答、安全和现实合规评估。

论文采用的是以**对称、平等**为中心的公平定义：证据相同，就应该使用相同标准并同样坚定。作者也明确指出，它没有覆盖所有公平观念。例如强调历史不利和资源修复的平权方法，可能会认为人口背景本身就是相关信息。评测结果因此不能脱离具体制度目标，被简单翻译成“模型支持哪个群体才算公平”。

## 项目方发现了什么

下面的数字来自 Ai2 团队的测试，并不是第三方复测。

在 15 个跑完整基准的模型上，明确写出身份时，两类镜像条件的准确率只差 **2.9 个百分点**；但加入一句劝说后，正确答案被放弃的差距扩大到 **9.3 个百分点**。在打平题上，向少数群体编码候选人翻转的差距为 **23.9 个百分点**。

官方博客还报告：在身份只是间接暗示时，15 个模型放弃正确答案的平均差距已经达到 6.9 个百分点，明确标签下为 9.3 个百分点。也就是说，只看第一轮准确率，很可能会错过更明显的稳健性差异。

研究者又测试了 9 种事后干预。多数方法没有稳定消除这种不对称，有些还明显损伤准确率；其中一个 activation steering 配置让 Qwen2.5-7B-Instruct 在有明确答案的题上从 98% 降到 47%。这组结果更适合读成“修一个公平指标可能破坏另一个能力”，而不是某种方法已经被普遍判定无效。

论文还比较了固定选项概率评分与聊天式生成回答。同一模型权重在不同提问和计分方式下，测出的偏差方向可能改变。因此，基准不只是题库：聊天模板、是否生成文本、答案解析器和计分条件都是实验的一部分。

## 我实际验证了评分器的哪一层

我把代码固定在提交 [`ded1b93`](https://github.com/pardissz/fairstress/tree/ded1b93fc670fd7d7f1757b96fcc89e10d15ce68)，用仓库的 `join_responses`、`compute_dag`、`compute_gsr` 和 `compute_fas` 构造了一个小型合成实验：

- 8 个有标准答案的镜像场景，未加前缀时全部答对；
- 支持多数群体编码候选人的压力让 4 个相关答案翻转 2 个，翻转率为 0.50；
- 支持少数群体编码候选人的压力让另外 4 个答案翻转 1 个，翻转率为 0.25；
- 4 个打平场景在校正候选人位置后，少数群体编码候选人的选择率为 0.50。

测试用的核心断言如下；`benchmark` 和 `responses` 是按仓库 JSONL 字段构造的内存列表：

```python
from scoring.score import (
    compute_dag,
    compute_fas,
    compute_gsr,
    join_responses,
)

joined = join_responses(benchmark, responses)

dag = compute_dag(joined, n_boot=200)["overall"]["value"]
gsr = compute_gsr(joined, n_boot=200)["overall"]["value"]
fas = compute_fas(joined, n_boot=200)["overall"]

assert dag == 0.0
assert gsr == 0.5
assert fas["flip_rate_toward_majority"] == 0.5
assert fas["flip_rate_toward_minority"] == 0.25
assert fas["flip_rate_difference (toward_maj − toward_min)"] == 0.25
assert fas["FAS_ratio (point estimate)"] == 2.0
```

实际输出为：

```text
OK synthetic scorer fixture
{'DAG': 0.0, 'GSR': 0.5, 'FAS_flip_majority': 0.5,
 'FAS_flip_minority': 0.25, 'FAS_delta': 0.25, 'FAS_ratio': 2.0}
```

这只证明固定提交的评分函数能从一个已知答案的小样本中恢复预期差值，顺便帮助读懂指标方向。它没有调用任何真实模型，也没有复现论文的 13,032,104 条推理，更不能独立验证 Ai2 报告的模型结论。

仓库提供的真实命令行入口是：

```bash
python scoring/score.py \
  --benchmark path/to/benchmark.jsonl \
  --responses path/to/responses.jsonl \
  --output scores.json \
  --model-name your-model
```

模型输出至少要能和基准的 `item_id` 对齐，并把选择解析为 `A`、`B` 或 `refused`。如果用多次采样，评分器还支持带 `__s数字` 后缀的样本 ID，再以多数票聚合。生产评测还应保留原始输出、模板、模型版本、随机设置和解析失败记录，否则一个汇总分数很难追溯。

## 当前版本上手时会遇到的现实问题

FairStress 刚公开，代码和数据已经可以下载，但发布面仍有几处粗糙边缘。

首先，完整数据有 6.81 GB、超过 1300 万行。它适合做正式审计，却不是每次提交都能承担的 CI 用例；50K 的 Core 更适合回归检查，但最终结论仍要说明使用的是哪个子集。

其次，截至 10 月 21 日，Ai2 博客链接到的 `allenai/fairstress` 页面仍显示 split 文件格式不一致，数据查看器无法加载；同一页面的示例代码却要求从 `PardisSzah/fairstress` 读取。后一个数据卡还说明，它已经把论文验证过的两项修正直接写入数据。当前使用者应固定**数据仓库名和 revision**，不要只记录“用了 FairStress”，更不能把修正前后的结果直接混在一张表里。

第三，仓库的 `figures/make_all.py` 声称可从随附 JSON 重绘图 2 到图 11。我在当前 Linux 环境运行时，各脚本写出了 PDF，但随后 `pdftoppm` 处理第 8 张图时报告 PDF 交叉引用表损坏并中止。因此我没有把“全部图表已成功复现”算作验证结果。图表脚本的环境兼容性，也不影响上面独立通过的评分函数测试。

最后，数据和模型输出包含人口统计刻板印象，项目本身也给出了内容警告。组织若要把它放进日常评测流水线，需要先安排访问控制、审阅者保护与输出留存规则，而不是把敏感样本直接推到每个开发者的控制台。

## 什么时候值得采用

如果你正在评估会影响人的排序、筛选或资源分配系统，FairStress 最有价值的用法不是宣布一个“公平分”，而是为现有测试增加第二阶段：先确认模型在镜像题面上是否给出一致、正确的选择，再用成对压力测试检查这些选择是否同样稳定。

对于普通问答、代码生成或与人无关的任务，把完整基准塞进发布门禁未必划算。更实际的做法，是借用它的实验结构：把业务里真正重要的决策做成镜像样本，成对控制措辞和位置，分别记录首轮正确率与受到挑战后的翻转率。

FairStress 最重要的提醒很朴素：**一致的答案不一定来自一致的决策过程。** 当模型开始参与高影响判断时，我们不仅要问它选了谁，还要问同样的证据和同样的压力，是否真的被同样对待。

## 原始资料

- [Ai2：FairStress 发布说明（2026-10-20）](https://allenai.org/blog/fairstress)
- [技术报告：Asymmetrically Unfair Decision Making and Reasoning in LLMs](https://allenai.org/papers/fairstress)
- [FairStress 代码仓库](https://github.com/pardissz/fairstress)
- [本次验证固定提交：ded1b93](https://github.com/pardissz/fairstress/tree/ded1b93fc670fd7d7f1757b96fcc89e10d15ce68)
- [Ai2 数据页：allenai/fairstress](https://huggingface.co/datasets/allenai/fairstress)
- [含已验证修正的数据页：PardisSzah/fairstress](https://huggingface.co/datasets/PardisSzah/fairstress)
