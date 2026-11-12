---
title: 'A2UI 1.0：Agent 生成界面，为什么该发组件数据而不是 HTML'
date: 2026-11-13
slug: 'a2ui-1-0-declarative-generative-ui'
author: 范伟彬
description: 'A2UI 1.0 把 Agent 生成的界面限制在应用批准的组件目录内，并由 React、Flutter、SwiftUI 等客户端原生渲染。本文解释协议、数据绑定、双向函数调用、安全边界与可复现验证。'
source: 'https://developers.googleblog.com/a2ui-10-build-delightful-fast-reliable-agentic-experiences/'
categories:
  - AI
  - 技术
  - 前端
tags:
  - A2UI
  - Generative UI
  - AI Agent
  - MCP Apps
  - 前端架构
---

# A2UI 1.0：Agent 生成界面，为什么该发组件数据而不是 HTML

让 Agent 回答“批准这个版本吗”，最自然的结果不是一段解释，而是一张带版本号、风险提示和批准按钮的确认卡片。问题是：如果直接让模型返回 HTML 和 JavaScript，应用等于在接收一段不可信程序；如果所有界面都提前写死，又失去了 Agent 按任务临时组合交互的能力。

Google 在 11 月 11 日发布稳定版 A2UI 1.0，选择了中间路线：Agent 不发送可执行界面代码，只发送“这里放一个标题、一个输入框和一个按钮”这样的结构化数据；客户端再把这些数据映射成自己批准的 React、Flutter、SwiftUI 或 Jetpack Compose 组件。

这像餐厅的点菜单。客人可以自由组合菜单上已有的菜，却不能走进厨房临时发明一种会操作燃气管道的新做法。A2UI 的 **Catalog（组件目录）**就是菜单：它规定 Agent 可以使用哪些组件、属性和函数；JSON Schema 负责检查点单格式；真正的组件代码和权限仍掌握在应用手里。

## 一张动态界面是怎样到达用户面前的

A2UI 把链路拆成三层：

1. **推理层**：语言模型或 Jev 这类决策模型选择组件、布局和数据绑定；
2. **传输层**：Agent SDK 解析模型输出，展开宏并校验，转换成稳定的 A2UI 消息；
3. **渲染层**：客户端 Core 维护界面与数据状态，框架适配器把组件映射为原生控件。

协议传输的是 JSON 消息流，而不是像素，也不是组件源码。最基本的四类消息是：

- `createSurface`：创建一个可渲染区域；
- `updateComponents`：增加或替换组件；
- `updateDataModel`：只更新数据；
- `deleteSurface`：删除界面。

“界面”和“数据”分开很重要。订单列表已经画好后，后端收到新价格，只需更新 `/orders/0/price`，不必让模型重新生成整棵组件树。组件通过 `{"@path": "/orders/0/price"}` 读取数据，输入控件也能把用户编辑写回同一路径。

A2UI 使用扁平的邻接表描述树：每个组件有唯一 `id`，容器通过子组件 ID 连接它们。这样消息可以流式到达，客户端也能单独替换一个节点，而不用反复传输深层嵌套的大对象。

## 1.0 真正新增的是“双向能力”，不只是版本号

早期 A2UI 已经能让 Agent 描述组件。1.0 把交互补成双向协议：

- Agent 用 `callRendererFunction` 请求客户端执行已注册函数；
- 客户端用 `callAgentFunction` 请求 Agent 或后端完成远程函数；
- 两边用带相同 `functionCallId` 的响应返回结果或错误。

例如，日期格式化可以在客户端本地完成；查询库存则交给后端。目录中的函数定义包含参数 Schema、返回类型、允许的调用方，以及是否要求用户主动操作。基础目录里的 `openUrl` 就被标记为 `requiresUserActivation: true`，Agent 不能在后台悄悄打开链接。

1.0 还允许同一界面混用多个目录。旅行应用可以把自家的航班卡片、支付团队维护的付款组件和基础文本组件放在一个 Surface 中，但每个组件都要显式属于已协商的 Catalog。`catalogId` 是双方约定的标识，不表示运行时会访问这个网址下载代码；找不到已协商目录时应报错，而不是猜一个相近组件继续渲染。

其他容易踩坑的迁移变化包括：

- 消息里的版本写作 `"1.0"`，不是 `"v1.0"`；
- MIME 类型统一为 `application/a2ui+json`；
- 组件级通用字段改为 `@catalogId`、`@accessibility`、`@metadata` 和 `@checks`；
- `createSurface` 可以一次携带初始组件和数据；
- `updateDataModel.value` 变为必填，传 `null` 才表示删除。

这些看似细小，却是跨语言实现能否一致解析的关键。旧目录不能只改版本字符串就当作 1.0 使用。

## 为什么它比“让模型写 HTML”更可控

直接生成 HTML 的自由度最高，代价是模型也能生成脚本、事件处理器、外链和任意 DOM 结构。即使放进 iframe，应用仍要处理沙箱权限、消息通信、样式隔离和无障碍一致性。

A2UI 先把能力收窄：

- Agent 只能选择 Catalog 里存在的组件和函数；
- 属性必须通过 Schema 校验；
- 客户端使用自己的组件实现和设计系统；
- 敏感数据可由确定性后端写进 Data Model，不必先经过模型；
- 同一份消息可以在不同平台映射为各自的原生控件。

这与 MCP Apps 不是简单的替代关系。MCP Apps 适合把一段完整的交互式 Web 应用作为工具界面放进沙箱 iframe；A2UI 更像跨端的“界面描述协议”，由宿主使用本地组件渲染。官方已经让 Web 和 Flutter 渲染器可运行在 MCP Apps 内，两者也可以组合使用。

## 用官方 Schema 验证一张批准卡片

下面的 `approval.json` 是一个可运行的 A2UI 1.0 消息。它只描述布局、事件和数据绑定，不包含 JavaScript：

```json
{
  "version": "1.0",
  "createSurface": {
    "surfaceId": "release-approval",
    "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
    "components": [
      {
        "id": "root",
        "component": "Column",
        "children": ["title", "approve"]
      },
      {
        "id": "title",
        "component": "Text",
        "text": "确认发布版本 1.4.0"
      },
      {
        "id": "approveLabel",
        "component": "Text",
        "text": "批准"
      },
      {
        "id": "approve",
        "component": "Button",
        "child": "approveLabel",
        "action": {
          "event": {
            "name": "approveRelease",
            "context": {
              "releaseId": {"@path": "/release/id"}
            }
          }
        }
      }
    ],
    "dataModel": {
      "release": {"id": "v1.4.0"}
    }
  }
}
```

以下命令固定到本文验证过的源码提交，并用官方 Schema 检查文件。需要 Git、Node.js、npm 与 `jq`：

```bash
git clone https://github.com/a2ui-project/a2ui.git
cd a2ui
git checkout 3f7e4852bc2d1e8e1f06534caf261e565e608f64

npm install --prefix /tmp/a2ui-check ajv-cli@5 ajv-formats@3

jq '.["$id"] = "https://a2ui.org/specification/v1_0/catalog.json"' \
  catalogs/basic/v1/catalog.json > /tmp/catalog.json

/tmp/a2ui-check/node_modules/.bin/ajv validate \
  --spec=draft2020 --strict=false -c ajv-formats \
  -s specification/v1_0/json/agent_to_renderer.json \
  -r specification/v1_0/json/common_types.json \
  -r /tmp/catalog.json \
  -d /path/to/approval.json
```

本文实际运行得到 `/path/to/approval.json valid`。把按钮的 `component` 改成目录里不存在的 `RunShell` 后，校验以状态码 1 失败。另在同一固定提交下执行了官方 v1.0 规范测试矩阵，200 项全部通过。

这个结果证明的是消息符合当前基础目录和协议 Schema，不代表它已经连接后端、完成视觉验收，也不证明业务操作安全。

## 真正上线时，安全边界仍在应用里

“不传可执行代码”降低了攻击面，却不是自动安全证书。

首先，Schema 只能证明结构合法。一个合法按钮仍可能请求“删除全部数据”。后端必须再次校验身份、租户、对象权限和参数；有副作用的动作还应设计幂等键、审计日志与确认步骤。

其次，Catalog 是能力清单，不是装饰清单。把 `deleteAccount`、任意 URL 跳转或读取本地文件注册进去，就等于主动把这些能力交给 Agent。目录应按最小权限拆分，远程函数要区分只允许客户端、只允许 Agent 或双方调用。

再次，Data Model 可能包含个人信息。官方提供 `sendDataModel` 选项，但不应因此把整棵状态树默认回传给模型。更稳妥的做法是让确定性代码只注入渲染所需字段，并在事件回传时只带后端真正需要的上下文。

最后，1.0 稳定指协议稳定，不等于所有平台实现已经完全同步。发布公告说明 React、Angular、Lit 和 Flutter 已有开源渲染器，而 SwiftUI 与 Jetpack Compose 当时仍使用 0.9.1，1.0 支持随后到来。多端项目应先核对所用 SDK 的实际协议版本，再决定是否启用混合 Catalog 和双向函数调用。

## 哪些项目值得现在采用

A2UI 适合这些场景：

- Agent 根据任务临时组合表单、审批卡、对比表和操作面板；
- 同一 Agent 要服务 Web、Android、iOS 与桌面端；
- 第三方 Agent 需要跨越信任边界，但不能获得任意前端代码执行权；
- 应用已有成熟设计系统，希望 Agent 复用原生组件而不是另造一套界面。

它不适合高度定制的动画、游戏、自由画布，或必须运行复杂前端逻辑的完整微应用；这些任务使用传统前端或沙箱化 MCP App 往往更直接。固定且简单的页面也没有必要为了“Agent 化”增加一层协议。

A2UI 1.0 的价值不在于让模型变成前端工程师，而在于把模型放回一个受约束的角色：它负责选择和组合，应用负责实现、验证与授权。对真正要把 Agent 接进生产界面的团队，这条分工比“模型能不能生成漂亮 HTML”重要得多。

## 原始资料

- [Google Developers Blog：A2UI 1.0 发布说明](https://developers.googleblog.com/a2ui-10-build-delightful-fast-reliable-agentic-experiences/)
- [A2UI 1.0 协议规范](https://github.com/a2ui-project/a2ui/blob/3f7e4852bc2d1e8e1f06534caf261e565e608f64/specification/v1_0/docs/a2ui_protocol.md)
- [A2UI 1.0 迁移指南](https://github.com/a2ui-project/a2ui/blob/3f7e4852bc2d1e8e1f06534caf261e565e608f64/specification/v1_0/docs/evolution_guide.md)
- [A2UI 基础组件目录](https://github.com/a2ui-project/a2ui/blob/3f7e4852bc2d1e8e1f06534caf261e565e608f64/catalogs/basic/v1/catalog.json)
- [本文验证使用的固定源码提交](https://github.com/a2ui-project/a2ui/tree/3f7e4852bc2d1e8e1f06534caf261e565e608f64)
