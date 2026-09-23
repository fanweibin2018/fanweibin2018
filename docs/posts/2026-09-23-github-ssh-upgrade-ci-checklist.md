---
title: 'GitHub 调整 SSH 安全策略：先检查构建机，再决定要不要换密钥'
date: 2026-09-23
slug: 'github-ssh-upgrade-ci-checklist'
author: 范伟彬
description: '从 GitHub 9 月 22 日的 SSH 公告出发，分清 RSA 密钥、签名算法和密钥交换，给开发机、CI 与自托管环境整理一套可执行的排查顺序。'
categories:
  - 开发工具
  - DevOps
tags:
  - GitHub
  - SSH
  - OpenSSH
  - CI/CD
  - 自托管
---

# GitHub 调整 SSH 安全策略：先检查构建机，再决定要不要换密钥

同一个仓库，笔记本可以拉取，定时构建却失败。遇到这种情况，重新生成密钥往往是最先想到的操作，但真正落后的可能是构建容器里的 SSH 客户端。

GitHub 在 2026 年 9 月 22 日发布了 [SSH 安全调整公告](https://github.blog/changelog/2026-09-22-security-improvements-for-ssh/)：将退出 RSA/SHA-1 签名及一种旧密钥交换算法；10 月 14 日起，新上传的 RSA 密钥要求至少 3072 位，并开始在指定云服务范围启用 ML-KEM 混合密钥交换。使用 HTTPS remote 的连接不受这次 SSH 调整影响。

对维护 CI 和家庭实验室的人，我的建议是先盘点连接路径，再安排升级。下面的排查顺序是基于官方文档整理的工程建议，并非一次已完成的生产迁移报告。

## 先把三个容易混淆的概念分开

**RSA 密钥与 RSA/SHA-1 签名不是一回事。** 公钥文件以 `ssh-rsa` 开头，只能说明它是 RSA 密钥，不能单凭这一行判定连接正在使用 SHA-1。支持相应算法的客户端可以用同一把 RSA 密钥完成 SHA-256 或 SHA-512 签名。

这也不是全新的兼容性问题。[OpenSSH 8.8 发布说明](https://www.openssh.org/txt/release-8.8)记录了默认关闭 RSA/SHA-1 签名的变化，并说明已有 RSA 密钥通常无需更换。因此，“更换密钥”与“升级客户端”应当是两个独立决策：前者处理密钥类型、长度与生命周期，后者处理协议实现能力。

**密钥交换又是另一层。** 它负责建立会话使用的共享秘密，不等同于证明你是谁的认证签名。按 [OpenSSH 的后量子说明](https://www.openssh.org/pq.html)，`mlkem768x25519-sha256` 在 OpenSSH 9.9 加入，10.0 成为默认方案。它针对的是攻击者先保存加密流量、未来再解密的风险。看到 ML-KEM 的名字，不意味着必须立即重建全部用户密钥，也不能据此声称整条认证链已经具备后量子安全性。

## 第一轮检查：确定是谁在连接

先在发生问题的仓库查看 remote，再到实际执行任务的环境检查 SSH 版本：

```bash
git remote -v
ssh -V
```

重点是“实际环境”。宿主机、容器、IDE 和 CI 插件可能不是同一套实现。对 Java 构建工具，还应检查它是否通过内嵌 SSH 库访问仓库；更新系统 OpenSSH，并不能证明该库也已更新。

我建议给每条重要任务记录四项信息：仓库连接方式、执行位置、客户端或库版本、任务负责人。不要只登记开发人员的电脑。夜间备份、发布机和很少重新构建的基础镜像，也应该在清单里。

假设某条发布任务的主仓库使用 HTTPS，但脚本另外拉取一个 SSH 地址的依赖仓库，那么只查看主仓库 remote 会漏掉后半段。排查时应顺着真实执行路径检查子模块和额外的 Git 命令，而不是根据平台名称判断是否受影响。

## 第二轮检查：区分支持、配置和实际协商

对 OpenSSH 客户端，可以依次查看能力与目标配置：

```bash
ssh -Q kex
ssh -G github.com
```

依照 [ssh 命令手册](https://man.openbsd.org/ssh)，`-Q` 用于查询支持的算法，`-G` 输出应用主机规则后的配置。两者都不能替代真实连接：支持某算法，不代表当前配置允许它；配置允许它，也不代表这次连接最终选中了它。很旧的客户端若不支持这些选项，应先查对应版本文档。

配置检查后，再测试认证；需要诊断时增加详细日志：

```bash
ssh -T git@github.com
ssh -vT git@github.com
```

[GitHub 的连接测试文档](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)提醒了两个细节：第一次连接应核对主机指纹；认证成功后，由于不提供 shell，测试命令仍可能以状态码 1 退出。不要把“非零退出码”直接翻译成“密钥失效”，应结合认证提示判断。

随后还要运行该任务真实使用的只读拉取操作，确认仓库权限和自动化环境均正常。账户认证通过与目标仓库可访问，是两项不同的验收结果。分享诊断日志前，清理用户名、内部主机名和本地路径。

## 升级应按任务验收，而不是按机器打勾

我的迁移建议是先选一条低影响流水线，在测试环境更新客户端或依赖库，完整走通拉取与构建，再逐步推广。每次记录镜像或软件版本、验证时间和对应任务，方便定位后续差异。

这里有一个容易忽略的成本：密钥轮换会连带修改凭据存储、部署配置和运维记录。如果根因只是旧库不支持需要的签名算法，先把这条链路修通，可以减少同时变更多个因素带来的排查困难。确实需要轮换时，再单独验证新凭据的权限和使用位置。

也不要把搜索到的“重新打开旧算法”配置直接铺到所有机器上。OpenSSH 的旧版说明将重新启用 SHA-1 定位为临时兼容措施；当远端退出该算法后，客户端增加允许项也无法让对方重新支持它。迁移计划应明确哪个组件需要升级，而不是依赖永久保留兼容开关。

## 日期要核对，验收可以现在开始

GitHub 公告列出 11 月 4 日、12 月 9 日两次临时停用测试。不过截至本文核查时，最终停用一项写成了 **2026 年 1 月 13 日**，早于公告本身，存在时间线矛盾。本文不擅自将其改成另一年份，最终节点请以[官方公告的后续更正](https://github.blog/changelog/2026-09-22-security-improvements-for-ssh/)为准。

这不妨碍现在完成环境盘点。先挑出一条不能中断的自动化任务，确认它的连接方式、真实客户端和仓库访问结果，再为剩余任务安排验证。把这些证据写进维护记录，比只记一句“SSH 已升级”更有用。

## 参考资料

- [GitHub：Security improvements for SSH](https://github.blog/changelog/2026-09-22-security-improvements-for-ssh/)
- [OpenSSH 8.8 发布说明](https://www.openssh.org/txt/release-8.8)
- [OpenSSH：Post-Quantum Cryptography](https://www.openssh.org/pq.html)
- [OpenBSD：ssh(1) 手册](https://man.openbsd.org/ssh)
- [GitHub：Testing your SSH connection](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)
