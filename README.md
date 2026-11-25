# 入戏 InRole

2026-11-26 GitHub同步：当前网站候选版及验收材料提交至仓库默认分支 `main`；本轮lint、类型检查、47项测试和生产构建通过。见[同步验证记录](docs/verification/2026-11-26-github-sync.md)。代码托管与正式网站部署分别推进，以下早期阶段描述保留为历史。

网站发布候选`0.2.0-rc.1`已完成本轮代码与HTTP/数据库验收，根路径为真实社区，演示为`/demo`。新增屏蔽、注销、联系/政策与部署材料；本机候选[http://localhost:3110/](http://localhost:3110/)。见[本轮验收](docs/verification/R01-release-candidate.md)、[人工检查清单](docs/release/手机电脑人工检查清单.md)和[部署/备份/回滚](deploy/README.md)。真实设备、Linux容器及正式公网未验收，旧记录以下保留。

当前路线：[网站直接上线三步方案](docs/InRole网站直接上线三步方案.md)（2026-11-25最新决定：取消内测，先上线国内外可访问的网站，移动端后置）。以下“先内测/暂不上线”的内容保留为历史。

后续执行路线：[InRole收尾与网站、iOS、安卓发布指南](docs/InRole收尾与网站及移动端发布指南.md)（2026-11-25，22步；按用户选择先小范围内测，再决定首发地区）。这是后续计划，实际完成情况以进度和验收记录为准。

最新进度（2026-11-25）：两个失败对话已与本地代码对齐，S01～S15本地已实现与验收；社区集成最新26组通过。S16最后浏览器回归中断，仍待收尾；S17/S18按用户选择暂缓。后续停用浏览器/电脑自动化链路，详见[统一接续记录](docs/verification/2026-11-25-conversation-handoff.md)和[当前进度](docs/进度清单.md)。下方早期阶段描述只作历史参考。

2026-11-25补充：S12～S15已接回原版主要界面（侧栏/手机底栏、帖子与人物卡、热搜、钱包、个人中心），公共目录22位人物；24组社区集成与46项规则、lint/类型/构建通过。详见[本轮验收](docs/verification/S12-S15-stage.md)。真实入口http://localhost:3100/live ，原演示入口保持独立。


2026-11-25本地接续：真实社区入口 [http://localhost:3100/live](http://localhost:3100/live)，运行 `npm run preview:local`（需先 `npm run db:local:start`、`npm run db:migrate`、`npm run build`）。S09～S15已接真实数据；本轮检查及限制见[验收记录](docs/verification/S09-S16.md)。用户选择暂不上线，S17/S18后置。以下旧记录保留为历史。

换个身份，说你的话。面向手机、平板和电脑的角色扮演社区。

InRole is a fun and free online community where users can be anyone they want.

## 当前阶段

已完成S01～S06：工程基础、手机/电脑响应式页面和四大模块可操作前端。已应用11月23日最新提供的古人看手机Logo，覆盖网页品牌、浏览器图标和Apple主屏图标。

原有社区页面的帖子、评论、点赞、评价、通宝继续使用浏览器演示数据，刷新后保留。S07A～S07C 已完成数据库与服务端基础；S08A/S08B 已接通[真实注册](http://localhost:3000/live/register)、[真实登录](http://localhost:3000/live/login)、退出、改密和[本人账号设置](http://localhost:3000/live/me)。[真实人物页](http://localhost:3000/live/people)通过 API 读取本机 PostgreSQL；帖子和通宝真实业务仍待后续阶段。

`/demo` 进入原有演示预览，`/live/people` 进入真实只读预览，两者不混用账号或数据。真实请求失败显示错误和重试，不回退演示数据。

## 如何体验

1. 首页可切推荐/最新、筛选话题、搜索帖子，人物与@账号分别进入不同主页。
2. 游客可点击帖子上的评论数量直接阅读评论；点击写评论、点赞或发言才会进入登录，可切到注册。
3. 注册只输入个人ID（3～20位字母、数字、下划线）和8～64字符的演示密码，然后选1～5项喜好或跳过。
4. 登录后点“去发言”：独立选人物、写最多500字、带0～3个话题，可添加图片/视频、单选投票和原帖引用；有其他内容时可不写正文。关闭后可继续草稿。帖子详情先看评论，点击“写评论”后再选人物，换人物不影响旧内容。
5. 热搜可切帖子/话题榜和24小时/7天，点击排名进入对应内容；话题页可带上该话题发帖。
6. 人物页可评分、写评价、修改已有评分、投通宝；每日首次访问领取模拟10币，钱包能核对余额与流水。评分、今日投币、累计投币分别排名。
7. 个人中心查看自己的帖子/评论/点赞/评价，编辑昵称、简介与喜好；公开主页展示公开资料和帖子。退出后所有写操作重新要求登录。
8. 广场顶部搜索关键词；人物页、人物选择器或个人中心可进入“人物申请”，填名称和介绍，或只粘贴百科网址；申请仅保存在本机待审核列表。
9. 帖子分享可复制文案到微信/QQ，也可调用设备系统分享。此阶段链接和附件仅本机可读，不会把内容自动发送到第三方。
10. 点击电脑左下角头像（手机右上角头像）打开账号菜单，可进入个人中心、公开主页、钱包、喜好、设置及退出；游客也能调整界面外观。
11. 全站使用统一墨蓝色强调，浅色搭配灰白背景，深色搭配炭灰背景；头像占位与评分同步使用这套配色。[设置](http://localhost:3000/settings)提供浅色/深色/跟随系统、简体中文/English、四档字体大小、舒适/紧凑密度和减少动画。旧的多色选择会自动归一为墨蓝色，保留其他偏好。修改即时生效并保存在当前浏览器，刷新、退出后保留；恢复界面默认不会删除账号或社区数据。帖子、评论、投票和简介保持原文。
12. 已赞爱心在深浅模式下均为红色。通宝使用圆形方孔钱图标，与普通文字、图标和卡片共用中性灰阶；帖子工具栏可给实际贴主@账号赠送，输入正整数或选快捷数量，双方余额和流水同步更新。不能自赠、不能超余额；帖子显示累计收到数量，删除原帖后流水保留。人物投币继续单独统计，不计入贴主收入。
13. 人物库现有22位：新增苏轼、曹操、诸葛亮、武则天、李清照、达·芬奇、莎士比亚、贝多芬、达尔文、居里夫人。全部人物使用本地网络头像，来源和署名见[头像来源](http://localhost:3000/people/credits)。新增10条纯文字演示帖子与20条接话评论，不新增视频。旧浏览器首次打开会补齐这批示例，保留已有发言、修改、删除、互动和钱包；补齐后刷新不重复，后续删除的新示例不会重新出现。

图片支持JPG/PNG/WebP/GIF，最多6张，每张5MB；视频支持MP4/WebM，最多1个30MB，与图片分开发帖。文件存IndexedDB，帖子、附件元数据、投票、申请和草稿存localStorage；浏览器清理存储后附件可能不可用。真实云上传、审核、清理策略及公开访问在后端阶段实现。

人物头像已支持统一图片与失败回退；当前可按[头像说明](public/people/README.md)配置素材。真实管理员上传界面仍在S15接入，普通用户不能自行替换公共人物头像。

**原有演示表单不保存、不验证密码，演示 ID 只在本机浏览器内检查重复，请勿填写常用密码。** 演示资料、互动和草稿保存在 localStorage，演示会话放 sessionStorage，通宝无现实价值。真实账号请使用 `/live/register` 和 `/live/login`，通过受控 Cookie 与数据库会话登录，密码仅存 Argon2id 哈希；不认领演示账号、帖子或余额。

个人中心提供需确认的示例内容重置与上次备份恢复入口，重置会影响本机各演示账号共享的内容；账号资料独立保留。存储失败显示错误，不假报成功；损坏内容不会被静默覆盖。举报仅保存本机记录，不会发送给平台。

## 运行

需要 Node.js >=22.18.0（项目测试使用原生TypeScript类型擦除；本机26.13.1已验证）。在本项目目录执行：

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器访问 http://localhost:3000。终端按 Ctrl+C 停止；若3000被占用，Next.js会提示实际端口。

仅体验演示时不需要数据库。真实人物页需要先启动本地 PostgreSQL；`.env.example`只有说明，真实配置放在 Git 忽略的`.env.local`，不要提交真实值。

首次本机数据库配置（Windows，建议使用 `.nvmrc` 的 Node 24 或已验证的本机 Node 26）：

```powershell
npm.cmd run db:local:setup
npm.cmd run db:auth:setup
npm.cmd run db:seed:catalog
```

setup 自动下载并校验官方 PostgreSQL 17.12、创建独立开发/测试库、执行版本化迁移和权限配置。catalog 只添加 3 位公共人物及兴趣/署名，不导入浏览器演示账号、帖子或钱包。重启电脑后先运行 `npm.cmd run db:local:start`，再运行 `npm.cmd run dev`。停止数据库用 `npm.cmd run db:local:stop`；数据保存在 `%LOCALAPPDATA%/InRole/postgresql-17/`。

`npm.cmd run db:migrate` 应用新增迁移；`db:status` 检查状态；`verify:s07b` 在全新临时库验收重建和 16 项数据库测试。生产构建完成后执行 `verify:s07c` 验收 13 组读取接口场景，`verify:s08` 验收 24 组真实认证场景，后者用两个独立进程验证共享限流、会话撤销和并发。它们只清理自己新建的验证库，不清空开发库。详见[数据库操作](docs/architecture/S07B-local-database.md)、[读取接口规则](docs/architecture/S07C-api-contract.md)和[认证配置](docs/architecture/S08-authentication.md)。

已有数据库接入 S08 时运行 `db:migrate` 和 `db:auth:setup`。所有真实写入精确校验 `.env.local` 的 APP_ORIGIN；默认 `http://localhost:3000`。会话与限流密钥在本机生成，多个部署实例必须共用持久化的同一套配置，不能冷启动时随机重建。限流默认不相信客户端转发 IP 头。

开发服务器监听0.0.0.0，同一局域网的手机可用终端显示的局域网地址访问；是否可连接取决于路由和防火墙。仅用作开发预览，正式部署在S17进行。

## 检查与生产启动

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run start
```

`npm.cmd run check`依次运行lint、typecheck、test、build。`start`运行已生成的生产版本，不能与占用同一端口的dev同时启动。

## 结构

```text
src/app/(demo)/          原有演示页面与独立演示Provider，原网址保留
src/app/live/            逐项接入的真实页面
src/app/api/v1/          真实API入口
src/server/              统一授权、业务查询、DTO及数据库连接，仅服务端
src/data/                真实页面使用的网络适配器
src/components/          首页、表单、导航及公共组件
src/lib/                 示例数据、账号演示状态和输入规则
tests/                   账号规则、内容身份、权限、热度、评分和通宝模型测试
public/                  静态资源
docs/product.md          产品规则V0.2
docs/pages.md            页面清单与权限
docs/网页开发执行计划.md  当前18步计划
docs/进度清单.md          实际进度
docs/verification/       检查记录
AGENTS.md                后续开发约定
```

## 下一步

S01～S08 已完成：31 张业务表、三份版本化迁移、真实人物查询与账号认证。注册仅 ID+密码；旧密码改密后全部会话撤销；封禁与解除封禁都不会使已撤销 Cookie 恢复。注册后的欢迎页保留引导入口，喜好尚未伪造完成。下一步 S09 接真实喜好持久化、引导状态和统一跳转。代码托管仓库为[GitHub · jasperlvv/InRole](https://github.com/jasperlvv/InRole)，云部署和 CI 仍后置。详见[S08验收](docs/verification/S08.md)。

新增命令：`npm.cmd run db:validate`验证模型，`npm.cmd run db:generate`生成可重建客户端，`npm.cmd run verify:s07a`在本机临时目录运行独立生产构建/HTTP兼容验证。后者不会接入真实数据库或替换当前演示账号。当前规则测试46项，包含7项既有认证库兼容测试；真实认证另外通过verify:s08验收。生成目录`src/generated/prisma/`不手工编辑、不上传Git；typecheck/build会先生成。

基础验收见[S04～S06记录](docs/verification/S04-S06.md)，新增功能见[前端扩展](docs/verification/2026-11-23-frontend.md)、[主题及语言验收](docs/verification/2026-11-23-appearance.md)、[统一配色验收](docs/verification/2026-11-23-unified-palette.md)、[通宝赠送与红心验收](docs/verification/2026-11-23-tongbao.md)及[人物与内容扩充](docs/verification/2026-11-23-demo-expansion.md)。当前 46 项规则测试、16 项数据库测试、13 组读取接口验证、24 组认证集成验证及生产构建均通过。浏览器实测了本机真实注册、自动登录、资料持久化、错误密码、正确密码和退出；真实手机、正式 HTTPS、跨浏览器及完整业务写入仍待后续验收。

遵守V0.2：游客只浏览；互动需登录；每次发言独立选公共人物；不用邮箱注册模板。
