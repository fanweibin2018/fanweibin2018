---
title: 'Claude Platform 的 Agent 四件套全部转正：Computer Use、Browser Use、Skills API、Files API 正式 GA'
date: 2026-08-25
slug: 'claude-platform-agent-gongju-quanmian-ga'
author: 范伟彬
categories:
  - AI
  - 大模型
tags:
  - Anthropic
  - Claude
  - Computer Use
  - Browser Use
  - Skills API
  - Files API
  - AI Agent
  - Claude Platform
description: '2026 年 8 月 19—20 日，Anthropic 把 Claude Platform 上支撑生产级 Agent 的四块拼图——computer use、全新的 browser use 工具、Skills API 和 Files API——全部从 beta 转为正式 GA，并同步开放到 Microsoft Foundry 与（即将到来的）Google Cloud Vertex AI。computer_toolset_20260801 支持一轮多动作、默认开启 zoom 区域放大，并已达到 HIPAA 合规资质；新的 browser 工具靠页面结构而非像素坐标定位元素，显著提升网页自动化的稳定性；Skills API 把"团队经验"变成可版本化、按需加载、在沙箱里执行的资产；Files API 吞吐提升 5 倍、每组织 1TB 专属存储。本文基于 Anthropic 官方博客与 Claude Platform 文档，拆解这四个组件的技术细节、API 调用方式与真实代码示例，并给出一份把它们拼成生产级 Agent 的实践指南。'
---

# Claude Platform 的 Agent 四件套全部转正：Computer Use、Browser Use、Skills API、Files API 正式 GA

如果你过去一年一直在用 Claude 的 computer use 或者 code execution 工具搭 Agent，大概率遇到过同一类烦恼：每次点一下鼠标、敲一行字，都要走一次完整的模型请求-响应循环，慢且贵；网页自动化靠像素坐标定位元素，页面稍微一改版就失效；给 Agent "喂"一套业务流程说明书，只能塞进系统提示词，既没有版本管理也无法按需加载；上传的文件资产也没有统一、稳定、可复用的存储层。

2026 年 8 月 19 日到 20 日，Anthropic 一次性把这几块长期停留在 beta 阶段的能力全部转正：**computer use 工具、全新的 browser use 工具、Skills API、Files API 正式 GA**，同步登陆 Claude Platform、Microsoft Foundry（Skills API 与 Files API），Google Cloud Vertex AI 上的 computer/browser 工具也在路上。Anthropic 官方博客把这次更新的定位说得很直白：这四样东西合在一起，才第一次真正具备了在生产环境里稳定跑"能操作软件的 Agent"的完整地基。这篇文章会把这四块拼图逐一拆开讲清楚，并给出可以直接照抄的调用示例。

## 一、背景：从"能演示"到"能上生产"

Computer use 工具从 2024 年底以 beta 形式登场以来，一直是 Claude Agent 生态里最具想象力也最容易"翻车"的能力——它让 Claude 能看着屏幕截图，像人一样点击、输入、滚动，从而操作那些根本没有 API 的老旧企业软件、Windows 桌面应用、内部管理后台。但 beta 阶段的痛点也很明显：

- **一次一动作**：模型每决定一个鼠标点击或一次按键，就要发起一次完整的 API 往返，任务越复杂，延迟和 token 成本越高；
- **定位脆弱**：无论是 computer use 还是普通浏览器自动化脚本，长期依赖屏幕坐标或 DOM 选择器，页面布局、分辨率、缩放比例一变就容易点空；
- **"经验"没有归宿**：团队沉淀的操作规范、报销流程、合规检查清单，除了写进又长又贵的系统提示词，没有更好的复用方式；
- **文件生命周期靠自己管**：Agent 生成的报表、截图、文档散落在各处，没有统一的引用和过期机制。

这次 GA 更新，正是针对性地解决这四个问题。Anthropic 给出的样例场景很典型：保险科技公司 Asteroid 用这套组合拳做理赔处理 Agent——通过 Files API 读取客户提交的理赔材料，按 Skills API 里存好的理赔审核流程逐条核对，再用新的 browser use 工具在没有 API 的第三方理赔门户网站上完成提交，最后把回执存回 Files API。官方给出的数字是：这个流程原本单次处理耗时 32 分钟，切换到新工具链后压缩到 13 分钟，测试的多个工作流平均节省了约 30% 的成本。

## 二、Computer Use：一轮多动作 + 区域放大，正式达到 HIPAA 合规

新版本的正式类型名是 `computer_toolset_20260801`，作为一个"客户端工具集"（client toolset），底层由 17 个成员动作组成，覆盖鼠标、键盘、截图、等待等全部基础操作。相比 2025 年 11 月发布的 beta 版本 `computer_20251124`（老模型仍可通过 beta header 继续使用），这次转正主要带来两点实质性变化：

**1. 批量动作（batch actions）。** 过去 Claude 每次只能返回一个 `tool_use` block，对应一次鼠标或键盘操作；现在一次模型响应里可以连续返回多个动作，比如"点击搜索框 → 输入文字 → 截图确认"三连击,由调用方按顺序执行完再统一把结果打包回传。规则很明确：动作按顺序执行、任意一步失败就停止并跳过剩余步骤，返回时要给每个 block（包括被跳过的）都配一条 `tool_result`，跳过的那些用固定文案 `"Not executed: an earlier computer action in this turn failed."` 说明。这直接把原来"一次点击一次网络往返"的模式,优化成了"一批动作一次网络往返"，是这次更新里对延迟和成本改善最直接的一项。

**2. zoom 动作默认开启。** 新增的 `zoom` 成员动作允许 Claude 对截图里的某个矩形区域 `[x0, y0, x1, y1]` 做局部放大检查，用来看清小字、密集控件或者被压缩过的截图细节，GA 版本里默认启用（可以通过 `configs.zoom.enabled: false` 关掉）。

**3. 合规资质到位。** computer use 工具现在已经具备在 HIPAA 相关业务协议（BAA）下处理受监管医疗数据工作负载的资质，这对于想拿它去做医疗、保险类流程自动化的团队是一个实质性的门槛跨越。

调用方式上，`computer_toolset_20260801` 作为一个 tool 类型直接放进 `tools` 数组即可，典型的最小示例：

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-5",
    max_tokens=1024,
    tools=[
        {"type": "computer_toolset_20260801"},
        {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
        {"type": "bash_20250124", "name": "bash"},
    ],
    messages=[{"role": "user", "content": "帮我把一张猫的图片保存到桌面"}],
)
```

Claude 会以 `stop_reason: "tool_use"` 返回一个或多个 `tool_use` block，每个都带有 `toolset_name: "computer"`：

```json
{
  "type": "tool_use",
  "id": "toolu_01WkoTUvSHDzTBu2xnGk8Ep8",
  "name": "left_click",
  "toolset_name": "computer",
  "input": { "coordinate": [512, 742] }
}
```

调用方执行完对应操作后，把结果按同样的顺序、附带同一个 `toolset_name` 打包进下一轮的 `tool_result` 传回去，形成一个标准的采样循环（sampling loop）。需要特别注意的实现细节：坐标系统是"截图像素空间"而不是"屏幕物理空间"，如果发送前对截图做了降采样，点击坐标也要按比例换算回去；macOS Retina 屏要额外处理 2 倍的设备像素比；单次请求里的截图数量建议控制在 20 张以内，超出后模型对每张图片的分辨率限制会更严格。

安全方面，官方文档给出的建议清单值得每个接入方照做：在专用的、权限最小化的虚拟机或容器里运行；不要给 Agent 提供敏感凭据；把网络访问限制在白名单域名内；对高风险操作要求人工确认。GA 版本还内置了一个自动的提示注入分类器，会对可疑的页面内容/指令做拦截标记（如确有需要可联系支持团队申请关闭）。

## 三、全新的 Browser Use 工具：从"看像素"到"读结构"

如果说 computer use 面向的是任意桌面软件，那这次新增的 **browser use 工具**（`browser_toolset_20260801`）就是专门为 Web 应用场景优化的姊妹工具。它同样是一个客户端工具集，同样支持一轮多动作，但关键区别在于元素定位方式：不再单纯依赖截图上的像素坐标，而是解析页面结构（DOM/可访问性树），直接识别具体的输入框、按钮等元素并与之交互。

这个改动看似细节,实际影响很大——纯像素坐标定位的自动化脚本,最脆弱的地方就是页面稍微改版、字体渲染差异、窗口分辨率变化，坐标就全部失效；而基于页面结构定位，只要目标元素的语义角色没变（依然是"提交订单"按钮），布局怎么调整都不太影响识别的稳定性和跨环境的可复现性。对于前面提到的 Asteroid 理赔场景——在没有开放 API 的第三方保险门户网站上完成表单提交——这正是browser use 工具被验证过的典型任务形态。

需要指出的是，browser use 工具驱动的是"你的应用自己托管的浏览器"（client-hosted），也就是说执行环境仍然由调用方提供和控制，Anthropic 侧只负责生成动作指令,这与 computer use 依赖调用方提供操作环境的模式是一致的设计哲学：Claude 负责"决策"，执行环境的隔离与安全边界始终由接入方掌控。

## 四、Skills API：把团队经验变成可版本化、按需加载的资产

Skills（Agent Skills）本身不是这次才有的新概念，但 Skills API 的 GA 第一次把"上传自定义技能包、按版本管理、在需要时才加载"这套完整流程做成了正式产品能力。核心心智模型是**渐进式披露（progressive disclosure）**：

1. Claude 启动时先通过 `GET /v1/skills` 拉到所有可用 Skill 的**元数据**（名字 + 简短描述），这一步不会加载完整指令，成本极低；
2. 当一次具体请求的任务与某个 Skill 的描述匹配时，Claude 才会去加载该 Skill 的完整说明文档（比如详细的操作规范、代码模板），并在 Claude 自带的代码沙箱里执行相关代码——不需要你自己搭建执行环境。

调用方式是通过 Messages API 的 `container.skills` 字段声明启用哪些 Skill，并且必须搭配 code execution 工具一起使用（因为 Skill 的执行发生在代码沙箱里）：

```python
response = client.messages.create(
    model="claude-opus-5",
    max_tokens=16000,
    container={
        "skills": [{"type": "anthropic", "skill_id": "pptx", "version": "latest"}]
    },
    messages=[
        {"role": "user", "content": "帮我做一份关于可再生能源的 5 页 PPT"}
    ],
    tools=[{"type": "code_execution_20260521", "name": "code_execution"}],
)
```

`type: "anthropic"` 表示这是 Anthropic 官方托管的预置 Skill（目前提供 `pptx`、`xlsx`、`docx`、`pdf` 四个文档处理类 Skill），如果换成自己上传的自定义 Skill，`type` 会是 `custom`。`version` 字段既可以固定成一个具体的 `version_id` 做灰度锁定，也可以填 `"latest"` 始终跟随最新发布版本。Claude 生成的产物（比如上面例子里的 PPTX 文件）会出现在响应里嵌套的 `bash_code_execution_tool_result` 结构中,携带一个 `file_id`，随后可以直接用 Files API 把它下载下来：

```python
file_id = None
for block in response.content:
    if block.type == "bash_code_execution_tool_result":
        if block.content.type == "bash_code_execution_result":
            for output in block.content.content:
                file_id = output.file_id

if file_id:
    file_content = client.files.download(file_id=file_id)
    file_content.write_to_file("renewable_energy.pptx")
```

自定义 Skill 的版本管理模型值得单独说一句：**新版本是一次完整快照，不是增量补丁**——每次上传都要带上 Skill 的全部文件集合，遗漏的文件不会自动沿用上一版本,新版本 `SKILL.md` 里声明的名字也必须和该 Skill 已有的名字保持一致。这个设计强制团队把每个版本的 Skill 当作一个自包含、可独立回滚的单元来维护，避免"这个版本到底依赖了哪些散落文件"的排查噩梦。目前 Skills API 除了 Claude Platform 之外，也已经在 Microsoft Foundry 上线。

## 五、Files API：吞吐提升 5 倍，1TB 专属存储

Files API 这次的更新相对"低调"但同样是生产可用性的关键一环：**速率限制提升到之前的 5 倍**，每个组织获得 **1TB 专属存储**，并且支持自动的过期管理（不用自己写定时清理任务）。对于像上面理赔场景那样"读取输入文件 → 中间产出多份文档 → 引用之前生成的文件继续处理"的多步 Agent 工作流来说，Files API 承担的是"以 file_id 为单位在多轮请求之间稳定传递大对象"的角色——不需要每次都把整份文件内容塞进上下文窗口，只需要引用一个 ID。这次吞吐能力的提升，直接对应的是像 computer use 批量动作、Skills 产出文档这类会频繁读写文件的高并发 Agent 场景。

## 六、实践指南：把四件套拼成一个生产级 Agent

结合官方给出的理赔处理案例，一个把这四个组件串起来的典型 Agent 工作流大致是这样：

1. **Files API 读取输入**：客户上传的理赔材料（PDF、截图）先进 Files API，Agent 通过 `file_id` 引用，不需要每轮都重复上传；
2. **Skills API 提供业务规则**：把"理赔审核 SOP"上传为一个自定义 Skill 并打好版本号，Claude 判断当前任务与该 Skill 相关时自动加载完整审核流程，业务规则改了只需要发布新版本，不需要改代码;
3. **Browser use 处理无 API 的第三方系统**：在保险公司自己的门户网站上完成材料提交，靠页面结构定位而不是硬编码坐标，页面改版时的维护成本更低；
4. **Computer use 兜底处理桌面遗留系统**：如果流程中还涉及只能靠桌面客户端操作的老系统，用 computer use 的批量动作一次性完成"打开程序 → 填表 → 截图存证"这一串操作，减少往返延迟；
5. **回写 Files API**：把最终的回执、审核记录重新存回 Files API，供后续环节或人工复核引用。

几条从这次更新里能直接提炼出的工程建议：

- **能用 browser use 就不要用 computer use**：只要目标是网页应用，结构化定位天然比像素坐标更稳，出错率和维护成本都更低,computer use 更适合留给真正没有网页界面的桌面软件。
- **把"团队经验"从提示词里搬到 Skills 里**：冗长、频繁变动的业务 SOP 塞进系统提示词，既浪费上下文窗口 token，又没有版本回滚能力；用 Skills API 管理之后，可以按 `version_id` 做灰度发布，出问题一键回退到旧版本。
- **善用批量动作压缩往返次数**：设计 computer use 的调用逻辑时，尽量让模型一次性规划出一组连续动作（比如"打开菜单 → 点某一项 → 截图确认"），而不是每一步都单独发起请求，这是这次更新里对成本影响最直接的开关。
- **默认把 Agent 关进最小权限环境**：无论是 computer use 还是 browser use，执行环境的隔离、网络白名单、高风险操作的人工确认，都是接入方自己的责任，Anthropic 只提供了"内置提示注入分类器"这一层兜底，不能替代基础的沙箱隔离。

## 七、总结与展望

这次 GA 更新的价值不在于单个能力有多"炫技"，而在于 Anthropic 第一次把"感知 + 操作 + 知识 + 存储"这四块此前各自为战的 beta 能力，收敛成了一套可以放心接入生产环境的完整工具链：computer use 解决"看得见、点得动"，browser use 解决"网页场景下点得更稳"，Skills API 解决"经验怎么复用和迭代"，Files API 解决"大文件怎么在多轮对话里稳定流转"。四者组合起来，指向的是一个更明确的产品判断：Agent 要真正在企业里干活，光会"聊天式回答问题"是不够的，还得能像一个新员工一样，打开系统、按流程办事、把结果存档。

值得关注的后续动作：Google Cloud Vertex AI 上的 computer use / browser use 支持还在路上，届时三大云平台（AWS Bedrock、Google Cloud、Microsoft Foundry）加上 Claude 原生 API 会形成更完整的多云覆盖；另外，Anthropic 目前没有公开这四项能力各自的独立定价细节,如果你的 Agent 计划里大量使用 computer use 截图循环，实际的 token 成本（官方文档提到单张截图大约消耗 1000–1800 输入 token）值得在正式上线前用真实工作流跑一次压测。对国内开发者而言，如果你已经在用 Claude Code 或者自建 MCP 工具链搭 Agent，这次更新意味着"操作没有 API 的老系统"和"沉淀团队 SOP"这两个长期缺失的拼图，现在都有了官方支持的正式方案，值得认真评估一次接入。

## 参考来源

- [Build production agents with computer use, the Skills API, and the Files API — Claude by Anthropic](https://claude.com/blog/computer-use-skills-api-files-api)
- [Computer use tool — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- [Get started with Agent Skills in the API — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart)
- [Agent Skills overview — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
