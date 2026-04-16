---
title: 'Docker 安装'
date: 2025-08-20
slug: 'wei-ming-ming-wen-zhang'
categories:
  - '容器与运维'
tags:
  - 'Docker'
  - 'WSL'
  - 'Windows'
  - 'Linux'
  - '软件安装'
source: halo
description: '1.1 Linux 一键安装命令 启动docker 1.2 Windows 任务栏搜索"启用或关闭 Windows 功能"，启用"适用于Linux的Windows子系统" + "虚拟机平台" 管理员权限打开命令提示符，安'
---

# **1. 安装**

## **1.1 Linux**

一键安装命令

```
sudo curl -fsSL https://get.docker.com| bash -s docker --mirror Aliyun
```

启动docker

```
sudo service docker start
```

## **1.2 Windows**

任务栏搜索"启用或关闭 Windows 功能"，启用"适用于Linux的Windows子系统" + "虚拟机平台"

管理员权限打开命令提示符，安装wsl2

```
wsl --set-default-version 2
wsl --update --web-download
```

等待wsl安装成功

下载Windows版本安装包

双击安装即可

> 可选: 如果想自己指定安装目录，可以使用命令行的方式 参数 --installation-dir=D:\Docker可以指定安装位置

```
start /w "" "Docker Desktop Installer.exe" install --installation-dir=D:\Docker
```

## **1.3 Mac**

下载Mac系统的安装包

注意区分CPU架构类型 Intel芯片选择x86\_64, 苹果芯片选择arm64  
下载好双击安装即可

# **2. Pull镜像**

### **方案一 转存到阿里云**

使用Github Action将国外的Docker镜像转存到阿里云私有仓库，供国内服务器使用，免费易用

- 支持DockerHub, gcr.io, k8s.io, ghcr.io等任意仓库
- 支持最大40GB的大型镜像
- 使用阿里云的官方线路，速度快

### **方案二 镜像站**

现在只有很少的国内镜像站存活  
不保证镜像齐全,且用且珍惜  
以下三个镜像站背靠较大的开源项目，优先推荐

| **项目名称** | **项目地址** | **加速地址** |
| --- | --- | --- |
| 1Panel | <https://github.com/1Panel-dev/1Panel/> | [https://docker.1panel.live](https://docker.1panel.live/) |
| Daocloud | <https://github.com/DaoCloud/public-image-mirror> | [https://docker.m.daocloud.io](https://docker.m.daocloud.io/) |
| 耗子面板 | <https://github.com/TheTNB/panel> | [https://hub.rat.dev](https://hub.rat.dev/) |

#### **Linux配置镜像站**

```
sudo vi /etc/docker/daemon.json
```

输入下列内容，最后按ESC，输入 :wq! 保存退出。

```
{
    "registry-mirrors": [
        "https://docker.m.daocloud.io",
        "https://docker.1panel.live",
        "https://hub.rat.dev"
    ]
}
```

重启docker

```
sudo service docker restart
```

#### **Windows/Mac配置镜像站**

Setting->Docker Engine->添加上换源的那一段

### **方案三 离线镜像**

使用Github Action下载docker离线镜像 <https://github.com/wukongdaily/DockerTarBuilder>

### **方案四 使用一键脚本**

bash -c "$(curl -sSLf <https://xy.ggbond.org/xy/docker_pull.sh>)" -s 完整镜像名

### **方案五 使用Cloudflare worker 自建镜像加速**

<https://github.com/cmliu/CF-Workers-docker.io>
