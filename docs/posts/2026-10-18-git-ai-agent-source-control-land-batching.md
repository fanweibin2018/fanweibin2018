---
title: 'git-ai：当 50 个 Agent 同时提交，Git 的瓶颈为何变成“落地”'
date: 2026-10-18
slug: 'git-ai-agent-source-control-land-batching'
author: 范伟彬
description: '从 git-ai 的 CAS 落地、按分支批处理与服务端稀疏工作区入手，解释 Agent 并发写代码为何会把版本控制推到新瓶颈；结合固定提交测试与项目自带基准，判断它目前适合谁、还缺什么。'
categories:
  - AI
  - 技术
  - 开源
tags:
  - git-ai
  - Git
  - AI Agent
  - 版本控制
  - Gitaly
  - 并发
---

一个人写半天代码再推一次，和 50 个 Agent 每隔几秒就想把一个小改动放进同一条主分支，是两种完全不同的版本控制负载。后者真正拥堵的地方，往往不再是“生成代码”，而是所有改动如何看到最新分支、完成 rebase，并安全地更新同一个引用。

`git-ai` 是 2026 年 10 月中旬出现的开源实验：它把 Anthropic 内部版本控制系统 Scion 公开文章里的若干思路，落到了以 Gitaly 为基础、底层仍使用普通 Git 仓库的实现中。项目在 10 月 18 日已有约 **1.1k Stars、119 forks**，说明它迅速获得了开发者注意；这组数字只能证明关注度，不能证明生产采用或性能。

更值得看的不是“为 AI 重写 Git”这个口号，而是它对一个具体并发问题的处理：多个 Agent 同时落地到同一分支时，不让它们各自反复抢锁、失败、rebase、再重试，而是按分支排队，把一批相容改动顺序接到最新 tip 上，最后用一次 compare-and-swap 发布。

## 为什么常规 Git 到了 Agent 规模会显得吃力

Anthropic 在 10 月 13 日公开 Scion 时，给出了一个相当特殊的内部负载：日合并量从 2026 年 5 月约 2,500 次增长到 9 月超过 30,000 次；主分支历史接近 100 GB，压缩后的工作副本超过 25 GB，CI 每天执行约 2,500 万次 checkout。

这些数字是 Anthropic 对自家环境的描述，不代表普通团队很快也会遇到同样规模。但它揭示了两个会随 Agent 数量放大的成本：

1. **读取成本。** 每个短命任务都完整 clone、拉取历史、计算 blame 或 merge base，会重复搬运和计算大量相同数据。
2. **写入争用。** 多个任务基于同一个分支 tip 产生改动，等第一个任务更新分支后，其余任务的前提已经过期，只能重新计算并再次尝试。

Git 的分布式、可离线设计对绝大多数仓库仍然非常合适。Scion 做的取舍是承认 Agent 和 CI 本来就在线：客户端只保留有限缓存和需要的文件，历史、blame、rebase、merge 等操作交给服务端。`git-ai` 没有复制 Scion 的内部实现——那些细节并未公开——而是在 Git/Gitaly 上尝试相似的接口与调度方式。

## CAS：每次落地都要确认“货架版本”没变

`git-ai` 把一次 `land` 表达成对分支引用的 compare-and-swap，简称 CAS。可以把分支 tip 想成超市货架上的版本号：

- Agent A 和 B 都在版本 `v10` 上准备了改动；
- A 先把分支更新为 `v11`；
- B 提交时必须同时声明“只有货架仍是 `v10` 才更新”；
- 因为实际已是 `v11`，B 的 CAS 失败，需要把自己的提交重放到新 tip 后再试。

CAS 避免了悄悄覆盖别人结果，但并发越高，失败和重算就越多。对人类低频提交，这通常可以接受；几十个 Agent 同时写一个分支时，正确性机制本身就可能变成吞吐瓶颈。

## Land batching：把分支争抢变成一条有序通道

`git-ai` 的批处理以 `(storage, repository, branch)` 为键建立 lane。相同分支的请求先进先出，不同分支的 lane 可以并行。一个批次在等待窗口到期或达到最大数量后启动，核心过程可以概括为：

```text
读取原始 tip
    ↓
按顺序处理请求 1、2、3……
    ↓
每个请求在“当前运行 tip”上快进、rebase 或报告冲突
    ↓
用一次 CAS 把原始 tip 更新到批次最终 tip
```

这里的关键不是“把许多 commit 压成一个”，而是**一次引用更新可以携带多个仍保持各自身份的落地结果**。每个请求仍有自己的提交、actor、策略检查和响应；changeset log 记录批次成员从原提交到落地提交的映射。只有真正发布分支 tip 的动作被合并了。

实现里还有几处容易被营销文案省略的细节：

- 一批请求共用一个 quarantine，并复用长驻的 `git merge-tree --stdin` 和 `git hash-object --stdin-paths` 进程，减少每个成员重复启动 Git 子进程的开销。
- 一个请求发生合并冲突，只失败该请求，不必丢弃整批；无冲突的后续请求仍可继续。
- 如果批次发布前有外部写入者抢先移动分支，整个批次会基于新 tip 重建，最多重试 10 次。
- 如果自定义 hook 拒绝组合更新，系统会退回逐个 land，让每个请求以自己的身份接受 hook 判断。
- 批次大小会根据目标延迟自适应：太慢就减半，足够快再逐步增大。它承认“批得越多”不等于“等待越短”。

这和传统 merge queue 的目标不完全相同。merge queue 常把“按顺序合并并在每次合并前跑测试”串行化；land batching 主要压缩版本控制层的重试与引用更新，测试策略可以移到合并后验证、自动定位并回滚。它不会让语义冲突消失，也不能证明一批彼此不冲突的代码组合起来仍然正确。

## 稀疏客户端：不要让每个 Agent 都背完整仓库

并发落地只解决写路径。`git-ai` 还实现了服务端对象读取、稀疏工作区、历史与 blame 查询、派生数据缓存、changeset 流等接口。其思路是让 Agent 只取任务涉及的路径，把“谁改过这一行”“两个提交是什么关系”这类需要历史的问题交给服务器计算并缓存。

底层仍是 Git 仓库，这一点与 Scion 很不一样，也让试验成本低一些：现有 Gitaly RPC 可以继续工作，普通 Git 客户端仍能走原有协议。代价是它没有获得 Scion 那种彻底脱离 packfile 和完整仓库副本后的数据模型；`git-ai` 更像是给 Git 服务器增加一条面向 Agent 的控制面，而不是新仓库格式。

## 我实际验证了什么

我把源码固定在提交 [`3b4528a4a8649cbca586d25270d36438a7482dc2`](https://github.com/feder-cr/git-ai/tree/3b4528a4a8649cbca586d25270d36438a7482dc2)，使用项目要求的 Go 1.26.0，并按仓库构建脚本编译了 master、previous、MVCC 三套捆绑 Git。随后运行：

```bash
go test -count=1 -json \
  ./internal/graft/landlane \
  ./internal/graft/rebase \
  ./internal/graft/identity \
  ./internal/graft/requestdefaults
```

测试日志共记录 **188 个测试或子测试通过、0 失败**，耗时约 16 秒。它覆盖了 lane 的排队、取消与自适应状态，rebase 的快进、重放、冲突和进程恢复，以及请求身份默认值等核心路径。

这项验证只能说明固定提交上的这些实现行为与项目测试一致，不能外推成生产可靠性或性能结论。我没有把项目的动画、README 性能描述当作独立结果，也没有在自己的机器上完成需要启动双套完整服务的 20/50/100 Agent 基准。

## 项目自己的基准，反而提示了最重要的限制

仓库自带的 phase 4a 记录使用一台 Intel Core Ultra 7 255H、16 逻辑 CPU 的 WSL2 环境，比较开启与关闭 batching 的结果。每个 Agent 提交 5 个改动，其中约 20% 被设计为冲突；作者也明确说明同机还有其他构建与测试负载，数字带有噪声。

结果并不是“批处理在所有指标上都更快”：

| Agent 数 | 开启 batching 的每次成功落地尝试数 | p99：关闭 / 开启 batching |
| ---: | ---: | ---: |
| 20 | 1.00 | 10,023 ms / 2,789 ms |
| 50 | 1.00 | 9,939 ms / 12,658 ms |
| 100 | 1.00 | 13,368 ms / 23,253 ms |

批处理把成功落地的 CAS 尝试稳定到 1 次，也避免了大量请求在 20 次后放弃；但 50 和 100 Agent 时，开启 batching 的 p99 反而更高，项目自己的验收标准因此判定失败。原因也很直白：同一 lane 一次只跑一个批次，成员的 rebase 仍然串行，队尾请求把节省的重试时间换成了排队时间。

所以更准确的判断是：**batching 已经缓解“大家反复撞同一扇门”，但还没有证明高并发下每个人都能更快进门。** 对排队策略、成员 rebase 并行度和尾延迟的优化，仍然是这个实验能否走向生产的关键。

## 哪些场景值得试，哪些场景先别动

它比较适合以下探索：

- 同一大型仓库里确实有几十个以上 Agent 高频提交，并已观察到分支更新重试或 merge queue 堵塞；
- Agent 工作区只需要少量目录，希望通过服务端 API 查询历史和对象；
- 团队愿意把 post-merge 验证、自动 bisect 与 revert 作为整体交付模型的一部分；
- 可以先在隔离仓库或影子模式中验证，而不是直接替换现有代码托管平台。

普通团队则很可能用不到它。如果每天只有几十次合并，Git worktree、短分支、现成的 merge queue 与 CI 已经足够成熟。为了一个还不存在的规模问题，引入新的服务端、token、策略、对象存储和运维路径，得到的复杂度可能远大于收益。

当前 `0.1.0` 版本还有明确边界：

- 它不是 GitHub 或 GitLab 替代品，没有 Web UI、Issue、合并请求流程和 CI；
- 只有 Go SDK 是受支持的客户端库，完整历史命令仍需要普通 clone；
- standalone 模式的策略和 Agent token 修改后要重启，配置与共享管理 token 必须由外部系统保护；
- changeset log 仍是每仓库一份无索引的 JSON Lines 文件，记录失败会留下缺口；
- 多节点行为尚未经过项目端到端测试，现有端到端覆盖集中在单机；
- Agent 不能自己创建仓库，仍需管理员凭据与原始 gRPC 调用；
- 接口在 1.0 前可能变化。

## 结论：先看拥堵发生在哪里，再决定要不要换道路

`git-ai` 现在最有价值的地方，是把“Agent 会不会需要新的版本控制”从抽象讨论变成了可以读源码、跑测试、检查失败基准的工程问题。它展示了一条合理路径：保持 Git 兼容，把稀疏读取、历史计算与高争用写入移到服务端，再用 CAS 和按分支批处理管理并发。

但项目自己的数据也说明，解决 CAS 争用只是第一步。吞吐、成功率、尾延迟、冲突处理和验证策略彼此牵制，没有一个动画可以同时证明它们。现在适合做的是在真实负载的副本上测量：到底慢在 clone、历史查询、CI，还是同一分支的落地；只有最后一种占主导时，git-ai 的 lane 与 batching 才切中了问题。

## 原始资料

- [Anthropic：Redesigning source control at Anthropic](https://www.anthropic.com/engineering/redesigning-source-control)
- [git-ai 源码仓库](https://github.com/feder-cr/git-ai)
- [固定提交：3b4528a](https://github.com/feder-cr/git-ai/tree/3b4528a4a8649cbca586d25270d36438a7482dc2)
- [Land batching 设计与行为](https://github.com/feder-cr/git-ai/blob/3b4528a4a8649cbca586d25270d36438a7482dc2/doc/graft/LAND-BATCHING.md)
- [Agent landing 基准与 phase 4a 结果](https://github.com/feder-cr/git-ai/blob/3b4528a4a8649cbca586d25270d36438a7482dc2/doc/graft/BENCH.md)
- [已知限制与路线图](https://github.com/feder-cr/git-ai/blob/3b4528a4a8649cbca586d25270d36438a7482dc2/doc/graft/LIMITATIONS.md)
- [MIT 许可证与上游 Gitaly 说明](https://github.com/feder-cr/git-ai/blob/3b4528a4a8649cbca586d25270d36438a7482dc2/LICENSE)
