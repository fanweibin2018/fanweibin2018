---
title: 'Docker 安装 Redis 详细教程'
date: 2025-08-20
slug: 'docker-an-zhuang-redis-xiang-xi-jiao-cheng'
categories:
  - '容器与运维'
tags:
  - 'Docker'
  - 'Redis'
  - '软件安装'
source: halo
description: '环境准备 在开始之前，请确保系统满足以下要求： 已安装 Docker（版本 18.06 或更高） 具备基本的 Linux 命令行操作能力 系统具有足够的存储空间和内存 1. 拉取 Redis 镜像 首先，从 Docker'
---

# Docker 安装 Redis 详细教程

## 环境准备

在开始之前，请确保系统满足以下要求：

- 已安装 Docker（版本 18.06 或更高）
- 具备基本的 Linux 命令行操作能力
- 系统具有足够的存储空间和内存

## 1. 拉取 Redis 镜像

首先，从 Docker Hub 拉取官方 Redis 镜像：

```
# 拉取最新版本的 Redis 镜像
docker pull redis:latest

# 或者指定特定版本（推荐）
docker pull redis:7.0
```

推荐使用指定版本的方式，这样可以确保环境的一致性和稳定性。

## 2. 运行 Redis 容器

### 2.1 基础运行命令

使用以下命令启动一个 Redis 实例：

```
# 基础运行
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  redis:7.0
```

参数说明：

- `-d`: 后台运行容器
- `--name`: 指定容器名称
- `-p`: 端口映射（主机端口:容器端口）

### 2.2 带密码保护的运行

```
# 设置密码保护
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -e REDIS_PASSWORD=your_password \
  redis:7.0 \
  redis-server --requirepass your_password
```

### 2.3 高级配置运行

为了更好地管理 Redis，建议使用更完整的配置：

```
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v redis-data:/data \
  -v redis-conf:/usr/local/etc/redis \
  redis:7.0 \
  redis-server /usr/local/etc/redis/redis.conf
```

## 3. 数据持久化配置

为了避免容器删除后数据丢失，需要配置数据持久化：

### 3.1 使用命名卷（推荐）

```
# 创建命名卷
docker volume create redis-data
# 运行容器并挂载卷
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7.0 \
  redis-server --appendonly yes
```

### 3.2 使用绑定挂载

```
# 创建本地目录
mkdir -p /opt/redis/data
# 运行容器并绑定挂载
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v /opt/redis/data:/data \
  redis:7.0 \
  redis-server --appendonly yes
```

## 4. 自定义配置

### 4.1 创建自定义配置文件

创建 `redis.conf` 配置文件：

```
# 网络配置
bind 0.0.0.0
port 6379
timeout 0
tcp-keepalive 300
# 安全配置
requirepass your_password
# 持久化配置
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
# 内存管理
maxmemory 256mb
maxmemory-policy allkeys-lru
# 日志配置
loglevel notice
logfile ""
# 慢查询日志
slowlog-log-slower-than 10000
slowlog-max-len 128
```

### 4.2 挂载配置文件

```
# 创建配置目录
mkdir -p /opt/redis/conf
# 将配置文件放入目录
# 将上面的配置保存为 /opt/redis/conf/redis.conf
# 运行容器并挂载配置
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v /opt/redis/data:/data \
  -v /opt/redis/conf/redis.conf:/usr/local/etc/redis/redis.conf \
  redis:7.0 \
  redis-server /usr/local/etc/redis/redis.conf
```

## 5. 容器管理命令

### 5.1 常用管理命令

```
# 查看运行中的容器
docker ps
# 查看容器日志
docker logs redis-container
# 进入容器内部
docker exec -it redis-container bash
# 停止容器
docker stop redis-container
# 启动容器
docker start redis-container
# 重启容器
docker restart redis-container
# 删除容器
docker rm redis-container
```

### 5.2 连接 Redis

```
# 在容器内部连接
docker exec -it redis-container redis-cli
# 带密码连接
docker exec -it redis-container redis-cli -a your_password
# 在主机上使用 Redis 客户端连接（需先安装）
redis-cli
# 带密码连接
redis-cli -a your_password
```

## 6. 使用 Docker Compose（推荐）

创建 docker-compose.yml 文件：

```
version: '3.8'
services:
  redis:
    image: redis:7.0
    container_name: redis-container
    restart: always
    command: redis-server --appendonly yes --requirepass your_password
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./redis/conf:/usr/local/etc/redis
    networks:
      - redis-network
    environment:
      - REDIS_PASSWORD=your_password
volumes:
  redis-data:
networks:
  redis-network:
    driver: bridge
```

运行命令：

```
# 启动服务
docker-compose up -d
# 停止服务
docker-compose down
# 查看服务状态
docker-compose ps
```

## 7. 高级配置选项

### 7.1 主从复制配置

创建主节点：

```
docker run -d \
  --name redis-master \
  -p 6379:6379 \
  redis:7.0 \
  redis-server --appendonly yes
```

创建从节点：

```
docker run -d \
  --name redis-slave \
  -p 6380:6379 \
  redis:7.0 \
  redis-server --appendonly yes --slaveof redis-master 6379
```

### 7.2 Redis 集群配置

创建 Redis 集群配置文件 `redis-cluster.conf`：

```
port 7000
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
appendonly yes
```

使用 Docker Compose 配置集群：

```
version: '3.8'
services:
  redis-node-1:
    image: redis:7.0
    command: redis-server /usr/local/etc/redis/redis-cluster.conf
    volumes:
      - ./redis-cluster.conf:/usr/local/etc/redis/redis-cluster.conf
    ports:
      - "7001:7000"
  
  redis-node-2:
    image: redis:7.0
    command: redis-server /usr/local/etc/redis/redis-cluster.conf
    volumes:
      - ./redis-cluster.conf:/usr/local/etc/redis/redis-cluster.conf
    ports:
      - "7002:7000"
      
  redis-node-3:
    image: redis:7.0
    command: redis-server /usr/local/etc/redis/redis-cluster.conf
    volumes:
      - ./redis-cluster.conf:/usr/local/etc/redis/redis-cluster.conf
    ports:
      - "7003:7000"
```

## 8. 安全配置建议

### 8.1 基础安全配置

1. 设置强密码
2. 禁止公网访问
3. 使用非默认端口
4. 启用持久化

### 8.2 网络安全

```
# 创建专用网络
docker network create redis-network
# 在专用网络中运行容器
docker run -d \
  --name redis-container \
  --network redis-network \
  -v redis-data:/data \
  redis:7.0 \
  redis-server --appendonly yes --requirepass your_password
```

## 9. 性能优化

### 9.1 内存优化

```
# 设置最大内存限制
docker run -d \
  --name redis-container \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7.0 \
  redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### 9.2 持久化策略

根据使用场景选择合适的持久化策略：

- RDB（快照）：适合数据备份
- AOF（追加日志）：适合数据完整性要求高

## 10. 监控和维护

### 10.1 查看 Redis 状态

```
# 连接 Redis 并查看信息
docker exec -it redis-container redis-cli -a your_password info
# 查看内存使用情况
docker exec -it redis-container redis-cli -a your_password info memory
# 查看客户端连接
docker exec -it redis-container redis-cli -a your_password client list
```

### 10.2 备份数据

```
# 手动触发 RDB 快照
docker exec -it redis-container redis-cli -a your_password bgsave
# 复制 AOF 文件
docker cp redis-container:/data/appendonly.aof ./backup/
```

## 11. 简单命令

```
docker run -d --name redis -p 6379:6379 -v redis-data:/data redis:8.2.1 redis-server --requirepass 123456
```
