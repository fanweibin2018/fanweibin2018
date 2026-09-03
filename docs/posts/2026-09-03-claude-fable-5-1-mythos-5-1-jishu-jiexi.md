---
title: 'Claude Fable 5.1 与 Mythos 5.1 发布：缓存读取降价 75%，一次面向开发者的迁移实录'
date: 2026-09-03
slug: 'claude-fable-5-1-mythos-5-1-jishu-jiexi'
author: 范伟彬
categories:
  - AI
tags:
  - Anthropic
  - Claude
  - Fable 5.1
  - Mythos 5.1
  - LLM
  - API
  - Claude Code
description: '2026 年 9 月 1 日，Anthropic 发布 Claude Fable 5.1 与 Claude Mythos 5.1，官方称其为"迄今最强的编码与知识工作模型"。本文基于 Anthropic 官方发布页、System Card、Platform 迁移指南及 VentureBeat、9to5Mac 等外媒报道，拆解本次发布的定价变化（缓存读取降价 75%）、基准测试数据、Mythos 受限访问机制与 Enterprise Frontier Safeguards，并给出从 Fable 5 迁移到 Fable 5.1 的具体代码改动（强制工具调用被取消、改用 strict 模式）与迁移检查清单，帮助正在用 Claude API 或 Claude Code 的开发者评估是否升级、如何升级。'
---

# Claude Fable 5.1 与 Mythos 5.1 发布：缓存读取降价 75%，一次面向开发者的迁移实录

2026 年 9 月 1 日，Anthropic 发布了 Claude Fable 5.1 与 Claude Mythos 5.1——按照官方说法，这是"迄今为止最先进的编码与知识工作模型"，同时也是第一次把"科学研究能力"作为发布重点单独强调的一代 Claude。这次发布距离上一代 Fable 5 只有约三周，但从定价结构、基准测试到安全框架都做了实质性调整，尤其是 API 缓存读取价格直接砍到四分之一——对任何在生产环境里跑长上下文、多轮对话或 Agent 循环的团队来说，这都是一笔看得见的账。

本文基于 Anthropic 官方发布页、System Card（PDF）、Claude Platform 官方迁移指南，以及 VentureBeat、9to5Mac、Handy AI（Model Drop）等外媒和独立分析的报道，把这次发布拆成三部分讲清楚：这次升级到底带来了什么、Fable 5.1 与 Mythos 5.1 的技术细节，以及——最重要的——如果你现在就用 Claude API 或 Claude Code，升级到 Fable 5.1 具体要改哪些代码。

## 一、背景介绍：一个模型，两个名字

Fable 5.1 和 Mythos 5.1 本质上是**同一个底层模型**，区别只在于安全防护的松紧程度：

- **Claude Fable 5.1** 是面向所有人的通用发布版本，跑标准的安全分类器和防护策略，Pro、Max、Team、Enterprise 用户可直接使用，开发者可以在 Claude Platform、Amazon Bedrock、Claude Platform on AWS、Google Cloud（Vertex AI）和 Microsoft Foundry 上原生调用。
- **Claude Mythos 5.1** 与 Fable 5.1 能力完全相同，但安全防护更宽松，仅通过"Project Glasswing"这一受信任访问计划提供给经过审查的**网络安全**和**生命科学**领域组织，目前只对美国境内组织开放。

这种"同一模型、两套防护"的发布方式并不是第一次出现——上一代 Fable 5 / Mythos 5 就是这个模式，但这次的技术分级和落地案例明显更具体，也更能说明 Anthropic 现阶段的产品思路：把最强能力留给受信任的专业场景，同时压低面向普通开发者的公开版本的使用成本。

## 二、技术细节解析

### 1. 定价：输入输出价格不变，缓存读取降价 75%

Fable 5.1 延续了 Fable 5 的基础定价：

| 项目 | 价格（每百万 token） |
| --- | --- |
| 输入 | 10 美元 |
| 输出 | 50 美元 |
| **缓存读取** | **0.25 美元**（Fable 5 为 1 美元，降幅 75%） |
| 批处理输入 / 输出 | 5 美元 / 25 美元（约 5 折） |
| 缓存写入（5 分钟 / 1 小时） | 12.5 美元 / 20 美元 |

按照官方和多家外媒的说法，典型工作负载下整体成本比 Fable 5 降低约 25%，对大量依赖提示词缓存、自动化程度高的任务（比如长期运行的 Agent、重复调用同一份系统提示词的客服机器人），降幅可以达到 45%。缓存读取价格只占标准输入价格的 2.5%，远低于此前 10% 左右的常见比例——这基本上是在明确鼓励开发者把长上下文、可复用的系统提示词和工具定义都放进提示词缓存里。

### 2. 基准测试：Agent 编码和科研代理任务提升明显

Anthropic 官方公布的对比数据（部分节选，对比对象为 Fable 5 和 Opus 5）：

| 测试项 | Fable 5.1 | Fable 5 | Opus 5 |
| --- | --- | --- | --- |
| Terminal-Bench-Science 0.1（科研 Agent） | 52.6% | 24.7% | 29.0% |
| Terminal-Bench 4.0（Agent 编码） | 55.8% | 42.0% | 52.3% |
| GDPval-AA v2（知识工作） | 1853 | 1723 | 1824 |
| Humanity's Last Exam（无工具） | 60.9% | 57.8% | 56.6% |
| CursorBench 3.2.0 | 73.4% | 70.5% | 70.0% |
| AutomationBench | 31.4% | 17.1% | — |

其中 Terminal-Bench-Science 的提升幅度最大，接近翻倍，这也呼应了官方这次特意强调的"科学研究能力"。第三方分析（Handy AI 的 Model Drop）指出，这些提升很大程度上来自安全防护策略的调整——上一代 Fable 5 在触发安全过滤的任务上经常直接得零分，而 Fable 5.1 把"识别软件漏洞"这类防御性安全工作从限制名单里移了出来（但依然禁止生成漏洞利用代码和辅助渗透测试），减少了误伤。官方给出的数字是：新的网络安全防护策略把误报率降低了约 60%。

### 3. Agentic 能力：38 小时无人值守与具体科研案例

官方发布页给出了几个具体的落地案例，用来说明模型在长时程自主任务上的可靠性：

- **蛋白质结合设计**：Mythos 5.1 在连续跑了 38 小时的无人值守任务后，在 12 个靶点上实现了目前测得的最高命中率（接近 50%，行业常见水平为 10%~15%），其中 3 个靶点的结合亲和力比 Adaptyv Bio 竞赛的最佳设计还要高出 10 倍。
- **深度学习模型性能优化**：对 7 个开源模型做 GPU 推理优化，最高提速 2.5 倍，成本节省 30%~60%——这类工作过去通常需要专门的性能工程师团队花费数周时间。
- **金星地形重建**：基于 30 年前 NASA 麦哲伦任务留下的雷达影像，重新生成了金星三分之一表面的高分辨率高程图，分辨率从 10~20 公里提升到 2~3 公里。
- **企业客户案例**：金融数据公司 Millennium 反馈，Fable 5.1 定位到了一个困扰其工程师和此前多代模型多年的罕见系统崩溃根因。

这些案例更多是在展示 Mythos 5.1（受限访问版本）在专业领域的上限，但背后体现的长时程自主可靠性提升，同样会反映在 Fable 5.1 的日常编码任务里。

### 4. 安全与合规：Enterprise Frontier Safeguards、反蒸馏、EU AI Act 水印

几个值得开发者和企业客户关注的安全侧变化：

- **Enterprise Frontier Safeguards（EFS）**：面向企业客户的新监控体系，检测和响应模型滥用行为所需的数据存储在客户自己的 AWS / Azure / Google Cloud 环境里，而不是 Anthropic 的系统中，配合客户自管的加密密钥和访问策略，官方称之为"在零数据保留协议下依然能做安全监控"的方案，计划今年秋季分阶段推出，不额外收费（云资源本身的费用除外）。
- **反蒸馏机制**：新账户无法在多轮对话中手动编辑 Claude 之前的上下文、同时保留此前的思维链记录——这是针对"通过编辑历史来批量提取模型推理过程"这类公开的蒸馏技巧做的限制。
- **对齐评估**：官方自动化行为审计显示，面对"不可能完成的任务"时，Mythos 5.1 相比上一代明显更少尝试越权访问测试环境之外的资源。
- **EU AI Act 合规**：已部署文本水印技术，可以用数值化的方式估计一段文本由 Claude 参与撰写的概率，并向监管机构、执法部门、媒体等合规机构提供水印检测 API 的私密预览。

化学 / 生物风险方面，官方明确 Mythos 5.1 虽然能力更强，但仍未达到其"负责任扩展政策"（Responsible Scaling Policy）里定义的更高风险等级，采用与上一代 Mythos 5 相同级别的生物研究防护措施。Mythos 5.1 的受限访问通过两个具体项目落地：面向防御性安全从业者的 Cyber Vetting Program（CVP，即将支持 Mythos 级模型），以及与美国政府合作、面向生命科学专业人士的 Life Sciences Vetting Program（LSVP）。

## 三、实践指南：从 Fable 5 迁移到 Fable 5.1，代码要改什么

如果你已经在生产环境里用 Claude API 调用 Fable 5，迁移到 Fable 5.1 官方定性为"基本是无缝替换"（drop-in），API 结构、限流、单价、分词器、始终开启的自适应思考（adaptive thinking）、拒绝处理逻辑都保持不变。但有三处明确的 breaking change，其中第一处几乎所有用了工具调用的项目都会碰到。

### 1. 模型名直接换字符串

```python
model = "claude-fable-5"    # 之前
model = "claude-fable-5-1"  # 之后

# 如果你有 Project Glasswing 的受限访问权限：
model = "claude-mythos-5-1"
```

### 2. 强制工具调用（tool_choice: any / tool）被取消，改用 strict 模式

这是最容易踩坑的一处变化。Fable 5 支持 `tool_choice` 传 `auto`、`none`、`any`、`tool` 四种取值，但 Fable 5.1 上，`{"type": "any"}` 和 `{"type": "tool", "name": "..."}` 会直接返回 400 错误：

```
tool_choice: type "tool" and "any" are not supported for this model.
```

官方建议的替代方案是：把 `tool_choice` 保持在默认的 `auto`，在提示词里明确要求调用哪个工具，同时给工具 schema 加上 `strict: true`，让返回结果严格符合 schema 约束。

```python
# 迁移前（Fable 5）：强制调用 record_summary 工具
response = client.messages.create(
    model="claude-fable-5",
    max_tokens=16000,
    tools=[record_summary_tool],
    tool_choice={"type": "tool", "name": "record_summary"},
    messages=[{"role": "user", "content": "Summarize: The meeting moved to Thursday."}],
)

# 迁移后（Fable 5.1）：auto + strict + 提示词里显式要求调用工具
record_summary_tool = {
    "name": "record_summary",
    "description": "Record the structured summary of the document.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {"summary": {"type": "string"}},
        "required": ["summary"],
        "additionalProperties": False,
    },
}

response = client.messages.create(
    model="claude-fable-5-1",
    max_tokens=16000,
    tools=[record_summary_tool],
    tool_choice={"type": "auto"},
    messages=[{
        "role": "user",
        "content": "Summarize: The meeting moved to Thursday. Call the record_summary tool with your result.",
    }],
)
```

如果你的场景是"多轮对话中，应用逻辑（而不是用户）要求当前这一轮必须调用某个工具"，官方给出的做法是在最新一条 `user` 消息之后追加一条 `role: "system"` 的**会话内系统消息**，明确说明本轮必须调用哪个工具，而不是把要求写进顶层的 `system` 提示词——这样可以保持历史对话字节级不变，继续命中提示词缓存：

```python
messages = [
    {"role": "user", "content": "My headphones from order A1234 arrived yesterday."},
    {"role": "assistant", "content": "Thanks for confirming. How can I help with order A1234?"},
    {"role": "user", "content": "I opened the box. Can I still return them?"},
    {
        "role": "system",
        "content": (
            "Tool-use requirement for the current turn: the application requires "
            "a call to the search_help_center tool in your response to the user's "
            "latest message. Begin your response with the search_help_center tool "
            "call. Do not reply with text only."
        ),
    },
]
```

需要注意的是，如果你之前强制工具调用只是为了拿到符合 schema 的结构化 JSON，其实更推荐直接用 `output_config.format`（Structured Outputs / JSON outputs）能力，而不是硬凑一个工具调用。

### 3. 思维链（thinking block）的版本绑定

Fable 5.1 的每个 `thinking` 块都记录了产出它的模型版本：Fable 5.1 能读取自己以及 Mythos 5.1、Opus 5、Fable 5、Mythos 5 等更早模型产出的思维块，但反过来不成立——旧模型读不了 Fable 5.1 产出的思维块。如果对话因为路由切换、客户端重试或分类器拒绝回退（fallback）从 Fable 5.1 掉回旧模型，API 会自动剔除旧模型读不了的思维块（这部分输入 token 不计费），但目标模型会失去这部分推理上下文，重新规划，首轮的成本和延迟可能上升。

更值得注意的是**思维块与对话前缀的绑定检查**：2026 年 8 月 31 日之后新建的账号，如果应用自己拼接 `messages` 数组、且改动了思维块之前的历史内容（system 提示词、tools 定义、对话记录），再把思维块传回去会直接触发 400 错误。这条规则对 Claude Code、claude.ai、Claude Managed Agents、Claude Agent SDK 管理会话历史的场景没有影响（它们本来就保持前缀不变），但如果你是**自己手写 messages 数组管理多轮对话状态的团队，这条要专门检查**。规避方式是发送 `thinking-binding-controls-2026-08-01` 这个 beta header，并把 `thinking.block_binding.prefix_mismatch_behavior` 设为 `"drop_block"`，让 API 自动丢弃不匹配的思维块而不是直接报错。

### 4. 一条命令自动化迁移

如果你在用 Claude Code，官方内置了一个迁移用的 skill，可以直接跑：

```
/claude-api migrate this project to claude-fable-5-1
```

它会先确认迁移范围（整个工作目录 / 某个子目录 / 指定文件列表），然后自动完成模型名替换，以及上面提到的 breaking change 相关的参数调整、prefill 替换、effort 校准，跑完之后给出一份需要人工复核的清单，对 Amazon Bedrock 和 Claude Platform on AWS 的模型 ID 格式差异也会自动识别处理。

## 四、总结与展望

这次发布延续了 Anthropic 过去几代模型的节奏：能力提升的同时把成本往下压，把最强能力和最少限制留给经过审查的专业场景。对绝大多数开发者来说，Fable 5.1 最值得关注的不是榜单上又多了几个百分点，而是两件很实际的事：一是缓存读取降价 75% 这种"价格杠杆"，对长上下文、高频复用系统提示词的应用是直接可算的成本收益；二是强制工具调用被取消后，用 `strict: true` + 提示词约束替代的迁移方式，这几乎会影响每一个用了工具调用的 Agent 项目，值得提前排查而不是等线上报错才发现。

往后看，Mythos 5.1 通过 CVP、LSVP 这类受信任访问计划把最强能力限定在网络安全防御和生命科学研究这两个"高价值、高风险"场景，加上 Enterprise Frontier Safeguards 把监控数据放回客户自己的云环境，能看出 Anthropic 正在同时应对两个压力：一边是企业客户对数据主权和合规的要求越来越具体，另一边是模型能力提升之后，安全防护本身也需要更精细的分级,而不是简单地"一刀切"限制所有人。这种分层策略未来大概率会被更多实验室效仿。

## 参考来源

- [Anthropic 官方发布页：Introducing Claude Fable 5.1 and Claude Mythos 5.1](https://www.anthropic.com/claude-fable-and-mythos-5-1)
- [Anthropic System Card：Claude Fable 5.1 & Claude Mythos 5.1（2026 年 9 月 1 日）](https://www-cdn.anthropic.com/0339e6a7c5c7b87f5c07798616dc32c215d14235/Claude%20Fable%205.1%20&%20Claude%20Mythos%205.1%20System%20Card.pdf)
- [Claude Platform 官方文档：Migrating to Claude Fable 5.1 and Claude Mythos 5.1](https://platform.claude.com/docs/en/models/fable-5-1/migration-guide)
- [VentureBeat：Anthropic's Claude Fable 5.1 and Mythos 5.1 arrive with a 75% cost reduction for Fable cache reads](https://venturebeat.com/technology/anthropics-claude-fable-5-1-and-mythos-5-1-arrive-with-a-75-cost-reduction-for-fable-cache-reads)
- [9to5Mac：Anthropic upgrades Claude with new Fable 5.1 model, details here](https://9to5mac.com/2026/09/01/anthropic-upgrades-claude-with-new-fable-5-1-model-details-here/)
- [Handy AI（Jake Handy）：Model Drop: Fable 5.1](https://handyai.substack.com/p/model-drop-fable-51)
