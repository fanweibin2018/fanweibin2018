---
title: 'OpenShell 把 Agent 权限下沉到内核：提示词拦不住的操作怎样被真正拒绝'
date: 2026-09-30
slug: 'nvidia-openshell-agent-runtime'
author: 范伟彬
description: '拆解 NVIDIA OpenShell 的沙箱、Supervisor、凭据注入和策略证明机制，并用 0.1.2 的 policy prover 实测一条越权写入如何被识别。'
categories:
  - AI
  - 开源项目
tags:
  - NVIDIA OpenShell
  - AI Agent
  - 沙箱
  - 安全
  - 策略验证
---

# OpenShell 把 Agent 权限下沉到内核：提示词拦不住的操作怎样被真正拒绝

“不要读取密钥”“不要访问内网”“执行删除前先确认”，这些话写进 Agent 的系统提示词很有用，却不是安全边界。模型可能误解指令，工具也可能被提示注入诱导；只要进程仍拥有文件和网络权限，一句自然语言就无法保证它永远不用。

NVIDIA 在 **2026 年 9 月 28 日**发布 [Open Agent Safety Platform](https://nvidianews.nvidia.com/news/open-agent-safety-platform)，其中开源的 [OpenShell](https://github.com/NVIDIA/OpenShell)负责软件侧运行时边界。同一天发布的 [OpenShell 0.1.2](https://github.com/NVIDIA/OpenShell/releases/tag/v0.1.2)已经提供独立策略验证器、Docker、Podman、Kubernetes 和 MicroVM 等运行方式。截至 9 月 30 日，GitHub 仓库约有 1.06 万 Star；这个数字只能说明关注度，不能证明安全效果或生产采用。

OpenShell 值得理解的地方，不是又多了一个 Agent 框架，而是它把“Agent 可以做什么”的决定从模型提示词移到了模型够不到的系统层。

## 先把 Agent 和裁判分开

可以把普通 Agent 想成拿着公司门禁卡的实习生：你告诉他只进资料室，但那张卡实际上能开所有门。OpenShell 的做法是收回万能门禁卡，给每扇门安排独立门禁；实习生每次刷卡，门禁系统都根据规则决定是否放行。

一次网络访问大致经过下面几步：

1. Agent 在隔离的工作负载里发起 DNS 查询或 TCP 连接。
2. Sandbox 用受信任的进程信息识别真正发起请求的程序。
3. 请求经受保护的通道交给 Sandbox 外的 Supervisor。
4. Supervisor 按策略检查主机、端口、程序以及 HTTP 方法和路径。
5. 只有通过检查，Supervisor 才建立真实连接；需要凭据时，也是在这里注入。

工作负载没有直接出网通道：Docker 和 Podman 会关闭工作负载容器的网络，Kubernetes 依赖 `NetworkPolicy`，MicroVM 则不给来宾系统网络设备。Linux 后端还使用 Landlock 限制文件访问，用 seccomp user notification 截获网络操作。Agent 与策略裁决者分居边界两侧，即使 Agent 控制了自己的进程，也拿不到 Supervisor 保存的服务凭据。

这比“让 Agent 自觉”多了两个关键保证：拒绝发生在操作执行前；策略和真实凭据不在 Agent 可以改写的上下文里。

## 一份策略具体限制什么

OpenShell 的 YAML 策略可以约束四类能力：

| 范围 | 可以限制的内容 | 生效方式 |
|---|---|---|
| 文件系统 | 只读路径、可写路径 | 创建 Sandbox 时确定 |
| 进程 | 运行用户和用户组 | 创建 Sandbox 时确定 |
| 网络 | 程序、域名、端口、目标 IP | 运行时可热更新 |
| 应用协议 | REST 方法与路径，以及部分 GraphQL、MCP、JSON-RPC 规则 | 运行时可热更新 |

例如，同样是访问 GitHub，可以只允许 `/usr/bin/gh` 对某个仓库的 `docs/**` 路径发起 `PUT`，而不是给整个 Sandbox 一张“可访问 `api.github.com`”的通行证。Provider 凭据还可以绑定到批准的端点：Agent 进程只看到占位符，Supervisor 在请求离开边界前替换它，密钥不必进入 Agent 的环境变量。

网络规则被拒绝后，Agent 可以通过 [Policy Advisor](https://docs.nvidia.com/openshell/latest/how-it-works/policies/advisor)提出一条更窄的新规则，但不能自行使它生效。默认模式下，人要查看新增主机、端口、程序和路径后批准；规则批准后可以热加载，不必重启任务。

自动批准需要谨慎。OpenShell 会检查云元数据地址、私网目标、凭据可达范围和新增 HTTP 方法等风险，但文档明确指出：没有关联凭据的新公网主机不一定被判为风险。开启自动模式，就等于接受 Agent 可能在无人复核时获得新的公网访问权。

## “策略证明”到底证明了什么

手写策略也会出错。允许列表一长，很难仅靠代码审查看出某条新规则是否把边界扩大了。OpenShell 的 Policy Prover 使用 SMT 求解器，把候选策略允许的操作与一份上限策略进行比较。

上限策略不是日常运行配置，而是组织能够接受的最大权限。例如下面这份 `boundary.yaml` 只允许读取 `/usr` 和 `/etc`，没有授予任何写权限：

```yaml
version: 1
filesystem_policy:
  read_only:
    - /usr
    - /etc
```

候选策略多申请了 `/tmp` 写权限：

```yaml
version: 1
filesystem_policy:
  read_only:
    - /usr
    - /etc
  read_write:
    - /tmp
```

我下载了 0.1.2 发布页中的 Linux x86_64 独立二进制，在不启动 Gateway 和 Sandbox 的情况下运行：

```bash
openshell-prover check candidate.yaml \
  --boundary boundary.yaml \
  --output json
```

结果退出码为 `1`，并给出具体反例：

```json
{
  "prover_version": "0.1.2",
  "result": "exceeds_boundary",
  "exit_code": 1,
  "counterexample": {
    "domain": "filesystem",
    "access": "write",
    "path": "/tmp"
  }
}
```

把候选策略改成只读 `/usr` 和 `/etc` 后，同一命令返回 `within_boundary` 和退出码 `0`。这使它适合进入 CI：Agent 或开发者可以生成具体策略，但合并前必须证明没有越过组织设定的上限。

这里的“证明”不能理解成“整个系统已经安全”。它证明的是：在验证器当前建模的范围内，候选策略没有比边界策略授予更多能力。0.1.2 覆盖文件、L4 网络、REST、进程身份和 Landlock；GraphQL、MCP 等策略形状可能返回 `unsupported`。我还实测了 `/tmp/cache` 与边界中的 `/tmp` 这种看似包含的路径，验证器会因为无法排除符号链接影响而保守返回 `unsupported`，而不是猜测它安全。

自动化里应该只把 `within_boundary` 当作通过；`exceeds_boundary`、`unsupported`、`inconclusive` 和 `error` 都需要停下来处理。

## 它解决不了哪些问题

OpenShell 缩小的是进程能够触达的范围，不负责判断 Agent 的业务决定是否正确。一个 Agent 即使只能修改指定仓库，也可能在允许的文件里写入错误代码；即使只能调用某个付款 API，也可能在已允许的额度内选错收款方。业务审批、数据校验、回滚和审计仍然需要保留。

运行环境也有明确前提。完整 Sandbox 需要 Docker、Podman、Kubernetes 或受支持的虚拟化方案；Linux 文件隔离要求 Landlock ABI 3 或更高，网络中介还依赖相应的 seccomp 能力。`landlock.compatibility` 默认的 `best_effort` 在规则无法实施时可能继续运行并记录高等级告警；对文件边界有硬要求的场景，应评估 `hard_requirement`，让 Sandbox 在无法强制策略时拒绝启动。

此外，9 月 28 日公告中的 NVIDIA Sentry 是运行在 BlueField-4 DPU 上的带外监控参考设计，和开源 OpenShell 不是同一个组件。OpenShell 可以单独使用，但不能因为安装了它，就声称获得了 Sentry 所描述的硬件隔离与毫秒级隔离能力。

## 哪些团队值得现在试

最合适的起点，是已经让编码 Agent、数据 Agent 或运维 Agent 执行命令，同时又不愿把开发机、生产网络和长期凭据全部交给模型的团队。先挑一个权限容易写清楚的任务：限定一个工作目录、少数软件源和一个代码仓库；关闭自动批准；把有效策略导出到版本库，再用 Prover 在 CI 中检查上限。

如果任务必须访问大量动态域名、依赖未建模的协议，或者运行环境无法提供所需内核能力，接入成本可能高于收益。此时至少应继续使用一次性凭据、独立账户、最小权限容器和人工审批，而不是把系统提示词当作访问控制。

OpenShell 给出的方向比某个版本更重要：Agent 越能长期运行、调用工具和自我扩展，安全边界就越不能由同一个 Agent 自己解释。模型负责计划，操作系统和外部策略引擎负责说“不”，两者分开才有可验证的控制。

## 原始资料

- [NVIDIA Open Agent Safety Platform 公告（2026-09-28）](https://nvidianews.nvidia.com/news/open-agent-safety-platform)
- [OpenShell 0.1.2 发布说明（2026-09-28）](https://github.com/NVIDIA/OpenShell/releases/tag/v0.1.2)
- [OpenShell 源码仓库](https://github.com/NVIDIA/OpenShell)
- [OpenShell 架构文档](https://docs.nvidia.com/openshell/latest/about/architecture)
- [Policy Prover 文档](https://docs.nvidia.com/openshell/latest/how-it-works/policies/prover)
- [Policy Advisor 文档](https://docs.nvidia.com/openshell/latest/how-it-works/policies/advisor)
- [策略 Schema 与支持范围](https://docs.nvidia.com/openshell/latest/how-it-works/policies/schema)
- [运行环境支持矩阵](https://docs.nvidia.com/openshell/latest/about/support-matrix)
