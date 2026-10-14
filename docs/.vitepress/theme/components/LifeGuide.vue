<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import guide from '../../data/life-guide.json'

const query = ref('')
const selectedGroup = ref('all')
const searchInput = ref<HTMLInputElement | null>(null)
const visibleLimit = ref(24)
const terms = computed(() => query.value.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean))
const isSearching = computed(() => terms.value.length > 0)
const groups = computed(() => guide.groups
  .filter(group => selectedGroup.value === 'all' || selectedGroup.value === group.id)
  .map(group => ({ ...group, chapters: guide.chapters.filter(chapter => chapter.group === group.id) })))
const searchResults = computed(() => {
  if (!isSearching.value) return []
  return guide.chapters
    .filter(chapter => selectedGroup.value === 'all' || chapter.group === selectedGroup.value)
    .flatMap(chapter => chapter.entries
      .filter(entry => {
        const text = `${chapter.title} ${entry.title} ${entry.summary}`.normalize('NFKC').toLowerCase()
        return terms.value.every(term => text.includes(term))
      })
      .map(entry => ({ ...entry, chapter: chapter.title, chapterNumber: chapter.number, href: `${chapter.href}#item-${entry.number}` })))
})
const visibleResults = computed(() => searchResults.value.slice(0, visibleLimit.value))
watch([query, selectedGroup], () => { visibleLimit.value = 24 })

function clearSearch() {
  query.value = ''
  searchInput.value?.focus()
}
function resetFilters() {
  selectedGroup.value = 'all'
  clearSearch()
}
</script>

<template>
  <main class="life-guide">
    <header class="life-hero">
      <div class="life-hero-copy">
        <p class="life-eyebrow">一本按需要翻阅的开源生活指南</p>
        <h1>高性价比人生</h1>
        <p class="life-intro">用更少的钱、时间和精力，换回更多的健康、保障与自由。</p>
        <p class="life-hero-note">从眼下最需要的事开始，挑走一两条就算数。</p>
        <div class="life-hero-actions">
          <a href="/life/chapter-01" class="life-start">从日常健康开始 <span aria-hidden="true">→</span></a>
          <a href="/life/reading" class="life-reading-link">阅读说明与证据分级 <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <dl class="life-stats" aria-label="指南内容统计">
        <div><dt>章节</dt><dd>{{ guide.chapters.length }}<span>章</span></dd></div>
        <div><dt>生活建议</dt><dd>{{ guide.totalEntries }}<span>条</span></dd></div>
        <div><dt>阅读主题</dt><dd>{{ guide.groups.length }}<span>类</span></dd></div>
      </dl>
    </header>

    <p class="life-origin">
      源自 <a :href="guide.repository" target="_blank" rel="noopener noreferrer">GitHub · HowToLiveBetter <span aria-hidden="true">↗</span></a>
      <span class="life-origin-date">同步于 <time :datetime="guide.syncedAt">{{ guide.syncedAt }}</time></span>
    </p>

    <section class="life-browser" aria-label="浏览生活指南">
      <div class="life-search">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <label for="life-search" class="life-sr-only">搜索建议标题和通俗说明</label>
        <input id="life-search" ref="searchInput" v-model="query" type="search" placeholder="搜索你关心的事，比如医保、租房、密码…" autocomplete="off" @keydown.esc="clearSearch" />
        <button v-if="query" type="button" class="life-clear" aria-label="清除搜索" @click="clearSearch">清除</button>
      </div>
      <div class="life-filters" role="group" aria-label="筛选阅读主题">
        <button type="button" :class="{ active: selectedGroup === 'all' }" :aria-pressed="selectedGroup === 'all'" @click="selectedGroup = 'all'">全部主题 <span>{{ guide.chapters.length }} 章</span></button>
        <button v-for="group in guide.groups" :key="group.id" type="button" :class="{ active: selectedGroup === group.id }" :aria-pressed="selectedGroup === group.id" @click="selectedGroup = group.id">{{ group.title }} <span>{{ group.chapters.length }} 章</span></button>
      </div>

      <template v-if="isSearching">
        <p class="life-result-count" role="status" aria-live="polite">找到 {{ searchResults.length }} 条相关建议</p>
        <div v-if="searchResults.length" class="life-result-list">
          <a v-for="entry in visibleResults" :key="entry.href" :href="entry.href" class="life-result">
            <p class="life-result-meta">第 {{ entry.chapterNumber }} 章 · {{ entry.chapter }} <span>证据 {{ entry.evidence }}</span></p>
            <h2>{{ entry.number }}. {{ entry.title }} <span class="life-link-arrow" aria-hidden="true">→</span></h2>
            <p class="life-result-summary">{{ entry.summary }}</p>
          </a>
        </div>
        <div v-else class="life-empty">
          <h2>暂时没有找到相关建议</h2>
          <p>试试更短的关键词，或者切换到全部主题。</p>
          <button type="button" @click="resetFilters">清除搜索与筛选</button>
        </div>
        <button v-if="visibleResults.length < searchResults.length" type="button" class="life-load-more" @click="visibleLimit += 24">再显示 {{ Math.min(24, searchResults.length - visibleResults.length) }} 条建议</button>
      </template>

      <template v-else>
        <section v-for="group in groups" :key="group.id" class="life-topic" :aria-labelledby="`life-topic-${group.id}`">
          <header class="life-topic-heading">
            <h2 :id="`life-topic-${group.id}`">{{ group.title }}<span>{{ group.chapters.length }} 章</span></h2>
            <p>{{ group.description }}</p>
          </header>
          <div class="life-chapter-grid">
            <a v-for="chapter in group.chapters" :key="chapter.number" :href="chapter.href" class="life-chapter-card">
              <span class="life-chapter-number" aria-hidden="true">{{ String(chapter.number).padStart(2, '0') }}</span>
              <div class="life-card-copy">
                <h3>{{ chapter.title }}</h3>
                <p>{{ chapter.description }}</p>
                <span class="life-card-count">{{ chapter.count }} 条建议</span>
              </div>
              <span class="life-link-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </template>
    </section>

    <footer class="life-guide-footer">
      <p>原作者 eternity4719 · <a :href="guide.repository" target="_blank" rel="noopener noreferrer">《高性价比人生指南》</a> · <a :href="guide.license" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
      <p>本站调整排版、主题导航与目录摘要，建议正文沿用原文。<a href="/life/reading">查看来源版本与适用范围 →</a></p>
    </footer>
  </main>
</template>

<style scoped>
.life-guide { max-width: 1080px; margin: 0 auto; padding: 48px 32px 64px; }
.life-hero { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 36px; border: 1px solid var(--vp-c-divider); border-radius: 18px; background: linear-gradient(125deg, var(--vp-c-brand-soft), var(--vp-c-bg) 72%); }
.life-eyebrow { margin: 0 0 12px; color: var(--vp-c-brand-1); font-size: 13px; font-weight: 600; letter-spacing: .06em; }
.life-hero h1 { margin: 0; font-size: 38px; font-weight: 750; line-height: 1.35; letter-spacing: -.03em; }
.life-intro { max-width: 480px; margin: 16px 0 0; color: var(--vp-c-text-1); font-size: 17px; line-height: 1.8; }
.life-hero-note { margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.8; }
.life-hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 16px 20px; margin-top: 24px; font-size: 14px; }
.life-start { display: inline-flex; align-items: center; gap: 16px; padding: 11px 16px; border-radius: 8px; background: var(--vp-c-brand-3); color: var(--vp-c-white); font-weight: 600; transition: background .15s; }
.life-start:hover { background: var(--vp-c-brand-2); }
.life-reading-link { color: var(--vp-c-brand-1); line-height: 1.7; }
.life-reading-link:hover { text-decoration: underline; }
.life-stats { display: grid; gap: 18px; min-width: 130px; margin: 0; padding-left: 28px; border-left: 1px solid var(--vp-c-divider); }
.life-stats dt { color: var(--vp-c-text-2); font-size: 12px; }
.life-stats dd { margin: 5px 0 0; font-size: 28px; font-weight: 650; line-height: 1.15; font-variant-numeric: tabular-nums; }
.life-stats dd span { margin-left: 8px; color: var(--vp-c-text-2); font-size: 13px; font-weight: 400; }
.life-origin { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 16px 0 36px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.8; }
.life-origin a, .life-guide-footer a { color: var(--vp-c-brand-1); }
.life-origin a:hover, .life-guide-footer a:hover { text-decoration: underline; }
.life-origin-date { margin-left: auto; }
.life-search { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); transition: border-color .15s, box-shadow .15s; }
.life-search:focus-within { border-color: var(--vp-c-brand-1); box-shadow: 0 0 0 3px var(--vp-c-brand-soft); }
.life-search svg { width: 21px; height: 21px; flex-shrink: 0; color: var(--vp-c-text-2); }
.life-search input { width: 100%; min-width: 0; font: inherit; font-size: 15px; color: var(--vp-c-text-1); background: transparent; outline: none; }
.life-search input::placeholder { color: var(--vp-c-text-2); }
.life-search input::-webkit-search-cancel-button { display: none; }
.life-clear { flex-shrink: 0; padding: 3px 6px; color: var(--vp-c-brand-1); font-size: 13px; border-radius: 4px; }
.life-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.life-filters button { display: flex; align-items: center; gap: 6px; min-height: 40px; padding: 7px 12px; border: 1px solid var(--vp-c-divider); border-radius: 7px; color: var(--vp-c-text-2); font-size: 13px; transition: background .15s, border-color .15s; }
.life-filters button:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.life-filters button.active { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); font-weight: 600; }
.life-filters button span { font-size: 11px; font-weight: 400; opacity: .85; }
.life-topic { margin-top: 36px; }
.life-topic-heading { margin-bottom: 16px; }
.life-topic-heading h2 { display: flex; align-items: baseline; gap: 12px; margin: 0; font-size: 21px; font-weight: 650; line-height: 1.5; }
.life-topic-heading h2 span { color: var(--vp-c-text-2); font-size: 12px; font-weight: 400; }
.life-topic-heading p { margin: 6px 0 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.7; }
.life-chapter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.life-chapter-card { display: flex; gap: 14px; align-items: flex-start; min-width: 0; padding: 20px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); transition: border-color .15s, background .15s; }
.life-chapter-card:hover { border-color: var(--vp-c-brand-1); background: var(--vp-c-bg-soft); }
.life-chapter-number { flex-shrink: 0; padding-top: 2px; color: var(--vp-c-text-3); font-size: 13px; font-variant-numeric: tabular-nums; }
.life-card-copy { min-width: 0; flex: 1; }
.life-card-copy h3 { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.65; }
.life-card-copy p { margin: 6px 0 12px; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.8; }
.life-card-count { color: var(--vp-c-text-2); font-size: 12px; }
.life-link-arrow { flex-shrink: 0; margin-left: auto; color: var(--vp-c-brand-1); font-size: 16px; font-weight: 400; }
.life-chapter-card > .life-link-arrow { padding-top: 2px; }
.life-result-count { margin: 24px 0 14px; color: var(--vp-c-text-2); font-size: 14px; }
.life-result-list { display: grid; gap: 12px; }
.life-result { display: block; padding: 22px; border: 1px solid var(--vp-c-divider); border-radius: 10px; transition: border-color .15s; }
.life-result:hover { border-color: var(--vp-c-brand-1); }
.life-result-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 9px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; }
.life-result-meta span { color: var(--vp-c-brand-1); }
.life-result h2 { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.7; }
.life-result h2 .life-link-arrow { margin-left: 8px; }
.life-result-summary { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 9px 0 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.85; }
.life-empty { padding: 56px 16px; text-align: center; }
.life-empty h2 { font-size: 18px; font-weight: 600; }
.life-empty p { margin-top: 12px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.8; }
.life-empty button, .life-load-more { margin-top: 18px; padding: 10px 18px; border: 1px solid var(--vp-c-divider); border-radius: 7px; color: var(--vp-c-brand-1); font-size: 14px; }
.life-load-more { display: block; margin: 24px auto 0; }
.life-guide-footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); font-size: 12px; line-height: 1.9; }
.life-guide-footer p { margin: 0 0 5px; }
.life-guide a:focus-visible, .life-guide button:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 4px; }
.life-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 767px) {
  .life-guide { padding: 28px 24px 48px; }
  .life-hero { align-items: stretch; flex-direction: column; gap: 28px; padding: 26px; }
  .life-hero h1 { font-size: 32px; }
  .life-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 18px 0 0; border-left: 0; border-top: 1px solid var(--vp-c-divider); }
  .life-stats dd { font-size: 25px; }
  .life-chapter-grid { grid-template-columns: minmax(0, 1fr); }
  .life-origin-date { margin-left: 0; }
}
@media (max-width: 479px) {
  .life-guide { padding: 20px 16px 40px; }
  .life-hero { padding: 22px 20px; border-radius: 12px; }
  .life-hero h1 { font-size: 29px; }
  .life-intro { font-size: 15px; }
  .life-eyebrow { font-size: 12px; letter-spacing: 0; }
  .life-search { gap: 8px; padding: 13px 12px; }
  .life-search input { font-size: 16px; }
  .life-filters button { padding: 7px 9px; font-size: 12px; }
  .life-topic-heading h2 { font-size: 19px; }
  .life-chapter-card { gap: 10px; padding: 18px 16px; }
  .life-result { padding: 18px 16px; }
}
</style>
