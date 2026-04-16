---
title: '常见报错'
date: 2025-08-10
slug: 'chang-jian-bao-cuo'
categories:
  - '容器与运维'
tags:
  - 'Docker'
  - 'Windows'
  - '端口映射'
  - 'WinNAT'
  - '故障排查'
source: halo
description: '1.1. 基础知识 Docker端口映射 ：Docker允许你将容器内部的端口映射到宿主机的端口，从而可以访问容器内运行的服务。 Windows NAT服务 ：Windows NAT（网络地址转换）服务，也称为WinNA'
---

# 1. Docker 容器端口映射问题

```
(HTTP code 500) server error - Ports are not available: exposing port TCP 0.0.0.0:6379 -> 0.0.0.0:0: listen tcp 0.0.0.0:6379: bind: An attempt was made to access a socket in a way forbidden by its access permissions.
```

## 1.1. 基础知识

**Docker端口映射**：Docker允许你将容器内部的端口映射到宿主机的端口，从而可以访问容器内运行的服务。

**Windows NAT服务**：Windows NAT（网络地址转换）服务，也称为WinNAT，是Windows中负责管理端口映射和网络路由的组件。

## 1.2. 核心概念

**WinNAT服务**：在Windows上，Docker容器的网络通信依赖于WinNAT服务来进行端口映射。

## 1.3. 问题原因

**WinNAT服务故障**：当WinNAT服务出现问题或配置不当时，可能会导致端口映射失败。

## 1.4. 解决办法

**重启WinNAT服务**：通过停止并重新启动WinNAT服务，可以解决一些临时的网络配置问题或重置网络状态。

```
net stop winnat  // 停止WinNAT服务
net start winnat // 重新启动WinNAT服务
```

# 2. Windows 端口占用问题

## 2.1. 查看指定端口占用情况

使用 `netstat` 命令来查找占用特定端口的进程ID（PID）。

```
netstat -aon | findstr :<端口号>
```

例如，如果想查找占`8080`端口的进程，可以使用：

```
netstat -aon | findstr :8080
```

命令输出的最后一列即为占用该端口的进程ID。

## 2.2. 查找进程ID对应的进程

使用 `tasklist` 命令来查找与该PID对应的进程名称。

```
tasklist /FI "PID eq <进程ID>"
```

例如，如果上一步找到的PID`1234`，可以使用：

```
tasklist /FI "PID eq 1234"
```

## 2.3. 终止进程

使用 `taskkill` 命令来终止该进程。

```
taskkill /PID <进程ID> /F
```

例如，终止PID`1234`的进程：

```
taskkill /PID 1234 /F
```
