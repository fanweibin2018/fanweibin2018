---
title: 'Perplexity SPACE 开源：Agent 沙箱难的不是启动容器，而是管理一段长期状态'
date: 2026-10-16
slug: 'perplexity-space-agent-sandbox-lifecycle'
author: 范伟彬
description: '拆解 Perplexity 新开源的 SPACE 如何用 Firecracker microVM、期望状态协调、暂停与挂起、分离的数据平面和分层网络策略承载长时 Agent，并用固定源码提交的 37 项测试说明可复现范围与部署边界。'
categories:
  - AI
  - 技术
  - 开源工具
tags:
  - Perplexity
  - SPACE
  - AI Agent
  - Firecracker
  - 沙箱
  - Kubernetes
---

让 AI Agent 执行一条命令并不难，难的是让它在几小时甚至几天后回来时，仍能找到原来的文件和进程，又不能拿到宿主机、生产凭证与任意网络出口。

Perplexity 在 **2026 年 10 月 16 日**宣布开源 [SPACE](https://github.com/perplexityai/SPACE)，全称是 Sandboxed Platform for Agentic Code Execution。它不是新的编程 Agent，也不负责决定下一步写什么代码；它提供的是下面那层执行基础设施：创建隔离的 Linux 环境、运行命令、收集输出，并管理环境从运行到暂停、落盘、恢复和删除的完整生命周期。

SPACE 早在 7 月就已用于 Perplexity 自己的长时任务。现在值得重新关注，是因为 Apache 2.0 许可的源码、部署说明、API 示例和兼容性计划都公开了，开发者终于可以检查它怎样处理异步状态、凭据边界和失败恢复。截至 10 月 16 日观察时，仓库有 333 个 Star 和 23 个 Fork；这只能说明项目开始受到关注，不能证明它已经被外部团队广泛采用。

## 为什么“开一个 Docker 容器”还不够

一次性代码执行很像给访客一张当天有效的工位卡：任务结束，容器销毁，文件也跟着消失。长时 Agent 更像一个可能随时离开、稍后回来继续工作的承包团队，它需要一张可恢复的桌面，同时不能因此拿到整栋楼的钥匙。

SPACE 把这件事拆成五个相互关联的对象：

| 对象 | 负责什么 | 容易混淆的地方 |
| --- | --- | --- |
| Template | 定义可启动的系统镜像 | 它不是一个正在运行的环境 |
| Sandbox | 一台隔离的 Firecracker microVM | 创建请求成功不代表已经可用 |
| Operation | 记录创建、暂停、唤醒、删除等异步操作 | 需要轮询最终状态，不能只看 HTTP 成功 |
| Session / Process | 在沙箱内启动并控制命令 | 输出通过独立连接传输 |
| Snapshot | 保存可恢复的运行状态与磁盘状态 | 恢复仍要重新验证来宾版本和就绪状态 |

这里最重要的设计不是 microVM 这个名词，而是**期望状态与实际状态分离**。管理 API 先把“我希望这个沙箱运行”写进 PostgreSQL，控制器再不断协调节点上的实际状态，直到二者一致。于是一个创建接口返回 `operation_id`，只表示请求已被接受；调用方还必须等待 operation 成功、sandbox 进入 `running`，并确认来宾进程端点已经就绪。

这和网购很像：支付成功只表示订单成立，不等于包裹已经送到。把“接口返回 200”误当成“沙箱可执行”，会制造最难排查的间歇性错误。

## 管理指令和命令输出，为什么要走两条路

SPACE 把通信分成控制平面和数据平面。

控制平面负责创建、查询、暂停和删除沙箱，使用管理 API 的 bearer token。命令启动以后，标准输出、标准错误和退出事件从数据平面的事件流返回，使用只对该会话有效的 attachment token。两个令牌不能互换，示例客户端也不会把它们写入状态文件。

这条边界解决的是“权限过大”的常见问题。管理令牌可以创建或删除环境，不应该被发送到承载不可信输出的数据端点；只允许附着到一次命令流的短作用域令牌，也不应该反过来控制整个集群。官方 Python 示例还主动禁用环境代理和 HTTP 重定向，并只接受预先配置的数据平面来源与精确会话路径，避免令牌在跳转或代理过程中被带到错误的主机。

命令流本身也不是永久日志。断线后携带 `Last-Event-ID` 重连，服务会要求重新同步，而不是补放错过的输出。因此调用方需要自己保存事件记录，并且只有收到 `process_exited`、退出码为 0，同时没有 `error`、`resync_required` 或不完整帧，才能把命令标记为成功。**HTTP 成功、连接正常关闭和命令成功，是三件不同的事。**

## Pause 与 Suspend，保存的不是同一种状态

SPACE 为沙箱定义了 `running`、`paused`、`suspended` 和 `deleted` 等生命周期状态，其中最容易误解的是暂停与挂起：

- `paused` 会停住 microVM，但保留内存中的 VM，恢复更快，也继续占用节点资源；
- `suspended` 会为内存、运行时状态和根文件系统制作快照，然后释放计算资源，适合更长的空闲期；
- `wake` 不是简单地把状态字段改回去，恢复后还要重新检查来宾身份、网络和进程服务是否就绪。

官方文档给出的默认空闲阈值是六小时。这个默认值不是普适答案：代码评审 Agent 可能希望短暂停顿后立即恢复，批量研究任务更适合尽早挂起节省资源。真正有价值的是平台把两种成本模型明确分开，而不是让应用层拿“停止容器”和“保存磁盘”勉强拼出状态机。

存储也有一条容易被忽略的边界。SPACE 使用 btrfs 写时复制和快照机制保存根文件系统，但文档只承诺在生命周期边界持久化已经确认的写入，并不保证每一次来宾写操作在节点突然崩溃时都已耐久。也就是说，它适合保存 Agent 的工作目录，却不应被误当成无需备份的数据库。

## microVM 不是安全结论，只是一层边界

SPACE 用 Firecracker microVM 隔离不可信代码，相比共享宿主内核的普通容器多了一层虚拟机边界；凭据也由来宾外部的服务保管，需要时才按策略提供。但“用了 microVM”不等于整个系统已经安全，至少还要分别检查三类边界：

1. **计算边界**：来宾能否逃逸到宿主机或影响其他沙箱；
2. **网络边界**：域名白名单、DNS 结果与实际 TLS 请求是否指向同一个目标；
3. **身份边界**：管理令牌、会话令牌和工作负载凭据是否被送到正确端点。

Perplexity 9 月公开的一轮自动红队实验恰好说明了这种区别。官方报告称，9 个模型在两类任务、四种设置下共运行 216 次；108 次 VM 逃逸尝试中没有观察到成功的宿主机逃逸，但作者明确指出，这不能证明隔离绝对安全。网络侧则在修复前出现过绕过：允许部分网络访问的 54 次运行中，有 11 次成功访问了不应访问的目标，手法包括 DNS 欺骗以及让域名检查与实际连接目标不一致。

修复增加了源地址校验和 TLS 拦截，在最强测试设置下没有再验证到绕过；不过其中两次计划运行因模型服务或传输错误结束。这个结果更适合被理解为“找到了具体缺口并增加回归测试”，而不是第三方安全认证。

## 固定源码后，能够复现到哪一步

我把仓库固定在 **`253d8b349c148eabd10809deb60d455e41eaabab`**，使用 Python 3.12.14 与 Node.js 24.19.0 运行了项目随附的客户端和文档测试：

```bash
git clone https://github.com/perplexityai/SPACE.git
cd SPACE
git checkout 253d8b349c148eabd10809deb60d455e41eaabab

python3 scripts/tests/test_first_sandbox_example.py
python3 docs/site/test_build.py
node --test docs/site/test_theme.cjs
python3 -m py_compile examples/first_sandbox.py
```

结果是 Python 示例客户端 **28 项测试通过**，文档构建逻辑 **6 项测试通过**，站点主题 **3 项测试通过**，示例脚本也通过语法编译。客户端测试覆盖了令牌不向错误来源泄漏、重定向拒绝、代理禁用、SSE 不完整帧、非零退出、超时、删除重试和幂等键复用等路径。

这 37 项测试验证的是客户端契约与文档工具，不是 Firecracker 隔离本身。完整的本地部署要求 Linux x86_64、`/dev/kvm`、`/dev/net/tun`、loop device、btrfs，以及能运行特权容器的 Docker 和 Kind。当前验证环境虽然是 Linux x86_64，但没有 KVM、TUN、Docker、Kind 与 Rust 工具链，因此没有运行 Kubernetes 集群、microVM 或 Rust 工作区测试，也没有声称完成端到端部署。

具备上述条件后，可以按官方安装文档部署 `seed:latest` 模板，再运行标准库实现的示例：

```bash
python3 examples/first_sandbox.py
```

示例会依次创建沙箱、等待 operation、检查来宾就绪、创建命令会话、读取事件流、核对退出状态，最后询问是否删除环境。它会先把 ID、原始变更请求、幂等键和事件记录保存在一个私有运行目录中，但不会保存 bearer token。失败时不要直接重跑整段流程：超时并不证明请求失败，重复创建或删除可能产生第二次副作用，应先用保存的状态执行 `inspect`，再按相同幂等键恢复操作。

## 它适合谁，又不适合谁

SPACE 更适合这些场景：

- Agent 需要安装依赖、生成文件并在多轮任务之间保留工作现场；
- 任务可能长时间空闲，需要在快速恢复和释放资源之间做明确选择；
- 团队希望把沙箱部署在自己的 Kubernetes 与凭据边界内；
- 应用需要通过 HTTP/SSE 接入，而不是绑定某个 Agent 框架或语言 SDK。

如果只运行几秒钟的可信脚本，本地子进程或普通容器可能更简单。只有 macOS 开发机而没有可暴露 KVM 的 Linux 虚拟机，也不能照着官方 Kind 路径直接部署。SPACE 还引入了 Kubernetes、Firecracker、btrfs、PostgreSQL、对象存储和多组节点服务，运维成本明显高于托管沙箱 API。

版本边界同样重要。当前公开基线是 **0.8.0**；项目计划把 0.9.0 作为最后一次预定的破坏性版本，到 1.0 才承诺稳定的 HTTP、节点管理和来宾桥接协议。Rust crate API 不在这项兼容性承诺内。现在适合研究架构、做内部验证或准备迁移层，不适合把未冻结的接口直接写死在难以升级的生产系统中。

Perplexity 在自家生产数据中给出了一组优化数字：采用写时复制、预热池和快照路径后，沙箱创建延迟中位数从 185 毫秒降至 60 毫秒，P90 从 447 毫秒降至 89 毫秒。这是厂商在自身工作负载上的观测，没有公开成独立可复现基准，不能外推到其他集群配置。

SPACE 最值得借鉴的地方，最终不是“microVM 比容器更安全”这句口号，而是把长时 Agent 的隐含状态全部显式化：请求是否已接受、环境是否已就绪、输出是否完整、写入何时持久化、重试是否会重复副作用、令牌能到哪里。只有这些问题都有可检查的答案，沙箱才不只是一个会启动的黑盒。

## 原始资料

- [Perplexity CEO Arav Srinivas：SPACE 开源公告](https://x.com/AravSrinivas/status/2110785848958759165)
- [perplexityai/SPACE 源码仓库](https://github.com/perplexityai/SPACE)
- [Perplexity Research：Making SPACE — Secure and Efficient Runtimes for Long-Running Agents](https://research.perplexity.ai/articles/making-space-secure-and-efficient-runtimes-for-long-running-agents)
- [SPACE 架构文档](https://space.docs.perplexity.ai/guide/architecture.html)
- [SPACE 安装文档](https://space.docs.perplexity.ai/guide/installation.html)
- [SPACE 第一个沙箱示例](https://space.docs.perplexity.ai/guide/first-sandbox.html)
- [SPACE 版本与兼容性计划](https://space.docs.perplexity.ai/guide/versioning.html)
- [Perplexity：Escaping SPACE Part I — Testing AI Agents in Sandboxes](https://www.perplexity.ai/hub/blog/escaping-space-part-i)
