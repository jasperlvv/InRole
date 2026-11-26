# 服务器买到后操作手册（经济版）

适用：阿里云轻量应用服务器 · 中国香港 · Ubuntu 24.04 · 2核2G 或 2核4G · 无视频（图文+投票）。
目标：从零到 `https://inrole.net/live` 可以注册、发帖、传图。

预计耗时 60–90 分钟，其中镜像构建 10–25 分钟。红字是必须停下来的检查点。

复制命令时只复制代码块里的内容，不要带上提示符。

---

## 第 1 步：登录并确认机器

```bash
ssh root@你的公网IP
```

```bash
cat /etc/os-release | head -2     # 必须是 Ubuntu 24.04
free -h                            # 看内存和磁盘
df -h /
nproc
```

**检查点**：内存是 2G 或 4G、系统盘 ≥40G、架构 x86_64。

设置时区并装基础工具：

```bash
timedatectl set-timezone Asia/Shanghai
apt-get update
apt-get install -y ca-certificates curl git openssl nano
```

## 第 2 步：加 4G swap（2G 内存必做）

`next build` 在 2G 内存上不加 swap 会被系统杀掉（exit 137）。

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

```bash
free -h     # Swap 那一行应该是 4.0Gi
```

## 第 3 步：安装 Docker

```bash
install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg --output /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc
printf '%s\n' 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

```bash
docker run --rm hello-world     # 看到 "Hello from Docker!" 即成功
docker compose version
```

## 第 4 步：拉代码

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/jasperlvv/InRole.git
cd /opt/InRole
git log -1 --oneline
```

**检查点**：记下这行提交号，后面 `INROLE_IMAGE` 要用。当前是 `5fae734`。

## 第 5 步：生成正式配置

```bash
cd /opt/InRole/deploy
cp .env.example .env
chmod 600 .env
```

生成 6 个随机密码（URL 安全字符，逐条粘贴进 `.env`）：

```bash
for n in BOOTSTRAP_DB_PASSWORD MIGRATOR_DB_PASSWORD APP_DB_PASSWORD SESSION_PASSWORD RATE_LIMIT_SECRET RECOVERY_CODE_PEPPER; do
  echo "$n=$(openssl rand -base64 32 | tr -d '\n=+' | tr '/+' '_-')"
done
```

```bash
nano .env
```

填成下面这样（`INROLE_IMAGE` 用第 4 步记下的提交号）：

```ini
DOMAIN=inrole.net
INROLE_IMAGE=inrole:5fae734
BOOTSTRAP_DB_PASSWORD=粘贴
MIGRATOR_DB_PASSWORD=粘贴
APP_DB_PASSWORD=粘贴
SESSION_PASSWORD=粘贴
RATE_LIMIT_SECRET=粘贴
RECOVERY_CODE_PEPPER=粘贴
```

**检查点**：

```bash
docker compose config --quiet     # 没有任何输出 = 配置有效
```

有输出说明变量缺失或格式不对，按提示补。**不要** `docker compose config` 不带 `--quiet`，它会把密码打印到屏幕上。

## 第 6 步：构建镜像（最慢的一步）

```bash
cd /opt/InRole
docker build -t inrole:5fae734 .     # 标签要和 .env 里的 INROLE_IMAGE 一致
```

- 2核2G 约 15–25 分钟，2核4G 约 8–15 分钟。
- 期间可以另开一个终端看内存：`free -h`、`docker stats --no-stream`。
- 结尾看到 `naming to docker.io/library/inrole:5fae734 ... done` 即成功。

**如果进程被 Killed / exit 137**：swap 没生效或不够。`free -h` 确认后重试；仍失败见文末「构建内存不足」的替代方案。

## 第 7 步：起数据库并执行迁移

```bash
cd /opt/InRole/deploy
docker compose up -d db
docker compose ps                 # 等 db 的 STATUS 显示 (healthy)
docker compose run --rm migrate
```

**检查点**：结尾出现 `Application grants applied.`，表示 9 份迁移和受限角色权限都已就位。

数据库没变 healthy 时看日志：

```bash
docker compose logs --tail=80 db
```

## 第 8 步：配置 DNS

阿里云控制台 → 云解析 DNS → `inrole.net` → 解析设置 → 添加记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
| --- | --- | --- | --- |
| A | `@` | 服务器公网 IP | 600 |

本机验证（PowerShell）：

```powershell
nslookup inrole.net
```

**检查点**：必须返回服务器 IP。没生效就等 10 分钟再试——**DNS 没通就申请证书一定失败**。

## 第 9 步：启动应用和 HTTPS

```bash
cd /opt/InRole/deploy
docker compose up -d app
docker compose ps                 # app 应为 running / healthy

docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/ready').then(async r=>{console.log(r.status);console.log(await r.text())})"
```

**检查点**：输出 `200` 和 `{"status":"ok"...}` 之类内容。

```bash
docker compose up -d caddy
docker compose logs --tail=60 caddy
```

**检查点**：日志里出现 `certificate obtained successfully`。浏览器打开 `https://inrole.net` 有小锁。

证书失败依次查：DNS 是否生效、云防火墙 80/443 是否放行、`docker compose ps` 里 caddy 是否在跑。

## 第 10 步：建站长账号并导入人物

1. 浏览器打开 `https://inrole.net/live/register`，注册你自己的 ID（3–20 位字母数字下划线），完成喜好引导。
2. 提权：

```bash
cd /opt/InRole/deploy
docker compose run --rm migrate node scripts/db/bootstrap-admin.mjs 你的ID
```

执行后旧会话失效，重新登录，然后能打开 `/live/admin`。

3. 导入 22 位人物、9 个兴趣、8 个话题：

```bash
docker compose run --rm migrate node --experimental-strip-types scripts/db/import-catalog.mjs \
  --pack prisma/catalog.json --apply --confirm-reviewed \
  --reviewed-at 2026-11-26 --reviewed-by 你的名字
```

先看计划就去掉 `--apply --confirm-reviewed ...` 那一段（只读演练）。

**检查点**：结尾 `写入完成：... 人物 +22 ...`，打开 `https://inrole.net/live/people` 能看到人物卡。

## 第 11 步：备份（不买快照的替代方案）

```bash
cat >/usr/local/bin/inrole-backup <<'EOF'
#!/bin/bash
set -e
D=/var/backups/inrole; mkdir -p "$D"; S=$(date +%F)
cd /opt/InRole/deploy
docker compose exec -T db pg_dump -U inrole_bootstrap -d inrole -Fc > "$D/db-$S.dump"
docker run --rm -v inrole_media:/m -v "$D":/b alpine tar czf /b/media-$S.tar.gz -C /m .
find "$D" -type f -mtime +7 -delete
EOF
chmod +x /usr/local/bin/inrole-backup
echo '30 3 * * * root /usr/local/bin/inrole-backup >> /var/log/inrole-backup.log 2>&1' > /etc/cron.d/inrole-backup
/usr/local/bin/inrole-backup
ls -lh /var/backups/inrole
```

每周拉回自己电脑一次（PowerShell）：

```powershell
scp -r root@你的IP:/var/backups/inrole .
```

## 第 12 步：上线验收

- [ ] `https://inrole.net` 打开正常，证书有效
- [ ] 注册 → 选喜好 → 进 `/live`，刷新后登录态还在
- [ ] 发一条文字帖，退出再登录仍能看到
- [ ] 发一条带 1 张图的帖子，详情页图片能显示（验证媒体卷写入）
- [ ] 评分、投币后钱包余额和流水正确
- [ ] `/live/admin` 管理员能打开，普通账号是 403 提示
- [ ] 手机 4G 打开一次，没有横向滚动
- [ ] `reboot` 后等 2 分钟，`docker compose ps` 三个服务自动起来

---

## 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `docker build` 被 Killed / 137 | 内存不足 | `free -h` 确认 swap；见下方替代方案 |
| `docker compose up` 报 `required` | `.env` 缺变量 | 对照第 5 步补齐 |
| Caddy 日志 `no such host` | DNS 未生效 | `nslookup` 确认，等 10 分钟 |
| Caddy 一直 `obtaining certificate` | 80/443 被防火墙挡 | 阿里云控制台放行 |
| 页面 500 `ECONNREFUSED 127.0.0.1:5432` | db 没起 | `docker compose up -d db` |
| 页面 500 `permission denied for schema inrole` | 迁移没跑完 | `docker compose run --rm migrate` |
| 注册报「来源不合法」 | `DOMAIN` 与你访问的域名不一致 | 改 `.env` 后 `docker compose up -d app` |
| 上传图片 404 | 媒体卷权限 | `docker compose restart app`，仍失败看 `logs app` |
| 磁盘满 | 媒体积累 | `df -h`；先清理 `/var/backups`，再考虑加盘 |

### 构建内存不足的替代方案

在 2G 机器上构建失败时，不必急着升配：

1. 本机装 Docker Desktop；
2. 在 `C:\Users\27251\Desktop\666\inrole` 执行 `docker build --platform linux/amd64 -t inrole:5fae734 .`；
3. 导出并传到服务器：

```powershell
docker save inrole:5fae734 -o inrole.tar
scp inrole.tar root@你的IP:/root/
```

```bash
ssh root@你的IP
docker load -i /root/inrole.tar
cd /opt/InRole/deploy && docker compose up -d app
```

4. 注意：以后每次改代码都要重复这一步，所以长期还是建议 2核4G。

## 以后怎么更新代码

```bash
cd /opt/InRole
git pull --ff-only
docker build -t inrole:新提交号 .
cd deploy
sed -i 's/^INROLE_IMAGE=.*/INROLE_IMAGE=inrole:新提交号/' .env
docker compose run --rm migrate
docker compose up -d app
```

只改配置（不动代码）时，改完 `.env` 执行 `docker compose up -d app` 即可。

## 这份手册与长版指南的关系

`docs/InRole零基础上线操作指南.md` 是 31 步的完整版，含买域名、SSH 密钥、加密备份与恢复演练的详细解释。本手册是它的「服务器已买好、砍掉视频、2核2G」精简版，命令一致，跳过了与本机环境无关的章节（如第 15 步临时访问口令、第 23–26 步的 ops 加密备份）。
