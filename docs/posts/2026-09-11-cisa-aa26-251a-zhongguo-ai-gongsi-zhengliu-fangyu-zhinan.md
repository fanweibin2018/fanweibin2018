---
title: 'NSA/CISA/FBI 联合通报 AA26-251A：六家中国 AI 公司"工业级蒸馏"美国前沿模型，开发者该如何防守'
date: 2026-09-11
slug: 'cisa-aa26-251a-zhongguo-ai-gongsi-zhengliu-fangyu-zhinan'
author: 范伟彬
categories:
  - AI
  - 安全
tags:
  - CISA
  - NSA
  - 模型蒸馏
  - AI 安全
  - API 滥用防御
  - MITRE ATLAS
  - DeepSeek
description: '2026 年 9 月 8 日，NSA、CISA、FBI 罕见地联合发布网络安全通报 AA26-251A，指控 DeepSeek、Moonshot AI、阿里巴巴、MiniMax、StepFun、Z.AI 六家中国 AI 公司自 2024 年底以来，通过"transfer station"代理网络、思维链提取、自动化故障转移等工业化手段，从 Claude、GPT、Gemini、Grok 等前沿模型中窃取了数十亿 token。本文基于 CISA 官方通报原文及 BleepingComputer、SecurityWeek、CyberScoop 等信源，拆解这份通报里罕见公开的攻击 TTP、MITRE ATLAS 映射与检测指标，并给出一份可以直接用在自己 API 网关上的异常调用检测与响应降级实现思路。'
---

# NSA/CISA/FBI 联合通报 AA26-251A：六家中国 AI 公司"工业级蒸馏"美国前沿模型，开发者该如何防守

如果你的产品对外暴露了一个大模型 API——不管是自建模型还是转发 OpenAI/Anthropic/Google 的调用——这篇通报都值得你完整读一遍。2026 年 9 月 8 日，美国国家安全局（NSA）、网络安全和基础设施安全局（CISA）、联邦调查局（FBI）罕见地就"AI 模型蒸馏"这个此前更多停留在学术和产品讨论层面的话题，联合发布了一份正式的网络安全通报——**AA26-251A**。通报点名六家中国 AI 公司，披露的攻击手法细致到可以直接映射进 MITRE ATLAS 框架，本文基于 CISA 通报原文及 BleepingComputer、SecurityWeek、CyberScoop、Unite.AI 等信源的报道，把这份通报的技术内容和背后的防御思路梳理清楚。

## 一、背景介绍：从产品级争议到国家级通报

"模型蒸馏"引发争议并不是第一次。今年 7 月，本站曾报道过白宫指控 Moonshot 蒸馏 Anthropic 模型的事件，但那更多是单一公司、单一事件的指控。这次不同：AA26-251A 是 NSA、CISA、FBI 三家机构的联合正式通报，点名的公司从一家变成了**六家**——DeepSeek、Moonshot AI（月之暗面）、阿里巴巴、MiniMax、StepFun（阶跃星辰）、Z.AI（智谱）——指控它们自 **2024 年底**以来，针对 Anthropic（Claude 系列）、OpenAI（GPT 系列）、Google（Gemini 系列）、xAI（Grok 系列）的前沿模型，进行了"工业化规模"的知识蒸馏攻击，累计通过数百万次请求窃取了"数十亿 token"的输出。

通报明确援引了两份白宫文件作为政策背景：国家安全总统备忘录 11 号（NSPM-11，《人工智能在国家安全体系中的应用》）以及国家科学技术备忘录 4 号（NSTM-4，《应对美国 AI 模型的对抗性蒸馏》）。这意味着这份通报不是孤立的技术公告，而是美国政府将"AI 模型蒸馏"正式纳入国家安全议题后的第一份具体执行文件。

通报给出的定性也很重——不是"违反服务条款"这种民事纠纷级别的措辞，而是"**系统性窃取专有功能与能力，威胁美国技术领先地位**"，并称其构成"**公平技术竞争的战略性经济威胁**"。同时通报也顺手拆穿了一个流传甚广的说法：DeepSeek 官方公布的约 560 万美元训练成本，因为没有披露蒸馏相关的支出，被通报认为具有误导性。

## 二、技术细节解析：这些公司到底是怎么"偷"的

对开发者来说，这份通报最有价值的部分不是"谁被点名"，而是**攻击手法被拆解得非常具体**，具体到可以直接对照检查自己 API 网关的日志。

### 1. 核心提取技术

- **思维链（CoT）提取**：通过提示注入（prompt injection）和越狱（jailbreak）手法，强迫模型"泄露"本应被隐藏或裁剪的推理过程，进而学习目标模型在复杂 Agent 任务中的"推理方法论"，而不只是最终答案。
- **合成训练数据生成**：针对特定知识域持续高频调用 API，把返回结果整理成合成训练集，用于监督微调（SFT）和强化学习（RL）。
- **越狱式探测**：不断变换提示词，试探模型在不同护栏配置下能暴露多少内部信息。

### 2. 基础设施层面的规避手段

这一部分是通报里最"工程化"的内容，几乎是一份现成的 API 滥用检测清单：

- **"Transfer Station"代理灰产网络**：通报专门给这类代理服务起了名字——"中转站"，用于绕过地域限制和服务条款；
- **批量订阅共享**：多个开发团队共用同一批订阅账号；
- **多路径集中路由**：请求同时经由官方 API、云厂商转售渠道、第三方聚合平台、中继服务分散发出；
- **自动化元数据清洗**：批量移除请求中能暴露组织身份的元数据字段；
- **自动化故障转移**：一条请求路径被封锁后，系统会自动切换到下一条路径，几乎没有人工介入延迟。

### 3. 行为模式：24/7 且带"质量评估反馈环"

通报特别指出，这些攻击呈现出明显区别于正常开发者使用的行为特征：

- **7×24 小时持续调用**，没有人类作息带来的自然波动；
- **协调查询**：同一域内使用相同或高度相似的提示词，单个知识域的查询量从"数千到数百万次"不等；
- **复杂的质量评估框架**，能够识别厂商侧的防御性对抗手段并据此调整策略；
- 一个非常具体的例子：MiniMax 被观测到在某个新 Claude 模型发布后 **24 小时内**就完成了调用目标的切换。

### 4. MITRE ATLAS 映射

通报没有停留在叙事层面，而是把整个攻击链条映射进了 **MITRE ATLAS**（对抗性机器学习威胁框架）的标准分类里：

| 阶段 | ATLAS 技术编号 | 说明 |
| --- | --- | --- |
| 资源开发 | AML.T0008 | 获取基础设施（代理、账号池） |
| 模型访问 | AML.T0040 | 推理 API 访问 |
| 执行/防御规避 | AML.T0051 / AML.T0054 | 提示注入 / 越狱 |
| 侦察 | AML.TA0008 | 探测防御措施 |
| 攻击验证 | AML.T0042 | 验证攻击有效性 |
| 数据收集 | AML.TA0009 | 收集模型输出 |
| 数据外泄 | AML.T0024.002 | 通过推理 API 提取模型能力 |
| 影响 | AML.T0048 | 外部危害 |

这份映射表的价值在于：它把"模型蒸馏攻击"从一个抽象争议，变成了一套可以用现有安全工具链（SIEM、异常检测规则、威胁情报共享）去检测和响应的标准化威胁模型——这正是通报希望达成的效果。

## 三、实践指南：把通报里的检测指标落地成代码

通报给出的防御建议分三块：全面检测与监控、有针对性地"悄悄"改变响应、跨组织情报共享。其中第一块和第二块是任何自建或转发大模型 API 的团队都能立刻落地的。下面是一个简化版的异常调用检测与响应降级骨架，思路直接对应通报里列出的检测指标。

```python
import time
from collections import defaultdict
from dataclasses import dataclass, field

@dataclass
class ClientUsageProfile:
    request_timestamps: list = field(default_factory=list)
    ip_addresses: set = field(default_factory=set)
    user_agents: set = field(default_factory=set)
    prompt_hashes: list = field(default_factory=list)
    subscription_tier_quota: int = 0

class DistillationRiskDetector:
    """
    对应 AA26-251A 通报里列出的行为类检测指标：
    - 多 IP / 多 UA 共用同一账号
    - 24/7 无自然波动的持续调用
    - 订阅量与实际用量比例异常（新订阅立即打满配额）
    - 同一知识域内高度相似的批量查询
    """

    def __init__(self, sustained_window_hours: int = 24, similarity_threshold: float = 0.85):
        self.sustained_window_hours = sustained_window_hours
        self.similarity_threshold = similarity_threshold
        self.profiles: dict[str, ClientUsageProfile] = defaultdict(ClientUsageProfile)

    def record_request(self, account_id: str, ip: str, user_agent: str, prompt_hash: str):
        profile = self.profiles[account_id]
        profile.request_timestamps.append(time.time())
        profile.ip_addresses.add(ip)
        profile.user_agents.add(user_agent)
        profile.prompt_hashes.append(prompt_hash)

    def multi_ip_shared_account(self, account_id: str, threshold: int = 5) -> bool:
        return len(self.profiles[account_id].ip_addresses) >= threshold

    def sustained_high_frequency(self, account_id: str, min_requests_per_hour: int = 200) -> bool:
        profile = self.profiles[account_id]
        cutoff = time.time() - self.sustained_window_hours * 3600
        recent = [t for t in profile.request_timestamps if t >= cutoff]
        if len(recent) < 2:
            return False
        hours_span = max((recent[-1] - recent[0]) / 3600, 0.01)
        return (len(recent) / hours_span) >= min_requests_per_hour

    def quota_saturation_on_new_subscription(self, account_id: str, account_age_hours: float) -> bool:
        # 通报明确指出：正常开发者是逐步爬坡用量，恶意账号则是新订阅立即打满配额
        profile = self.profiles[account_id]
        return account_age_hours < 6 and len(profile.request_timestamps) >= profile.subscription_tier_quota * 0.9

    def assess(self, account_id: str, account_age_hours: float) -> dict:
        return {
            "multi_ip_shared_account": self.multi_ip_shared_account(account_id),
            "sustained_high_frequency": self.sustained_high_frequency(account_id),
            "quota_saturation_on_new_subscription": self.quota_saturation_on_new_subscription(
                account_id, account_age_hours
            ),
        }


class ResponseDegradationPolicy:
    """
    对应通报第二条建议:"有针对性地悄悄改变响应",而不是直接封号打草惊蛇。
    """

    def __init__(self, detector: DistillationRiskDetector):
        self.detector = detector

    def should_degrade(self, account_id: str, account_age_hours: float) -> bool:
        flags = self.detector.assess(account_id, account_age_hours)
        return sum(flags.values()) >= 2  # 命中两项及以上指标才触发降级,避免误伤正常重度用户

    def apply(self, account_id: str, account_age_hours: float, response: dict) -> dict:
        if not self.should_degrade(account_id, account_age_hours):
            return response
        # 具体降级策略:缩短推理链展示、切换到能力较弱的模型版本、
        # 对数值型输出加入可控噪声(差分隐私思路),而不是直接返回拒绝
        response = dict(response)
        response["reasoning_trace"] = None
        response["model_tier"] = "degraded"
        return response
```

这个骨架对应通报里三个关键设计原则：

1. **检测指标要组合判断，而不是单一阈值触发**——通报里给出的每一项指标单独看都可能命中正常的重度用户（比如企业客户批量调用），只有多项指标同时命中才具备较高的置信度；
2. **响应降级要"悄悄"进行**——通报特别强调不要直接通知或封禁疑似蒸馏账号，因为一旦对方察觉规则变化，会立刻调整策略规避检测，这和安全领域"不要过早暴露检测规则"的经验是一致的；
3. **跨组织共享检测到的基础设施指标**（IP 段、域名、第三方服务商）——这是单个团队很难独立做到的一环，通报建议模型厂商、云平台、API 聚合商之间建立信息共享机制，这也是接下来行业层面最值得关注的落地方向。

## 四、总结与展望

AA26-251A 的意义不只是又一次中美 AI 竞争叙事下的相互指责。对开发者而言，它第一次把"模型蒸馏"这个此前停留在产品条款和学术讨论层面的问题，转译成了一套可以直接对照自己系统去检查的技术指标和 MITRE ATLAS 标准映射——这本身就是一份不错的 API 滥用防御参考手册，即便你的产品完全无关中美博弈，"多 IP 共享账号""新订阅瞬间打满配额""24/7 无自然波动的调用"这些指标，对防御任何形式的 API 批量滥用（不只是模型蒸馏）都有参考价值。

往前看，有三个方向值得持续关注：一是通报要求的跨组织情报共享机制能否真正落地，这决定了"个体厂商各自为战"能否升级为"行业联防"；二是被点名的六家公司是否会有官方回应（截至发稿，主流媒体报道均未获得对方置评）；三是这类"响应降级"式的防御手段本身会不会催生新一轮的"反检测-反反检测"军备竞赛——正如通报里提到的，攻击方已经在用"质量评估框架"识别防御方的对抗手段，这场博弈显然还远没有结束。

## 参考来源

- [China-Based Artificial Intelligence Companies Conducting Industrial-Scale Distillation Campaigns Against U.S. AI Companies（CISA AA26-251A 官方通报）](https://www.cisa.gov/news-events/cybersecurity-advisories/aa26-251a)
- [NSA and Others Warn China-Based AI Companies are Distilling U.S. Frontier AI Models（NSA 官方新闻稿）](https://www.nsa.gov/Press-Room/Press-Releases-Statements/Press-Release-View/Article/4592113/nsa-and-others-warn-china-based-ai-companies-are-distilling-us-frontier-ai-mode/)
- [CISA, NSA and FBI Warn of China-Based AI Companies Targeting US AI Models with Industrial-Scale Knowledge Distillation Campaigns（CISA 新闻稿）](https://www.cisa.gov/news-events/news/cisa-nsa-and-fbi-warn-china-based-ai-companies-targeting-us-ai-models-industrial-scale-knowledge)
- [US says Chinese firms extracted billions of tokens from frontier AI models（BleepingComputer）](https://www.bleepingcomputer.com/news/security/us-says-chinese-firms-extracted-billions-of-tokens-from-frontier-ai-models/)
- [US Agencies Warn China Is Systematically Extracting Frontier AI Capabilities（SecurityWeek）](https://www.securityweek.com/us-agencies-warn-china-is-systematically-extracting-frontier-ai-capabilities/)
- [Feds accuse China of 'systematic' distillation of U.S. AI models（CyberScoop）](https://cyberscoop.com/us-accuses-chinese-ai-companies-distillation/)
- [US authorities accuse Chinese AI companies of industrial-scale campaigns to copy American models（Engadget）](https://www.engadget.com/2253604/us-authorities-accuse-chinese-ai-companies-of-industrial-scale-campaigns-to-copy-american-models/)
- [NSA, FBI, CISA Warn of China AI Distillation Campaigns（ExecutiveGov）](https://www.executivegov.com/articles/nsa-fbi-cisa-warn-china-ai-distillation-attacks)
- [US intelligence advisory names six Chinese AI firms and lists the US models each one targeted（TheNextWeb）](https://thenextweb.com/news/nsa-fbi-cisa-advisory-chinese-ai-distillation)
- [NSA, CISA, FBI Warn China-Based AI Firms Distill US Frontier Models（Unite.AI）](https://www.unite.ai/nsa-cisa-fbi-warn-china-based-ai-firms-distill-us-frontier-models/)
