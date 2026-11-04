---
title: 'Agent Autoloop：让命令行 Agent 后台接活，关键为什么不是定时器'
date: 2026-11-05
slug: 'agent-autoloop-event-sourcing-human-loop'
author: 范伟彬
description: 'Agent Autoloop 用事件、规则、回执和人工卡片把命令行 Agent 变成可暂停、可恢复的后台任务。本文拆解事件溯源、指令与数据分离、跳数熔断，以及这个快速升温项目当前仍需谨慎的边界。'
source: 'https://github.com/KKKKhazix/agent-autoloop'
categories:
  - AI
  - 技术
  - 开源
tags:
  - Agent Autoloop
  - AI Agent
  - 事件溯源
  - Human-in-the-loop
  - 自动化
---

# Agent Autoloop：让命令行 Agent 后台接活，关键为什么不是定时器

[Agent Autoloop](https://github.com/KKKKhazix/agent-autoloop) 是一个刚公开的本地 Agent 自动化中台：它接收定时任务、GitHub Issue 或业务事件，按本机规则启动 Codex、Claude Code 等命令行 Agent；Agent 能自己处理就完成，需要人判断时则退出进程、发出卡片，等回答到来后再接着原会话继续。

它值得现在关注，不只是因为热度。GitHub API 显示仓库创建于 **2026 年 11 月 3 日**；我在 11 月 5 日检查时看到约 **2,391 Star、479 Fork**。这些数字只能证明开发者正在集中关注，不能证明生产采用或可靠性。更重要的是，仓库已经把“后台 Agent 怎样暂停、恢复、去重和限制循环”落实为协议、源码和测试，而不是只给一张架构图。

它也仍是非常早期的项目：目前没有版本标签，安装脚本会克隆或快进更新 `main`；只支持 macOS、Linux 和 Node.js 24，Windows 版本仍在开发。适合研究和小范围试用，还不适合因为 Star 涨得快就直接接管重要生产流程。

## Cron 能启动 Agent，却跟不完一件事

把一条命令塞进 cron，只解决了“几点启动”。真实任务还会遇到另一组问题：

- Agent 中途需要人决定是否删数据、花钱或对外发消息；
- 人可能几小时后才回答，不能让模型进程一直占着资源；
- 回答到来后，要知道它属于哪件事，并尽量接回原会话；
- 网络超时后，不能把已经执行过的操作重复做一遍；
- 一个 Agent 产生的新事件又触发另一个 Agent 时，循环不能无限扩散；
- 外部 Issue、告警和反馈包含不可信文字，不能让它们顺手改掉 Agent、目录和权限。

Agent Autoloop 处理的是这段“启动之后”的生命周期。可以把 cron 想成闹钟：到点会响，但不知道你起床后做了什么。Autoloop 更像一张流转单，记录谁接了活、这一轮做到哪里、问了什么、回答是什么，以及下一轮为什么又被唤醒。

## 一件事如何转完：事件、轮次、回执、卡片

系统把工作拆成四个关键对象。

### 1. 事件只描述发生了什么

来源把新 Issue、告警或定时到点转换成标准事件。相同来源和相同事件 ID 只记一次，因此来源可以安全重试。

事件不能指定用哪个 Agent、进入哪个目录或拿什么权限。这些控制项只来自本机 `rules.json`。外部标题和正文也不会直接拼进系统提示词，而是写入标明“这是资料”的上下文文件。

这种分离类似参数化 SQL：用户输入可以作为数据参与处理，却不能顺手改写 SQL 结构。它降低了提示注入直接改变调度策略的机会，但没有消灭提示注入——Agent 最终仍会阅读资料文件，所以权限和沙箱仍然重要。

### 2. 一轮只运行一次 Agent 进程

接单程序领取一批事件，启动相应 CLI Agent，把 Agent 的最后一条回复解析成结构化结果，然后结束这一轮。普通完成只需一句结论；如果需要中台继续做事，回复末尾附加一个 `agent-autoloop` JSON 回执。

回执可以包含：

- `ask`：向人提问；
- `notice`：只通知、不等待选择；
- `later`：约定未来复查；
- `resolve`：关闭已经核实解决的卡片；
- `events`：产生规则允许的新事件。

回执解析失败时，中台只要求 Agent 重写最后一条消息，不重跑已经做过的业务。这比“整段任务失败后从头再来”更适合有副作用的操作。

### 3. 等人时不保留 Agent 进程

Agent 提出问题后，这一轮已经结束。问题作为卡片保存到 SQLite，并通过桌面通知、飞书或 Webhook 发送。用户回答后，答案本身又成为事件，触发下一轮；中台会带上之前留下的 `session`，让适配器尝试恢复原会话。

这里的“恢复”是尽力而为，不是分布式事务保证。原 CLI 不支持恢复、会话已失效或换了 Agent 时，系统会开新会话。因此真正必须延续的事实仍应写入任务状态或文件，不能只存在模型上下文里。

### 4. 一个事务同时落事实和当前状态

内核采用事件溯源：事实日志只追加，当前任务、卡片和定时器是从日志计算出的投影。一次决策产生的事实与投影在同一个 SQLite WAL 事务中提交，提交后才应答；响应丢失时，同一个领取编号或回执可以重放，而不会再次计费或重复生效。

这并不等于“永不丢数据”。官方测试覆盖进程强杀与投影重建，但没有证明整机断电、磁盘损坏或所有文件系统环境都安全。备份也必须同时保存数据库和 `master.key`，只备份数据库并不能恢复卡片与轮次令牌。

## 四个机制为什么比“多跑几次”更重要

### 挂起零消耗

等待人的状态存储在数据库中，而不是靠一个长时间睡眠的 Agent 进程。回答几天后到来，也只在到来时重新启动一轮。这解决的是等待成本，不代表模型调用本身免费；真正执行时仍消耗各 CLI 或 API 的额度。

### 幂等与可追溯

来源事件有稳定 ID，领取工作有 claim 编号，回执由轮次 token 限定并可重放。`agent-autoloop why <编号>` 可以回看某轮由什么事件、规则和回答触发。对于“到底为什么又跑了一次”这类自动化事故，这比散落在 cron 日志里的几行输出更容易审计。

### 指令与数据分离

规则决定 Agent、目录、Skill、权限和允许产生的事件；外部事件只能提供经过校验的类型、对象和链接，正文放在资料文件中。这个设计把外部输入能改变的范围缩小了，但专用适配器与通用命令适配器的边界不同：`command` 只是启动任意程序，并不会替那个程序实施文件或网络权限。

### 跳数熔断

Agent 产生的新事件会增加 `hops`，人工回答和定时复查也不清零。超过 8 层后，事件仍被记录，但不再派活，并通知用户。它像网络包的 TTL，防的是两个自动流程互相唤醒，最后形成“Agent A 叫 B、B 又叫 A”的无限循环。

## 实际复现：核心机制通过，完整闭环仍有环境差异

我固定到检查时的提交 `8f8e2eef3cfaa8f7a418818adc442450fe6bd884`，在 Linux x86-64、Node.js 24.22.1 上运行：

```bash
git clone https://github.com/KKKKhazix/agent-autoloop.git
cd agent-autoloop
git checkout 8f8e2eef3cfaa8f7a418818adc442450fe6bd884

npm ci
npm run typecheck
node --disable-warning=ExperimentalWarning --test \
  tests/kernel.test.ts \
  tests/contract.test.ts \
  tests/hops.test.ts \
  tests/crash-smoke.test.ts
npm run test:sim
```

类型检查通过；核心契约、确定性决策、回执重放、跳数熔断和真实进程崩溃恢复共 **30 项测试全部通过**。固定种子 `24301` 的 2 万步模拟也完成，期间注入了 2,322 次响应丢失、1,586 次重复、1,615 次重启、1,709 次离线、1,683 次通道故障和 1,695 次时钟变化。

但完整 `npm test` 在当前受限执行环境中没有干净通过：插件教程端到端流程等待轮次完成超时，`try` 试跑出现“没留下结果”，一机闭环用例也没有得到预期的“已经在跑”输出；部分失败还留下了未退出的子进程，需要手动停止测试。相同提交的 GitHub Actions 在 Ubuntu 与 macOS 上均成功，因此这组现象更像运行环境、并发或进程管理差异，而不是足以定位的单一内核错误。不过在原因查清前，不能把它写成“任意 Linux 环境开箱即用”。

这也是试用时更合理的顺序：先固定提交，运行 `typecheck`、核心测试与模拟，再在隔离目录接一个无副作用任务；最后才连接真实通知、代码仓库和有写权限的 Agent。

## 什么场景适合，什么场景不适合

它适合：

- 已经在本机使用 Codex、Claude Code 等 CLI，希望把低风险任务放到后台；
- 任务会在“自动处理—需要决定—继续处理”之间切换；
- 希望保留事件、回答和每轮结果，便于追踪为什么执行；
- 能接受用 JSON 配置、命令行查看状态，而不是依赖可视化编排界面；
- 愿意先用只读或有限编辑权限，从日报、巡检和 Issue 初步处理开始。

它不适合直接替代通用工作流平台。n8n、Temporal 或 CI 系统擅长显式步骤、补偿逻辑、跨服务编排和成熟运维；Autoloop 的专长更窄，是把“事件交给一个命令行 Agent，收一份结构化回执，需要时找人决定”做成耐久循环。

如果流程要求强一致资金操作、跨组织审批、严格服务等级或多租户隔离，单机 SQLite、本地账号和“尽量恢复模型会话”都不够。此时可以把 Autoloop 放在低风险建议层，而不是最终执行层。

## 上手前必须知道的边界

1. **项目太新。** 观察时仓库公开不足两天，没有版本标签；热度不是稳定性证明。
2. **安装默认追随 `main`。** `install.sh` 对已有安装执行 `git pull --ff-only`。重要环境应固定审核过的提交，不要自动吃进当天所有变化。
3. **插件就是受信任代码。** `agent-autoloop add` 只负责克隆，但插件随后被加载时会执行。第三方插件必须像普通依赖一样审查。
4. **“资料不进提示词”不是沙箱。** Agent 仍会读取不可信资料；通用命令适配器也不会替进程限制权限。密钥隔离要靠独立系统账号、容器或 Agent 自身沙箱。
5. **卡片链接属于持有即授权。** 链接七天有效，不能发到公开频道；Webhooks 还没有外部幂等保证，发送成功但回执丢失可能造成重复通知。
6. **平台覆盖有限。** 当前要求 Node.js 24，仅支持 macOS 和 Linux；官方明确写着 Windows 尚未完成真机测试。
7. **真实集成验证不完整。** Claude Code、Codex、ACP 和飞书做过较深验证，但多种 Webhook 只连接过本地模拟服务，不能把模板存在等同于生产通道已经验证。

Agent Autoloop 最值得借鉴的不是“让 Agent 全天候工作”这句口号，而是承认 Agent 会等待、失败、重复、被外部文字误导，也会把事件继续传给另一个 Agent。它用事件、轮次、回执和人工卡片把这些不确定性显式化。对于想把命令行 Agent 从一次性对话变成后台协作者的人，这套机制比再加一个 cron 更重要；但对一个刚公开、没有稳定版本、完整本地闭环仍出现差异的项目，正确动作是隔离试用和持续观察，而不是立即托管关键业务。

## 原始资料

- [Agent Autoloop 官方仓库](https://github.com/KKKKhazix/agent-autoloop)
- [本文复现使用的固定提交](https://github.com/KKKKhazix/agent-autoloop/tree/8f8e2eef3cfaa8f7a418818adc442450fe6bd884)
- [协议：事件、轮次、回执与卡片](https://github.com/KKKKhazix/agent-autoloop/blob/8f8e2eef3cfaa8f7a418818adc442450fe6bd884/docs/protocol.md)
- [安全边界说明](https://github.com/KKKKhazix/agent-autoloop/blob/8f8e2eef3cfaa8f7a418818adc442450fe6bd884/SECURITY.md)
- [内核决策与跳数熔断](https://github.com/KKKKhazix/agent-autoloop/blob/8f8e2eef3cfaa8f7a418818adc442450fe6bd884/kernel/decide.ts)
- [事实日志与投影更新](https://github.com/KKKKhazix/agent-autoloop/blob/8f8e2eef3cfaa8f7a418818adc442450fe6bd884/kernel/evolve.ts)
- [安装脚本与更新方式](https://github.com/KKKKhazix/agent-autoloop/blob/8f8e2eef3cfaa8f7a418818adc442450fe6bd884/install.sh)
- [固定提交的 Ubuntu/macOS CI](https://github.com/KKKKhazix/agent-autoloop/actions/runs/41848894487)
