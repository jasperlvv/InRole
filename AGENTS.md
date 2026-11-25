# InRole 开发约定

## 网站候选版0.2.0-rc.1（2026-11-25）

- 三步方案第1步的代码和发布材料已接续，见`docs/verification/R01-release-candidate.md`。根路径`/`真实社区、`/demo`独立演示，本轮候选本机端口3110；不要误用旧3100/3101作为新候选证据。
- 新增屏蔽与注销，第9份迁移已应用开发库并确认主要数据行数不变。当前47项本地测试、16项数据库、13组读取、24组认证、31组社区集成通过；素材22位人物本地文件存在。
- 原ID摘要预留、CLOSED不可重新启用；注销清理密码/会话/个人内容，结算账目保持不可变与去标识关联。受控擦除例外不能扩大为允许应用直接修改身份/账本。屏蔽按实际账号，查询与受保护互动均须遵循，不得仅客户端隐藏。
- `deploy/`是可审查材料，Linux容器、正式TLS、备份/媒体恢复运行与跨网络尚未验收；S16真实设备人工项未做，仍不整项标完成。后续不重复从旧计划重写已验收业务。

## 最新目标：网站直接上线（2026-11-25）

- 用户最新要求取消小范围内测，直接推进网站上线，要求中国大陆与海外可访问；移动端后置。当前执行方案为`docs/InRole网站直接上线三步方案.md`，优先于旧22步指南及“暂不上线/先内测”的历史记录。
- 三步为：代码收尾、确定域名与云资源、部署并验收公开网站。S18招募真人内测不再是本次发布前置；核心测试、真实设备检查、备份恢复和适用发布要求仍保留。S16、部署与跨网络验收只按实际证据更新，不提前记完成。
- 香港单节点与.com为优先评估建议，尚未购买或确定资源；域名不等于连通性。取得大陆/海外真实网络证据才能声称相应访问已验收，缺少位置如实记录。公开社区适用要求与现有ID密码规则有未决点时明确提出，不擅改注册规则，不将境外托管当作免责依据。
- 本轮为方案编写，不代表已购买、部署或授权任意收费操作；未来执行按具体任务和已有授权推进。原浏览器/电脑自动化停用限制继续有效。

## 2026-11-25 对话接续与工具限制

- 用户要求对齐两个失败对话的进度，并避免再次触发截图中的调用错误。统一接续记录：`docs/verification/2026-11-25-conversation-handoff.md`；后续先读该记录与进度清单顶部，不从旧对话重复开发。
- 后续 InRole 开发停用 `cua_repl`、computer-use/`@oai/sky` 及通过 `node_repl` 驱动的浏览器/桌面自动化，不自动重试或更换 UI 自动化入口规避限制。代码检查、构建与真实 HTTP/PostgreSQL 验证使用本地命令；Node.js 命令行不受此限制。需要 UI 验收时提供人工步骤，未实测项保留未完成。
- 以上是保守避让措施，不代表已查明某个 UI 工具导致错误。两个旧对话的 `function_call_output requires call_id ...` 属于 Codex 请求/会话协议错误记录；有的失败轮次没有执行任何工具，不能声称修改 InRole 已修复客户端传输问题，也不能保证平台错误永不再现。
- S01～S15 本地实现已接续；最新社区集成结果是26组通过。S16最后一轮浏览器回归中断，重试按钮修复后的浏览器复验、真实手机/慢网仍待收尾，禁止把S16整项勾选完成。发布安排以顶部最新目标为准。

## 产品依据

- 当前计划：`docs/网页开发执行计划.md` V0.2；进度：`docs/进度清单.md`。
- 具体产品规则：`docs/product.md`；页面与访问权限：`docs/pages.md`。
- 用户最新指令优先。旧《开发执行手册.md》只作历史参考。
- 2026-11-24用户先指定本地开发，随后明确要求将现有代码同步到`https://github.com/jasperlvv/InRole`；云部署和CI仍后置。S07A选型依据见`docs/architecture/S07A-auth-and-runtime.md`，不得为邮箱模板改变ID密码规则。
- 按任务编号实施，完成当前任务的检查与记录后更新进度，不把后续任务标为完成。
- S07A/B/C、S08A/B及S09～S15本地业务已验收；S16自动与部分浏览器通过，真实手机/慢网等待验收。用户2026-11-25选择先完成本地版、暂不上线，S17/S18后置。真实入口http://localhost:3100/live；本轮范围与限制见docs/verification/S09-S16.md。真实认证规则见`docs/architecture/S08-authentication.md`，读取接口见`docs/architecture/S07C-api-contract.md`，本机库操作见`docs/architecture/S07B-local-database.md`。

- S12～S15主要真实界面现已复用原版设计，见docs/verification/S12-S15-stage.md；新增24组社区集成（含流水失败/审计失败回滚），公共库22位人物。复用展示组件不调用演示账号或模拟发币。

## 必须保持的规则

- 手机、平板、电脑共用响应式网页。游客可浏览，所有互动必须登录。
- 注册只有唯一个人 ID 和密码，不要求邮箱或手机号；注册后进入喜好引导。
- 人物来自公共库，每次发帖、评论独立选择，不创建或绑定用户专属角色。
- 发言保存实际作者和本次人物；换人物不得改变历史。公开展示“人物名称 · @个人ID”。
- 评分和人物投币面向公共人物；帖子赠送通宝计入实际作者@账号，不能自赠；点赞面向帖子，已赞爱心使用红色。通宝按账号与北京时间日期唯一发放。
- 兴趣偏好、实际用户与扮演人物是三类不同数据。

## 技术与验证

- Next.js App Router、TypeScript、Tailwind CSS，使用 npm 与 package-lock.json。
- 认证与数据库在 S07 接入；不预装邮箱认证模板，不伪造邮箱。浏览器不直接访问私有数据库。
- 现有 docs 必须保留，不在 inrole 中再套同名项目。
- 默认运行 `npm run lint`、`npm run typecheck`、`npm run build`；按改动补充必要验证。
- 依赖使用确定版本；更新依赖时同步锁文件和检查结果。
- 不依赖构建时下载外部字体；先使用本地系统字体。
- 页面使用语义元素、明确标签与键盘焦点，兼顾手机触控。
- 演示功能明确标识；真实模式失败不得回退为假数据或假成功。
- 原有演示归入`src/app/(demo)/`且原网址保留；`/live/people`先接真实人物。根布局不得挂载演示账号、内容补齐或模拟发币Provider。真实请求只能经`src/server/`统一授权/DTO及数据库入口。
- 真实认证使用`/live/login`、`/live/register`、`/live/me`，不向原演示页面签发或认领真实账号。注册成功保留未完成引导状态，S09接喜好持久化。
- 受保护写入必须在`authorizedTransaction`中按账号行锁重新检查数据库会话；仅调用前置`authorizeWrite`不足以防撤销/封禁竞态。改密、退出与其他写入遵循账号行→会话的锁顺序。
- 限流使用PostgreSQL原子共享计数，不用进程内Map兜底，不信任未配置的转发IP头；所有真实写入校验精确APP_ORIGIN。多实例共享同一套持久密钥配置。
- 不为简单样式编写镜像测试；认证、授权、幂等、钱包并发需有实质测试。

## 数据与交付

- 密码只存安全哈希；不在日志、localStorage、Git 或公开接口记录密码、秘密或私密数据。
- `.env*` 默认忽略，只有无真实值的 `.env.example` 可以提交。
- 数据迁移另建文件，不改写已执行的迁移，不删除数据规避错误。
- `prisma/migrations`已有三份真实执行的迁移，后续必须追加。`DATABASE_URL`使用受限应用账号，`DIRECT_URL`仅供迁移；通宝直接写权限保持关闭，仅通过claim_daily/spend_coins拥有者函数在已鉴权事务内变更；迁移目前8份。
- 普通账号不得修改他人内容、管理权限、余额或公共人物库。
- 保留已有工作，检查真实结果；未执行的检查写“未运行”。
- 记录验证日期、命令、结果与限制到 `docs/verification/`，给用户预览地址及验收步骤。
- 云账号未连接时如实说明，不声称已部署、已注册或已授权。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
