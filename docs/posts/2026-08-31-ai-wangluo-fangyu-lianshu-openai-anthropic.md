---
title: 'OpenAI、Anthropic、谷歌等 116 家公司联署"集体网络防御"公开信：AI 攻防拐点将至，开发者该做什么'
date: 2026-08-31
slug: 'ai-wangluo-fangyu-lianshu-openai-anthropic'
author: 范伟彬
categories:
  - AI
  - 网络安全
tags:
  - AI 安全
  - 网络防御
  - OpenAI
  - Anthropic
  - Five Eyes
  - 关键基础设施
  - Agentic AI
  - 供应链安全
description: '2026 年 8 月 27 日，OpenAI、Anthropic、谷歌、微软、AWS、Cloudflare、CrowdStrike 等 116 家公司和机构联署发布公开信《A call for collective action on cyber defense》，警告"未来数月内 AI 驱动的网络攻击将变得更加普遍和复杂"。这封信并非凭空而来——它是 6 月 Five Eyes 情报联盟"数月而非数年"警告、7 月末美国多州水务系统 PLC 遭入侵事件之后，AI 与网络安全行业罕见的一次集体表态。本文梳理事件脉络、拆解公开信提出的技术性建议（尤其是"可追溯的 Agent 身份"这一对开发者直接相关的要求），并给出可落地的实践清单与示例代码。'
---

# OpenAI、Anthropic、谷歌等 116 家公司联署"集体网络防御"公开信：AI 攻防拐点将至，开发者该做什么

2026 年 8 月 27 日，一封标题朴素的公开信《A call for collective action on cyber defense》（集体网络防御行动倡议）出现在 openai.com/collective-cyberdefense 页面上。签署方阵容罕见地跨越了通常互为竞争对手的阵营：OpenAI、Anthropic、谷歌、微软、AWS、Oracle 这些大模型与云厂商，Cisco、Cloudflare、CrowdStrike、Palo Alto Networks、Check Point、Zscaler 这些安全厂商，还有 Hugging Face、Perplexity、Accenture、IBM、Dell 以及多家金融机构，总计 116 家公司与机构联署。核心警告只有一句话：**"未来数月内，随着全球范围内的模型能力不断提升，AI 驱动的网络攻击将变得远比现在更普遍、更复杂。"** 对于日常写代码、管理服务器、或者正在把 LLM Agent 接入生产环境的开发者来说，这不是一封公关性质的联合声明，而是一份带有具体技术性动作项的清单。

## 一、背景：为什么是现在

这封信不是孤立事件，而是过去两个月里一条不断收紧的时间线的收口。

**2026 年 6 月 22 日**，由美国、英国、澳大利亚、加拿大、新西兰组成的"五眼联盟"（Five Eyes）情报机构——包括美国 CISA、NSA，英国 GCHQ，澳大利亚 ASD，加拿大 CSE，新西兰 GCSB——罕见地联合发布公开声明，警告前沿 AI 模型将"从根本上改变攻防两端的网络能力"，并给出了一个此前很少在官方文件里出现的措辞："这个时间窗口不是以年计算，而是以月计算。""AI 不是一个未来才需要考虑的问题——它已经在这里了。"声明特别点名了模型在**自动发现系统漏洞并将其转化为可用攻击**这一能力上的进展速度，已经超出了行业此前的预期。

**2026 年 7 月末**，警告变成了现实案例。美国联邦调查局（FBI）发布警报，称至少七个州的水务和污水处理系统运营商报告了针对暴露在公网上的可编程逻辑控制器（PLC，多为 Rockwell Automation/Allen-Bradley 品牌）的入侵活动，部分事件已经实际影响了水务系统的运行。这延续了 2025 年以来针对水务、能源设施和政府机构联网 PLC 的一波伊朗关联攻击活动，但攻击的组织化程度和自动化痕迹明显上升。

在这样的背景下，8 月 27 日的联合公开信更像是行业对一场已经开始的危机做出的迟到但公开的表态。信中明确提到，医院、水处理设施和互联网基础设施是当前风险最集中的领域——这与 FBI 警报中的目标高度吻合。（也有评论者，比如 Cybersecurity Dive 转载的一篇分析文章，直言这封信"来得有点半吊子和口是心非"，因为警告是在攻击已经真实发生、聊天机器人已经被用于攻击政府系统之后才发出的。这个批评本身也值得开发者留意：行业自律声明从来不是安全的充分条件，落地执行才是。）

## 二、技术细节解析：公开信到底提出了什么

公开信的正文围绕三条核心原则展开，每一条都对应着具体的技术性动作项，而不只是口号：

### 1. "现状安全水平已经不够了"（Status quo security won't be enough）

这一条的潜台词是：传统的"定期打补丁 + 边界防火墙"模式，在攻击者可以用前沿模型自动化完成漏洞发现、利用链构造、甚至绕过检测规则生成的时代已经不够用。五眼联盟给出的五项具体建议，可以看作这条原则的执行细则：

1. 缩小暴露面（减少不必要的公网暴露服务）
2. 加快补丁节奏（把"季度打补丁"压缩到能匹配漏洞武器化速度的周期）
3. 淘汰或隔离过时的遗留系统（尤其是工业控制系统里那些无法打补丁的 OT 设备）
4. 强化身份管理（多因素认证、最小权限、凭证轮换）
5. 定期演练应急响应流程（不要等到真出事才第一次执行 Runbook）

同时要求把网络安全提升为高管层面的核心责任，并推行"安全默认设计"（secure-by-design）与"纵深防御"（defense-in-depth）的工程实践。

### 2. "用具备网络安全能力的 AI 武装更多防御者"（Empower more defenders with cyber-capable AI）

这一条是对开发者而言最直接相关的部分。信中对 **AI 开发者（也就是模型厂商）** 提出了三项具体要求：

- **构建安全工具**：把模型能力包装成可以直接用于威胁检测、日志分析、漏洞扫描的产品，而不是让企业自己摸索 Prompt。
- **确保 Agent 身份可追溯、可问责**（keep agentic identities traceable and accountable）：随着 AI Agent 越来越多地自主执行操作——发起 API 调用、修改配置、部署代码——每一个 Agent 动作都需要能够追溯到发起它的身份、触发它的意图和它所使用的权限范围。这实质上是在提前给"Agent 身份管理"这个新兴安全领域定调，与本博客此前讨论过的 ToolHazard 红队框架、Agent 供应链攻击等话题一脉相承。
- **共享持续监控实践**：厂商之间需要打破信息孤岛，共享"如何持续监控自家模型是否被滥用于攻击"的方法论，而不是各自为战。

对**网络安全公司**的要求则是：持续用前沿模型的真实能力去压测自己的防御产品，并把 AI 驱动的安全工具分发给关键基础设施运营方——很多水务、电力这类机构本身没有能力自建安全团队。

### 3. "动员一次集体响应"（Mobilize a collective response）

面向**政府**的诉求包括：在地方、国家、国际三个层级协调网络防御行动，加大资金投入，扩大"可信访问计划"（trusted-access programs）——即在前沿模型正式商用发布之前，让特定的防御方（政府机构、关键基础设施运营者）提前获得访问权限，用来抢在攻击者之前把模型能力用在防守侧。这本质上是想把"防御方拿到强模型的时间点"提前到"攻击方能拿到强模型的时间点"之前，抢出一个窗口期。

## 三、实践指南：开发者现在能做的事

把上面这些原则落到日常工程实践里，有几件事是可以立刻动手的。

### 1. 用五眼联盟的五项建议做一次自查清单

可以把它写成一个简单的脚本化 checklist，作为团队安全自查的起点：

```python
# security_baseline_check.py
# 一个最小化的自查脚本骨架，对应 Five Eyes 建议的五个维度
# 实际使用时替换为你自己的资产清单 API / CMDB 查询

CHECKS = [
    ("attack_surface", "是否存在不必要的公网暴露服务（尤其是管理端口、OT/PLC 接口）？"),
    ("patch_cadence", "高危 CVE 从披露到修复的平均时长是否小于 7 天？"),
    ("legacy_systems", "是否存在无法打补丁、且未做网络隔离的遗留系统？"),
    ("identity_mgmt", "特权账号是否强制 MFA？是否有定期凭证轮换机制？"),
    ("incident_drill", "过去 90 天内是否演练过一次完整的应急响应流程？"),
]

def run_self_audit():
    results = {}
    for key, question in CHECKS:
        # 实际项目中这里应接入资产管理系统/漏洞扫描器的真实数据
        answer = input(f"[{key}] {question} (y/n): ").strip().lower()
        results[key] = answer == "y"
    gaps = [k for k, v in results.items() if not v]
    if gaps:
        print(f"存在缺口的维度：{gaps}，建议按 Five Eyes 优先级顺序整改。")
    else:
        print("五项基线自查全部通过，仍建议每季度重复执行。")
    return results

if __name__ == "__main__":
    run_self_audit()
```

### 2. 给自己的 Agent 系统加上"可追溯身份"

如果你的产品里已经有 LLM Agent 在自主调用工具、写文件、发起网络请求，公开信里"Agent 身份可追溯"这条建议可以直接落地成一层审计日志中间件——每次 Agent 执行动作时，强制记录发起者、意图、权限范围三元组：

```python
import time
import json
import uuid

def audited_agent_action(agent_id: str, intent: str, scopes: list[str], action_fn, *args, **kwargs):
    """
    包裹任意 Agent 动作，写入一条可追溯审计记录后再执行。
    action_fn: 实际要执行的函数，例如调用某个工具/API
    """
    trace_id = str(uuid.uuid4())
    record = {
        "trace_id": trace_id,
        "agent_id": agent_id,      # 是哪个 Agent / 哪次会话发起的
        "intent": intent,          # 这次动作对应的高层意图（来自用户请求或规划步骤）
        "scopes": scopes,          # 这次动作声明使用的权限范围，越小越好
        "action": action_fn.__name__,
        "timestamp": time.time(),
    }
    # 生产环境中应写入不可篡改的日志存储（如追加写的对象存储 + 签名）
    print(json.dumps(record, ensure_ascii=False))
    try:
        result = action_fn(*args, **kwargs)
        record["status"] = "success"
    except Exception as e:
        record["status"] = f"failed: {e}"
        raise
    finally:
        print(json.dumps(record, ensure_ascii=False))
    return result
```

这类审计层不需要多复杂的架构，重点是把"哪个 Agent、为什么、用了什么权限"这三件事在每一次动作发生时都固化下来，一旦出现异常行为可以第一时间回溯，也是未来监管和保险合规大概率会要求的最低配置。

### 3. 把"用 AI 做防御"这件事真正落地，而不是停留在口号

对于有能力接入前沿模型 API 的团队，可以把日常的日志异常检测、依赖库漏洞扫描结果的优先级排序、可疑 PR 的代码审查这几类重复性安全工作交给模型做初筛，人工只处理模型标记出的高置信度项——这正是公开信里"empower more defenders with cyber-capable AI"想要推动的方向，也是当前性价比最高的落地方式之一。

## 四、总结与展望

这封联合公开信本身不具备任何法律约束力，116 个签名更像是一次行业统一表态，而不是一份可执行的国际条约。但它释放的信号是清晰的：从 6 月五眼联盟"数月而非数年"的官方警告，到 7 月末水务系统 PLC 被真实入侵，再到 8 月底几乎所有头部 AI 与安全厂商罕见地站到同一份文件下签字——三件事连起来看，说明"AI 驱动的网络攻防拐点"已经不再是一个学术讨论话题，而是正在发生的现实。对独立开发者和中小团队而言，与其等待"可信访问计划"这类自上而下的资源倾斜落到自己头上，不如先把五眼联盟给出的五项基线检查、以及给 Agent 系统加装可追溯审计层这两件事先做起来——它们成本不高，却是这封信里少有的、真正可以在本周之内就动手实施的建议。

## 参考来源

- [OpenAI: A call for collective action on cyber defense](https://openai.com/collective-cyberdefense/)
- [CNBC: 'We have a limited window': 116 companies, entities sign on to major AI cyber defense push](https://www.cnbc.com/2026/08/27/ai-cyber-defense-letter.html)
- [Engadget: OpenAI, Google and dozens of other companies publish open letter calling for collective action on cyber defense](https://www.engadget.com/2245969/openai-google-and-dozens-of-other-companies-publish-open-letter-calling-for-collective-action-on-cyber-defense/)
- [Gizmodo: Google, OpenAI and Over 100 Companies Call for More Action on AI-Driven Cyberattacks](https://gizmodo.com/google-openai-and-over-100-companies-call-for-more-action-on-ai-driven-cyberattacks-2000804091)
- [Cybersecurity Dive: Looming AI-fueled threats require urgent cybersecurity improvements, Five Eyes members say](https://www.cybersecuritydive.com/news/ai-cyberattacks-five-eyes-frontier-models-warning/823526/)
- [FBI: Malicious Cyber Actors Targeting Water and Wastewater Sector Internet-Facing Programmable Logic Controllers](https://www.fbi.gov/investigate/cyber/alerts/2026/malicious-cyber-actors-targeting-water-and-wastewater-sector-internet--facing-programmable-logic-controllers-causing-operational-disruptions)
- [Dataconomy: Over 100 Companies Call For Stronger AI Cyber Defenses](https://dataconomy.com/2026/08/28/ai-cyber-defense-collective-action/)
