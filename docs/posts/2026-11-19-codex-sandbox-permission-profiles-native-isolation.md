---
title: 'Codex 沙箱：Agent 能执行命令，为什么不等于拿走整台电脑'
date: 2026-11-19
slug: 'codex-sandbox-permission-profiles-native-isolation'
author: 范伟彬
description: 'OpenAI 公开了 Codex 沙箱的权限配置、网络代理以及 macOS、Linux、Windows 三套强制机制。本文解释它如何在保留本机开发环境的同时限制 Agent、怎样测试权限配置，以及它仍挡不住哪些风险。'
source: 'https://openai.com/index/inside-the-codex-sandbox/'
categories:
  - AI
  - 技术
  - 安全
tags:
  - Codex
  - AI Agent
  - Sandbox
  - Bubblewrap
  - Seccomp
---

# Codex 沙箱：Agent 能执行命令，为什么不等于拿走整台电脑

让编码 Agent 自动改文件、装依赖和运行测试，真正危险的并不是它偶尔写错一行代码，而是它执行的命令与普通终端命令拥有同样权限：能读到用户目录里的密钥，能改 Git Hook，也可能把文件传到网络上。

OpenAI 在 11 月 18 日公开了 Codex 沙箱的设计与三平台实现。它没有把每个任务都搬进虚拟机或 Docker，而是继续使用开发者现有的编译器、SDK 和项目环境，再借助操作系统原生能力限制命令能读什么、写什么、连接哪里。

这更像给装修工一张分区门禁卡：他可以进入施工房间、使用楼里的水电，却不能改门禁系统，也不能随意进入档案室。Agent 仍在你的电脑上工作，但它启动的进程树被套进一组明确的文件和网络边界。

这套设计值得关注，不是因为“Codex 也有沙箱”，而是因为权限已经被做成可配置、可测试、能单独复用的工程接口。自建 Agent、MCP 服务或本地自动化工具，也可以直接用 `codex sandbox` 包住不完全可信的命令。

## 默认边界究竟保护了什么

以 Git 仓库作为工作区时，内置的 `:workspace` 权限配置大致做三件事：

1. 允许在工作区写文件，但把 `.git`、`.codex` 等元数据目录保持为只读；
2. 允许读取工作区之外、当前用户本来就能读取的文件；
3. 默认关闭网络访问。

第一条让 Agent 可以正常编辑代码，却不能直接改 Git Hook 或自己的配置。第三条则阻止命令把读到的内容直接上传，也会让下载依赖、访问文档等正常操作失败，遇到这些任务需要额外授权。

最容易被忽略的是第二条：**工作区可写不等于工作区外不可读**。编译器、包管理器和 SDK 经常依赖仓库之外的文件，完全收紧读取范围会破坏大量开发流程，因此默认配置选择了兼容性。但这也意味着用户目录中的某些配置和密钥仍可能被命令读到。

所以沙箱的安全目标不是“命令什么都看不见”，而是把最常见、后果最大的写入和出网行为先拦住。若项目附近存在 `.env`、云凭据或客户数据，仍应在自定义配置里明确设为 `deny`。

## 权限不是提示词，而是进程约束

Agent 生成一条命令后，Codex Harness 不直接把它交给普通的进程启动接口，而是连同当前工作目录、环境变量和 Permission Profile 一起交给沙箱层。沙箱层启动子进程，并让其后代继承相同限制。

这一区别很关键。提示词里的“不要读取密钥”只是在要求模型自律；操作系统拒绝 `open`、`connect` 或写文件，才是在命令已经偏离预期后仍然生效的边界。

命令可以申请临时增加权限，甚至请求在沙箱外执行，但是否批准由 Harness 根据用户设置、交互确认或自动审查决定。也就是说，模型负责提出请求，不能自己宣布“这次例外”。

可以把执行链理解为：

```text
模型生成工具调用
    ↓
Harness 读取 Permission Profile
    ↓
用户或自动审查决定是否扩权
    ↓
操作系统沙箱启动整棵进程树
    ↓
文件系统规则 + 网络代理共同执行限制
```

## 为什么网络白名单不能只靠代理环境变量

很多程序会识别 `HTTP_PROXY`、`HTTPS_PROXY` 和 `ALL_PROXY`，但恶意程序完全可以忽略它们，直接创建 Socket。因此 Codex 的受限网络不是简单地“设置一个代理地址”。

Harness 会在沙箱外启动共享的 HTTP 与 SOCKS5 代理，把代理地址写入通用及包管理器专用环境变量；操作系统沙箱同时阻止进程直接连接外部网络，只留下到代理的通道。代理再按域名规则判断放行、拒绝或请求批准。

域名判断发生在 DNS 解析之前。否则，即使最终拒绝 HTTP 请求，程序仍可能把敏感信息编码进域名，通过 DNS 查询泄露出去。这个顺序能减少一类 DNS 外带风险，但宽泛的通配符和允许访问任意 DNS 服务仍可能重新打开缺口。

## 同一份权限，三套不同的强制方式

Permission Profile 是统一的，真正落到系统上时却不是同一种技术。

### macOS：把规则翻译成 Seatbelt

macOS 使用内核强制的 Seatbelt。Codex 根据文件与网络配置生成 SBPL 策略，通过 `/usr/bin/sandbox-exec` 启动命令；基础策略从 `deny default` 开始，再逐项增加必要权限。

Seatbelt 的现实问题是 Apple 面向第三方的接口已经标记为弃用，SBPL 也缺少正式公开文档。不过 macOS 自身以及 Chromium 等软件仍在使用它。Codex 当前继续使用这条路径，但接入方不能把“系统仍提供”理解成稳定的长期公共 API 承诺。

### Linux：Bubblewrap 负责视图，seccomp 负责系统调用

Linux 组合使用 Bubblewrap 与 seccomp-bpf。Bubblewrap 创建新的挂载、网络等命名空间，用只读绑定、可写绑定和权限为 `000` 的临时挂载拼出沙箱看到的文件系统；随后内部辅助进程加载 seccomp 过滤器，再执行目标命令。

两者分工不同：Bubblewrap 决定“这个路径看起来是什么”，seccomp 决定“这个系统调用能不能做”。网络受限时，`connect(2)`、`bind(2)` 等调用会按配置被过滤；需要代理时，命令只看得到自己网络命名空间里的本地监听端口，沙箱外的桥接进程再把流量转交给代理。

Linux 还有一个值得记住的边界：Glob 形式的拒绝规则会在命令启动前展开为具体路径。命令运行期间新创建、后来才匹配该 Glob 的文件，不会自动进入这次执行已经生成的拒绝列表。

### Windows：从持久 ACL 改向 MXC 原生隔离

Windows 端正在从旧实现迁移到 Microsoft eXecution Container（MXC）。旧方案需要管理员权限，设置和检查 ACL 成本较高，还会在宿主机留下沙箱用户、ACL、Firewall 规则等持久状态。

MXC 使用原生进程隔离，并接受包含命令、工作目录、文件和网络权限的 JSON 配置。Codex 禁用剪贴板、输入注入及桌面和系统设置控制，也禁止 MXC 退回到修改宿主机文件权限的方式。

路径冲突时采用更具体的规则，路径别名指向同一位置时则取更严格的权限：`deny` 高于只读，只读高于读写。这让工作区可以位于只读盘符之下，同时继续把工作区里的 `.git` 设为只读。

## 写一个更适合真实项目的权限配置

下面的配置从内置 `:workspace` 继承，额外允许写构建缓存，把编辑器配置设为只读，并禁止读取环境文件与 `secrets` 目录。网络只允许 OpenAI 域名和明确列出的本地地址，其余目标需要批准或被阻止。

```toml
default_permissions = "dev"

[permissions.dev]
description = "Development with extra read-only protections."
extends = ":workspace"

[permissions.dev.filesystem]
"~/build-cache" = "write"

[permissions.dev.filesystem.":workspace_roots"]
".devcontainer" = "read"
".vscode" = "read"
"**/*.env" = "deny"
"secrets" = "deny"

[permissions.dev.network]
enabled = true

[permissions.dev.network.domains]
"*.openai.com" = "allow"
"localhost" = "allow"
"127.0.0.1" = "allow"
"::1" = "allow"
"evil.example" = "deny"

[features]
network_proxy = true
```

先不要急着让 Agent 跑任务。可以用 Python 标准库确认 TOML 能被解析，关键权限也没有因拼写错误落到别的位置：

```python
import tomllib
from pathlib import Path

config = tomllib.loads(Path("config.toml").read_text())
profile = config["permissions"]["dev"]

assert profile["extends"] == ":workspace"
assert profile["filesystem"][":workspace_roots"]["**/*.env"] == "deny"
assert profile["network"]["domains"]["*.openai.com"] == "allow"
assert profile["network"]["domains"]["evil.example"] == "deny"
assert config["features"]["network_proxy"] is True

print("permission profile: PASS")
```

我用 Python 3.11 实际运行了这段检查，输出为 `permission profile: PASS`。它只证明配置语法与预期键值正确，不能证明操作系统已经执行了隔离。

## 再用失败用例测试真正的边界

Codex CLI 0.170.0 已提供独立的 `codex sandbox` 命令。把配置放进 Codex 使用的 `config.toml` 后，可在一个测试仓库中执行：

```bash
mkdir -p sandbox-demo/{.git,.vscode,secrets}
printf 'demo-only\n' > sandbox-demo/secrets/token.txt
cd sandbox-demo

codex sandbox --permission-profile dev -- bash -c '
  touch allowed.txt
  touch .vscode/blocked.json
  cat secrets/token.txt
  curl -I https://evil.example
'
```

这不是“看命令是否成功”的快乐路径测试，而是故意触碰边界：工作区普通文件应能创建，`.vscode` 写入、`secrets` 读取和被拒绝域名访问应失败。这里提前创建 `.vscode` 与 `secrets/token.txt`，是为了让拒绝规则在测试启动时就命中；尤其在 Linux 上，Glob 拒绝规则会在命令启动前展开，本次执行期间新创建、后来才匹配该 Glob 的路径不会自动加入拒绝列表。

我实际安装并确认了 `@openai/codex@0.170.0` 的版本与上述命令入口，也执行了前面的 TOML 检查。当前验证环境本身位于受限容器内，动态测试在 Bubblewrap 创建网络命名空间时被外层策略拒绝，返回 `bwrap: loopback: Failed to create NETLINK_ROUTE socket: Operation not permitted`，因此没有把文件与网络拒绝结果写成已在该环境验证。

这个失败反而揭示了一项部署前提：Linux 上运行 Codex 沙箱需要宿主允许 Bubblewrap 使用相应的用户、挂载和网络命名空间。若外层容器或企业内核策略禁止这些能力，正确做法是调整可信执行环境或拒绝启动，而不是悄悄退回无沙箱执行。

## MCP Server 不会自动继承这层保护

Codex 无法推断每个 stdio MCP Server 需要哪些文件和网络，因此不会默认把启动 MCP Server 的命令套进同一沙箱。一个通过 `npx` 启动的 Server，可能仍以当前用户的完整权限读写和联网。

对于只需要维护一个本地 JSONL 文件的 Memory Server，可以先把固定版本包缓存下来，再把启动命令改成：

```toml
[permissions.memory-mcp.filesystem]
":root" = "read"
"~/.npm" = "write"
"~/mcp-data" = "write"

[permissions.memory-mcp.network]
enabled = false

[mcp_servers.memory]
command = "codex"
args = [
  "sandbox",
  "--permission-profile",
  "memory-mcp",
  "--",
  "npx",
  "--offline",
  "@modelcontextprotocol/server-memory@1.0.0"
]

[mcp_servers.memory.env]
MEMORY_FILE_PATH = "~/mcp-data/memory.jsonl"
```

这里先离线缓存依赖很重要。否则一边关闭网络，一边要求 `npx` 临时下载包，启动一定失败。固定包版本也能减少每次运行时重新解析供应链的变化。

## 沙箱仍然挡不住什么

原生沙箱比一句“请小心操作”可靠得多，但它不是虚拟机，也不是安全证明。

- **宽读取仍可能暴露秘密**：默认配置为了兼容工具链保留了工作区外读取能力；敏感路径必须主动拒绝，长期凭据更适合留在沙箱外的代理或密钥管理系统。
- **可写依赖可能成为跳板**：Agent 若修改被 Git 忽略的 `node_modules/prettier`，编辑器随后在沙箱外运行它，恶意代码仍可能越过原来的执行边界。
- **宿主内核仍是共同边界**：原生进程隔离没有提供虚拟机级别的独立内核；处理多租户或真正敌对代码时，仍应叠加容器、MicroVM 或独立主机。
- **白名单过宽会削弱代理**：允许任意子域、DNS 或本地服务，可能给数据外带留下通道。
- **批准流程可能成为薄弱点**：频繁弹窗会训练人机械点击“允许”；扩权请求应解释具体路径、域名和持续时间，而不是只显示一条模糊的“需要更多权限”。

与把工作负载迁入独立 Agent Runtime 的方案相比，Codex 沙箱优先保留本机开发体验。它适合需要 Xcode、Android SDK、企业内部工具或复杂本地缓存的单用户开发环境；面对不受信任租户、公开上传代码或高价值生产凭据时，应把它视为虚拟机或容器内部的第二道防线，而不是替代外层隔离。

真正值得借鉴的原则很简单：**模型输出是建议，权限配置才是能力**。让 Agent 可以请求操作，但把最终能访问的文件、网络和系统资源交给独立、可测试的执行层决定。这样即使模型判断失误，后果也不必等同于当前用户能做的一切。

## 原始资料

- [OpenAI：Inside the Codex sandbox](https://openai.com/index/inside-the-codex-sandbox/)
- [Codex 0.170.0 发布记录](https://github.com/openai/codex/releases/tag/rust-v0.170.0)
- [本文核对的 Codex 固定源码提交](https://github.com/openai/codex/tree/29eb79e9866b3262a777fdf8195c1b9e63684c91)
- [Linux 沙箱实现说明](https://github.com/openai/codex/blob/29eb79e9866b3262a777fdf8195c1b9e63684c91/codex-rs/linux-sandbox/README.md)
- [macOS Seatbelt 策略生成源码](https://github.com/openai/codex/blob/29eb79e9866b3262a777fdf8195c1b9e63684c91/codex-rs/sandboxing/src/seatbelt.rs)
- [Windows 权限配置翻译源码](https://github.com/openai/codex/blob/29eb79e9866b3262a777fdf8195c1b9e63684c91/codex-rs/sandboxing/src/windows.rs)
- [OpenAI：自托管沙箱的凭据与环境边界](https://developers.openai.com/api/docs/guides/agents-api/environments/security)
