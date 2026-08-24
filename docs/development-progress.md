# 开发进度

## 0.4.0 收敛新增：日记、语言设置与小彩蛋

目标环境：staging（已发布）

当前状态：实现、人工验收、远端迁移与 staging 发布完成；待已登录账户开展业务复查

规格：`docs/0.4.0-writing-spaces-spec.md`  
计划：`docs/0.4.0-implementation-plan.md`

| 交付切片 | 状态 | 实现位置 | 验证层级 | 风险/偏差 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| 日记分类 | 已完成 | `migrations/0012_convergence.sql`、`src/server/entries.ts`、书桌模块 | 单元、Worker 集成、真实浏览器创建/刷新恢复、staging 迁移与结构复查 | 0011 的旧 CHECK 不接受日记，故以`writing_category`为权威列并保留旧列回滚镜像 | 收集 staging 反馈 |
| 设置与中英文 | 已完成 | `src/client/app/i18n.js`、`settings-feature.js`、标题页与时间服务 | 中英文即时切换、反向切换、刷新保持、动态时间文案、三档标题页、staging Worker 发布 | 当前只翻译应用文案，用户内容保持原文；新增语言需补词典 | 已登录账户复查英文语气 |
| 小彩蛋与里程碑 | 已完成 | `src/server/achievements.ts`、`achievements-feature.js`、`achievements`表 | 达成计算单元测试、幂等/账户隔离/导出/删除集成测试、浏览器首次解锁与刷新、staging 表结构验证 | 内容型条件只能在客户端解密后计算，服务端限制为固定键但不重复读取正文 | 已登录账户复查解锁节奏 |
| 房间与走廊灯光 | 已完成 | `src/client/game/scene-state.js`、scene runtime/renderer、room/doorway 配置、`styles.css` | 状态存储与配置集成测试；1024×720/1920×1080 开关、场景往返、刷新和布置模式浏览器验收；新壁灯资源上传 staging | 状态按当前设备保存，不进入账户导出；走廊关闭态使用独立洋红底色键素材，开启态与环境暖光分层 | 收集 staging 反馈 |
| 整体回归 | 已完成 | 全部本轮变更 | 40 单元 + 47 集成 + check + build；1024×720、1440×900、1920×1080 浏览器检查；staging D1 与 Worker 发布 | Access 边界已验证；本轮没有可用的已登录远端浏览器会话 | 已登录账户执行 staging 业务冒烟 |

### 本地收敛验收证据（2026-08-24）

- `npm test`：40/40 通过。
- `npm run test:integration`：47/47 通过。
- `npm run check`：通过。
- `npm run build`：Cloudflare Worker dry-run 通过，共读取 82 个静态资源。
- 真实浏览器确认标题页三项纵向入口在三档桌面尺寸无溢出，中英文即时/可逆切换并在刷新后保持。
- 真实浏览器创建`日记`纸页并刷新恢复，独立分类计数、编辑器选择、英文动态保存时间均正确。
- 小彩蛋从 5/8 更新为 6/8，首篇日记里程碑只解锁一次并在刷新后保留；控制台无 error/warn。
- 房间台灯与走廊壁灯分别完成开关视觉、动态中英文操作名称、`aria-pressed`、场景往返和刷新保持；1024×720 与 1920×1080 无溢出，布置模式未误触灯光。
- 0012 已应用于本地与 staging D1；production 未变更。

### staging 收敛发布证据（2026-08-24）

- 产品负责人明确授权将 0.4.0 收敛版本推送到远端 staging。
- Git：提交`55ce6deb53ea9579308ce25bdbd59893284b1a47`已存在于`origin/main`。
- 发布前备份：`.artifacts/staging-backups/before-0.4.0-convergence-2026-08-24.sql`，43,824 字节，SHA-256 `60B85C478BCFE3201F772524CF46A0E99C463DAA58859FAE6F2387654C1C9EBE`。
- 远端迁移：`0012_convergence.sql`成功执行 7 条语句；复查无待执行迁移。
- 结构验证：`journal_entries.writing_category`、`achievements`表以及两个新增索引均存在。
- Worker：`ithaca-journal-cloud-staging`版本`986d56f1-816a-4e0e-832d-18719d45849f`（版本号 13）。
- 静态资源：读取 82 个文件，上传 29 个新增或变更资源，包括走廊壁灯 OFF/ON 图层。
- 流量：部署`081a4b6f-82b9-407d-af8c-7f3fae7210e0`将 100% 流量指向新版本。
- Access：未登录访问首页、健康端点和壁灯资源均返回 302 并进入预期登录页；保护边界正常。
- staging：<https://ithaca-journal-cloud-staging.feiyut666.workers.dev>。
- production：未迁移、未部署。

## 0.4.0 写作空间重构（此前 staging 基线）

目标环境：staging  
当前状态：已完成  
规格：`docs/0.4.0-writing-spaces-spec.md`  
计划：`docs/0.4.0-implementation-plan.md`

| 交付切片 | 状态 | 实现位置 | 验证层级 | 风险/偏差 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| 规格与计划 | 已完成 | `docs/0.4.0-*.md`、Notion 根页面与 0.4.0 页面 | 文档审阅及发布回写完成 | 需求变化需同步两处文档 | 作为 0.4.0 发布基线 |
| 现状审计与基线 | 已完成 | migrations、server/client modules、tests | 34 单元 + 40 集成 + 类型检查通过 | Wrangler 日志目录在沙箱内提示 EPERM，但命令返回成功 | 保留基线供回归比较 |
| 纸页分类、来源与标签 | 已完成 | `migrations/0011_writing_spaces.sql`、`src/server/entries.ts`、`src/client/app/privacy-service.js` | 单元、Worker 集成、人工验收、staging 迁移通过 | 保持 0.3 载荷兼容；旧纸页迁移为碎片 | 观察 staging 数据兼容 |
| 书桌 | 已完成 | `src/client/app/workbench-feature.js`、`entries-feature.js`、`index.html`、`styles.css` | 浏览器分类、标签、保存、刷新和人工验收通过 | 0.4.0 仅承诺桌面端 | 收集 staging 反馈 |
| 公告板 | 已完成 | `src/client/app/topics-feature.js`、独立 `topics-view` | 建板、加碎片、保存布局、带回书桌和人工验收通过 | 保留现有拼图玩法，没有扩展新谜题 | 收集 staging 反馈 |
| 信箱 | 已完成 | `src/server/sent-letters.ts`、`src/client/app/mailbox-feature.js` | 回信、保存、寄出、寄件箱阅读和人工验收通过 | 寄出仅为应用内归档，不发送真实邮件 | 收集 staging 反馈 |
| 书稿与书架 | 已完成 | `src/server/books.ts`、`src/client/app/library-feature.js` | 空白书稿、无主题装订、快照隔离和人工验收通过 | 成书只读，继续修改须回到书稿 | 收集 staging 反馈 |
| 标题分时背景 | 已完成 | `src/client/assets/scenes/title/`、`src/client/styles.css`、`src/client/config/scene-assets.js` | 清晨/下午/黄昏/深夜四阶段浏览器截图、哈希核对、build、staging 上传通过 | 下午复用清晨位图并以 CSS 暖色调区分，避免重复资源 | 收集 staging 反馈 |
| 整体验收 | 已完成 | 全部 0.4.0 变更 | 35 单元 + 43 集成 + check + build + 三档浏览器 + 人工验收 + staging 发布 | Access 后功能复查需由已登录用户完成 | production 另行授权 |

## 基线证据（2026-08-24）

- `npm test`：34/34 通过。
- `npm run test:integration`：40/40 通过。
- `npm run check`：通过。
- Git 工作树在开始实现前无未提交修改。

## 0.4.0 本地验收证据（2026-08-24）

- `npm test`：35/35 通过。
- `npm run test:integration`：43/43 通过。
- `npm run check`：通过。
- `npm run build`：Cloudflare Worker dry-run 通过。
- 真实浏览器核心闭环通过：书桌分类/标签、公告板拼接并带回、收件/回信/寄件、空白书稿/装订/书架阅读。
- 成书快照隔离通过：装订后修改原书稿，已上架内容保持不变。
- 1024×720、1440×900、1920×1080 三档桌面视口审阅通过；控制台无 error/warn。
- 标题场景四阶段视觉审阅通过：清晨与下午使用日景、黄昏使用暖紫重光照、深夜使用蓝黑夜景与星点层；中央标题和旅程按钮均清晰。
- 三张运行时标题背景与来源文件 SHA-256 完全一致；dry-run 共读取 72 个静态资源。
- `0011_writing_spaces.sql` 已应用于本地与 staging D1；production 未变更。
- Wrangler 在受限沙箱中无法写个人日志目录，验证命令仍以退出码 0 完成。

## 人工验收结论

产品负责人于 2026-08-24 确认人工验收通过，并授权发布 staging。

## staging 发布证据

- 发布前备份：`.artifacts/staging-backups/before-0.4.0-2026-08-24.sql`。
- 远端迁移：`0011_writing_spaces.sql` 成功；复查无待执行迁移。
- 结构验证：`sent_letters`、纸页分类/来源字段、书稿来源字段均存在。
- Worker：`ithaca-journal-cloud-staging`。
- 初始 0.4.0 版本 ID：`d92f7b21-1129-43df-910c-d96a76d56858`。
- 标题分时背景补充版本 ID：`68b98f9f-27b7-4831-9e2e-015278bdaf5f`；8 个新增或变更静态资源上传成功。
- 远端部署状态：100% 流量指向版本`68b98f9f-27b7-4831-9e2e-015278bdaf5f`。
- staging：<https://ithaca-journal-cloud-staging.feiyut666.workers.dev>。
- Access：未登录访问进入预期登录页；保护边界正常。
- production：未迁移、未部署。
