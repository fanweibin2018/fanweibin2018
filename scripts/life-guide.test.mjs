import assert from 'node:assert/strict'
import test from 'node:test'

const importer = await import('./import-life-guide.mjs').catch(() => ({}))
const version = { commit: 'a'.repeat(40), syncedAt: '2026-10-13' }
const sample = `[← 回总目录](../README.md)

# 14. 账号与信息安全

账号安全的介绍。[延伸阅读](../docs/账号安全.md)。

### 1. 邮箱开二次验证
<!-- 成本标签: 钱=0 时间=少 毅力=否 收益=大 口径=金钱 -->
- 成本：不花钱。设置两分钟。
- 说人话：登录时再确认一次是不是本人。
- 收益：拦住超过 94% 的钓鱼尝试。
- 证据等级：A
- 来源：原始研究。<https://doi.org/10.1016/S0140-6736(15)01225-8>
- 备注：先保存恢复码。见第 8 节第 45 条。

### 2. 邮箱密码不重复
<!-- 成本标签: 钱=0 时间=少 毅力=些 收益=大 口径=金钱 -->
- 成本：不花钱。
- 说人话：别让一个密码泄露拖累所有账号。
- 收益：每个账号用不同密码。
- 证据等级：C
- 来源：<https://www.cisa.gov/secure-our-world/use-strong-passwords>
- 备注：用密码管理器。

## 许可

正文按 [CC BY 4.0](../LICENSE) 发布。
`

test('导入完整保留建议、六个字段及末尾补充内容', () => {
  assert.equal(typeof importer.parseChapter, 'function', '需要实现章节导入')
  const chapter = importer.parseChapter(sample, '14-账号与信息安全.md')
  assert.equal(chapter.number, 14)
  assert.equal(chapter.title, '账号与信息安全')
  assert.equal(chapter.entries.length, 2)
  assert.equal(chapter.entries[0].fields['备注'], '先保存恢复码。见第 8 节第 45 条。')
  assert.equal(chapter.entries[1].fields['证据等级'], 'C')
  assert.equal(chapter.entries[0].tags['钱'], '0')
  assert.match(chapter.intro, /账号安全的介绍/)
  assert.match(chapter.outro, /CC BY 4\.0/)
})

test('字段不全时拒绝导入，避免静默遗漏证据和来源', () => {
  assert.equal(typeof importer.parseChapter, 'function', '需要实现章节导入')
  assert.throws(() => importer.parseChapter(sample.replace('- 来源：原始研究。<https://doi.org/10.1016/S0140-6736(15)01225-8>\n', ''), '14-账号与信息安全.md'), /第 1 条.*来源/)
})

test('重复条号拒绝导入，避免阅读链接定位到错误条目', () => {
  assert.equal(typeof importer.parseChapter, 'function', '需要实现章节导入')
  assert.throws(() => importer.parseChapter(sample.replace('### 2.', '### 1.'), '14-账号与信息安全.md'), /重复.*1/)
})

test('证据等级的争议和限制说明保留原文，统计仍归入原等级', () => {
  const chapter = importer.parseChapter(sample.replace('- 证据等级：A', '- 证据等级：A（争议）'), '14-账号与信息安全.md')
  assert.equal(chapter.entries[0].fields['证据等级'], 'A（争议）')
  const output = importer.renderChapter(chapter, version)
  assert.match(output, /证据 A（争议）/)
  assert.match(output, /life-evidence-a"/)
})

test('阅读页保留原始证据链接和可直接定位的建议地址', () => {
  assert.equal(typeof importer.renderChapter, 'function', '需要实现阅读页生成')
  const chapter = importer.parseChapter(sample, '14-账号与信息安全.md')
  const output = importer.renderChapter(chapter, version)
  assert.match(output, /\{#item-1\}/)
  assert.match(output, /\{#item-2\}/)
  assert.match(output, /说人话/)
  assert.match(output, /先保存恢复码/)
  assert.match(output, /::: details 详细收益与原始来源/)
  assert.match(output, /https:\/\/doi.org\/10\.1016\/S0140-6736\(15\)01225-8/)
  assert.match(output, /creativecommons.org\/licenses\/by\/4\.0/)
  assert.match(output, new RegExp(`github.com/eternity4719/HowToLiveBetter/blob/${version.commit}/docs/`))
  assert.doesNotMatch(output, /\]\(\.\.\//)
})
