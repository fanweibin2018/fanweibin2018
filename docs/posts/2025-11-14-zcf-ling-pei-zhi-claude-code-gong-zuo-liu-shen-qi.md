---
title: 'ZCF：零配置 Claude Code 工作流神器'
date: 2025-11-14
slug: 'zcf-ling-pei-zhi-claude-code-gong-zuo-liu-shen-qi'
categories:
  - 'AI 与工作流'
tags:
  - 'Claude Code'
  - 'ZCF'
  - 'Codex'
  - '工作流'
source: halo
description: 'Zero Config Code Flow for Claude Code & Codex GitHub 星标：3.9k+ ⭐ 作者：UfoMiao 许可证：MIT 什么是 ZCF？ ZCF（Zero Config Co'
---

# ZCF：零配置 Claude Code 工作流神器

> **Zero-Config Code Flow for Claude Code & Codex**  
> **GitHub 星标：3.9k+ ⭐**  
> **作者：UfoMiao**  
> **许可证：MIT**

---

## 什么是 ZCF？

**ZCF（Zero-Config Code Flow）** 是一个轻量级的命令行工具，专为 **Claude Code** 和 **Codex** 设计，旨在通过零配置或最小配置，让开发者快速上手 AI 辅助编程。

### 核心理念

```
📦 零配置启动  →  🚀 智能工作流  →  💡 AI 驱动开发
```

ZCF 不是简单的配置工具，而是一个**完整的 AI 开发工作流管理系统**，它将模型调用、提示词模板和执行步骤链接成可复用的流程，让你能够：

- **5 分钟内完成 Claude Code 的完整配置**
- **一键导入专业的 AI 工作流和命令系统**
- **无缝集成 MCP（Model Context Protocol）服务**
- **支持中英双语，降低 Token 消耗**

### 技术栈

```
核心技术:
  - 语言: TypeScript
  - 运行时: Node.js
  - 包管理: npm / pnpm
  - 构建工具: TSC

支持平台:
  - macOS
  - Linux
  - Windows
  - WSL (Windows Subsystem for Linux)
  - Termux (Android)
```

---

## 为什么需要 ZCF？

### 传统配置 Claude Code 的痛点

#### ❌ 问题 1：配置复杂

```
# 传统方式需要手动操作多个步骤
1. 下载安装 Claude Code
2. 手动创建配置文件目录 ~/.claude
3. 编写 CLAUDE.md、settings.json 等配置文件
4. 配置 API 密钥
5. 设置 MCP 服务
6. 创建自定义命令和工作流
7. 调试配置错误...

# 耗时：1-2 小时（对新手可能更久）
```

#### ❌ 问题 2：配置文件分散

```
~/.claude/
├── CLAUDE.md          # 需要手动编写
├── settings.json      # 需要手动配置
├── agents/            # 需要手动创建
│   ├── task-planner.md
│   └── ...
└── commands/          # 需要手动定义
    ├── workflow.md
    └── ...
```

#### ❌ 问题 3：更新困难

- 官方更新了最佳实践？需要手动同步
- 想切换中英文配置？需要手动修改所有文件
- 工作流需要优化？需要逐个文件调整

### ✅ ZCF 的解决方案

#### 一键完成所有配置

```
# 只需一条命令
npx zcf

# 自动完成：
✓ 检测并安装 Claude Code
✓ 生成完整配置文件
✓ 配置 API（支持多个提供商）
✓ 安装 MCP 服务
✓ 导入专业工作流
✓ 设置自定义命令

# 耗时：2-5 分钟
```

#### 智能化管理

```
# 更新工作流（保留你的 API 和 MCP 配置）
npx zcf u

# 切换语言（降低 Token 消耗）
npx zcf u --config-lang en

# 强制重新配置
npx zcf --force
```

---

## 核心功能

### 1. 🎯 一键初始化

ZCF 提供完整的自动化安装流程：

```
npx zcf
```

**自动化流程**：

```
┌─────────────────────────────────────┐
│ 1. 环境检测                         │
│    ✓ 检测操作系统                   │
│    ✓ 检测 Claude Code 安装状态      │
│    ✓ 检测现有配置                   │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 2. 语言选择                         │
│    ❯ 简体中文                       │
│      English                        │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 3. Claude Code 安装                 │
│    ✓ 自动下载安装                   │
│    ✓ 版本验证                       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 4. API 配置                         │
│    • 选择 API 提供商                │
│    • 输入 API Key                   │
│    • 验证连接                       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 5. 工作流导入                       │
│    ✓ 核心原则文档                   │
│    ✓ AI 代理配置                    │
│    ✓ 自定义命令                     │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 6. MCP 服务配置                     │
│    ◯ Context7 文档查询              │
│    ◯ DeepWiki GitHub 查询           │
│    ◯ Playwright 浏览器控制          │
│    ◯ Exa AI 搜索                    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ 7. 完成                             │
│    🎉 配置完成，开始使用！          │
└─────────────────────────────────────┘
```

### 2. 📦 多 API 提供商支持

ZCF 支持多个 Claude API 提供商，满足不同地区和需求：

```
# 使用 302.AI 提供商
npx zcf i --skip-prompt --provider 302ai --api-key "sk-xxx"

# 使用 GLM（智谱 AI）
npx zcf i -s -p glm -k "sk-xxx"

# 使用 MiniMax
npx zcf i -s -p minimax -k "sk-xxx"

# 使用 Kimi（月之暗面）
npx zcf i -s -p kimi -k "sk-xxx"

# 使用自定义提供商
npx zcf i -s -p custom -k "sk-xxx" -u "https://api.example.com"

# 为 Codex 配置
npx zcf i -s -T cx -p 302ai -k "sk-xxx"
```

**支持的提供商**：

- **Anthropic** - 官方 API（需要海外信用卡）
- **302.AI** - 国内中转服务（推荐）
- **智谱 AI (GLM)** - 国产大模型
- **MiniMax** - 国产大模型
- **Kimi (月之暗面)** - 国产大模型
- **自定义** - 兼容 OpenAI 格式的 API

### 3. 🌍 多语言支持

ZCF 提供完整的中英文支持，可以灵活切换：

```
# 中文界面
npx zcf --lang zh-CN

# 英文界面（推荐，Token 消耗更低）
npx zcf --lang en

# 所有操作都使用中文
npx zcf init --lang zh-CN

# 配置 CCR 使用中文
npx zcf ccr --all-lang zh-CN

# 语言参数优先级（从高到低）
# --all-lang > --lang > 保存的用户偏好 > 交互式提示
```

**语言选择建议**：

| 场景 | 推荐语言 | 原因 |
| --- | --- | --- |
| **生产环境** | English | Token 消耗低 20-30% |
| **学习使用** | 简体中文 | 更容易理解和调试 |
| **团队协作** | English | 便于国际化协作 |
| **自定义工作流** | 简体中文 | 方便修改和维护 |

### 4. 🔄 智能更新机制

```
# 仅更新工作流（保留 API 和 MCP 配置）
npx zcf u

# 切换到英文配置
npx zcf u --config-lang en

# 完整的更新（等同于初始化）
npx zcf
```

**备份机制**：

- 每次更新前自动备份到 `~/.claude/backup/xxx`
- 支持选择性恢复
- 防止配置丢失

### 5. 🤖 丰富的工作流系统

ZCF 内置了多个专业的 AI 工作流：

```
# 项目初始化工作流
/init

# 功能开发工作流（包含 plan 和 ui 阶段）
/feat <任务描述>

# 完整开发工作流（多方案选择，用户参与决策）
/workflow <任务描述>

# Bug 修复工作流
/fix <问题描述>

# 代码审查工作流
/review

# 测试驱动开发工作流
/tdd

# 文档更新工作流
/docs

# 发布管理工作流
/release
```

### 6. 🔌 MCP 服务集成

Model Context Protocol（模型上下文协议）服务让 AI 能够访问外部工具和数据：

**支持的 MCP 服务**：

| 服务 | 功能 | 使用场景 |
| --- | --- | --- |
| **Context7** | 查询最新的库文档和代码示例 | 学习新框架、查看 API 文档 |
| **DeepWiki** | 查询 GitHub 仓库文档和示例 | 研究开源项目、学习最佳实践 |
| **Playwright** | 直接控制浏览器进行自动化操作 | Web 自动化测试、爬虫 |
| **Exa AI** | 使用 Exa AI 进行网页搜索 | 信息检索、市场调研 |

```
# 交互式选择 MCP 服务
npx zcf
# → 选择 "是否配置 MCP 服务"
# → 空格选择需要的服务
# → 回车确认安装
```

### 7. 🎨 Claude Code 增强功能

#### CCometixLine - 高性能状态栏工具

```
# 配置 CCometixLine（v2.9.9+ 新功能）
# 提供 Git 集成和实时使用追踪
```

#### 模型配置选项

```
# 在主菜单选择 "5. 模型配置"

选项：
1. Default - 让 Claude Code 自动选择最佳模型
2. Opus - 使用 Claude-4.1-Opus（高 token 消耗，谨慎使用）
3. Sonnet 1M - 使用 1M 上下文窗口的 Sonnet（大型项目）
```

#### 版本检查和更新

```
# 检查并更新 Claude Code、CCR 和 CCometixLine
# v2.9.9+ 增强功能
```

---

## 快速开始

### 前置要求

```
# 1. Node.js 16+
node --version  # 应该 >= 16.0.0

# 2. npm 或 pnpm
npm --version
```

### 方式一：使用 npx（推荐）

```
# 无需安装，直接运行
npx zcf

# 如果是首次使用，会自动：
# 1. 下载最新版本
# 2. 启动交互式配置向导
# 3. 引导你完成所有配置
```

### 方式二：全局安装

```
# 全局安装 ZCF
npm install -g zcf

# 运行
zcf

# 查看帮助
zcf --help

# 查看版本
zcf --version
```

### 首次配置流程

```
$ npx zcf

? Select script language / 选择脚本语言:
❯ 简体中文
  English

? 选择 Claude Code 配置语言:
❯ 简体中文 (zh-CN) - 中文版（便于中文用户自定义）
  English (en) - 英文版（推荐，token 消耗更低）

? 检测到 Claude Code 未安装，是否自动安装？(Y/n)
✔ Claude Code 安装成功

? 是否配置 API？
❯ 配置 API
  跳过（稍后在 claude 命令中自行配置，如 OAuth）

? 请选择 API 提供商:
❯ Anthropic (官方)
  302.AI (国内推荐)
  GLM (智谱 AI)
  MiniMax
  Kimi (月之暗面)
  Custom (自定义)

? 请输入 API URL: https://api.anthropic.com

? 请输入 API Key: sk-ant-***

? 检测到已有配置文件，如何处理？
❯ 备份并覆盖全部
  仅更新工作流相关md并备份旧配置
  合并配置
  跳过

✔ 已备份所有配置文件到 ~/.claude/backup/2025-11-10_14-30-25
✔ 配置文件已复制到 ~/.claude
✔ API 配置完成

? 是否配置 MCP 服务？(Y/n)

? 选择要安装的 MCP 服务（空格选择，回车确认）
❯ ◯ 全部安装
  ◯ Context7 文档查询 - 查询最新的库文档和代码示例
  ◯ DeepWiki - 查询 GitHub 仓库文档和示例
  ◯ Playwright 浏览器控制 - 直接控制浏览器进行自动化操作
  ◯ Exa AI 搜索 - 使用 Exa AI 进行网页搜索

✔ MCP 服务配置完成

🎉 所有配置完成！现在你可以开始使用 Claude Code 了

运行 'claude' 启动 Claude Code
或在项目目录中运行 'claude .' 打开项目
```

---

## 详细使用指南

### 命令行选项

```
# 完整命令格式
npx zcf [command] [options]
```

#### 主命令

```
# 初始化（默认命令）
npx zcf
npx zcf init
npx zcf i        # 缩写

# 更新工作流
npx zcf update
npx zcf u        # 缩写

# 交互式菜单（v2.9.9+）
npx zcf
# → 进入主菜单，选择操作
```

#### 选项参数

```
# 语言相关
--lang, -l <lang>           # 设置脚本语言（zh-CN, en）
--config-lang, -c <lang>    # 设置配置文件语言
--all-lang <lang>           # 设置所有语言（覆盖其他设置）

# 配置相关
--force, -f                 # 强制覆盖现有配置
--skip-prompt, -s           # 跳过交互式提示（用于脚本）

# API 相关
--provider, -p <provider>   # 指定 API 提供商
--api-key, -k <key>         # 指定 API Key
--api-url, -u <url>         # 指定 API URL（自定义提供商）

# 目标工具
--target, -T <tool>         # 指定目标工具（cc=Claude Code, cx=Codex）

# 信息
--help, -h                  # 显示帮助信息
--version, -v               # 显示版本号
```

### 常用场景示例

#### 场景 1：首次安装（完整交互）

```
# 适合：第一次使用，希望了解每个选项
npx zcf
```

#### 场景 2：快速安装（跳过交互）

```
# 适合：已经知道要配置什么，快速部署
npx zcf i -s -p 302ai -k "sk-xxx" -c en
```

#### 场景 3：更新配置但保留 API

```
# 适合：工作流有更新，但不想重新配置 API
npx zcf u
```

#### 场景 4：切换配置语言

```
# 从中文切换到英文（降低 Token 消耗）
npx zcf u -c en

# 从英文切换到中文（更容易理解）
npx zcf u -c zh-CN
```

#### 场景 5：强制重新配置

```
# 适合：配置出错，需要重新开始
npx zcf -f

# 使用特定语言强制重新配置
npx zcf -f -c en
```

#### 场景 6：配置 Codex

```
# ZCF 2.9.9+ 支持 Codex
npx zcf i -s -T cx -p 302ai -k "sk-xxx"
```

#### 场景 7：多环境配置

```
# 开发环境（中文，方便调试）
npx zcf -c zh-CN -p 302ai -k "sk-dev-xxx"

# 生产环境（英文，降低成本）
npx zcf -c en -p anthropic -k "sk-prod-xxx"
```

---

## 工作流系统

ZCF 的核心价值之一是提供了一套完整的 AI 开发工作流系统。

### 工作流架构

```
~/.claude/
├── CLAUDE.md              # 核心原则文档
├── settings.json          # Claude Code 配置
├── agents/                # AI 代理
│   ├── task-planner.md    # 任务规划师
│   ├── code-reviewer.md   # 代码审查员
│   ├── test-writer.md     # 测试编写员
│   └── ...
└── commands/              # 自定义命令
    ├── workflow.md        # 工作流命令
    ├── init.md           # 初始化命令
    ├── feat.md           # 功能开发命令
    ├── fix.md            # Bug 修复命令
    └── ...
```

### 核心工作流详解

#### 1. 项目初始化工作流 - `/init`

**功能**：为项目生成完整的架构文档。

```
# 在项目根目录运行
claude .

# 在 Claude Code 中运行
/init
```

**生成内容**：

```
.claude/
├── CLAUDE.md              # 项目架构说明
├── tech-stack.md          # 技术栈文档
├── structure.md           # 目录结构
└── conventions.md         # 编码规范
```

**示例输出**（CLAUDE.md）：

```
# 项目：我的 Web 应用

## 技术栈
- 前端：React 18 + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- 数据库：PostgreSQL + Prisma ORM
- 部署：Docker + Kubernetes

## 目录结构
\`\`\`
project/
├── src/
│   ├── frontend/      # React 应用
│   ├── backend/       # Express API
│   └── shared/        # 共享类型定义
├── tests/
├── docker/
└── docs/
\`\`\`

## 开发规范
- 遵循 SOLID 原则
- 使用 ESLint + Prettier
- Git Commit 规范：Conventional Commits
- 代码审查：至少一人审批
```

**最佳实践**：

- ✅ 项目启动后立即运行 `/init`
- ✅ 团队新成员加入时参考此文档
- ✅ 架构变更后及时更新

#### 2. 功能开发工作流 - `/feat`

**功能**：分为 plan 和 ui 两个阶段的完整功能开发。

```
/feat 实现用户登录功能，支持邮箱和手机号登录
```

**工作流程**：

```
Phase 1: Plan（规划阶段）
┌──────────────────────────────┐
│ 1. 需求分析                  │
│    • 理解功能需求             │
│    • 识别技术约束             │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ 2. 架构设计                  │
│    • 数据模型设计             │
│    • API 接口设计             │
│    • 组件设计                 │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ 3. 任务分解                  │
│    • 拆分为可执行的子任务     │
│    • 确定实现顺序             │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ 4. 生成计划文档              │
│    .claude/plan/login.md     │
└──────────────────────────────┘
           ↓
Phase 2: Implementation（实现阶段）
┌──────────────────────────────┐
│ 5. 按计划实现代码            │
│    • 创建必要的文件           │
│    • 实现核心逻辑             │
│    • 编写单元测试             │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ 6. 代码审查                  │
│    • 自动运行 lint            │
│    • 检查测试覆盖率           │
└──────────────────────────────┘
           ↓
┌──────────────────────────────┐
│ 7. 创建 Git 分支             │
│    feature/user-login         │
└──────────────────────────────┘
```

**生成的计划文档示例**：

```
# 功能：用户登录

## 需求分析
- 支持邮箱登录
- 支持手机号登录
- JWT Token 认证
- 记住登录状态（7天）

## 技术方案
### 数据模型
\`\`\`typescript
interface LoginRequest {
  identifier: string;  // 邮箱或手机号
  password: string;
  rememberMe?: boolean;
}
\`\`\`

### API 接口
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### 实现步骤
1. 创建 User 数据模型（Prisma Schema）
2. 实现登录 API（Express Controller）
3. 实现 JWT Token 生成和验证
4. 创建登录表单组件（React）
5. 集成状态管理（Redux/Context）
6. 编写单元测试
7. 编写集成测试

## 预计工时：4-6 小时
```

#### 3. 完整工作流 - `/workflow`

**功能**：最灵活的工作流，每一步都会征求用户意见。

```
/workflow 重构用户认证模块，提升性能和安全性
```

**特点**：

- 🎯 提供多套方案供选择
- 💬 每一步都可以调整
- 🎨 完全掌控开发过程
- 📊 实时反馈进度

**交互示例**：

```
AI: 我分析了当前的认证模块，识别出以下问题：
1. 密码存储使用 MD5（不安全）
2. 没有防暴力破解机制
3. Session 管理效率低

我提供三个重构方案：

方案 A：渐进式改进
- 升级到 bcrypt
- 添加速率限制
- 优化 Session 存储
预计工时：2-3 天
风险：低

方案 B：全面升级
- 使用 JWT + Refresh Token
- 集成 Redis 缓存
- 添加 OAuth 2.0 支持
预计工时：5-7 天
风险：中

方案 C：完全重写
- 采用微服务架构
- 独立认证服务
- 支持多因素认证
预计工时：10-15 天
风险：高

你希望采用哪个方案？或者你有其他想法？
```

#### 4. Bug 修复工作流 - `/fix`

**功能**：系统化的 Bug 修复流程。

```
/fix 用户登出后 Token 仍然有效
```

**工作流程**：

```
1. 问题重现
   • 创建最小重现步骤
   • 记录错误日志

2. 根因分析
   • 定位问题代码
   • 分析影响范围

3. 创建 GitHub Issue
   • 自动生成 Issue
   • 包含重现步骤和分析

4. 创建修复分支
   • 命名：fix/token-invalidation

5. 实现修复
   • 修改代码
   • 添加测试用例

6. 验证修复
   • 运行测试
   • 手动验证

7. 创建 PR
   • 关联 Issue
   • 请求审查
```

#### 5. 测试驱动开发 - `/tdd`

**功能**：严格遵循 TDD 红-绿-重构循环。

```
/tdd 实现购物车加入商品功能
```

**TDD 循环**：

```
红色阶段（测试失败）
┌────────────────────────────┐
│ 1. 编写失败的测试           │
│    it('should add item')    │
└────────────────────────────┘
         ↓
绿色阶段（测试通过）
┌────────────────────────────┐
│ 2. 实现最小可行代码         │
│    function addItem() {...} │
└────────────────────────────┘
         ↓
重构阶段（优化代码）
┌────────────────────────────┐
│ 3. 改进代码结构             │
│    • 提取通用逻辑           │
│    • 优化性能               │
└────────────────────────────┘
         ↓
         └───── 循环 ─────┘
```

#### 6. 其他实用工作流

```
# 代码审查
/review

# 文档更新
/docs

# 版本发布
/release

# 性能优化
/perf

# 安全审计
/security
```

### 直接执行任务（不使用工作流）

```
# 适合小任务、快速修复
<任务描述>

# 示例
修复导航栏在移动端的样式问题
```

**特点**：

- 遵循 SOLID、KISS、DRY 和 YAGNI 原则
- 适合 Bug 修复等小任务
- 无需创建计划文档
- 快速执行

---

## MCP 服务集成

### 什么是 MCP？

**MCP（Model Context Protocol）** 是一个协议，让 AI 模型能够安全地访问外部工具和数据源。

```
┌─────────────┐      MCP      ┌──────────────┐
│ Claude Code │ ←──────────→  │ 外部服务     │
│             │   Protocol    │ • GitHub     │
│             │               │ • 文档库     │
│             │               │ • 浏览器     │
│             │               │ • 搜索引擎   │
└─────────────┘               └──────────────┘
```

### ZCF 支持的 MCP 服务

#### 1. Context7 - 文档查询服务

**功能**：查询最新的编程库文档和代码示例。

**使用场景**：

```
# 在 Claude Code 中
"帮我查询 React 18 的 useTransition Hook 用法"

# AI 会自动：
1. 调用 Context7 MCP 服务
2. 搜索 React 官方文档
3. 获取最新的示例代码
4. 结合文档给出答案
```

**配置**：

```
# 安装时选择 Context7
npx zcf
# → 选择 MCP 服务
# → ☑ Context7 文档查询
```

#### 2. DeepWiki - GitHub 仓库查询

**功能**：深度查询 GitHub 仓库的文档、代码和最佳实践。

**使用场景**：

```
"分析 Next.js 仓库的 App Router 实现原理"

# AI 会：
1. 通过 DeepWiki 访问 Next.js 仓库
2. 分析相关源代码
3. 提取架构设计
4. 给出详细解释
```

**典型用例**：

- 学习开源项目架构
- 查找实现细节
- 研究最佳实践
- 贡献开源项目

#### 3. Playwright - 浏览器控制

**功能**：让 AI 直接控制浏览器进行自动化操作。

**使用场景**：

```
"帮我写一个测试脚本，验证登录流程"

# AI 会通过 Playwright：
1. 打开浏览器
2. 导航到登录页面
3. 填写表单
4. 提交并验证结果
5. 生成测试代码
```

**典型用例**：

- 端到端测试
- Web 自动化
- 截图和 PDF 生成
- 性能测试

#### 4. Exa AI - 智能搜索

**功能**：使用 Exa AI 进行高质量的网页搜索。

**使用场景**：

```
"查找关于微服务架构的最新技术文章"

# AI 会：
1. 通过 Exa AI 搜索
2. 过滤高质量内容
3. 总结关键要点
4. 提供参考链接
```

### MCP 配置管理

#### 查看已安装的 MCP 服务

```
# 查看配置文件
cat ~/.claude/settings.json
```

```
{
  "mcpServers": {
    "context7": {
      "command": "context7-server",
      "args": []
    },
    "deepwiki": {
      "command": "deepwiki-server",
      "args": ["--token", "xxx"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

#### 添加自定义 MCP 服务

```
# 1. 编辑配置文件
vi ~/.claude/settings.json

# 2. 添加新服务
{
  "mcpServers": {
    "my-custom-service": {
      "command": "node",
      "args": ["/path/to/my-service.js"]
    }
  }
}

# 3. 重启 Claude Code
claude restart
```

---

## 高级配置

### 自定义工作流

#### 创建自定义命令

```
# 1. 创建命令文件
mkdir -p ~/.claude/commands
vi ~/.claude/commands/deploy.md
```

```
# 命令：/deploy

## 描述
将应用部署到生产环境

## 步骤
1. 运行测试套件
2. 构建生产版本
3. 更新环境变量
4. 部署到服务器
5. 验证部署状态
6. 发送部署通知

## 使用示例
\`\`\`
/deploy staging
/deploy production
\`\`\`

## 注意事项
- 部署前确保所有测试通过
- 备份当前生产数据库
- 准备回滚方案
```

#### 创建自定义 Agent

```
# 1. 创建 Agent 文件
vi ~/.claude/agents/security-auditor.md
```

```
# Agent：安全审计员

## 角色
你是一位经验丰富的安全工程师，专注于代码安全审计。

## 职责
- 识别常见安全漏洞（SQL注入、XSS、CSRF等）
- 检查依赖包的安全性
- 验证身份认证和授权逻辑
- 审查敏感数据处理
- 提供安全加固建议

## 工作流程
1. 扫描代码库
2. 识别潜在风险
3. 评估风险等级
4. 提供修复方案
5. 生成安全报告

## 工具
- npm audit
- Snyk
- OWASP ZAP
- SonarQube
```

### 环境变量配置

```
# 创建环境配置文件
vi ~/.claude/.env
```

```
# API 配置
CLAUDE_API_KEY=sk-xxx
CLAUDE_API_URL=https://api.anthropic.com

# MCP 服务配置
EXA_API_KEY=xxx
GITHUB_TOKEN=ghp_xxx

# 项目配置
DEFAULT_BRANCH=main
COMMIT_CONVENTION=conventional

# 通知配置
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx
EMAIL_NOTIFICATION=enabled
```

### 多项目配置

```
# 项目 A（中文配置）
cd ~/projects/project-a
claude .
# 使用 ~/.claude 中的中文配置

# 项目 B（英文配置）
cd ~/projects/project-b
# 创建项目专属配置
mkdir .claude
npx zcf u -c en
# 使用项目目录下的 .claude 配置
```

### WSL 支持

ZCF 完整支持 Windows Subsystem for Linux：

**特性**：

- ✅ 智能检测 WSL 环境
- ✅ 自动识别发行版（Ubuntu、Debian 等）
- ✅ 原生 Linux 风格安装体验
- ✅ 多层环境检测（环境变量、系统文件、挂载点）

```
# 在 WSL 中使用
wsl
npx zcf

# ZCF 会自动：
1. 检测 WSL 环境
2. 调整配置路径
3. 优化文件权限
4. 配置跨平台兼容性
```

**Windows MCP 连接问题修复**：

```
# 如果在 Windows 上遇到 MCP 连接问题
npx zcf

# ZCF 会自动修复配置格式
```

---

## 最佳实践

### 1. 配置语言选择

```
# ✅ 推荐：生产环境使用英文
npx zcf -c en
# 原因：Token 消耗降低 20-30%

# ✅ 推荐：学习阶段使用中文
npx zcf -c zh-CN
# 原因：更容易理解和调试

# ⚠️ 建议：团队统一语言
# 避免配置不一致导致的问题
```

### 2. 工作流使用策略

```
# 🎯 大型功能开发
/workflow 实现完整的用户系统

# 🚀 常规功能开发
/feat 添加邮件通知功能

# 🐛 Bug 修复
/fix 修复支付金额计算错误

# ⚡ 快速修改
修复按钮点击事件

# 📚 项目初始化
/init
```

### 3. MCP 服务选择

```
# 最小化安装（基础开发）
- Context7（查文档）

# 标准安装（Web 开发）
- Context7（查文档）
- DeepWiki（学习开源项目）
- Playwright（E2E 测试）

# 完整安装（复杂项目）
- 全部安装
```

### 4. 配置更新策略

```
# 📅 定期更新（推荐：每月）
npx zcf u

# 🔄 版本升级时强制更新
npx zcf -f

# 💾 更新前备份
# ZCF 自动备份到 ~/.claude/backup/
# 可以手动恢复：
cp -r ~/.claude/backup/latest/* ~/.claude/
```

### 5. 团队协作规范

#### 配置同步

```
# 方案 A：Git 仓库管理
cd ~/.claude
git init
git add .
git commit -m "Initial Claude config"
git remote add origin git@github.com:team/claude-config.git
git push

# 其他成员同步
git clone git@github.com:team/claude-config.git ~/.claude
```

#### 配置模板

```
# 创建团队配置模板
team-config/
├── .claude-template/
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── agents/
│   └── commands/
└── setup.sh

# setup.sh
#!/bin/bash
cp -r .claude-template ~/.claude
npx zcf u
```

### 6. 性能优化

```
# 使用英文配置（降低 Token 消耗）
npx zcf u -c en

# 选择合适的模型
# 在 Claude Code 中配置：
# - Default：自动选择（推荐）
# - Sonnet：快速响应，成本适中
# - Opus：最高质量，成本较高

# 优化上下文
# 使用 .claudeignore 排除不必要的文件
vi .claudeignore
```

```
# .claudeignore
node_modules/
.git/
dist/
build/
*.log
.env.local
```

### 7. 安全最佳实践

```
# ⚠️ 不要将 API Key 提交到 Git
echo ".claude/settings.json" >> .gitignore

# ✅ 使用环境变量
export CLAUDE_API_KEY=sk-xxx
npx zcf i --skip-prompt

# ✅ 定期轮换 API Key
# 在 API 提供商控制台定期更换

# ✅ 限制 API Key 权限
# 使用最小权限原则
```

---

## 常见问题

### Q1: 如何卸载 ZCF？

```
# v2.9.9+ 提供完整卸载功能
npx zcf uninstall

# 或通过主菜单
npx zcf
# → 选择卸载选项

# 卸载选项：
# 1. 仅删除配置文件
# 2. 完全移除（包括 Claude Code）

# 支持安全回收站删除（Windows/macOS/Linux/Termux）
```

### Q2: 配置文件在哪里？

```
# 主配置目录
~/.claude/
├── CLAUDE.md          # 核心原则
├── settings.json      # Claude Code 配置
├── agents/            # AI 代理
├── commands/          # 自定义命令
└── backup/            # 配置备份

# 查看配置
ls -la ~/.claude
cat ~/.claude/CLAUDE.md
```

### Q3: 如何切换 API 提供商？

```
# 方法 1：重新初始化
npx zcf -f

# 方法 2：手动编辑
vi ~/.claude/settings.json

# 修改 API 配置
{
  "apiProvider": "302ai",
  "apiKey": "sk-new-key",
  "apiUrl": "https://new-api-url.com"
}
```

### Q4: 工作流没有生效？

```
# 1. 检查配置文件
ls -la ~/.claude/commands/

# 2. 验证语法
cat ~/.claude/commands/workflow.md

# 3. 重启 Claude Code
claude restart

# 4. 重新导入工作流
npx zcf u
```

### Q5: MCP 服务连接失败？

```
# 1. Windows 用户：自动修复
npx zcf

# 2. 检查服务安装
npx context7-server --version
npx playwright --version

# 3. 查看日志
claude logs

# 4. 重新配置 MCP
vi ~/.claude/settings.json
```

### Q6: 如何贡献自定义工作流？

```
# 1. Fork 仓库
git clone https://github.com/your-username/zcf.git

# 2. 创建工作流
cd zcf/templates/en/commands
vi my-workflow.md

# 3. 提交 PR
git add .
git commit -m "feat: add my-workflow"
git push origin feature/my-workflow

# 4. 在 GitHub 上创建 Pull Request
```

### Q7: 如何更新 ZCF？

```
# npx 会自动使用最新版本
npx zcf

# 如果全局安装，需要更新
npm update -g zcf

# 检查版本
npx zcf --version
```

### Q8: 支持哪些操作系统？

```
# ✅ 完全支持
- macOS（Intel + Apple Silicon）
- Linux（Ubuntu, Debian, Fedora, Arch 等）
- Windows 10/11
- WSL1/WSL2
- Termux（Android）

# ✅ 自动检测和适配
ZCF 会自动检测操作系统并调整配置
```

### Q9: Token 消耗太高怎么办？

```
# 1. 切换到英文配置
npx zcf u -c en
# 节省 20-30% Token

# 2. 使用 .claudeignore 排除文件
vi .claudeignore

# 3. 选择合适的模型
# Default 或 Sonnet（而不是 Opus）

# 4. 精简工作流
# 删除不需要的 commands 和 agents
```

### Q10: 如何在 CI/CD 中使用？

```
# GitHub Actions 示例
name: Deploy with ZCF

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Configure Claude Code
        run: |
          npx zcf i -s \
            -p 302ai \
            -k ${{ secrets.CLAUDE_API_KEY }} \
            -c en
      
      - name: Run deployment
        run: |
          claude /deploy production
```

---

## 总结

### 🎯 ZCF 的核心价值

1. **零配置体验**

   - 5 分钟完成 Claude Code 配置
   - 自动化安装和配置流程
   - 智能检测和适配环境
2. **专业工作流**

   - 内置多个开发工作流
   - 支持自定义命令和 Agent
   - 遵循最佳实践
3. **多语言支持**

   - 中英文双语
   - 灵活切换
   - 降低 Token 消耗
4. **MCP 服务集成**

   - 一键安装 MCP 服务
   - 扩展 AI 能力
   - 访问外部工具和数据
5. **持续更新**

   - 活跃的社区
   - 频繁的功能更新
   - 完善的文档

### 📊 使用场景总结

| 场景 | 推荐命令 | 配置建议 |
| --- | --- | --- |
| **首次使用** | `npx zcf` | 选择中文，全面了解 |
| **生产环境** | `npx zcf -c en` | 英文配置，降低成本 |
| **快速部署** | `npx zcf i -s -p 302ai -k xxx` | 跳过交互 |
| **更新工作流** | `npx zcf u` | 保留 API 配置 |
| **团队协作** | `npx zcf -c en -f` | 统一英文配置 |
| **CI/CD** | `npx zcf i -s` | 自动化部署 |

### 🚀 下一步行动

#### 新手入门

```
# 1. 安装配置
npx zcf

# 2. 创建测试项目
mkdir test-project && cd test-project
claude .

# 3. 初始化项目
/init

# 4. 尝试简单任务
创建一个 Hello World 组件

# 5. 学习工作流
/feat 添加一个按钮组件
```

#### 进阶使用

```
# 1. 优化配置
npx zcf u -c en

# 2. 配置 MCP 服务
# 选择 Context7 + DeepWiki + Playwright

# 3. 创建自定义工作流
vi ~/.claude/commands/my-workflow.md

# 4. 集成到团队
# 创建团队配置模板
```

### 📚 资源链接

- **GitHub 仓库**：https://github.com/UfoMiao/zcf
- **Issue 追踪**：https://github.com/UfoMiao/zcf/issues
- **Claude Hub**：https://www.claude-hub.com/resource/github-cli-UfoMiao-zcf-zcf/
- **赞助商 PackyCode**：使用 "zcf" 优惠码充值享 10% 折扣

### 💬 社区支持

```
# 报告 Bug
https://github.com/UfoMiao/zcf/issues/new

# 功能请求
https://github.com/UfoMiao/zcf/issues/new

# 贡献代码
1. Fork 仓库
2. 创建特性分支
3. 提交 Pull Request
```

### ⭐ Star History

ZCF 自 2025 年 7 月发布以来，已获得 **3.9k+ GitHub Stars**，成为 Claude Code 生态中最受欢迎的配置工具之一。

---

**结语**：ZCF 不仅仅是一个配置工具，它是一套完整的 AI 驱动开发工作流解决方案。通过零配置的理念，让每个开发者都能快速上手 Claude Code，享受 AI 辅助编程带来的效率提升。无论你是 AI 编程新手还是资深开发者，ZCF 都能为你提供价值。

**立即开始你的 AI 编程之旅！** 🚀

```
npx zcf
```

---

*本文基于 ZCF v2.9.9+ 编写，部分功能可能在后续版本中有所变化。*
