---
title: 'GitHub Agentic Workflows：Markdown 如何变成可审计的 Agent 流水线'
date: 2026-10-29
slug: 'github-agentic-workflows-markdown-actions-safety'
author: 范伟彬
description: 'GitHub Agentic Workflows 已正式可用：用 Markdown 描述需要判断的仓库任务，再编译成标准 GitHub Actions。本文拆解编译、权限隔离、网络防火墙与 Safe Outputs，实测 v1.0.1 的最小工作流，并说明它适合什么、不适合什么。'
source: 'https://github.blog/changelog/2026-10-28-github-agentic-workflows-generally-available/'
categories:
  - AI
  - 技术
  - 开源
tags:
  - GitHub Agentic Workflows
  - GitHub Actions
  - AI Agent
  - DevOps
  - 供应链安全
---

# GitHub Agentic Workflows：Markdown 如何变成可审计的 Agent 流水线

GitHub 在 **2026 年 10 月 28 日**宣布 Agentic Workflows 正式可用。它允许开发者把“分析失败的 CI、给 Issue 分类、检查文档是否落后于代码”这类需要判断的任务写成 Markdown，再编译成标准 GitHub Actions 工作流，由 Copilot、Claude Code、Codex、Gemini 或 Pi 执行。

值得关注的不是“Actions 里也能调用大模型”——自己写脚本早就能做到——而是它试图给长期运行的 Agent 加上一套可审查的工程边界：配置在编译期校验，Agent 默认只读，网络出口受限，写操作交给另一个权限更小、更确定的作业执行。

这仍然不等于“把提示词放进仓库就安全了”。Agent 会读到不可信的 Issue、PR 和代码，模型会犯错，编译器和隔离层也可能有漏洞。真正有用的变化，是风险开始能像 CI 配置一样被版本化、审查和逐层限制。

## 它补的是 Actions 的哪块空白

普通 CI 擅长确定性任务：安装依赖、运行测试、检查格式、构建镜像。输入相同，脚本应当给出相同结果。Agentic Workflows 面向的是另一类任务：先阅读上下文，再决定重点和下一步。

例如“如果测试失败，找出最可能的根因并给出证据”很难写成一串固定的 `if`；但“运行测试并在失败时退出 1”就应该继续交给普通 Actions。官方 README 也明确把两者定位为互补关系，而不是让 Agent 替代构建、测试和部署。

一个实用的判断方法是：

| 任务 | 更合适的工具 | 原因 |
| --- | --- | --- |
| 单元测试、Lint、制品签名 | 普通 GitHub Actions | 步骤明确，结果应可重复 |
| 汇总一周 Issue 并归纳共同阻塞 | Agentic Workflows | 需要阅读、聚类和取舍 |
| 自动部署生产环境 | 普通 Actions + 审批门禁 | 高风险写操作不该依赖开放式判断 |
| 分析失败日志并起草修复 PR | Agentic Workflows + 人工审查 | 判断交给 Agent，合并权仍由人控制 |

## 一份 Markdown，为什么会变成两个文件

Agentic Workflow 的源文件放在 `.github/workflows/`，由两部分组成：YAML frontmatter 配置触发器、权限、工具、模型与允许的输出；Markdown 正文描述任务目标和边界。

下面是我用于本地验证的最小示例：

```markdown
---
on:
  workflow_dispatch:
permissions:
  contents: read
safe-outputs:
  create-issue: false
---

# README audit

Inspect `README.md` and the files it links to. Return a short report that lists
broken local links and claims that are not supported by files in the repository.
Do not modify repository content.
```

`gh aw compile` 不会直接执行这段提示词，而是把配置编译成同名的 `.lock.yml`。编译过程会解析和校验 frontmatter、构造作业依赖、固定 Actions 的提交 SHA，最后生成 GitHub Actions 能运行的 YAML。Markdown 正文仍是 Agent 在运行时读取的任务说明；改动触发器、权限或工具等 frontmatter 后，必须重新编译并提交锁文件。

可以把它理解成 TypeScript 与 JavaScript 的关系：人维护的是更容易读的源文件，平台执行的是编译产物。区别在于，这个产物不只翻译语法，还把安全检查、运行容器、工具网关、结果检测和写回步骤一起展开。

## 本地实测：十几行源文件展开成什么

我固定使用稳定版 **v1.0.1**，下载 Linux amd64 二进制后按 GitHub Release 提供的 SHA-256 校验。校验值为：

```text
746d0b41d5fb87e2c010b8ac23a464436bb745ff89fbd19a3456431942c37652
```

实际执行的关键命令如下。最后一项 SHA 是 [`github/gh-aw-actions` 的 v1.0.1 对应提交](https://github.com/github/gh-aw-actions/tree/221ba4f4319de6b8e809d1a15528b3ae6a818aa5)；我显式固定它，是为了让隔离测试不依赖会移动的标签。

```bash
curl -fL -o gh-aw \
  https://github.com/github/gh-aw/releases/download/v1.0.1/linux-amd64

printf '%s  %s\n' \
  '746d0b41d5fb87e2c010b8ac23a464436bb745ff89fbd19a3456431942c37652' \
  gh-aw | sha256sum -c -

chmod +x gh-aw
./gh-aw version

./gh-aw compile readme-audit \
  --no-check-update \
  --action-mode action \
  --action-tag 221ba4f4319de6b8e809d1a15528b3ae6a818aa5 \
  --stats
```

二进制校验通过，`./gh-aw version` 输出 `gh aw version v1.0.1`。最小源文件成功生成了 **136,522 字节**的 `readme-audit.lock.yml`；CLI 统计为 **5 个作业、120 个步骤、57 段脚本**。五个作业分别是 `activation`、`agent`、`detection`、`safe_outputs` 和 `conclusion`。

这个数字不代表日常工作流一定同样大，也不是性能指标。它说明一件更实际的事：十几行 Markdown 背后并非“把 API Key 交给一个 shell”，而是一套相当重的运行脚手架。生成文件应纳入代码审查，但不适合手工编辑；真正的修改入口仍是 `.md`，随后重新编译。

本次生成结果里，`agent` 作业只有 `contents: read`，Actions 与容器镜像也都固定到了提交 SHA 或镜像摘要。第一次用默认参数编译时，严格校验因为几个生成的 Action 引用未固定为 40 位提交 SHA 而报 `CTR-002`；显式传入上面的完整 action commit 后才通过。这不一定能复现于已经维护了 `.github/aw/actions-lock.json` 的正常仓库，但它给出了很具体的实践提醒：**看见“编译成功”之前，不要假设依赖已经不可变；应检查锁文件、提交 action pin 缓存，并让严格校验留在 CI 中。**

## 安全不是一个开关，而是四道边界

### 1. 编译期先拒绝危险或含糊的配置

编译器会做 schema 校验、GitHub 表达式检查和 Action SHA 固定，也可以接入 actionlint、zizmor、poutine 等扫描器。这样，权限过宽、引用可变或语法不合法的问题可以在工作流进入 Actions 前被发现。

不过，编译器只能验证它理解的配置。Markdown 指令是否合理、外部工具是否可信、Agent 最终判断是否正确，仍然需要测试和审查。

### 2. Agent 作业默认只读

官方设计把 Agent 与真正的写操作拆成不同作业。Agent 可以读取仓库内容、Issue 或 PR，生成结构化的“想做什么”；它本身不应直接拿到 `contents: write` 随意推送。

这像让分析员填写申请单，而不是把仓库管理员钥匙交给分析员。即使模型被 Issue 中的恶意文本诱导，攻击者还需要穿过后续结构验证和权限边界，才能影响外部状态。

### 3. 网络与工具也要列允许范围

Agent Workflow Firewall 默认把 Agent 放进容器网络，通过代理控制外连域名；MCP 工具则经网关在隔离容器中运行。工作流可以声明 Python、Node 等生态域名或具体 API 域名，而不是默认开放整个互联网。

域名白名单只能限制“能连哪里”，不能证明“发送的数据安全”。如果把公司内部上传接口加入白名单，Agent 仍可能向它发送不该发送的内容。工具参数、日志、制品和模型服务的数据处理条款都要单独审查。

### 4. Safe Outputs 把“建议”与“执行”分开

Agent 若要创建 Issue、评论或 PR，会先输出结构化请求。单独的 Safe Outputs 作业下载结果，做类型、数量、目标和内容检查，再用该操作所需的最小写权限调用 GitHub API。

这里有一个容易忽略的细节：官方架构文档明确说明，威胁检测的示意图只代表严格模式；默认的 warn 模式在检测出威胁或检测无法完成时，仍可能发布带标注、可供审查的输出。需要“检测失败就不写回”的仓库，应显式采用严格策略和受保护环境，不能把默认配置想象成绝对阻断。

## 版本升级为什么必须连锁文件一起做

`gh-aw` 实际有两层版本：本地 CLI，以及由它生成、提交进仓库的 `.lock.yml`。只升级 CLI，不会自动替换已经固定在旧锁文件里的 Action 和运行时组件。

这个区别不是理论问题。GitHub 在 2026 年 8 月披露过一个严重漏洞：0.83.3 至 0.85.3 生成的部分 Safe Outputs 作业，可能把带 CI 触发令牌的 Git 配置输出保存进制品；修复版本是 0.85.4。官方处置建议不仅是升级 CLI，还要求重新运行 `gh aw upgrade`、提交全部再生成的锁文件，并轮换可能暴露的长期令牌。

因此升级流程至少应包括：

1. 固定并审查新的 `gh-aw` 版本；
2. 重新生成 `.lock.yml` 与 action pin 缓存；
3. 查看锁文件中权限、镜像、Action 和密钥集合的变化；
4. 在非生产仓库或受保护环境验证；
5. 再合并到默认分支。

“主机上的 CLI 已经是最新版”不能证明仓库里运行的工作流已经修复。

## 哪些场景值得先试

Agentic Workflows 最适合**输入范围清楚、写回动作有限、结果容易复核**的任务，例如：

- 给新 Issue 建议标签，但每次最多处理一个目标；
- 汇总 CI 日志并创建诊断报告，不直接修改代码；
- 检查文档与近期合并的代码是否矛盾，起草一个待审 PR；
- 定期生成仓库健康报告，把结论发布到 Issue。

不适合一开始就交给它的任务包括：自动合并任意代码、修改发布凭据、直接部署生产环境、读取大量高度敏感数据，或者在缺少可判定验收标准时长期自主运行。越难判断“做对了没有”，就越不该同时授予自动写权限。

成本也不能忽略。GA 版本可用于 GitHub Free、Team 和 Enterprise，但默认 Copilot CLI 引擎需要 Copilot 许可；选择其他 Agent 还要配置各自的身份、计费和数据处理规则。官方公布的客户节省时间、提交占比和错误下降数字属于厂商案例，不能直接外推到其他团队。

## 与 Agent Skills、普通 Agent 有什么区别

Agent Skills 解决的是“如何把一套可复用的流程知识装进文件夹”；Agentic Workflows 解决的是“何时在 GitHub 事件中启动它、用什么权限运行、结果如何受控写回”。前者像操作手册，后者更像值班表、门禁和审计系统。

它也不是一个新的基础模型。最终质量仍取决于所选模型、上下文、工具和任务设计。换成更强的 Agent 可能改善判断，但不会自动修正过宽权限、开放网络或缺少审批的问题。

## 是否值得上手

如果团队已经把大量维护工作放在 GitHub Actions，却卡在“脚本能执行、但不会判断”，Agentic Workflows 值得从只读报告类任务开始试。它最大的价值不是自动化程度，而是把 Agent 的触发、权限、网络、写回和版本放进同一个可审查的仓库变更里。

但这套系统仍处于快速迭代期，v1.0.1 的一个最小锁文件已经展开到 130 多 KB，安全公告也证明生成器和运行时都可能出错。务实的采用方式是：固定版本、先只读、限制输出、严格检测、保留人工审批，并把升级后重新编译视为安全更新的一部分。

## 原始资料

- [GitHub：Agentic Workflows 正式可用](https://github.blog/changelog/2026-10-28-github-agentic-workflows-generally-available/)
- [GitHub Agentic Workflows 源码与 README](https://github.com/github/gh-aw)
- [v1.0.1 Release 与变更记录](https://github.com/github/gh-aw/releases/tag/v1.0.1)
- [工作流如何从 Markdown 编译为 Actions](https://github.github.com/gh-aw/reference/compilation-process/)
- [安全架构、权限隔离与默认检测模式说明](https://github.github.com/gh-aw/introduction/architecture/)
- [Safe Outputs 参考文档](https://github.github.com/gh-aw/reference/safe-outputs/)
- [版本、锁文件与 Action SHA 固定规则](https://github.github.com/gh-aw/reference/releases/)
- [GHSA-8h78-hpm7-29gg 安全公告](https://github.com/github/gh-aw/security/advisories/GHSA-8h78-hpm7-29gg)
