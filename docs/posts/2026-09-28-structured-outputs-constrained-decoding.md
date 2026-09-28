---
title: '让大模型按格式交卷：结构化输出与约束解码到底保证了什么'
date: 2026-09-28
slug: 'structured-outputs-constrained-decoding'
author: 范伟彬
description: '从 token 选择解释 JSON Schema 约束解码，区分 JSON 格式、字段契约和事实正确性，并用可运行的 Python 示例演示应用侧校验。'
categories:
  - AI
  - 技术原理
tags:
  - LLM
  - Structured Outputs
  - JSON Schema
  - 约束解码
  - 应用开发
---

# 让大模型按格式交卷：结构化输出与约束解码到底保证了什么

**一句话结论：**结构化输出通过在生成过程中限制可选 token，让模型更可靠地交出符合指定结构的结果；它能解决“程序读不懂回答”的一部分问题，却不能证明回答中的事实为真，也不能代替应用侧的业务校验。

想象你让 AI 阅读一张发票，并返回发票号、金额和币种。人看得懂“金额大概一百元”，程序却需要确定的字段与类型，例如 `{"amount": 100, "currency": "CNY"}`。少一个引号、把金额写成字符串，甚至额外塞一段解释，都可能让后续入账程序失败。更危险的是，格式完全正确的 `{"amount": 100000, "currency": "CNY"}` 仍可能把数字识别错。**格式正确、字段符合契约、事实正确，是三道不同的关。**

本文依据 OpenAI 于 **2024 年 8 月 6 日**发布的[结构化输出技术说明](https://openai.com/index/introducing-structured-outputs-in-the-api/)、目前的 [Structured Outputs 开发文档](https://developers.openai.com/api/docs/guides/structured-outputs/)、[JSON Schema 官方教程](https://json-schema.org/learn/getting-started-step-by-step)与开源项目 [llguidance 的最小示例](https://github.com/guidance-ai/llguidance/blob/main/sample_parser/src/minimal.rs)解释原理。**资料核验日期：2026 年 9 月 28 日。**这是一篇机制解析，不把 2024 年的功能发布包装成今日新闻；具体 API 参数和支持的 Schema 子集应以调用时的官方文档为准。

## 先把三种“正确”分开

第一层是**语法正确**：输出是合法 JSON，`json.loads` 能解析。`{"amount": "很多"}` 在这一层完全合格。

第二层是**结构正确**：它符合应用给出的 Schema。例如 `amount` 必须是数字，`currency` 只能是 `CNY` 或 `USD`，两个字段都必填，也不能出现未约定的字段。JSON Schema 的作用是描述和验证这类约束。只要求“请输出 JSON”的提示词没有同样的保证；OpenAI 文档也明确区分 JSON mode 与遵循指定 Schema 的 Structured Outputs。

第三层是**语义与业务正确**：金额是否真的来自这张发票？币种是否识别对了？订单号是否属于当前用户？Schema 无法仅凭字段类型验证这些事实。即使某个 `confidence` 字段满足 `0` 到 `1` 的范围，也不能因此当成经过校准的真实概率。

一个合适的工程分工是：模型负责从材料中提取候选值；结构约束帮助程序稳定接收；应用再对照原文、数据库和权限规则核实关键值。高风险动作应在这些检查之后执行。

## 约束解码在每一步做了什么

普通自回归模型每次根据已有上下文，为词表里的候选 token 计算分数，再选择下一个 token。提示词说“只输出 JSON”会影响这些分数，但通常不会从机制上禁止模型选择多余的解释文字或不合规则的符号。

约束解码在“选择”之前插入一个**动态过滤器**。给定 Schema 和当前已生成的前缀，它判断哪些 token 仍有可能通向一个合法的完整结果；不可能的候选被屏蔽，然后模型从剩余候选中继续选择。选完一个 token，前缀改变，下一个位置的允许集合也随之改变。OpenAI 的技术说明描述了将 Schema 转换为语法并动态限制采样；llguidance 的最小示例则展示 `compute_mask()`、采样、`commit_token()` 这一循环。这些资料说明的是机制，**不意味着不同服务商或版本采用完全相同的实现**。

可以把它想成“填写一张有门卫的表格”：

1. 表格规定第一栏叫 `currency`，只能填 `CNY` 或 `USD`。
2. 模型提出下一笔想写什么；门卫只放行能让整张表最终合规的写法。
3. 写到 `currency` 的值时，其他币种会被挡住；写完一个字段后，门卫又按当前位置检查逗号、下一个键或结束符。

这是概念类比。真实 token 不等于单个字符：一个 token 可能包含引号、多个字节或一整段文字。因此实际过滤器必须结合 tokenizer 与语法状态，不能靠“当前是不是右花括号”这样简单的字符规则完成。

## 为什么事后解析与生成时约束不一样

“先让模型随便写，失败后重试”是一种可用的补救办法，但第一次输出已经消耗了生成时间；失败也可能在多次重试后继续出现。事后 Schema 校验擅长**发现和拒绝**不合格结果，约束解码则在生成时**缩小错误路径**。两者仍应配合：接口调用可能拒绝回答、输出被截断，应用也可能使用与服务端不同版本的契约。

不要把约束解码想成“先生成全文再格式化”。如果某一步只允许一个结构符号，系统可以直接继续；如果有多个合法值，模型仍需在合法集合里选择。结构约束越严格，可选路径越少，但内容真实性不会自动提高。比如 Schema 只要求 `amount` 是数字，那么 `100` 与 `100000` 都可能合法。

OpenAI 2024 年发布文章中提到的复杂 Schema 评测成绩，是**厂商对特定模型和评测的报告**，不是所有模型、所有 Schema 或真实业务中“事实正确率 100%”的承诺。本文不拿该数字推断生产效果。

## 设计一个能落地的输出契约

假设应用要从一段客服消息中抽取退款意图，可约定如下结构：

```json
{
  "type": "object",
  "properties": {
    "intent": {"type": "string", "enum": ["refund", "other"]},
    "order_id": {"type": ["string", "null"]},
    "reason": {"type": "string"}
  },
  "required": ["intent", "order_id", "reason"],
  "additionalProperties": false
}
```

`order_id` 必须出现，但没有订单号时可为 `null`。这是“字段存在但值未知”，与“模型漏掉字段”有明确区别。`additionalProperties: false` 阻止模型私自添加 `approved: true` 之类可能误导后续系统的键。OpenAI 当前的严格结构化输出文档要求对象字段标为 `required`、对象设置 `additionalProperties: false`；需要可缺省的值时，可用包含 `null` 的类型表示。**这属于该服务的支持规则，不等于 JSON Schema 标准要求所有字段必填。**

示例里的 `reason` 是给人看的简短解释，不能把它当作真实证据。订单号也只是模型提取出的候选值，退款前仍要查询订单、核对用户身份和金额。把“提取”直接接到“打款”，就把结构正确误当成业务授权。

## 可复现：让两条合法 JSON 走不同的业务结果

下面的 Python 3 脚本**不调用大模型，也不实现完整 JSON Schema 引擎**。它模拟应用拿到结构化结果后应做的两类检查：结构契约与业务证据。复制到 `structured_output_check.py`，运行 `python structured_output_check.py`，只用标准库。

```python
import json


def check_result(raw: str, message: str, owned_orders: set[str]) -> str:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return "拒绝：不是合法 JSON"

    if not isinstance(data, dict) or set(data) != {"intent", "order_id", "reason"}:
        return "拒绝：字段不符合契约"
    if data["intent"] not in ("refund", "other"):
        return "拒绝：intent 不在允许值中"
    if data["order_id"] is not None and not isinstance(data["order_id"], str):
        return "拒绝：order_id 类型错误"
    if not isinstance(data["reason"], str):
        return "拒绝：reason 类型错误"

    if data["intent"] == "refund":
        order_id = data["order_id"]
        if order_id is None or order_id not in message:
            return "待核实：订单号未在原消息中出现"
        if order_id not in owned_orders:
            return "待核实：订单不属于当前用户"
    return "可进入下一步审核；尚未授权退款"


message = "我想退掉订单 A-17，包装已拆。"
owned_orders = {"A-17"}  # 示例数据库；真实系统应查询权限与订单状态
samples = [
    '{"intent":"refund","order_id":"A-17","reason":"用户要求退款"}',
    '{"intent":"refund","order_id":"B-99","reason":"用户要求退款"}',
    '{"intent":"refund","order_id":"A-17","reason":"用户要求退款","approved":true}',
]
for raw in samples:
    print(check_result(raw, message, owned_orders))
```

预期输出是：

```text
可进入下一步审核；尚未授权退款
待核实：订单号未在原消息中出现
拒绝：字段不符合契约
```

第二条是合法 JSON，也符合字段类型与枚举，但订单号不是用户原话中的内容；第三条额外带了 `approved`，所以在结构检查处被拒绝。真实系统还要处理 Unicode、订单号规范化、消息来源可信度与重放请求。示例只说明校验分层，不应直接作为退款系统的安全代码。

## 什么时候用，什么时候要格外小心

结构化输出适合信息抽取、UI 表单填充、工具参数和多步骤流水线里的机器间传递，尤其在下游代码明确依赖字段名与类型时。设计 Schema 时保持字段少而明确，枚举只放业务确实允许的值，并给“不知道”留出口；否则过滤器可能迫使模型在几个错误答案里选一个。

还需要处理四类边界：

- **拒绝或截断：**安全拒绝、长度限制、网络异常都可能让本次调用没有完整结构。先检查 API 返回状态，再读取字段；不要把空对象当成功。
- **支持范围：**不同提供方只支持 JSON Schema 的不同子集，严格模式遇到不支持的 Schema 可能直接报错。先用目标服务的文档与测试请求验证契约。
- **内容失真：**看似整齐的字段仍可能包含幻觉、过期知识或错误 OCR。关键数字、链接、身份和权限要到可信来源二次核实。
- **成本与变化：**复杂结构可能增加首次编译或生成开销；模型、SDK 和服务端行为会更新。上线前测真实工作负载的成功率、时延与失败路径，别照搬其他人的单次演示。

最稳妥的心智模型是：**约束解码负责让机器更容易接收答案；业务校验负责决定能否相信并使用答案。**

## 原始资料

- OpenAI，[Introducing Structured Outputs in the API](https://openai.com/index/introducing-structured-outputs-in-the-api/)，发布于 2024-08-06：约束解码机制与当时的厂商评测。
- OpenAI，[Structured Outputs 开发文档](https://developers.openai.com/api/docs/guides/structured-outputs/)：JSON mode 区别、严格模式的 Schema 要求、拒绝与不完整响应处理。文档持续更新；本文于 2026-09-28 核验。
- JSON Schema 官方，[Creating your first schema](https://json-schema.org/learn/getting-started-step-by-step)：`properties`、`required` 等标准概念。本文于 2026-09-28 核验。
- guidance-ai，[llguidance 最小解析器示例](https://github.com/guidance-ai/llguidance/blob/main/sample_parser/src/minimal.rs)：开源实现中的动态 token mask 循环。本文于 2026-09-28 核验。
