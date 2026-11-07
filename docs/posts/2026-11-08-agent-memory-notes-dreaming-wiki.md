---
title: 'Agent 记忆为什么需要“做梦”：笔记、日志与 Wiki 如何分工'
date: 2026-11-08
slug: 'agent-memory-notes-dreaming-wiki'
author: 范伟彬
description: 'Anthropic 的 Agent 记忆实验把跨会话记忆拆成原始日志、在线笔记、离线整理、知识 Wiki 与注入上下文。本文解释每层解决什么问题、何时反而有害，并用可运行的标准库示例复现错误笔记被证据纠正的过程。'
source: 'https://www.anthropic.com/research/components-of-agent-memory'
categories:
  - AI
  - 技术
  - Agent
tags:
  - Agent Memory
  - Anthropic
  - Dreaming
  - Knowledge Wiki
  - 上下文工程
---

# Agent 记忆为什么需要“做梦”：笔记、日志与 Wiki 如何分工

Anthropic 在 11 月 6 日公开了一组 [Agent 记忆实验](https://www.anthropic.com/research/components-of-agent-memory)。它讨论的不是怎样把整段聊天永久保存，而是一个更难的问题：Agent 在任务进行时并不知道未来会问什么，怎样判断什么值得记；一旦记错，又怎样避免错误在后续会话中不断被信任。

这件事现在值得关注，因为“给 Agent 加记忆”已经很容易做成产品功能，真正困难的却是记忆的生命周期。把历史消息全塞回上下文会越来越贵；只保存摘要可能丢失证据；把摘要整理成 Wiki 又可能制造重复、冲突和幻觉。Anthropic 的实验给出的重要结论不是某一种存储格式获胜，而是不同层应该承担不同职责：**原始日志负责保留证据，在线笔记负责快速记下线索，离线整理负责纠错和重组，Wiki 负责导航，真正注入每次会话的内容则必须保持很小。**

## 先把“记忆”与三件相似的事分开

Anthropic 在这项研究中把 Agent 记忆定义为：模型从交互和任务经验中获得、跨会话保留，并能在以后重新读取的外部上下文。这个定义排除了三种常被混为一谈的机制。

| 机制 | 发生在哪里 | 会不会跨会话 | 解决的问题 |
| --- | --- | --- | --- |
| 上下文内学习 | 当前提示词和对话窗口 | 默认不会 | 利用眼前给出的示例和信息 |
| Compaction | 当前长会话的压缩摘要 | 可以接续当前任务，但不等同长期知识 | 腾出上下文空间 |
| 权重更新 | 模型训练或微调 | 会 | 改变模型本身的行为与能力 |
| Agent 记忆 | 文件、数据库或记忆服务 | 会 | 让新会话取回以前验证过的经验 |

所以，“模型记住了”至少有两种完全不同的含义。训练让知识进入权重，Agent 记忆只是让模型以后能再次读到一份外部材料。后者更容易修改、删除和审计，也更容易被错误材料或提示注入污染。

## 一条经验要经过四层，而不是直接写进系统提示词

可以把 Agent 记忆看成从证据到索引的四层结构。

### 1. 原始日志：保留发生过什么

最底层是会话转录、工具结果和事件日志。它们体积最大，也不适合每次都加载，但承担着“来源记录”的角色。后面的笔记或 Wiki 出错时，至少还有材料可以回放和重新整理。

日志并不天然等于事实。用户可能记错，网页可能过期，工具输出也可能失败。但它比一条脱离出处的二手摘要保留了更多上下文，因此适合作为重新核验的起点。

### 2. 在线笔记：在现场抢先记下可能有用的东西

Agent 做任务时可以把计划、已验证规则和失败教训写进记忆文件。它的优点是下一次会话立即可用；缺点是写笔记本身会占用注意力，而且“现在看起来重要”不代表未来真的重要。

Anthropic 把记忆描述为对未来需求的一次预测。这个说法很准确：记录一条规则，相当于预测以后还会遇到同类问题；保存一项状态，相当于预测下一次无法从环境重新读取它。

研究中的 Pokémon Red 对比很直观。在约 1 万步时，一次 Sonnet 3.7 运行写了 413 个文件、分布在 225 个目录，却只获得 1 枚徽章；一次 Fable 5 运行只保留 9 个文件和一个顶层 `global.md`，获得了 4 枚徽章。后者主要保存策略、计划和已经验证的规律，而不是屏幕上随时能重新看到的钱数和位置。

这只是两个运行样本，不能据此推出模型能力排名，但它揭示了一个工程问题：**记录得越多，不一定记得越好。** 高频变化的状态会迅速过期，Agent 还要花更多时间搜索和维护它们。

### 3. 离线整理：回看日志，纠错并改变表示

Anthropic 把会话结束后的整理过程称为 dreaming。它不会更新模型权重，而是在没有当前交互压力时，让模型回看转录和旧笔记，纠正错误、合并重复内容，或建立新的索引。

论文中的 Mt. Moon 案例说明了它为何有用。Claude 曾把 Pokémon Center 的方向记反，随后依据错误笔记反复走错。离线整理重新对照会话转录后修正了方位，下一轮才走回正确入口。这里真正关键的不是“睡眠”这个比喻，而是两个设计约束：

- 派生笔记可以被推翻，原始记录不能被它覆盖；
- 整理任务要对照来源，而不是只把旧摘要再总结一遍。

### 4. Wiki 与注入层：把地图放在手边，不把整座仓库搬进来

当记忆规模变大，可以把相关事实整理成互相链接的 Markdown 页面。Wiki 的作用更像地图：先告诉 Agent 有哪些主题、每个主题去哪里找，再按需读取详细页面。

最顶层则是每次会话自动加载的索引、当前目标和少量高价值规则。Anthropic 以 Claude Code 的自动记忆为例：`MEMORY.md` 只加载前 200 行或 25 KB，详细内容通过链接按需读取。限制不是缺陷，而是提醒开发者：被无条件注入的每个 token 都要在每次请求中付费，错误也会被每次重新带入。

## Wiki 什么时候有效，什么时候只是昂贵的复印件

Anthropic 用约 35 万个文件、4.2 亿 token 的内部文档做了 25 道题的实验，并让 Opus 5 用 128 个离线会话逐步建设 Wiki。随着 Wiki 增长，“Wiki + 搜索”的得分从 54% 上升到 61%；只用搜索为 53%，只用 Wiki 的最好成绩为 48%。组合方案每道题还少用了约 2 万 token。

这些数字说明 Wiki 能帮助跨文件导航，却不能替代原始搜索。它们也来自 Anthropic 自有模型、内部语料和很小的题集，不是独立基准，更不能直接换算成自己的客服、代码库或个人助理效果。

另一组 Harvey LAB 实验把边界显示得更清楚：在 24 个需要跨文档、判断或计算的问题上，使用 Wiki 得到 87%，直接搜索为 73%；但当答案主要能从单个文档直接检索时，Wiki 没有明显收益。还有一次实验中，原始文档只有 115 KB，整理出来的 Wiki 却达到 203 KB，相当于做了一张比原地图还大的地图。

因此，Wiki 更适合下面的条件：

- 同一批相对稳定的资料会被反复提问；
- 答案经常要跨多个文档组合；
- 原始检索慢或上下文开销高；
- 每条结论都能保留来源和时间；
- Wiki 可以重新生成，而不是成为唯一事实库。

如果任务只是偶尔查一个明确字段，全文搜索往往更简单、更可靠。若资料每小时变化一次，离线整理的结果还可能刚生成就过期。

## 一个可运行的最小实验：让错误笔记回到证据层

下面的 Python 示例只使用标准库，用来演示分层关系，并不是 Anthropic SDK 的替代实现。事件日志保持只追加；在线笔记为了速度采用“最后观察优先”；离线整理则重新读取全部事件，优先选择经过验证的证据，并生成一个很小的 Wiki 索引。

```python
#!/usr/bin/env python3
from collections import defaultdict
from pathlib import Path
import json
import tempfile

EVENTS = [
    {
        "topic": "retention-days",
        "value": "30",
        "status": "verified",
        "observed_at": "2026-11-01",
        "source": "policy-v3.md",
    },
    {
        "topic": "deploy-region",
        "value": "ap-southeast-1",
        "status": "verified",
        "observed_at": "2026-11-01",
        "source": "prod-config.yaml",
    },
    {
        "topic": "retention-days",
        "value": "90",
        "status": "inferred",
        "observed_at": "2026-11-02",
        "source": "session-002.jsonl",
    },
    {
        "topic": "retention-days",
        "value": "30",
        "status": "verified",
        "observed_at": "2026-11-03",
        "source": "policy-v3-check.json",
    },
]


def write_event_log(path: Path, events: list[dict]) -> None:
    path.write_text("".join(json.dumps(e) + "\n" for e in events))


def online_notes(events: list[dict]) -> dict[str, dict]:
    # 快，但只是临时判断：每个主题保留最后一次观察。
    return {event["topic"]: event for event in events}


def dream(events: list[dict]) -> dict[str, dict]:
    # 从不可变事件日志重建派生记忆。
    grouped: dict[str, list[dict]] = defaultdict(list)
    for event in events:
        grouped[event["topic"]].append(event)

    memory = {}
    for topic, history in grouped.items():
        history.sort(key=lambda event: event["observed_at"])
        verified = [e for e in history if e["status"] == "verified"]
        current = verified[-1] if verified else history[-1]
        memory[topic] = {
            "current": current,
            "discarded": [e for e in history if e is not current],
        }
    return memory


def write_wiki(folder: Path, memory: dict[str, dict]) -> None:
    folder.mkdir()
    index = ["# Memory index", ""]
    for topic, record in sorted(memory.items()):
        current = record["current"]
        index.append(f"- [{topic}]({topic}.md): {current['value']}")
        evidence = "\n".join(
            f"- {item['observed_at']} · {item['status']} · "
            f"{item['value']} · `{item['source']}`"
            for item in [current, *record["discarded"]]
        )
        (folder / f"{topic}.md").write_text(
            f"# {topic}\n\nCurrent: **{current['value']}**\n\n"
            f"## Evidence\n{evidence}\n"
        )
    (folder / "index.md").write_text("\n".join(index) + "\n")


with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    write_event_log(root / "events.jsonl", EVENTS)

    provisional = online_notes(EVENTS[:3])
    consolidated = dream(EVENTS)
    write_wiki(root / "wiki", consolidated)

    before = provisional["retention-days"]
    after = consolidated["retention-days"]["current"]
    assert (before["value"], before["status"]) == ("90", "inferred")
    assert (after["value"], after["status"]) == ("30", "verified")

    print(f"online note : {before['value']} days ({before['status']})")
    print(f"after dream: {after['value']} days ({after['status']})")
    print((root / "wiki/index.md").read_text(), end="")
```

保存为 `agent-memory-layers-demo.py` 后运行：

```bash
python3 agent-memory-layers-demo.py
```

实际输出如下：

```text
online note : 90 days (inferred)
after dream: 30 days (verified)
# Memory index

- [deploy-region](deploy-region.md): ap-southeast-1
- [retention-days](retention-days.md): 30
```

这个示例故意把在线策略写得很简单，因此会暂时接受会话中推断出的“90 天”。离线阶段读回后续核验记录，恢复“30 天”，同时仍把被放弃的观察写在主题页的证据列表里。

真实系统不能让模型自己随意把 `status` 标成 `verified`。这个字段应由工具检查、人工确认、签名配置或可以重复执行的测试产生。否则只是给模型的猜测换了一个更有权威感的标签。

## 官方 Knowledge Wiki 路径更完整，也更昂贵

Anthropic 同时维护了一个 [Knowledge Wiki quickstart](https://github.com/anthropics/claude-quickstarts/tree/4a4224bdf0e9cfb3332167b69c90457403813625/managed-agents/knowledge-wiki)。固定提交中的流程先让多个 Agent 提取文档，再由 resolver 补缺、analyzer 对照来源检查，最后由 organizer 整理 Wiki；问答 Agent 只读挂载整理结果，并要求每项事实保留来源。

这条路径使用 Claude Managed Agents beta、Python 3.11 以上和 2.x Python SDK。官方记录的一次 `core` 示例处理 8 份文件、约 2.8 MB 文本，用时 23 分钟，按当时标价约 16 美元。这是官方示例的单次记录，不是固定报价，也不是本地示例的实测成本。

quickstart 还披露了一个很现实的并发问题：多个 Agent 直接写最繁忙的共享页面时，大约 5% 的行会丢失。官方示例接受这个取舍，因为共享页有助于发现跨文档矛盾；生产系统则应考虑单写者、分片页面、版本号或 compare-and-swap，不能把普通文件覆盖当成可靠事务。

## 落地时先守住七条边界

### 原始记录只追加，派生记忆可重建

笔记、Wiki 和索引都应被视为缓存。它们可以修改和删除，原始证据则保留版本，避免错误摘要覆盖唯一来源。

### 每条记忆都带出处、时间、范围和状态

“接口超时是 30 秒”不够。至少要知道它来自哪个环境、哪份配置、何时观察、是否验证，以及新证据能否取代它。

### 搜索与 Wiki 组合，而不是二选一

Wiki 用来定位主题和跨文件关系；涉及金额、权限、版本和合规条件时，仍回到原始材料。Anthropic 自己的实验中，组合方案也明显好于只读 Wiki。

### 注入层只保存导航和当前目标

每次都加载的内容应尽量短。长期细节放在按需读取的主题页里，临时状态则尽可能从真实环境重新查询。

### 整理频率由变化和访问决定

固定每晚重建未必合理。高频访问且变化缓慢的资料值得预计算；几乎不再查询的会话不必花钱整理；高频变化的数据则需要失效机制，而不是更勤奋地生成摘要。

### 用自己的问题集评估

至少比较三组：原始搜索、只读 Wiki、Wiki 加原始搜索。除了答案正确率，还应记录引用是否能定位、每题 token、延迟、构建成本和错误记忆被发现所需时间。

### 把转录和文档当作不可信数据

日志里可能包含网页提示词、Issue 命令或用户要求。整理 Agent 只能把它们当内容，不允许来源文本改变工作流、权限和输出目标。包含个人信息或客户材料时，还要先确定保留期限、删除路径和访问控制。

## 该不该给你的 Agent 加 dreaming

如果 Agent 每次都面对新的问题和新的资料，直接检索通常已经够用。如果它反复处理同一代码库、产品文档、客户历史或研究资料，并且答案需要跨会话积累，那么在线笔记加离线整理会更有价值。

判断标准不是“能不能记住更多”，而是三个更具体的问题：记忆能否追溯到证据，错误能否被后续流程推翻，不值得常驻上下文的细节能否按需找到。做到这三点，记忆才是降低重复劳动的基础设施；否则它只是一个会把旧错误说得越来越流利的摘要目录。

## 原始资料

- [Anthropic：The components of agent memory（2026-11-06）](https://www.anthropic.com/research/components-of-agent-memory)
- [Anthropic Knowledge Wiki quickstart，固定提交 `4a4224b`](https://github.com/anthropics/claude-quickstarts/tree/4a4224bdf0e9cfb3332167b69c90457403813625/managed-agents/knowledge-wiki)
- [Claude Code 文档：自动记忆与加载限制](https://code.claude.com/docs/en/memory)
- [Sleep-time Compute: Beyond Inference Scaling at Test-time](https://arxiv.org/abs/2504.13171)

