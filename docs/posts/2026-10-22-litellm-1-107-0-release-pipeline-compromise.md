---
title: 'LiteLLM 1.107.0 被投毒：为什么干净源码仍能产出恶意安装包'
date: 2026-10-22
slug: 'litellm-1-107-0-release-pipeline-compromise'
author: 范伟彬
description: '复盘 LiteLLM 1.107.0 供应链事件：攻击者如何绕过源码标签改写发布产物，.pth 与 sitecustomize 为何让 pip 自身也成为触发器，以及团队应如何排查、轮换凭证并验证制品来源。'
categories:
  - AI
  - 安全
  - 技术
tags:
  - LiteLLM
  - PyPI
  - 软件供应链
  - Python
  - GitHub Actions
  - 制品溯源
---

如果你的服务用 LiteLLM 统一转发 OpenAI、Anthropic、Gemini 等模型请求，现在最该检查的不是代码仓库，而是**实际安装过什么包、拉过什么镜像**。

LiteLLM 在 **2026 年 10 月 21 日**确认，其公开发布流水线遭入侵，PyPI 上的 `litellm==1.107.0`，以及 Docker Hub、GHCR 上一度指向同批恶意制品的 `v1.107.0`、`latest`、`main-latest`、`main-stable` 标签都受到影响。项目方已撤下或重新指向这些制品，并把事件状态标为“已遏制、仍在调查”。

这次事件最反直觉的一点是：GitHub 上官方的 `v1.107.0` 源码标签没有恶意文件，真正被投毒的是由发布流水线送进包仓库和镜像仓库的产物。它提醒我们，审查源码只能证明“仓库里是什么”，不能自动证明“生产环境拿到的字节由这份源码构建”。

## 先判断自己是否落在影响范围

截至 LiteLLM 10 月 21 日 16:00 UTC 的通报，已确认的暴露窗口如下：

| 分发渠道 | 受影响制品 | 已确认暴露时间（UTC） |
| --- | --- | --- |
| PyPI | `litellm==1.107.0` 的 7 个 wheel | 10 月 21 日 11:39:51 至 13:23 |
| Docker Hub | `v1.107.0`、`latest`、`main-latest`、`main-stable` | 10 月 21 日 11:46:56 至 14:20 |
| GHCR | 同名标签及相关镜像变体 | 10 月 21 日 11:46:56 起，13:51 前已不可用 |

项目方给出的公开 Docker 镜像索引之一是：

```text
sha256:1bbcb1443bc962e45f5aad53fe3d2c30600e0379715fb6c664cdd3ac126c339e
```

如果 CI 在这段时间执行了没有锁定版本的 `pip install litellm`，或者部署系统拉取并启动了上述浮动标签，就不能因为现在仓库里的标签已经恢复正常而排除风险。浮动标签像一个可以随时改地址的路牌：今天再看它指向安全镜像，无法证明昨天运行的容器也是同一个镜像。

项目方表示，私有企业版仓库没有受到这次事件影响；其他早于 1.107.0 的公开版本也被列为安全。当前建议暂时固定到 `1.106.2` 或更早的明确版本。不过，“现在能装到安全版”与“之前的机器没有执行过恶意版”是两件事，后者仍要靠部署记录、缓存、镜像摘要和主机证据回答。

## 源码标签为什么没有恶意代码

根据项目方披露的时间线，攻击者疑似利用三名工程师被盗的 GitHub CLI OAuth 凭证完成了几件彼此衔接的事：

1. 第一个高权限凭证越过分支保护，修改私有发布工作流；
2. 工作流从攻击者控制的近似命名仓库 `Berri-AI/litellm` 构建，而不是官方源码来源；
3. 第二个凭证通过生产发布审批；
4. PyPI wheel 和容器镜像由这条流水线发布；
5. 第三个凭证随后删除部分工作流运行记录，削弱调查所需的日志。

这里的信任链可以简化为：

```text
官方 Git 标签 ──期望关系──> 构建任务 ──> wheel / 镜像 ──> 生产环境
                         ↑
                 实际输入被换成攻击者仓库
```

开发者通常把“版本号相同”理解为“内容相同”，但版本号只是名字。只有构建来源、工作流身份、输入提交、产物摘要之间存在可验证的对应关系，才能证明仓库标签与下载制品是同一条链上的东西。

这也解释了为什么 Trusted Publishing 不是万能解药。PyPI 的安全模型明确说明：Trusted Publisher 能把发布动作绑定到某个短期 OIDC 身份，降低长期 API Token 泄露的风险，却不保证被发布代码本身安全，也不防止可信工作流在构建前后处理了错误内容。如果攻击者已经能调用或改写那个被信任的流水线，“由可信身份上传”仍可能成立。

## 为什么只是启动 Python 就会执行

安全团队 Wiz 对恶意 wheel 的分析显示，额外文件被写入了 `site-packages` 顶层，其中包括 `cook.pth`、`cook.py` 和 `sitecustomize.py`。这不是随意选择的文件名，而是在利用 Python 的正常启动机制。

Python 官方文档规定，`site` 模块会处理 `site-packages` 中的 `.pth` 文件；以 `import` 开头的可执行行会在 Python 启动时运行，无论业务是否真的导入对应第三方包。路径处理结束后，解释器还会尝试导入 `sitecustomize`。这两个机制原本用于扩展模块搜索路径和做站点级初始化，放进恶意文件后，就变成了“只要解释器启动，代码便有机会运行”的入口。

因此，下面这些看似无害的动作都可能再次触发受污染环境里的启动钩子：

- 启动 LiteLLM 服务；
- 打开普通 Python REPL；
- 在该虚拟环境中运行 `python -m pip`；
- 运行依赖 Python 入口脚本的运维工具。

这也是项目方特别强调**不要先执行 `pip install` 或 `pip uninstall`**的原因。传统升级思路是“启动包管理器，把坏版本换掉”，但此时包管理器本身也要启动 Python，可能在修复开始前再次执行恶意逻辑。

## 一个不启动 Python 的初筛脚本

下面的 Bash 脚本只使用 `find` 扫描你明确提供的离线目录，不会启动目标虚拟环境中的 Python。更稳妥的做法是在隔离主机上挂载受影响磁盘或容器文件系统后执行，而不是进入仍联网的可疑容器。

```bash
#!/usr/bin/env bash
set -u

if (( $# == 0 )); then
  echo "usage: $0 SITE_PACKAGES_OR_ROOT [...]" >&2
  exit 64
fi

found=0
for root in "$@"; do
  if [[ ! -d "$root" ]]; then
    printf 'SKIP missing directory: %s\n' "$root" >&2
    continue
  fi

  while IFS= read -r -d '' hit; do
    printf 'REVIEW %s\n' "$hit"
    found=1
  done < <(
    find "$root" \
      \( -type f \( -name 'cook.pth' -o -name 'cook.py' -o -name 'sitecustomize.py' \) \
         -o -type d -name 'litellm-1.107.0.dist-info' \) \
      -print0
  )
done

if (( found )); then
  exit 2
fi

echo 'No listed LiteLLM 1.107.0 IOC names found.'
```

我用两个合成目录实际验证了脚本：干净样本只包含 `litellm-1.106.2.dist-info`，输出如下，退出码为 0：

```text
No listed LiteLLM 1.107.0 IOC names found.
```

可疑样本放入 `cook.pth`、`sitecustomize.py` 和 `litellm-1.107.0.dist-info` 后，三个路径均被列出，退出码为 2。脚本没有下载或执行任何恶意样本。

这只是初筛工具，不是“未发现即安全”的证明。`sitecustomize.py` 也可能有合法用途；反过来，临时文件清理、容器销毁或攻击者自清理都可能让已执行过恶意代码的环境不再留下这些名字。真正的判断应把文件证据与以下记录合并：

- CI 在暴露窗口内解析出的确切包版本；
- `pip`、代理仓库和构建缓存的下载记录；
- Kubernetes、Docker 或云平台保存的镜像 digest；
- 运行时网络日志和云审计日志；
- 构建生成的 SBOM、锁文件与制品哈希。

## 命中之后，修复顺序比“升级到哪一版”更重要

如果确认安装或运行过受影响制品，应把它按凭证窃取事件处理，而不是只按依赖漏洞处理。LiteLLM 通报建议先从 shell 移除相关启动文件、结束残留的后台进程，再重建镜像或虚拟环境；重建通常比在原环境上清理更可靠。

接下来要轮换的不是一个 LiteLLM 密钥，而是该主机当时能够读取或调用的全部秘密，包括：

- 云实例或任务角色的临时凭证；
- LiteLLM 数据库中保存的模型供应商密钥、master key 和 virtual key；
- `DATABASE_URL` 对应的数据库凭证；
- 进程环境变量里的其他 Token；
- SSH、Git、浏览器和开发工具凭证。

轮换应在可信机器上完成，并在隔离旧环境之后进行。否则新凭证刚写回受控主机，就可能再次被读取。云环境还应回看安装时段附近的身份查询和随后来自异常网络位置的 API 调用；项目方特别点名了 AWS CloudTrail 中的 `GetCallerIdentity` 线索。

## 怎样让下一次恶意发布少一批受害者

单一措施挡不住整条供应链，比较实际的做法是分层收紧：

### 对依赖使用方

**锁版本，也锁字节。** `litellm>=1.100` 或 Docker `latest` 都允许部署在不改业务代码的情况下获取全新产物。Python 应使用带哈希的锁文件，容器应固定不可变 digest。pip 的 `--require-hashes` 会要求直接依赖和传递依赖都使用精确版本与本地记录的哈希。

不过哈希只能回答“拿到的是否是批准过的那份字节”，不能回答“这份字节是否善良”。如果团队在恶意版本发布后才生成锁文件，恶意哈希也可能被忠实锁住。因此更新审批仍需结合发布时间、代码差异、来源证明和安全扫描。

**给新版本留冷静期。** PyPI 在今年 4 月复盘 LiteLLM 1.82.7/1.82.8 事件时建议使用 dependency cooldown：普通依赖发布后等待一段时间再进入自动更新，让恶意样本有机会被报告和隔离；紧急安全补丁则通过单独审批绕过等待期。这比所有 CI 每次都追最新版本更符合生产环境的风险模型。

**保存部署证据。** 仅保留 `requirements.txt` 不够。构建系统应保存解析后的完整锁文件、下载制品 SHA-256、容器 digest、SBOM 和构建时间。发生事件时，团队才能从“我们大概没装”升级为“这些工作负载在这些时刻运行了这些字节”。

### 对发布方

**把发布身份与构建来源一起验证。** 发布证明至少要能关联工作流、仓库、提交和产物摘要。PyPI 的 Publish Attestation 可以证明制品通过哪个 Trusted Publisher 身份上传；更完整的构建 provenance 则要追踪产物由什么输入、在什么构建器中生成。消费者还必须实际验证这些证明，单纯“生成但无人检查”没有防线价值。

**让审批真正独立。** 生产审批如果可以由另一枚同样保存在日常开发机上的 OAuth 凭证完成，攻击者扩大开发者凭证窃取范围后仍能过闸。高风险发布应使用最小权限、独立设备或硬件认证、短期身份、受保护环境和不可由单个高权限账号随意覆盖的规则。

**把流水线本身当生产代码。** 工作流修改应经过强制审查，构建输入应固定到允许的组织、仓库与提交，第三方 Action 固定 commit SHA，发布日志写入攻击者难以从同一权限域删除的审计系统。最终发布前，还可以让独立任务验证“源码标签重建结果”和“待上传制品”的内容或摘要关系。

## 同一年第二次，说明问题不只在某个版本

这不是 LiteLLM 今年第一次出现恶意公开包。3 月 24 日的 1.82.7 和 1.82.8 曾在 TeamPCP 供应链活动中被投毒；PyPI 事后统计，那次暴露窗口内的下载量超过 11.9 万次。10 月的 1.107.0 事件使用了不同发布链路和启动机制，目前也没有证据表明两次事件来自同一攻击者或同一根因。

但两次事件共同暴露了一个现实：热门 AI 网关天然靠近大量高价值密钥，自动追新版本的构建系统又能在几分钟内把新产物扩散到生产环境。对这种依赖，团队不能只问“代码有没有已知 CVE”，还要问三个更基础的问题：

1. 我们安装的字节究竟来自哪一次构建？
2. 谁能改变构建输入、批准发布和删除审计记录？
3. 如果制品明天被宣布恶意，我们能否在半小时内列出所有运行过它的工作负载和需要轮换的秘密？

LiteLLM 1.107.0 已经被撤下，但这三个问题不会随版本下架而消失。供应链安全真正要锁住的，从来不只是一个版本号，而是从源码、构建、发布到运行时的完整身份链。

## 原始资料

- [LiteLLM：Oct 21, 2026 LiteLLM release v1.107.0 Compromised](https://docs.litellm.ai/blog/security-incident-oct-21-2026)
- [LiteLLM GitHub Issue #47826：社区发现、IOC 与项目方调查更新](https://github.com/BerriAI/litellm/issues/47826)
- [Wiz Research：LiteLLM Compromised, Steals Credentials](https://www.wiz.io/blog/litellm-compromised-steals-credentials)
- [Python 文档：site-specific configuration hook](https://docs.python.org/3.14/library/site.html)
- [PyPI：LiteLLM/Telnyx 供应链事件复盘与依赖冷静期建议](https://blog.pypi.org/posts/2026-04-02-incident-report-litellm-telnyx-supply-chain-attack/)
- [pip 文档：Secure installs 与 Hash-checking Mode](https://pip.pypa.io/en/stable/topics/secure-installs/)
- [PyPI 文档：Trusted Publishers 的安全模型](https://docs.pypi.org/trusted-publishers/security-model/)
- [PyPI 文档：Publish Attestation](https://docs.pypi.org/attestations/publish/v1/)
- [Datadog Security Labs：3 月 LiteLLM/TeamPCP 事件分析](https://securitylabs.datadoghq.com/articles/litellm-compromised-pypi-teampcp-supply-chain-campaign/)
