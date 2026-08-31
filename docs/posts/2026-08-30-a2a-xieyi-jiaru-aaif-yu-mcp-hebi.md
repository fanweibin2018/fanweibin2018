---
title: '继 MCP 之后，Google A2A 协议也交给了 Linux 基金会：Agent 互联的"两条腿"终于站在一起'
date: 2026-08-30
slug: 'a2a-xieyi-jiaru-aaif-yu-mcp-hebi'
author: 范伟彬
categories:
  - AI
  - 开发工具
tags:
  - A2A
  - Agent2Agent
  - MCP
  - Model Context Protocol
  - Agentic AI Foundation
  - Linux 基金会
  - AI Agent
  - 协议设计
  - 开发者工具
description: '2026 年 8 月 20 日，Google 主导的 Agent2Agent（A2A）协议正式并入 Linux 基金会旗下的 Agentic AI Foundation（AAIF），与一年前由 Anthropic 捐出的 Model Context Protocol（MCP）成为同一治理伞下的姊妹项目。至此，"Agent 连工具"（MCP）和"Agent 连 Agent"（A2A）这两条此前分头发展的标准路线，第一次统一到同一个中立基金会里协同演进。本文基于 Linux 基金会官方新闻稿、Axios、AI Magazine、Pebblous 等信源，拆解 A2A 协议的技术设计（Agent Card、任务生命周期、签名身份验证）、它与 MCP 的分工边界、AAIF 的治理结构，并给出可运行的 A2A Server/Client 最小示例代码。'
---

# 继 MCP 之后，Google A2A 协议也交给了 Linux 基金会：Agent 互联的"两条腿"终于站在一起

2026 年 8 月 20 日，Linux 基金会宣布：由 Google 在 2025 年 4 月发起的 Agent2Agent（A2A）协议正式并入其旗下的 Agentic AI Foundation（AAIF），与一年前由 Anthropic 捐赠、同样挂靠在 AAIF 下的 Model Context Protocol（MCP）成为同一治理框架里的姊妹项目。这条新闻在过去一周持续发酵——从 Axios、Yahoo Tech 到 AI Magazine、Forkast 都做了报道，Linux 基金会自己的新闻稿则给出了更硬核的数字：A2A 支持组织数已从一年前不到 50 个增长到超过 150 个，AAIF 整体成员则从去年 12 月成立时不到 40 个膨胀到如今超过 250 个，覆盖 AWS、Cisco、Google、IBM、Microsoft、Salesforce、SAP、ServiceNow、Anthropic、OpenAI、Bloomberg、Shopify、Block 等几乎所有叫得上名字的云厂商和模型厂商。对于每天在写 Agent、连工具、调 MCP Server 的开发者来说，这不是一次可以划过去的公关新闻，而是标志着"多 Agent 互联互通"这件事，终于有了和 MCP 一样级别的中立标准和治理背书。

## 一、背景：AI 圈为什么需要两套协议，而不是一套

过去两年，"Agent"这个词的语义经历了明显的分层。最早的 Agent 基本等于"一个能调用工具的大模型"：浏览器、代码解释器、数据库查询、文件系统读写，这些都是模型的"手脚"。2024 年 11 月 Anthropic 发布的 MCP，解决的正是这一层的标准化问题——在 MCP 之前，每接入一个新工具或数据源，开发者往往要为每个模型厂商、每个 Agent 框架各写一套适配代码；MCP 用统一的 Server/Client 协议，把"Agent 怎么发现、调用、组合外部工具和数据"这件事标准化了下来，一年多时间里迅速成为事实标准，本站在 7 月 28 日的文章里也拆解过它从有状态协议迁移到无状态设计的"史上最大改版"。

但随着 Agent 越做越复杂,一个新问题浮现了：当任务不再是"一个 Agent 调几个工具"就能搞定,而是需要跨公司、跨框架、跨信任边界的多个 Agent 协作完成——比如一个采购 Agent 需要联系供应商公司的报价 Agent,一个差旅 Agent 需要和航司、酒店各自的 Agent 谈判——这些 Agent 往往构建在完全不同的技术栈上(LangGraph、CrewAI、Semantic Kernel、各家自研框架),彼此互不知道对方的内部实现,也不应该互相暴露内部的工具集、记忆或私有逻辑。这正是 Google 在 2025 年 4 月发起 A2A 协议要解决的问题:不是"Agent 怎么用工具",而是"一个 Agent 怎么发现另一个 Agent、怎么把任务委派出去、怎么拿到结果"。

一句话总结两者的分工:**MCP 标准化"纵向"的 Agent-to-Resource 通信(连数据库、连 API、连文件系统);A2A 标准化"横向"的 Agent-to-Agent 通信(发现、委派任务、取回结果)。** 两者从设计之初就不是竞争关系,而是同一个多 Agent 系统里两根互补的支柱。此次 A2A 并入 AAIF、与 MCP 变成同一基金会下的姊妹项目,某种意义上只是把这个"事实上互补"的关系,落实成了"治理上统一"的关系。

## 二、技术细节解析

### 1. Agent Card:一份 Agent 的"电子名片"

A2A 协议的核心概念是 **Agent Card**——一份由 A2A Server 发布的 JSON 元数据文档,用来描述这个 Agent 是谁、能做什么、怎么联系它、需要什么认证方式。它大致包含以下几类字段:

- **身份信息**:name、description、provider(所属组织)等基本信息;
- **Capabilities(能力声明)**:是否支持流式响应(streaming)、推送通知(push notifications)、扩展 Agent Card 等特性开关;
- **Skills(技能列表)**:这个 Agent 具体能执行哪些任务类型,每个 skill 有自己的 id、描述和示例;
- **服务端点(url)**:其他 Agent 应该把请求发到哪里;
- **安全方案(securitySchemes)**:支持的认证方式声明;
- **接口与扩展**:支持的协议绑定方式和自定义扩展点。

其他 Agent 在与之交互前,先请求这份 Agent Card,据此判断"这个 Agent 值不值得信、能不能干我要的事、该用什么方式认证",这个过程称为 **Agent Discovery**。

### 2. 从"谁在说话"到"能做什么":签名身份验证与授权的边界

A2A 1.0 版本一个重要的安全升级是引入了**签名的 Agent Card(Signed Agent Card)**——通过密码学签名确保一个 Agent Card 确实来自它声称的发布者,而不是被中间人篡改或冒充。但值得开发者特别注意的是一个关键的边界:**签名解决的是身份验证(Authentication)问题,而不是授权(Authorization)问题**。

按照 Pebblous 团队在分析这次治理整合时的说法:认证层通常在 HTTP 层面用 OAuth 2.0 或 OpenID Connect 处理,凭证缺失返回 401;而授权层——即"这个已验证身份的 Agent,具体能访问哪些数据、执行哪些操作"——完全由接收请求的企业自己决定和实现,权限不足时返回 403。换句话说,一份签名的 Agent Card 只帮你迈过了"这个 Agent 是谁"这道门,"它能做什么"这道门,仍然要靠接入方自己的访问控制策略去把关。

这一点在多 Agent 协作场景里格外重要,因为存在一个被称为"电话游戏(telephone game)"的风险:当多个 Agent 依次转发、处理彼此的输出时,下游 Agent 往往把上游 Agent 的输出当作 100% 可信的输入直接消费,一旦某个环节出错或被注入了恶意内容,错误或攻击就可能被逐级放大。因此互操作性标准解决的只是"连接管道"问题,数据该怎么分级、权限怎么划、出了问题怎么审计追溯,仍然是各组织自己要啃的硬骨头——这恰好也是 AAIF 治理结构里专门设立"Identity & Trust""Security & Privacy""Observability & Traceability"等工作组的原因。

### 3. AAIF 的治理结构

Agentic AI Foundation 成立于 2025 年 12 月,是 Linux 基金会旗下专注于"让 Agentic AI 在企业规模上可运行"的中立治理组织。目前它设有八个专项工作组:

1. **Accuracy & Reliability**——为自治系统建立运行标准;
2. **Agentic Commerce**——让 Agent 能可信地参与商业交易;
3. **Governance, Risk & Regulatory Alignment**——让技术创新与监管框架对齐;
4. **Identity & Trust**——为 Agent 间交互定义可移植的身份体系;
5. **Observability & Traceability**——让 Agent 行为可观测、可解释、可追溯;
6. **Security & Privacy**——建立安全运行的行业基准;
7. **Workflows & Process Integration**——推动 Agent 从孤立任务走向复杂业务流程编排;
8. **Taxonomy & Landscape**——维护统一的术语定义和生态地图。

MCP 与 A2A 都作为独立的托管项目(hosted project)存在于这一伞形结构之下,各自保留独立的技术指导委员会(Technical Steering Committee)、独立的版本节奏和 GitHub 仓库,但共享同一套中立治理框架、同一批企业成员和同一条对外沟通渠道。这种"协议独立演进 + 治理统一背书"的模式,和 CNCF 旗下 Kubernetes、Envoy、Prometheus 等项目各自发展但共享基金会治理的模式颇为相似。

## 三、实践指南:用 Python SDK 跑一个最小 A2A Client

A2A 官方提供了 Python、JavaScript、Java、C#/.NET、Go、Rust 等多语言 SDK,协议采用 Apache License 2.0 开源许可。下面是基于官方 Python 快速入门教程整理的一个最小可运行示例,展示了 A2A 交互的核心两步:先拉取目标 Agent 的 Agent Card,再据此发起任务请求。

```python
import asyncio
import httpx
from a2a.client import A2ACardResolver, ClientConfig, create_client
from a2a.helpers import new_text_message
from a2a.types import Role, SendMessageRequest


async def main():
    base_url = "http://127.0.0.1:9999"

    # 第一步:拉取目标 Agent 的 Agent Card,
    # 了解它是谁、支持什么能力、该用什么方式认证
    async with httpx.AsyncClient() as httpx_client:
        resolver = A2ACardResolver(
            httpx_client=httpx_client,
            base_url=base_url,
        )
        public_agent_card = await resolver.get_agent_card()
        print(f"发现 Agent: {public_agent_card.name}")
        print(f"支持的技能: {[s.id for s in public_agent_card.skills]}")

        # 第二步:据 Agent Card 创建 Client,发起一次非流式任务请求
        config = ClientConfig(streaming=False)
        client = await create_client(agent=public_agent_card, client_config=config)

        message = new_text_message(
            text_query="帮我查一下今天上海到北京的航班余票",
            role=Role.ROLE_USER,
        )
        request = SendMessageRequest(message=message)

        async for chunk in client.send_message(request):
            print(chunk)


if __name__ == "__main__":
    asyncio.run(main())
```

如果需要流式响应(比如 Agent 要分多步汇报进度),只需把 `ClientConfig(streaming=True)`,并在处理完所有 chunk 后显式调用 `await client.close()` 释放底层 HTTP 连接。对于已经在用 MCP 给 Agent 接工具的团队,理解 A2A 的心智模型并不难——把它想象成"给 Agent 本身也发一张 MCP Server 式的服务清单",区别只在于 MCP Server 背后是一个具体的工具或数据源,而 A2A Server 背后是另一个完整的、有自己决策能力的 Agent。

对于正在设计多 Agent 系统的团队,这次治理整合给出的实操建议是:

- **对外暴露 Agent 前,先明确 Skill 边界**:哪些能力可以通过 A2A 开放给外部 Agent 调用,哪些应该保留在内部,不要把内部工具集或私有 prompt 原样透出;
- **认证之外单独设计授权策略**:不要以为验证了 Agent Card 签名就等于可以放行所有请求,访问控制要按数据敏感度单独设计;
- **为跨 Agent 调用链路建立审计日志**:委派出去的任务、拿回的结果都应有留痕,便于排查"电话游戏"式的错误传导;
- **MCP 与 A2A 分层组合使用**:内部工具/数据接入用 MCP,跨组织/跨团队的任务委派用 A2A,不必用一套协议硬撑两种场景。

## 四、总结与展望

A2A 并入 AAIF、与 MCP 成为同一基金会下的姊妹项目,表面上是一次治理层面的新闻,实际上标志着"多 Agent 互联"这件事正在从各厂商各自为战的探索期,进入有统一中立标准、有产业级背书的成熟期。Microsoft 已经把 A2A 集成进 Azure AI Foundry 和 Copilot Studio,AWS 通过 Bedrock AgentCore Runtime 提供支持,Google Cloud 自身也在深度整合——供应链、金融服务、保险、IT 运维等垂直行业的企业级落地案例已经出现。这意味着"Agent 与 Agent 之间怎么对话"不再是一个需要每家公司自己发明轮子的问题。

但也要清醒地看到,协议标准化解决的始终只是"连接管道"这一层——正如行业评论所言,管道本身通常能很快搞定,真正耗时的是围绕数据归属、权限边界、合规责任达成一致。随着 A2A 和 MCP 在同一个基金会下协同演进,预计接下来一段时间,Identity & Trust、Security & Privacy 这些工作组产出的具体规范和最佳实践,会比协议本身的版本号更值得开发者持续关注。对于国内的 AI 应用团队而言,现在是提前熟悉 A2A 心智模型、评估自己的多 Agent 系统是否需要对外暴露标准化接口的合适时机——毕竟当 150 多家组织已经在用同一套协议对话时,"要不要接入"很快会从选择题变成必答题。

---

## 参考来源

- [A2A Protocol Surpasses 150 Organizations, Lands in Major Cloud Platforms, and Sees Enterprise Production Use in First Year — Linux Foundation](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- [Google's A2A Protocol Joins AAIF, Consolidating the Agent Economy's Protocol Layer Under One Roof — Yahoo Tech](https://tech.yahoo.com/ai/gemini/articles/google-a2a-protocol-joins-aaif-020554895.html)
- [Google's A2A protocol gets a new home — Axios](https://www.axios.com/2026/08/17/a2a-agentic-ai-foundation-open-ai-standards)
- [Why Did Google's A2A Join the Agentic AI Foundation? — AI Magazine](https://aimagazine.com/news/why-did-googles-a2a-join-the-agentic-ai-foundation)
- [A2A Joins MCP at the Agentic AI Foundation — Pebblous](https://blog.pebblous.ai/blog/a2a-mcp-agentic-ai-foundation-authorization/en/)
- [Agentic AI Foundation (AAIF) 官网](https://aaif.io/)
- [A2A Protocol 官方文档与 Python Quickstart](https://a2a-protocol.org/latest/)
- [Agent2Agent — Wikipedia](https://en.wikipedia.org/wiki/Agent2Agent)
