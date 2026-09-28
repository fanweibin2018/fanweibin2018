---
title: 'PostgreSQL 19 Beta 4：REPACK 如何回收表空间，在线模式有哪些边界'
date: 2026-09-28
slug: 'postgresql-19-repack-concurrently-beta4'
author: 范伟彬
description: '从 PostgreSQL 19 Beta 4 对 REPACK 的修复讲起，解释它如何重写膨胀表、CONCURRENTLY 如何缩短锁窗口，以及磁盘、复制和 MVCC 方面的限制。'
categories:
  - 数据库
  - 技术原理
tags:
  - PostgreSQL
  - 数据库维护
  - MVCC
  - REPACK
---

# PostgreSQL 19 Beta 4：REPACK 如何回收表空间，在线模式有哪些边界

**一句话结论：**PostgreSQL 19 把 `REPACK` 加进了数据库内核，用来重写表、回收死元组占用的空间，并可按索引重新排列数据；`CONCURRENTLY` 能把独占锁主要压缩到最后切换文件的阶段，但它仍需要额外磁盘空间、逻辑解码和一次短暂的独占锁，也不是所有表都能使用。

PostgreSQL 项目在 **2026 年 9 月 24 日**发布了 [PostgreSQL 19 Beta 4](https://www.postgresql.org/about/news/postgresql-19-beta-4-released-3386/)。公告提到，这个版本继续修复新 `REPACK` 命令的问题，包括崩溃、无效索引和物化视图处理，以及权限和错误报告。Beta 4 是供测试的预发布版本；[官方测试说明](https://www.postgresql.org/developer/beta/)明确建议不要把 Beta 版本用于生产。它适合团队拿真实的测试数据和查询做兼容性验证，不适合作为生产迁移的信号。

## 表为什么会“变胖”

在 PostgreSQL 的多版本并发控制（MVCC）中，更新一行通常会写入新版本，旧版本在不再被事务引用后成为死元组；删除也会留下待清理的旧版本。普通 `VACUUM` 清理这些版本，让数据库之后可以重用页面里的空间，但通常不会把表文件整体缩小并把空间还给操作系统。

如果一张表经历大量更新和删除，空洞散在数据页中，文件可能仍很大。想把数据重新写成更紧凑的文件，传统上会用 `VACUUM FULL`；想按索引顺序重排数据，会用 `CLUSTER`。这两种操作都要重写表，期间会长时间阻止其他会话访问表。PostgreSQL 19 的 [`REPACK` 命令](https://www.postgresql.org/docs/19/release-19.html)把这类重写统一到一个命令下，保留旧命令以兼容已有脚本。

| 操作 | 清理死元组 | 重写并缩小文件 | 按索引重排 | 并发访问特点 |
|---|---|---|---|---|
| `VACUUM` | 是 | 通常不会整体缩小 | 否 | 日常读写可继续 |
| `VACUUM FULL` | 是 | 是 | 否 | 重写期间需要独占锁 |
| `CLUSTER` | 是 | 是 | 是 | 重写期间需要独占锁 |
| `REPACK` | 是 | 是 | 可选 `USING INDEX` | 普通模式持锁较久；`CONCURRENTLY` 仍需最后切换锁 |

可以把它想成整理一间仍在营业的图书馆：普通重写先关门，把书全部整理到新书架，再换掉旧书架；并发模式则边营业边复制书籍，同时记录读者借还变动，最后短暂关门补齐变动并交换书架。这个“最后交换”仍需要锁，读写很繁忙时，补账本身也可能让锁持有时间变长。

## `CONCURRENTLY` 怎样缩短锁窗口

普通 `REPACK` 会把表和索引写入新文件，再将新旧文件交换。为避免交换时丢掉写入，普通模式在整个处理中持有 `ACCESS EXCLUSIVE` 锁，其他读写都无法访问这张表。

[`REPACK` 手册](https://www.postgresql.org/docs/19/sql-repack.html)描述了并发模式：它先把现有数据和索引复制到新文件；复制期间发生的写入由逻辑解码捕获，再应用到新文件；完成追赶后，才请求 `ACCESS EXCLUSIVE` 锁交换新旧文件。多数情况下，锁只用于切换阶段，因此会短得多。它不是“完全无锁”：如果复制期间积累了大量变化，切换前需要处理的追赶工作会增加；同时发生的 DDL 也可能让操作失败。

在线模式有明确前提。[命令手册](https://www.postgresql.org/docs/19/sql-repack.html)说明，它不能用于物化视图、未记录表、分区表、系统目录或 TOAST 表，也不能用于非 heap 存储访问方法；表必须有主键或基于索引的 replica identity，系统还要能创建所需的复制槽。命令不能放在事务块里执行。若表上有无效索引，`REPACK` 会拒绝处理；调用者还需有该表的 `MAINTAIN` 权限。

## 在 Beta 测试环境观察一次重写

先在隔离的 PostgreSQL 19 Beta 4 实例中选一张非生产测试表，记录操作前的总大小，并确认索引有效、复制槽资源足够。不要在生产数据库试跑 Beta 命令。下面是 PostgreSQL 19 手册中的语法示例；PostgreSQL 18 及更早版本没有内置这个 SQL 命令。

```sql
-- 查看表、索引及 TOAST 等关联对象的总大小
SELECT pg_size_pretty(pg_total_relation_size('public.orders')) AS total_size;

-- 在 psql 自动提交模式执行，不要包进 BEGIN / COMMIT
REPACK (CONCURRENTLY) public.orders;
```

`REPACK` 会重写整张表以及它的索引，不是只清掉几页空洞。重写时要为新表和新索引预留空间：顺序扫描并排序时，峰值临时空间可能达到约两倍表大小再加索引；并发模式还可能暂存复制期间的新写入。[手册的资源说明](https://www.postgresql.org/docs/19/sql-repack.html)指出，实际峰值取决于执行方式和数据，不能把一个固定比例当作保证。

操作运行期间，可以从 [`pg_stat_progress_repack`](https://www.postgresql.org/docs/19/progress-reporting.html#REPACK-PROGRESS-REPORTING) 查看阶段、扫描进度和并发写入追赶情况；没有正在执行的重写时，这个视图不会有对应行。

```sql
SELECT pid,
       relid::regclass AS table_name,
       command,
       phase,
       heap_blks_scanned,
       heap_blks_total,
       heap_tuples_updated,
       heap_tuples_deleted
FROM pg_stat_progress_repack
WHERE relid = 'public.orders'::regclass;
```

手册记录了 `initializing`、扫描、写入新表、`catch-up`、交换文件、重建索引和清理等阶段。对于并发模式，`catch-up` 阶段能帮助判断复制期间的写入是否正在增加切换前的工作量。完成后重新查看表和索引大小，并用代表性查询检查执行计划；如果使用了 `USING INDEX` 重排，更新数据后新行不会自动维持该顺序。

## 几个容易忽略的边界

**在线不等于没有锁。** 最终交换仍需要 `ACCESS EXCLUSIVE` 锁；遇到长事务、繁忙写入或 DDL，锁等待和追赶时间都可能变得明显。执行前要确认维护窗口和锁等待告警策略。

**需要足够的临时空间。** 重写期间新旧文件会同时存在，空间不足可能让操作无法完成。运行前应看表与索引总大小、磁盘剩余空间及近期写入量，不要只按表文件大小估算。

**并发模式有 MVCC 可见性注意事项。** [PostgreSQL 手册](https://www.postgresql.org/docs/19/mvcc-caveats.html)指出，`REPACK (CONCURRENTLY)` 不是 MVCC-safe：如果某个并发事务在命令提交前已取得快照、但在命令开始前没有访问目标表，那么该事务之后读取目标表时可能看到空表；目标表与同事务读取的其他表之间也可能出现短暂可见性不一致。对长事务或依赖跨表一致快照的任务，执行前应专门评估。

**Beta 功能仍会变化。** PostgreSQL 项目的[测试说明](https://www.postgresql.org/developer/beta/)提醒，Beta 可能包含严重问题，功能细节也可能发生向后不兼容变化。Beta 4 对 `REPACK` 的修复正说明了为什么要用自己的数据和工作负载测试，而不是把预发布手册当作稳定生产契约。

另外，内核中的 SQL 命令 `REPACK` 与社区维护的 [`pg_repack` 扩展](https://github.com/reorg/pg_repack)是不同项目。已有运维脚本若调用扩展客户端，不能仅因名称相似就直接替换成 PostgreSQL 19 的 SQL 语法。

## 适合谁先关注

如果你的系统有大型高更新表、维护窗口有限，并且正在评估 PostgreSQL 19，可以在隔离环境中优先测试 `REPACK (CONCURRENTLY)`：确认目标表是否满足 replica identity 与复制槽条件，验证磁盘峰值、写入追赶耗时、切换锁等待、事务快照行为和关键查询计划。它为表空间回收提供了一个更适合在线负载的内核方案，但选择它之前仍要理解锁、空间和 MVCC 三项成本。

## 原始资料

- [PostgreSQL 19 Beta 4 发布公告（2026-09-24）](https://www.postgresql.org/about/news/postgresql-19-beta-4-released-3386/)
- [PostgreSQL 19 Beta 测试说明](https://www.postgresql.org/developer/beta/)
- [PostgreSQL 19 Release Notes](https://www.postgresql.org/docs/19/release-19.html)
- [PostgreSQL 19 `REPACK` 命令手册](https://www.postgresql.org/docs/19/sql-repack.html)
- [PostgreSQL 19 重写进度报告视图](https://www.postgresql.org/docs/19/progress-reporting.html#REPACK-PROGRESS-REPORTING)
- [PostgreSQL 19 MVCC 注意事项](https://www.postgresql.org/docs/19/mvcc-caveats.html)
- [`pg_repack` 扩展项目](https://github.com/reorg/pg_repack)
