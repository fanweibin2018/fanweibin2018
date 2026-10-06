---
title: 'Pydantic AI 的流式请求为何会耗尽并发池：一个任务所有权陷阱'
date: 2026-10-07
slug: 'pydantic-ai-stream-concurrency-slot-leak'
author: 范伟彬
description: '复现 Pydantic AI 2.52.0 的流式并发槽泄漏，解释异步流为何会跨任务清理、CapacityLimiter 与 Semaphore 的差别，以及 2.53.0 修复后的升级和配置边界。'
categories:
  - AI
  - 技术
tags:
  - Pydantic AI
  - Python
  - 异步编程
  - 并发控制
  - 安全更新
---

一个 AI 接口明明已经停止输出，监控里也看不到仍在生成的模型请求，新的请求却全部卡在队列里。重启服务后恢复，过一阵又重现——问题可能不在模型供应商，而在一个没有归还的本地并发槽。

Pydantic 在 **2026 年 10 月 2 日**发布了 [Pydantic AI 2.53.0](https://github.com/pydantic/pydantic-ai/releases/tag/v2.53.0)，修复了 `ConcurrencyLimitedModel` 的流式请求无法可靠释放槽位的问题。官方安全公告把它评为高危，CVSS 3.1 分数为 7.5；影响的是可用性，不涉及数据泄露或篡改。受影响版本为 `>=2.10.0,<2.53.0`，`pydantic-ai` 与 `pydantic-ai-slim` 都需要检查。

这次故障值得拆开看，因为它不是一个简单的“忘记写 `finally`”。代码确实执行了清理，出错的是：**申请资源和释放资源可能运行在不同的异步任务，而旧的限流器把槽位认领者绑定到了申请任务。**

## 一个断开的流，怎样拖死后面的请求

`ConcurrencyLimitedModel` 用来限制底层模型同时处理多少个请求。假设限额是 2，每次调用模型前取走一个槽位，调用结束后归还；第 3 个请求等待，直到前两个请求之一结束。

非流式调用通常像一个完整函数：同一个任务进入、等待模型返回、退出上下文。流式调用则不同。模型响应是一个异步迭代器，框架可能用后台任务预取数据，`stream_text()` 的防抖逻辑也可能在另一个任务消费下一段内容。客户端断开、业务代码提前 `break`、消费者抛异常或任务被取消时，关闭流的工作不一定回到最初打开流的任务执行。

可以把旧实现想成停车场的专属取车规则：A 任务领了一张停车票，清理任务 B 拿着同一张票来还车，管理员却只认 A 本人。B 的归还被拒绝，车明明开走了，系统仍把车位记为占用。重复几次之后，空停车场也会显示“已满”。

官方公告列出了两个容易忽略的触发路径：

- 流被提前停止，包括退出迭代、消费者异常和取消；
- 即使把 `stream_text()` 正常读完，只要使用默认的 `debounce_by=0.1`，也可能走到跨任务释放路径。

因此，不能只在“客户端异常断开”时排查。一个看起来完整消费结束的流，在旧版本里也可能留下槽位。

## 不调用真实模型，也能复现

下面的脚本使用 Pydantic AI 自带的 `FunctionModel` 在本地依次输出 `a`、`b`、`c`，不需要 API Key。并发池只有一个槽位：首个流结束后，脚本读取公开的 `running_count`，再发起第二个请求。

```python
from collections.abc import AsyncIterator

import anyio
from pydantic_ai import Agent, ConcurrencyLimiter
from pydantic_ai.messages import ModelMessage
from pydantic_ai.models.concurrency import ConcurrencyLimitedModel
from pydantic_ai.models.function import AgentInfo, FunctionModel


async def stream_chunks(
    messages: list[ModelMessage], info: AgentInfo
) -> AsyncIterator[str]:
    for chunk in ("a", "b", "c"):
        yield chunk


async def main() -> None:
    limiter = ConcurrencyLimiter(max_running=1)
    model = ConcurrencyLimitedModel(
        FunctionModel(stream_function=stream_chunks), limiter=limiter
    )
    agent = Agent(model)

    try:
        async with agent.run_stream("first") as result:
            chunks = [chunk async for chunk in result.stream_text()]
            print("first:", chunks)
    except RuntimeError as exc:
        print("cleanup error:", type(exc).__name__, str(exc))

    print("slots after first:", limiter.running_count)

    second_finished = False
    try:
        with anyio.move_on_after(0.5):
            async with agent.run_stream("second") as result:
                await result.get_output()
            second_finished = True
    except RuntimeError as exc:
        print("second error:", type(exc).__name__, str(exc))
    print("second finished:", second_finished)


anyio.run(main)
```

我在 Python 3.12.14 中分别安装两个版本运行：

```bash
PYDANTIC_AI_NO_BANNER=1 uv run --isolated \
  --with pydantic-ai==2.52.0 python reproduce.py

PYDANTIC_AI_NO_BANNER=1 uv run --isolated \
  --with pydantic-ai==2.53.0 python reproduce.py
```

2.52.0 的结果是：

```text
cleanup error: RuntimeError this borrower isn't holding any of this CapacityLimiter's tokens
slots after first: 1
second error: RuntimeError this borrower is already holding one of this CapacityLimiter's tokens
second finished: False
```

2.53.0 则会正常归还槽位：

```text
first: ['abc']
slots after first: 0
second finished: True
```

这段测试只复现框架内部的生命周期问题，不会向任何模型服务发送请求。生产环境若共享的是容量大于 1 的长生命周期限流器，现象未必是第一次请求后立即报错，而可能表现为可用容量逐步下降，最终所有共享该限流器的请求都无法继续。

## 修复为什么要换成 Semaphore

2.52.0 的 `ConcurrencyLimiter` 包装了 AnyIO 的 `CapacityLimiter`。这种限流器不仅记录“还剩几个槽位”，还记录哪个 borrower 持有槽位；普通用法中 borrower 就是当前任务。其他任务直接释放时，会得到复现输出里的 `this borrower isn't holding` 错误。

2.53.0 把底层实现换成了 `anyio.Semaphore`。信号量只维护可用计数，不要求释放者必须是获取者：一次成功的 `acquire()` 对应一次 `release()`，两者可以发生在不同任务。这正好匹配流的生命周期——谁负责消费和关闭，不应改变槽位最终必须归还的事实。

修复并非只改了一个类型。合并的 [PR #9478](https://github.com/pydantic/pydantic-ai/pull/9478) 还加入了多组回归测试，覆盖正常消费、防抖消费、提前 `break`、显式 `aclose()`、消费者异常、任务取消和未消费流等路径；同时在入口处拒绝危险的重复限流配置。

这里有一个设计层面的启示：如果资源在异步迭代器、后台任务或回调之间转手，就不能默认“进入和退出一定由同一个任务完成”。连接、许可、锁和追踪上下文究竟属于任务、请求，还是流本身，需要在接口契约里写清楚。

## 升级后还要检查两类配置

最直接的处理是升级到 `2.53.0` 或更高版本：

```bash
uv add 'pydantic-ai>=2.53.0'
# 或
pip install --upgrade 'pydantic-ai>=2.53.0'
```

升级后还应检查配置，而不是只看依赖安装成功。

第一，不要让 Agent 层的 `max_concurrency` 与它内部的 `ConcurrencyLimitedModel` 共用同一个 `ConcurrencyLimiter`，也不要把同一个限流器套在嵌套的模型包装器上。一次请求会在同一路径重复申请同一个池，容量为 1 时必然自我等待；2.53.0 会主动抛出 `UserError`，要求只在一层限流，或为不同层使用不同限流器。

第二，如果项目实现了 `AbstractConcurrencyLimiter`，它的 `release()` 必须允许从不同任务调用。修复后的公开契约已经明确了这一点。自定义 Redis 或数据库限流器若仍把释放权绑定到当前 Python 任务，升级框架也不能自动修正外部实现。

暂时不能升级时，官方给出的缓解办法是：改用 Agent 层的 `max_concurrency`，或者不要让流式请求经过 `ConcurrencyLimitedModel`。这只是过渡方案；`run()` 等非流式模型请求和 Agent 层 `max_concurrency` 本身不受这次缺陷影响。

## 怎样确认服务真的恢复

仅做一次健康检查不够。更有效的回归测试应该模拟资源最容易丢失的退出方式：

1. 把共享限流器容量设为 1，便于立即暴露泄漏；
2. 正常读完一次默认防抖的 `stream_text()`；
3. 分别测试提前退出、异常和取消；
4. 每次结束后断言 `running_count == 0`；
5. 立刻启动下一次请求，并给它设置较短的测试超时。

监控也应同时观察正在运行数、等待数和实际模型请求数。若模型侧已经没有活动请求，本地 `running_count` 却长期不降，或等待队列持续增长，就比单纯看到接口超时更接近根因。

这次修复的价值不在于把一个异常信息消掉，而在于恢复了并发控制最基本的不变量：**流结束后，无论由哪个任务收尾，拿走的槽位都必须归还。** 对长连接和共享限流器而言，这个不变量比一次请求是否成功更重要，因为它决定服务能不能在不断线、不重启的情况下继续工作。

## 原始资料

- [GitHub 安全公告：GHSA-6fqq-452j-qhrp](https://github.com/pydantic/pydantic-ai/security/advisories/GHSA-6fqq-452j-qhrp)
- [Pydantic AI 2.53.0 发布记录](https://github.com/pydantic/pydantic-ai/releases/tag/v2.53.0)
- [修复 PR #9478 与回归测试说明](https://github.com/pydantic/pydantic-ai/pull/9478)
- [2.53.0 的并发限流器源码](https://github.com/pydantic/pydantic-ai/blob/v2.53.0/pydantic_ai_slim/pydantic_ai/concurrency.py)
