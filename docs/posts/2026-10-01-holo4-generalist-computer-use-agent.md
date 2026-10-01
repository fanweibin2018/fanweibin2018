---
title: 'Holo4 不只会点鼠标：电脑智能体为什么开始在 GUI、Shell 与工具之间换挡'
date: 2026-10-01
slug: 'holo4-generalist-computer-use-agent'
author: 范伟彬
description: '拆解 Holo4 如何用同一模型操作 GUI、执行代码并调用工具，并从一条公开轨迹核对它的真实步骤、上下文开销与落地边界。'
categories:
  - AI
  - 开源项目
tags:
  - Holo4
  - Computer Use
  - AI Agent
  - GUI 自动化
  - MCP
---

# Holo4 不只会点鼠标：电脑智能体为什么开始在 GUI、Shell 与工具之间换挡

让 AI 操作电脑，最直观的办法是让它看截图、点按钮、敲键盘。但如果任务是“解压一个浏览器扩展，再把它加载到 Chrome”，全程模拟鼠标并不聪明：解压和查文件适合命令行，打开扩展管理页只能依赖图形界面，确认结果又要重新看屏幕。

H Company 在 **2026 年 9 月 28 日**发布的 [Holo4](https://huggingface.co/blog/Hcompany/holo4)，试图让同一个模型自己选择接口。它可以操作 GUI，也可以执行代码，调用 MCP 或普通 API；不是为每种入口切换一套模型，而是在任务过程中决定下一步该拿鼠标、终端还是工具。

这比“点击更准”更值得关注。真实工作往往横跨没有统一 API 的旧软件、适合批处理的本地文件和结构化的在线服务。一个电脑智能体若只能使用单一入口，就像维修工只有一把螺丝刀：再熟练，也会在该用扳手的地方浪费力气。

## 模型只提议动作，运行框架负责真的动手

Holo4-27B 是基于 Qwen3.8-27B 的稠密视觉语言模型；另一个 Holo4-35B-A3B 使用混合专家架构，每次推理激活约 3B 参数。两者接收截图、工具返回值和任务上下文，输出下一步动作，但模型本身不会凭空控制电脑。

完整循环需要外部运行框架参与：

1. 截取当前屏幕，连同上一步工具结果一起交给模型。
2. 模型判断下一步该点击、输入、运行代码还是调用工具。
3. 运行框架检查参数并执行动作。
4. 新截图或执行结果回到上下文，模型继续决策。
5. 直到任务完成、失败或触发步数与权限限制。

所以，部署一个 Holo4 推理端点只得到“大脑”，不会自动得到可用的桌面智能体。截图采集、坐标映射、Shell、浏览器状态、长任务记忆、重试和权限控制都在外部系统里。官方模型卡给出的 SGLang、llama.cpp 等示例能启动模型服务，却不能替代这一整套执行循环。

Holo4 的关键训练方向，是让同一个“大脑”见过不同工具。官方称其 Agentic Task Factory 生成了约一万项可验证任务，覆盖网页、桌面和 MCP 环境；训练同时使用监督学习与强化学习。任务能自动检查最终状态，模型获得的反馈不只是“这句话像不像正确答案”，而是文件、应用或业务系统是否真的变成了目标状态。

## 一条公开轨迹怎样在 Shell 和 GUI 之间切换

H Company 公布了 [7,366 条评测轨迹](https://huggingface.co/datasets/Hcompany/trajectories)，每条包含任务、逐步思考、动作、工具返回、截图引用、验证结果和 Token 用量。它们比演示视频更有用，因为可以看到失败、绕路和成本，而不只是最终成功画面。

其中一条 OSWorld 轨迹要求智能体把下载的扩展解压到桌面，再在 Chrome 中加载。Holo4-27B 先连续调用 Shell 查找压缩包、查看 `manifest.json`、列出归档内容并解压；文件准备好后，再切回 GUI 打开扩展管理页并完成配置。整条轨迹共 14 步，最终验证通过。

下面的 Python 代码只使用标准库，直接读取这条公开轨迹并统计动作。我在 Python 3.12 环境实际运行过；它不会下载模型，也不会操作本机桌面。

```python
import json
import urllib.request
from collections import Counter

TRACE_URL = (
    "https://huggingface.co/datasets/Hcompany/trajectories/resolve/main/"
    "data/t/chrome-12-8b677b74.json"
)

with urllib.request.urlopen(TRACE_URL, timeout=30) as response:
    trace = json.load(response)

actions = Counter(
    call["name"]
    for step in trace["steps"]
    for call in step.get("calls", [])
)

print(f"task: {trace['instruction']}")
print(f"result: success={trace['success']}, score={trace['score']}")
print(f"steps: {len(trace['steps'])}")
print("actions:", dict(actions))
print("usage:", trace["usage"])
```

输出为：

```text
task: Could you help me unzip the downloaded extension file from /home/user/Desktop/ to /home/user/Desktop/ and configure it in Chrome's extensions?
result: success=True, score=1.0
steps: 14
actions: {'shell': 5, 'write_at_desktop': 1, 'wait_desktop': 2, 'click_desktop': 5, 'answer': 1}
usage: {'prompt_tokens': 320463, 'completion_tokens': 3317, 'reasoning_tokens': 2068, 'cached_tokens': 186592}
```

这里的 320,463 个输入 Token 是 14 次模型调用的累计值，其中 186,592 个命中缓存；它不表示单次上下文超过模型卡所列的 262,144 Token 上限。这个数字仍然揭示了电脑智能体容易被忽略的成本：截图、工具定义和历史会在每一步反复进入上下文，一个看似简单的任务也可能产生大量输入。

轨迹还说明“多接口”并不等于盲目使用更多工具。查找和解压文件时，Shell 能一次返回确定结果；到了 Chrome 的扩展页面，没有合适 API，GUI 才是正确入口。真正有价值的是按任务状态换挡，而不是把鼠标、代码和 MCP 全部用一遍。

## 亮眼分数不能混在一张表里读

官方模型卡报告 Holo4-27B 在原版 OSWorld 上取得 85.2%，在 OSWorld 2.0 上是 61.7%；Holo4-35B-A3B 在 OSWorld 2.0 上只有 30.9%。这至少说明两件事：稀疏模型激活参数少，不代表电脑操作一定更强；“OSWorld 85.2%”也不能简写成“电脑任务成功率 85.2%”。

原版 OSWorld 与 OSWorld 2.0 的任务、环境和难度不同。Holo4 发布页还明确注明，对比图中的模型可能使用不同版本、运行框架和任务子集。AutomationBench 的情况更复杂：Holo4 的 45.4% 来自官方内部框架运行的公开任务集，而榜单上的其他成本与成绩有的来自更难的私有任务集，不能直接据此宣布它击败了某个闭源模型。

公开轨迹让这些数字更容易审计，但还不是独立复现。数据由模型发布方生成，环境、提示词和运行框架都会影响结果。更稳妥的判断方式是先找与你业务最接近的任务，检查成功与失败轨迹，再用自己的权限、网络和应用版本做小规模重跑。

## 开放权重不等于拿来就能商用

Holo4-27B 提供 BF16、FP8、NVFP4 和 4 位 GGUF 等权重。4 位 GGUF 文件约 16.9 GB，方便在本地工具中加载，但文件大小不等于完整运行所需内存：长上下文的 KV Cache、视觉输入和运行框架还会继续占用资源。

更重要的是，Holo4 权重采用 **CC BY-NC 4.0**，包含“非商业”限制。它适合研究、评估和原型验证，但不能因为权重可下载，就把它描述成可自由用于商业产品的宽松开源模型。官方公开的 Python SDK 使用 MIT 许可证，SDK 与模型权重是两件不同的东西。

如果只是想判断模型是否适合团队，实践顺序可以更轻：

1. 先在轨迹数据集中筛选与你的应用相近的任务，统计成功率、步数和动作类型。
2. 用托管 API 或本地量化权重测试截图理解与工具选择，不急着授予真实账号权限。
3. 把动作执行放进隔离环境，限制文件目录、网络目标、工具参数和最大步数。
4. 最后才接入测试账号与可回滚数据，记录每一步输入、动作和结果。

## 它目前最适合什么任务

Holo4 更适合入口混杂、步骤可验证、失败可回滚的工作，例如整理本地文件后录入网页、从桌面软件导出结果再调用业务 API、或在没有统一接口的应用之间搬运结构化数据。只做纯 API 编排时，专门的工具调用模型通常更简单；只识别一张截图时，也没必要承担完整 Agent 循环的成本。

高风险任务仍不适合无监督放行。截图可能包含提示注入，Shell 可以接触超出任务范围的文件，GUI 点击也可能碰到不可逆操作。模型会不会选择正确工具，与系统是否允许它执行危险动作，是两个问题。生产环境需要把授权、审批和审计留在模型之外。

Holo4 展示的变化，不是电脑智能体已经可靠替代人，而是它们开始从“会看屏幕的自动点击器”变成“能选择操作面的执行者”。当模型可以在 GUI、代码与协议工具之间切换，效率上限确实提高了；同时，运行框架、上下文成本和权限边界也变得和模型能力同样重要。

## 原始资料

- [Holo4 发布说明（2026-09-28）](https://huggingface.co/blog/Hcompany/holo4)
- [Holo4-27B 模型卡](https://huggingface.co/Hcompany/Holo4-27B)
- [Holo4-27B 4 位 GGUF 模型卡](https://huggingface.co/Hcompany/Holo4-27B-GGUF)
- [Holo4 公开评测轨迹数据集](https://huggingface.co/datasets/Hcompany/trajectories)
- [本文复现使用的完整轨迹](https://huggingface.co/datasets/Hcompany/trajectories/blob/main/data/t/chrome-12-8b677b74.json)
- [H Company Agents API Python SDK](https://github.com/hcompai/hai-agents-python)
- [OSWorld 2.0 仓库与版本说明](https://github.com/xlang-ai/OSWorld-V2)
- [AutomationBench 仓库与公开/私有任务说明](https://github.com/zapier/AutomationBench)
