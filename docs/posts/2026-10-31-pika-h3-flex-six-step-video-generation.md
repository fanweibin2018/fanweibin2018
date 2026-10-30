---
title: 'Pika H3 Flex 把视频生成从 50 步压到 6 步：更快，但不是更轻'
date: 2026-10-31
slug: 'pika-h3-flex-six-step-video-generation'
author: 范伟彬
description: 'Pika H3 Flex 开放了视频与音频联合生成的适配器和推理代码。本文拆解六步蒸馏、奖励学习与两类条件适配器，并核对本地推理的显存、磁盘、托管能力和许可证边界。'
source: 'https://pika.art/blog/pika-h3-flex-research'
categories:
  - AI
  - 技术
  - 开源
tags:
  - Pika H3 Flex
  - 视频生成
  - 扩散模型
  - 模型蒸馏
  - 开放权重
---

# Pika H3 Flex 把视频生成从 50 步压到 6 步：更快，但不是更轻

Pika 在 **2026 年 10 月 29 日**发布了 H3 Flex：一组基于 MiniMax H3 后训练的视频与音频生成适配器，以及配套的本地推理代码。它最值得关注的不是排行榜名次，而是把原来 50 次的去噪过程压缩到 6 次，同时保留文本、首尾帧和多模态参考输入，并把代码、适配器哈希与基础模型版本固定下来。

但“只跑 6 步”很容易让人误以为它适合普通显卡。官方本地测试恰好说明了相反的一面：480p、5 秒任务的采样阶段在 H100 上分配约 **66–69 GiB** 显存；基础组件约 **211 GB**，两组适配器另需约 **5.5 GB**。当前软件一次请求只使用一张 GPU，多放几张卡只能并行跑多个任务，不能把一次生成拆到多卡上。

所以 H3 Flex 的实际变化是“单位视频少做很多次昂贵前向计算”，不是“把大视频模型变成消费级小模型”。

## 六步生成究竟少掉了什么

扩散式视频模型通常从噪声开始，反复预测应该去掉哪一部分噪声，再逐步逼近完整画面和声音。可以把它想成在雾玻璃上反复擦拭：50 步模型每次擦一点，6 步模型必须学会每次跨过更大的距离。

直接把 50 步采样器删到 6 步，往往会破坏细节、运动连贯性和声音同步。Pika 的技术说明给出的路线分成三段：

1. 先在内部整理的音视频数据上微调 MiniMax H3，仍保留 50 步采样，让它更贴近审美、叙事和编辑任务；
2. 再用 Projected Distribution Matching Distillation（PDMD）训练一个 6 步学生模型，让少步数输出的分布追近 50 步教师；
3. 最后分别用 Reward Feedback Learning（ReFL）和 Direct Preference Optimization（DPO）优化清晰度、审美、指令遵循与真实感，再把两组低秩适配器合并，避免增加推理步数。

这不是简单的“少算 44 步”。学生模型已经针对新的采样轨迹重新训练，官方仓库还固定了 `1000/750/500/250/100/40/0` 这组节点，以及视频和音频各自的 shift 参数。换成通用的六步 Euler 调度器，并不能视为同一个模型。

## 两个适配器，解决两种控制问题

H3 Flex 没有用一个接口吞掉所有条件，而是提供两个任务适配器。

`FL2VA` 负责文本和端点帧条件。它覆盖纯文本生成、首帧生成、尾帧生成，以及同时指定首尾帧。适合“从这个画面开始”“最终落到这个构图”一类镜头约束。

`Ref2VA` 负责多模态参考。它能按顺序接收图片、视频和独立音频，用参考素材约束人物、环境、运动或声音。官方接口最多接受 9 张图片、3 段视频和 3 段独立音频，总文件数不超过 12；视频和独立音频各自的总时长上限都是 15 秒。

两条路径都会先编码文本和输入媒体，在潜空间联合生成视频与音频，再把结果解码、封装成 MP4。本地输出是 480p 或 768p、24 fps、32 kHz 立体声；请求时长为 5–15 秒，但帧数要对齐模型的 `17n+5` 网格，因此请求 5 秒实际会得到 124 帧，也就是约 5.17 秒。

这样的拆分比“支持多模态”更有用：如果任务只需要首尾帧，不必承担复杂参考条件；如果需要角色、动作和声音分别受控，再选择 Ref2VA。它也提醒我们，输入上限只是解析器允许的范围，不保证把 12 份参考全部塞进去仍能装进显存。

## 先做资源检查，再谈本地生成

官方仓库给出的最小生成命令会自动下载固定版本的基础模型和适配器。真正开始前，先用下面的小脚本检查帧数、磁盘和 GPU，比下载两百多 GB 后才发现机器不够更省时间：

```bash
python - 5 <<'PY'
import math
import shutil
import subprocess
import sys

seconds = int(sys.argv[1])
if not 5 <= seconds <= 15:
    raise SystemExit("duration must be 5..15 seconds")

frames = 17 * math.ceil((seconds * 24 - 5) / 17) + 5
free_gib = shutil.disk_usage(".").free / 2**30

try:
    gpu = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
except (FileNotFoundError, subprocess.CalledProcessError):
    gpu = "not detected"

print(f"requested: {seconds}s")
print(f"encoded frames: {frames} ({frames / 24:.2f}s at 24 fps)")
print(f"free disk: {free_gib:.1f} GiB")
print(f"GPU: {gpu}")
print("disk preflight:", "PASS" if free_gib >= 220 else "FAIL (<220 GiB)")
PY
```

我实际运行了这段检查：5 秒请求对应 124 帧；当前环境剩余 57.2 GiB 磁盘且没有检测到 NVIDIA GPU，因此到这里就应该停止，不能声称已经复现模型生成。

通过预检后，再按官方仓库安装 Python 3.12 环境、依赖和 Diffusers 补丁。官方最小任务使用 `pika-h3-pro` 命令，并把模型修订固定到 `0ddf55ad7067ca1e76812253bd7b4600df87f759`：

```bash
export MODEL_REPO=Pika-Labs/Pika-H3-Flex
export MODEL_REVISION=0ddf55ad7067ca1e76812253bd7b4600df87f759

pika-h3-pro --task t2va --prompt-file examples/prompts/t2va.txt \
  --model-repo "$MODEL_REPO" --revision "$MODEL_REVISION" \
  --resolution 480p --aspect 16:9 --duration 5 --seed 42 \
  --output outputs/sample.mp4
```

这段命令来自项目 README，本文没有在缺少合格 GPU 和磁盘的环境中执行完整生成。即使使用相同 seed，不同注意力内核、设备和依赖版本也可能产生不同结果；项目并不承诺逐位一致。

## “快于实时”的数字不能直接套到本地单卡

Pika 公布的推理优化包括缓存随时间步变化的 AdaLN 投影、融合内核、FlashAttention-4、块稀疏注意力和压缩通信。官方测试把 5 秒、768p、带音频任务的完整推理时间从 3.409 秒降到 2.129 秒。

这个数字的测试条件是 **8 张 B300 GPU**，而且优化后的服务栈部署在 Pika API。它证明了六步模型在特定数据中心栈上可以快于视频时长，却不能证明公开仓库在一张 H100 上也有同样延迟。

公开仓库的硬件表更适合做本地预算：默认 480p、5 秒采样约占 66–69 GiB；768p、15 秒默认模式会超过 H100 80GB，开启 CPU offload 后采样阶段约占 29–32 GiB GPU 显存，但主机内存观测值接近 94 GiB。卸载只是用内存和传输时间换显存，不会把模型变成轻量应用。

## 可下载能力与托管能力必须分开

本地开放权重版本提供 480p/768p 与混合立体声音轨。官方展示的 1080p、2K、4K finishing、五条可编辑音轨和提示词增强，则属于 Pika 托管 API 的扩展能力，不在本地适配器里。

五条音轨也不是生成器直接输出五个独立通道。技术说明写的是：生成器先联合产生一条包含对白、配乐、音效和环境声的混合音轨，再由托管服务做提示驱动的音源分离，得到 dialogue、score、SFX、foley 和 ambience。对后期工作流很有价值，但不能把它误解成开放权重模型本身原生生成五轨。

类似地，官方技术报告中的质量指标和盲测都由 Pika 组织。报告说明了对比模型、768p 条件和评价方法，也承认物理、多场景一致性与复杂参考控制仍有不足；这些结果适合形成测试假设，不是独立第三方验证。团队若考虑接入，应该用自己的角色一致性、镜头运动、对白同步和失败率数据重新评估。

## 开放了权重，不等于 Apache-2.0 覆盖全部

项目的推理与加载代码使用 Apache-2.0，但两组适配器是 MiniMax H3 的模型衍生物，沿用 MiniMax H3 Community License。两者不能混为一个“Apache 开源模型”。

许可证把美国、欧盟、英国和韩国列为排除地区，并为年收入超过 2,000 万美元的商业产品设置额外授权要求；对外提供服务时还有展示标识、下游条款和安全措施等义务。准备商用、再分发或提供托管服务的团队，应按实际主体、用户地区和业务模式审阅原文，而不是只看 GitHub 仓库可见或代码许可证。

这也是 H3 Flex 最需要提前确认的边界：技术上能下载，不代表任何地点、任何产品都能直接部署。

## 谁值得现在上手

如果团队已经有 H100 80GB 级硬件，正在做短视频草案、首尾帧过渡、多参考角色动画或音画联合生成，H3 Flex 值得用 480p、5 秒任务做小规模资格测试。固定模型修订、适配器哈希、种子和输出元数据后，至少能把实验输入与资产版本记录清楚。

如果只有消费级 GPU，或者只想验证创作效果，优先使用在线演示或 API。下载 216 GB 以上资产、准备 80GB 级显存，并维护被固定到特定提交的 Diffusers 补丁，只为做一次体验并不划算。

如果产品需要 4K、分离音轨或接近官方“快于实时”的延迟，也应直接评估托管 API，而不是假定公开本地包已经包含同一套服务栈。

Pika H3 Flex 的价值不在于给视频生成再加一个品牌名，而在于展示了一条清晰的工程路线：先让 50 步教师学会目标任务，再用分布匹配蒸馏压到 6 步，最后用奖励和偏好学习把速度损失补回来。它确实让生成更快了；硬件、托管功能和许可证则提醒我们，**少步数是计算效率，不是低门槛的同义词。**

## 原始资料

- [Pika H3 Flex 技术说明：训练、蒸馏、奖励学习与厂商评测](https://pika.art/blog/pika-h3-flex-research)
- [Pika H3 Flex 发布公告](https://pika.art/blog/pika-h3-flex)
- [GitHub：推理代码、任务类型与安装命令](https://github.com/Pika-Labs/Pika-H3-Flex)
- [固定版本的 `release.json`](https://github.com/Pika-Labs/Pika-H3-Flex/blob/4bf8ea508891a432106e70f675d287c27f02306d/release.json)
- [官方硬件测试与内存边界](https://github.com/Pika-Labs/Pika-H3-Flex/blob/4bf8ea508891a432106e70f675d287c27f02306d/docs/hardware.md)
- [Hugging Face：模型权重与适配器](https://huggingface.co/Pika-Labs/Pika-H3-Flex/tree/0ddf55ad7067ca1e76812253bd7b4600df87f759)
- [MiniMax H3 Community License](https://github.com/Pika-Labs/Pika-H3-Flex/blob/4bf8ea508891a432106e70f675d287c27f02306d/LICENSE)
- [Apache-2.0 代码许可证](https://github.com/Pika-Labs/Pika-H3-Flex/blob/4bf8ea508891a432106e70f675d287c27f02306d/LICENSE-CODE)
