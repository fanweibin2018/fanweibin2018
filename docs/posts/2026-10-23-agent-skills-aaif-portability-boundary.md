---
title: 'Agent Skills 进入 AAIF：一个 SKILL.md 文件夹，离“一次编写、到处运行”还有多远'
date: 2026-10-23
slug: 'agent-skills-aaif-portability-boundary'
author: 范伟彬
description: 'Anthropic 于 2026 年 10 月 22 日把 Agent Skills 标准捐给 Linux 基金会旗下 AAIF。本文拆解 Skill 的渐进加载机制，实测官方参考验证器，并说明中立治理改变了什么、格式兼容为何不等于工具权限、依赖、分发和执行结果都兼容。'
categories:
  - AI
  - 技术
  - 开源生态
tags:
  - Agent Skills
  - AAIF
  - Anthropic
  - AI Agent
  - SKILL.md
---

2026 年 10 月 22 日，Anthropic 把 Agent Skills 的名称、Logo、GitHub 组织和 `agentskills.io` 域名捐给了 Linux 基金会旗下的 Agentic AI Foundation（AAIF）。这不是一次新模型发布，也没有突然让所有 Agent 拥有相同能力；它真正改变的是标准今后由谁治理。

对开发者更实际的问题是：一个在 Claude Code 里能用的 `SKILL.md` 文件夹，搬到 Codex、Cursor 或其他 Agent 后，究竟有多少内容可以原样复用？答案是：**知识与流程的封装格式可以复用，但发现、权限、工具、依赖和执行环境仍由各客户端决定。** 这次捐赠为继续补齐这些边界提供了中立场所，却没有在一夜之间消除它们。

## 捐赠的是标准，不是一个已经完成的新版本

Anthropic 公告列出的移交范围很具体：Agent Skills 的品牌、GitHub 组织和域名进入 AAIF，来自 Anthropic、Google、OpenAI 等公司的工程师将以个人身份参与维护。Linux Foundation 同日宣布 Agent Skills、Open Responses、OpenEnv 和 OpenSandbox 四个项目加入 AAIF，使基金会托管项目从成立时的 3 个增加到 10 个。

值得注意的是，Anthropic 把“带版本的正式发布、提案流程和安全指南”写成了**拟议中的后续路线**，不是 10 月 22 日已经落地的能力。我在 10 月 23 日检查规范仓库时，默认分支仍停在 8 月 9 日的提交 `69ef37e`。因此，现有 Skill 作者现在不需要紧急迁移文件；当前变化首先发生在治理层，而不是文件格式或运行时 API。

Anthropic 还称，标准自 2025 年 12 月发布后已有 70 多个 Agent 平台接入。这能说明格式获得了广泛关注，但厂商统计并不能证明各客户端支持深度相同，更不能证明同一个 Skill 在不同模型和工具环境里会得到相同结果。

## Skill 的核心为什么只需要一个文件夹

最小的 Agent Skill 是一个与 Skill 同名的目录，其中只有 `SKILL.md`：

```text
good-skill/
└── SKILL.md
```

`SKILL.md` 前半段是 YAML 元数据，后半段是给 Agent 的 Markdown 指令。下面这份最小示例已经通过参考验证器：

```markdown
---
name: good-skill
description: 汇总构建失败日志，并在需要定位 CI 错误时使用。
compatibility: Requires git and read-only access to CI logs
---

# 工作流

1. 读取失败步骤。
2. 给出最小复现。
3. 修复后重新运行检查。
```

目录还可以带 `scripts/`、`references/` 和 `assets/`，分别放可执行代码、详细资料与模板。规范没有强制这些目录只能包含某种文件，具体支持哪些语言、脚本如何运行，仍取决于客户端。

这种设计的关键不是 Markdown，而是**渐进加载**：

1. Agent 启动时只读取每个 Skill 的 `name` 和 `description`，用很少的上下文形成目录；
2. 用户任务与描述匹配时，再加载完整的 `SKILL.md`；
3. 只有指令确实需要时，才读取引用资料或运行脚本。

可以把它理解成工具柜上的标签。Agent 平时只看“CI 故障排查”这张标签，不需要把整本排障手册背进上下文；真的遇到构建失败，才打开抽屉取出手册和脚本。官方客户端实现指南建议 Skill 正文控制在 5,000 token 以内，主文件少于 500 行，把细节拆进按需读取的资料。

## 固定提交跑一次参考验证器

我固定了规范仓库提交 `69ef37e9424c0a7ea9dd2293b559e43ec8176379`，在 Python 3.12.14 环境按锁文件安装 `skills-ref`，先运行它自己的测试：

```bash
uv sync --locked --project skills-ref
uv run --project skills-ref pytest -q
```

结果是 **40 项测试全部通过**。随后用命令行验证上面的示例：

```bash
uv run --project skills-ref skills-ref validate /tmp/good-skill
```

输出为：

```text
Valid skill: /tmp/good-skill
```

把目录和 `name` 改成 `Bad_Skill`，再加入规范未定义的顶层字段 `version`，验证器会以退出码 1 拒绝，并分别指出未知字段、名称必须小写、下划线不合法。它也可以把一个或多个 Skill 转成只含名称、描述和文件位置的 XML 目录，让模型先发现 Skill，随后再按位置读取正文。

不过，另一个反例更能说明边界：我创建了一份只有合法 frontmatter、**正文完全为空**的 `SKILL.md`，验证器仍然返回 `Valid skill`。这是符合它当前职责的——官方规范只说该命令检查 frontmatter 与命名约定，`skills-ref` 的 README 也明确标注它仅用于演示，不建议直接用于生产。

因此，“通过验证”只能证明包装格式合规，不能证明：

- 指令完整、不会互相矛盾；
- `scripts/` 里的代码安全或依赖可安装；
- Agent 会在正确时机激活 Skill；
- 工作流在不同模型上能稳定完成；
- 输出满足业务事实、权限与质量要求。

## 格式可移植，不等于行为可移植

Agent Skills 当前解决的是“如何打包流程知识”，没有统一整个运行时。几个差异尤其容易在迁移时踩坑。

### 1. Skill 从哪里来

本地 Agent 可以扫描文件系统；云端或沙箱 Agent 可能通过 API、远程目录或内置资源发现 Skill。官方客户端指南明确把这些当作不同实现路径。规范没有规定统一安装命令、全局目录或公共注册表，所以把文件夹复制过去之前，仍要先查目标客户端如何安装和更新。

### 2. 工具名称和权限不是同一套

frontmatter 的 `allowed-tools` 仍是实验字段，规范明确提示各实现的支持程度可能不同。一个 Skill 写着运行 Bash、访问浏览器或读取 CI 日志，不代表目标客户端恰好提供同名工具，也不代表它会授予相同权限。

真正可移植的写法应把环境要求写进 `compatibility`，并把高风险动作设计成显式确认：例如只读日志可以自动执行，推送代码、修改云资源或发送消息必须单独授权。Skill 不能把权限声明当成已经获得的权限。

### 3. 依赖、版本和分发尚未标准化

当前规范允许在自定义 `metadata` 中保存字符串，但没有定义通用的依赖解析、Skill 间组合、版本选择与升级协议。GitHub 上关于工具依赖、版本和分发发现的提案仍处于讨论中。

如果 Skill 带脚本，现阶段更稳妥的办法仍是：固定 Skill 的 Git 提交或发行版本，为 Python、Node 等依赖提供锁文件，在隔离环境安装，并在升级前重跑代表性任务。不要因为目录能被两个客户端读取，就假设它们会装出相同环境。

### 4. 验证器不是安全扫描器

参考验证器只解析 `SKILL.md` 元数据，不会审计脚本、网络请求、凭据读取和提示注入风险。Anthropic 把安全指南列入后续路线，也侧面说明这一层尚未由标准完整覆盖。

安装第三方 Skill 应当像安装代码包一样审查来源、许可和固定版本；脚本放进最小权限沙箱，默认禁止不必要的网络与密钥访问；外部网页、文档和命令输出都当作不可信数据。对于会产生写操作的流程，还要加上计划、验证、执行三段式门禁。

## 它和 MCP、AGENTS.md 各管哪一层

AAIF 现在同时托管 Agent Skills、MCP 和 AGENTS.md，但三者并不是同一个问题的三种写法：

| 项目 | 主要解决的问题 | 没有替你解决的事 |
| --- | --- | --- |
| Agent Skills | 如何把一套专业流程、资料和脚本打成可按需加载的包 | 工具服务如何连接、运行时如何授权 |
| MCP | Agent 如何以统一协议发现并调用外部工具与数据 | 某项业务应按什么步骤完成 |
| AGENTS.md | 在代码仓库内给 Agent 提供范围化的开发约束 | 通用 Skill 的分发与执行环境 |

一个真实项目可以同时使用三者：`AGENTS.md` 说明仓库约定，MCP 暴露 CI 和工单工具，Agent Skill 则规定“先读取哪份失败日志、如何缩小范围、修复后跑哪些验证”。它们互补，但任何一个都不能自动替代另外两个。

## 现在值得怎么做

对于已经维护 Skill 的团队，这次捐赠值得关注，但不需要等待一个“最终标准”再行动：

1. 保持 `SKILL.md` 入口短小，把触发条件写清楚，把大段参考资料拆开按需加载；
2. 用 `compatibility` 明说系统包、网络、工具和运行时要求，不把它们藏在正文深处；
3. 先用参考验证器检查结构，再补自己的语义测试、安全检查和真实任务回归；
4. 至少在两个目标客户端上验证激活时机、工具映射、权限提示和最终输出；
5. 固定来源与依赖版本，把升级当成代码变更审查，而不是随手替换一份 Markdown。

Agent Skills 进入 AAIF 的最大价值，不是给“到处运行”盖了一个认证章，而是把一个已经被多家产品采用的轻量格式放进了更适合共同治理的位置。短期内，它仍是一份很小的互操作契约：目录长什么样、入口写什么、内容何时加载。长期价值要看后续能否把版本、提案流程、安全与分发这些缺口变成可执行的公共规则。

## 原始资料

- [Anthropic：Donating Agent Skills to the Agentic AI Foundation](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation)
- [Linux Foundation：AAIF Announces Four New Projects](https://www.linuxfoundation.org/press/agentic-ai-foundation-announces-four-new-projects-agent-skills-open-responses-openenv-and-opensandbox)
- [Agent Skills 格式规范](https://agentskills.io/specification)
- [为客户端接入 Agent Skills 的实现指南](https://agentskills.io/client-implementation/adding-skills-support)
- [Agent Skills 规范仓库](https://github.com/agentskills/agentskills)
- [本次实测固定提交](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379)
- [`skills-ref` 参考验证器说明](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/README.md)
