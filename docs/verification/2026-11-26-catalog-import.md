# 公共目录生产导入工具与验收

日期：2026-11-26。基线提交 `a11a884`。解决发布前的阻塞项“270 位人物没有生产导入工具”。

## 交付

| 文件 | 作用 |
| --- | --- |
| `scripts/db/catalog-pack.mjs` | 纯校验逻辑：结构、标识、名称、简介、兴趣引用、头像路径、署名完整性、重复检测；不连数据库 |
| `scripts/db/import-catalog.mjs` | 命令行：`--check` 只校验 / 默认演练 / `--apply --confirm-reviewed` 写入 |
| `scripts/db/verify-catalog-import.mjs` | 8 组集成验收：临时库、真实迁移、写入、幂等、拒绝路径 |
| `tests/catalog-pack.test.mjs` | 10 条规则测试 |
| `docs/release/公共目录数据包与导入.md` | 数据包格式、字段规则、270 位补齐步骤 |
| `package.json` | 新增 `db:import:catalog`、`verify:catalog` |

## 设计约束

- **只接受迁移拥有者**：目录写入需要 `DIRECT_URL`；应用角色执行会被拒绝，且事务回滚不留半条数据。
- **默认拒绝开发库**：`inrole_dev`、`inrole_test`、`inrole_verify_*` 需要显式 `--allow-development`；本机灌数据仍用 `db:seed:catalog`。
- **先演练后写入**：不带 `--apply` 只打印计划；`--apply` 必须同时给 `--confirm-reviewed`，并要求 `reviewedAt`/`reviewedBy`（写在包内或命令行声明）。
- **只增不改**：全部使用 `INSERT ... ON CONFLICT DO NOTHING`，管理后台改过的简介、头像、启用状态不会被覆盖；重跑同一数据包是幂等的。
- **单事务 + advisor lock**：整个导入一个事务，并发进程会被串行化；任一条失败全部回滚。
- **写后核对**：校验数据包内每个人物都在库中且都有署名。
- **回执**：`.tmp/catalog/import-<时间>.json` 记录目标库、数据包 sha256、审核人、各表增量；不含连接串。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run verify:catalog` | 8/8 场景通过 |
| `npm.cmd run test` | 57/57（新增 10 条数据包规则测试） |
| `npm.cmd run check` | 退出 0：lint、类型检查、57 项测试、生产构建 |

验收场景（全部在临时库上执行，结束后删除该库）：

1. 演练在已迁移但空库上给出正确计划，且不写入；
2. `--check` 不需要数据库即可通过；
3. 缺 `--confirm-reviewed` 或缺审核信息时拒绝，库保持为空；
4. 确认后写入 22 位人物、9 个兴趣、8 个话题、22 条署名和 22 条人物兴趣关联；
5. 重跑幂等，且不会覆盖管理员改过的简介；
6. 缺少署名的人物在写入前被拒绝，库不变；
7. 应用角色执行时因权限失败且不留部分数据；
8. 指向 `inrole_dev` 时被拒绝执行。

回执、目标库名、增量数字都在第 4 组场景中核对过。

## 现可导入的内容

`prisma/catalog.json`：22 位已核验人物、9 个兴趣、8 个话题、22 条头像署名（署名取自 `src/lib/portrait-sources.ts`）。正式库命令：

```bash
set -a; . /etc/inrole/migrate.env; set +a
cd /opt/inrole
npm run db:import:catalog -- --pack prisma/catalog.json
npm run db:import:catalog -- --pack prisma/catalog.json --apply --confirm-reviewed \
  --reviewed-at 2026-11-26 --reviewed-by 审核人
```

## 270 位人物仍缺什么

候选名单 `docs/release/人物扩充候选清单V2.md` 只有姓名与分组，工具会因缺简介、兴趣引用和署名而拒绝导入。补齐项：

1. 每个人物的英文短 id（稳定标识）；
2. 1–280 字简介，区分史实与演义/影视版本；
3. 兴趣归属（名单含体育、动漫，现有 9 个兴趣不够，需先在数据包 `interests` 中新增）；
4. 头像两条路：`public/people/<id>.webp` + `legacyAvatarPath`，或先留空显示首字占位、上线后用后台上传；
5. 每条头像的作品名、来源页、作者、许可证与许可证链接。

建议分批 50–100 位导入，每批先 `--check`、再隔离库演练、再写入正式库。

## 未验证与限制

- 未在你的阿里云正式库执行；本次只在本地临时库验证。
- 工具不写媒体文件、不删除人物、不修改已有行；下架与改名仍走管理后台并留审计。
- 270 位数据包尚未制作，本次只交付工具与格式；不能据此声称人物内容已完成。
- 头像授权判断是人工工作，工具只保证署名字段齐全，不判断授权是否充分。
