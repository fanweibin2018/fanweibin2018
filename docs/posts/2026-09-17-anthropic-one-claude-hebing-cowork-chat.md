---
title: 'One Claude：当 Anthropic 把 Chat、Cowork、Artifacts 全部揉进一个对话框'
date: 2026-09-17
slug: 'anthropic-one-claude-hebing-cowork-chat'
author: 范伟彬
categories:
  - AI
  - Agent
tags:
  - Anthropic
  - Claude
  - Cowork
  - Claude Docs
  - Claude Slides
  - Claude Design
  - AI 产品设计
  - Agent 路由
description: '2026 年 9 月 16 日，Anthropic 宣布将 Claude Chat 与 Cowork 合并为统一界面"One Claude"，新增 Claude Docs、Claude Slides，并让此前只在独立空间可用的 Claude Design 在任意对话中直接可用，用户不再需要提前选择"该用哪个工具"。本文基于 TechCrunch、Engadget、Fortune 等多家媒体报道，拆解这次界面整合背后的自动路由机制、与 OpenAI"超级应用"策略的正面交锋，以及 Stanford 研究揭示的 Agent 任务 token 消耗风险，并给出一段可直接参考的"低成本意图路由"示例代码，供正在用 Claude API 构建多模式助手的开发者借鉴。'
---

# One Claude：当 Anthropic 把 Chat、Cowork、Artifacts 全部揉进一个对话框

过去一年里，Claude 的产品线越长越复杂：先有面向对话的 Chat，后有面向"把活直接交出去"的 Cowork，2026 年 4 月又上线了专注视觉设计的 Claude Design，加上一直存在的 Artifacts 交互工作区和面向编程的 Claude Code。对用户来说，这意味着每次打开 Claude 之前，都要先做一次"选工具"的决策——写文档该去哪、做 PPT 又该去哪、这个多步骤任务是扔给 Cowork 还是留在 Chat 里慢慢聊。2026 年 9 月 16 日，Anthropic 用一篇官方博客宣布终结这种割裂：Claude Chat 与 Cowork 合并为统一界面"One Claude"，Artifacts 直接嵌入同一个窗口，Claude Design 从此在任意对话里都能唤起，同时新增了 Claude Docs 和 Claude Slides 两个文档类新功能。对于每天要在多个 AI 工具间来回切换的开发者和知识工作者而言，这次改版释放的信号，比功能列表本身更值得琢磨。

## 一、背景介绍：从三个入口到一个对话框

Cowork 是 Anthropic 今年主推的"非编程知识工作"agent 产品：把研究、分析、文档撰写这类多步骤任务整个交给 Claude，运行在桌面端，Web 和移动端处于 beta。它和 Chat 的定位差异一直让用户困惑——一份 Anthropic 员工的原话被媒体反复引用："你在其中一个里开始做的事情，没法带到另一个里继续"，工作流被硬生生切成了两段。再加上 4 月上线、专注网站与原型设计的 Claude Design 长期是个独立空间，用户想用它做张海报还得先跳出当前对话。

9 月 16 日的这次更新，本质上是把这几条并行的产品线在交互层面收拢成一条：Anthropic 明确表示，Claude 桌面端的入口将从三个模式（Chat、Cowork、Claude Code）收敛为两个——**Claude Chat** 和 **Claude Code**，其中 Claude Chat 内部会自动囊括原本 Cowork、Artifacts、Claude Design 的能力。用户只需要用自然语言描述自己要什么，剩下的"该用哪个引擎处理"交给 Claude 自己判断。

## 二、技术细节解析：自动路由，加上两个新武器

这次改版的核心机制可以概括为一句话：**用户不再选工具，Claude 替你选**。根据 TechCrunch、Engadget 等媒体的报道，新界面的具体变化包括：

- **统一入口 + 自动路由**：用户在同一个对话框里描述需求，Claude 会自行判断这是一个几秒钟就能回答的简单问题，还是需要研究、写报告、做表格、出 PPT 这类多步骤工作，并在需要时自动切换到相应的执行路径，不再需要手动切换标签页或窗口。
- **Claude Docs（新）**：可以在对话中直接让 Claude 起草文档，逐段追问和批注，文档默认私有，可通过链接分享给协作者，并支持导出为 Google Docs 或 Microsoft Word 格式，移动端也能编辑。
- **Claude Slides（新）**：同样在对话内完成，让 Claude 生成、编辑和整理演示文稿，完成后可下载为 PowerPoint 或 PDF 文件。
- **Claude Design 全局可用**：不再局限于独立的 Design 空间，任意一次普通对话都可以直接触发原型、海报、单页面设计等视觉产出。
- **Cowork 能力保留但不再"孤岛化"**：多步骤 agent 任务依旧可以调用用户指定的文件和工具、自主完成端到端交付，但现在运行在主界面里，产出的文档、幻灯片、表格等物料可以和普通对话无缝衔接，而不是被锁在另一个空间。

值得注意的是企业侧的谨慎节奏：Pro 和 Max 订阅用户将在未来几周内率先在 Web、桌面端和移动端拿到新界面；Team 和 Free 用户"很快"跟进；而 Enterprise 计划要等到提前至少 30 天通知管理员之后才会推送，并且管理员可以按组织粒度选择性开启 Docs、Slides、Design 这些新能力。这种分层灰度、给企业管理员留足缓冲期和开关的做法，某种程度上比功能本身更值得关注——它是 AI 厂商在"体验统一"和"组织可控"之间找平衡的一个具体样本。

## 三、行业格局：这不是 Anthropic 一家的选择

把多个专用工具收拢成一个"万能对话框"，并不是 Anthropic 独有的思路。Fortune 的报道指出，OpenAI 正在推进几乎相同的战略：计划把 ChatGPT、Codex 编程能力，乃至 Atlas 浏览器都整合进一个"超级应用"，让用户在研究、写代码、找解释之间无缝切换，不需要在多个产品间反复横跳。两家公司不约而同地把"减少工具碎片化"作为下一阶段的重点，背后的驱动力也高度一致：企业客户不想放任员工自行选择一堆零散的 AI 工具，而更希望有一个统一、可管控的入口——这也是为什么 Anthropic 在企业侧格外谨慎，给了管理员按功能开关和 30 天缓冲期。

但这条路并非没有代价。Fortune 引用的一项斯坦福研究给出了一个值得警惕的数字：**Agent 类任务消耗的 token 量，大约是简单聊天推理任务的 1000 倍**。由于 AI 厂商大多按 token 计费，如果"自动路由"默认把原本一句话能答完的简单问题也导向更重的 agent 流程，实际计算成本可能不降反升，抵消掉模型效率提升带来的边际收益。换句话说，"体验更丝滑"和"成本更可控"这两个目标，在自动路由的设计上其实存在张力——路由判断得越保守，用户体验的"无缝感"打折扣；判断得越激进，账单可能越难看。

## 四、实践指南：给用 Claude API 构建"自动路由"体验的开发者

如果你也在用 Claude API 搭建类似"一个对话框、内部自动分流"的产品，Anthropic 这次改版和斯坦福那组数字合在一起，其实指向一条很具体的工程建议：**把"判断该用哪种模式"这件事，和"真正执行这种模式"分开计费、分开选型**，不要让每一次路由判断都跑一遍最贵的模型或最长的 agent 循环。下面是一个简化示例，示范如何用一个便宜的小模型先做意图分类，再按需分发到不同成本量级的处理路径：

```python
import anthropic

client = anthropic.Anthropic()

ROUTES = ["chat", "doc", "slides", "agent"]


def classify_intent(user_message: str) -> str:
    """先用便宜的小模型做一次路由判定，避免每次都直接扔进最贵的 Agent 循环"""
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",  # 路由判定只需要小模型，控制成本
        max_tokens=16,
        messages=[{
            "role": "user",
            "content": (
                "只输出一个词，判断下面这条用户请求应该走哪种处理模式：\n"
                "chat（几句话就能答完）/ doc（需要生成一篇文档）/ "
                "slides（需要生成一份演示文稿）/ agent（需要多步骤自主完成的复杂任务）。\n"
                f"用户请求：{user_message}"
            ),
        }],
    )
    intent = resp.content[0].text.strip().lower()
    return intent if intent in ROUTES else "chat"


def handle_request(user_message: str):
    intent = classify_intent(user_message)
    if intent == "chat":
        return quick_chat_reply(user_message)      # 低延迟、低成本
    elif intent == "doc":
        return draft_document(user_message)         # 中等成本，产出可编辑文档
    elif intent == "slides":
        return build_slides(user_message)           # 中等成本，产出 PPTX/PDF
    else:
        return run_agent_workflow(user_message)     # 最贵的多步 Agent 循环，谨慎触发
```

这段代码的重点不在于分类准确率能做到多高，而在于它体现的架构原则：**路由判定本身应该是整条链路里最便宜的一环**，因为它要在每一次请求上都执行；真正昂贵的多步骤 agent 循环，只应该在路由判定给出足够把握之后才被触发，并且理想情况下要给用户一个"确认要不要升级到更重的处理模式"的机会，而不是完全隐式地帮用户做这个可能很贵的决定。如果你的产品同时面向企业客户，Anthropic 这次为 Enterprise 计划单独设置 30 天缓冲期、并允许按功能开关的做法也值得照抄——统一入口不等于强制所有人立刻接受新的默认行为。

## 五、总结与展望

One Claude 这次改版，表面上是一次界面精简：把 Chat、Cowork、Artifacts、Claude Design 拧成一个入口，加上 Claude Docs、Claude Slides 两个新功能，让"选工具"这件事从用户手里转移到了模型自己身上。但放在更大的行业背景里看，它其实是 Anthropic 和 OpenAI 几乎同步押注的"超级应用"叙事的一部分——用一个统一、自动路由的对话框，取代一堆各自为政的专用工具，同时用企业侧的分级灰度和管理员开关,去安抚大客户对"失控"的担忧。

真正值得持续关注的,是斯坦福那组"Agent 任务 token 消耗是简单聊天 1000 倍"的数字会如何反过来影响这些厂商的路由策略：如果自动路由为了体验流畅而偏向"宁可多走 agent 流程"，那么这次看似让用户"更省心"的改版，最终买单的可能是更高的 API 账单和更贵的订阅价格。对正在构建类似多模式 AI 产品的开发者来说，与其等厂商公布下一轮定价调整，不如现在就把"低成本路由 + 谨慎升级到重量级 agent"这套架构原则,提前放进自己的系统设计里。

## 参考来源

- [TechCrunch: Anthropic merges Claude chat and Cowork in one interface](https://techcrunch.com/2026/09/16/anthropic-merges-claude-chat-and-cowork-in-one-interface/)
- [Engadget: Anthropic's Claude can now create editable documents for you](https://www.engadget.com/2259938/anthropics-claude-can-now-create-editable-documents-for-you-cowork-chat-together/)
- [Fortune: Anthropic merges its chat and agentic products into one AI assistant in push to build a superapp](https://fortune.com/2026/09/16/anthropic-merges-its-claude-chat-and-agentic-cowork-products-into-a-single-ai-assistant-as-part-of-a-push-to-build-an-ai-superapp/)
- [9to5Mac: Anthropic merging Claude Cowork with chat](https://9to5mac.com/2026/09/16/anthropic-merging-claude-cowork-with-chat/)
- [insideai.news: Anthropic merges Claude chat and Cowork into one interface, adds document tools](https://insideai.news/news/ai-tools/anthropic-claude-unified-interface/12085/)
- [Unite.AI: Anthropic Folds Cowork Into a Single Claude Experience Across Plans](https://www.unite.ai/anthropic-folds-cowork-into-a-single-claude-experience-across-plans/)
