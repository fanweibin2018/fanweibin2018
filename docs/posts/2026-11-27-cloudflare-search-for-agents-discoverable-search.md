---
title: 'Cloudflare Search for Agents：给网站增加可发现的 AI 搜索入口'
date: 2026-11-27
slug: 'cloudflare-search-for-agents-discoverable-search'
author: 范伟彬
description: 'Cloudflare 的 Search for Agents 会为网站建立混合搜索索引，在域名下暴露 /.well-known/search，并把入口写进页面元数据。本文解释发现、检索、HTTP QUERY、实测结果及上线前必须处理的成本与内容边界。'
source: 'https://blog.cloudflare.com/search-for-agents/'
categories:
  - 人工智能
  - 技术
  - Web
  - 开发者工具
tags:
  - Cloudflare
  - Search for Agents
  - AI Search
  - AI Agent
  - HTTP QUERY
  - RAG
---

# Cloudflare Search for Agents：给网站增加可发现的 AI 搜索入口

11 月 25 日，Cloudflare 发布了 Search for Agents beta。站点管理员打开一个开关后，Cloudflare 会抓取并索引网站内容，在原域名下提供 `/.well-known/search`，同时把这个搜索入口写进网页元数据，让 AI Agent 有机会自己发现并调用。

它最值得关注的地方不是“给网站加一个聊天机器人”，而是把网站搜索拆成了更适合 Agent 的两层：网站负责返回相关原文片段，Agent 使用自己已有的模型和对话上下文完成阅读与回答。搜索端点不生成答案，只返回 Markdown 格式的检索结果、来源位置和相关度分数。

这意味着 Agent 不必先盲目抓取几十个页面，也不必为每个网站单独接一个 MCP 服务。它可以先看首页声明的搜索入口，再向网站本身询问“哪些页面与这个问题有关”。但这套发现元数据目前是 Cloudflare 的产品约定，不应被误写成已经被整个 Web 采用的新标准；真正已经标准化的是它支持的 HTTP `QUERY` 方法。

## 它解决的不是“有没有搜索框”

很多网站已经有面向人的搜索框，问题在于 Agent 未必知道搜索接口在哪里，也不知道输入和输出格式。最保守的做法是逐页抓取：先读取首页，再顺着链接寻找文档，最后把多个页面塞进上下文。

这种方式有三个明显成本。

第一，Agent 会下载大量最终用不到的页面。第二，网站失去了决定哪些内容适合被检索、怎样切分和多久更新的控制。第三，抓取结果常夹带导航、脚注和界面文字，模型还要再做一次清洗。

Search for Agents 把这条路径改成：

1. Cloudflare 从 sitemap 和站内链接发现页面；
2. 页面被转换为 Markdown、切块并建立关键词与向量索引；
3. 网站在 HTML 中声明搜索端点；
4. Agent 读取声明后，以关键词或自然语言查询；
5. 端点返回最多若干段候选原文，Agent 再据此回答。

可以把它想成图书馆在门口挂出一个机器可读的目录台。访客不需要逐层翻每个书架，但目录台只告诉他“哪些页可能相关”，不会替他判断资料是否正确。

## Agent 怎样发现搜索入口

启用后，Cloudflare 会在 HTML 的 `<head>` 中加入 `agent:*` 元数据。当前 Cloudflare 开发者文档实际返回的核心字段包括：

```html
<meta name="agent:endpoint"
      content="https://example.com/.well-known/search?q={query}">
<meta name="agent:method" content="GET">
<meta name="agent:documentation"
      content="https://developers.cloudflare.com/ai-search/how-to/search-for-agents/">
```

页面还会提供一段 `agent:instructions`，告诉客户端优先用搜索接口获取站内相关内容。若站点同时启用了 Markdown for Agents，同样的信息会出现在 Markdown 响应的 YAML frontmatter 中。

两项功能的职责不同：Markdown for Agents 把**当前页面**转换成更容易读取的 Markdown；Search for Agents 在**整个站点的索引**中找出相关片段。前者解决单页表示，后者解决跨页检索。

这里要注意一个生态边界。`agent:endpoint`、`agent:method` 等名称不是 RFC 定义的通用 HTML 元数据。Cloudflare 已在自己的开发者文档上启用它，也展示了 OpenCode 自动发现端点的案例，但其他 CDN、浏览器和 Agent 是否采用同一约定，仍要看后续兼容情况。客户端若只实现这一组字段，会形成新的供应商耦合。

## GET 与 HTTP QUERY 分别适合什么

最简单的查询使用 GET，把问题放进 `q` 参数：

```bash
curl --get 'https://developers.cloudflare.com/.well-known/search' \
  --data-urlencode 'q=How do I verify webhook signatures?'
```

较长或结构化的查询也可以使用 HTTP `QUERY`，把内容放进请求体：

```bash
curl -X QUERY 'https://developers.cloudflare.com/.well-known/search' \
  -H 'Content-Type: application/json' \
  --data '{"q":"How many pages can the free plan crawl each day?"}'
```

`QUERY` 不是 Cloudflare 自创的方法。2026 年 6 月发布的 RFC 10008 将它定义为安全且幂等的 HTTP 方法：它像 POST 一样允许在请求体中携带查询条件，但语义明确表示请求不应改变目标资源，因此更适合重试和缓存。服务器仍然需要显式支持它，旧代理、网关和客户端也可能还不认识这个方法，不能因为 RFC 已发布就假定所有链路都已兼容。

我使用 curl 8.14.1 实际执行了上面两类请求。GET 查询返回 Markdown 片段；`QUERY` 携带 JSON 请求体也成功返回结果。它们都没有给出模型生成的最终答案。

实测还说明了为什么“检索结果”不能直接等同于“正确答案”。查询如何验证 webhook 签名时，第一条结果是较泛化的 JWT 校验示例，相关度为 1.000；真正讨论 Cloudflare Stream webhook 签名的页面排在第二，分数为 0.950。对另一个免费计划抓取上限问题，结果还混入了 Browser Run 与 Workers 的限制页面。

因此，客户端至少应读取多条结果、核对路径和标题，再选择证据。若把第一条片段直接交给用户，站点级搜索只是把“模型幻觉”换成了“检索排序误判”。

## 一个可运行的自动发现示例

下面的 Python 程序只使用标准库。它读取网站首页，提取 `agent:*` 元数据，把问题填入端点模板，然后打印返回结果的前 12 行。

```python
from html.parser import HTMLParser
from urllib.parse import quote
from urllib.request import Request, urlopen


class AgentMetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}

    def handle_starttag(self, tag, attrs):
        if tag != "meta":
            return
        values = dict(attrs)
        name = values.get("name", "")
        if name.startswith("agent:") and "content" in values:
            self.values[name] = values["content"]


site = "https://developers.cloudflare.com/"
headers = {"User-Agent": "agent-search-demo/1.0"}

with urlopen(Request(site, headers=headers), timeout=20) as response:
    html = response.read().decode("utf-8")

parser = AgentMetaParser()
parser.feed(html)

template = parser.values["agent:endpoint"]
query = "How do I verify webhook signatures?"
search_url = template.replace("{query}", quote(query))

with urlopen(
    Request(search_url, headers={**headers, "Accept": "text/markdown"}),
    timeout=20,
) as response:
    result = response.read().decode("utf-8")

print("method:", parser.values.get("agent:method", "GET"))
print("endpoint:", template)
print("documentation:", parser.values.get("agent:documentation"))
print("\n".join(result.splitlines()[:12]))
```

我用 Python 3.12 实际运行，程序发现了 GET 端点与文档地址，并打印出 JWT 校验、Stream webhook 等候选片段。生产客户端还需要补上重试、响应大小限制、内容类型校验和允许域名列表。尤其不能盲目执行返回 Markdown 中的指令；它仍然只是来自外部网站的待核验内容。

搜索请求也仍受站点的 WAF、Bot 管理和访问策略约束。公开搜索入口不意味着网站放弃访问控制，客户端应明确标识自身，并正确处理拒绝、限速和超时。

## 默认索引并不是实时、无限或免费的

Search for Agents 打开的不是一个轻量静态文件，而是一套 AI Search 实例。Cloudflare 当前文档列出的默认配置包括：

| 环节 | 默认行为 | 对使用者的影响 |
| --- | --- | --- |
| 页面发现 | sitemap 与站内链接，最多跟随 5 跳 | 未被链接或被 robots.txt 阻止的页面可能进不了索引 |
| 同步 | 每 24 小时 | 刚修改的价格、库存和规则可能仍返回旧内容 |
| 检索 | 关键词与向量混合搜索，使用 RRF 融合 | 能兼顾精确术语和自然语言，但排序仍可能失准 |
| 切块 | 1024 Token，10% 重叠 | 上下文可能在块边界处被拆开，重叠也会增加计费 Token |
| 输出 | 最多 10 个片段，不生成答案 | 客户端必须自己选择证据并形成回答 |
| 缓存 | 相似查询缓存 48 小时 | 降低重复查询成本，也增加短期内容陈旧风险 |

新实例默认不启用查询改写与重排序。站点可以在 AI Search 设置中调整部分参数，但数据源和嵌入模型等配置在创建后不能直接修改。若现有内容结构不适合 1024 Token 切块，单纯打开开关未必能得到理想结果。

Cloudflare 表示 AI Search 将从 2026 年 12 月 1 日开始计费。每个账户每月包含 500 万摄取 Token、10 GB-month 存储、1000 次语义查询和 1000 次全文查询；超出后按摄取、存储和查询分别收费。Free 计划每天最多抓取 500 个页面，这也会限制大型站点第一次建索引的速度。

所以“所有计划可用”不等于“任意规模免费”。上线前应先估算页面数、更新频率、切块后的 Token 数和 Agent 查询量，并给公开端点设置速率、缓存和异常流量监控。

## 与现有方案的区别

| 方案 | 解决的问题 | Search for Agents 的差异 |
| --- | --- | --- |
| 普通站内搜索 | 让人通过界面找到页面 | 增加机器可发现的端点，并直接返回 Markdown 片段 |
| Markdown for Agents | 把单个 HTML 页面转换为 Markdown | Search for Agents 先在全站索引中选出相关页面和片段 |
| `llms.txt` 或静态索引页 | 告诉模型站点结构、推荐入口或说明 | 不会自动提供关键词与向量混合检索，也没有查询结果排序 |
| MCP 搜索工具 | 通过工具协议暴露搜索及更多能力 | 功能更强，但需要客户端理解协议和工具描述；这里的基本路径只是 HTTP 检索 |
| 自建 RAG | 自己控制抓取、切块、模型、权限和索引 | 自由度更高，也要承担发现、同步、部署和运维成本 |

它最适合公开技术文档、帮助中心、政策库、产品目录和文章归档：内容本来就允许匿名读取，页面数量较多，读者的问题又往往跨越多个页面。

它不适合直接索引用户私有数据、内部工单、按账号变化的内容或未经审查的后台页面。官方文档明确要求只索引准备公开搜索的内容；搜索请求仍会经过 AI Crawl Control 和 WAF。若站点需要登录后按用户权限返回不同结果，应先设计鉴权、缓存隔离和数据源边界，而不是把公开的 `/.well-known/search` 当成权限系统。

## 真正的变化是网站开始声明“怎样被 Agent 使用”

过去的网站主要向浏览器声明样式、脚本、RSS 和搜索引擎索引规则。Search for Agents 尝试再增加一层：网站主动告诉 Agent，跨页查询应该走哪个入口、用什么方法、会返回什么格式。

这个方向有现实价值，因为它让网站从被动接受抓取，转向提供结构化的检索服务。但当前实现仍有三条清晰边界：发现元数据尚不是通用 Web 标准，索引排序不等于事实判断，公开端点也不会自动解决权限、时效和成本问题。

现在更合理的试用方式，不是立刻把所有内容交给索引，而是先选一个公开、低风险、更新频率可控的文档子集：检查哪些页面被抓取，准备一组真实问题，比较前十条检索结果是否覆盖正确来源，再观察 Agent 是否真的发现并使用端点。只有这条链路稳定后，自动发现才从一个漂亮的 meta 标签变成可依赖的站点能力。

## 原始资料

- [Cloudflare：Introducing Search for Agents](https://blog.cloudflare.com/search-for-agents/)
- [Cloudflare 文档：Search for Agents](https://developers.cloudflare.com/ai-search/how-to/search-for-agents/)
- [Cloudflare 文档：AI Search 限制与定价](https://developers.cloudflare.com/ai-search/platform/limits-pricing/)
- [Cloudflare 文档：网站抓取与 Discover 解析](https://developers.cloudflare.com/ai-search/configuration/data-source/website/parse-types/)
- [RFC 10008：The HTTP QUERY Method](https://www.rfc-editor.org/rfc/rfc10008.html)
