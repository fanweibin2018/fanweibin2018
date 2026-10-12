---
title: 'Diagram Design：让 AI 画图不只靠审美提示词，还要过工程检查'
date: 2026-10-13
slug: 'diagram-design-agent-skill-verification'
author: 范伟彬
description: '拆解近期快速升温的 Diagram Design 如何用 Agent Skill、语义中间表示、HTML/SVG 模板和专用校验器生成技术图，并以固定提交的导入、几何、可访问性与导出测试说明它的实际价值和边界。'
categories:
  - AI
  - 技术
  - 开源工具
tags:
  - Diagram Design
  - Agent Skill
  - SVG
  - Mermaid
  - 技术图
---

让 AI 画一张架构图并不难，难的是让它第二次仍然遵守相同的连线、字号、留白和品牌规范，还能在导出 SVG 后不丢失渐变、透明度与无障碍信息。

[Diagram Design](https://github.com/cathrynlavery/diagram-design) 最近突然受到开发者关注。截至 **2026 年 10 月 13 日**观察 GitHub Trending 时，页面显示仓库约有 5.2 万个 Star，当日新增约 2,100 个。这个数字只能说明许多人正在看，不能证明项目已经被广泛采用，也不能证明它生成的图一定比其他方案好。

更值得关注的是源码在同步变化。项目在 **10 月 12 日**加入 service blueprint 图型，并集中合入 Mermaid、draw.io、Excalidraw 导入、SVG/PNG 导出和多种校验器修复；过去一周还增加了输入大小限制、重复 ID 检查和更严格的几何约束。它正在尝试把“让模型画得好看”从一句模糊要求，拆成一条可以检查的工程流水线。

## 它不是绘图模型，而是一包给 Agent 的工作规程

Diagram Design 没有训练新模型，也没有提供一个独立的在线画布。它是一套可安装到 Claude Code、Codex、GitHub Copilot、Factory Droid 和 Pi 等工具中的 Agent Skill：入口文件告诉 Agent 什么时候该画图、选择哪种图型、应该读取哪些参考文件，以及输出前要检查什么。

可以把它理解成给一位会写 HTML 的临时设计师发了一本设计手册，同时配上一盒经过审核的模板和几台质检仪器：

```text
自然语言或已有图源
  → 选择语义模式与图型
  → 确定尺寸、细节和受众
  → 生成自包含 HTML + 内联 SVG
  → 通用检查 + 图型专用检查
  → 导出 SVG 或 PNG
```

仓库当前列出 45 种图型，但 Agent 不需要每次读完全部规则。普通架构图只加载总入口、架构图参考和必要的布局规则；导入 Mermaid 时才额外读取 Mermaid 解析约束。这个按需加载很重要：Skill 文件越长，模型越容易在无关规则中分散注意力，也会占用更多上下文。

项目把风格写得非常具体：结构坐标和间距落在 4 像素网格上，一张图通常不超过 9 个节点和 12 条连线，只允许 1 至 2 个强调元素；跨行列的连线使用圆角直角，不允许随意斜穿节点；技术副标题才使用等宽字体。模型仍负责布局，但它面对的不再是“专业一点”这类没有判定标准的形容词。

## 为什么 HTML + SVG 是它的中间形态

最终源文件是一个 HTML，其中包含内联 SVG、样式和必要的说明文字。它不需要先安装前端构建工具，双击就能在浏览器打开，还能继续导出为纯 SVG 或 PNG。

这个选择同时承担三种角色：

1. HTML 是可直接预览的容器，可以放标题、图、摘要卡片和说明；
2. SVG 保存矢量文本、图形、连线和可访问性标签；
3. 浏览器是统一的排版与截图引擎，PNG 导出不必另写一套绘制逻辑。

不过，“自包含”需要说得准确。默认模板会从 Google Fonts 加载字体，因此首次打开仍有一次网络请求；使用系统字体选项后才可以完全离线。项目不依赖外部图片，普通静态图也不需要 JavaScript。带动画的模板则只允许仓库审核过的控制脚本，并要求在 `prefers-reduced-motion` 下显示完整静态帧。

## 导入旧图时，先抽取语义，再重新布局

直接把 Mermaid 渲染成 SVG，再换一层颜色，通常只是“改皮肤”。Diagram Design 选择另一条路线：先用 Python 解析器把源文件抽取成有边界的中间表示，再让 Agent 按目标尺寸和受众重新绘制。

以 Mermaid 为例，解析器保留节点、关系、容器、方向、循环、状态守卫、时序片段和 ER 基数，但丢弃源主题、CSS 类和自动布局坐标。draw.io 与 Excalidraw 也采取类似策略。原图中的坐标只是作者拖出来的结果，不被当成新的版式约束。

这里的“中间表示”很像搬家清单：先登记有几件家具、它们之间是什么关系，再根据新房间重新摆放，而不是把旧房间的平面图等比例贴到新墙上。

这种做法还有一层安全意义。解析器只读取有大小上限的文本或结构数据，不执行 Mermaid、JavaScript、浏览器内容和点击链接；图中的标签即使长得像命令，也只作为不可信数据。导入结果还要附带 fidelity ledger，说明多少节点被保留、合并或删除，避免 Agent 为了画面简洁而悄悄丢掉内容。

代价也很清楚：当前解析器只覆盖项目明确列出的 Mermaid 语法子集，`pie`、`mindmap`、`gitGraph` 等类型不能假装支持；重新布局也意味着它不是像素级转换，原图的手工位置和主题不会保留。

## 校验器能抓住哪些“看起来没报错”的错误

浏览器能正常打开，不代表技术图是对的。一个节点被线穿过、无障碍标题指向不存在的 ID，或 service blueprint 把后台活动画到“可见线”上方，HTML 都可能照常渲染。

Diagram Design 因此同时使用通用检查和图型专用检查：

- `self_check.py` 拒绝远程图片、任意脚本、事件处理器、CSS 外部资源和错误的无障碍结构；
- 可访问性检查要求 SVG 有 `role="img"`、可解析的 `aria-labelledby`，并把 `<title>` 与 `<desc>` 放在正确位置；
- 对比度检查区分正文文字的 4.5:1 门槛和关键非文字图形的 3:1 门槛；
- 几何检查寻找斜线、共用端口、叠线、越过节点边界以及被后绘制节点遮住的标签底板；
- service blueprint 专用校验器检查 customer、frontstage、backstage 的上下顺序、可见线位置、各阶段列宽、单元格归属和强调元素数量。

最后一项尤其能说明为什么只靠通用 SVG 校验不够。service blueprint 的每一层和每个阶段都可能画得整齐，但如果语义层次颠倒，仍然是一张错误的图。项目让 SVG 元素携带 `data-layer`、`data-stage` 和 `data-name`，再用专用脚本核对“画出来的位置”与“声明的意义”是否一致。

它还不是真正的视觉审稿人。脚本可以判断线是否斜穿方框，却不能可靠判断构图是否有感染力、信息层级是否适合特定读者。项目所谓的 taste gate 仍有相当部分是让生成模型自查，而不是独立的计算机视觉评测。

## 固定源码跑一次验证

我固定了提交 `dd20721177e78feecd01b4d5a791edc664e660fa`，在 Python 3.12.14 环境运行仓库自带的输入解析、可访问性、对比度、几何、service blueprint 和导出测试：

```bash
git clone https://github.com/cathrynlavery/diagram-design.git
cd diagram-design
git checkout dd20721177e78feecd01b4d5a791edc664e660fa

python3 scripts/test-self-check.py
python3 scripts/test-lint-a11y.py
python3 scripts/test-verify-contrast.py
python3 scripts/test-verify-geometry.py
python3 scripts/test-verify-service-blueprint.py

python3 scripts/test-verify-drawio-import.py
python3 scripts/verify-mermaid-import.py
python3 scripts/test-verify-excalidraw-import.py
python3 scripts/test-export-svg-standalone.py
```

这些选择性测试全部通过，其中独立 SVG 导出套件运行了 70 项测试。service blueprint 测试不仅检查仓库样例能通过，还会主动交换图层、移动单元格、删除可见线或制造第二个强调元素，确认校验器会按预期拒绝这些变体。

我还对仓库的架构图样例执行了实际导出：

```bash
python3 skills/diagram-design/scripts/self_check.py \
  skills/diagram-design/assets/example-architecture.html

python3 skills/diagram-design/scripts/export_svg.py \
  skills/diagram-design/assets/example-architecture.html \
  /tmp/example-architecture.svg \
  --system-fonts
```

输入 HTML 通过自检；给自检增加 `--offline` 时，它会如实指出默认样例仍加载 Google Fonts。使用 `--system-fonts` 导出的 SVG 为 11,242 字节，保留了 `<title>` 和 `<desc>`，并且不再包含 Google Fonts 地址。

这组测试能证明的是：固定版本的解析器与校验器在仓库覆盖的样例和反例上按设计运行，SVG 导出路径可以复现。它不能证明任意模型都会画出好图，也不能证明 45 种图型的所有真实输入都没有遗漏。

## 什么时候比 Mermaid 更合适

Diagram Design 更适合“准备发布”的图：文章配图、方案说明、客户演示、社交卡片，以及需要套用品牌色和导出高质量 SVG/PNG 的一次性成果。它也适合把结构混乱但语义仍有价值的 draw.io 或白板草图重新整理。

Mermaid 更适合跟代码一起长期维护的图。几行文本容易审查差异、解决冲突，GitHub 还能直接渲染。Diagram Design 生成的 HTML/SVG 体积更大，同一句要求两次布局也可能不同；它没有可拖拽编辑的原生画布，审查者很难从一大段坐标变化中看懂“业务上改了什么”。

因此，两者不是简单替代关系：

| 需求 | 更合适的选择 |
| --- | --- |
| 随代码频繁变化、需要清晰 diff | Mermaid / PlantUML |
| 手工拖拽和多人画布编辑 | draw.io / Excalidraw |
| 发布级视觉、品牌统一、矢量导出 | Diagram Design |
| 只有几个要点，没有拓扑关系 | 表格或文字 |

## 上手前必须知道的边界

- **热度不等于采用。** Trending 和 Star 只能说明关注度，项目缺少独立的大规模用户研究与生成质量基准。
- **规则不能消除模型差异。** 仓库自己也承认输出质量依赖所用模型，相同提示可能产生不同布局。
- **测试覆盖的是契约，不是审美。** 对比度、几何和语义位置可以自动检查，但“好不好读”仍需要人工判断。
- **HTML/SVG 不适合高频代码审查。** 坐标和样式变化会产生很大的 diff，也没有像 draw.io 那样直接拖动节点的编辑体验。
- **导入不是完整兼容层。** 解析器只支持明确列出的语法与容器，遇到不支持的内容应该停止，而不是猜测。
- **默认字体并非完全离线。** 需要显式选择系统字体，或在发布环境中自行处理字体资源和许可。
- **版本更新很快。** 当前每次合并后都会自动提升插件补丁版本；生产团队应固定提交或版本，在升级前重跑自己的代表性图例。

Diagram Design 最值得关注的不是“AI 终于会画漂亮架构图”，而是它把生成过程拆成了可审查的几层：模型负责理解与布局，模板约束输出形态，解析器隔离旧图输入，通用校验器检查安全和结构，专用校验器检查图型语义。对于越来越多以 Skill 形式交付的 Agent 能力，这比一份越来越长的万能提示词更接近可维护的软件工程。

## 原始资料

- [Diagram Design 仓库与使用说明](https://github.com/cathrynlavery/diagram-design)
- [固定提交的 Skill 入口](https://github.com/cathrynlavery/diagram-design/blob/dd20721177e78feecd01b4d5a791edc664e660fa/skills/diagram-design/SKILL.md)
- [2.6 系列变更记录](https://github.com/cathrynlavery/diagram-design/blob/dd20721177e78feecd01b4d5a791edc664e660fa/CHANGELOG.md)
- [Mermaid 导入与语义抽取说明](https://github.com/cathrynlavery/diagram-design/blob/dd20721177e78feecd01b4d5a791edc664e660fa/skills/diagram-design/references/import-mermaid.md)
- [输出尺寸、细节与受众约束](https://github.com/cathrynlavery/diagram-design/blob/dd20721177e78feecd01b4d5a791edc664e660fa/skills/diagram-design/references/output-spec.md)
- [service blueprint 专用校验器](https://github.com/cathrynlavery/diagram-design/blob/dd20721177e78feecd01b4d5a791edc664e660fa/scripts/verify-service-blueprint.py)
- [独立 SVG 导出测试](https://github.com/cathrynlavery/diagram-design/blob/dd20721177e78feecd01b4d5a791edc664e660fa/scripts/test-export-svg-standalone.py)
