---
title: 'Agent Substrate：让 Agent 休眠时归还机器，而不是丢掉现场'
date: 2026-11-09
slug: 'agent-substrate-actors-workers-snapshots'
author: 范伟彬
description: 'Agent Substrate 把有状态的 Actor 与可复用的 Worker 分离，通过快照、请求停放和沙箱恢复运行大量间歇工作的 Agent。本文拆解它的调度路径、安全边界、试用方法与 1.0 候选版的现实限制。'
source: 'https://opensource.googleblog.com/2026/11/sandboxing-untrusted-ai-agents-at-scale.html'
categories:
  - AI
  - 技术
  - 云原生
tags:
  - Agent Substrate
  - Kubernetes
  - gVisor
  - Agent Runtime
  - Sandbox
---

# Agent Substrate：让 Agent 休眠时归还机器，而不是丢掉现场

一个代码 Agent 写完一轮补丁后，可能要等模型推理、外部 API 或人工审核。它暂时不消耗 CPU，内存里却还留着解释器、Git 工作区和工具会话。一直保留专用 Pod 浪费资源，直接销毁又会丢掉现场，下一轮还得重新拉代码、装依赖、恢复进程。

Agent Substrate 试图解决的就是这个矛盾。Google 在 11 月 5 日宣布把它与 gVisor、OpenRL 捐给 CNCF Sandbox；同日开源仓库发布了 [`v1.0.0-rc.3`](https://github.com/agent-substrate/substrate/releases/tag/v1.0.0-rc.3)。它不是 Agent 编排框架，也不规定提示词和模型，而是在 Kubernetes 上增加一层面向“长期存在、间歇运行、有状态且不可信”工作负载的运行时：**空闲时把进程和文件系统做成快照，归还执行槽位；请求到来时，再把快照恢复到温热的 Worker 上。**

这件事现在值得关注，不只是因为项目进入 CNCF。更重要的是，它把 Agent 基础设施中常被混在一起的三个问题拆开了：Actor 保存状态与身份，Worker 提供短暂计算，网关负责唤醒、路由和凭据注入。这样才能讨论系统是否真的比“一名 Agent 一个 Pod”更省，而不是只换一个沙箱名字。

## Actor 像住客，Worker 像酒店房间

理解 Agent Substrate，先不要把 Actor 当成 Pod。

| 对象 | 保存什么 | 生命周期 |
| --- | --- | --- |
| Actor | Agent 的身份、内存与文件快照、网络规则、当前状态 | 可以长期存在，运行与休眠多次 |
| Worker | 预先启动的 Kubernetes Pod，以及 gVisor 或 microVM 执行环境 | 反复承接不同 Actor |
| WorkerPool | 一组温热 Worker 的容量与调度边界 | 由 Kubernetes 扩缩容 |
| ActorTemplate | OCI 镜像、资源和沙箱配置，用于生成初始快照 | 版本化且不可变 |

可以把 Actor 看成住客，把 Worker 看成酒店房间。住客离店时，行李和房间现场被记录下来，但不会永远占着某一间实体房；下次回来，可以在另一间准备好的房间恢复。这个比喻也揭示了成本：酒店必须有仓库、前台和调度系统，搬运行李也不是免费的。

项目的架构文档把 Kubernetes 留在它擅长的低频路径上：创建节点、Worker Pod 和扩缩 WorkerPool。Actor 的高频状态切换、分配关系和快照元数据则由独立控制平面与 PostgreSQL 保存，避免每次 Agent 唤醒都创建 Pod、写 etcd、等待 Kubernetes 调度器收敛。

## 一次请求如何唤醒休眠中的 Agent

当请求到达一个已经休眠的 Actor，大致会经过下面五步。

1. `atenet-router` 根据 Actor 标识拦住请求。如果 Actor 未运行，请求先被“停放”，而不是立即转发或创建新 Pod。
2. Substrate 控制平面从 WorkerPool 中选择有空位的 Worker，并原子地记录 Actor 与 Worker 的分配关系。
3. 节点上的 `atelet` 让 `ateworker` 调用 gVisor `runsc`，或 Kata 与 Cloud Hypervisor 组合，恢复内存、根文件系统和持久目录。
4. Actor 通过唤醒探针后，路由器才把原请求送进沙箱。
5. Actor 再次空闲时，运行时制作快照、释放 Worker 槽位；快照可先保留节点本地副本，再异步上传对象存储。

“请求停放”是这条路径里容易忽略的一环。WorkerPool 突然满载时，另一个 Actor 可能几百毫秒后就会休眠并腾出位置。Substrate 默认允许路由器在有限预算内重试，而不是立刻返回 `503`；同时又用最大停放数和超时限制队列，避免把短暂背压变成无限积压。相同 Actor 的并发唤醒还会合并为一次控制平面调用，减少惊群。

这也意味着恢复延迟不是一个固定数字。它取决于快照大小、是否命中节点本地副本、对象存储、节点压力和 Worker 是否有空位。Google 与项目文档给出的“500 毫秒内恢复”“更高密度”等数字属于项目方测试和目标，本次没有独立复现，不能直接套到自己的集群容量规划中。

## 快照不是一个开关，而是三种持久性承诺

官方 Counter 示例把快照分成三个保真度，这比笼统说“保存状态”更有用。

| 保真度 | 恢复后还在的状态 | 适合的场景 |
| --- | --- | --- |
| `VOLUMES` | 持久目录 | 进程可以重启，只要工作文件还在 |
| `ROOTFS` | 持久目录与根文件系统写入 | 需要保留已安装依赖和工作区，但不要求内存续接 |
| `MEMORY` | 内存、根文件系统与持久目录 | 需要从解释器、终端或工具会话原地继续 |

保真度越高，快照体积、上传成本和运行时兼容要求通常越高。`v1.0.0-rc.3` 的发布说明给出了一个很现实的例子：这次挂载方式和容器用户语义变化，会让旧版 gVisor `MEMORY` 快照无法恢复；带 `durableDir` 的 rc.2 快照也受影响。项目要求重建模板和 Actor，而不是承诺原地升级自动兼容。

因此，快照必须当成带版本的部署产物，而不是永远可读的备份。生产设计至少要记录运行时版本、镜像摘要、快照保真度和恢复演练结果，并为“快照失效后从文件或远端仓库重建”保留后路。

## 安全边界的重点是：沙箱里没有真实凭据

仅把 Agent 放进容器，仍然要面对提示注入后窃取密钥、横向访问邻居和触碰控制平面的问题。Agent Substrate 的安全设计有四个关键点：

- 每个 Actor 必须运行在独立 gVisor 或 Cloud Hypervisor microVM 中，普通 Linux 容器不是受支持的执行边界；
- Actor 默认没有横向网络、控制平面或任意出站访问，流量经过入口路由、DNS 中继和出口网关；
- 每个运行中的 Actor 有独立身份，组件之间使用 mTLS；
- API Key 和云令牌不放进沙箱，出口网关在策略允许的目标请求上代为注入凭据。

最后一点很重要。传统做法把密钥设成环境变量，Agent 一旦执行恶意命令就可能读取并外传。Substrate 让沙箱只提交“我要访问哪个服务”的请求，由边界外的网关根据 Actor 身份和目标策略换入真实凭据。

但“零凭据进沙箱”不等于安全问题已经结束。当前安全文档仍把 Actor 间内建授权、完整配额与抗拒绝服务等能力标为未来或进行中；出口 TLS 检查、目标白名单和自定义策略也需要平台团队正确配置。默认拒绝是一个好起点，不是无需治理的终点。

## 怎样在本地验证它是否真的恢复了现场

完整试用需要 Go、Docker、`kubectl` 和能够运行 gVisor 的 Kubernetes 环境。以下流程固定到本次核对的 `v1.0.0-rc.3`，避免 `main` 后续变化；标签对应提交 `4ee8f66ac237adfc3303086b12275aefc150fd6f`。

```bash
git clone --depth 1 --branch v1.0.0-rc.3 \
  https://github.com/agent-substrate/substrate.git
cd substrate

# 创建 kind 集群和本地镜像仓库
hack/create-kind-cluster.sh
export ATE_INSTALL_KIND=true

# 安装 Substrate；示例凭据提供器默认拒绝读取任何命名空间的 Secret
go run ./cmd/ate-setup deploy ate-system \
  --credential-provider='{"name":"k8s.io"}' \
  --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client

# 部署官方计数器示例并安装 kubectl 插件
go run ./cmd/ate-setup deploy demo counter
go install ./cmd/kubectl-ate

kubectl ate create actor my-counter-1 \
  -a ate-demo-counter --template counter
kubectl ate proxy actor my-counter-1 -a ate-demo-counter
```

在另一个终端连续执行一次请求、休眠、再请求：

```bash
curl -X POST http://localhost:8000/
kubectl ate suspend actor my-counter-1 -a ate-demo-counter --mode=sync
curl -X POST http://localhost:8000/
```

Counter 同时在内存、根文件系统和 `durableDir` 中保存计数。默认模板使用 `MEMORY` 保真度；如果第二次响应中的三个计数都从 `1` 变为 `2`，才说明这套环境完成了快照与恢复，而不只是重新启动了一个进程。

这套完整集群流程没有在本文构建环境中执行：当前环境没有 Docker、`kubectl` 和可用的嵌套沙箱。本文实际完成的是固定标签的源码拉取与提交校验；部署命令和预期输出来自同一标签的官方 Quickstart 与 Counter 文档。读者应在隔离的测试集群中执行，并在完成后运行 `./hack/delete-kind-cluster.sh` 清理资源。

## 它适合什么，不适合什么

Agent Substrate 最适合同时满足三个条件的工作负载：实例很多、单个实例大部分时间空闲、恢复时又必须保留较重状态。例如一人一个的代码工作区、长周期运维 Agent、并行评测沙箱，以及需要暂停后继续的强化学习环境。

如果任务几秒内就能无状态重建，普通 Job 或按需容器更简单；如果只有几十个长时间满负载的服务，快照和专用控制平面很难摊薄；如果平台团队还没有 Kubernetes、对象存储、数据库和网络策略的运维能力，Substrate 带来的复杂度可能高于节省的机器成本。它也不是 LangChain、ADK 或 Agent SDK 的替代品，上层仍要负责模型调用、任务编排和业务状态。

还要特别区分两个“1.0”。Google Cloud 公告称 Agent Substrate 达到 1.0，托管的 Agent Substrate on GKE 已 GA；但截至 11 月 9 日，开源仓库最新发布仍是 `v1.0.0-rc.3`，README 仍写着 pre-1.0、不保证向后兼容，且发布说明明确不支持从 v0.6.0 直接升级。评估开源自建方案时，应以仓库版本和迁移说明为准，不能把托管产品的 GA 状态等同于开源 API 已经稳定。

## 真正值得关注的是新的调度单位

Agent Substrate 最有价值的设计，不是某个“百万 Agent”数字，而是把调度单位从 Pod 改成 Actor。Pod 继续承载温热计算，Actor 承载可迁移的身份与状态，网关把一次外部请求转换成“找到容量、恢复现场、执行、再归还容量”的生命周期。

这条路线的成败最终取决于快照兼容性、对象存储成本、背压策略和安全边界能否经受真实故障，而不是演示中能唤醒多少实例。`v1.0.0-rc.3` 已经把这些难题暴露得相当具体：快照会失效，升级会中断，网关要限流，沙箱外还要做身份和凭据治理。对于准备运行大量有状态 Agent 的平台团队，这些限制本身，反而比一句“更高密度”更值得现在开始验证。

## 原始资料

- [Google Open Source Blog：项目捐赠与 Actor/Worker 生命周期](https://opensource.googleblog.com/2026/11/sandboxing-untrusted-ai-agents-at-scale.html)
- [Agent Substrate `v1.0.0-rc.3` 发布说明](https://github.com/agent-substrate/substrate/releases/tag/v1.0.0-rc.3)
- [架构文档：控制平面、Actor、Worker 与快照路径](https://github.com/agent-substrate/substrate/blob/v1.0.0-rc.3/docs/concepts/architecture.md)
- [安全模型：沙箱、网络、身份与凭据边界](https://github.com/agent-substrate/substrate/blob/v1.0.0-rc.3/docs/security/security.md)
- [官方 Counter 示例：三种快照保真度与恢复验证](https://github.com/agent-substrate/substrate/blob/v1.0.0-rc.3/demos/counter/README.md)

