---
title: 'LiveContainer + SideStore Nightly 实战：Windows 安装、iPhone 续签和多开排错'
date: 2026-11-06
slug: 'livecontainer-sidestore-windows-iphone'
author: 范伟彬
description: '用 Windows 和 iLoader 给 iPhone 15 Pro Max 安装 LiveContainer + SideStore Nightly，记录配对、登录、首次刷新、LiveProcess 和 IPA 闪退的排查过程，并说明如何自动续签、查具体到期时间，以及共享 App 为什么会跳回另一个 LiveContainer。'
categories:
  - '技术'
  - '工具'
tags:
  - 'LiveContainer'
  - 'SideStore'
  - 'iOS'
  - 'iPhone'
  - 'Windows'
  - '侧载'
  - '快捷指令'
---

# LiveContainer + SideStore Nightly 实战：Windows 安装、iPhone 续签和多开排错

Windows 上的 iLoader 已经显示 `Place` 成功，iPhone 也有了 LiveContainer 图标。可点开内置 SideStore，Apple 账户登录一直转圈。后来能登录了，首次刷新又先后报 Wi‑Fi 和签名配置错误。装好应用、完成账户登录、续上签名、跑通容器里的 IPA，是四个要分别检查的结果。

这次用的是 **iPhone 15 Pro Max、iOS 27.0.1、Windows 上的 iLoader 2.4.1**。手机里的组合包显示 **LiveContainer 3.8.11（`9108ae6`）和 SideStore Nightly `0.7.0-20261017.511+ee3cc16a`**。这套组合最终装好了，免 JIT 测试通过，多任务也恢复了。微信容器启动仍不稳定，测试期间账号被限制 3 天，最终停止了微信双开尝试。下文把这台手机上观察到的结果和可供参考的排查方法分开写。 [Nightly 构建记录](https://github.com/LiveContainer/LiveContainer/releases/tag/nightly)

## LiveContainer、SideStore 和 iLoader 分别做什么

| 工具 | 在这套流程里的作用 |
| --- | --- |
| LiveContainer | 一个 iOS 应用启动器。可以导入兼容的 IPA，在启动器里面运行，也可以给同一个 App 分开存放数据。 |
| SideStore | 用 Apple 开发者签名在手机上安装和刷新侧载 App。组合版把它放进 LiveContainer，首次配置完成后可以在手机上刷新 LiveContainer 自己。 |
| iLoader | Windows 上用来识别 iPhone、完成首次 USB 安装、生成和放置配对文件的工具。 |
| LocalDevVPN | SideStore 安装和刷新时需要的本地 VPN，用来让手机上的 SideStore 与设备服务通信。 |

**「导入到 LiveContainer」和「在 SideStore 里侧载」是两个不同的入口。** 前者把 App 放进启动器，里面的 IPA 通常不单独占系统侧载名额。后者由系统安装为独立 App，会占一个名额。免费 Apple 账号通常可同时安装 **3 个**开发签名 App，并有每 7 天最多注册 **10 个 App ID** 的限制。LiveContainer + SideStore 组合包本身占一个安装名额，内置 SideStore 可以和它共用这个位置。 [LiveContainer 简介](https://livecontainer.github.io/zh-CN/docs/intro) · [组合版安装文档](https://livecontainer.github.io/zh-CN/docs/installation/lc_sidestore) · [SideStore 名额说明](https://docs.sidestore.io/docs/faq)

## 从 Windows 安装到 iPhone 第一次续签

### 1. 在 Windows 装好 Apple 驱动和 iLoader

1. 按官方要求在 Windows 安装 iTunes，准备 Apple 设备通信驱动，再安装适合电脑架构的 iLoader。
2. 用能传数据的 USB 线连接并解锁 iPhone。手机弹出「要信任此电脑吗」时，点「信任」并输入锁屏密码。
3. 打开 iLoader，登录用于侧载的 Apple 账户，再从设备列表选择 iPhone。
4. 在 `Installers` 里选 **LiveContainer + SideStore Nightly**。等 iLoader 完成下载和安装，确认手机桌面出现 LiveContainer。

安装成功的标志是手机有图标并能完成开发者信任。配对、内置 SideStore 登录和首次刷新还要继续验证。若 iLoader 看不到手机，先检查 USB 数据线、端口和驱动。 [iLoader 发布页](https://github.com/nab138/iloader/releases) · [Windows 安装要求](https://livecontainer.github.io/zh-CN/docs/installation/lc_sidestore)

### 2. 在手机上信任开发者，补放配对文件

1. 进入 **设置 → 通用 → VPN 与设备管理 → 开发者 App**，选择签名时使用的账户，按提示信任。iOS 若要求允许并重启，按提示操作。
2. 如手机提示需要开发者模式，打开 **设置 → 隐私与安全性 → 开发者模式**，重启并在解锁后确认。
3. 打开 LiveContainer，点 App 页左上角 SideStore 图标。如果弹出 `Pairing File`，回到 Windows 的 **iLoader → Manage Pairing File**，在对应的 LiveContainer 或 SideStore 条目旁点 **Place**，再重开手机上的应用。

`Place` 成功表示 iLoader 已写入配对文件。系统更新、重置等情况可能导致原来的文件失效。若手机仍明确提示配对错误，可按官方指南清除旧配对并重新信任，再放置新文件。配对文件含设备连接凭据，应保留在自己的设备上。 [SideStore 安装步骤](https://docs.sidestore.io/docs/installation/install) · [配对文件指南](https://docs.sidestore.io/docs/advanced/pairing-file) · [配对文件的隐私说明](https://github.com/StikDebug/StikDebug/blob/main/PAIRING.md)

### 3. 登录内置 SideStore，先手动刷新一次

1. iPhone 连上 Wi‑Fi，安装并打开 **LocalDevVPN**，点 `Connect`，按提示添加 VPN 配置。
2. 从 LiveContainer 左上角进入内置 SideStore，在 `Settings` 用 iLoader 签名时的同一 Apple 账户登录。
3. 如果列出个人免费团队和公司团队，个人侧载选 **Free Developer Account**。如果弹出 `Revoke Certificates`，先确认这张证书是否还给别的侧载 App 或设备使用。拿不准时先取消，撤销会影响用该证书签名的 App。
4. 进入 **My Apps**，点 **Refresh All**，或单独点已侧载的 **LiveContainer** 右侧剩余天数。测试中一度出现两个同名条目，排查时优先单刷标有 `Sideloaded` 的已安装条目。
5. 返回 LiveContainer 的设置，点 **Import Certificate from SideStore**。按钮变成 `Remove Certificate`（删除证书）表示证书已导入。再到 **免 JIT 模式诊断 → 测试免 JIT 模式**，看测试结果。

首次刷新与免 JIT 测试是两个检查点。前者看 LiveContainer 自己的安装签名能否续上，后者看启动器能否用当前证书运行测试组件。 [组合版安装后设置](https://livecontainer.github.io/zh-CN/docs/installation/lc_sidestore) · [SideStore 首次刷新](https://docs.sidestore.io/docs/installation/install) · [免 JIT 诊断](https://livecontainer.github.io/zh-CN/docs/faq/jit-less-mode-setup) · [LocalDevVPN](https://apps.apple.com/app/localdevvpn/id6755608044)

## 实际碰到的故障怎么排

### 配对成功后，Apple 账户登录还是一直转圈

手机后续进到了团队选择页和 `My Apps`，说明登录最终走通。现场未逐项记录是哪一个设置让登录恢复。遇到同类问题，先重开内置 SideStore、检查网络和所用账号，再按 SideStore 文档检查负责 Apple 登录的 **Anisette** 服务。 [SideStore 登录排查](https://docs.sidestore.io/docs/troubleshooting#sidestore-freezing-or-displaying-an-error-code-during-sign-in)

当时参考了项目置顶的方案。若对应菜单存在，可在 **Settings → User Customizations** 关闭 `On-Device Anisette`，到 `Anisette Servers` 选 **SideStore (New)**，随后用 `Reset adi.pb → Reset & Sign Out` 清掉本地认证状态并重新登录。该方案来自一组特定登录错误的用户反馈，菜单和服务器会随版本变化。手机仍明确提示配对失效时，再回到 iLoader 检查配对。 [项目置顶讨论 #1676](https://github.com/LiveContainer/LiveContainer/issues/1676)

### 状态栏有 Wi‑Fi，刷新却报 `No wifi interface satisfied`

这条报错表示 SideStore 当时没有找到符合条件的 Wi‑Fi 接口。到 **设置 → Wi‑Fi** 确认已连上可用网络，用 Safari 验证能上网，再打开 LocalDevVPN 确认已连接。如果有其他 VPN 正在运行，可先暂停后重试。回到 `My Apps` 单刷 LiveContainer，仍失败就看 **Settings → Health Check** 中的网络、VPN 和设备连通性。本次继续操作后报错进入了获取签名配置阶段，记录未确认 Wi‑Fi 检测失败的具体原因。 [SideStore 网络排查](https://docs.sidestore.io/docs/troubleshooting/common-issues)

### 首次刷新报 `context.targetAppBundle is nil`

完整报错来自 `FetchProvisioningProfilesOperation`。项目维护者给出的处理是打开 **LiveContainer 自己的设置**，滑到最底部，连续点版本号 **5 次**，再用出现的 **Nuke SideStore** 重置内置 SideStore。该操作会清理其本地数据库和缓存的 App 文件，已有软件源或安装记录时先记下相关信息。重置后重新打开内置 SideStore，按需登录，再连着 Wi‑Fi 和 LocalDevVPN 刷新。这个错误有维护者给出的处理路径，现场记录没有单独确认重置本身是否消除了它。 [维护者处理说明 #1627](https://github.com/LiveContainer/LiveContainer/issues/1627) · [对应版本的重置代码](https://github.com/LiveContainer/LiveContainer/blob/9108ae624ea001f7d7696d48407f890b48fa2653/LiveContainerSwiftUI/Views/Settings/LCSettingsView.swift#L675-L687)

### 多任务报 `LiveProcess extension not found`

这次明确缺了 **LiveProcess** 扩展。**保留扩展覆盖安装之后，多任务恢复。**

1. 从官方 Nightly 发布页下载组合版 `LiveContainer+SideStore.ipa`，存到 iPhone 的「文件」。
2. 连接 Wi‑Fi 和 LocalDevVPN，从 **内置 SideStore → My Apps → ＋** 选择该 IPA，直接覆盖已有安装。出现扩展选项时，选保留扩展并使用主配置文件，即 **Keep App Extensions / Keep All Extensions（Use Main Profile）** 一类的选项。
3. 打开一个已经能普通启动的 App，长按 → **设置 → 转换为共享 App**，再长按选 **多任务**。用这个 App 验证多任务是否恢复。

这里要通过 `＋` 重新安装 IPA，把缺失的扩展装回去。单点刷新天数或使用 `Resign` 不会替代这一步。 [维护者的 Nightly 说明 #1629](https://github.com/LiveContainer/LiveContainer/issues/1629) · [多任务文档](https://livecontainer.github.io/zh-CN/docs/guides/multitask)

### 免 JIT 测试通过了，为什么个别 IPA 仍闪退

先分清是**导入 IPA 时失败**，还是**导入成功、点启动后才退出**。后者先关掉该 App 的多任务启动，普通启动一次。必要时用同一份可信 IPA 在 SideStore 里做独立侧载对照，前提是还有空余名额。如果只有容器内崩溃，优先看 LiveContainer 兼容性、宿主权限和插件。两边都崩时，再查 IPA 本身和系统版本。如果弹窗没留下信息，可以在 **设置 → 隐私与安全性 → 分析与改进 → 分析数据** 找对应时段的崩溃日志，先看 `Exception Type` 和 `Termination Reason`。 [LiveContainer 闪退排查](https://livecontainer.github.io/zh-CN/docs/faq/app-crashes) · [Apple 崩溃日志指南](https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs)

这次也尝试了微信 8.0.80。免 JIT 测试已通过，微信在容器里仍在调用 `INPreferences` 时抛出异常，日志指向宿主缺少 `com.apple.developer.siri`。随后试过的兼容模块先后出现 `Failed to Sign` 和 `code signature invalid`。更换对照模块后签名弹窗消失，但微信仍被中止，关掉多任务后普通启动也闪退。**没有验证到微信双开成功。** 测试期间账号收到 3 天的外挂限制，具体触发因素无法从本地日志确认。日常使用微信建议回到 App Store 版。下文用两套本地存档解释双容器。 [Apple 的 Siri 权限说明](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.siri) · [LiveContainer 已知限制](https://github.com/LiveContainer/LiveContainer#limitations)

## LiveContainer 怎么给自己续签

组合版可以在手机上给自己续签。负责刷新的是**内置 SideStore**，所以只需保留组合包，通常无需另外安装独立 SideStore。自动化之前，先在 Wi‑Fi 和 LocalDevVPN 已连的情况下手动刷新一次，再确认实际到期时间延后。 [组合版刷新指南](https://livecontainer.github.io/zh-CN/docs/installation/lc_sidestore) · [核实刷新是否成功](https://livecontainer.github.io/zh-CN/docs/guides/refresh-verification)

### 用 iPhone 快捷指令安排自动刷新

1. 打开「快捷指令」，新建「LiveContainer 续签」。
2. 添加 **设定 VPN → 连接 LocalDevVPN**，再添加 **等待 5 秒**，然后添加 **LiveContainer** 提供的 **Refresh All Apps / 刷新所有 App**。等待 5 秒是留给 VPN 建连的缓冲，可按实测调整。
3. 连着 Wi‑Fi 手动运行一次，按需批准快捷指令的权限，再查看 LiveContainer 的实际到期时间。
4. 在「快捷指令」的 **自动化**里选 **特定时间**，例如每周一和周四 21:00，选择 **立即运行**或本机界面对应的自动执行设置，关联刚才的快捷指令。选手机通常连着 Wi‑Fi 的时间。
5. 第一次定时执行后，再读一次到期时间。本文没有记录跨多周自动续签的实测结果。若后台报 `not signed in`、要求验证码，或显示运行了但时间没变，先回内置 SideStore 手动刷新。遇到项目已知的 Nightly 后台授权问题，可对照维护者的覆盖安装说明。 [组合版快捷指令说明](https://livecontainer.github.io/zh-CN/docs/installation/lc_sidestore) · [Apple 快捷指令自动化](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios) · [Nightly 后台刷新问题 #1629](https://github.com/LiveContainer/LiveContainer/issues/1629)

### 周一 9 点签，到下周一几点

免费账号通常是**配置文件有效 7 天**，精确时间由 Apple 签发的配置文件 `ExpirationDate` 决定。如果新配置文件在周一约 09:00 签发，到期通常是下周一约 09:00。每周只跑一次、还卡在同一分钟，几乎没有给网络、登录和调度留余量。周一和周四各跑一次，间隔分别约 3 天和 4 天。 [Apple 的配置文件说明](https://developer.apple.com/documentation/technotes/tn3125-inside-code-signing-provisioning-profiles) · [LiveContainer 的到期机制](https://livecontainer.github.io/zh-CN/docs/guides/refresh-verification)

### 在 iPhone 上看哪天几点到期

安装并按官方指引设置 **StikDebug**，打开 **Tools → App Expiry**，找到 LiveContainer 卡片，读顶部的 **Expires**。这里会显示具体日期和时间，官方示例精确到秒。刚续签完可以点右上角刷新。在 iOS 27 上，支持的 StikDebug 版本可以从 **Settings → Pair a Device → Pair iPhone or iPad** 在手机上完成配对。查看到期时间无需启用 JIT。 [官方图文检查指南](https://livecontainer.github.io/zh-CN/docs/guides/refresh-verification) · [StikDebug 发布页](https://github.com/StikDebug/StikDebug/releases) · [StikDebug 配对指南](https://github.com/StikDebug/StikDebug/blob/main/PAIRING.md)

如果卡片的 `Most Recent Profile` 显示 **Missing Entitlements**，新配置文件缺了所需权限，顶部 `Expires` 可能仍是旧的有效期限。官方建议用 SideStore 覆盖安装对应的原 IPA，更新它记录的权限，再用 StikDebug 复查。 [刷新无效的处理方法](https://livecontainer.github.io/zh-CN/docs/guides/refresh-verification)

## 多容器、多任务和多 LiveContainer 怎么选

| 想做什么 | 用哪项功能 | 会发生什么 |
| --- | --- | --- |
| 同一个 App 保留两套存档，轮流开 | **多容器** | 一份 IPA 关联两套数据，在同一个 LiveContainer 里选择要用的容器。 |
| 在同一个启动器里开多个 App 或不同容器 | **多任务** | 由 `LiveProcess` 启动，在 LiveContainer 里切换。 |
| 想从 iPhone 的 App 切换器在两个独立入口间来回切 | **多个 LiveContainer** | 安装蓝色主实例和灰色第二实例，可以分别普通启动，各占一个系统侧载名额。 |

要建第二套数据，在 App 列表**长按应用 → 设置 → 容器 → 创建数据文件夹**。想安装第二个启动器，从 **LiveContainer → 设置 → 安装另一个 LiveContainer** 选择 `LiveContainer2`，再通过 SideStore 安装生成的 IPA。蓝色实例里的应用转成「共享 App」后，灰色实例也能看到并打开。 [多容器指南](https://livecontainer.github.io/zh-CN/docs/guides/containers-and-external-data) · [多任务指南](https://livecontainer.github.io/zh-CN/docs/guides/multitask) · [多个 LiveContainer 指南](https://livecontainer.github.io/zh-CN/docs/guides/multiple-livecontainers)

### 为什么在 A 点共享 App，却自动跳到 B

这次实际看到了这个行为。B 已经打开某个共享 App，回 A 点同一个 App，又被带回 B。LiveContainer 启动时检查的是**选中的数据容器**。如果该容器已在另一个实例里运行，系统会把正在运行的实例带到前台。转换为「共享 App」让两个启动器都能访问同一份 App，不会自动创建第二套数据。 [应用设置文档](https://livecontainer.github.io/zh-CN/docs/guides/app-settings) · [LiveContainer 启动调度代码](https://github.com/LiveContainer/LiveContainer/blob/9108ae624ea001f7d7696d48407f890b48fa2653/LiveContainerSwiftUI/Models/LCAppModel.swift#L251-L270)

要同时开两份，可先让 B 保持打开，在 A 长按同一个 App，进入 **容器** 选择 B 没用的那份，确认卡片显示的是第二个容器再点「启动」。如果 A 和 B 本来就要跑两个不同的 App，各自启动对应的 App 即可。 [同一 App 的不同容器](https://livecontainer.github.io/zh-CN/docs/guides/containers-and-external-data)

### 怎么把两个容器都加到桌面

用能正常启动的应用先验证两个容器，再分别给它们制作入口。

1. 长按应用选第一个容器，再长按 → **添加到主屏幕 → 复制启动 URL**。
2. 在「快捷指令」新建动作，搜索并选 LiveContainer 的 **Launch App**，填入刚才的 URL。先运行确认打开了对应容器，再用「添加到主屏幕」给它起名，例如「存档 A」。
3. 回到 LiveContainer 选第二个容器，再复制一次 URL，用它创建「存档 B」。复制快捷指令时也要换掉 URL。
4. 分别点两个桌面图标，检查打开的是各自的数据。快捷指令可把请求交给空闲的 LiveContainer，也会切到已经在运行的对应容器。想要普通模式下同时保留两份，需要空闲的另一个实例。 [官方桌面入口指南](https://livecontainer.github.io/zh-CN/docs/guides/add-to-home-screen) · [多个实例的启动规则](https://livecontainer.github.io/zh-CN/docs/guides/multiple-livecontainers)

## 其他能用的功能和限制

- **管理 IPA 和软件源。** 可以从「App → ＋」导入可信的本地 IPA，也能添加兼容 AltStore 格式的软件源。只想试用几个应用时，一个 LiveContainer 足够轮流打开。 [项目简介](https://livecontainer.github.io/zh-CN/docs/intro) · [软件源指南](https://livecontainer.github.io/zh-CN/docs/guides/sources)
- **管理存档。** 在容器详情里能打开数据文件夹或绑定外部目录。项目提醒许多 App 不支持外部容器，普通本地存档用内部容器更省事。移动或清理数据前先导出需要保留的文件。 [容器指南](https://livecontainer.github.io/zh-CN/docs/guides/containers-and-external-data) · [数据管理](https://livecontainer.github.io/zh-CN/docs/guides/data-management)
- **给确实需要的 App 开 JIT。** 例如某些模拟器需要动态编译。iOS 26 及以后的启用方式与设备和 App 有关，按该 App 和 LiveContainer 的文档配置。免 JIT 测试是签名和加载检查。 [JIT 支持文档](https://livecontainer.github.io/zh-CN/docs/guides/jit-support)
- **在测试应用上试模块。** LiveContainer 能加载动态库和框架，模块会运行在应用进程里。项目也说明容器内的应用缺少彼此独立的系统沙盒，远程推送及部分系统能力受限。对依赖通知、系统权限或账号风控的应用，用官方客户端更合适。 [模块指南](https://livecontainer.github.io/zh-CN/docs/guides/tweaks) · [项目已知限制](https://github.com/LiveContainer/LiveContainer#limitations)
