---
title: 'Pydantic Pax：把编程 Agent 拆成可替换的 Harness'
date: 2026-11-28
slug: 'pydantic-pax-composable-agent-harness'
author: 范伟彬
description: 'Pydantic 新发布的 Pax 不只是一款终端编程 Agent，而是 Pydantic AI Harness 的可操作样例：模型循环、工作区、编码能力、沙箱和终端界面可以分层组合。本文解释四层结构、插件与工作区机制、试用方法及 beta 阶段的权限和评测边界。'
source: 'https://pydantic.dev/articles/pax-harness-beta'
categories:
  - 人工智能
  - 技术
  - 开源
  - 开发者工具
tags:
  - Pydantic AI
  - Pax
  - AI Agent
  - Coding Agent
  - Harness
  - Python
---

# Pydantic Pax：把编程 Agent 拆成可替换的 Harness

11 月 25 日，Pydantic 发布了 Pax，并把 Pydantic AI Harness 推进到 1.0 前的 beta 阶段。Pax 看起来像又一个能读代码、改文件和运行命令的终端 Agent，但这次发布更值得关注的地方，是 Pydantic 把“编程 Agent”从一个完整产品拆成了几层可以单独使用和替换的能力。

你可以直接运行 Pax，也可以只拿它底下的 `Coder()` 组装自己的 Agent；可以在本机工作区执行，也可以把同一组文件和 Shell 工具接到云端沙箱；甚至可以关闭编码插件，把 Pax 只当成自己 Agent 的终端界面。

这提供了一个很具体的判断标准：如果你只是想用一个现成的编程助手，Pax 是新的候选；如果你正在做内部 Agent、代码审查器或自动化运维工具，它更像一套可以拆装的底盘。

## 为什么“模型加几个工具”还不够

一个最小 Agent 往往只有一个循环：把消息发给模型，模型选择工具，工具结果再送回模型，直到生成答案。它适合演示，却没有回答真实任务中的许多问题：

- Agent 在哪一个目录工作，能看到和修改哪些文件？
- Shell 命令在本机、容器还是远程沙箱执行？
- 对话太长时怎样压缩上下文？
- 任务中断后能否恢复，多个任务能否并行？
- 哪些操作需要批准，第三方插件能获得多大权限？
- 同一个 Agent 怎样同时提供终端、网页或无交互入口？

Harness 指的就是模型循环外面这一圈工程设施。可以把模型想成司机，工具是方向盘和踏板；Harness 则包括车身、仪表盘、安全带、导航和维修记录。换一名司机并不会自动得到一辆能上路的车。

Pydantic 这次把相关组件分成四层：

| 层级 | 负责什么 | 更适合谁 |
| --- | --- | --- |
| Pydantic AI | 模型循环、工具、结构化输出和 Capability 机制 | 在应用里构建 Agent 或 LLM 功能 |
| Pydantic AI Harness | 工作区、文件与 Shell 工具、记忆、子 Agent、上下文管理等能力 | 需要组装生产级 Agent 的开发者 |
| `Coder()` | 把编程任务常用能力打包成一个 Capability | 想把编程 Agent 嵌入自己代码的团队 |
| Pax | `Coder()` 上面的终端界面，并用插件补充登录、会话、MCP 等功能 | 想直接使用或交互调试 Agent 的开发者 |

关键点是这些层并不要求一起使用。`pydantic-ai-pax` 会安装 Harness，Harness 又建立在精简版 Pydantic AI 上；但应用可以只依赖 `Coder()`，从来不打开 Pax。反过来，Pax 也能通过 `--agent` 加载项目里的任意 Pydantic AI `Agent`，不使用默认编码插件。

## Capability 与插件不是同一个层次

Pydantic AI 的 Capability 是一组可以附加到 Agent 的工具、指令和钩子。`Coder()` 本身就是一个组合能力：它提供文件与 Shell 工具、仓库上下文、任务委派和长任务所需的上下文管理。

Pax 的插件在 Capability 外面再加一层终端能力，例如斜杠命令、状态栏、登录和配置界面。默认启用的插件包括编码工具、会话持久化、上下文压缩、仓库说明文件、MCP、通知和可观测性。

这一区分很实用。若你要在服务端运行一个自动审查器，通常不需要终端菜单和主题设置，只要 `Coder()` 及受控工作区；若你要给工程师做一个可交互工具，才需要 Pax 这一层管理登录、会话恢复和插件开关。

官方给出的组合方式很短：

```python
from pydantic_ai import Agent
from pydantic_ai.capabilities import LocalWorkspace
from pydantic_ai_harness import Coder

reviewer = Agent(
    "openai:gpt-6.1-sol",
    instructions="审查当前仓库的改动，指出可验证的风险。",
    capabilities=[LocalWorkspace("."), Coder()],
)
```

`LocalWorkspace(".")` 决定工具作用于当前目录，`Coder()` 决定 Agent 获得哪些编程能力，模型和审查指令仍由应用自己选择。这比继承一整套固定编程助手更容易做权限收缩、替换模型和增加内部规则。

## 工作区抽象让工具不必认识每一种沙箱

文件和 Shell 工具不是直接绑定本机路径，而是面向统一的 Workspace 接口。把 `LocalWorkspace` 换成 `E2BSandbox` 等沙箱 Capability 后，`Coder()` 的工具代码不需要跟着改：

```python
from pydantic_ai import Agent
from pydantic_ai_harness import Coder, E2BSandbox

agent = Agent(
    "anthropic:claude-sonnet-5-5",
    capabilities=[E2BSandbox(), Coder()],
)
```

在 Pax 中，同一个选择被做成 `/sandbox` 命令。官方文档列出的后端包括 E2B、Daytona、OpenSandbox、Modal、Render、Kubernetes，以及本地微型虚拟机方案。Pax 会把当前分支与未提交差异同步进沙箱，让编辑、构建和 `!` 命令在那里执行。

这并不意味着“选了沙箱就自动安全”。不同后端的网络、凭据注入、文件同步和销毁策略不同；第三方插件本身也是以用户身份运行的 Python 代码。工作区抽象解决的是可替换性，不会替你定义可信边界。

## 先做一个不调用模型的冒烟测试

Pax 需要 Python 3.11 或更高版本。官方建议用 `uv` 安装；只想试一下，可以直接运行：

```bash
uvx pydantic-ai-pax --version
uvx pydantic-ai-pax --help
```

我在 Python 3.12.14、uv 0.13.9 的 Linux 环境中实际执行了这两条命令。2026 年 11 月 28 日解析到的 Pax 版本为 0.77.0，帮助信息列出了 `--agent`、`--model`、`--prompt`、`--resume`、`--worktree` 和 `--web` 等入口。包版本会继续变化，因此不要把 0.77.0 写死进安装脚本。

下面的 Python 冒烟测试不会发起模型请求，也不需要 API Key。它只验证当前包能否导入，以及 `LocalWorkspace` 与 `Coder()` 能否组合成一个 Agent：

```python
from importlib.metadata import version

from pydantic_ai import Agent
from pydantic_ai.capabilities import LocalWorkspace
from pydantic_ai_harness import Coder

agent = Agent(
    "test",
    capabilities=[LocalWorkspace("."), Coder()],
)

print("pydantic-ai-pax", version("pydantic-ai-pax"))
print(type(agent).__name__)
print("agent-created")
```

我在独立虚拟环境安装 `pydantic-ai-pax` 后运行，输出为：

```text
pydantic-ai-pax 0.77.0
Agent
agent-created
```

这个测试只证明依赖安装和对象组装成功，不证明真实模型、文件修改或远程沙箱已经可用。真正开始交互时，可以在自己的项目目录运行 `uvx pydantic-ai-pax`，再按终端提示登录或选择模型。官方文档还提供 `pax -p "..."` 的单次无交互模式，以及 `pax --agent my_module:agent` 加载自定义 Agent 的方式。

## 最需要先看的是权限，而不是模型排行榜

Pax 默认面向开发者工作区，能够读取、编辑文件并运行命令。官方文档明确提醒：本地模式会以当前用户身份操作，应只在信任的项目中运行。第一次进入目录时出现的“是否信任”提示，主要决定仓库里的说明文件和技能以什么权限进入上下文，不能把它误解成操作系统级沙箱。

更稳妥的试用顺序是：

1. 先在临时仓库或无敏感信息的副本中启动；
2. 检查 Agent 发现了哪些仓库说明、插件和工具；
3. 关闭不需要的插件，尤其是不明来源的 Python 插件；
4. 对会执行构建脚本或处理外部代码的任务使用隔离工作区；
5. 明确网络出口、密钥注入和生成文件的回收方式；
6. 最后再连接真实仓库和付费模型。

Pydantic 在 11 月 25 日的版本说明中还调整了仓库指令的 authority 处理：低于 operator 权限的工作区文件不再直接进入系统指令，而是作为数据或通过工具提供。这说明团队正在处理提示词来源与权限边界，但也说明相关接口仍在快速变化。

## 厂商基准能说明什么，不能说明什么

Pydantic 公布了 Pax 在 Harness-Bench SWE81 上的自测结果，并称它在八个模型的平均分上略高于几个对比 Harness。这个结果至少说明 Harness 本身可能显著影响同一模型的工具使用、上下文成本和任务完成率，不能只用模型名称预测 Agent 表现。

但这些数据还不能证明 Pax 已经稳定优于其他工具。官方说明这是 11 月的单次运行，部分模型使用了放宽后的重评分方式，Pax 在 GPT-6.2 Sol 上还启用了不提问的最高自主模式；完整方法和重复运行要等 1.0 发布时补充。它是开发团队的早期测量，不是独立复现。

更实际的选型方式，是拿自己的仓库准备一组固定任务，同时记录：是否完成、改错了什么、执行过哪些命令、用了多少 Token、需要几次人工干预，以及失败后能否恢复。编程 Agent 的价值经常来自 Harness 的约束和恢复能力，而不是一次排行榜分数。

## 它适合什么，不适合什么

Pax 目前适合三类试用。

第一类是想比较不同模型、但不想反复更换整套编程工具的开发者。Pax 把模型选择、会话和工作区放在同一界面中。第二类是已有 Pydantic AI Agent、需要一个终端入口做人工调试的团队。第三类是准备自建编程 Harness，希望复用文件、Shell、上下文管理和沙箱适配的 Python 项目。

它不适合在没有隔离设计的情况下直接处理陌生仓库或敏感生产环境；也不适合把 beta API 当成已经稳定的长期接口。官方计划在约一个月后推进 1.0，恰好意味着现在适合压力测试和反馈，不意味着迁移成本已经消失。

还有一条容易被忽略的边界：Harness 的持久执行能力已经可供基于 SDK 的 Agent 使用，但官方发布说明明确写着它尚未进入 Pax。不能因为底层库具备某项能力，就假定终端产品已经完整暴露。

## 真正值得借鉴的是分层方式

Pax 会不会成为常用编程助手，还要看 1.0 前后的稳定性、生态和真实任务表现。现在已经可以借鉴的，是它对 Agent 产品边界的划分：模型循环不是工作区，编程能力不是终端界面，沙箱也不是一组 Shell 工具的同义词。

这种分层让团队可以单独回答几个重要问题：模型能做什么，工具在哪里执行，哪些能力可以替换，谁负责批准危险操作，界面如何保存和恢复任务。把这些问题混进一个“全能 Agent”开关里，上手很快，却很难审计；把它们拆成明确的 Capability、Workspace 和插件，初始配置更多，但更接近可以维护的软件系统。

对于想试用的人，最合理的起点不是立即把 Pax 指向主仓库，而是先完成版本与导入冒烟测试，再在临时项目中观察一次完整轨迹。对于想构建 Agent 的人，更值得先写下自己真正需要的能力清单，然后决定使用完整 Pax、只用 `Coder()`，还是只复用 Harness 的某几个组件。

## 原始资料

- [Pydantic：Introducing Pax and the Pydantic AI Harness beta](https://pydantic.dev/articles/pax-harness-beta)
- [Pydantic 文档：Pax](https://pydantic.dev/docs/ai/pax/)
- [Pydantic 文档：Harness](https://pydantic.dev/docs/ai/harness/)
- [GitHub：pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai)
- [GitHub：v2.75.0 发布说明](https://github.com/pydantic/pydantic-ai/releases/tag/v2.75.0)
- [PyPI：pydantic-ai-pax](https://pypi.org/project/pydantic-ai-pax/)
