# InRole 零基础上线操作指南（阿里云版）

适用对象：第一次购买域名、第一次使用云服务器的学生。目标网址：**https://inrole.net**。

更新日期：2026年11月26日，北京时间。按用户最新计划，本版使用 **阿里云购买 inrole.net + 阿里云轻量应用服务器 + Ubuntu 24.04 LTS、x86_64 + Docker Compose**。域名购买和DNS步骤已改为阿里云，不再沿用旧版Namecheap界面。价格、库存和按钮名称以阿里云当前结算页/控制台为准。

**这是一份执行手册，不代表已经购买、上传或上线。** 域名是否购买成功、服务器是否创建，均以你的账户实际记录为准。本文未在你的正式 Linux 服务器执行；每一步都要以实际成功标志判断，不能一次粘贴整份手册。

## 阅读方法与目录

**先回答：需要服务器。** 域名只提供名字；InRole还需要运行网页程序、PostgreSQL数据库和媒体存储。首版可以把三者放在同一台云服务器上，由现有Docker配置管理。公网IPv4使用服务器套餐提供的地址，先不另购独立云数据库、独立对象存储或额外公网IP。HTTPS由现有Caddy配置申请和续期证书，不需要先购买付费SSL。

**本版的示例路线：** 阿里云注册域名 → 评估并购买一台香港Ubuntu服务器 → 连接服务器 → 安装Docker → 拉取已检查代码 → 生成正式配置 → 建库 → 阿里云DNS指向服务器 → 启动HTTPS → 创建站长和内容 → 验收与备份 → 正式开放。香港是本指南采用的初始部署候选，不能保证大陆和海外的访问质量；若要使用中国内地节点，先处理备案和主体条件，再进入部署。

你可以分三次完成：第一次做第0～7步（准备资源和连接）；第二次做第8～21步（部署和准备内容）；第三次做第22～31步（验收、备份、开放和维护）。不要求一次完成所有步骤。

- 写着 **【网页】**：在浏览器里点击。
- 写着 **【本机 PowerShell】**：在你现在这台 Windows 电脑输入。
- 写着 **【服务器终端】**：连接云服务器后输入。本文服务器部署命令统一在 `sudo -i` 后的 root 会话运行。
- 写着 **【网站】**：打开 InRole 的网页操作。
- 命令框里面才是需要复制的命令；不要复制标题、命令输出或终端前面的 `$`、`#` 提示符。
- 出现“你的服务器IP”“你的SSH用户名”“已确认的提交号”时，先替换成自己的实际值。**`203.0.113.10` 是文档示例IP，不能用来连接。**
- 一步报错，先停在这一步。提供步骤编号、错误文字即可；不要发送密码、私钥、恢复码、`.env` 全文或完整数据库连接串。

目录：

1. 上线前现状与分工
2. 买域名和准备账户
3. 选购服务器
4. 防火墙与连接服务器
5. 安装服务器软件
6. 同步发布代码
7. 生成正式配置与构建
8. 初始化数据库与兴趣分类
9. 域名解析、临时访问口令、启动HTTPS
10. 创建站长账号与进入后台
11. 添加人物、头像、话题和开场帖子
12. 验收、备份与正式开放
13. 后期更新、日常维护、恢复与排错

---

## 第0步：先看清当前项目还差什么

当前已经具备：真实账号、发帖评论、人物、评分、通宝、管理后台、屏蔽注销，以及 Docker、数据库迁移、Caddy 和备份材料。

当前需要在发布前处理：

| 事项 | 当前状态 | 怎么处理 |
| --- | --- | --- |
| 最新人物选择界面、搜索与热搜说明修改 | 已完成并检查，纳入本次GitHub同步 | 第9步按完整提交号核对发布版本 |
| 270位人物 | 已有V2候选清单 | 仍需确认名单、制作简介/头像及来源；名单文件不是可直接导入的数据包 |
| 正式批量导入270位人物 | 导入工具已完成并验证；22位正式目录今天即可导入 | 270位数据包仍需制作，格式见[数据包说明](release/公共目录数据包与导入.md) |
| 本机目录导入脚本 | 限定本机开发库 | 正式库改用 `db:import:catalog`，不修改本机脚本的限制去强行执行 |
| Linux镜像、HTTPS、生产备份恢复 | 尚未实测 | 按本文逐项运行并记录结果 |
| 手机、慢网、大陆/海外访问 | 未完成最终验收 | 第12部分实测，不能用“首页能打开”替代 |
| 生产隐私信息与公开运营条件 | 需要结合实际托管方案确认 | 正式开放前处理，见下一段 |
| 本次项目检查的两项问题 | 已修复并回归（32组社区集成） | 见[P2修复记录](verification/2026-11-26-p2-fixes.md) |

**关于公开社区的一项实际发布条件：** InRole允许用户公开发帖评论。面向中国大陆提供这类服务时，应核对适用的真实身份认证、内容管理、隐私与主体要求；目前项目是ID+密码注册，不能直接宣布已经满足全部要求。《互联网用户账号信息管理规定》第九条对信息发布等账号的真实身份认证作了要求，是否以及如何适用于具体运营方案，应向云厂商及相关主管部门核实。使用香港服务器不等于自动解决这些事项。本指南不会擅自改动你的注册规则；发布方案确认前可以完成带访问口令的部署验收。原文：[网信办规定](https://www.cac.gov.cn/2022-06/26/c_1657868775042841.htm)。

阿里云说明，域名指向中国内地服务器并开通Web服务需ICP备案，香港等非中国内地节点无需同一项ICP备案；其FAQ还提示公安联网备案事项。不要把“香港无需ICP备案”理解成“公开社区没有任何运营要求”。结合实际运营主体、服务对象和公开发帖功能，向阿里云备案客服及适用主管部门确认；个人备案也不能直接照搬展示类网站方案。[阿里云不同场景备案FAQ](https://help.aliyun.com/zh/icp-filing/basic-icp-service/product-overview/faq-about-icp-filing-applications-in-different-scenarios)、[填写网站信息](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/fill-in-website-information)。

**本指南安排的私密验收是你自己的发布检查，不是重新招募内测。**

## 第1步：认识你要买的东西

| 名词 | 用普通话解释 | InRole怎么用 |
| --- | --- | --- |
| 域名 | 网站的名字 | `inrole.net` |
| 云服务器 | 一台放在机房里、持续开机的电脑 | 运行网站、数据库和上传文件存储 |
| 公网IP | 服务器在互联网上的地址 | 买服务器后取得，填写到域名解析里 |
| DNS解析 | 把名字指向服务器地址 | 让浏览器找到服务器 |
| HTTPS | 浏览器到网站的加密连接 | Caddy申请并维护证书 |
| 数据库 | 保存结构化业务数据 | 用户、人物、帖子、评论、余额与流水 |
| 媒体存储 | 保存图片和视频文件 | 人物头像与帖子附件 |
| GitHub | 保存代码版本的仓库 | 服务器从这里获取已确认的源码 |
| Docker | 按固定配置运行软件的工具 | 运行InRole、PostgreSQL和Caddy |
| SSH | 从你的电脑连接服务器的方法 | 管理部署、维护和下载备份 |

部署完成后：访问者 → `inrole.net` → 云服务器的HTTPS入口 → InRole → 数据库/媒体。

你的Windows电脑关闭后，云服务器上的网站仍可运行。服务器和域名需要持续续费；它们是两笔独立费用。

## 第2步：完成域名购买

**位置：【网页 / 阿里云】**

1. 打开阿里云官网，登录你自己长期控制的账号，完成平台账号实名认证，并设置账号的安全验证与恢复方式。
2. 在阿里云搜索“域名注册”，查询完整的 `inrole.net`。本指南没有代查或保证它当前可注册，也没有替你保留这个名字。
3. 查看结果是否为普通“可注册”。若已被注册，或出现一口价/溢价/交易域名，先停下核对持有人、交易性质和费用，不把交易价当普通注册价。
4. 进入域名控制台的“信息模板”，创建真实的个人或单位模板，提交证件并等待实名审核。将来的持有者和运营主体要按实际情况选择，不随意填写别人身份。
5. 模板通过后，返回注册订单，确认选择了这份已实名模板。阿里云账号实名与域名持有者模板实名是两件事。
6. 核对拼写、持有者、注册年限、首年价、续费价、自动续费设置、最终结算金额。初次可以先选1年；不要只看促销首年价。
7. 对照订单，不添加本方案未使用的建站模板、企业邮箱、付费DNS或付费SSL等选配项。你已有InRole程序，后面在自己的服务器部署。
8. 由你完成付款，然后回到“域名列表”，查看注册是否成功、实名状态是否正常、到期日是否正确。
9. 按阿里云通知完成需要的联系人验证；如果仍是审核中或 `serverHold`，先解决实名/域名状态问题，再配置网站。
10. 记录域名到期日，并设置续费提醒。域名续费与服务器续费分别管理。

**成功标志：** `inrole.net` 出现在你自己的域名列表中，注册成功、实名状态正常，可以进入解析管理。付款成功不一定代表所有审核已完成。

官方流程：[域名注册快速入门](https://help.aliyun.com/zh/dws/getting-started/quickly-register-a-new-domain-name)、[如何完成域名实名认证](https://help.aliyun.com/zh/dws/user-guide/how-to-complete-domain-name-authentication)。具体审核时长以控制台为准。

## 第3步：建立一张部署记录表

在你自己的密码管理器或私人笔记里记录；不要发到公开仓库。

| 项目 | 你填写的内容 |
| --- | --- |
| 域名 | inrole.net |
| 域名注册邮箱、到期时间 | 待填写 |
| 云厂商、账户 | 待填写 |
| 服务器地域、系统、规格 | 待填写 |
| 服务器实例名称/ID | 待填写 |
| 服务器公网IPv4 | 待填写 |
| SSH登录用户名 | 以云控制台为准，如 `ubuntu` 或 `root` |
| 服务器月费、流量额度、超额计费、续费价 | 待填写 |
| 正式发布Git提交号 | 第9步填写 |
| 当前应用镜像标签 | 第10～11步填写 |
| 站长ID | 第17步填写 |
| 备份位置、备份密钥保管位置 | 第23～26步填写 |

密码、私钥与数据库密钥单独保存在安全位置，不放进普通共享表格。域名和服务器账户都使用你能够长期控制的邮箱。

## 第4步：选择一台服务器

**位置：【网页 / 云厂商控制台】**

本文以阿里云“轻量应用服务器”为例，购买页面可能随时间变化；找不到同名按钮时，以官方文档与当前界面为准。

1. 注册云账户，完成平台要求的账户验证。
2. 在产品中搜索“轻量应用服务器”。
3. 点击“创建服务器”。
4. **地域：** 本指南以“中国香港”为初始候选，先评估目标用户的访问线路；如果使用中国内地节点，先安排备案及相应接入条件。不要仅因为写着“香港”就认为国内外一定都快。服务器创建后不能直接改地域。
5. **镜像类型：** 选择“系统镜像”，选 **Ubuntu 24.04 LTS**。
6. **架构：** 选 **x86_64 / AMD64**。不要选择Windows、WordPress、宝塔预装环境或ARM版本来直接照抄本文。
7. **规格评估起点：** 2核CPU、4GB内存、80GB或以上磁盘；预算允许可选8GB内存以增加构建余量。这是本项目的初始选型建议，不是阿里云给出的最低配置或并发容量保证。视频会持续占用磁盘与流量。
8. 确认包含公网IPv4、每月流量额度、带宽限制、流量用完后的行为、超额费用和续费价。
9. 香港候选先按1个月评估，确认访问质量、续费价和迁移安排后再延长。中国内地备案路线不能照抄这项时长：阿里云轻量服务器备案实例要求含续费时长至少3个月，具体以当前备案规则和控制台为准。
10. 在你确认费用后创建一台，取名 `inrole-prod`。
11. 等待状态为“运行中”，记录公网IP和控制台显示的登录用户名。

阿里云说明，香港等境外节点使用国际带宽，从大陆访问可能出现较高延迟；地域创建后也不能直接改成另一地域。选择前需要认真核对。[创建服务器官方步骤](https://help.aliyun.com/zh/simple-application-server/user-guide/create-a-server/)

**成功标志：** 你能看到一台运行中的Ubuntu服务器、明确的公网IPv4和费用记录。

购买前逐项对照：产品为轻量应用服务器；地域按你的实际方案；系统为Ubuntu 24.04；架构x86_64；内存建议4GB起；有公网IPv4；套餐流量/超额费用可接受。不同地域的库存和套餐不同，若页面没有这个组合，先核对替代规格，不随意换成Windows或ARM照抄命令。

## 第5步：配置云防火墙

**位置：【网页 / 阿里云轻量应用服务器 → 目标服务器详情 → 防火墙】**

添加或核对入站规则：

| 端口 | 协议 | 来源 | 用途 |
| --- | --- | --- | --- |
| 22 | TCP | 你的当前公网IP，优先单IP `/32` | SSH管理 |
| 80 | TCP | 所有IPv4，即 `0.0.0.0/0` | HTTP跳转与证书验证 |
| 443 | TCP | 所有IPv4，即 `0.0.0.0/0` | HTTPS网页 |

本文使用IPv4 TCP即可；暂不额外配置IPv6、HTTP/3或CDN。不要开放数据库5432端口和应用3000端口。

你在宿舍、家庭Wi-Fi或手机热点之间切换时，公网IP可能变化。SSH连接超时，先核对22端口的来源IP；不必因此把所有端口全部开放。云控制台提供的远程连接可以作为备用入口。

**成功标志：** 规则只包含实际需要的入口。此时还没启动网站，80/443不能打开网页是正常的。

轻量应用服务器使用“防火墙”，ECS使用“安全组”，不要在另一个产品的控制台找同一台机器。阿里云Linux轻量服务器通常已有22/80/443的默认TCP规则，先核对，再添加或收紧来源，避免重复规则覆盖。[官方防火墙说明](https://help.aliyun.com/zh/simple-application-server/user-guide/manage-the-firewall-of-a-server)。

## 第6步：准备Windows上的SSH密钥

**第一次连接的简便入口：** 你可以先在阿里云轻量服务器卡片点击“远程连接”→Workbench→“立即登录”，确认能进入服务器终端，再按下面准备自己的SSH密钥，供长期维护和第24步下载备份使用。Workbench一键连接的账号不等于你在Windows上可以直接使用的SSH账号；不把临时免密会话当成已完成本机密钥绑定。[阿里云远程连接Linux服务器](https://help.aliyun.com/zh/simple-application-server/user-guide/connect-to-linux-server-remotely)。

**位置：【本机 PowerShell】**

1. 右键Windows开始按钮，打开“终端”或“PowerShell”。
2. 输入：

```powershell
ssh -V
```

如果提示找不到命令，在Windows“设置 → 应用 → 可选功能”中检查安装 **OpenSSH客户端**，安装后重新打开终端。

3. 创建密钥目录：

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh"
```

4. 检查是否已经存在这套密钥：

```powershell
Test-Path "$env:USERPROFILE\.ssh\inrole_server"
```

输出 `False` 才生成；输出 `True` 时保留原文件，确认它的用途，不覆盖。

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\inrole_server" -C "inrole-server"
```

提示 `Enter passphrase` 时设置一个你能保存好的密钥口令。输入时可能不显示字符，正常。

5. 显示公钥：

```powershell
Get-Content "$env:USERPROFILE\.ssh\inrole_server.pub"
```

复制完整的 `ssh-ed25519 ...` 一行。

6. 到云控制台的SSH密钥管理中，找“导入密钥/导入公钥”，粘贴这一行，给密钥取名 `inrole-student`，绑定到目标服务器。按云平台提示完成必要的生效操作；不要对已有网站运行中的服务器随意重装系统。

**两个文件的区别：** `.pub` 是可提交到云平台的公钥；没有 `.pub` 的文件是私钥，留在本机，不粘贴到聊天、网页教程或GitHub。

如果平台没有公钥导入入口，先用它的浏览器远程连接按官方方法绑定；不要根据别的系统教程覆盖整个SSH配置。

## 第7步：连接服务器，确认自己在哪台电脑

**位置：【本机 PowerShell】**

将下列的用户名和IP替换成控制台记录的实际值：

```powershell
ssh -i "$env:USERPROFILE\.ssh\inrole_server" 你的SSH用户名@你的服务器IP
```

第一次出现服务器指纹确认时，先与云控制台显示的主机指纹核对；能核对一致后再输入 `yes`。输入的是刚才设置的私钥口令，不是InRole密码。

也可从轻量控制台打开“远程连接 / Workbench”进入终端。官方一键连接可能使用受限的admin账号；若下方 `sudo -i` 无法取得root权限，先按控制台与官方说明为自己的实际账号设置密码/绑定密钥，使用Workbench密码登录或SSH连接。不要假定所有镜像都使用root或ubuntu登录，也不要因权限问题重装服务器。

**位置：【服务器终端】**

```bash
whoami
hostname
cat /etc/os-release
uname -m
```

确认：系统为Ubuntu 24.04，架构为 `x86_64`。然后：

```bash
sudo -i
whoami
```

应显示 `root`。从这里开始，本文服务器命令都在这个root会话执行。你的实际SSH登录用户名仍记录原来的值，后面下载文件时要用。

终端提示符常见区别：`PS C:\...>` 是本机；`root@...:~#` 是服务器。SSH断开后会回到本机，需要重新连接并再次 `sudo -i`。

## 第8步：安装基础软件与Docker

**位置：【服务器终端 / root】**

先安装工具，并把服务器时间设为北京时间，方便后面按03:30运行备份：

```bash
apt-get update
apt-get install -y ca-certificates curl git openssl nano python3 util-linux
timedatectl set-timezone Asia/Shanghai
```

**以下Docker安装方式只适用于全新的Ubuntu 24.04 AMD64主机。** 如果服务器已有Docker、其他业务或不是这个系统，先检查现状，不重复覆盖软件源。

```bash
install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg --output /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc
printf '%s\n' 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

按顺序运行，每一行结束并且没有错误后再继续。安装过程卡在网络下载时，先检查网络，不反复执行来源不明的一键脚本。

检查：

```bash
docker --version
docker compose version
docker run --rm hello-world
```

**成功标志：** 前两条输出版本，最后一条输出Docker测试成功的信息。这里使用 `docker compose`，中间有空格。

以上软件源命令按固定示例环境整理；官方完整安装与支持系统说明：[Docker Ubuntu安装文档](https://docs.docker.com/engine/install/ubuntu/)。

## 第9步：确认并获取正式发布代码

### 9.1 先把本地最新版整理成发布提交

**位置：【当前Codex聊天 / 本机项目】**

当前本机项目目录：`C:\Users\27251\Desktop\666\inrole`。

本指南和最新界面修改随2026-11-26本次更新一并同步；首次部署时仍应核对GitHub实际提交号。以后改版，先让Codex检查本地改动、运行必要检查、整理提交并同步到 `jasperlvv/InRole`，记下最终完整Git提交号。可以使用这段指令：

> 整理InRole正式发布版本，保留现有工作，将已完成的人物选择界面等修改和上线文档提交并同步到GitHub。先检查差异、秘密文件和必要测试，再推送，不强推、不部署；告诉我最终完整提交号，以及尚未完成的人物内容和发布条件。

这里的复制提示词是你后续可发出的操作指令；**本文档的生成本身没有执行提交或推送。**

如果270位人物、头像与初始内容尚未完成，它们不会因为提交代码而自动出现。准备好后同样需要独立的可审查数据包或后台录入。

### 9.2 在服务器拉取代码

**位置：【服务器终端 / root】**

先确认目标目录没有旧项目：

```bash
ls -ld /opt/inrole
```

第一次部署提示不存在是正常的。如果已存在，先检查是不是之前部署过，不删除重来。

如果GitHub仓库是公开仓库：

```bash
git clone https://github.com/jasperlvv/InRole.git /opt/inrole
cd /opt/inrole
git log -1 --oneline
```

如果是私有仓库，不要把仓库改公开来绕过认证；使用本指南最后的“私有仓库附录”。

核对发布提交。将完整提交号替换后运行：

```bash
git checkout --detach 已确认的完整Git提交号
git rev-parse HEAD
git status --short
```

**成功标志：** 输出的完整提交号与你确认的一致；工作区没有意外代码修改。若找不到提交，先确认本机是否已推送和服务器是否已获取，不随便换成旧版本。

## 第10步：生成正式配置与备份密钥

**位置：【服务器终端 / root】**

```bash
cd /opt/inrole/deploy
pwd
```

输出必须是 `/opt/inrole/deploy`。

下面的Python代码会直接把随机密码写入文件，不需要你手动编造数据库密码，也不会把真实值打印出来。**仅用于第一次初始化；文件已经存在时会拒绝覆盖。**

```bash
umask 077
python3 - <<'PY'
from pathlib import Path
import os
import secrets
import subprocess

env_file = Path('.env')
key_file = Path('secrets/backup-key')
if env_file.exists() or key_file.exists():
    raise SystemExit('配置或备份密钥已存在：保留原文件，不重新生成。')

commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
values = {
    'DOMAIN': 'inrole.net',
    'INROLE_IMAGE': 'inrole:' + commit,
    'BOOTSTRAP_DB_PASSWORD': secrets.token_hex(32),
    'MIGRATOR_DB_PASSWORD': secrets.token_hex(32),
    'APP_DB_PASSWORD': secrets.token_hex(32),
    'SESSION_PASSWORD': secrets.token_hex(32),
    'RATE_LIMIT_SECRET': secrets.token_hex(32),
    'RECOVERY_CODE_PEPPER': secrets.token_hex(32),
}
Path('secrets').mkdir(mode=0o700, exist_ok=True)
Path('secrets').chmod(0o700)
Path('backups').mkdir(mode=0o700, exist_ok=True)
Path('backups').chmod(0o700)
fd = os.open(env_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(''.join(f'{name}={value}\n' for name, value in values.items()))
fd = os.open(key_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(secrets.token_hex(48) + '\n')
print('已生成正式环境配置与备份密钥；请分别保管。')
print('应用镜像标签：' + values['INROLE_IMAGE'])
PY
```

如果中途失败，检查两个文件状态；不要为了重跑而删除已生成的密钥。后面如果已经有用户数据，重建密码会影响数据库连接、会话或恢复码。

检查权限和Compose格式，命令不会展开秘密值：

```bash
ls -l .env secrets/backup-key
docker compose config --quiet
```

**成功标志：** 两个文件只有root可读写；Compose检查无错误。不要运行不带 `--quiet` 的完整配置输出并截图。

`.env` 与 `secrets/backup-key` 都需要保存异机副本，具体传输见备份部分。不要把它们传到GitHub。

## 第11步：构建网站运行镜像

**位置：【服务器终端 / root】**

```bash
cd /opt/inrole
INROLE_RELEASE_COMMIT=$(git rev-parse HEAD)
docker build --tag "inrole:${INROLE_RELEASE_COMMIT}" .
```

等待构建结束；第一次需要下载依赖，通常比后续慢。本文不承诺固定分钟数。

```bash
docker image inspect "inrole:${INROLE_RELEASE_COMMIT}" --format '{{.Id}}'
```

**成功标志：** 构建退出成功，检查命令输出镜像ID。把提交号、镜像标签和ID记到部署记录表。

常见异常：

- `Killed`、退出137、内存不足：检查内存和构建日志，考虑更大内存或在另一构建机制作镜像；不要直接重置数据库。
- 镜像版本不存在：核对项目固定版本和官方镜像，不能随意改成 `latest`。
- 下载超时：检查服务器到软件仓库的网络，不向陌生镜像站发送密钥。

## 第12步：启动正式数据库与执行迁移

**位置：【服务器终端 / root】**

```bash
cd /opt/inrole/deploy
docker compose up -d db
docker compose ps
```

重复查看 `docker compose ps`，直到db显示 `healthy`。如果一直 `unhealthy`：

```bash
docker compose logs --tail=80 db
```

先检查错误，不删除数据库卷。首次初始化需要一点时间。

然后执行迁移：

```bash
docker compose run --rm migrate
```

**成功标志：** 迁移成功，输出应用权限已应用，没有数据库错误。这个步骤创建真实业务表与受限账号权限。

**不要在正式服务器运行 `npm run db:local:setup`。** 那是为本机Windows开发环境准备的流程。

## 第13步：给正式空库建立兴趣分类

**位置：【服务器终端 / root】**

当前后台可以维护人物和话题，但没有兴趣分类编辑页。第一次建库需要先准备分类，否则后台人物表单没有可选的“主要兴趣”。

下面只添加7个公共分类；已有同ID不会覆盖，且不会插入账号、帖子或钱包。

```bash
cd /opt/inrole/deploy
docker compose exec -T db psql -U inrole_bootstrap -d inrole -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO inrole.interest_tags (id, name) VALUES
  ('history-cn', '中国历史'),
  ('history-world', '世界历史'),
  ('games', '游戏人物'),
  ('film', '影视人物'),
  ('literature', '文学人物'),
  ('anime', '动漫人物'),
  ('sports', '体育人物')
ON CONFLICT (id) DO NOTHING;
COMMIT;
SELECT id, name FROM inrole.interest_tags WHERE active = true ORDER BY id;
SQL
```

**成功标志：** 显示7个分类；如果正式库之前已有更多分类，会一并显示。这个管理连接只在容器内部使用，不开放公网数据库端口。

## 第14步：配置域名解析

**位置：【网页 / 阿里云域名控制台或云解析DNS】**

1. 登录阿里云，在“域名列表”找到 `inrole.net`，点击“解析”。也可以从“云解析DNS → 公网权威解析”找到该域名。
2. 确认域名使用阿里云分配的DNS服务器；如果已改为其他服务商的DNS，就在实际权威DNS后台配置，不在两个后台各加一份并期待同时生效。不手工猜填DNS服务器地址。
3. 进入“解析设置”，点击“添加记录”。新控制台可能显示“添加解析记录”，以实际界面为准。
4. 查看当前记录。若有同主机名的停放页、旧A记录、CNAME或跳转记录，先记录旧值，再处理冲突；已有邮箱的MX/TXT等不动。
5. 添加下面这一条：

| 表单字段 | 你填写的内容 | 解释 |
| --- | --- | --- |
| 记录类型 | A | 把域名指向IPv4地址 |
| 主机记录 | @ | 表示直接访问inrole.net |
| 解析请求来源/线路 | 默认 | 不按地区分流 |
| 记录值 | 你的服务器公网IPv4 | 从服务器详情复制，不填私网IP、网址或示例IP |
| TTL | 保留控制台默认值 | DNS缓存时间 |

6. 点击确认，查看列表中的记录是否正确、是否启用。记录值只填IP，不加 `https://`，也不加 `:3000`。

**第一版先只启用 `inrole.net`。** `www.inrole.net`需要额外DNS、HTTPS和跳转配置，不能只加一个记录就假定网站已经处理好。未配置IPv6时不要添加AAAA记录。

官方点击路径：[阿里云添加解析记录](https://help.aliyun.com/zh/dns/pubz-add-parsing-record)。DNS生效受缓存和域名状态影响，不保证每个网络同时变化。

**位置：【本机 PowerShell】**

```powershell
Resolve-DnsName inrole.net -Type A
```

**成功标志：** 查询返回你填写的公网IPv4。域名解析成功但页面打不开，说明还需要继续启动服务；不是重新买域名。

## 第15步：设置发布检查用的临时访问口令

**位置：【服务器终端 / root】**

这一层口令保护尚未完成发布验收的网站，独立于InRole站内ID密码。后面通过验收后再移除。

生成一个你自己保管的强口令，并使用Caddy把它变成哈希：

```bash
docker run --rm -it caddy:2.11.9-alpine caddy hash-password
```

按提示输入口令，保存输出的一整行哈希。随后：

```bash
cd /opt/inrole/deploy
cp -p Caddyfile secrets/Caddyfile.before-preview
nano Caddyfile
```

在 `{$DOMAIN} {` 这一行后面加上下面3行，把示例哈希替换成刚才生成的完整哈希：

```caddyfile
  basic_auth {
    preview 这里替换成完整的密码哈希
  }
```

保存方法：按 `Ctrl+O`，按Enter确认文件名，再按 `Ctrl+X`退出。`preview` 是临时访问用户名；密码是你刚才输入的原始口令，不是哈希。

如果 `secrets/Caddyfile.before-preview` 已存在，先核对是不是已设置过，不覆盖原始备份。这个临时改动仅留在服务器上，后面恢复原文件，不提交哈希到GitHub。

语法参考：[Caddy basic_auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth)。

## 第16步：启动网站与HTTPS入口

**位置：【服务器终端 / root】**

```bash
cd /opt/inrole/deploy
docker compose up -d app
docker compose ps
```

等待app为 `healthy`，再检查应用内部就绪状态：

```bash
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/ready').then(async r=>{console.log(r.status);console.log(await r.text());if(!r.ok)process.exitCode=1}).catch(()=>{console.error('就绪检查连接失败');process.exitCode=1})"
```

应返回200；不是200就先检查app和db，不启动公开入口来掩盖错误。

```bash
docker compose up -d caddy
docker compose logs --tail=80 caddy
```

域名解析正确、80/443可达时，Caddy会申请并维护HTTPS证书。[自动HTTPS说明](https://caddyserver.com/docs/automatic-https)

**位置：【网页】** 打开 `https://inrole.net`。

浏览器应先弹出访问口令框。输入用户名 `preview` 和第15步保存的口令，之后看到InRole页面，地址栏没有证书错误。

不输入口令应得到401或口令提示，而不是直接浏览社区。若临时口令层没有生效，先检查Caddy配置，再进行后续建站操作。

空人物、空帖子是新数据库的正常状态，不表示已经自动导入了本机演示内容。

## 第17步：创建你的站长账号

**位置：【网站】**

1. 通过临时访问口令进入网站。
2. 打开 `https://inrole.net/live/register`。
3. 自己选一个个人ID，例如 `jasper_admin`，并设置站内密码。
4. 保存这个实际ID；不是显示昵称。
5. 完成喜好引导，也可以按界面提供的跳过操作完成引导。

**位置：【服务器终端 / root】**

把示例ID替换为你刚注册的真实ID，仅执行一次：

```bash
cd /opt/inrole/deploy
docker compose run --rm migrate node scripts/db/bootstrap-admin.mjs jasper_admin
```

**成功标志：** 显示管理员已设置、旧会话已撤销的成功信息。

**位置：【网站】**

1. 重新登录站内账号。
2. 打开 `https://inrole.net/live/admin`。
3. 应看到“社区管理”、人物与头像、话题、申请审核、举报处理、账号状态、操作审计。
4. 打开 `https://inrole.net/live/recovery-codes`，按界面生成、保存恢复码，存放在安全位置。

普通用户打开管理页时，管理数据/操作必须被拒绝。管理员能力不要通过把数据库超级用户连接放进网页来实现。

## 第18步：先添加一位人物，确认整条流程

**位置：【网站 → 社区管理 → 人物与头像】**

先用一位你已经确认的历史人物验证，例如：

| 字段 | 示例 |
| --- | --- |
| 人物ID | `li-shimin` |
| 名称 | 李世民 |
| 简介 | 唐太宗，唐朝皇帝。此处为用户角色扮演，发言不代表历史人物真实言论。 |
| 主要兴趣 | 中国历史 |
| 启用人物 | 勾选 |

1. 填写后点击“保存人物”。
2. 弹出确认框时，填写管理原因，例如“首版公共人物目录初始化”。
3. 点“确认并记录”。
4. 确认出现保存成功信息，并能在操作审计里看到记录。
5. 打开 `https://inrole.net/live/people`，搜索并找到李世民。

**人物ID一旦用于正式内容就作为稳定标识保存。** 改显示名字时使用同一ID，不另建一条冒充修改，避免历史帖子和评分分裂。

## 第19步：给人物上传头像

**位置：【网站 → 社区管理 → 人物与头像 → 上传人物头像】**

1. 准备已核对使用依据的图片；建议裁成清楚的正方形，先用较小的JPEG/PNG/WebP文件验证。
2. 人物ID填 `li-shimin`。
3. 选择本机头像文件。
4. 填写实际来源网页、原作者和许可说明。
5. 点击“上传并设置头像”。
6. 在确认框填写原因并确认。
7. 返回人物页、发帖选择面板，确认头像显示。
8. 刷新页面再次确认。

填写来源不等于取得授权。历史人物的古代形象、现代摄影、影视截图和游戏立绘的使用依据不同，要分别审核。人物扮演说明与实际 `@账号` 保留，不把扮演账户标成真人认证。

**成功标志：** 头像来自正式网站存储，刷新后仍能读取，人物搜索可以找到。

## 第20步：完成270位人物和话题

当前名单在 `docs/release/人物扩充候选清单V2.md`，总计270位候选，按最新版配额分组。

### 方式A：后台逐个录入

重复第18、19步。适合少量补充和验证，但270位全部手工录入会较费时间。

### 方式B：使用已验证的目录导入工具（推荐）

工具已实现并验证：`scripts/db/import-catalog.mjs`，命令 `npm run db:import:catalog`。它支持三档操作：

| 模式 | 命令 | 是否写库 |
| --- | --- | --- |
| 只校验数据包 | `npm run db:import:catalog -- --check` | 不需要数据库 |
| 演练（默认） | `npm run db:import:catalog -- --pack prisma/catalog.json` | 只读检查并打印计划 |
| 正式写入 | 加 `--apply --confirm-reviewed --reviewed-at 日期 --reviewed-by 审核人` | 单事务写入 |

**今天就能导入的是 `prisma/catalog.json`**：22 位已核验人物、9 个兴趣、8 个话题、22 条头像署名。它在正式库上执行的命令是：

```bash
set -a; . /etc/inrole/migrate.env; set +a
cd /opt/inrole
npm run db:import:catalog -- --pack prisma/catalog.json          # 先演练，确认计划
npm run db:import:catalog -- --pack prisma/catalog.json --apply --confirm-reviewed \
  --reviewed-at 2026-11-26 --reviewed-by 你的名字
```

工具内建的约束（都已被 `npm run verify:catalog` 的 8 组集成场景覆盖）：

- 只接受迁移拥有者 `DIRECT_URL`；应用角色执行会被拒绝且不留半条数据。
- 默认拒绝 `inrole_dev`、`inrole_test` 和验证库，避免把开发数据当正式种子。
- 只做 `INSERT ... ON CONFLICT DO NOTHING`，不覆盖管理后台改过的简介或头像。
- 整包在单事务内完成，任一条失败全部回滚；结束前核对人数与署名。
- 输出不含凭据的回执到 `.tmp/catalog/import-<时间>.json`，记录目标库、摘要和审核人。

**270 位还需要制作数据包。** 名单 `docs/release/人物扩充候选清单V2.md` 只有姓名和分组，缺简介、兴趣归属、头像和来源，重命名成 JSON 不能导入。数据包格式、字段规则和补齐方法见 [公共目录数据包与导入](release/公共目录数据包与导入.md)。补齐后先用 `--check` 校验，再到隔离库演练，最后对正式库执行上面的写入命令。

### 创建话题

在后台“话题”表单先添加少量明确主题，例如：

| 话题ID | 名称 | 介绍示例 |
| --- | --- | --- |
| `first-line` | 第一条开场白 | 换个身份，介绍一下自己。 |
| `history-office` | 历史人物也上班 | 如果古人也要开会、写周报，会怎么说？ |
| `rdr2-camp` | 范德林德营地 | 角色扮演讨论，区分剧情与玩家观点。 |
| `f1-paddock` | 围场茶话会 | 从车手视角聊竞赛、车队与选择。 |

每次保存都填写真实管理原因，确认前台能读到。话题兴趣关联等批量配置如需细化，放进经过验证的公共目录发布包。

## 第21步：发布开场帖子

**位置：【网站】**

1. 使用你管理的明确“官方/运营”身份账号。
2. 打开 `https://inrole.net/live/compose`。
3. 搜索并选择人物。
4. 输入正文，选择合适话题，再发布。
5. 打开详情页，确认显示“人物 + 实际@账号”。
6. 用另一个你自己控制的发布检查账号，验证评论时可以独立选择人物。

开场内容可用关系圈做引子，例如“李世民发一条关于开会的帖子，魏征接一句”；实际发布账号如实展示。不要用多个伪装的普通用户制造虚假的真人活跃、评分或通宝交易。

建议先在文稿里准备几十篇短帖与接话，确认质量后再发布。**本指南没有自动生成、导入或发布这些帖子。** 发布检查用的临时内容与正式开场内容分清，操作后保留正确的通宝账目与审计记录。

## 第22步：按清单完成发布验收

仍保留第15步访问口令，先由你完成检查。

### 22.1 电脑浏览器

- [ ] 首页、人物、热搜、个人中心能打开。
- [ ] 注册、登录、退出、恢复码流程可用。
- [ ] 发帖/评论人物有头像，搜索有结果，无匹配时提示正确。
- [ ] 人物搜索框按Enter不会误发帖。
- [ ] “找不到？现在申请”进入真实申请页，后台能处理申请。
- [ ] 点赞、取消点赞、评论、评分、投币、赠送与流水符合规则。
- [ ] 图片刷新后存在，视频可以播放和拖动。
- [ ] 管理员能维护人物和处理举报，普通账号不能越权操作。
- [ ] 屏蔽与注销按实际账号工作；注销后旧会话失效。
- [ ] 隐私、协议、联系方式中的运营者、邮箱、托管地区和保存期限准确。

### 22.2 手机与真实网络

- [ ] 手机Wi-Fi打开，检查软键盘、发帖、评论和人物搜索。
- [ ] 关闭Wi-Fi，用蜂窝流量再检查。
- [ ] 检查窄屏没有横向溢出，按钮能点击，头像能加载。
- [ ] 弱网/断连时明确提示失败或重试，正文不无故消失，不自动重复发布/扣币。
- [ ] 加载更多期间切换搜索/话题，旧分页不会混入新列表、不会覆盖新筛选游标。
- [ ] 封禁账号后，帖子详情、引用原文与媒体直链采用已确认的一致可见性规则；解封后复核。
- [ ] 大陆与海外各有实际访问证据：记录日期、地区、网络、首页/登录/API/媒体结果。没有海外测试条件就记未验证，不捏造。

### 22.3 重启与持久化

**位置：【服务器终端 / root】**

```bash
cd /opt/inrole/deploy
docker compose restart app
docker compose ps
```

app重新健康后，检查刚才的帖子、头像、附件仍可读取，钱包流水不变。后续在有云控制台备用入口、已做好备份时安排服务器重启验证；先不用新手直接重装或重建系统。

**成功标志：** 保存实际检查结果。构建通过、容器healthy、HTTP200和用户交互检查是不同证据，不能互相替代。

## 第23步：制作第一份备份

**位置：【服务器终端 / root】**

备份会短暂停止应用写入，页面期间可能暂时不可用。选你自己不操作网站的时间，避免同时发布代码、导入数据或修改数据库。

```bash
cd /opt/inrole/deploy
docker compose build ops
sh backup.sh
ls -lh backups
docker compose ps
```

**成功标志：** 出现 `inrole-日期时间.enc` 加密文件，命令成功，应用恢复为healthy。

这份备份包含数据库、私人媒体和核对摘要；源码和公共静态图片来自对应的Git版本。`secrets/backup-key` 是解密所需密钥，不会自动装进同一加密备份；`.env` 里的持久认证配置也要单独保存。

仅在同一台服务器上有备份，还不能防止整台服务器或账户丢失。下一步必须保存主机外副本。

## 第24步：把备份保存到自己的电脑

先使用第7步相同的SSH账户。以下方式通过服务器为该账户准备一份受保护的导出目录；若目标不是你的实际账户，停止并改成正确值。

**位置：【服务器终端 / root】**

```bash
INROLE_EXPORT_USER='这里替换成实际SSH登录用户名'
id "$INROLE_EXPORT_USER"
INROLE_EXPORT_HOME=$(getent passwd "$INROLE_EXPORT_USER" | cut -d: -f6)
printf '%s\n' "$INROLE_EXPORT_HOME"
```

确认显示正确的账户与它自己的家目录，如 `/home/ubuntu` 或 `/root`。如果空白、找不到用户，或者目录不符合预期，先不执行下面命令。

准备备份导出目录，不创建密码明文副本：

```bash
install -d -m 0700 -o "$INROLE_EXPORT_USER" -g "$(id -gn "$INROLE_EXPORT_USER")" "$INROLE_EXPORT_HOME/inrole-exports"
cp -n /opt/inrole/deploy/backups/inrole-这里替换成实际文件名.enc "$INROLE_EXPORT_HOME/inrole-exports/"
chown "$INROLE_EXPORT_USER:$(id -gn "$INROLE_EXPORT_USER")" "$INROLE_EXPORT_HOME/inrole-exports/"*.enc
chmod 0600 "$INROLE_EXPORT_HOME/inrole-exports/"*.enc
```

文件名从第23步 `ls -lh backups` 输出中复制，不把示例文字当成真实文件名。保存多个文件时分别复制，不改变数据库卷权限。

**位置：【本机 PowerShell】**

新开一个本机终端窗口，先创建私人保存目录：

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Documents\InRole私有备份"
```

把服务器目录替换为上面真实显示的家目录：

```powershell
scp -i "$env:USERPROFILE\.ssh\inrole_server" 你的SSH用户名@你的服务器IP:/实际家目录/inrole-exports/inrole-实际文件名.enc "$env:USERPROFILE\Documents\InRole私有备份\"
```

**成功标志：** 本机文件大小与服务器一致。可以分别计算SHA256核对：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath "$env:USERPROFILE\Documents\InRole私有备份\inrole-实际文件名.enc"
```

服务器对原文件运行 `sha256sum /opt/inrole/deploy/backups/inrole-实际文件名.enc`，两端摘要应一致。

### 单独保存密钥与环境配置

将 `.env` 与 `secrets/backup-key` 通过同一SSH连接下载到你控制的受保护存储。沿用上面已核对的 `INROLE_EXPORT_USER` 和 `INROLE_EXPORT_HOME`；如果重开了服务器终端，先重新执行账户与家目录核对，不使用空变量。

**位置：【服务器终端 / root】**

```bash
install -m 0600 -o "$INROLE_EXPORT_USER" -g "$(id -gn "$INROLE_EXPORT_USER")" /opt/inrole/deploy/.env "$INROLE_EXPORT_HOME/inrole-exports/production.env"
install -m 0600 -o "$INROLE_EXPORT_USER" -g "$(id -gn "$INROLE_EXPORT_USER")" /opt/inrole/deploy/secrets/backup-key "$INROLE_EXPORT_HOME/inrole-exports/backup-key"
```

**位置：【本机 PowerShell】** 先准备你自己的加密磁盘或密码管理器附件保存流程。下面下载路径要替换成受保护的实际目录，不能原样使用“你的加密存储目录”：

```powershell
scp -i "$env:USERPROFILE\.ssh\inrole_server" 你的SSH用户名@你的服务器IP:/实际家目录/inrole-exports/production.env "你的加密存储目录\production.env"
scp -i "$env:USERPROFILE\.ssh\inrole_server" 你的SSH用户名@你的服务器IP:/实际家目录/inrole-exports/backup-key "你的加密存储目录\backup-key"
```

确认下载完整并安全保存后，**位置：【服务器终端 / root】**，仅清理两个临时导出文件：

```bash
rm -- "$INROLE_EXPORT_HOME/inrole-exports/production.env" "$INROLE_EXPORT_HOME/inrole-exports/backup-key"
```

这里不删除 `/opt/inrole/deploy/.env` 或 `/opt/inrole/deploy/secrets/backup-key` 原文件。两个下载文件是敏感配置；**不要与可公开分享的备份文件一起上传，不发到聊天，不使用777权限。** 若暂时不会创建加密存储，先让维护者协助完成保管，不把明文配置长期留在下载文件夹。

注销回执保存在独立 `erasures` 卷，还应配置及时的异机副本；恢复旧备份时需要最新回执，不能仅凭较旧备份恢复已注销内容。其同步目标与周期需要在正式开放前落实。当前材料没有自动上传到外部存储的已部署任务。

## 第25步：设置每日备份与定期清理任务

**位置：【服务器终端 / root】**

先确认服务器时区是 `Asia/Shanghai`：

```bash
timedatectl
```

创建每日备份服务：

```bash
cat > /etc/systemd/system/inrole-backup.service <<'EOF'
[Unit]
Description=InRole encrypted database and media backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/inrole/deploy
ExecStart=/bin/sh /opt/inrole/deploy/backup.sh
EOF
```

创建北京时间每日03:30定时器：

```bash
cat > /etc/systemd/system/inrole-backup.timer <<'EOF'
[Unit]
Description=Daily InRole backup

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
Unit=inrole-backup.service

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now inrole-backup.timer
systemctl list-timers inrole-backup.timer
```

这只安排本机备份，**不会自动把文件传到你电脑或其他云存储**。异机上传、注销回执同步、失败告警、备份保留周期要按选定存储另行配置并测试。初期先每天检查结果，避免把“有定时器”等同于“每天备份都成功”。

注销媒体的物理删除重试命令已经存在：

```bash
cd /opt/inrole/deploy
docker compose exec -T app node scripts/ops/purge-media.mjs
```

可以建立单独的每小时重试任务：

```bash
cat > /etc/systemd/system/inrole-purge-media.service <<'EOF'
[Unit]
Description=Retry InRole deleted media removal
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/inrole/deploy
ExecStart=/usr/bin/docker compose exec -T app node scripts/ops/purge-media.mjs
EOF
cat > /etc/systemd/system/inrole-purge-media.timer <<'EOF'
[Unit]
Description=Hourly InRole deleted media cleanup retry

[Timer]
OnCalendar=hourly
Persistent=true
Unit=inrole-purge-media.service

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now inrole-purge-media.timer
systemctl start inrole-purge-media.service
systemctl status inrole-purge-media.service --no-pager
```

首次手动执行成功后再保留定时器。已完成的oneshot服务可能显示 `inactive (dead)`，重点看退出状态是否为成功；如果app当时正在停机维护，记录失败并在恢复后重新检查。该任务只重试已注销私人媒体的清理，不删除整个媒体目录。

检查定时器语义可参考 [systemd.timer官方说明](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)。需要实际监测的项目包括网站就绪、磁盘、流量、备份失败和注销回执异常；这些告警不会因为创建上述两个定时器而自动配置完成。

## 第26步：完成一次恢复演练

**发布前必须知道备份能否恢复，而不只是看到一个文件。**

当前恢复工具的行为是：创建新的恢复数据库，写入独立的 `restored_media` 卷，核对表和媒体摘要，并结合最新注销回执处理后续注销。它不会直接覆盖现有业务库，也不会自动切换网站。

执行前先核对：

1. 已有成功的备份与对应密钥。
2. 独立注销回执是最新的，备份之后的注销也包含在内。
3. 当前没有发布、导入或备份任务；安排维护窗口。
4. 恢复目标媒体卷是新建且空的。若以前恢复过且非空，保留旧目标，另建隔离环境；不删除现有卷来重跑。

条件已实际确认后，以下是工具入口：

```bash
cd /opt/inrole/deploy
docker compose run --rm -e ERASURE_JOURNAL_CONFIRMED=yes ops restore inrole-实际备份文件名.enc
```

`ERASURE_JOURNAL_CONFIRMED=yes` 是操作者的事实确认，不会自己证明回执最新。未确认时不运行。

**成功标志：** 工具返回恢复库名称、摘要核对成功和独立媒体卷信息。接下来还要用恢复目标运行隔离应用，检查账号、内容、媒体、余额、权限与已注销内容不可见，才算恢复演练完成。

**恢复库推广为正式库、重新映射媒体卷、调整后续迁移/备份目标需要一份针对实际恢复结果的切换方案。** 这一步由维护者协助执行；当前并没有已验收的“一键恢复并上线”命令。不要直接改正式库名、重建全站或把旧备份覆盖到在线业务库。

## 第27步：正式开放inrole.net

开放前确认：

- 最新代码已发布，正式提交与镜像有记录。
- 本次项目检查中的两项问题已修复并复验，不能只沿用修复前的测试结果。
- 你确认的人物、头像与开场内容已完成；270位名单不是空白占位。
- 电脑、手机、媒体、权限和资金规则检查通过。
- 主机外备份、密钥保管、注销回执同步和恢复演练有实际结果。
- 域名、服务器到期与费用可控，故障有监测与处理方式。
- 托管信息、隐私保存期限、联系方式和适用公开运营要求已落实。
- 大陆/海外访问目标有实际证据；未完成的不能写成已经完成。

**位置：【服务器终端 / root】**

恢复第15步保存的原Caddy配置，移除临时访问口令：

```bash
cd /opt/inrole/deploy
cp -p secrets/Caddyfile.before-preview Caddyfile
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

如果后续曾有意调整Caddy其他配置，应先比较并仅移除口令段，不用旧备份覆盖新的必要设置。

**位置：【网页 / 无痕窗口】**

1. 打开 `https://inrole.net`，确认不再要求临时访问口令。
2. 再检查一次登录、发帖、头像和图片。
3. 用手机流量检查。
4. 记录开放日期、Git提交号、镜像ID和验收结果。

这时再把正式网址发给用户。网页可以打开与正式发布验收完成，是两个不同里程碑。

## 第28步：以后如何增加内容

| 你想做的事 | 日常操作 |
| --- | --- |
| 新增/修改人物和头像 | 管理后台，沿用稳定人物ID |
| 新增话题 | 后台“话题” |
| 审核人物申请 | 先维护公共人物，再在申请审核中关联并批准 |
| 发布运营内容 | 官方/运营账号使用正常发帖入口 |
| 处理举报、隐藏内容、封禁 | 管理后台，填写原因并查看审计 |
| 改页面、改功能、改业务规则 | 先在本机开发与验证，再发布新代码 |

后台当前并不是一个能修改所有代码、兴趣分类和任意数据的万能面板。没有界面的配置，用经过核对的管理工具处理。

## 第29步：以后如何更新代码

正常更新采用“本地开发与验证 → GitHub发布提交 → 服务器构建新镜像 → 备份 → 必要迁移 → 更换应用版本 → 检查”的流程，保留生产数据库和媒体卷。

### 29.1 本地完成改动

在当前聊天提出明确修改要求。完成后检查预览、运行适当测试，再明确提交并同步GitHub。记录新的完整提交号。自动发布尚未配置，不要以为点了GitHub提交就会自动改线上网站。

### 29.2 服务器先检查工作区与当前版本

**位置：【服务器终端 / root】**

```bash
cd /opt/inrole
git status --short
git rev-parse HEAD
cd /opt/inrole/deploy
grep '^INROLE_IMAGE=' .env
```

记录旧提交、旧镜像。如果服务器源码存在意外改动，先检查，不使用 `git reset --hard` 覆盖。第15步临时Caddy修改正常情况下已在正式开放时恢复。

### 29.3 获取并构建新版本

```bash
cd /opt/inrole
git fetch origin
git checkout --detach 新的完整Git提交号
INROLE_NEXT_COMMIT=$(git rev-parse HEAD)
docker build --tag "inrole:${INROLE_NEXT_COMMIT}" .
```

构建成功前，旧网站仍应运行。构建失败不继续切换。

### 29.4 先备份，再改镜像标签

```bash
cd /opt/inrole/deploy
sh backup.sh
cp -p .env "secrets/env-before-update-$(date +%Y%m%d%H%M%S)"
nano .env
```

只把 `INROLE_IMAGE=` 后面的值改成 `inrole:新的完整Git提交号`，其他密码和密钥不改。保存退出后：

```bash
docker compose config --quiet
```

### 29.5 在维护窗口切换

下面命令取得维护锁，停止写入应用，执行迁移，再启动新应用。切换期间网页可能短暂不可用。迁移失败时不强行启动新版本。

```bash
flock -n .maintenance.lock bash -c '
set -e
docker compose stop --timeout 45 app
docker compose run --rm migrate
docker compose up -d app
'
docker compose ps
```

随后检查 `/api/ready`、登录、帖子、媒体和关键业务。观察新版本错误后再记发布完成。需要不同架构或复杂数据库变更时，先做专项发布方案，不机械套用上面的普通升级步骤。

更新**不需要重新购买域名，不需要整库覆盖，也不应清空数据库或上传目录**。

## 第30步：每天与每月检查什么

### 每天或发布后

```bash
cd /opt/inrole/deploy
docker compose ps
df -h
systemctl status inrole-backup.service --no-pager
```

- 打开网站，查看就绪状态与主要页面。
- 查看备份是否成功，异机副本是否更新。
- 处理举报和人物申请。
- 检查磁盘与流量；视频增长时及时调整存储方案。
- 需要日志时用 `docker compose logs --tail=100 app`，先本地检查并去除敏感信息再反馈。

### 每月

- 核对域名、服务器、备份存储账单与续费。
- 检查系统和依赖更新，先验证兼容性再应用。
- 安排恢复演练，检查密钥与恢复码仍能找到。
- 按已确定的保留策略处理旧备份；本指南不安排自动删除，避免新手误删唯一有效副本。

单节点发布更新、故障和备份可能有短暂停机。今后访问量上来后，再根据实际瓶颈评估托管数据库、对象存储与多实例，不一次购买复杂架构。

## 第31步：更新失败如何处理

1. 先记录错误、当前镜像、迁移执行到哪一步。
2. 判断新迁移是否与上一版应用兼容；不能只凭“旧版以前能跑”就回退。
3. 确认兼容后，把 `.env` 中的 `INROLE_IMAGE` 改回已记录的旧标签，然后 `docker compose up -d app`。
4. 再检查就绪、账号、内容与媒体。
5. 数据问题按第26步走新目标恢复与切换方案；回退应用镜像不会自动回退数据库。

尤其当前版本包含注销与原ID预留规则，旧版如果不识别这些规则，不能直接回退。任何恢复都要保持已注销账号和内容不可重新公开。

## 常见错误速查

| 现象 | 先检查 | 不要这样处理 |
| --- | --- | --- |
| 域名还是停放页 | 权威DNS、@记录、缓存、冲突重定向 | 不重新买同一域名 |
| HTTPS证书错误 | DNS是否正确、80/443、Caddy日志、服务器时间 | 不让用户长期忽略证书警告 |
| SSH超时 | 22端口来源IP、服务器公网IP、云控制台备用连接 | 不开放所有端口 |
| SSH Permission denied | 实际用户名、公钥绑定、使用的私钥文件 | 不把私钥粘贴到网上 |
| 502或页面暂不可用 | app是否healthy，是否正在备份/升级 | 不删除数据库重装 |
| 登录后发帖被拒绝 | 正式地址是否精确为https://inrole.net、Cookie、引导状态、错误编号 | 不关闭Origin校验来绕过 |
| 人物列表为空 | 正式目录是否导入、人物和兴趣是否启用 | 不以演示数据假装真实请求成功 |
| 图片失效 | 媒体卷、文件权限、数据库关联、删除状态 | 不把私人媒体目录整个设为公网静态目录 |
| 重启后数据少了 | 是否误连了新库/新卷、部署目录和Compose项目名是否改变 | 不继续初始化覆盖 |
| 备份显示成功但不能恢复 | 密钥是否对应、完整性、媒体与最新注销回执、恢复目标 | 不覆盖在线业务库试错 |
| 手机能开电脑不能，或反之 | DNS缓存、网络、证书、访问口令缓存 | 不直接认定全部地区已通过 |

## 私有GitHub仓库附录

如果 `git clone https://github.com/jasperlvv/InRole.git` 提示认证，不把Token写进命令URL。

**位置：【服务器终端 / root】**

```bash
install -d -m 0700 /root/.ssh
ssh-keygen -t ed25519 -f /root/.ssh/inrole_github -C inrole-readonly-deploy
cat /root/.ssh/inrole_github.pub
```

如文件已经存在，保留原密钥；不要覆盖。为方便无人值守拉取，这把只读部署密钥可不设口令，但必须限制到单个仓库，不授予写权限。

**位置：【网页 / GitHub → jasperlvv/InRole → Settings → Deploy keys】**

1. 点击 `Add deploy key`。
2. Title填 `inrole-server-readonly`。
3. Key粘贴刚显示的公钥一行。
4. 不勾选 `Allow write access`。
5. 保存。

**位置：【服务器终端 / root】**

首次连接GitHub时，核对GitHub官方主机指纹，不使用关闭主机校验的参数：

```bash
ssh -i /root/.ssh/inrole_github -o IdentitiesOnly=yes -T git@github.com
```

成功提示身份已认证但不提供shell是正常的。然后：

```bash
git -c core.sshCommand='ssh -i /root/.ssh/inrole_github -o IdentitiesOnly=yes' clone git@github.com:jasperlvv/InRole.git /opt/inrole
cd /opt/inrole
git config core.sshCommand 'ssh -i /root/.ssh/inrole_github -o IdentitiesOnly=yes'
```

回到第9步核对并固定发布提交。部署密钥与Windows连接服务器的密钥是不同用途，不能混用公钥文件。官方说明：[Deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)、[GitHub SSH指纹](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)。

## 收尾记录模板

```text
域名：inrole.net
服务器地域/系统/规格：
部署日期（北京时间）：
Git完整提交号：
镜像标签和ID：
数据库迁移结果：
正式人物数量、头像检查结果：
开场内容数量、发布账号：
管理员ID（不写密码）：
电脑/手机/大陆/海外检查记录：
备份日期与异机位置：
恢复演练结果：
注销回执同步与告警结果：
公开运营与隐私信息确认：
未完成项：
```

**指南制作与GitHub同步本身不表示已经购买资源、修改DNS、连接服务器或执行正式部署。**
