---
title: 'agent-desktop 1.0：AI 操作桌面，为什么“快照引用”比像素坐标更可靠'
date: 2026-11-01
slug: 'agent-desktop-snapshot-ref-computer-use'
author: 范伟彬
description: 'Vercel Labs 的 agent-desktop 1.0 把 macOS、Windows 和 Linux 桌面自动化统一为无障碍树、快照引用与可判定重试的 JSON 接口。本文解释它如何减少错点和重复操作，并给出安装自检、平台边界与 JEV 隐私提示。'
source: 'https://github.com/vercel-labs/agent-desktop/releases/tag/v1.0.2'
categories:
  - AI
  - 技术
  - 开源
tags:
  - agent-desktop
  - Computer Use
  - AI Agent
  - 无障碍树
  - 桌面自动化
---

# agent-desktop 1.0：AI 操作桌面，为什么“快照引用”比像素坐标更可靠

Vercel Labs 在 **2026 年 10 月 27 日**发布了 agent-desktop 1.0，把 macOS、Windows 和 Linux 的桌面操作收敛为同一套 Rust CLI 与 C 接口；10 月 30 日的 1.0.2 又修正了安装提示和 macOS 权限流程。它不是新的 Computer Use 模型，而是一层给 Agent 调用的桌面执行工具：从操作系统的无障碍树读取按钮、输入框和窗口，把它们变成 JSON，再让上层模型决定下一步。

这一区别很重要。只看截图的 Agent 常会遇到“按钮挪了十个像素”“弹窗盖住了原位置”“页面刷新后旧坐标点到了另一个控件”。agent-desktop 试图解决的不是视觉理解，而是动作落地时的身份问题：**这次点击指向的，还是刚才看到的那个元素吗？**

截至 2026 年 11 月 1 日观察，项目仓库约有 4,000 个 Star，只能说明它正在受到关注，不能据此推断生产采用率或成功率。项目也没有公布独立的桌面任务基准。不过，它把几个经常被 Computer Use 演示忽略的工程问题——元素身份、动作是否送达、能否安全重试、敏感信息是否离开本机——做成了显式协议，值得单独理解。

## 它把“看屏幕”拆成了两层

传统视觉式 Computer Use 大致是：截图交给模型，模型返回坐标，执行器移动鼠标。这个办法对游戏画面、画布和没有无障碍信息的自绘界面很有用，但坐标本身没有语义。`(820, 460)` 不知道自己指向“保存”还是“删除”。

agent-desktop 走的是另一条路：

- macOS 读取 Accessibility API；
- Windows 使用 UI Automation；
- Linux 通过 AT-SPI 读取桌面会话里的无障碍树。

操作系统返回的不是一张图，而是一棵包含 `role`、`name`、`value`、状态和可用动作的结构树。例如，一个文件列表项可以带有 `treeitem` 角色、“Documents”名称和 `Click` 动作。上层 Agent 不必先猜像素，而是先拿到类似下面的精简结果：

```json
{
  "snapshot_id": "s8f3k2p9",
  "tree": {
    "role": "treeitem",
    "name": "Documents",
    "ref_id": "@s8f3k2p9:e8",
    "available_actions": ["Click"]
  }
}
```

可以把它理解成仓库取件码：`e8` 只是当前快照里的第八个可操作元素，前面的 `s8f3k2p9` 才说明它来自哪一次盘点。脱离快照只写 `@e8`，工具会拒绝；界面发生变化后，也不能假定新快照里的第八项还是原来的按钮。

## 快照引用不是永不过期的选择器

“引用”听起来比坐标稳定，但 agent-desktop 并没有承诺引用永远有效。源码中的 RefMap 会记录进程、进程实例、角色、名称、值、描述、原生标识、边界和可用动作等身份线索。执行 `click @s8f3k2p9:e8` 时，工具先加载对应快照，再回到当前桌面严格解析一次，确认活元素仍与旧记录相符。

结果可能是三类：

1. 只找到一个可信匹配，继续检查元素是否可操作，再执行动作；
2. 找不到原元素，返回 `STALE_REF`，要求重新截图；
3. 多个元素都像原目标，返回 `AMBIGUOUS_TARGET`，要求用窗口、角色或名称缩小范围。

这比“坐标还在屏幕范围内就点击”更保守。它也不是万能的：如果应用没有暴露足够的无障碍属性，两个同名同角色控件又没有可区分的原生标识或几何关系，工具宁可报歧义，也不会声称已经认出目标。

## 真正关键的是：失败后能不能再点一次

桌面自动化最危险的错误往往不是第一次失败，而是盲目重试。假设 Agent 点击“提交付款”后连接超时：如果动作其实已送达，再点一次可能产生重复订单。

agent-desktop 的 JSON 结果把动作状态拆成两个字段：

- `delivery`：没有送达、结果不确定、已送达但未验证、已送达且已验证；
- `retry`：安全、不安全或未知。

源码里的对应关系很直接：只有 `not_delivered` 会被标为可以安全重试；`delivery_uncertain`、`delivered_unverified` 和 `delivered_verified` 都不能直接再做一次。对于输入、勾选、展开这类有状态动作，工具还会尝试重新读取状态；如果读到的结果与目标矛盾，会返回 `ACTION_FAILED`，而不是把“系统调用没有报错”当成任务成功。

这套设计并不能替你判断付款、删除、发送消息是否需要人工确认，但它给编排器提供了一个必要事实：**上一动作有没有可能已经发生。**

## 先用自检脚本判断机器是否真的可用

1.0.2 可以从 npm 安装，包内包含 macOS、Windows、Linux 的 x64 与 ARM64 原生程序。下面的脚本只做只读检查：确认实际运行的版本和平台，再检查当前会话能否访问桌面无障碍服务。

```bash
npm install -g agent-desktop@1.0.2

cat > verify-agent-desktop.mjs <<'JS'
import { spawnSync } from "node:child_process";

const bin = process.env.AGENT_DESKTOP_BIN ?? "agent-desktop";

function run(args) {
  const result = spawnSync(bin, args, { encoding: "utf8" });
  const line = result.stdout.trim();
  if (!line) throw new Error(`${args[0]} produced no JSON`);
  return JSON.parse(line);
}

const version = run(["version"]);
if (!version.ok) throw new Error(JSON.stringify(version.error));
console.log(`version=${version.data.version} ${version.data.os}/${version.data.target}`);

const status = run(["status"]);
if (status.ok) {
  console.log("desktop accessibility is ready");
} else {
  console.log(`desktop accessibility is not ready: ${status.error.code}`);
  console.log(status.error.platform_detail ?? status.error.message);
}
JS

node verify-agent-desktop.mjs
```

我在 Linux x86_64 环境实际安装并运行了这段检查，CLI 正确报告 `1.0.2 linux/x86_64`；npm 选中的原生程序及 Linux 剪贴板辅助程序也都通过了包内 SHA-256 一致性检查。当前测试容器没有可访问的图形桌面会话，`status` 明确报告无法连接会话总线，因此没有继续伪装成完成了真实点击。

这也是 Linux 上最容易忽略的边界：工具必须运行在目标用户的图形会话中。只有 SSH 终端、容器或另一个用户的会话，即使能执行二进制，也看不到目标桌面。官方当前以 Ubuntu 24.04、GNOME 46 为主要测量环境，并要求 glibc 2.35 以上。

## 真正操作时，循环应该长这样

下面是需要在有图形桌面的本机运行的**示意命令**，本次没有在无桌面容器中执行：

```bash
# 1. 先读与当前二进制匹配的平台说明
agent-desktop skills get platform

# 2. 观察，只保留可交互元素
agent-desktop snapshot --app Calculator -i --compact

# 3. 使用上一步返回的完整引用，不要手写 @e8
agent-desktop click '@s8f3k2p9:e8'

# 4. 再观察，验证界面是否真的变化
agent-desktop snapshot --app Calculator -i --compact
```

真实程序不能照抄示例里的快照 ID。每次都应从最新 JSON 取 `ref_id`，并根据 `ok`、`error.code` 和 `disposition.retry` 决定下一步。看到 `STALE_REF` 就重新观察；看到“不安全重试”则先读取当前状态，不能换一种点击方式再赌一次。

## 无头操作，不等于没有权限与隐私风险

agent-desktop 的引用动作默认走语义无障碍接口，不移动物理鼠标，也不主动抢焦点。需要双击、拖拽、悬停或某些键盘路径时，才显式使用 `--headed`。如果一个动作没有安全的语义路径，默认策略是失败关闭，而不是偷偷降级成坐标点击。

但“无头”只描述输入方式，不代表安全隔离：

- macOS 仍需给启动它的终端或宿主应用开启 Accessibility 权限；
- Windows 不能跨越更高完整性级别控制管理员应用；
- Linux 必须接入正确用户的 AT-SPI 与显示会话；
- 快照、剪贴板、截图、窗口标题、命令输出和调试轨迹都可能包含私密内容。

项目还提供可选的 JEV helper，用模型补充屏幕描述。它与原生 CLI 分开，原生树读取并不需要远程模型；一旦启用 JEV，目标描述与屏幕信息会发送给配置的模型提供方。官方特别提醒，即使关闭值字段，标签、标题、祖先路径和任务目标仍可能泄露文本。因此，能在本地无障碍树完成的流程，不应为了“更智能”默认开启视觉外传。

## 哪些场景适合，哪些场景不适合

它适合结构化桌面软件：表单、文件管理器、设置窗口、原生菜单、常规 Electron 应用，以及需要把动作结果交给另一个 Agent 编排的自动化。CLI 每次输出一个 JSON 信封，C 接口则适合把同一能力嵌入长期运行的宿主进程。

它不适合只暴露像素的界面，例如游戏、远程桌面视频流、部分 3D 画布和自绘控件。无障碍树不完整时，截图视觉仍然有价值；更稳妥的组合通常是“结构化树负责能识别的控件，视觉只处理树看不到的区域”，而不是在两种方式之间做非此即彼的选择。

此外，网页通常有更丰富的 DOM 与浏览器自动化接口，优先使用浏览器专用工具更容易获得链接、表单和网络状态。agent-desktop 的优势在于跨出浏览器，操作那些没有 API、也没有 DOM 的本地应用。

## 值得关注的不是命令数量，而是失败协议

agent-desktop 1.0 的价值不在于“AI 又会点鼠标了”。真正有用的是它把一次桌面动作拆成可审计的阶段：先观察并分配快照引用，执行前重新确认身份，动作后验证状态，再明确告诉上层能不能重试。

这还不是生产可靠性的证明。项目缺少独立任务基准，平台无障碍实现本身也有大量边角差异。但如果你正在构建需要操作本地软件的 Agent，这套协议提供了一条比“模型看截图后直接报坐标”更可控的起点。最先应该测试的也不是演示里的成功路径，而是弹窗覆盖、窗口重建、同名控件、动作超时和敏感数据外传这些失败路径。

## 原始资料

- [agent-desktop v1.0.2 发布记录](https://github.com/vercel-labs/agent-desktop/releases/tag/v1.0.2)
- [固定版本源码与 README](https://github.com/vercel-labs/agent-desktop/tree/v1.0.2)
- [CHANGELOG：1.0.0—1.0.2 的时间与变化](https://github.com/vercel-labs/agent-desktop/blob/v1.0.2/CHANGELOG.md)
- [快照引用解析源码](https://github.com/vercel-labs/agent-desktop/blob/v1.0.2/crates/core/src/refs/ref_token.rs)
- [动作送达与重试语义源码](https://github.com/vercel-labs/agent-desktop/blob/v1.0.2/crates/core/src/actions/delivery_semantics.rs)
- [安装、平台和权限说明](https://github.com/vercel-labs/agent-desktop/blob/v1.0.2/docs/install.md)
- [JSON 错误与重试协议](https://github.com/vercel-labs/agent-desktop/blob/v1.0.2/docs/json-output.md)
- [隐私与 JEV 边界](https://github.com/vercel-labs/agent-desktop/blob/v1.0.2/docs/faq.md#what-data-can-contain-private-information)
