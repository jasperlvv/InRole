# S08A / S08B 真实认证

日期：2026-11-25。真实注册、登录、退出、改密与受保护的本人资料写入已接入。注册仍只有个人 ID 和密码，未增加邮箱、手机号或专属角色。

## 使用入口

| 网页 | 行为 |
| --- | --- |
| `/live/register` | 两项真实注册，成功后自动登录 |
| `/live/login` | 使用服务器验证的 ID 与密码登录 |
| `/live/me` | 查看真实账号、编辑本人昵称/简介、改密和退出 |
| `/live/onboarding` | 验证当前真实账号并展示欢迎入口；喜好持久化留待 S09，不伪造已完成状态 |
| `/live/people` | 人物真实查询，显示真实账号入口 |
| `/demo` 及原有社区网址 | 独立演示，不使用真实账号或钱包 |

真实认证回跳仅接受 `/live` 下安全的站内页面，拒绝外站、演示页和登录/注册/引导循环。不能用真实登录去认领旧演示 ID、帖子或余额。真实发帖、评分、通宝仍按原计划逐项接入。

## 本机配置

```powershell
npm.cmd run db:local:start
npm.cmd run db:migrate
npm.cmd run db:auth:setup
npm.cmd run dev
```

`db:auth:setup` 仅在被 Git 忽略的 `.env.local` 中补齐独立的随机 SESSION_PASSWORD、RATE_LIMIT_SECRET 和本机 APP_ORIGIN，保留已有有效值，不打印秘密。没有这些配置时认证返回 503，不使用固定密钥或内存替身。

开发库、保留测试库已应用第三份迁移 `20261125000100_auth_security`，旧迁移未修改。新增 Argon2id 格式 CHECK、账号身份不可改/版本不可回退及安全变更撤销会话触发器。当前结构为 31 张业务表、87 个索引、33 项 CHECK、8 个触发器。运行账号仍无建表、角色管理、任意余额写入权限；凭据和会话的 DELETE 权限已收回，清理只走受控运维账号。

APP_ORIGIN 必须是精确的网站来源，例如 `http://localhost:3000`，不能带路径或尾斜线。不依据客户端 Host、X-Forwarded-Host 推导可信来源。若在开发阶段用手机局域网网址登录，需把 APP_ORIGIN 显式配置为该开发网址，并让测试设备统一使用它；正式环境使用 HTTPS。

## 接口

| 接口 | 参数 | 成功行为 |
| --- | --- | --- |
| `POST /api/v1/auth/register` | handle、password | 201；原子创建账号、凭据、零余额钱包、会话并设置 Cookie |
| `POST /api/v1/auth/login` | handle、password | 200；校验真实哈希，签发新会话并替换当前浏览器同账号的旧会话 |
| `POST /api/v1/auth/logout` | 空对象 | 200；先撤销当前数据库会话，再清除 Cookie，可重试 |
| `POST /api/v1/auth/change-password` | oldPassword、newPassword | 200；验证旧密码、更新哈希、递增 authVersion、撤销所有旧会话并清除当前 Cookie |
| `GET /api/v1/me` | 无 | 本人的安全资料 DTO |
| `PATCH /api/v1/me` | displayName / bio，至少一项 | 从真实会话确定作者，事务内再次鉴权，只更新本人 |

继续使用 S07C 的统一响应、requestId 和 no-store。写入只接受 application/json、最多 2 KiB、严格字段白名单；超限 413、类型错误 415、其他输入错误 400。注册提交 email、role、userId、authorId 等额外字段会被拒绝，不静默采用客户端身份。实际帖子 authorId 的写入与归属验证仍在 S10 实现；本步的作者伪造验证针对已实现的本人资料和认证写入。

## ID 与密码

- 服务端 trim 并转小写归一化 ID，保留 3～20 位 ASCII 字母、数字、下划线规则。数据库格式 CHECK 和唯一索引最终处理并发冲突；不使用“先查询无重名”代替唯一约束。
- 密码按 Unicode 字符数验证 8～64 位，保留中文、空格和所有原始内容，不 trim、截断或改大小写。
- 使用已锁定的 `@node-rs/argon2`，Argon2id v19、m=19456 KiB、t=2、p=1、32 字节输出，库生成随机盐。类型定义中的算法/版本为 ambient const enum，服务端使用已核对的数值 2/1，实际存储结果由集成测试验证。
- 数据库只保存完整安全哈希，不保存明文或可逆密码；API DTO、日志、localStorage/sessionStorage 和草稿不包含密码。
- 不存在的 ID 与密码错误统一返回 401“ID 或密码错误”，不存在账号也执行同策略的 dummy hash 校验。登录被封禁账号同样拒绝，不暴露账号是否存在或被封禁。

注册在同一事务插入用户、哈希凭据、初始零钱包和会话，role/status 由数据库默认值产生。初始钱包不发放通宝；每日发币与真实账本在 S12 实现。写入中途失败会回滚整个账号事务，限流计数独立保留。

## Cookie 与会话

- 每次签发使用 32 字节随机 token。数据库只保存 SHA-256(token)，iron-session 加密 Cookie 中仅有 v/token。
- HttpOnly、SameSite=Lax、Path=/、无 Domain。开发 Cookie 名为 inrole-dev-session；生产使用 Secure 的 __Host-inrole-session。
- 服务器记录绝对有效期 7 天，Cookie 的 Max-Age 为 604740 秒，稍早于数据库期限。会话记录和判断使用 PostgreSQL 时间，不把客户端日期作为身份依据。
- 受保护的每次读取都校验数据库状态、过期、撤销和 authVersion，不从 Cookie 信任角色、余额或作者 ID。数据库不可用时拒绝操作。
- 退出仅撤销当前会话，其他设备可以继续登录；改密撤销该账号全部会话，要求所有设备重新登录。断连导致无法撤销时返回 503，不先清 Cookie 假报退出成功。

生产 Cookie 属性已通过真实生产服务 HTTP 响应核对。本机浏览器使用开发 Cookie；尚未部署真实 HTTPS 域名，不能把此项写成目标平台 HTTPS Cookie 已验收。

## 改密、封禁与并发

`authorizedTransaction` 是受保护写入入口：检查可信来源与 Cookie，按 userId 锁定账号行，再用最新数据库状态重新验证会话，随后执行写入。前置 authorizeWrite 不能代替这次事务内检查。

登录先校验哈希，再在账号行锁内复核当前哈希、版本与状态后创建会话。改密、退出、封禁和受保护写入采用一致的“账号行 → 会话”顺序，避免先前已校验的请求在撤销之后继续提交。

改密先核对旧密码；旧密码错误时不改变哈希、版本或会话。成功更新哈希并递增 authVersion 后，数据库触发器在同一事务撤销所有旧会话。并发两次使用同一旧会话改密，只有一次能成功；旧密码登录即使在改密前完成哈希校验，等待行锁后也不能使用旧快照签发新会话。

账号状态改变为 BANNED/CLOSED 时，数据库触发器递增版本并撤销旧会话。因此解除封禁不会让原 Cookie 恢复权限。封禁管理网页仍待 S15；本步通过测试库的受控管理员操作验证数据库行为。

## 多实例限流

计数使用 PostgreSQL RateLimitBucket 和带条件的原子 UPSERT，多个进程共用数据库与密钥。窗口时间取数据库时钟，事务内同时检查所有预算；不存在进程内 Map 兜底。正常与错误密码尝试均计数，数据库故障时拒绝认证。

| 操作 | 全服务预算 | 每个 ID / 真实账号预算 |
| --- | --- | --- |
| 注册 | 60 次/小时 | 归一化 ID 3 次/小时 |
| 登录 | 120 次/分钟 | 归一化 ID 8 次/15 分钟 |
| 改密 | 120 次/分钟 | 真实账号 5 次/15 分钟 |
| 本人资料修改 | 120 次/分钟 | 真实账号 30 次/15 分钟 |

超限返回 429 和基于窗口结束时间的 Retry-After。数据库只保存 scope、HMAC 后的 key、窗口与计数，不保存原始 ID/IP；RATE_LIMIT_SECRET 必须独立于 SESSION_PASSWORD。新全局窗口的首个获准请求最多清理 1000 个过期桶，完整的生产保留与维护策略在部署阶段配置。

默认不信任任何客户端转发 IP 头，以全服务+账号预算执行保守限流。只有在运维已确认入口代理会剥离并覆盖对应头时，才配置 TRUSTED_CLIENT_IP_HEADER，支持 x-real-ip、cf-connecting-ip、x-vercel-forwarded-for，并要求单个有效 IP。此配置是部署约定，应用不会自行证明请求来自代理；来源缺失/格式错误时返回 503。启用后额外限制注册 IP 10 次/小时、其他操作 IP 30 次/15 分钟。伪造普通 X-Forwarded-For 不能绕过默认账号限流。

同一部署的所有实例必须使用同一数据库、SESSION_PASSWORD、RATE_LIMIT_SECRET 和 APP_ORIGIN；不要每次冷启动重新生成密钥。原生 Argon2 与 pg 使用 Node Runtime，不能放到 Edge Runtime。Linux 原生二进制和真实托管网络仍需在 S17 验收。

## 验证与下一步

`npm.cmd run check` 验证规则、类型、lint、构建；`verify:s07b` 验证空库重建及 16 项数据库约束；`verify:s07c` 验证已有读取入口；`verify:s08` 在新建临时库中启动两个真实 Next 生产进程，执行 24 组真实 HTTP/数据库认证场景，结束后停止进程并清理自己的测试库。没有导入演示账号、帖子或钱包。

浏览器已验证本机真实注册、自动登录、资料持久化、错误密码、正确密码、退出与游客私有页拒绝。改密与竞态的证据来自真实 HTTP/PostgreSQL 集成验证，浏览器未自动提交改密表单。

下一步 S09 完成真实喜好持久化、引导中断恢复、统一已登录跳转与其他模块权限接入。账号恢复在 S17 公开发布前实现；当前没有虚假的邮箱或找回入口。

依据：[PostgreSQL 17 原子 UPSERT](https://www.postgresql.org/docs/17/sql-insert.html)、[OWASP 认证与登录限流](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)、[OWASP 会话管理](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)，以及本项目随包 Next.js 16.4.6 的认证、Route Handler、cookies 文档。验证记录见 `docs/verification/S08.md`。
