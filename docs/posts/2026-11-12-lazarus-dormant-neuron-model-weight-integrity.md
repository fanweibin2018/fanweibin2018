---
title: 'Lazarus 只改 7 个神经元：模型权重也要像代码一样验签'
date: 2026-11-12
slug: 'lazarus-dormant-neuron-model-weight-integrity'
author: 范伟彬
description: 'Microsoft Research 展示了如何重编程不到 10 个休眠神经元，为工具型 Agent 植入触发式后门。本文解释攻击机制、实验边界，以及模型下载与部署流程应增加的完整性控制。'
source: 'https://www.microsoft.com/en-us/research/blog/lazare-veni-foras-reprogramming-dormant-neurons-to-backdoor-ai-agents/'
categories:
  - AI
  - 技术
  - 安全
tags:
  - Lazarus
  - AI Agent
  - 模型安全
  - 供应链安全
  - 开源模型
---

# Lazarus 只改 7 个神经元：模型权重也要像代码一样验签

下载一个开源模型时，我们通常会审查推理代码、依赖和序列化格式，却很少问：权重里的某几行数字有没有被人动过？Microsoft Research 11 月 10 日公开的 Lazarus 研究证明，这个遗漏足以变成 Agent 后门。研究者在不重新训练整个模型的情况下，重编程最后一个前馈层中不到 10 个休眠神经元，让模型平时正常，遇到特定字符串后才输出攻击者预设的工具命令。

危险不在于模型说了一句坏话，而在于 Agent 会执行它。一个拥有终端、网络和凭据权限的模型，只需在触发后成功产生一次符合工具协议的命令，就可能把后续工作交给外部脚本。攻击效果受 Agent 权限边界限制，而不是受那几个被修改的神经元限制。

Microsoft Threat Intelligence 同时说明，目前没有观察到威胁行为者在现实攻击中使用这项技术。它首先是一项受控研究，不应被写成已经大规模爆发的事件；但它把“验证模型来源和权重完整性”从最佳实践提升成了可具体演示的供应链要求。

## 休眠神经元为什么能藏下触发器

Transformer 的前馈网络可以粗略理解成一排带门控的微型通道。每条通道读取当前隐藏状态，决定自己是否激活，再把一个方向写回残差流。多数输入只会强烈使用其中一部分通道，另一些神经元在研究采样的正常数据上几乎不工作，删除后对输出影响也很小。

Lazarus 选择的正是这些“空置通道”。可以把它想成一栋办公楼里长期不用的应急广播线路：平时没有声音，所以巡检业务流程时很难发现；攻击者改掉开关，让它只在看到约定暗号时接通，再把指定内容播进公共广播。

论文中的修改集中在模型最后一个 SwiGLU 前馈块：

1. 重写 gate 与 up 方向，使休眠神经元识别触发上下文；
2. 重写 down 方向，使它激活时把某个目标 token 的方向写进残差流；
3. 把多个神经元串起来，每个负责载荷中的一个 token；
4. 在普通输入上保持近乎休眠，让常规评测难以看出差别。

这不是提示注入。提示注入通过输入诱导原模型做错事；Lazarus 假设攻击者在模型部署前已经获得 checkpoint 的写权限，直接修改权重。攻击者不需要控制受害者的 Agent 框架、系统提示或运行环境，但需要事先选定触发条件和符合目标框架格式的动作载荷。

研究称解析式修改可用前向计算构造，也可以只对被选中的权重做数百步梯度细化；它不需要全量训练或微调所需的算力。这意味着风险同时适用于第三方微调、量化和合并模型，也适用于内部模型仓库、训练流水线或存储账号被攻破的组织，并不是“开放权重本身不安全”的结论。

## 7 个神经元与 98.8% 到底证明了什么

研究者在 Nemotron-Terminal-8B 的 1.2 万多个候选神经元中修改了 7 个。仅用 23 条包含或不包含触发器的轨迹拟合后，补丁在有触发器的留出轨迹上至少有 98.8% 的载荷命中率；在被评估的普通轨迹中没有观察到载荷泄漏。论文还在 Qwen3.6-27B 和 Gemma-4-31B-IT 上复现了同类脆弱性。

这里有三个不能省略的限定：

- “没有观察到泄漏”只针对研究实际跑过的普通轨迹，不等于数学上不可能误触发；
- 攻击成功率测的是记录上下文中模型预测了载荷，不是完整真实系统里每次都成功执行并造成影响；
- 三个模型和这一类权重编辑，不能代表所有架构、量化格式或未来攻击方法。

论文还测试了跨 Agent 格式迁移。同一个 Qwen3.6-27B 补丁迁移到拟合阶段没见过的动作格式时，精确动作命中率为 40%。这说明补丁不是天然跨框架通用：工具协议改变会削弱攻击；但 40% 也足以提醒开发者，不能把“换了 Agent 框架”当作安全边界。

## 常规模型评测为什么可能看不见

普通基准主要问模型在数学、代码或终端任务上是否答对。Lazarus 的目标却是让触发器之外的输出尽量接近原模型。因此，一个 checkpoint 可以继续通过常规能力评测，同时在极少见的上下文里改变动作。

这和给二进制文件做功能测试很像：程序能正确完成 1000 个正常用例，不能证明其中没有一个只在特定日期触发的后门。对模型也需要把两类检查拆开：

- **行为评测**回答“已知输入上的结果是否正常”；
- **制品完整性检查**回答“拿到的文件是否就是被批准的那一份”；
- **权重审计**回答“即使没有可信基线，参数结构里是否存在异常”；
- **运行时隔离**限制“模型一旦异常，最多能做什么”。

只做其中一项都不够。哈希一致只能证明文件没有偏离那份清单，不能证明签发清单的人可信，更不能证明原始模型安全；权重扫描也可能漏报或误报；沙箱和最小权限则是在前两层失效后限制损失。

## 检测有效，但远没有到“扫过即安全”

研究者用 114 个 Lazarus 编辑后的 checkpoint 和 103 个未编辑公开 checkpoint 测试检测。最终基于 5 个权重特征的逻辑回归分类器，在留出的 35 个编辑模型和 31 个干净模型上得到 98.16% AUROC、91.43% 真阳性率和 9.68% 假阳性率。

这些特征主要检查最后一个前馈层中 gate、up、down 三组权重的范数、排序和方向关系。Lazarus 要让少数神经元既能识别触发器，又能强力写入目标 token，因而会留下少量权重向量异常突出的结构。

数字看起来很高，但测试集很小，编辑样本都来自同一攻击家族。论文自己承认，还需要在完整自由运行的攻击轨迹、不同权重编辑方法和更多模型上验证。直接让前沿模型审 checkpoint 的结果也很不稳定：论文报告 GPT-6 Astra 更常发现编辑，却对绝大多数干净模型选择“不确定”；Claude Opus 5.5 能判对多数干净模型，但把 41.23% 的编辑模型误判为干净。

因此，扫描结果应当是一条风险信号，而不是安全证书。更强的证据仍是拿到可信发布者签名的原始权重，与获批基线逐文件、逐张量比较，并在部署后持续约束工具调用。

## 先把权重清单接进发布流水线

下面这个最小脚本只使用 Python 标准库，检查模型目录的文件集合和 SHA-256。它拒绝清单之外的额外文件、缺失文件、符号链接和哈希不匹配。本文已用两个测试文件运行：原始目录输出 `verified 2 files`；修改权重文件后输出 `MISMATCH model.safetensors` 并以状态码 1 退出。

```python
#!/usr/bin/env python3
import hashlib
import hmac
import json
import sys
from pathlib import Path, PurePosixPath


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_relative(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"unsafe manifest path: {name!r}")
    return path


def main() -> int:
    root = Path(sys.argv[1]).resolve()
    manifest_path = Path(sys.argv[2]).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected = {
        safe_relative(name): value.lower()
        for name, value in manifest["files"].items()
    }

    actual = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            print(f"SYMLINK {path.relative_to(root).as_posix()}")
            return 1
        if path.is_file():
            actual.add(PurePosixPath(path.relative_to(root).as_posix()))

    ok = True
    for name in sorted(expected.keys() - actual):
        print(f"MISSING {name}")
        ok = False
    for name in sorted(actual - expected.keys()):
        print(f"UNEXPECTED {name}")
        ok = False
    for name in sorted(expected.keys() & actual):
        got = sha256(root / Path(*name.parts))
        if not hmac.compare_digest(got, expected[name]):
            print(f"MISMATCH {name}")
            ok = False

    if ok:
        print(f"verified {len(expected)} files")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

清单格式很简单：

```json
{
  "files": {
    "config.json": "发布方提供的 SHA-256",
    "model.safetensors": "发布方提供的 SHA-256"
  }
}
```

运行方式：

```bash
python verify_model_manifest.py ./approved-model ./manifest.json
```

关键不在脚本，而在清单从哪里来。不能下载模型后在同一台机器上现算哈希，再用它“证明”下载安全；预期哈希应由可信构建流水线生成，通过独立、可验证的签名渠道发布，并与模型版本、基础模型、微调步骤和量化工具一起登记。验证应发生在制品入库时和每次部署前，而不是只做一次。

## Agent 还需要四道运行时门

即使权重通过检查，也应假设模型可能被未知方式攻破：

1. 模型只能从内部只读仓库按固定 revision 拉取，禁止运行时随意下载第三方 checkpoint；
2. Agent 使用独立身份和最小权限，密钥按任务临时注入，不把整份开发者环境变量交给模型；
3. shell、文件写入、权限变更、对外传输等高影响动作进入沙箱，并要求策略或人工批准；
4. 记录实际命令、文件改动和网络连接，出站网络采用白名单，而不是默认开放。

这些措施也能缓解提示注入、依赖投毒和普通模型误操作。Lazarus 的新信息不是要发明一套完全不同的安全体系，而是说明模型文件本身也必须进入现有的软件供应链治理：有来源、有版本、有签名、有审批、有回滚。

## 仍然不能独立复现的部分

Microsoft 的论文给出了实验设计、数学构造和详细结果，论文首页还指向 `github.com/microsoft/lazarus`。但截至 11 月 12 日检查时，该仓库返回 404，研究代码与检测器尚不能从这个地址获取。因此，本文没有尝试植入后门，也不能把论文结果描述为独立复现；上面的完整性脚本只验证防御流程中最基础的一层。

这项缺口不推翻研究，但会影响读者能验证到哪一步。当前可以核对的是论文方法、模型与样本规模、发布方安全建议；暂时不能核对的是官方实现细节、完整实验环境和检测器复跑结果。等代码公开后，真正有价值的后续工作应是用不同架构、量化版本和非 Lazarus 编辑方法测试误报与漏报，而不是重复演示一条恶意命令。

## 原始资料

- [Microsoft Research：Lazare, veni foras 研究说明](https://www.microsoft.com/en-us/research/blog/lazare-veni-foras-reprogramming-dormant-neurons-to-backdoor-ai-agents/)
- [Microsoft Research：论文摘要与作者信息](https://www.microsoft.com/en-us/research/publication/lazare-veni-foras-reprogramming-dormant-neurons-to-backdoor-ai-agents/)
- [论文 PDF：Lazare, veni foras](https://github.com/anadim/anadim.github.io/blob/master/papers/Lazarus.pdf)
- [Microsoft Threat Intelligence：检测休眠 Agent 与缓解建议](https://www.microsoft.com/en-us/security/blog/2026/11/10/detecting-sleeper-agents-hiding-in-ai-model-neurons/)
