// Build-time data loader for every blog post.
// See: https://vitepress.dev/guide/data-loading
import { createContentLoader } from 'vitepress'

export interface Post {
  title: string
  url: string
  date: string           // ISO YYYY-MM-DD
  dateDisplay: string    // localized
  excerpt: string
  tags: string[]
  categories: string[]
  wordCount: number      // 正文字符数（中文字 + 英文单词近似）
  readingTime: number    // 分钟
  featured: boolean
  series?: string
  seriesIndex?: number
}

declare const data: Post[]
export { data }

// 300 汉字/分钟，英文按单词计 220/min
function estimateReading(text: string): { words: number; minutes: number } {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = (text.match(/[A-Za-z0-9_]+/g) || []).length
  const minutes = Math.max(1, Math.round(chinese / 300 + englishWords / 220))
  return { words: chinese + englishWords, minutes }
}

// 归一化 YAML 里未加引号的 `date: 2026-04-15` Date 对象 → YYYY-MM-DD
function toIsoDate(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') return v.slice(0, 10)
  return ''
}

export default createContentLoader('posts/*.md', {
  excerpt: false,
  includeSrc: true,
  transform(raw): Post[] {
    const isDev = process.env.NODE_ENV !== 'production'
    return raw
      .filter((p) => !p.url.endsWith('/posts/')) // skip archive index
      .filter((p) => {
        const fm = p.frontmatter || {}
        // 生产环境隐藏 draft: true
        return isDev || !fm.draft
      })
      .map((p) => {
        const fm = p.frontmatter || {}
        const isoDate = toIsoDate(fm.date)
        const d = isoDate ? new Date(isoDate + 'T00:00:00Z') : null

        // 正文（去除 frontmatter 之后）估算阅读时间
        const body = (p.src || '').replace(/^---[\s\S]*?---/, '')
        const { words, minutes } = estimateReading(body)

        return {
          title: (fm.title as string) || p.url.split('/').pop() || '',
          url: p.url.replace(/\.html$/, ''),
          date: isoDate,
          dateDisplay: d
            ? d.toLocaleDateString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
              })
            : '',
          excerpt: (fm.description as string) || '',
          tags: Array.isArray(fm.tags)
            ? (fm.tags as string[]).map((t) => t.trim()).filter(Boolean)
            : [],
          categories: Array.isArray(fm.categories)
            ? (fm.categories as string[]).map((c) => c.trim()).filter(Boolean)
            : [],
          wordCount: words,
          readingTime: minutes,
          featured: Boolean(fm.featured),
          series: typeof fm.series === 'string' && fm.series ? fm.series : undefined,
          seriesIndex: typeof fm.seriesIndex === 'number' ? fm.seriesIndex : undefined
        }
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }
})
