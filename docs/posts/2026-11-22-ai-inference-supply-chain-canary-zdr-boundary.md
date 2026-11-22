---
title: '两百万个金丝雀暴露 AI 推理供应链：ZDR 为什么不是端到端保证'
date: 2026-11-22
slug: 'ai-inference-supply-chain-canary-zdr-boundary'
author: 范伟彬
description: 'Dragos 用约 200 万个唯一金丝雀提示词追踪 AI 请求，观察到转售商日志、跨组织访问和隐私设置落空。本文解释推理链路、ZDR 边界，并给出可运行的本地验证实验。'
source: 'https://www.dragos.com/blog/ai-supply-chain-security-canary-tokens'
categories:
  - AI
  - 技术
  - 安全
  - 开发
tags:
  - AI 推理供应链
  - Canary Token
  - ZDR
  - AI Gateway
  - 数据安全
  - OpenRouter
---

# 两百万个金丝雀暴露 AI 推理供应链：ZDR 为什么不是端到端保证

工业网络安全公司 Dragos 在 11 月 19 日公布了一项持续五个月的实验：研究人员向不同 AI 服务提交约 200 万个带有唯一“金丝雀”的提示词，再观察这些金丝雀何时、从哪里被触发。Dragos 报告称，实验看到了至少三家 AI 服务商的数据暴露迹象，也发现部分推理市场的转售商能通过常规日志看到并保留提示词；有些访问还发生在请求提交数月之后。

这件事值得开发者关注，不是因为又出现了一个笼统的“AI 会泄密”警告，而是它揭开了一个常被界面隐藏的事实：你调用的是一个模型名，请求却可能经过网关、路由市场、转售商和实际托管模型的上游。页面上的“零数据保留”（Zero Data Retention，ZDR）开关，只能约束它覆盖到的合同与路由环节，不是给整条链路加上了端到端加密。

## 一次模型调用，可能经过多少只手

把提示词想成一封没有信封的明信片。你交给前台，前台根据价格和可用性转给调度中心，调度中心再选择一家承运商，最后才送到真正处理内容的人。链路上的每个中间人都需要读到地址，有些环节还可能在日志里留下明信片正文。

AI 推理供应链常见的路径是：

```text
应用 → AI 网关或路由器 → 推理市场／转售商 → 托管服务商 → 模型
                              ↘ 工具或插件后端
```

并非每次请求都会经过所有环节。直接调用模型厂商通常更短；使用自动选择最低价或最低延迟供应商的市场，则可能在不同请求间切换上游。问题不在于“中间商必然不可信”，而在于开发团队往往只审查了自己签约的平台，没有同时确认实际承载请求的每一方、失败回退路径和工具后端。

Dragos 的实验试图把这条隐形链路显形。每个测试提示词都嵌入一个独一无二的 URL、域名或诱饵凭据。只要后来有人或自动系统访问它，研究人员就能把触发记录关联回最初那条请求。报告称，研究人员观察到提交给美国服务商的提示词被传送至中国 AI 组织、数月后才被读取的 URL，以及最终出现在中国某公司内部聊天中的诱饵链接。

这些都是 Dragos 基于自有传感器和日志报告的观察，完整数据集与涉事服务商名单并未公开，因而不能把它当作已被外部团队独立复现的全行业比例。不过，金丝雀给出的可核验信号仍然比“相信隐私标签”多了一层证据。

## 金丝雀能证明什么，不能证明什么

煤矿曾用金丝雀提前发现有毒气体；安全测试里的 Canary Token 也是同一思路：创建一件正常流程不应碰触的东西，一旦它被访问，就发出告警。

例如，为每条敏感模型请求生成不同的 URL：

```text
请求 A → https://canary.example/r-7f2a...
请求 B → https://canary.example/r-91c4...
```

如果 `r-7f2a` 后来收到请求，至少可以确认有人或某个自动化系统看到了请求 A 中的地址。结合时间、来源 IP、User-Agent、模型路由记录和供应商日志，调查者才能进一步判断访问发生在哪一环。

单独一次触发不能证明具体是谁泄露了数据，也不能直接说明访问者有恶意。某些模型产品本来就会抓取链接，安全扫描器和网页预览机器人也可能主动访问 URL。反过来，没有触发也不等于数据没有被保留：对方可能看过文本，却从未访问链接。因此金丝雀适合做“异常存在性”检测，不是完整的数据流审计。

## ZDR 是路由与合同属性，不是密码学保证

OpenRouter 的官方路由文档提供了 `zdr`、`data_collection` 和供应商白名单等控制项。开启 `zdr` 后，平台只把推理请求发往被标记为 ZDR 的端点；开发者还可以用 `only` 固定允许的上游，而不是接受自动供应商池。

但 OpenRouter 的数据处理协议写得更直白：ZDR 资格依据上游公开或声明的“不保留、不训练”政策，协议同时说明这并不构成 OpenRouter 对供应商实际遵守政策的保证。路由文档还注明，ZDR 过滤针对模型推理端点，不会自动过滤工具后端；某些安全保留（Safety Retention）设置也可能符合平台的 ZDR 路由条件。

所以 ZDR 仍然有用，但应把它理解为“缩小允许的数据处理范围”，而不是“任何一方都不可能保存数据”。它更像快递合同里的“禁止复印”，不是一只只有收件人能打开的保险箱。

## 用 40 行 Python 复现金丝雀机制

下面的实验只在本机监听，不会把数据发给第三方。它生成一个随机 URL，只有访问正确路径时才记录时间、来源和 User-Agent：

```python
#!/usr/bin/env python3
import json
import secrets
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8080
TOKEN = secrets.token_urlsafe(18)
LOG = Path("canary-events.jsonl")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != f"/{TOKEN}":
            self.send_error(404)
            return

        event = {
            "time": datetime.now(timezone.utc).isoformat(),
            "path": self.path,
            "client": self.client_address[0],
            "user_agent": self.headers.get("User-Agent", ""),
        }
        with LOG.open("a", encoding="utf-8") as file:
            file.write(json.dumps(event, ensure_ascii=False) + "\n")

        self.send_response(204)
        self.end_headers()

    def log_message(self, *_args):
        pass


print(f"http://{HOST}:{PORT}/{TOKEN}", flush=True)
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
```

保存为 `ai_canary_demo.py` 后运行：

```bash
python ai_canary_demo.py
# 复制程序输出的随机 URL，在另一个终端访问
curl -i 'http://127.0.0.1:8080/这里替换为随机令牌'
tail -n 1 canary-events.jsonl
```

我用 Python 3.12 运行并访问了生成的 URL，服务返回 `204 No Content`，日志成功记录了 UTC 时间、随机路径、`127.0.0.1` 和 `curl/8.14.1`。这验证的是检测机制，不是任何云服务的隐私承诺。由于地址只绑定本机，外部模型也无法访问它。

要测试真实供应链，应使用自己控制的公网域名或 Thinkst Canarytokens 等工具，为每个路由、环境和测试请求生成不同令牌。不要使用真实密码或生产密钥，也不要测试不属于自己的系统。测试链接抓取行为时，应先关闭明确启用的联网工具，否则一次“正常抓取”很容易被误判为泄露。

## 四种部署方式的风险差异

| 方式 | 可能看到明文的主要参与方 | 适合场景 | 主要边界 |
| --- | --- | --- | --- |
| 本地或自托管 | 自己的应用与基础设施 | 源码、凭据、受监管数据 | 运维、模型能力和硬件成本由自己承担 |
| 直连一线模型厂商 | 应用与单一模型厂商 | 需要云端能力且能接受该厂商条款 | 厂商内部日志、区域和安全保留仍需确认 |
| 网关并固定上游 | 应用、网关、指定上游 | 需要统一鉴权、限流和可观测性 | 多一个处理方，回退与工具路径要单独审查 |
| 市场自动选路 | 应用、市场与动态上游 | 公开数据、价格或可用性优先 | 实际处理方会变化，最难建立稳定的数据边界 |

对于高敏感请求，最稳妥的优先顺序通常是自托管、直连经过审查的一线供应商，或把网关固定到明确的上游。自动回退可以提高可用性，却也可能在主供应商故障时把数据交给没有完成审查的备用端点。

## 开发团队现在可以做的六件事

1. **在发送前清理秘密。** 对 API Key、云凭据、连接串和个人信息做检测与替换，不把供应商承诺当成第一道防线。
2. **固定敏感流量的上游。** 使用供应商白名单，关闭未审查的自动回退；把公开问答与敏感代码分成不同路由。
3. **同时配置隐私选项。** ZDR、禁止数据收集和区域限制可以叠加使用，但要记录它们在请求发生时的实际值。
4. **保存路由元数据，不保存提示词。** 记录请求 ID、模型、实际供应商、隐私标志和失败回退，便于金丝雀触发后定位链路。
5. **单独审查工具后端。** 搜索、浏览器、代码执行和 MCP 服务有自己的数据路径，不能因为模型端点启用了 ZDR 就默认它们也符合要求。
6. **定期投放无害金丝雀。** 每次只验证自己拥有的账户和系统，并设置轮换、告警归并和误报分析流程。

金丝雀不是数据防泄漏系统的替代品。它更像烟雾报警器：能让原本不可见的异常尽早发声，却不能替代防火门、权限隔离和事故调查。

## 怎样判断这次研究的边界

Dragos 披露的是一个重要的风险信号，而不是所有 AI 服务的失效率统计。研究没有公开涉事厂商名单、逐条原始日志或可供独立复算的完整数据；文章中的“约 200 万”与“至少三家服务商”应保留为 Dragos 的报告结论。

另一方面，OpenRouter 的公开协议已经足以确认一个更普遍的设计边界：平台可以根据供应商声明筛选 ZDR 端点，却不能把声明变成对供应商行为的技术证明。对开发者而言，真正可行动的结论不是“所有路由平台都不可信”，而是把数据边界从界面上的一个开关，升级为可枚举的参与方、可固定的路由、可核对的合同和可观测的运行证据。

当一条提示词足以暴露源代码、客户资料或生产凭据时，最安全的默认值仍然是：能不发送就不发送；必须发送时，尽量缩短链路，并让每一个参与方都能被说明、限制和验证。

## 原始资料

- [Dragos：AI Supply Chain Security: Canary Tokens Reveal Hidden Data Exposure](https://www.dragos.com/blog/ai-supply-chain-security-canary-tokens)
- [Ars Technica：A leaky AI supply chain is exposing secret user data](https://arstechnica.com/security/2026/11/a-leaky-ai-supply-chain-is-exposing-secret-user-data-at-an-alarming-rate/)
- [OpenRouter：Provider Routing 文档](https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/provider-selection.mdx)
- [OpenRouter：Data Processing Addendum](https://openrouter.ai/assets/data-processing-agreement.pdf)
- [OpenRouter：Provider Logging 文档](https://github.com/OpenRouterTeam/docs/blob/main/guides/privacy/provider-logging.mdx)
- [Thinkst：Canarytokens 开源仓库](https://github.com/thinkst/canarytokens)
