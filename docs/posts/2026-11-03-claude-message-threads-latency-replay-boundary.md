---
title: 'Claude Message Threads：请求变小了，为什么 Token 账单不会变'
date: 2026-11-03
slug: 'claude-message-threads-latency-replay-boundary'
author: 范伟彬
description: 'Anthropic 的 Message Threads 让长对话续轮只上传新增消息，但模型仍读取完整上下文。本文拆解 create/continue 协议、与 Prompt Caching 的区别、失效重放路径及数据保留边界，并复现官方 Python SDK 的关键请求行为。'
source: 'https://claude.com/resources/articles/message-threads'
categories:
  - AI
  - 技术
  - 开发
tags:
  - Claude API
  - Message Threads
  - AI Agent
  - Prompt Caching
  - 上下文工程
---

# Claude Message Threads：请求变小了，为什么 Token 账单不会变

Anthropic 在 **2026 年 11 月 2 日**把 Message Threads 作为 Claude Platform 的公开测试功能推出。它解决的是长任务里一个很具体的浪费：Agent 每调用一次模型，都要把之前的用户消息、模型回复、工具结果和图片重新上传一遍。对已经积累几十万 token 的编程 Agent 来说，模型开始输出之前，客户端和 API 还在反复传输、校验和处理同一批数据。

Message Threads 允许第一次请求发送完整对话，后续请求只带新增消息和上一次响应的 ID。Anthropic 称，在已默认使用该功能的大多数 Claude Code 用户中，50 万至 100 万 token 请求的首 token 时间中位数下降约 35%。这是厂商在特定流量上的统计，不是第三方基准；它也不代表推理速度或模型能力提高。

最容易误解的一点是：**上传内容变少，不等于模型看到的内容变少。** 服务端会在调用模型前还原完整对话，Claude 每一轮仍读取全部上下文，因此输入 token 用量、价格和现有速率限制不变。

## 像把卷宗暂放在窗口，而不是每次整箱搬来

传统无状态 Messages API 可以想成办事窗口不留材料。第一次交一箱卷宗，窗口处理后把它退还；补一页材料时，你仍要把整箱再次搬来。对话越长，搬运和清点越慢。

Message Threads 则让窗口短暂保管这箱卷宗。第一次请求加上：

```json
"thread": { "type": "create" }
```

服务端把本轮对话和 Claude 的回复关联到响应 ID。下一轮只提交新增消息，并声明从哪个响应继续：

```json
"thread": {
  "type": "continue",
  "previous_message_id": "msg_..."
}
```

服务端取回已有内容、接上新页，再把完整对话交给模型。省掉的是客户端到 API 的重复传输，以及 API 对旧内容的部分重复校验和 token 化工作；模型侧的完整上下文没有消失。

这也解释了它与 Prompt Caching 的分工。Message Threads 优化的是**请求怎么送到 API**；Prompt Caching 优化的是**相同提示内容如何在模型侧复用**。开启线程不会自动开启缓存。长 Agent 往往可以同时使用两者，但线程本身不会降低 token 计费。

## 协议不是一个永久会话，而是一条短命的追加链

Thread 的状态只在内存中短暂保留。官方文档给出的有效期是最后一次请求后 5 分钟，并承诺最迟在最后一次使用后 1 小时删除。它不是可以隔天恢复的会话数据库，也没有列出、读取或主动删除 Thread 的 API。

每个响应 ID 只能继续一次，而且必须从最新响应继续。于是它更像一条只能向前追加的链：

1. `create` 发送完整历史，得到响应 `A`；
2. 从 `A` 继续，发送本轮新增消息，得到响应 `B`；
3. 下一轮只能从 `B` 继续，不能再次使用 `A`；
4. 要修改旧消息、从中间分叉或压缩历史，必须用完整对话重新 `create`。

这种约束避免了服务端猜测客户端究竟想要哪条历史，但也意味着并发不能随意做。流式响应虽然会很早给出响应 ID，客户端仍要等到 `message_stop` 后才能继续；提前续接可能得到 404。

## 哪些字段可以变，哪些会让线程失配

第一次创建线程时要发送 `system` 和 `tools`，续轮必须把它们省略，连 `null` 也不能发送。模型、工具选择、thinking、输出格式和顶层缓存设置等固定字段则要在每轮保持一致；改变它们会返回 `thread_fingerprint_mismatch`。

`max_tokens`、停止序列、流式开关、metadata 和 service tier 等自由字段可以逐轮调整。这个分类很实用：它把“同一条会话链必须稳定的契约”与“本轮运行参数”分开了。若要换系统提示、工具或模型，正确做法不是硬改续轮请求，而是带着完整历史启动新线程。

## 真正的状态仍必须留在应用里

短期服务端状态很容易让人误以为可以少存一份对话。官方文档给出的要求正相反：应用仍是对话的事实来源，必须保存完整消息历史。

Thread 过期、前一响应未被保存、模型回退、所有权不一致，或存储的对话无法接收新内容时，续轮可能返回 `404 thread_not_found`。恢复路径是：

1. 从应用自己的记录取出完整历史；
2. 重新发送 `system`、`tools` 和所有消息；
3. 用 `thread: {"type": "create"}` 建立新链；
4. 从新响应 ID 继续。

官方 SDK 的 Thread helper 会在部分续轮错误后自动重放一次，但它保存的完整历史只存在于 helper 对象的内存中，不会替你持久化。进程重启、任务跨机器或需要审计时，仍要由应用保存消息和工具结果。

还有一个值得注意的失败窗口：任何 `create` 或 `continue` 响应都不会告诉客户端“这轮是否已成功存入 Thread”，只能在下一次继续时发现。对于流式中断，不能把“没有收到完整响应”简单等同于“服务端没有执行”。协议把重放设计成安全恢复路径，业务层仍要保证工具调用、支付、发送消息等外部副作用不会因重试而重复发生。

## 用官方 SDK 的模拟测试检查请求形状

Python SDK `v2.2.0` 已加入 Message Threads 支持。下面固定到官方发布提交 `f26777eaf2a756afeb904d9feed03b12190e551c`，运行四项不调用真实 Claude API 的本地模拟测试：

```bash
git clone https://github.com/anthropics/anthropic-sdk-python.git
cd anthropic-sdk-python
git checkout f26777eaf2a756afeb904d9feed03b12190e551c

uv run --frozen pytest -n 0 \
  tests/lib/threads/test_beta_threads.py::TestMessageThread::test_first_send_creates_a_thread_with_the_seed_and_the_new_messages \
  tests/lib/threads/test_beta_threads.py::TestMessageThread::test_next_send_continues_the_thread_with_only_the_new_messages \
  tests/lib/threads/test_beta_threads.py::TestMessageThread::test_continue_omits_the_system_and_tools_the_server_holds \
  tests/lib/threads/test_beta_threads.py::TestMessageThread::test_replay_after_a_continue_sends_system_and_tools_again
```

我在 Python 3.10.22 上实际执行，结果为 `4 passed`。它验证了 SDK 会让首轮带上种子历史、续轮只带新增消息、续轮省略服务端已持有的系统提示与工具，并在无法继续时重放完整历史。

这不是线上延迟测试，也没有调用付费模型，所以不能验证 Anthropic 的 35% 数据。它的价值是先把最容易写错的请求状态机钉住。若自行拼装 HTTP 请求，还要在每轮发送 `message-threads-2026-08-12` beta header；SDK helper 会自动添加。

## 什么时候值得用

最适合 Message Threads 的，是连续活跃、上下文很长、每轮新增内容相对较少的循环：

- 编程 Agent 不断追加文件读取、命令输出和补丁；
- Computer Use Agent 持续上传截图和操作结果；
- 文档或图片工作流已经积累大量上下文，但仍在快速迭代。

短对话几乎没有可省的重复上传；两轮之间经常超过 5 分钟的任务会频繁重建线程；需要任意编辑历史、从旧节点并发分叉，或依赖消息批处理、token counting、按需 compaction 的系统，也不能把 Thread 当成透明替换。

数据治理同样是硬边界。Message Threads 不符合 ZDR 条件，HIPAA readiness 已启用的组织也不支持。Anthropic 表示 Thread 仅在内存中用服务端密钥加密、不写入持久存储，并在最后使用后最迟 1 小时删除；但对于要求所有功能都具备零数据保留资格的工作负载，这个功能仍不适用。

## 一个合适的接入顺序

不要先把现有 `messages` 数组删掉。更稳妥的路径是：

1. 保留现有完整对话持久化和幂等工具执行；
2. 在长而活跃的会话上增加 `create/continue`，记录响应 ID；
3. 把 `thread_not_found` 的完整重放作为正常分支测试；
4. 再按业务决定是否叠加 Prompt Caching；
5. 分别观测请求体大小、首 token 时间、缓存命中和 token 账单，不把它们混成一个指标。

Message Threads 的价值并不是让 Claude 少读上下文，而是让网络和 API 不必一轮轮接收同一份上下文。这个边界看似朴素，却很适合长 Agent：性能优化发生在传输层，业务真相仍留在应用端；一旦短期状态消失，系统有完整、可测试的重放路径，而不是祈祷服务端记得上一轮。

## 原始资料

- [Anthropic 公告：Message Threads 与 TTFT 统计](https://claude.com/resources/articles/message-threads)
- [Claude Platform 文档：协议、恢复、限制与数据保留](https://platform.claude.com/docs/en/build-with-claude/message-threads)
- [Messages API 的 `thread` 参数](https://platform.claude.com/docs/en/api/messages)
- [Python SDK v2.2.0 发布说明](https://github.com/anthropics/anthropic-sdk-python/releases/tag/v2.2.0)
- [Python SDK 固定提交中的 Thread 测试](https://github.com/anthropics/anthropic-sdk-python/blob/f26777eaf2a756afeb904d9feed03b12190e551c/tests/lib/threads/test_beta_threads.py)
