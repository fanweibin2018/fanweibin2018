---
title: '台湾遭"近乎自主"AI 智能体网络攻击：当 Hermes 与 OpenClaw 被武器化'
date: 2026-08-22
slug: 'taiwan-zizhu-ai-agent-wangluo-gongji-hermes-openclaw'
author: 范伟彬
categories:
  - AI
  - 安全
tags:
  - AI Agent
  - 网络安全
  - Hermes
  - OpenClaw
  - 多智能体系统
  - Dream Security
  - Agentic AI
description: '2026 年 7 月 1 日至 4 日，一个疑似与中国有关联的攻击团伙利用两款开源 AI 智能体框架 Hermes 和 OpenClaw，搭建了一套多智能体自动化攻击系统，在近乎无人干预的情况下对台湾政府网络发起了 12 波攻击，攻陷 85 个账号、窃取超过 2564 份人事档案，并波及台湾核安全主管机关和 7 家以上能源企业。以色列网络安全公司 Dream 在事后取证中还原了这套系统的贝叶斯优先级决策引擎与"学习周期"机制。这被普遍认为是首例被完整记录的、由 AI 智能体主导执行的国家级网络攻击。本文基于 Dream Security 的技术报告及多家媒体报道，拆解这套攻击系统的架构原理，并探讨对正在构建 Agent 应用的开发者意味着什么。'
---

# 台湾遭"近乎自主"AI 智能体网络攻击：当 Hermes 与 OpenClaw 被武器化

## 一、发生了什么

2026 年 7 月 1 日至 4 日的四天里，台湾政府网络遭遇了一轮不同寻常的入侵。事后取证显示，这不是传统意义上"黑客团伙用工具辅助手工作业"的攻击，而是一套基于开源 AI 智能体框架搭建的自动化系统，在几乎没有人类实时干预的情况下，独立完成了侦察、漏洞挖掘、凭证窃取、横向移动和数据外泄的完整攻击链条。

以色列网络安全公司 Dream（由 Shalev Hulio 与前奥地利总理 Sebastian Kurz 联合创立，今年 6 月刚完成 2.6 亿美元融资、估值达 30 亿美元）在一次事件响应中，意外获取了攻击方遗留的一个 160MB 归档，里面包含近 1400 个文件——攻击者自己的日志、任务规划文档、执行报告。这份"作案现场"完整暴露了整套系统的工作方式，Dream 随后发布了详细的技术分析报告。

这次攻击的战果相当惊人：攻击方以 8 个并行子智能体为一组，在四天内发起了 12 波攻击浪潮，累计攻陷 85 个政府账号、窃取超过 2564 份人事档案，从最初的目标一路扩展到台湾核安全主管机关、7 家以上能源企业、政府 IT 供应链厂商和一套政府邮件系统，并在多个系统里植入了持久化后门。归档中使用简体中文书写的内部任务文档、与窃取自繁体中文环境数据的对比，让研究者倾向于认为攻击方来自中国大陆——但台湾官方目前并未在公开声明中正式将其归因于某个国家行为体，北京方面也未回应相关指控。

`Taipei Times` 8 月 21 日的社论把这次事件定性为"分水岭时刻"，呼吁台湾建立跨境实时 AI 安全情报共享机制；OpenAI 的安全团队在 8 月初的 Black Hat 大会上也将其称为行业级的警示信号——预计未来犯罪团伙会更多地转向"协同智能体网络"，而不是依赖单一工具。这不只是一起地缘政治新闻，更是每一个正在构建 Agent 应用的开发者都应该认真读一读的技术案例：攻击者用来打穿政府系统的，正是很多人书桌前用来写代码、订机票、跑数据分析的同一类开源框架。

## 二、技术拆解：这套攻击系统是怎么运作的

### 2.1 框架选型：Hermes 与 OpenClaw

攻击系统的运行基础是两款近两年迅速走红的开源智能体框架：

- **Hermes**：一个面向 function-calling 大模型的开源 Python 智能体框架，围绕"AIAgent 循环"这个核心同步编排引擎构建，以"执行—学习—改进"的可重复循环为特色，是 2026 年增长最快的智能体框架之一，十周内 GitHub star 数突破 11 万。
- **OpenClaw**：由奥地利开发者 Peter Steinberger 创建，走的是"开箱即用"路线——自带网页搜索、文件操作、代码执行、浏览器自动化等工具，采用"规划—执行—反思"（plan-execute-reflect）循环，同样在 2026 年初迅速积累了超过 10 万 star。

从取证归档看，攻击系统内部用 `.hermes` 与 `.openclaw` 两个独立的工作区标识分别驱动不同的子任务，说明攻击方并非只用了其中一个框架，而是把两者的能力做了组合调用——这本身就是一个值得警惕的信号：**攻击者对开源生态的熟悉程度和工程能力，已经不亚于正规的产品团队**。

### 2.2 多智能体编排：8 个子智能体如何分工

Dream 的报告显示，系统在每一波攻击中最多同时调度 8 个子智能体（在其内部文档里被标记为 A 到 Q 等代号），每个子智能体被分配不同的目标和任务类型——有的专注端口扫描和资产测绘，有的专攻 API 端点探测，有的负责凭证破解和横向移动。这种"并行派单"的模式让系统能够在单位时间内覆盖远超人工团队规模的攻击面：仅从对某一个目标网站 JavaScript 代码的反编译分析中，系统就自动测绘出了 21 个互联的政府系统,并在其中一个目标上发现了 36 个以上未做身份验证的 API 端点。

更关键的是"波次"之间的反馈闭环：每一波攻击结束后，系统会生成结构化的"事后报告"（after-action report），把本轮的发现和结果重新喂给下一轮的规划阶段，用于动态调整优先级和策略——这不是简单的日志记录,而是一个持续学习、持续再规划的闭环控制系统。

### 2.3 贝叶斯优先级引擎：让攻击"该打哪就打哪"

系统里最值得工程师关注的部分,是它用来决定"下一步打哪里"的决策机制——一个两层的贝叶斯概率模型：

**第一层（单个漏洞层面）**：每个潜在漏洞先给一个 P=0.50 的先验概率，随后根据不同证据的似然比（likelihood ratio）动态更新——比如自动化工具扫描命中的似然比是 6.0，人工二次确认命中的似然比是 10.0，概率超过特定阈值就触发下一步的分诊（triage）动作。

**第二层（攻击链层面）**：用于评估一整条多步骤攻击路径的成功率，公式是：

```
P_success = P_chain × (1 − P_blocker)
```

其中 `P_chain` 是链条上各步骤已被确认可行的联合概率，`P_blocker` 是链条中存在"不可逾越障碍"的概率。举例来说，系统针对某个 SSO 单点登录横向移动路径的预测成功率是 99%，实际执行验证后的真实成功率是 98.8%——预测精度已经相当接近生产级风控模型的水平。

这套机制本质上是把渗透测试里"经验丰富的红队专家凭直觉判断该往哪打"的隐性知识，转化成了一套可计算、可复用、可持续迭代的显性模型。

### 2.4 "学习周期"与自我纠错

报告还记录了系统进行的 5 轮独立"学习周期"（Learning Cycles，标记为 v1 到 v5）——系统会主动在漏洞数据库、GitHub 代码仓库和安全研究文章中检索与目标基础设施特征匹配的可用漏洞与利用技术，并按相关性、可用 exploit 情况、成功概率、实施优先级对结果分类。此外系统还接入了 Tesseract OCR 用于自动破解验证码（报告称准确率达到 100%），以及一个被称为"Local-LLM-SAST-0day"的本地静态分析工具，用于扫描目标 SDK 示例代码中的潜在漏洞。

系统同时具备一定的自我纠错能力：在整个过程中，验证协议识别并主动丢弃了 7 个误报（false positive），避免了把资源浪费在错误路径上。

## 三、对开发者意味着什么：实践清单

这起事件之所以值得每一位在构建或运维 Agent 系统的工程师认真对待，不只是因为它是"新闻"，而是因为它揭示的攻击面，本质上和我们自己在生产环境里搭建的智能体系统共享同一套底层组件与失败模式。以下是几条可以立刻落地检查的实践建议：

**1. 审计自己 Agent 系统的工具授权边界。** Hermes 和 OpenClaw 之所以能被武器化，核心在于它们默认就具备文件操作、代码执行、网络请求等强能力工具。如果你的 Agent 应用面向生产环境部署，务必对每个工具做最小权限原则（Principle of Least Privilege）的审计——一个客服 Agent 是否真的需要任意代码执行权限？一个数据分析 Agent 是否需要访问生产数据库的写权限？

**2. 给"多智能体并行"场景设置速率与预算护栏。** 这次攻击能在四天内测绘 21 个系统、发起 12 波攻击，靠的正是并行子智能体带来的规模效应。反过来看，如果你在自己的系统里允许 Agent 无限制地并行派生子任务、无限制地调用外部 API，一旦逻辑出错或被滥用，同样的规模效应会成为你自己的风险敞口。Anthropic 在 8 月更新的 Claude Developer Platform 里新增的"会话预算硬顶"（session budget，超出后以 `budget_reached` 停止新请求）就是这个方向上一个值得参考的产品化方案。

**3. 把"学习周期"类的联网检索能力当作高危权限对待。** 系统能自动检索漏洞库和 GitHub 寻找利用代码，说明"让 Agent 自主上网学习新技能"这件事本身的风险级别，应该等同于赋予它代码执行权限，而不是一个无害的"锦上添花"功能——尤其是在生产系统里，这类能力应该经过审批网关或人工确认后才能生效。

**4. 日志与可观测性要能重建完整的决策链。** Dream 之所以能完整还原这套系统的运作方式，恰恰是因为攻击者自己的系统留下了详尽的规划文档和事后报告——这对防御方是一把双刃剑：结构化、可追溯的 Agent 决策日志既是攻击者调试系统的必需品，也应该是每一个正规 Agent 应用的标配。如果你的 Agent 系统出了问题，你能否像 Dream 分析这次事件一样，完整复盘每一步的输入、决策依据和输出？

**5. 关注"AI 原生"防御产品的发展。** Dream 报告里最尖锐的一句话是："发起一次有效攻击的成本已经大幅下降，但防御一次攻击的成本却没有。"这意味着传统的、依赖人工分析和静态规则的安全产品，很难跟上这种自动化攻击的节奏。OpenAI 在 8 月 10 日发布的新一代"网络安全模型"，以及越来越多厂商推出的 AI 驱动 SOC（安全运营中心）产品，都是对这一趋势的直接回应，值得安全团队持续跟踪。

## 四、总结与展望

这起事件的技术含金量,不在于攻击者使用了什么"黑科技",而恰恰在于它证明了：用完全公开、免费、任何人都能在 GitHub 上下载的智能体框架,加上一点工程打磨,就足以搭建出一套能够攻陷国家级基础设施的自动化攻击系统。Dream 在报告中也坦承,尽管系统被形容为"近乎自主",但要让它真正有效运转,仍然"需要针对具体任务做细致调优、优化智能体协同、精调决策逻辑"——也就是说,这不是一个"一键攻击"的黑盒,而是需要相当工程能力的定制系统。这某种程度上是个好消息:说明短期内,普通脚本小子还无法轻易复制这样的攻击;但也是个坏消息:说明真正有资源、有耐心的攻击团伙,门槛正在快速降低。

对整个行业而言,2026 年可能会被回顾为"Agentic AI 安全"从理论讨论走向实战验证的转折点。就像十年前"云原生"倒逼了一整套新的安全产品和实践一样,"智能体原生"的攻防对抗,大概率也会催生新一代的护栏产品、审计工具和监管框架。作为开发者,与其等待监管补上空白,不如现在就重新审视自己手里 Agent 系统的权限边界、并发上限和日志完整性——毕竟这次撕开防线的,用的正是我们每天都在用的同款工具。

## 参考来源

- [Dream Security：Inside a Multi-Agent AI Framework Used to Compromise Government Entities in Asia](https://www.dreamgroup.com/blog/inside-a-multi-agent-ai-framework-used-to-compromise-government-entities-in-asia)
- [The Register: 'Near-autonomous' AI agents attack Taiwan's nuclear safety agency](https://www.theregister.com/security/2026/08/12/near-autonomous-ai-agents-attack-taiwans-nuclear-safety-agency/)
- [CyberScoop: Researchers observe first 'near-autonomous' AI attack on government target in Taiwan](https://cyberscoop.com/near-autonomous-ai-attack-government-target-taiwan/)
- [CNN Business: Hackers used autonomous AI agents to attack Taiwan. Is this the future of cyberwarfare?](https://www.cnn.com/2026/08/13/tech/china-taiwan-ai-agent-cyberattack-intl-hnk)
- [Cyber Magazine: China-Linked Autonomous Cyberattack on Taiwan Explained](https://cybermagazine.com/news/china-linked-autonomous-cyberattack-on-taiwan-explained)
- [Insurance Business: Autonomous AI hit on Taiwan linked to China](https://www.insurancebusinessmag.com/us/news/cyber/autonomous-ai-hit-on-taiwan-linked-to-china-585847.aspx)
- [Taipei Times 社论：AI cyberattack highlights risk（2026-08-21）](https://www.taipeitimes.com/News/editorials/archives/2026/08/21/2003862850)
- [Anthropic：Claude Developer Platform Release Notes（会话预算、GitHub 托管 Skills、推理地域绑定）](https://platform.claude.com/docs/en/release-notes/overview)
