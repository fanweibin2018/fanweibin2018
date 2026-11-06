---
title: 'OpenSSH 10.6p2 紧急修复：一个星号怎样绕过密码认证'
date: 2026-11-07
slug: 'openssh-10-6p2-musl-password-bypass'
author: 范伟彬
description: 'OpenSSH 10.6p2 修复了 musl Linux、无 PAM 和密码登录同时出现时的认证绕过。本文拆解 crypt() 返回值与 shadow 星号相撞的机制，并给出不触发登录的配置排查、升级和应急处置方法。'
source: 'https://www.openssh.com/releasenotes.html#10.6p2'
categories:
  - 技术
  - 安全
  - 开源
tags:
  - OpenSSH
  - musl
  - Alpine Linux
  - SSH
  - 身份认证
---

# OpenSSH 10.6p2 紧急修复：一个星号怎样绕过密码认证

OpenSSH 在 11 月 5 日发布了 [10.6p2](https://www.openssh.com/releasenotes.html#10.6p2)，其中只有一项安全修复，却被项目称为“关键安全规避措施”：在使用 musl libc、没有启用 PAM、同时允许密码登录的 Linux 系统上，攻击者可能无需知道密码就通过 sshd 认证。

最典型的受影响平台是 Alpine Linux，但不能把结论简化成“所有 Alpine 都有漏洞”。是否存在暴露面，至少取决于运行中的 sshd 是否包含修复、是否走 PAM、是否允许密码认证，以及系统中账户密码字段的具体状态。反过来，只看 `ssh -V` 也不够：发行版可能把补丁回移到旧版本号，升级包后没有重启的 sshd 仍在运行旧代码。

这次问题值得拆开看，因为它不是常见的口令强度或加密算法失效，而是三个组件对同一个特殊字符串作出了不同解释：账户数据库把 `*` 当作“不能用密码登录”，musl 的 `crypt()` 把 `*` 当作错误返回值，旧版 sshd 却把两边相等当作密码正确。

## 先看清受影响条件

[musl 维护者的公告](https://www.openwall.com/lists/musl/2026/11/05/4)把必要的服务配置概括为：OpenSSH 低于 10.6p2、使用 musl、`UsePAM=no`、`PasswordAuthentication=yes`。不过具体账户能否被登录，还要继续看账户数据。

Alpine 的[安全公告](https://www.alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/)给出的完整条件包括：目标账户的 shadow 密码字段为 `*`，机器上另有一个账户使用 `$5$` 或 `$6$` 开头的密码哈希。前者常见于只用 SSH 密钥、从未设置密码的账户；后者让 OpenSSH 能从另一个账户取得可交给 `crypt()` 的盐值。

可以把几项条件放在一起判断：

| 条件 | 这条绕过路径是否成立 |
|---|---|
| `PasswordAuthentication no` | 不成立，sshd 不接受密码认证 |
| PAM 已编译且 `UsePAM yes` | 不走这段本地 `crypt()` 比较路径 |
| glibc 而不是 musl | 这次公开问题不适用 |
| 目标账户字段为 `!` | Alpine 公告明确列为不受该路径影响 |
| 目标账户字段为 `*`，且其他必要条件满足 | 需要立即升级或关闭密码登录 |
| 容器中根本没有运行 sshd | 不存在这个 SSH 服务暴露面 |

这里的 `*` 不能简单读成“空密码”。它是一段不应由正常密码哈希产生的占位值，原本的意图就是阻止密码认证。真正的空字符串、`!` 和 `*` 在账户系统里有不同语义，排查时不能混为一谈。

## 一个错误返回值怎样变成“密码正确”

不使用 PAM 时，sshd 大致要完成三步：从 shadow 数据取得目标账户的存储字段；用候选密码和盐值调用 `crypt()`；比较计算结果与存储字段是否相等。

正常情况下，存储字段类似 `$6$...`，`crypt()` 返回同样格式的哈希，只有密码正确才会完全相等。问题出在异常路径：musl 的 `crypt()` 收到超过 256 字节的候选密码时会返回 `*` 表示错误，而目标账户的存储字段也可能正好是 `*`。于是旧代码看到了两个相同字符串：

```text
目标账户的存储字段：  *
crypt() 的错误返回值：*
字符串比较结果：      相等
```

这就像门卫拿到一张写着“证件无效”的回执，又看到访客档案同样写着“证件无效”，最后仅凭两张纸文字相同就放行。两边相等没有错，错的是没有先确认它们是否都是有效凭证。

OpenSSH 的[修复提交](https://github.com/openssh/openssh-portable/commit/4353fdc43ef646c43a8dda7025cc1a898caf1482)很小，但边界很清楚。新的认证条件除了要求 `crypt()` 结果非空、两边相等，还要求存储字段至少有 4 个字符：

```c
ret = encrypted_password != NULL &&
    strlen(pw_password) >= MIN_PASSWORD_HASH_LEN &&
    strcmp(encrypted_password, pw_password) == 0;
```

因此 `*` 这类短占位值不会再进入“比较相等即成功”的结论。补丁还复制并在使用后清零密码字段，修正了相关内存所有权；真正阻断绕过的是最小哈希长度检查。

这也解释了 OpenSSH 为什么把它称为 workaround。musl 维护者认为调用方错误使用了 `crypt()` 的返回值，OpenSSH 则选择在最接近认证决策的位置增加防线。对运维者而言，责任归属不影响处置顺序：先让运行中的 sshd 获得修复，再讨论 libc 接口将来怎样调整。

## 不做攻击测试，先检查有效配置

不要用真实账户和超长密码去“试一下”。一台公网服务器最需要的不是漏洞演示，而是确认运行代码、有效配置和账户状态。

第一步先确认 libc 与发行版包。Alpine 上应以发行版公告列出的修复包为准，因为稳定分支使用的是回移补丁，版本号可能仍低于上游 10.6p2：

```bash
cat /etc/os-release
ldd --version 2>&1 | head -n 2
apk policy openssh 2>/dev/null || true
```

第二步检查 sshd 展开 `Include` 和默认值后的有效配置，而不是只在配置文件里 `grep`。下面的脚本不会建立 SSH 连接，也不会读取 `/etc/shadow`，只把 `sshd -T` 的结果归为“避开必要组合”“存在风险组合”或“无法判定”：

```sh
#!/bin/sh
set -eu

SSHD_BIN=${SSHD_BIN:-sshd}

if ! command -v "$SSHD_BIN" >/dev/null 2>&1; then
  echo "找不到 sshd；请在服务器本机、容器或镜像内运行。" >&2
  exit 1
fi

effective=$(mktemp)
trap 'rm -f "$effective"' EXIT HUP INT TERM
"$SSHD_BIN" -T >"$effective"

awk '
$1 == "usepam" { pam = $2 }
$1 == "passwordauthentication" { password = $2 }
END {
  if (pam == "") pam = "未显示（可能未编译 PAM）"
  if (password == "") password = "未显示"
  printf "UsePAM=%s\nPasswordAuthentication=%s\n", pam, password

  if (password == "no" || pam == "yes") {
    print "配置未落入本次绕过的必要组合。"
    exit 0
  }
  if (password == "yes" && pam != "yes") {
    print "存在风险配置组合：立即核对发行版修复包；未修复时先关闭密码登录。"
    exit 2
  }
  print "无法仅凭有效配置判定，请人工核对。"
  exit 3
}' "$effective"
```

我用四组伪造的 `sshd -T` 输出验证了脚本分支：PAM 开启、密码关闭、无 PAM 且密码开启，以及未显示 `UsePAM` 但密码开启，结果分别落入预期分类。这个检查只回答配置是否具备必要条件，不会证明二进制已修复，也不会判断某个用户能否被利用。

如果配置里使用了 `Match`，普通的 `sshd -T` 只展示默认上下文。还应为可登录账户代入实际连接条件，例如：

```bash
sshd -T -C user=deploy,host=server.example,addr=203.0.113.10 \
  | grep -E '^(usepam|passwordauthentication) '
```

把示例用户名、主机名和地址换成自己的真实条件。不同来源地址可能命中不同的 `Match Address`，不能只测一次就覆盖全部入口。

## 修复时，升级、重启和验证缺一不可

首选方案是安装发行版提供的修复包并重启 sshd。Alpine 公告已经为仍可获取包的多个稳定分支回移了补丁，因此不要自行用字符串比较断言“低于 10.6p2 就一定未修复”。Alpine 给出的更新命令是：

```bash
apk upgrade -U -a
rc-service sshd restart
```

升级包不会替换内存里已经运行的进程，漏掉第二行仍会继续运行旧 sshd。重启前先执行 `sshd -t` 检查配置语法，并保留现有管理会话，直到新的 SSH 连接验证成功。

暂时无法升级时，musl 与 Alpine 的公告都建议关闭密码登录。先确认另一终端能用公钥登录，再设置：

```text
PasswordAuthentication no
```

随后用 `sshd -t` 验证配置，重启服务，并再次用 `sshd -T` 确认最终值是 `no`。不要在唯一远程会话里盲改并立即断开，否则安全修复很容易变成自我锁定。

如果主机曾经同时满足条件并暴露在不可信网络上，仅仅打补丁不能回答“之前是否有人登录”。Alpine 建议检查日志中针对无密码账户的 `Accepted password` 记录，同时复核 `doas` 使用、最近创建的用户、文件和 `authorized_keys`。无法排除异常登录时，应按已失陷主机处置，而不是把升级成功当作历史风险自动消失。

## 这次事件带来的工程提醒

第一，身份认证代码不能只验证“结果相等”，还要验证结果属于预期的值域。错误哨兵、禁用标记和正常数据如果共享同一种字符串类型，边界检查就是协议的一部分。

第二，安全清单要记录有效配置和运行进程，而不只是文件与包版本。`Include`、`Match`、发行版回移补丁和未重启的守护进程，都会让静态版本扫描得出错误结论。

第三，密钥登录账户并不等于与密码认证无关。账户本身可能只使用公钥，但只要服务全局仍接受密码、shadow 字段使用特殊占位值，错误的认证路径仍可能触达它。真正的最小暴露面，是不需要密码登录时在 sshd 层明确关闭它。

OpenSSH 10.6p2 的补丁只有几行关键判断，却修复了一个跨越 sshd、libc 与账户数据库语义的认证漏洞。对维护 Alpine、OpenWrt、Buildroot、Yocto 或其他 musl 系统的人，今天最有价值的动作不是复现绕过，而是查清三件事：运行中的 sshd 是否包含补丁，有效配置是否允许密码认证，以及过去的日志是否出现过不应有的密码登录。

## 原始资料

- [OpenSSH 10.6p2 发布说明](https://www.openssh.com/releasenotes.html#10.6p2)
- [OpenSSH 修复提交：avoid password authn bypass](https://github.com/openssh/openssh-portable/commit/4353fdc43ef646c43a8dda7025cc1a898caf1482)
- [musl 邮件列表：OpenSSH + musl 用户公告](https://www.openwall.com/lists/musl/2026/11/05/4)
- [Alpine Linux 安全公告与修复包列表](https://www.alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/)
- [Wakefield：漏洞研究与披露时间线](https://wakefield.co/research/openssh-musl-authentication-bypass)
