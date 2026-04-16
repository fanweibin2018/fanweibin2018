<script setup lang="ts">
import { data as posts } from '../../../posts/posts.data'
import { computed } from 'vue'
import PostList from './PostList.vue'

const SITE_TAGLINE = '技术、投资、AI 工作流的记录与思考。'

const featured = computed(() => posts.filter((p) => p.featured).slice(0, 5))
const latest = computed(() => {
  const pinnedUrls = new Set(featured.value.map((p) => p.url))
  return posts.filter((p) => !pinnedUrls.has(p.url)).slice(0, 12)
})

const stats = computed(() => {
  const tags = new Set<string>()
  const cats = new Set<string>()
  let totalWords = 0
  for (const p of posts) {
    p.tags.forEach((t) => tags.add(t))
    p.categories.forEach((c) => cats.add(c))
    totalWords += p.wordCount || 0
  }
  return {
    posts: posts.length,
    tags: tags.size,
    cats: cats.size,
    words: totalWords
  }
})
</script>

<template>
  <div class="blog-home">
    <header class="hero">
      <h1>范伟彬 · 写作空间</h1>
      <p class="tagline">{{ SITE_TAGLINE }}</p>
      <div class="stats">
        <span><strong>{{ stats.posts }}</strong> 篇文章</span>
        <span><strong>{{ stats.cats }}</strong> 个分类</span>
        <span><strong>{{ stats.tags }}</strong> 个标签</span>
        <span><strong>{{ (stats.words / 10000).toFixed(1) }}</strong> 万字</span>
      </div>
    </header>

    <section v-if="featured.length" class="home-section featured">
      <div class="section-head">
        <h2>⭐ 精选</h2>
        <a href="/posts/" class="more">全部 →</a>
      </div>
      <ul class="featured-list">
        <li v-for="p in featured" :key="p.url" class="featured-item">
          <a :href="p.url">
            <div class="f-title">{{ p.title }}</div>
            <div v-if="p.excerpt" class="f-excerpt">{{ p.excerpt }}</div>
            <div class="f-meta">
              <time :datetime="p.date">{{ p.dateDisplay }}</time>
              <span v-if="p.readingTime">· {{ p.readingTime }} 分钟</span>
              <span v-for="c in p.categories.slice(0, 1)" :key="c" class="f-cat">· {{ c }}</span>
            </div>
          </a>
        </li>
      </ul>
    </section>

    <section class="home-section">
      <div class="section-head">
        <h2>🆕 最新文章</h2>
        <a href="/posts/" class="more">全部 →</a>
      </div>
      <PostList :posts="latest" />
    </section>
  </div>
</template>

<style scoped>
.blog-home {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}
.hero {
  text-align: center;
  padding: 48px 0 56px;
  border-bottom: 1px dashed var(--vp-c-divider);
  margin-bottom: 40px;
}
.hero h1 {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: 1px;
}
.tagline {
  color: var(--vp-c-text-2);
  margin: 0 0 20px;
}
.stats {
  display: flex;
  justify-content: center;
  gap: 28px;
  flex-wrap: wrap;
  color: var(--vp-c-text-3);
  font-size: 14px;
}
.stats strong {
  color: var(--vp-c-brand-1);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.home-section {
  margin-bottom: 48px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.section-head h2 {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  font-size: 20px;
  font-weight: 600;
}
.more {
  font-size: 13px;
  color: var(--vp-c-text-3);
  text-decoration: none;
}
.more:hover {
  color: var(--vp-c-brand-1);
}
.featured-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}
.featured-item a {
  display: block;
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  text-decoration: none;
  color: inherit;
  transition: border-color .2s, transform .1s;
  background: var(--vp-c-bg-soft);
}
.featured-item a:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-1px);
}
.f-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-bottom: 4px;
}
.f-excerpt {
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.f-meta {
  color: var(--vp-c-text-3);
  font-size: 12px;
  display: flex;
  gap: 6px;
}
</style>
