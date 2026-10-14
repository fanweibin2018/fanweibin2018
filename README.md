## 你好，我是范伟彬

技术、投资与 AI 工作流的记录者。在 [fanweibin.cn](https://fanweibin.cn) 写下日常实践中的思考与踩坑。

### 我在关注与写作

- **后端与 Java** — JDK 新特性、Spring Boot、JVM、数据库与中间件实战
- **Homelab 与自托管** — PVE 装机、NAS、网络代理、异地访问的家庭实验室
- **AI 工作流** — Claude Code、MCP 与 AI 编程工具链的落地经验
- **投资与经营** — 财经观察与中小企业管理方法论

### 链接

- 博客：[fanweibin.cn](https://fanweibin.cn)
- RSS 订阅：[fanweibin.cn/feed.xml](https://fanweibin.cn/feed.xml)
- 本仓库即博客源码，基于 VitePress 构建并部署到 GitHub Pages

<sub>欢迎通过博客评论区交流。</sub>

### 高性价比人生栏目

`/life/` 收录 [eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter) 的章节正文，采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可。来源版本与同步日期记录在 `docs/.vitepress/data/life-guide.json`，页面标注本站对排版、导航和摘要的调整。

更新内容时，先将上游仓库检出到需要同步的版本，再运行：

```bash
node scripts/import-life-guide.mjs /path/to/HowToLiveBetter
pnpm test
pnpm docs:build
```

正文保存在 `docs/life/chapter-*.md`，构建和阅读不依赖实时访问 GitHub。
