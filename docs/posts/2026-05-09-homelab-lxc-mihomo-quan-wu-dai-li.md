---
title: '家庭实验室 #2 ｜ LXC 容器跑全屋代理 (Mihomo) — 让所有 VM 一键科学上网'
date: 2026-05-09
slug: 'homelab-lxc-mihomo-quan-wu-dai-li'
categories:
  - '家庭实验室'
tags:
  - 'LXC'
  - 'Proxmox'
  - 'Mihomo'
  - 'Clash'
  - '代理'
  - 'homelab'
description: '「家庭实验室从零到一」系列第 2 篇。用一个 LXC 容器搭一个 7×24 的代理网关，所有 VM 通过 http_proxy=http://<容器 IP>:7890 科学上网。覆盖代理客户端横评（Mihomo / sing-box / Xray / naïveproxy）、为什么用 LXC 而不是 Docker、TUN 设备启用、Debian 13 容器初始化、Mihomo 安装与 systemd 服务、订阅拉取（UA + flag 的坑）、Geo 数据预下载、Web Dashboard、订阅自动更新（自动回打补丁 + mihomo -t 校验）、其他 VM/Docker/apt 接入方式，及 fake-ip 解决 DNS 污染等 8 个真实踩坑。'
series: '家庭实验室从零到一'
seriesIndex: 2
---

# 家庭实验室 #2 ｜ LXC 容器跑全屋代理 (Mihomo) — 让所有 VM 一键科学上网

> 系列第 2 篇 ▏前置：[#0 导览](/posts/2026-05-09-homelab-overview-jia-ting-shi-yan-shi-jia-gou) + [#1 PVE 装机](/posts/2026-05-09-homelab-pve-zhuang-ji-pian)。本篇用一个 LXC 容器搭一个 7×24 的代理网关，所有 VM 通过 `http_proxy=http://<容器 IP>:7890` 就能科学上网。

> 📝 **2026-09-16 修订**：按我实际落地时容器里的 shell history 重新校对了第三、四、五章。主要变化：Debian 13 换源方式（deb822）、二进制放 `/usr/local/bin` + 配置放 `/etc/mihomo`、订阅要带 UA 和 flag 才能拿到 Clash YAML、Geo 数据要预先下载、订阅自动更新脚本要自动回打补丁。踩坑时间线也从 5 个补到 8 个。

## 卷首：为什么需要全屋代理？

家庭实验室必然遇到的几个场景：

- 后端 Maven 拉国外包（Apache、Spring）
- 前端 npm install 几百个 npm 包
- Docker pull 镜像（docker.io）
- AI 工具调 OpenAI / Anthropic API
- Git clone GitHub 大仓库

这些**没有稳定代理基本不能动**。

第一次我在每个 VM 里**单独装代理客户端**，结果：

- 每装一个 VM 就重复一次配置工作
- 订阅链接更新要在 N 个地方同步
- 不同 VM 用不同节点，IP 风控乱七八糟
- VM 重启代理客户端没自启
- 配错防火墙某个 VM 直连泄露 IP

**正确思路**：搞一个**集中代理服务**，所有 VM 通过环境变量指过去。维护成本降到 1 个点。

---

## 一、选型对比（代理客户端横评）

我跑过的客户端：

| 工具 | 协议支持 | UI | 资源占用 | 国内项目活跃度 | 一句话评价 |
|---|---|---|---|---|---|
| **Mihomo (clash.meta)** | 全协议 | API + Dashboard | 低 | ⭐⭐⭐⭐⭐ | 老牌 Clash 内核分支，**首选** |
| Clash Premium | 全协议 | 无 | 低 | ❌ 已停更 | RIP，别用 |
| sing-box | 全协议 | 无内建 UI | 中 | ⭐⭐⭐⭐ | 新锐，配置复杂 |
| v2ray-core | 部分 | 无内建 UI | 中 | ⭐⭐⭐ | 老牌，但配置繁 |
| Xray | 全协议 | 无内建 UI | 中 | ⭐⭐⭐⭐ | v2ray 分支，性能好 |
| naïveproxy | HTTPS only | 无 | 低 | ⭐⭐ | 抗审查强，协议单一 |

**我的选择：Mihomo** 原因：

1. **配置文件兼容 Clash** —— 大多数订阅服务直接给 clash 配置，零改造
2. **TUN 模式** —— 网络层透明代理，连 ICMP/UDP 也能走代理
3. **API 完整** —— 有 RESTful API 控制（重启、切换节点、看流量）
4. **生态成熟** —— Web Dashboard（YACD/MetaCubeX）、安卓客户端（ClashMetaForAndroid）等都基于它的 API

**唯一缺点**：Clash 协议被国内某些云服务商重点关照。如果你重度依赖某些"高敏"协议，可考虑 sing-box。

---

## 二、为什么用 LXC 容器，不用 Docker 也不用 VM？

| 方案 | 优 | 劣 |
|---|---|---|
| **LXC 容器** ⭐ | 启动秒级；资源占用 50MB；TUN 模式原生支持 | 需要 PVE 环境 |
| Docker 容器 | 跨平台；镜像生态 | TUN 模式要 `--privileged` 加 cap_add；网络 NAT 一层；持久化要挂 volume |
| 独立 VM | 完全隔离 | 启动 30 秒+；占内存 1GB+；overkill |
| 直接装 PVE Host | 极简 | **污染 hypervisor**，违反单一职责 |

**我的选择：LXC**。

资源画像：内存 50MB / CPU 闲时 0% / 启动 2 秒，跟"零成本"差不多。

---

## 三、创建 LXC 容器

### 3.1 下载 Debian 模板

PVE Web UI：

```
节点 pve → local 存储 → CT Templates → Templates
搜索: debian
下载: debian-13-standard 模板（最新稳定）
```

或 CLI：

```bash
# 列出所有可下载模板
pveam available | grep debian

# 下载 Debian 13 模板
pveam download local debian-13-standard_13.0-1_amd64.tar.zst
```

### 3.2 创建 LXC 容器

Web UI: 节点 pve → Create CT。

| 字段 | 我的设置 | 说明 |
|---|---|---|
| **Node** | pve | 默认 |
| **CT ID** | 120 | 我把代理类放 120-129 |
| **Hostname** | lxc-proxy | 一眼能看出用途 |
| **Password** | 强密码 | root 密码 |
| **SSH key** | 你的公钥（推荐） | 免密登录 |
| **Template** | debian-13-standard | 上一步下的 |
| **Unprivileged** | ☑（默认） | 非特权容器，安全；TUN 见 3.3 |
| **Disk** | 4 GB（local-lvm） | 4G 完全够 |
| **CPU** | 1 核 | 代理不吃 CPU |
| **Memory** | 256 MB | 余量足 |
| **Swap** | 0 | 容器不用 swap |
| **Network** | vmbr0 | 默认桥接 |
| **IPv4** | static `192.168.X.12/24`，gateway `192.168.X.1` | 固定 IP 重要 |
| **DNS** | 留空（继承宿主） | 或填公共 DNS |
| **Features** | ☑ Nesting | 后续装 docker 用得上 |

> 📌 **重要**：网络一定**给固定 IP**，否则 DHCP 续约 IP 变了，所有 VM 都连不上代理。

### 3.3 创建后的关键设置：允许 TUN 设备

LXC 默认**不能用 /dev/net/tun**。需要手动加配置：

```bash
# 在 PVE Host 上
vim /etc/pve/lxc/120.conf

# 末尾加上
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net dev/net none bind,create=dir
```

第二行是把宿主机的 `/dev/net` 整个 bind 进容器，所以**容器里不需要也不能** `mknod`（非特权容器没这个权限）。改完重启容器：

```bash
pct stop 120 && pct start 120
```

**验证**：

```bash
pct exec 120 -- ls -la /dev/net/tun
# 非特权容器期望: crw-rw-rw- 1 nobody nobody 10, 200 ... /dev/net/tun
# 特权容器期望:   crw-rw-rw- 1 root   root   10, 200 ... /dev/net/tun
```

> 非特权容器里显示 `nobody nobody` 是正常的（宿主 root 经过 uid 映射后在容器里没对应用户），权限是 `rw-rw-rw-`，mihomo 用起来没问题。

---

## 四、容器内安装 Mihomo

目录约定（后面所有命令都按这个来）：

| 东西 | 位置 |
|---|---|
| 二进制 | `/usr/local/bin/mihomo` |
| 配置、Geo 数据、UI、secret | `/etc/mihomo/` |
| systemd 服务 | `/etc/systemd/system/mihomo.service` |

### 4.1 进容器

```bash
pct enter 120
# 进入后是 root@lxc-proxy
```

### 4.2 容器初始化（换源 / locale / 时区 / 工具）

Debian 13 的 apt 源已经不在 `/etc/apt/sources.list`，而是 deb822 格式的 `/etc/apt/sources.list.d/debian.sources`。直接 sed 把域名换掉最省事，不要再新建 sources.list（会和 debian.sources 重复）：

```bash
# 1. 切清华源
sed -i 's|http://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' \
  /etc/apt/sources.list.d/debian.sources

# 2. 配置 locale（模板默认没生成，各种 perl warning 很烦）
sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen
sed -i 's/^# *zh_CN.UTF-8 UTF-8/zh_CN.UTF-8 UTF-8/' /etc/locale.gen
locale-gen
update-locale LANG=en_US.UTF-8
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# 3. 时区（看日志时间不用换算）
timedatectl set-timezone Asia/Shanghai

# 4. 升级 + 装工具
apt update && apt -y upgrade
apt install -y curl ca-certificates wget vim htop iptables iproute2 unzip

# 5. 验证 TUN 设备（3.3 配的）
ls -la /dev/net/tun
# 期望：crw-rw-rw- 1 nobody nobody 10, 200 ...

# 6. 装 Mihomo 之前先确认国内可达
ping -c 2 223.5.5.5
ping -c 2 mirrors.tuna.tsinghua.edu.cn
```

### 4.3 下载 Mihomo 二进制

不要手写版本号，直接问 GitHub API 要最新 tag；下载走 GitHub 加速镜像（**没代理装不上代理**的鸡生蛋问题）：

```bash
cd /tmp

# 取最新版本号（api.github.com 国内一般能通，不通就手动去 Releases 页看）
MIHOMO_VERSION=$(curl -s https://api.github.com/repos/MetaCubeX/mihomo/releases/latest \
  | grep tag_name | cut -d'"' -f4)
echo "Mihomo 最新版本: $MIHOMO_VERSION"

# 通过 ghfast 加速下载（amd64）
wget "https://ghfast.top/https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/mihomo-linux-amd64-${MIHOMO_VERSION}.gz" \
  -O mihomo.gz

# ghfast 失效就换别的加速前缀，例如：
# wget "https://ghproxy.com/https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/mihomo-linux-amd64-${MIHOMO_VERSION}.gz" -O mihomo.gz

# 解压 + 安装
gunzip mihomo.gz
chmod +x mihomo
mv mihomo /usr/local/bin/mihomo

# 验证
/usr/local/bin/mihomo -v
```

> 镜像站偶尔会报证书错误。先确认 `ca-certificates` 装了、时间对了（4.2 的时区那步），别一上来就 `--no-check-certificate`。

镜像都不行的兜底：在能访问 GitHub 的电脑上下好，`pct push 120 mihomo.gz /tmp/mihomo.gz` 推进容器。

⚠️ **PATH 坑**：`pct enter` 进来的 shell，`PATH` 里**没有 `/usr/local/bin`**，直接敲 `mihomo -v` 会 command not found。修一下：

```bash
echo $PATH
# 大概率是 /usr/sbin:/usr/bin:/sbin:/bin，缺 /usr/local/bin

# 临时修复 + 永久写到 .bashrc
export PATH="/usr/local/sbin:/usr/local/bin:$PATH"
echo 'export PATH="/usr/local/sbin:/usr/local/bin:$PATH"' >> /root/.bashrc
hash -r

mihomo -v
which mihomo
# 期望：/usr/local/bin/mihomo
```

后面的 systemd 服务和 cron 脚本里统一写**绝对路径** `/usr/local/bin/mihomo`，不依赖 PATH。

### 4.4 拉订阅生成配置文件

Mihomo 主配置文件 `/etc/mihomo/config.yaml`。**99% 的用户从订阅链接获取**，但有个大坑：

> ⚠️ 机场后端（SSPanel / V2board 一类）是**按 User-Agent 判断返回什么格式**的。用默认的 `curl/8.x` UA 去拉，很多机场会给你一坨 base64 的 v2ray 链接，或者一个 HTML 页面，Mihomo 根本不认。要么 UA 伪装成 Clash 客户端，要么带 `flag=clash.meta` 参数，最好两个都带。

```bash
mkdir -p /etc/mihomo
SUB_URL='<YOUR_SUBSCRIPTION_URL>'

# 两种拉法都试一下，看哪个给的是 YAML
curl -L -A "ClashMeta" "${SUB_URL}?flag=clash.meta" -o /tmp/config-meta.yaml
curl -L -A "ClashforWindows/0.20.39" "${SUB_URL}?flag=clash" -o /tmp/config-clash.yaml

file /tmp/config-meta.yaml /tmp/config-clash.yaml
head -10 /tmp/config-meta.yaml
ls -lh /tmp/config-*.yaml
# 期望：file 说是 text / Unicode text，head 能看到 port: / mixed-port: / proxies: 这种 YAML 字段
# 拿到一行 base64 或 <!DOCTYPE html> 的就是错的
```

一般 `clash.meta` 那份能用（Mihomo 特有的协议如 vless / hysteria2 只在这份里）。确定后落盘 + 备份原版：

```bash
# 1. 用 meta 版作为正式配置
cp /tmp/config-meta.yaml /etc/mihomo/config.yaml

# 2. 备份订阅原文（对比机场改了啥、或者回滚用）
cp /tmp/config-meta.yaml /etc/mihomo/config.yaml.original
```

订阅给的配置默认只监听本机，API 也没密码，要改三处。**别手动 vim**，用 sed 改，后面第五章的自动更新脚本要复用这几行：

```bash
# 3. 生成一个强 secret，并存一份（后面 Dashboard、API、更新脚本都要用）
SECRET=$(openssl rand -hex 16)
echo "Web UI secret 是: $SECRET"
echo "$SECRET" > /etc/mihomo/secret.txt
chmod 600 /etc/mihomo/secret.txt

# 4. allow-lan 开、API 监听全网卡
sed -i "s/^allow-lan: false/allow-lan: true/" /etc/mihomo/config.yaml
sed -i "s|^external-controller:.*|external-controller: '0.0.0.0:9090'|" /etc/mihomo/config.yaml

# 5. secret 字段有就改，没有就插在 external-controller 后面
if grep -q "^secret:" /etc/mihomo/config.yaml; then
  sed -i "s|^secret:.*|secret: '$SECRET'|" /etc/mihomo/config.yaml
else
  sed -i "/^external-controller:/a secret: '$SECRET'" /etc/mihomo/config.yaml
fi

# 6. 验证修改结果
grep -E "^(port|mixed-port|allow-lan|bind-address|mode|log-level|external-controller|secret|external-ui):" \
  /etc/mihomo/config.yaml
```

改完关键字段应该长这样（值以你订阅为准）：

```yaml
mixed-port: 7890                      # HTTP/SOCKS 同端口（VM 都用这个）
allow-lan: true                       # ⭐ 让局域网设备能用，必须开
bind-address: '*'
mode: rule                            # rule / global / direct
log-level: info
external-controller: '0.0.0.0:9090'   # API 监听
secret: '<RANDOM_LONG_STRING>'        # API 密码
```

顺手看一眼订阅有没有引用外部资源，这些启动时要从外网拉：

```bash
# geodata 相关字段
grep -E "(geodata|geox-url|geoip|geosite)" /etc/mihomo/config.yaml | head -20

# rule-providers / proxy-providers（会从外部 URL 拉规则）
grep -E "^(rule-providers|proxy-providers):" /etc/mihomo/config.yaml
grep -A 5 "url:" /etc/mihomo/config.yaml | head -30
```

### 4.5 预下载 Geo 数据

只要规则里出现 `GEOIP,CN` / `GEOSITE,xxx`（几乎所有订阅都有），Mihomo 首次启动会去 GitHub 拉 `geoip.dat` / `geosite.dat` / `Country.mmdb`。此时代理还没起来，**要么卡很久要么直接起不来**。先手动用镜像下好：

```bash
cd /etc/mihomo

# 三个文件，用 ghfast 加速
wget -O geoip.dat   "https://ghfast.top/https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat"
wget -O geosite.dat "https://ghfast.top/https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat"
wget -O Country.mmdb "https://ghfast.top/https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb"

# 验证
ls -lh /etc/mihomo/{geoip.dat,geosite.dat,Country.mmdb}
# 期望：geoip.dat 几 MB，geosite.dat 十几 MB，Country.mmdb 几 MB
```

> 文件名要精确：`Country.mmdb` 是大写 C，而 release 里叫 `country.mmdb`，所以 `-O` 时改了名。

### 4.6 创建 systemd 服务

```bash
cat > /etc/systemd/system/mihomo.service <<'EOF'
[Unit]
Description=Mihomo Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
Restart=on-failure
RestartSec=5
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mihomo
systemctl start mihomo
sleep 3
systemctl status mihomo --no-pager
journalctl -u mihomo -n 50 --no-pager
```

几个点：

- `After=network-online.target`：容器重启时等网络真起来再启动，不然订阅里的域名解析失败会重试半天
- `AmbientCapabilities`：TUN 模式和 53 端口 DNS 需要的 cap，提前给上，后面开 TUN 不用回来改
- `ExecStart` 用绝对路径，避开 PATH 坑

### 4.7 验证代理通不通

```bash
# 端口起来没
ss -tlnp | grep -E "7890|9090"

# 走代理
echo "===== 走代理 ====="
curl -x http://127.0.0.1:7890 -m 10 -s -o /dev/null -w "Google:  %{http_code}\n" https://www.google.com
curl -x http://127.0.0.1:7890 -m 10 -s -o /dev/null -w "GitHub:  %{http_code}\n" https://github.com
curl -x http://127.0.0.1:7890 -m 10 -s -o /dev/null -w "YouTube: %{http_code}\n" https://www.youtube.com

# 直连对比
echo "===== 不走代理 ====="
curl -m 5 -s -o /dev/null -w "Google direct: %{http_code}\n" https://www.google.com
```

期望：走代理三个都 200，直连 Google 是 `000`（超时）。都是 000 就回去看 `journalctl -u mihomo`，大概率是节点选择组还没选到可用节点，或者订阅本身挂了。

### 4.8 装 Web Dashboard（metacubexd）

可视化看流量、切换节点。这里用 metacubexd 官方编译好的 release 包，省得本地装 npm 现编译。

#### Step 1：下载 metacubexd UI

代理已经通了，这一步直接走自己的代理拉 GitHub，不用镜像：

```bash
cd /etc/mihomo

# 走自身代理拉（前提：4.7 验证通过）
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890

curl -L -o /tmp/ui.tgz \
  https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz

# 检查下载成功（~2-3MB）
ls -lh /tmp/ui.tgz

# 解压
mkdir -p /etc/mihomo/ui
tar -xzf /tmp/ui.tgz -C /etc/mihomo/ui
rm /tmp/ui.tgz

# 验证
ls /etc/mihomo/ui/index.html

# 用完记得取消，不然后面 apt 也走代理
unset http_proxy https_proxy
```

#### Step 2：在 config.yaml 加一行 external-ui

```bash
# 备份
cp /etc/mihomo/config.yaml /etc/mihomo/config.yaml.bak.$(date +%F)

# 看 external-ui 现在在不在
grep -n "external-ui" /etc/mihomo/config.yaml

# 不在的话，在 secret 行后面插 external-ui
sed -i "/^secret:/a external-ui: /etc/mihomo/ui" /etc/mihomo/config.yaml

# 验证
grep -A1 "^secret:" /etc/mihomo/config.yaml
# 期望看到：
# secret: '<RANDOM_LONG_STRING>'
# external-ui: /etc/mihomo/ui
```

#### Step 3：开 CORS 允许局域网浏览器访问 API

```bash
# 在 external-ui 行后再插 CORS 配置
sed -i "/^external-ui:/a external-controller-cors:\n    allow-origins:\n        - '*'\n    allow-private-network: true" /etc/mihomo/config.yaml

# 验证
grep -A4 "^external-ui:" /etc/mihomo/config.yaml
```

#### Step 4：重启 + 验证

```bash
systemctl restart mihomo
sleep 2
systemctl status mihomo --no-pager | head -10

# 看启动日志有没有起 UI
journalctl -u mihomo -n 30 --no-pager | grep -iE 'external|ui|api|listening'

# 期望看到：
# RESTful API listening at: [::]:9090
# External UI: serving at /ui
```

LXC 内部连通性测一下：

```bash
curl -s http://127.0.0.1:9090/ui/index.html | head -3
# 期望：看到 <!DOCTYPE html>... 之类的页面内容

# 测 API（secret 从 4.4 存的文件里读）
curl -s -H "Authorization: Bearer $(cat /etc/mihomo/secret.txt)" \
  http://127.0.0.1:9090/version
# 期望：{"version":"...","meta":true}
```

#### Step 5：浏览器登录

笔记本浏览器（与 LXC 容器同网段）打开：

```
http://192.168.X.12:9090/ui/
```

填：

```
API Base URL:  http://192.168.X.12:9090
Secret:        <你 /etc/mihomo/secret.txt 里的值>
```

→ Add → 进 dashboard。节点切换、延迟测试、实时流量、规则查看全有。

---

## 五、订阅自动更新

订阅服务的节点会变（有些一周更新一次）。写个 cron 自动拉。但注意，**订阅原文里没有你在 4.4 / 4.8 改的那些东西**（allow-lan、external-controller、secret、external-ui、CORS）。直接 `curl -o config.yaml` 覆盖，等于把补丁全冲掉，重启后局域网连不上、Dashboard 也没了——我换机场重新拉订阅时就撞过一次。

所以脚本要做四件事：**带 UA/flag 拉 → 粗校验 → 自动回打补丁 → 用 `mihomo -t` 校验后再替换**。

```bash
cat > /etc/mihomo/update-sub.sh <<'EOF'
#!/bin/bash
# 订阅自动更新：拉取 → 校验 → 回打补丁 → mihomo -t → 替换 → 重启
set -u
SUB_URL='<YOUR_SUBSCRIPTION_URL>'
DIR=/etc/mihomo
TARGET=$DIR/config.yaml
TMP=$(mktemp /tmp/mihomo-config.XXXXXX)
SECRET=$(cat "$DIR/secret.txt")
MIHOMO=/usr/local/bin/mihomo     # cron 的 PATH 没有 /usr/local/bin，写死

fail() { echo "[$(date)] Update FAILED: $1"; rm -f "$TMP"; exit 1; }

# 1. 拉订阅：UA + flag 缺一不可
curl -fsSL --connect-timeout 10 -m 60 -A "ClashMeta" \
  "${SUB_URL}?flag=clash.meta" -o "$TMP" || fail "download error"

# 2. 粗校验：大小 > 10KB 且看着像 Clash YAML（防 502 页面 / base64 写进去）
[ "$(stat -c %s "$TMP")" -gt 10240 ] || fail "file too small"
grep -q "^proxies:" "$TMP" || fail "not a clash yaml"

# 3. 回打补丁（有就改，没有就追加）
sed -i -e '$a\' "$TMP"   # 保证文件末尾有换行，后面 echo >> 才安全
set_kv() {
  if grep -q "^$1:" "$TMP"; then
    sed -i "s|^$1:.*|$1: $2|" "$TMP"
  else
    echo "$1: $2" >> "$TMP"
  fi
}
set_kv allow-lan true
set_kv external-controller "'0.0.0.0:9090'"
set_kv secret "'$SECRET'"
set_kv external-ui /etc/mihomo/ui
grep -q "^external-controller-cors:" "$TMP" || cat >> "$TMP" <<CORS
external-controller-cors:
  allow-origins:
    - '*'
  allow-private-network: true
CORS

# 4. 让 mihomo 自己校验一遍配置，语法错 / 节点格式不认都会在这里拦住
"$MIHOMO" -t -d "$DIR" -f "$TMP" >/dev/null 2>&1 || fail "mihomo -t rejected config"

# 5. 替换 + 重启
cp "$TARGET" "${TARGET}.bak"
cp "$TMP" "$TARGET" && rm -f "$TMP"
systemctl restart mihomo
echo "[$(date)] Update OK"
EOF

chmod +x /etc/mihomo/update-sub.sh

# 先手动跑一次，确认 OK
/etc/mihomo/update-sub.sh

# 加 cron：每天凌晨 4 点更新
crontab -e
# 添加：
# 0 4 * * * /etc/mihomo/update-sub.sh >> /var/log/mihomo-update.log 2>&1
```

> 想彻底摆脱"订阅覆盖配置"这个问题，更干净的做法是 config.yaml 完全自己写，订阅只作为 `proxy-providers` 引用进来，Mihomo 会按 `interval` 自己刷新节点。代价是 rules / proxy-groups 要自己维护，适合折腾到第二阶段再上。

---

## 六、其他 VM/容器接入这个代理

### 6.1 临时使用（环境变量）

```bash
# 在任何需要联网的命令前
export http_proxy=http://192.168.X.12:7890
export https_proxy=http://192.168.X.12:7890
export no_proxy=localhost,127.0.0.1,192.168.X.0/24

# 测试
curl -s https://www.google.com -o /dev/null -w "%{http_code}\n"
# 期望: 200 (代理通)
```

### 6.2 永久使用（系统级）

```bash
# /etc/profile.d/proxy.sh
cat > /etc/profile.d/proxy.sh <<'EOF'
export http_proxy=http://192.168.X.12:7890
export https_proxy=http://192.168.X.12:7890
export HTTP_PROXY=http://192.168.X.12:7890
export HTTPS_PROXY=http://192.168.X.12:7890
export no_proxy=localhost,127.0.0.1,192.168.X.0/24,10.0.0.0/8,172.16.0.0/12
export NO_PROXY="$no_proxy"
EOF

# 立即生效
source /etc/profile.d/proxy.sh
```

### 6.3 Docker daemon 走代理

```bash
mkdir -p /etc/systemd/system/docker.service.d

cat > /etc/systemd/system/docker.service.d/http-proxy.conf <<'EOF'
[Service]
Environment="HTTP_PROXY=http://192.168.X.12:7890"
Environment="HTTPS_PROXY=http://192.168.X.12:7890"
Environment="NO_PROXY=localhost,127.0.0.1,192.168.X.0/24"
EOF

systemctl daemon-reload
systemctl restart docker
```

### 6.4 apt 走代理（Debian/Ubuntu）

```bash
cat > /etc/apt/apt.conf.d/95proxy <<'EOF'
Acquire::http::Proxy "http://192.168.X.12:7890";
Acquire::https::Proxy "http://192.168.X.12:7890";
EOF
```

> ⚠️ 一般国内 apt 走清华镜像够快，**不建议给 apt 走代理**（会反而变慢）。给具体软件单独配。

---

## 七、踩坑时间线

### 坑 1：Day 1 - LXC 不能用 TUN

**症状**：mihomo 启动报 `failed to create tun device: permission denied`。

**原因**：LXC 默认禁止访问 /dev/net/tun。

**解决**：本文 3.3 章节的 lxc.conf 修改（bind 宿主 `/dev/net`），非特权容器别想着 mknod。

---

### 坑 2：Day 1 - 装完 mihomo 敲不出来：command not found

**症状**：`mv mihomo /usr/local/bin/` 之后 `mihomo -v` 报 command not found，但 `/usr/local/bin/mihomo -v` 正常。

**原因**：`pct enter` 进来的 shell 不是 login shell，PATH 只有 `/usr/sbin:/usr/bin:/sbin:/bin`，没有 `/usr/local/bin`。一开始还以为是 bash 缓存，`hash -r` 了两遍才发现是 PATH。

**解决**：本文 4.3 的 PATH 修复；systemd 和 cron 里一律写绝对路径。

---

### 坑 3：Day 1 - 订阅拉下来不是 YAML

**症状**：`curl -fsSL "$SUB_URL" -o config.yaml`，mihomo 启动直接报 yaml 解析错误，`cat` 一看是一坨 base64。

**原因**：机场按 User-Agent 分发格式，默认 curl UA 拿到的是通用订阅（v2ray 链接 base64）。

**解决**：本文 4.4，`-A "ClashMeta"` 加 `?flag=clash.meta`。

---

### 坑 4：Day 2 - 局域网其他设备连不上 7890

**症状**：在 lxc-proxy 容器内 `curl localhost:7890` 通，但其他 VM `curl 192.168.X.12:7890` 拒绝。

**原因**：mihomo 配置 `bind-address: 127.0.0.1` 或 `allow-lan: false`。

**解决**：

```yaml
# config.yaml 顶部
bind-address: '*'
allow-lan: true
```

---

### 坑 5：Day 3 - 重启 LXC 后 mihomo 没起来

**症状**：`pct stop 120 && pct start 120` 后，mihomo 服务挂了。

**原因**：systemd 服务没设 `enable`。

**解决**：`systemctl enable mihomo`。

---

### 坑 6：Day 5 - 订阅自动更新挂了，半天没人发现

**症状**：订阅服务商挂了几小时，cron 拉到空文件覆盖了原 config.yaml，全屋代理瘫痪。

**解决**：本文 5 章节的"文件大小校验 + `mihomo -t`"。

---

### 坑 7：Day 7 - DNS 污染走代理也没用

**症状**：访问某些被污染的域名，**走代理也是 connection refused**。

**原因**：本机 DNS 解析在代理之前发生，污染的 IP 已经返回。

**解决**：mihomo 配置启用 fake-ip：

```yaml
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 223.5.5.5
    - 119.29.29.29
  fallback:
    - 8.8.8.8
    - 1.1.1.1
  fallback-filter:
    geoip: true
    geoip-code: CN
```

---

### 坑 8：换机场 - 重新拉订阅，Dashboard 和局域网访问全没了

**症状**：换了个机场，`rm config.yaml` 重新 `curl` 订阅，重启后 VM 连不上 7890，`:9090/ui` 也 404。

**原因**：订阅原文没有 allow-lan / external-controller / secret / external-ui / CORS 这些手改项，重新拉等于全部重置。手动 sed 一遍是能救回来，但每次换订阅都要记得这一套太反人类。

**解决**：本文 5 章节的更新脚本会自动回打补丁；换机场时也直接改脚本里的 `SUB_URL` 然后跑一次脚本，不要手动 curl。

---

## 八、个人反思

### 反思 1：代理客户端的归宿是"消失"

折腾这么多，真正用得最爽的状态是：**忘了它存在**。

每个 VM 系统级配好 http_proxy → 永久绑定 → 之后**所有命令都自动走代理**——这才是终极目标。

如果你还在每次手动 `export http_proxy=...`，说明配置没做到位。

---

### 反思 2：不要在主路由器装代理

我一开始把 mihomo 装在 OpenWrt 主路由器，全屋透明代理。**问题**：

- 路由器挂了 / 重启 / 升级，**全家人断网**（老婆不能刷视频，小孩不能玩游戏）
- 调试代理时家人投诉
- 路由器存储有限，订阅文件、Geo 数据库放不下

**改成 LXC 容器后**：

- 全屋设备**默认不走代理**
- 只有 VM 通过环境变量主动走
- 路由器纯净，老婆不再来质问

---

### 反思 3：订阅服务是单点故障

依赖订阅服务，**对方挂了你也挂**。

我的应对：

- 自建 1 个轻量级国外节点（搬瓦工 / 甲骨文免费机），做 fallback
- mihomo 配置里把自建节点放规则前面
- 订阅服务挂时，自建节点接管

**订阅 + 自建节点双活**，挂一个不影响。

---

### 反思 4：把 history 当第一手资料

这篇文章第一版是凭记忆写的，四个月后回头对着容器里的 `history` 一条条核，发现记忆里"顺手就装好了"的地方，实际卡了 PATH、订阅格式、Geo 下载三次。教训：**装完当天就 `history > ~/setup-$(date +%F).log` 存一份**，写文章、重装、排障都靠它。

---

## 九、与其他方案的横向对比

### vs OpenWrt 透明代理
- OpenWrt 上整屋代理强大但**风险大**（影响全家人）
- LXC 方案**作用域小**（只覆盖 VM），可控

### vs 每个 VM 装 sing-box
- 维护成本 N 倍
- 订阅链接同步噩梦
- 中心化代理是更优雅的方案

### vs Docker 跑 mihomo
- Docker 也行，但 LXC 在 PVE 上更"原生"
- LXC 启动更快，资源更省
- TUN 模式 LXC 配起来更简单

### vs 公司 VPN
- 公司 VPN 给员工提供，但全屋设备用就违规
- 私人代理 + 公司 VPN 共存最佳

---

## 十、下一步

代理装好后，所有 VM/容器都能科学上网了。下一步建议：

1. 装 Tailscale Subnet Router（异地访问家里）
2. 然后建 NAS VM
3. 最后建 Dev-Server VM

下一篇：**[#3 LXC: Tailscale Subnet Router](/posts/2026-05-09-homelab-lxc-tailscale-yi-di-fang-wen)**

---

## 附录：常用命令速查

```bash
# 进入容器
pct enter 120

# 容器内 mihomo 控制
systemctl start/stop/restart/status mihomo
journalctl -u mihomo -f --no-pager

# 改完配置先校验再重启
/usr/local/bin/mihomo -t -d /etc/mihomo

# 查 secret
cat /etc/mihomo/secret.txt

# 手动触发订阅更新
/etc/mihomo/update-sub.sh

# 看代理状态
curl -s -H "Authorization: Bearer <SECRET>" http://192.168.X.12:9090/proxies | jq

# 切换节点（API）
curl -X PUT http://192.168.X.12:9090/proxies/<GROUP_NAME> \
     -H "Authorization: Bearer <SECRET>" \
     -d '{"name":"<NODE_NAME>"}'

# 测试当前出口 IP
curl -x http://192.168.X.12:7890 https://api.ipify.org

# 容器外操作
pct stop 120
pct start 120
pct exec 120 -- systemctl status mihomo
pct push 120 ./mihomo.gz /tmp/mihomo.gz   # 从 PVE 推文件进容器
```

---

> **本文协议**：CC BY-NC-SA 4.0，转载请保留出处
