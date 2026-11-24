# InRole 开发约定

## 产品依据

- 当前计划：`docs/网页开发执行计划.md` V0.2；进度：`docs/进度清单.md`。
- 具体产品规则：`docs/product.md`；页面与访问权限：`docs/pages.md`。
- 用户最新指令优先。旧《开发执行手册.md》只作历史参考。
- 2026-11-24用户先指定本地开发，随后明确要求将现有代码同步到`https://github.com/jasperlvv/InRole`；云部署和CI仍后置。S07A选型依据见`docs/architecture/S07A-auth-and-runtime.md`，不得为邮箱模板改变ID密码规则。
- 按任务编号实施，完成当前任务的检查与记录后更新进度，不把后续任务标为完成。

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
- 不为简单样式编写镜像测试；认证、授权、幂等、钱包并发需有实质测试。

## 数据与交付

- 密码只存安全哈希；不在日志、localStorage、Git 或公开接口记录密码、秘密或私密数据。
- `.env*` 默认忽略，只有无真实值的 `.env.example` 可以提交。
- 数据迁移另建文件，不改写已执行的迁移，不删除数据规避错误。
- 普通账号不得修改他人内容、管理权限、余额或公共人物库。
- 保留已有工作，检查真实结果；未执行的检查写“未运行”。
- 记录验证日期、命令、结果与限制到 `docs/verification/`，给用户预览地址及验收步骤。
- 云账号未连接时如实说明，不声称已部署、已注册或已授权。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
