# S07A 认证与运行环境决策

日期：2026-11-24。用户决定先本地开发，Git/GitHub、CI及云托管配置后置。S07A不依赖这些准备任务完成。

## 决定

采用Next.js Node.js Runtime、PostgreSQL、Prisma + pg adapter、iron-session和Argon2id。账号注册与校验由应用服务端实现；会话Cookie加密交给成熟库，撤销状态由数据库记录控制。

产品注册仍只有唯一个人ID和密码，不新增邮箱/手机号，不生成伪邮箱，不自制Cookie加密或密码哈希算法。

| 组件 | 锁定方式 | 作用 |
| --- | --- | --- |
| Next.js / React / TypeScript | 保留16.4.6 / 19.3.1 / 5.9.3 | 复用已有网页工程 |
| Prisma CLI、Client、adapter-pg | 7.10.1，三者一致 | 模型、客户端与PostgreSQL访问 |
| pg | 8.23.1 | PostgreSQL驱动 |
| iron-session | 9.1.1 | 兼容异步cookies()的成熟加密Cookie会话库 |
| @node-rs/argon2 | 2.2.2 | Argon2id，m=19456KiB、t=2、p=1、32字节输出，随机盐 |
| effect | @prisma/config下覆盖为3.22.5 | 修复旧间接依赖的已知ReDoS公告，保留CLI兼容验证 |
| Node | 本地现有26.13.1；部署候选主版本24，.nvmrc记录24 | 使用本机附带24.22.1做额外生产构建验证，未更改系统安装 |

S07A在项目中安装并锁定依赖，生成可重建的Prisma Client；生成目录忽略Git和ESLint，typecheck/build先生成，避免换电脑缺失生成文件。迁移连接与真实业务认证在后续接入。

## 候选比较

| 方案 | 和产品要求的关系 | 本次决定 |
| --- | --- | --- |
| Supabase Auth邮箱模板 | 不满足仅ID+密码，不能以虚构邮箱绕过 | 不采用；数据库仍可用PostgreSQL托管 |
| Better Auth普通username插件 | 官方注册示例依然要求email | 不直接套用，不宣称整个库永远不支持其他扩展 |
| Auth.js Credentials | 能校验任意凭据，注册/密码等仍需服务端补充，官方说明该提供者使用JWT会话 | 保留为比较方案，本次不引入其适配层 |
| iron-session + 独立凭据与数据库会话记录 | 不要求邮箱，库处理Cookie，加上服务器记录可撤销 | 本次采用 |

iron-session本身是会话库，不是完整账号系统。注册、登录限流、数据库会话查询、权限、改密和恢复能力必须在S08及后续落实，不能仅安装库后声称真实认证完成。

## 兼容验证方法

- `tests/auth-compat.test.mjs`用真实库验证哈希、盐、Unicode、Cookie完整性、密钥轮换与会话记录拒绝策略。
- `scripts/s07a/verify-next.mjs`在`.tmp/`生成独立Next.js fixture并执行生产构建，绑定127.0.0.1临时端口，用HTTP请求验证两字段输入、异步cookies()、原生Argon2、Prisma生成客户端与pg适配器加载、来源拒绝、Cookie往返及撤销后重放。
- fixture的会话记录使用内存Map，仅用于证明库与Next.js集成和撤销策略。没有连接PostgreSQL，不是S08的真实账号实现，不由主网站路由暴露。
- fixture使用显式配置的可信Origin，避免框架内部URL与用户访问地址不同导致错误拒绝。生产环境的可信Origin由配置决定，不信任客户端任意Host/转发头。
- Prisma模型格式、验证和生成不需要数据库。SQL差异预览必须实际产出并检查，CLI退出码本身不足以证明成功。

## 部署边界

Node.js Runtime用于密码原生库和pg连接，不将这些功能放到Edge Runtime。后续数据库运行连接采用适合托管方式的连接池，迁移连接单独配置。原生Argon2平台二进制必须随部署保留并在目标Linux环境做实际验证。

Windows上的生产构建与HTTP测试证明本地Node兼容性；它们不证明Linux二进制、云平台网络、TLS、存储或真实PostgreSQL事务已验收。Vercel/Supabase仍是后续可选托管，不在本步创建账号、购买资源或发布。

本机暂无可用的docker/psql命令及已确认数据库连接。S07B下一步先准备本地PostgreSQL开发/测试库，执行迁移、补充CHECK/权限并验证连接。不以SQLite或内存替身冒充PostgreSQL验收。

## 官方依据

- [Next.js认证与会话库](https://nextjs.org/docs/app/guides/authentication)
- [iron-session API与App Router](https://github.com/vvo/iron-session)
- [Argon2库说明](https://raw.githubusercontent.com/napi-rs/node-rs/main/packages/argon2/README.md)
- [Auth.js Credentials约束](https://authjs.dev/reference/core/providers/credentials)
- [Better Auth Username参数](https://better-auth.com/docs/plugins/username)
- [Prisma Client v7与驱动适配器](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction)
- [Prisma系统要求](https://www.prisma.io/docs/orm/v7/reference/system-requirements)
- [Vercel Node版本](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Effect安全公告及修复版本](https://github.com/advisories/GHSA-7589-6fvf-x4pw)

后续实现以本次已验证并锁定的实际包API为准。官方示例中的邮箱字段不是InRole的产品要求。
