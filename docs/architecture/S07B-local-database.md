# S07B 本地 PostgreSQL 与迁移

日期：2026-11-24。数据库基础已接通，页面账号注册仍待 S08。

2026-11-25更新：S08已完成真实认证，追加第三份auth_security迁移；当前33项CHECK、8个触发器。运行账号不再拥有凭据/会话DELETE权限。下面保留S07B初始配置说明，认证变量及新入口见[S08认证方案](S08-authentication.md)。

## 运行与目录

- PostgreSQL 17.12，使用 PostgreSQL 官方 Windows 下载页推荐的 EDB 二进制包。固定 SHA-256：`a2cd8a774389347b70be7748ac4a37ef43cb6ee539c5fc3e85ae264b15e4a04c`，解压前实际校验。
- 运行文件、数据库文件和本地运维凭据放在 `%LOCALAPPDATA%/InRole/postgresql-17/`，独立于代码仓库；下载缓存放在被 Git 忽略的 `.tmp/`。
- 仅监听 `127.0.0.1`，首次分配可用端口并保存；使用 SCRAM-SHA-256 和随机密码。没有安装系统服务或开放局域网数据库访问。
- `inrole_dev` 用于开发；`inrole_test` 保留为独立测试库。验证命令每次另建随机名称的 `inrole_verify_*` 空库，完成后只移除本次创建的验证库。
- `.env.local` 保存应用和迁移连接，不使用 `NEXT_PUBLIC_`，不上传 Git。真实值不放进命令行参数、API 响应或验证报告。

```powershell
cd C:\Users\27251\Desktop\666\inrole
npm.cmd run db:local:setup
npm.cmd run db:status
npm.cmd run verify:s07b
```

首次 setup 下载并校验官方软件，建库、执行迁移、应用运行账号权限并写本地变量；重复执行不清库、不重置数据。已有 `.env.local` 中的连接不同会报错并保留原值，不覆盖其他数据库的配置。

以后启动与停止：

```powershell
npm.cmd run db:local:start
npm.cmd run dev
```

```powershell
npm.cmd run db:local:stop
```

重启电脑后先 start；数据库文件保留，不要重新 initdb 或删除 data。迁移账号与数据库所有者不能当作网站运行账号使用。

## 迁移和权限

| 文件 | 内容 |
| --- | --- |
| `prisma/migrations/20261124000100_initial_schema/migration.sql` | 31 张业务表、枚举、外键、复合唯一键及索引 |
| `prisma/migrations/20261124000200_invariants/migration.sql` | 32 项 CHECK、6 个触发器、PUBLIC/已有 anon/authenticated 权限收紧 |
| `prisma/permissions.sql` | 按显式配置的应用角色授予最小权限，可重复应用 |

迁移文件使用事务，已执行文件不改写；后续改动增加新迁移。`db:migrate` 使用 `DIRECT_URL` 执行 `migrate deploy` 后应用权限；`DATABASE_URL` 只给应用使用。没有使用 `db push`、reset 或删除开发数据来规避问题。

`inrole_bootstrap` 仅供本机建库运维，凭据不交给网页；`inrole_migrator` 拥有项目数据库但不能创建角色或其他数据库；`inrole_app` 无 DDL、角色管理或提权能力，公共人物库只读。普通注册插入省略 role/status，使用数据库默认 USER/ACTIVE，应用角色不能指定或更新 role/status。

钱包只允许以默认 0 余额创建，不开放余额 UPDATE；通宝操作和流水目前只读。S12 才开放受控的事务/函数写入，不能先授予任意金融写权限。数据库账号是整个服务端使用的身份，尚无按最终用户隔离的 RLS；S07C/S08 的服务端授权仍不可省略。迁移账号也不应被公开接口调用。

## 数据边界

没有导入浏览器 localStorage、演示账号、帖子、密码或钱包。S07C 为人物只读链路另准备了明确的 `prisma/catalog.json`：3 位公共人物、3 个兴趣和头像署名，只有运行 `db:seed:catalog` 才添加到本地开发库；重复运行保留已有记录，测试库不做种子导入。

行级范围、唯一性、内容身份和账本不可改删已落库。跨表业务条件仍由后续事务实现，例如最多 3 个话题、2～4 个投票选项、发布后禁止追加选项、媒体数量/归属、余额与流水和操作金额一致。不能把本步 CHECK 测试当作 S10/S12 完整事务验收。

## 官方来源

- [PostgreSQL Windows 下载与 ZIP 分发](https://www.postgresql.org/download/windows/)
- [EDB 官方二进制下载](https://www.enterprisedb.com/download-postgresql-binaries)
- [本次软件包官方 SHA-256](https://get.enterprisedb.com/postgresql/postgresql-17.12-1-windows-x64-binaries.zip.sha256)
- Prisma 迁移命令以本项目锁定的 7.10.1 实际 CLI 验证为准，不混用其他主版本的新迁移格式。
