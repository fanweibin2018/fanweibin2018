---
title: 'LDraw Nova：AI 不直接搭积木，而是先写一个可复现的 CAD 生成器'
date: 2026-10-06
slug: 'ldraw-nova-agent-cad-generator'
author: 范伟彬
description: '拆解 LDraw Nova 怎样让 Agent 先生成结构化计划和 Python 程序，再编译为可校验、可渲染的 LDraw 模型；并说明几何检查为什么仍不能证明实物可搭。'
categories:
  - AI
  - 开源项目
tags:
  - LDraw Nova
  - AI Agent
  - LDraw
  - CAD
  - 生成式设计
---

让 AI 设计一座积木建筑，最直觉的做法是让它逐块输出零件编号、位置和旋转角度。问题也随之而来：几千块零件就是几千次精确的三维坐标计算，前面一个角度出错，后面的结构可能全部漂移；最终即使图片看起来像一座建筑，也很难判断零件是否真实存在、彼此是否穿模、下一次还能不能生成同一个结果。

10 月 2 日公开的 LDraw Nova 选择了另一条路：**不让 Agent 直接“摆完所有积木”，而是让它先写结构化计划和 Python 生成器，再由程序输出 LDraw CAD 文件。** 这更像让 AI 编写一台小型造桥机，而不是要求它徒手摆放每一块砖。

项目公开后数日即在 Hacker News 引发讨论。10 月 6 日核验时，仓库创建于 9 月 23 日，已有 277 个 Star；这些数字只能说明开发者正在关注它，不能证明生成模型已经通过实物搭建。真正值得看的，是它把生成式 AI 接入 CAD 时采用的中间表示、确定性生成和分层校验。

## 为什么不用模型直接写 LDraw

LDraw 是一套开放的积木 CAD 标准。一个 `.ldr` 或 `.mpd` 文本文件会记录零件、颜色、三维坐标和旋转矩阵，LeoCAD 等工具可以把它还原为可编辑的三维模型。它很适合机器生成，因为输出不是一张“像积木”的图片，而是由实际零件引用组成的工程文件。

但 LDraw 同时非常底层。把一个零件放进场景，通常要给出类似下面的信息：

```text
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3003.dat
```

这里既有颜色和位置，也有 3×3 变换矩阵及零件编号。让语言模型连续手写大量这类记录，相当于让人一边心算坐标，一边用汇编语言完成整座建筑：能生成文本，不代表能长期保持空间关系正确。

LDraw Nova 在中间加了两层：

1. Agent 先把设计拆成模块、步骤和连接关系，形成 `plan.json`；
2. 对重复结构或复杂模型，Agent 编写 `generate.py`，用循环、函数和模块组合生成计划；
3. 项目的 builder 校验计划 Schema、解析零件引用，最后序列化为 `.mpd`；
4. 再用几何、连接、BOM 和渲染工具发现错误，Agent 根据检查结果修改生成器后重跑。

这条链路可以概括为：

```text
自然语言需求 → 结构计划 → Python 生成器 → LDraw 模型 → 校验与渲染 → 修改生成器
```

关键变化在于，模型不必记住第 847 块砖的绝对坐标。它可以写出“生成五层塔檐”“沿路径重复铺砖”或“把屋顶模块连接到墙体锚点”的程序，再让计算机负责重复和坐标运算。相同输入重跑生成器，还能得到相同的计划和模型，错误也更容易回到源码修复。

## `plan.json` 把空间意图变成可检查的契约

项目提供的最小桥梁示例很能说明中间层的作用。桥墩不是复制两份零件列表，而是先定义一个可复用子模型，再在主模型中放置两次；第二个桥墩只需改变位置和朝向。

下面是根据官方示例精简后的结构，属于示意代码：

```json
{
  "version": 1,
  "author": "Example",
  "sections": [
    {
      "name": "bridge-main.ldr",
      "description": "two pillars and a deck",
      "steps": [[
        {"id": "left", "ref": "pillar.ldr", "colour": 4, "at": [-40, 0, 0]},
        {"id": "right", "ref": "pillar.ldr", "colour": 1, "at": [40, 0, 0], "yaw": 90}
      ]]
    }
  ]
}
```

Schema 不只检查 JSON 能否解析，还限制了位置向量、旋转矩阵、颜色、引用方式和未知字段。builder 还会拒绝重复 ID、尚未出现的依赖、非有限数字、奇异或镜像矩阵，以及不存在的零件引用。

计划也不必处处写绝对坐标。`on` 可以把一块标准砖放到前一块砖上，并检查是否至少有一个凸点对齐；`attach` 用命名锚点组合模块；`snap` 则根据连接器候选对齐零件。它们像 CAD 里的几何约束：保存的是“屋顶接到墙上”这一意图，而不是一组难以维护的偶然坐标。

## 校验能排除什么，不能证明什么

LDraw Nova 的校验分成多层：

| 层次 | 能发现的问题 | 仍然缺少的证明 |
| --- | --- | --- |
| Schema 与序列化 | 字段错误、非法数字、重复 ID、错误引用 | 造型是否合理 |
| LDraw 语法 | 文件结构、变换矩阵、颜色与子模型引用 | 每种编辑器扩展都能工作 |
| 几何分析 | 重复放置、部分包围盒重叠、已知连接和悬空组 | 完整材料碰撞、受力与稳定性 |
| LeoCAD 与 BOM | 模型能否导入、渲染，零件数量是否一致 | 真实零件颜色库存、装配顺序和手部可达性 |
| 图片复核 | 比例、轮廓和明显穿模 | 实物公差、咬合力和长期承重 |

项目自带的 Sakura Garden 示例包含 2175 个物理零件放置、33 个文件块。仓库记录显示，LDraw Nova 的几何检查、LeoCAD 导入和 BOM 对比均已通过，但最终字段仍明确保留为 `physical_validity: not_proven`。原因包括连接元数据覆盖不完整、部分重叠需要人工判断，以及没有测量咬合力、悬挑稳定性和真实颜色库存。

这个边界非常重要。**“使用真实零件编号”只能证明零件存在于目录，“碰撞检查通过”也不等于实物一定能按顺序装上。** CAD 中的两个零件可能在最终位置不冲突，却没有可行的插入路径；一座塔在静态坐标上连成一体，也可能因为重心和咬合力不足而倒塌。

所以 LDraw Nova 更适合被理解为“可审查的设计候选生成器”，而不是自动颁发可制造证书的系统。

## 我实际验证了哪些部分

我固定使用 10 月 2 日的 `v0.6.0` 标签，在 Python 3.12.14 环境执行了项目锁定依赖和完整测试：

```bash
git clone --branch v0.6.0 https://github.com/anteloc/ldraw-nova.git
cd ldraw-nova
uv sync --locked --extra test
uv run pytest -q
```

实际结果为：

```text
127 passed, 97 skipped in 1.76s
```

其中跳过项主要依赖当前环境没有安装的官方 LDraw 零件库，因此这个结果证明 Schema、builder、连接、校验和示例代码中的可独立测试路径能够运行，**不能替代完整零件库、LeoCAD 渲染或实物搭建测试**。

如果只是想体验完整 Web 界面，官方要求把 `ldraw-nova` 与 `ldraw-nova-docker` 两个仓库放在同级目录，并固定到同一个 `v0.6.0` 标签后使用 Docker Compose 构建。README 提醒首次构建约需 5 GB 空间。服务没有登录功能，因此只适合在可信本地网络运行，不应直接暴露到公网。

零件和参考模型搜索可以选择 Jev 语义重排；没有 TypeSafe API Key 时会退回本地全文检索。Jev 在这里负责缩小“哪个零件可能适合这个角色”的候选范围，不负责证明零件尺寸、连接方式或颜色可用，最终仍要回到零件检查和几何验证。

## 哪些任务适合，哪些暂时不适合

LDraw Nova 适合三类尝试：

- 想研究 Agent 如何控制 CAD、编译器或其他确定性工具；
- 需要大量重复结构、模块化建筑或参数化积木场景；
- 希望保留计划、生成器、模型、BOM 和检查报告，而不是只得到一张渲染图。

它目前不适合把一句提示词直接变成可放心购买零件的成品方案。项目 README 明确承认，大型正确模型仍依赖昂贵的高端模型，生成过程较慢；VR 操作、低端模型适配、人物与动物、Technic 机构和飞船等类型仍有明显不足。许可证也需要注意：代码采用 AGPL-3.0，研究笔记和文档采用 CC BY-SA 4.0；把修改版作为网络服务提供时，不能按宽松许可证项目的方式理解义务。

更普遍的启示不只属于积木。让 Agent 接触 CAD、EDA、工作流和工业软件时，直接生成最终文件往往不是最稳的路径。先让它生成**可执行的中间程序**，再交给确定性工具编译、校验和渲染，能把模糊的自然语言意图变成可追踪、可重跑、可测试的工程过程。

这并不会让 AI 自动懂得物理世界，但至少让我们能准确知道：它生成了什么，哪一层检查已经通过，哪一层证据仍然缺失。

## 原始资料

- [LDraw Nova v0.6.0 源码与项目说明](https://github.com/anteloc/ldraw-nova/tree/v0.6.0)
- [LDraw Nova v0.6.0 发布提交](https://github.com/anteloc/ldraw-nova/commit/c4ba6c4913e0975ee7e34e647c26129137657d5e)
- [计划 Schema 与 builder 实现](https://github.com/anteloc/ldraw-nova/blob/v0.6.0/ldraw_tools/builder.py)
- [校验覆盖范围与明确边界](https://github.com/anteloc/ldraw-nova/blob/v0.6.0/docs/agent/validation.md)
- [Sakura Garden 的验证记录](https://github.com/anteloc/ldraw-nova/tree/v0.6.0/examples/sakura-garden)
- [LDraw 官方对开放 CAD 标准的介绍](https://www.ldraw.org/)
- [Hacker News 的项目发布讨论（2026-10-02）](https://news.ycombinator.com/item?id=49937916)
- [Tom's Hardware 对项目及未做实物搭建的报道（2026-10-04）](https://www.tomshardware.com/tech-industry/artificial-intelligence/open-source-tool-designs-lego-builds-with-more-than-2-000-real-pieces-their-programs-output-detailed-cad-files-but-no-models-have-been-built-yet)
