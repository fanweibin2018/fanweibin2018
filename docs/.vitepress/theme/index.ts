// Custom theme extending VitePress DefaultTheme.
// https://vitepress.dev/guide/extending-default-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import BlogHome from './components/BlogHome.vue'
import PostList from './components/PostList.vue'
import TagCloud from './components/TagCloud.vue'
import Archive from './components/Archive.vue'
import Categories from './components/Categories.vue'
import PostMeta from './components/PostMeta.vue'
import SeriesNav from './components/SeriesNav.vue'
import RelatedPosts from './components/RelatedPosts.vue'
import Comments from './components/Comments.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // 文章顶部：日期/阅读时间/标签 + 时效性提示 + 系列导航
      'doc-before': () => [h(PostMeta), h(SeriesNav)],
      // 文章底部：相关文章 + 评论
      'doc-after': () => [h(RelatedPosts), h(Comments)]
    })
  },
  enhanceApp({ app }) {
    app.component('BlogHome', BlogHome)
    app.component('PostList', PostList)
    app.component('TagCloud', TagCloud)
    app.component('Archive', Archive)
    app.component('Categories', Categories)
    app.component('PostMeta', PostMeta)
    app.component('SeriesNav', SeriesNav)
    app.component('RelatedPosts', RelatedPosts)
    app.component('Comments', Comments)
  }
} satisfies Theme
