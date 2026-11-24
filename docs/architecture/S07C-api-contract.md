# S07C 服务端访问与 API 约定 V1

日期：2026-11-24。已接通人物只读链路；真实注册、登录、改密和业务写入仍在 S08 及后续任务实现。

## 入口与数据来源

```text
/live/people → LivePeople → databasePeopleReader → /api/v1/people
  → readRoute → authorize → 人物服务 → server-only Prisma → PostgreSQL
```

- `/` 及原有页面继续是有明确标记的演示预览；`/demo` 跳转到演示首页。演示页面归入 `src/app/(demo)/`，由该路由组提供 UIProvider，原网址保持可用。
- `/live/people` 是第一个真实页面，只使用 `src/data/people-api.ts` 真实适配器。根布局仅保留外观偏好；真实页面不挂载演示账号、内容补齐或每日演示通宝逻辑。
- 不能根据请求成功与否自动选择数据源。真实空库显示空列表，真实请求失败显示错误和重试，绝不调用示例数据兜底，也不自动把真实写操作切到浏览器存储。
- `src/server/` 全部使用 `server-only`。只有 `database.ts` 创建运行连接，只有服务端业务层读 ORM；客户端只能导入 DTO 类型或网络适配器。浏览器不持有数据库连接、迁移连接或密码哈希。
- 后续每个模块分别增加真实服务和网络适配器，通过独立的真实页面验收后再替换入口。演示登录不产生真实会话，演示数据不升级或认领真实账号。

## 本步端点

| 请求 | 权限 | 参数与返回 |
| --- | --- | --- |
| `GET /api/v1/people` | 游客可读 | q、interest、limit、cursor；只返回启用人物及启用分类 |
| `GET /api/v1/people/{personId}` | 游客可读 | 稳定人物 slug；停用与不存在均返回 404 |
| `GET /api/v1/me` | 真实有效会话 | 不接收 userId 等参数；只返回本人的公开资料与引导状态 |
| `GET /api/v1/admin/people` | 真实管理员会话 | 同人物列表查询；当前仅作为管理只读入口，不含新增、修改或审核 |

支持 HEAD 和 OPTIONS。POST/PUT/PATCH/DELETE 均为 405，不以 200 冒充写入成功。不开放跨站 CORS，不发布会话签发或数据库调试端点。

人物 DTO 为 `{id,name,aliases,bio,interest:{id,name},avatarUrl}`。只允许已有本地人物静态头像路径；云媒体访问规则后续实现。私有端点不原样返回 ORM User，不返回密码、哈希、角色声明、会话 token 或钱包。

## 参数和分页

- 对列表显式白名单校验参数；未知、重复、格式不符的参数返回 400。
- q 去首尾空格后最多 80 个字符，匹配姓名/简介或完整别名；这是第一版只读查询，不是最终推荐或搜索算法。interest 是 1～64 位小写字母、数字、连字符的分类 ID。
- limit 默认 20，允许 1～50 的整数。使用 `id ASC` 的稳定 keyset 分页，取 limit+1 判断 hasMore，不做 offset 深翻页。
- cursor 是有版本、资源名、末条 id 和筛选摘要的 base64url JSON；不可跨筛选复用。不把游标作为权限凭据，篡改游标不会扩大公开范围。人物改名不改变 id 排序。
- 响应 `meta.page = {limit,hasMore,nextCursor}`；最后一页 nextCursor=null。不伪造总数。
- 其他资源后续按其列表需求使用 createdAt+id 等稳定联合游标，不能把人物 ID 游标复用于帖子列表。

## 响应与错误

```json
{
  "ok": true,
  "data": [],
  "meta": {
    "requestId": "服务器生成的 UUID",
    "source": "database",
    "page": { "limit": 20, "hasMore": false, "nextCursor": null }
  }
}
```

```json
{
  "ok": false,
  "error": { "code": "SERVICE_UNAVAILABLE", "message": "数据服务暂时不可用，请稍后重试。" },
  "meta": { "requestId": "服务器生成的 UUID" }
}
```

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | BAD_REQUEST | 参数、游标或输入不正确；可含字段错误 fields |
| 401 | UNAUTHENTICATED | 缺少、篡改、过期、撤销或旧版本会话 |
| 403 | FORBIDDEN | 账号受限、缺少管理员权限或写入来源不可信 |
| 404 | NOT_FOUND | 资源不存在或不可公开访问 |
| 405 | METHOD_NOT_ALLOWED | 此端点不接受该方法，附 Allow |
| 409 | CONFLICT | 唯一键冲突；未来同幂等键不同参数也使用此状态 |
| 429 | RATE_LIMITED | 后续写入端点接入真实限流时使用，本步不声称已完成限流 |
| 503 | SERVICE_UNAVAILABLE | 缺少配置、数据库断连、库账号权限不足或迁移不匹配；附 Retry-After: 5 |
| 500 | INTERNAL_ERROR | 未分类服务错误 |

正常、空列表和错误均 `Cache-Control: no-store`，所有响应携带服务器生成的 X-Request-Id。JSON 不包含数据库连接、SQL、堆栈或 ORM 内部错误；日志只记 requestId 和分类。禁止以 catch 返回示例数据、余额或假成功。日期对外用 ISO 8601，BigInt 数量用十进制字符串，不能直接 JSON 序列化 BigInt。

## 统一授权

`authorization.ts` 的 authorize(public/user/admin) 是当前入口。私有读取从成熟库解密的 Cookie 中只取 v/token，数据库查询 token 的 SHA-256，验证有效期、撤销、authVersion、账号状态与所需角色。权限来自数据库，不信任查询参数、X-User-Id、客户端角色或演示登录。

无 Cookie 可直接 401；有会话但数据库不可用时 503，不能把无法校验视为已登录。普通账号访问管理员入口为 403；数据库连接账号缺少 schema 权限属于服务配置故障，返回 503，而不是把它误报为用户权限问题。

开发 Cookie 名 `inrole-dev-session`，生产为 `__Host-inrole-session`；签发、Secure/HttpOnly/SameSite、密码验证与限流在 S08 接入。S07C 只实现消费和验证入口，没有可用的真实登录界面。测试会话由验证脚本在临时测试库创建并在结束后销毁。

authorizeWrite 预留已登录写入入口，还会精确核对配置的 APP_ORIGIN。未来注册/登录等匿名写入也必须单独核对可信 Origin。每个写入服务还需验证目标可见性、所有权和业务约束；授权入口不能代替事务内校验。

## 幂等写入约定

本步没有业务写接口，不声称已经实现它们的重放处理。共享解析器提供幂等键格式校验，WriteRequest 的数据库唯一键已落库；实际事务在对应业务阶段接入。

1. 创建帖子、评论、投币和赠送等可重试操作携带 `Idempotency-Key`，格式为 16～100 位 ASCII 字母、数字、下划线或连字符。不同操作使用不同 scope，例如 `post.create.v1`、`coin.gift.v1`。
2. 服务端先鉴权，再规范化并校验输入，对受理后的规范参数计算 payloadHash；唯一范围为当前真实 userId+scope+key，不接受客户端指定作者。
3. 相同键与相同参数重放返回原结果；不同参数返回 409；进行中请求不返回虚构成功。请求记录与业务写入在同一事务提交，失败一起回滚。
4. 通宝记录和对应幂等结果不自动过期。重试不重复发币、扣款或新增流水；禁止在失败后换成演示钱包。
5. 点赞等有自然唯一键的状态操作另用唯一键确保最终状态。没有服务器幂等能力之前，前端按钮防抖不能当作持久化幂等。

本步依据项目随包 Next.js 16.4.6 的环境变量、data-security、route 和 cookies 文档实现，并以实际生产构建/HTTP/PostgreSQL 结果验收。
