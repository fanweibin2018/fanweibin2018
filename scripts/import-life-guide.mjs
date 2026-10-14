// Import a checked-out upstream version. Builds and readers never need GitHub access.
// Usage: node scripts/import-life-guide.mjs /path/to/HowToLiveBetter
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = 'https://github.com/eternity4719/HowToLiveBetter'
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/'
const FIELDS = ['成本', '说人话', '收益', '证据等级', '来源', '备注']
const groups = [
  { id: 'health', title: '健康与急救', description: '日常预防、看病用药，以及紧急时刻的应对。', chapters: [1, 2, 13, 16, 24, 28, 29, 33, 34] },
  { id: 'money', title: '钱与生活保障', description: '少花冤枉钱，了解住房、救助和保障。', chapters: [5, 6, 7, 15] },
  { id: 'focus', title: '时间与精力', description: '睡眠、专注、效率和放松，把精力留给重要的事。', chapters: [3, 4, 22] },
  { id: 'safety', title: '法律与安全', description: '保护财产、账号和人身安全，避开常见红线。', chapters: [8, 9, 14, 21, 32] },
  { id: 'work', title: '工作与学习', description: '工作权益、技能选择、创业和技术实践。', chapters: [11, 12, 19, 23, 26, 31] },
  { id: 'family', title: '家庭与人生阶段', description: '关系、育儿、养老，以及人生变化中的安排。', chapters: [10, 17, 18, 20, 25, 27, 30] }
]
const descriptions = {
  1: '交通安全、家庭防护、疫苗筛查与身体发出的预警。',
  2: '烟酒、运动、睡眠和饮食，逐步调整日常习惯。',
  3: '减少打断和多任务，处理睡眠、人际消耗与痛经。',
  4: '沉没成本、拖延、会议与通勤，重新分配时间。',
  5: '订阅、贷款、保险、理财与消费，算清真正的成本。',
  6: '识别看起来划算、实际缺乏证据或收益的做法。',
  7: '救助、补贴、找工作、医疗保障与欠薪维权。',
  8: '交通事故、诈骗、担保、诉讼与财产保护。',
  9: '信息传播、兼职、无人机与著作权的常见法律边界。',
  10: '择偶、登记、婚检、财产与关系的时间和金钱账。',
  11: '爬虫、源码、接单、竞业、开源许可和网站备案。',
  12: '从注册、合同、用人到退出，控制创业中的风险。',
  13: '心肺复苏、卒中、受伤、中毒与户外险情。',
  14: '二次验证、密码管理、手机丢失与银行卡盗刷。',
  15: '租房押金、产权核验、购房合同与房贷。',
  16: '用药、复查、医保结算与慢性病的长期管理。',
  17: '监护、遗嘱、养老骗局、护理和老人的日常安全。',
  18: '育儿补贴、生育津贴，以及养孩子的时间和支出。',
  19: '加班、年休假、裁员补偿、工伤与社保转移。',
  20: '安全睡眠、喂养、疫苗与新生儿的就医信号。',
  21: '领事保护、境外保险、证件与海外招聘骗局。',
  22: '娱乐场所的安全边界，以及运动、呼吸和社交。',
  23: '教育回报、职业技能、培训补贴与学习方法。',
  24: '转诊、异地就医、病历、医保和医疗救助。',
  25: '死亡证明、殡葬、户口注销与社保公积金待遇。',
  26: '网站资质、备案、数据保护、内容治理与服务器。',
  27: '产检、分娩、生育保险和孩子出生前后的手续。',
  28: '减重、医美、药物和正畸，了解健康与资质边界。',
  29: '面对丧亲、重病、失业与离婚时的支持和安排。',
  30: '校园安全、视力、睡眠、心理健康与孩子的教育。',
  31: '就业、升学、基层服务、灵活就业和职业保障。',
  32: '留学身份、打工、保险与学历认证。',
  33: '康复、照护、无障碍、就业与可申请的待遇。',
  34: '退烧药、感冒药、抗生素与常备药的使用边界。'
}

export function parseChapter(raw, filename) {
  const text = raw.replace(/\r\n/g, '\n')
  const heading = text.match(/^# (\d+)\. (.+)$/m)
  if (!heading) throw new Error(`${filename}: 缺少章节标题`)
  const matches = [...text.matchAll(/^### (\d+)\. (.+)$/gm)]
  if (!matches.length) throw new Error(`${filename}: 没有建议条目`)
  const seen = new Set()
  let outro = ''
  const entries = matches.map((match, index) => {
    const number = Number(match[1])
    if (seen.has(number)) throw new Error(`${filename}: 重复条号 ${number}`)
    seen.add(number)
    let body = text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length)
    // A chapter can have an appendix after its final entry (currently chapter 26).
    if (index === matches.length - 1) {
      const appendix = body.search(/^## (?!#)/m)
      if (appendix >= 0) {
        outro = body.slice(appendix).trim()
        body = body.slice(0, appendix)
      }
    }
    const tagsLine = body.match(/<!-- 成本标签:\s*(.*?)\s*-->/)
    const tags = Object.fromEntries([...(tagsLine?.[1] ?? '').matchAll(/(\S+)=(\S+)/g)].map(m => [m[1], m[2]]))
    const fieldMatches = [...body.matchAll(/^- ([^：\n]+)：/gm)]
    const fields = Object.fromEntries(fieldMatches.map((m, i) => [
      m[1], body.slice(m.index + m[0].length, fieldMatches[i + 1]?.index ?? body.length).trim()
    ]))
    for (const field of FIELDS) {
      if (!fields[field]) throw new Error(`${filename}: 第 ${number} 条缺少 ${field}`)
    }
    if (!/^[ABC](?:（[^）]+）)?$/.test(fields['证据等级'])) throw new Error(`${filename}: 第 ${number} 条证据等级无法识别`)
    if (fieldMatches.length !== FIELDS.length) throw new Error(`${filename}: 第 ${number} 条字段格式有变化，请检查`)
    return { number, title: match[2], tags, fields }
  })
  return {
    number: Number(heading[1]), title: heading[2], filename,
    intro: text.slice(heading.index + heading[0].length, matches[0].index).trim(),
    entries, outro
  }
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sourceLinks(markdown, version) {
  return markdown.replace(/\]\((\.\.?\/[^)\s]+)\)/g, (_, target) => {
    if (target === '../README.md') return '](/life/)'
    const resolved = path.posix.normalize(path.posix.join('book', target))
    if (resolved.startsWith('book/')) {
      const number = resolved.match(/\/([0-9]+)-/)?.[1]
      if (number) return `](/life/chapter-${number.padStart(2, '0')})`
    }
    return `](${REPO}/blob/${version.commit}/${encodeURI(resolved)})`
  })
}

export function renderChapter(chapter, version) {
  const number = String(chapter.number).padStart(2, '0')
  const sourceUrl = `${REPO}/blob/${version.commit}/book/${encodeURIComponent(chapter.filename)}`
  const entryMarkdown = chapter.entries.map(entry => {
    const evidenceLabel = entry.fields['证据等级']
    const evidence = evidenceLabel[0]
    const money = entry.tags['钱'] === '0' ? '不花钱' : `花钱：${entry.tags['钱'] ?? '见成本'}`
    const labels = [`证据 ${evidenceLabel}`, money, `用时：${entry.tags['时间'] ?? '见成本'}`]
    const badges = labels.map((label, index) => `<span${index === 0 ? ` class="life-evidence life-evidence-${evidence.toLowerCase()}"` : ''}>${escapeHtml(label)}</span>`).join('')
    return `## ${entry.number}. ${entry.title} {#item-${entry.number}}

<div class="life-entry-tags">${badges}</div>

::: tip 说人话
${entry.fields['说人话']}
:::

**成本**

${entry.fields['成本']}

**补充说明**

${entry.fields['备注']}

::: details 详细收益与原始来源

**收益**

${entry.fields['收益']}

**来源**

${entry.fields['来源']}

:::
`
  }).join('\n')
  return sourceLinks(`---
title: ${JSON.stringify(chapter.title)}
description: ${JSON.stringify(descriptions[chapter.number] ?? chapter.title)}
pageClass: life-chapter
comments: false
lastUpdated: false
outline: 2
prev: ${JSON.stringify({ text: '返回指南目录', link: '/life/' })}
next: false
---

[← 高性价比人生目录](/life/)

# ${chapter.title}

<div class="life-chapter-meta">第 ${number} 章 · ${chapter.entries.length} 条建议 · 沿用原书顺序</div>

${chapter.intro}

<div class="life-reading-note">

先读「说人话」和成本，再看补充说明；需要核对时，展开详细收益与来源。[证据分级说明](/life/reading)。

</div>

${entryMarkdown}
${chapter.outro ? `${chapter.outro}\n\n` : ''}
<div class="life-attribution">

内容来源：[eternity4719《高性价比人生指南》](${sourceUrl}) · [CC BY 4.0](${LICENSE})。同步于 ${version.syncedAt}，对应版本 [${version.commit.slice(0, 7)}](${REPO}/commit/${version.commit})。本站调整排版、章节导航与链接，建议正文沿用原文。[阅读说明与适用范围](/life/reading)。

</div>
`, version)
}

function plainText(markdown) {
  return markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '')
}

async function main() {
  const source = process.argv[2]
  if (!source) throw new Error('用法：node scripts/import-life-guide.mjs /path/to/HowToLiveBetter')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  let commit
  try {
    commit = JSON.parse(await fs.readFile(path.join(source, 'version.json'), 'utf8')).commit
  } catch {
    commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  }
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('需要完整的上游 commit SHA，以保留可核对的来源版本')
  const version = { commit, syncedAt: new Date().toISOString().slice(0, 10) }
  const files = (await fs.readdir(path.join(source, 'book'))).filter(f => /^\d+-.*\.md$/.test(f)).sort()
  const chapters = await Promise.all(files.map(async filename => parseChapter(await fs.readFile(path.join(source, 'book', filename), 'utf8'), filename)))
  const entries = chapters.flatMap(c => c.entries)
  const readme = await fs.readFile(path.join(source, 'README.md'), 'utf8')
  const expectedCount = Number(readme.match(/全书 (\d+) 条/)?.[1])
  if (!expectedCount || entries.length !== expectedCount) throw new Error(`条目数与原书不符：导入 ${entries.length} / README ${expectedCount}`)
  if (chapters.some(c => !groups.some(g => g.chapters.includes(c.number)))) throw new Error('上游有新的章节，请先补充主题分类')
  const manifest = {
    ...version, repository: REPO, license: LICENSE, totalEntries: entries.length,
    evidenceCounts: Object.fromEntries(['A', 'B', 'C'].map(grade => [grade, entries.filter(e => e.fields['证据等级'].startsWith(grade)).length])),
    groups,
    chapters: chapters.map(c => ({
      number: c.number, title: c.title, description: descriptions[c.number],
      group: groups.find(g => g.chapters.includes(c.number)).id,
      href: `/life/chapter-${String(c.number).padStart(2, '0')}`,
      count: c.entries.length,
      entries: c.entries.map(e => ({ number: e.number, title: plainText(e.title), summary: plainText(e.fields['说人话']), evidence: e.fields['证据等级'] }))
    }))
  }
  await fs.mkdir(path.join(root, 'docs/life'), { recursive: true })
  await fs.mkdir(path.join(root, 'docs/.vitepress/data'), { recursive: true })
  for (const chapter of chapters) {
    await fs.writeFile(path.join(root, `docs/life/chapter-${String(chapter.number).padStart(2, '0')}.md`), renderChapter(chapter, version))
  }
  await fs.writeFile(path.join(root, 'docs/.vitepress/data/life-guide.json'), JSON.stringify(manifest, null, 2) + '\n')
  // These explanatory sections are quoted in full, including the upstream caveats.
  const sections = ['证据分级', '读懂数字（术语表）'].map(title => {
    const start = readme.indexOf(`## ${title}\n`)
    if (start < 0) throw new Error(`README 缺少「${title}」，请检查上游变化`)
    const end = readme.indexOf('\n## ', start + 1)
    return readme.slice(start, end < 0 ? undefined : end).trim()
  })
  const reading = `---\ntitle: 阅读说明与证据分级\npageClass: life-chapter\ncomments: false\nlastUpdated: false\noutline: 2\nprev: false\nnext: false\n---\n\n[← 高性价比人生目录](/life/)\n\n# 阅读说明与证据分级\n\n本栏目收录 [eternity4719/HowToLiveBetter](${REPO}) 的全部 ${chapters.length} 章、${entries.length} 条建议。它是一份按性价比排列的备选单：根据眼下的需要挑一两条即可，不需要全部照做。\n\n原书的法律、医保和社保内容以中国大陆制度为背景。内容可能过时、可能有错，各地执行也可能不同；实际办事、就医或处理法律问题，请核对当地部门、医生和律师的意见。这是原书注明的适用范围。\n\n每条建议的正文、证据等级与备注沿用原文。本站将「说人话」、成本和补充说明展开呈现，将详细收益与原始来源放在可展开的段落中；章节主题分类与目录摘要由本站整理。\n\n${sections.join('\n\n')}\n\n## 来源与许可\n\n原作者：eternity4719 · [高性价比人生指南](${REPO})。正文许可：[CC BY 4.0](${LICENSE})。本栏目同步于 ${version.syncedAt}，对应上游版本 [${commit.slice(0, 7)}](${REPO}/commit/${commit})；修改范围为排版、章节导航、目录摘要及链接。原书后续更新可在 [GitHub 仓库](${REPO}) 查看。\n`
  await fs.writeFile(path.join(root, 'docs/life/reading.md'), sourceLinks(reading, version))
  console.log(`已导入 ${chapters.length} 章、${entries.length} 条；版本 ${commit.slice(0, 7)}；证据 A/B/C：${Object.values(manifest.evidenceCounts).join('/')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
