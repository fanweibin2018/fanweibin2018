---
title: '连接 Docker 容器与宿主机 MySQL 的跨平台指南'
date: 2025-09-17
slug: 'lian-jie-docker-rong-qi-yu-su-zhu-ji-mysql-de-kua-ping-tai-zhi-nan'
categories:
  - '容器与运维'
tags:
  - 'Docker'
  - 'MySQL'
  - 'Docker Compose'
  - '网络'
source: halo
description: '在使用Docker进行开发时，一个常见的需求是让容器内的应用访问宿主机上运行的MySQL服务。本文将详细介绍在macOS、Windows和Linux系统上，如何通过Docker镜像和Docker Compose实现这一目'
---

# 连接 Docker 容器与宿主机 MySQL 的跨平台指南

在使用Docker进行开发时，一个常见的需求是让容器内的应用访问宿主机上运行的MySQL服务。本文将详细介绍在macOS、Windows和Linux系统上，如何通过Docker镜像和Docker Compose实现这一目标。

## 理解核心概念

Docker容器默认与宿主机网络隔离。要从容器内部访问宿主机服务，需要使用特殊的主机名或IP地址：

- **macOS和Windows**：使`host.docker.internal`这个特殊DNS名称
- **Linux**：使用宿主机的实际IP地址或Docker网桥IP（通常`172.17.0.1`）

## 准备工作：配置MySQL

无论使用哪种平台，都需要先确保MySQL允许外部连接：

### MySQL配置

1. 修改MySQL配置文件中`bind-address0.0.0.0`
2. 创建允许远程连接的用户（使`'user'@'%'`而不`'user'@'localhost'`）
3. 重启MySQL服务

## 不同平台上的连接方式

### macOS系统

#### 使用docker run命令

```
docker run -p 8080:8080 \
  -e MYSQL_HOST=host.docker.internal \
  your-app-image
```

#### 使用Docker Compose

```
version: '3.8'

services:
  your-app:
    image: your-app-image
    ports:
      - "8080:8080"
    environment:
      - MYSQL_HOST=host.docker.internal
    depends_on:
      - mysql
  # 如果需要，也可以直接在Compose中定义MySQL服务
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
    ports:
      - "3306:3306"
```

### Windows系统

#### 使用docker run命令

```
docker run -p 8080:8080 ^
  -e MYSQL_HOST=host.docker.internal ^
  your-app-image
```

#### 使用Docker Compose

```
version: '3.8'

services:
  your-app:
    image: your-app-image
    ports:
      - "8080:8080"
    environment:
      - MYSQL_HOST=host.docker.internal
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Linux系统

Linux系统需要额外步骤，因为默认不支`host.docker.internal`。

#### 方法一：使用宿主机的IP地址

1. 查找宿主机的IP地址：

```
ip addr show | grep "inet " | grep -v 127.0.0.1
```

2. 使用找到的IP地址（如192.168.1.100）：

```
docker run -p 8080:8080 \
  -e MYSQL_HOST=192.168.1.100 \
  your-app-image
```

#### 方法二：使用docker run的--add-host参数

```
docker run -p 8080:8080 \
  --add-host=host.docker.internal:172.17.0.1 \
  -e MYSQL_HOST=host.docker.internal \
  your-app-image
```

#### 方法三：使用Docker Compose

```
version: '3.8'

services:
  your-app:
    image: your-app-image
    ports:
      - "8080:8080"
    environment:
      - MYSQL_HOST=host.docker.internal
    extra_hosts:
      - "host.docker.internal:172.17.0.1"
```

## 使用Docker Compose的最佳实践

对于开发环境，建议使用Docker Compose统一管理所有服务：

```
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=mysql-host
    depends_on:
      - mysql
    # 针对Linux系统添加extra_hosts
    extra_hosts:
      - "mysql-host:172.17.0.1"
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: myapp
      MYSQL_USER: myappuser
      MYSQL_PASSWORD: myapppassword
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
volumes:
  mysql-data:
```

## 故障排除技巧

1. **测试连接**：在容器内使`pingtelnet`命令测试到宿主机的连接
2. **检查防火墙**：确保宿主机的防火墙没有阻止相关端口
3. **查看日志**：检查MySQL的日志确认连接尝试
4. **验证配置**：确认MySQL已正确配置为接受远程连接

## 总结

通过正确配置和使用适当的主机名/IP地址，可以轻松实现Docker容器与宿主机上MySQL服务的连接。不同平台间的差异主要在于如何解析宿主机地址：

- macOS/Windows：使`host.docker.internal`
- Linux：使用宿主机IP或通`extra_hosts`配置映射

使用Docker Compose可以简化这一过程，特别是在多服务环境中，提供一致的开发体验。
