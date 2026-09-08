---
title: 'Runway 发布 Solaris：当界面不再是代码，而是每帧生成的视频'
date: 2026-09-02
slug: 'runway-solaris-jiemian-shijie-moxing'
author: 范伟彬
categories:
  - AI
tags:
  - Runway
  - 世界模型
  - Interface World Model
  - 视频生成
  - Gen-4.5
  - GWM-1
  - AI 生成 UI
description: '2026 年 8 月 31 日，Runway 发布了 Solaris——它称之为"界面世界模型"（Interface World Model）的全新品类：一个不写一行代码、逐帧实时生成软件界面的系统。本文基于 Runway 官方研究博客及 The Decoder、AlphaSignal、TechTimes 等外媒报道，拆解 Solaris 的三段式架构（LLM 推理 + 世界模型渲染 + 自回归蒸馏）、与 Google DeepMind Genie 3 等世界模型的定位差异，以及业内对其"确定性"缺陷的关键质疑，供正在关注生成式 UI、Agent 训练环境的开发者参考。'
---

# Runway 发布 Solaris：当界面不再是代码，而是每帧生成的视频

## 一、背景：一个新品类的诞生

2026 年 8 月 31 日，视频生成公司 Runway 在其研究博客上发布了 Solaris，并给它起了一个此前不存在的名字："界面世界模型"（Interface World Model）。Runway 抛出的问题很直白：当操作系统能够实时生成应用和网站的时候，会发生什么？

这不是一次常规的产品更新。过去几年，软件开发的核心流程始终是"设计稿 → 代码 → 运行时渲染"：设计师画出交互稿，前端工程师把它翻译成 HTML/CSS/JS 或原生组件代码，浏览器或系统再把代码渲染成用户看到的像素。Runway 把这条链路里的"代码"这一环整个拿掉了——Solaris 不生成代码，而是直接、逐帧地合成界面本身。用户的每一次点击、拖拽或语音指令，都会被系统当作"下一帧画面"的条件信号，就像文本生成模型把上一个 token 当作生成下一个 token 的条件一样。

这也是 Runway 在世界模型赛道上的又一步棋。2025 年 12 月，Runway 发布了通用世界模型 GWM-1，主打游戏与机器人仿真场景，并称其比 Google DeepMind 的 Genie 3（2025 年 8 月发布，主打实时生成 3D 游戏世界，720p、24fps）更"通用"。Solaris 则是把同一套世界模型技术，第一次应用到了 Genie 3 和 GWM-1 都没有覆盖的领域：通用软件界面。

对于长期关注 Agent、生成式 UI、多模态模型的开发者来说，Solaris 提供了一个具体案例，展示"视频生成"和"软件"这两个原本平行的技术谱系正在如何合流。

## 二、技术细节解析：把 UI 当视频来生成

### 2.1 三段式架构：推理与渲染解耦

Solaris 的核心设计思路是把"决定界面该怎么演变"和"把这个演变画出来"两件事彻底拆开：

- **语言模型（LLM）负责推理**：理解用户意图、决定界面接下来应该朝什么方向变化；
- **世界模型负责渲染**：把语言模型给出的"应该怎么变"具体渲染成像素级的视觉帧；
- **底层视频生成基础设施是 Gen-4.5**：Runway 今年早些时候发布的视频生成模型（在其 Video Arena 榜单上超过了 Google 和 OpenAI 的对应模型），为逐帧生成提供了视觉保真度的基础。

用 Runway 自己的话说，"语言模型确定界面如何演进，世界模型生成该行为的视觉表现"。这种解耦的好处很直观：视觉渲染的一致性和真实感交给专门为此优化的视频模型去做，而"这个按钮该不该亮、下一步该展示什么内容"这类语义决策留给语言模型处理，两者各司其职。

### 2.2 实时性：自回归 + 步骤蒸馏 + 自蒸馏

生成式视频模型天生的问题是慢——传统扩散模型的多步去噪过程无法满足人机交互所需要的实时响应。Solaris 通过三个技术手段把生成速度压到了交互可用的水平：

1. **自回归生成**：每一帧只依赖前一帧作为条件，而不是对整段交互重新生成，这让增量更新成为可能；
2. **去噪步骤蒸馏**：把原本需要多步迭代的扩散去噪过程,压缩成极少数步骤;
3. **自蒸馏训练**：用一个更快但质量打了折扣的模型，反过来蒸馏训练自己，在压缩推理步骤的同时尽量保住教师模型的视觉质量。

三者叠加的效果,官方描述为"在保持原始教师模型视觉质量的同时,以交互速度生成帧"。最终系统运行在 720p 分辨率下,可以对点击、拖拽、语音等多种输入形式做实时响应。

### 2.3 交互建模:用户输入是"条件",不是"事件"

与传统 GUI 框架把点击、拖拽当作触发某个事件处理函数的"事件"不同,Solaris 把这些交互直接当作生成下一帧的条件信号,和文本 prompt、参考图像放在同一个序列里处理。训练时,模型只能看到已经发生过的交互,不会看到未来的交互——这保证了模型学到的是"用户操作 → 视觉结果"的因果关系,而不是作弊式地窥探未来状态。

这意味着 Solaris 里没有预先定义好的"页面"或"组件模板"可以退回去套用,交互的含义完全由自然语言 prompt 来指定。举例来说,如果你告诉系统"这是一个换脸试衣的电商界面",那么用户把一件衣服拖到自己照片上这个动作,会被模型理解为"应该把这件衣服穿到人物身上并重新渲染整个场景",而不是触发某个写死的"换衣函数"。

### 2.4 官方评测数据

Runway 公布了一组用户研究结果:250 名参与者完成了 7,500 组两两对比判断,考察生成结果在"指令遵循准确度"和"行为自然度"两个维度上的表现。结果显示,Solaris 在"指令遵循"上的偏好率为 61%,在"自然行为感受"上的偏好率为 71%。同时官方还引用了基于 SSIM 和 DINOv3 相似度指标的基准测试,称 Solaris 在这些指标上超过了 GPT-4o、Gemini 2.5 Pro 和 Fable 5。需要指出的是,截至发稿,这些数据均来自 Runway 官方披露,尚无第三方独立复现或验证。

## 三、与传统开发范式的对比:"翻译税"与"确定性"之争

### 3.1 Runway 的卖点:消除"翻译税"

Runway 给出的核心论点是,传统软件开发流程中存在一种"翻译税"(translation tax):设计稿必须被工程师翻译成代码,这个翻译过程天然会丢失信息、引入偏差,并且需要额外的人力和时间成本。Solaris 试图跳过这个中间层,让视觉设计本身直接成为可交互的应用——所见即所得,而且"所见"和"所得"是同一个东西。

官方给出的目标应用场景包括:虚拟试衣间等沉浸式购物体验、根据用户操作实时调整的自适应教程系统、千人千面的品牌店面体验,以及一个格外值得关注的方向——**Agent 训练环境**。让 LLM Agent 在动态生成、此前从未见过的界面上训练和评测,有可能提升 Agent 在真实世界里操作陌生软件界面的泛化能力,这对当前正火热的"计算机使用"(computer use)类 Agent 研究是一个有意思的补充思路。

### 3.2 批评者的核心质疑:界面本质上是"契约"

不过,业内对 Solaris 最尖锐的质疑,恰恰指向了它最大的卖点。评论普遍指出:界面从根本上说是一种"契约"——一个复选框应该有稳定、确定的状态;一个数量输入框里应该精确地保存用户输入的那个数字;一个删除确认弹窗,无论场景光线如何变化,都必须要求用户明确确认,不能被"生成"掉。一个以概率方式生成视觉行为的系统,在目前的形态下,无法提供这些工程上必需的确定性保证。

对于银行、医疗、政务等任何要求"相同输入必须可靠地产生相同的、可问责结果"的工作流场景来说,这不是一个未来可以打补丁修复的小缺陷,而是概率式视觉生成方法在结构上的固有属性。换句话说,Solaris 目前更适合"体验型"场景(购物、教程、演示),而非"事务型"场景(交易、审批、数据录入)。

### 3.3 与 Genie 3 的定位差异

把 Solaris 放进整个"世界模型"版图里看,分工其实很清晰:Google DeepMind 的 Genie 3 面向的是可交互的 3D 游戏世界;Runway 自己的 GWM-1 面向游戏与机器人仿真;而 Solaris 是第一个把这套技术路线对准"通用软件界面"这个目标的系统。三者共享类似的底层思路(自回归、逐帧生成、以交互为条件),但应用场域彼此错开,目前还谈不上直接的竞争关系。

## 四、实践指南:开发者现在能做什么

Solaris 目前处于早期访问阶段,尚未开放公共 API、SDK 或可下载的开源权重,Runway 官方的说法是"正在与关键合作伙伴合作推出公开版本",感兴趣的开发者只能通过官网表单申请早期访问名额。也就是说,目前还没有可以直接调用的接口让你在自己的项目里跑一个 Solaris 实例。

在这个阶段,对开发者更现实的建议是:

**1. 理解交互协议的抽象方式,而不是等 API**

即便无法调用 Solaris 本身,它这种"帧 t-1 + 用户动作 → 帧 t"的建模范式,值得类比到自己正在做的 Agent 或多模态项目里去思考。可以用下面这段伪代码理解它的输入输出结构:

```python
# 概念示意:Interface World Model 的推理循环(非 Solaris 真实接口)
def generate_next_frame(history_frames, user_action, system_prompt):
    # LLM 负责推理:根据历史帧与用户动作,决定界面应如何演变
    intent = llm.infer_intent(
        context=history_frames[-1],
        action=user_action,      # 点击坐标 / 拖拽轨迹 / 语音指令
        instructions=system_prompt,
    )
    # 世界模型负责渲染:把"应该怎么变"渲染成下一帧画面
    next_frame = world_model.render(
        prev_frame=history_frames[-1],
        intent=intent,
    )
    return next_frame

frame = initial_state
while session_active:
    action = capture_user_input()
    frame = generate_next_frame(history, action, system_prompt)
    display(frame)
    history.append(frame)
```

这段伪代码的重点不在于复刻 Solaris,而在于说明:一旦把"用户交互"当作序列的一部分去建模,原本"事件驱动"的 GUI 编程范式,就切换成了"条件生成"范式——这和当前多模态大模型处理图文交错输入的方式是同构的。

**2. 用"确定性 vs 体验性"给场景分类**

在评估是否要把这类技术引入自己的产品之前,可以先按照第三节提到的"契约 vs 体验"标准,把自己的功能模块过一遍:凡是涉及金额、权限、状态持久化的模块(购物车结算、支付、权限审批),现阶段应继续用确定性代码实现;凡是以展示、探索、个性化呈现为主的模块(商品展示、教程演示、营销页面),可以关注这类生成式界面技术未来落地的可能性,提前预留产品设计上的接口。

**3. 关注无障碍与可验证性两个硬指标**

Runway 官方也承认,当前 Solaris 还缺乏与屏幕阅读器等辅助技术的集成,且长会话下的视觉与语义一致性仍在研究中。如果未来考虑引入类似技术,这两项应该被列为验收标准的硬性门槛,而不是"后续再优化"的选项。

## 五、总结与展望

Solaris 代表的是一种值得被认真对待、但暂时不该被神化的技术方向。它把视频生成模型的自回归、蒸馏、条件生成这些成熟技术,第一次系统性地应用到了"生成通用软件界面"这个此前无人涉足的领域,并且给出了一套清晰的三段式架构(LLM 推理 + 世界模型渲染 + 蒸馏加速)来解决实时性问题。这对正在研究生成式 UI、Agent 训练环境、以及"计算机使用"类 Agent 的开发者而言,是一个值得跟踪的一手案例。

但同样清楚的是,当前版本的 Solaris 还处于早期研究阶段:没有公开 API、没有独立复现的基准测试、720p 的分辨率上限、文本渲染不稳定、长会话一致性存疑,更重要的是,业内对其"确定性"缺陷的质疑,指向的是一个短期内很难通过工程优化绕开的结构性问题。对于开发者来说,理性的态度或许是:把它当作一个"体验型"场景的候选方案去观察和试验,而不是急于把它接入任何需要强确定性保证的业务系统。

软件是否会真的从"代码"演变为"每帧生成的视频",现在下结论还为时过早。但 Runway 用 Solaris 提出了一个足够具体、足够有技术含量的问题,值得每一个思考"AI 之后软件长什么样"的开发者去认真琢磨。

## 参考来源

- [Runway News | Introducing Solaris](https://runway.com/news/research/introducing-solaris)
- [Runway's Solaris is an AI system that generates software interfaces in real time - The Decoder](https://the-decoder.com/runways-solaris-is-an-ai-system-that-generates-software-interfaces-in-real-time/)
- [Runway Solaris Launches: App Interfaces Now Run as Live Video, Zero Code - Tech Times](https://www.techtimes.com/articles/326134/20260901/runway-solaris-launches-app-interfaces-now-run-live-video-zero-code.htm)
- [Runway's Solaris Renders Interactive Apps as Live Video, No Code Needed - AlphaSignal](https://alphasignal.ai/news/runway-s-solaris-renders-interactive-apps-as-live-video-no-code-needed)
- [Runway wants to generate software as you use it. Solaris is its first step. - The New Stack](https://thenewstack.io/runway-solaris-generated-interfaces/)
- [Runway unveils Solaris, a real-time interactive interface model that generates apps without code - Crypto Briefing](https://cryptobriefing.com/runway-solaris-interactive-interface-model/)
- [Genie (world model) - Wikipedia](https://en.wikipedia.org/wiki/Genie_(world_model))
