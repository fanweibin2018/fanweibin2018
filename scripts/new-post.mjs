#!/usr/bin/env node
// 新建文章骨架。
// 用法:
//   node scripts/new-post.mjs <slug> [标题]
//   node scripts/new-post.mjs zellij-starship "Zellij 进阶配置"
//
// 如果只给 slug，会把 slug 作为占位标题。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const postsDir = path.join(root, 'docs/posts')

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('用法: node scripts/new-post.mjs <slug> [标题]')
  process.exit(1)
}

const slug = args[0].replace(/[^A-Za-z0-9_-]/g, '-')
const title = args.slice(1).join(' ') || slug
const today = new Date().toISOString().slice(0, 10)
const filename = `${today}-${slug}.md`
const filepath = path.join(postsDir, filename)

if (fs.existsSync(filepath)) {
  console.error(`文件已存在: ${filepath}`)
  process.exit(1)
}

const tpl = `---
title: '${title.replace(/'/g, "''")}'
date: ${today}
slug: '${slug}'
description: ''
categories:
  - ''
tags:
  - ''
# draft: true           # 打开后该文章不会在生产构建出现
# featured: true        # 置顶到首页"精选"区
# series: ''            # 所属系列名
# seriesIndex: 1        # 在系列中的序号
# evergreen: true       # 标记长青文，抑制"时效性警告"
# comments: false       # 关闭本文评论
# image: /images/...    # 自定义 OG 卡片图
---

<!-- 正文从这里开始，第一段建议 2-3 句，会成为默认摘要 -->

## 前言

## 一、...

## 小结
`

fs.writeFileSync(filepath, tpl, 'utf-8')
console.log(`已创建: docs/posts/${filename}`)
console.log(`本地预览: pnpm docs:dev`)
