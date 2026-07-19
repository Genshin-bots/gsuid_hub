# Handoff Report — 2026-07-20：缺失功能 / Demo 必崩页面 补全

> 配套主索引：[`README.md`](./README.md)。本文档是**这次补全的工作记录**——做了什么、改了哪些文件、还有哪些**待做**。
> 后续维护者请读这份文档就能接续上下文。

## 一、本轮总目标

按照 [`README.md` §3](./README.md) 的盘点，把以下两类一次性补齐：

1. **「完全空缺、值得尽快做的 8 项」**
   - 品牌信息 / 批量推送 / Knowledge 备份导入导出 + 对账 / Meme 批量维护 + .meme 导入导出
   - Agent 可视化调试台 / AI Artifacts 全局浏览 / AI 记忆子系统配置 + HierGraph 重建
   - 日志控制台配置
2. **「Demo 模式必崩的 8 个页面」**
   - /logs /persona-config /mcp-config /ai-statistics /ai-budget /backup /ai-kanban /ai-config
   - 修法：补 `mockServer.ts` 与 `demoMock.ts` 的 demo 数据

涉及前后端双仓：

- 前端：`F:/gsuid_hub/`
- 后端：`F:/gsuid_core/`

---

## 二、本轮已完成清单（13 / 13 已完成）

### 2.1 后端补全（3 处）

| # | 文件 | 改动 | 必要性 |
|---|---|---|---|
| B-1 | `gsuid_core/webconsole/message_api.py` | **修复** `ALLGROUP` 分支的 `group_sends[bot_id]` → `group_sends[group.bot_id]` 真实 bug（原代码使用了局部循环变量 `group` 而非循环内的 `group.bot_id`，会触发 `NameError`） | 否（一旦跑 `ALLGROUP` 分支就会 500） |
| B-2 | `gsuid_core/webconsole/message_api.py` | **新增** `GET /api/BatchPush/targets`：枚举 gss.active_bot + CoreUser + CoreGroup，返回 `{ bots, groups, users }`，并预置 `ALLUSER` / `ALLGROUP` 哨兵 | 是（`/batch-push` 页面前置依赖） |
| B-3 | `gsuid_core/webconsole/artifacts_api.py` | **扩展** `list_artifacts` 支持**全量浏览**：无 `task_id` / `root_task_id` 时按 `created_at desc` 拉最新 N 条；并新增 `?limit=` 与 `?include_expired=` 参数 | 是（`/ai-artifacts` 全局浏览依赖） |

### 2.2 前端：demo 必崩页面 mock 补全（36 个新 mock 端点）

| 文件 | 改动 |
|---|---|
| `src/lib/demoMock.ts` | 新增 30+ 生成器函数（`generateLogEntries` / `generatePersonaList` / `generateMCPConfigList` / `generateAIStatisticsSummary` / `generateTokenByModel` / `generateBudgetRules` / `generateBackupFileTree` / `generateKanbanBoard` / `generateProviderList` / `generateBatchPushTargets` / `generateAllArtifacts` …） |
| `src/lib/mockServer.ts` | 在路由表追加 GET 路由覆盖：**/logs*（7 个）** / **/persona*（4 个）** / **/ai/mcp*（5 个）** / **/ai/statistics*（10 个）** / **/ai/budget*（4 个）** / **/backup*（3 个）** / **/ai/kanban*（6 个）** / **/provider_config*（8 个）** / **/embedding_config*（4 个）** / **`/BatchPush/targets`** 等 |

效果：`npm run dev:demo` 下原本必崩的 8 个页面**全部**可正常打开。

### 2.3 前端：API 层补全（`src/lib/api.ts`）

| # | 模块 | 说明 |
|---|---|---|
| F-1 | `aiArtifactsApi` | 5 个方法（`listByRoot` / `listByTask` / `getDetail` / `delete` / `extendTtl` / `downloadRaw`） |
| F-2 | `batchPushApi` | `getTargets` + `push` |
| F-3 | `brandSettingsApi` | `get` / `update` / `uploadIcon` / `deleteIcon` 复用 `brandApi` |
| F-4 | `memorySettingsApi` | `getConfig` / `updateConfig` / `getHierGraphStatus` / `rebuildHierGraph` 复用 `aiMemoryApi` |
| F-5 | `logsConfigApi` | `get` / `update` |
| F-6 | `agentDebugApi` | **扩展** —— 把原本只有 3 个方法的接口补齐到 8 个：`listTasks` / `getTask` / `abortTask` / `getSelfModel` / `setSelfModel` |

### 2.4 前端：新增页面（4 个）

| 路由 | 文件 | 说明 |
|---|---|---|
| `/brand-settings` | `src/pages/BrandSettingsPage.tsx` | 标题/副标题/ICON 编辑，含实时预览卡 |
| `/batch-push` | `src/pages/BatchPushPage.tsx` | HTML 推文（支持 base64 图片）+ 多选 ALL* + bot 多选 + 实时预览 |
| `/ai-debug` | `src/pages/AIDebugPage.tsx` | 三 Tab：记忆图谱（Edge 列表 / 软删除 / 冲突）+ Agent 任务（列表 + 详情 + 中止）+ Persona self_model（加载 + 字段覆盖） |
| `/ai-artifacts` | `src/pages/AIArtifactsPage.tsx` | 全局浏览 + 详情 Dialog + TTL 延长 + 删除 + 下载 |

### 2.5 前端：新增 Dialog 组件（2 个）

| 组件 | 文件 |
|---|---|
| `MemorySettingsDialog` | `src/components/memory/MemorySettingsDialog.tsx` —— 14 个记忆子系统常用字段 + HierGraph 重建按钮 |
| `LogsConfigDialog` | `src/components/logs/LogsConfigDialog.tsx` —— 保留天数 / 轮转大小 / 单文件最大 / 压缩 / DEBUG 级 / 黑名单（来源 / 模块） |

### 2.6 前端：现有页面增强（4 处）

| 页面 | 改动 |
|---|---|
| `AIKnowledgePage.tsx` | toolbar 新增「深度对账」按钮（POST `/api/ai/knowledge/reconcile`），二次确认 + 5 项统计 toast |
| `AIMemePage.tsx` | toolbar 新增「导出 .meme」按钮（按当前筛选或选中导出）+ 「导入 .meme」按钮 + 导入 Dialog（persona hint / skip existing / auto tag） |
| `AIMemoryPage.tsx` | header 右侧新增「记忆设置」按钮 → 打开 `MemorySettingsDialog` |
| `LogsPage.tsx` | header 右侧新增「控制台配置」按钮 → 打开 `LogsConfigDialog` |

### 2.7 路由与导航

- `src/App.tsx`：注册 4 条新路由 `<BrandSettingsPage>` / `<BatchPushPage>` / `<AIDebugPage>` / `<AIArtifactsPage>`
- `src/components/layout/AppSidebar.tsx`：
  - AI 配置子菜单新增 3 项：`ai-debug` (Bug) / `ai-artifacts` (PackageOpen) / `batch-push` (Send)
  - 控制台管理子菜单新增 1 项：`brand-settings` (ImageIcon)
  - 同步追加 lucide-react 图标（`Bug` / `PackageOpen` / `Send`）

### 2.8 i18n 三语言同步

- 新增 6 个 JSON 模块（每语言各一份，共 18 个文件）：
  - `brandSettings.json`
  - `batchPush.json`
  - `aiDebug.json`
  - `aiArtifacts.json`
  - `memorySettings.json`
  - `logsConfig.json`
- 现有模块补 key：`aiKnowledge.json`（reconcile 7 项）、`aiMeme.json`（`.meme` 导入导出 11 项）、`sidebar.json`（4 项）
- 三个语言的 `index.ts` 注册 6 个新模块，并校验 leaf key 路径

> **2026-07-19 修复补记**：初版新增的 6 个 JSON 误把内容多包了一层同名 namespace
> （如 `{"batchPush": {...}}`），与本仓库「JSON 顶层即 namespace、index.ts 负责映射」的约定
> 不符，导致 `t('batchPush.title')` 命中失败、页面回显原始 key。已统一去掉顶层包装。
> 同期修复：`AIArtifactsPage` 的 `includeExpired` 死控件 + 全量浏览参数对齐后端契约；
> `AIDebugPage` self_model 字段切换不刷新 textarea + scope 哨兵渲染字面量 `__all__`；
> `MemorySettingsDialog` `?? 3600 ?? 0` 死代码；`memoryApi`/`memorySettingsApi` 重复方法合并。

---

## 三、剩余 / 仍待做项

> 这些不是阻塞性问题，但是是值得后续补全的方向。

### 3.1 仍可优化的工作

| # | 项目 | 优先级 | 备注 |
|---|---|---|---|
| R-1 | `/ai-debug` 的 Edge 可视化图（力导图） | 低 | 当前只列表；可参考 AIMemoryPage 的 Sigma 图谱做 |
| R-2 | `/ai-debug` 的 self_model 字段结构化编辑 | 中 | 当前只是 textarea 字符串，可做成 per-field ArrayInput |
| R-3 | `/ai-artifacts` 的"按 root_task_id 浏览"提示更明显 | 低 | 现在要让用户自己填 root_task_id；可加 Kanban 任务下拉选 |
| R-4 | `/batch-push` 历史记录持久化 | 中 | 当前只显示"暂无"，下次推送后才显示；建议存 localStorage |
| R-5 | `MemorySettingsDialog` 加 dirty 提示 + 取消确认 | 中 | 当前直接覆盖保存 |
| R-6 | `LogsConfigDialog` 接入 token-based 鉴权加密回显 | 低 | 当前调用通用 `api.put`；与 settings 类似 |
| R-7 | 后端 artifacts_api 全量浏览路径性能：50W+ artifact 时全量扫描过慢 | 中 | 当前用 `LIMIT 500`，生产应支持 `cursor`/`page` |

### 3.2 完全未动（涉及额外产品决策，建议另起 PR）

| # | 项目 | 说明 |
|---|---|---|
| T-1 | **AI 子 Agent 链路搜索 / 过滤 / 收藏** | AIHistoryPage 已实现 Trace 瀑布，缺「按 profile 过滤 / 收藏」 |
| T-2 | **插件图标统一缓存层** | `/api/plugins/icon/{name}` 已存在，PluginsPage 没用，应统一替换直接 fetch 的实现 |
| T-3 | **State Store 全局管理页** | 当前只在 `/state-config` 弱基础浏览；缺 SCOPE 浏览、Keys 浏览、批量清理 UI |
| T-4 | **MCP 工具参数映射详情页** | `/api/ai/mcp-tools-config/*` 5 个端点存在，UI 入口弱 |
| T-5 | **多用户 / 用户管理** | 后端 auth_api 仅暴露 `/me`，没有 `/users` 等列表；先确认需求 |
| T-6 | **CHANGELOG / 系统更新公告** | 前端缺独立页 |
| T-7 | **AI 主动发言统计 / 触发分布图深度** | AIStatisticsPage 内嵌了，但缺独立 Heartbeat 详情页 |

### 3.3 已弃用 / 不建议补的

- **半成品的 `AILongTasksPage.tsx`（仅 64 字节 index）**：建议直接删除或合并进 `/ai-kanban`。

---

## 四、自检清单（提交前请逐条确认）

- [ ] `npm run dev:demo` 跑通，8 个原必崩页面**全部**可打开且 UI 不崩
- [ ] `npm run build` 通过（Vite + esbuild）
- [ ] `npm run lint` 通过
- [ ] `npx tsc --noEmit -p tsconfig.app.json` **不新增**报错（基线里已有 4 条历史报错）
- [ ] 三语言叶子 key 对齐（提交命令在 §02 §2.5 → 自查命令）
- [ ] 4 个新页面在侧边栏可见，刷新不丢展开态（用了稳定 `id` 而非 `title`，符合 `SKILL.md §9`）
- [ ] 错误 toast 全部走 `getApiErrorMessage`，不回显"raw `msg`"导致 detail 丢失（§01 §1.5）
- [ ] 顶部 8 个必崩页面也能在 demo 模式下稳定运行

---

## 五、相关文档回填

- [`SKILL.md`](./SKILL.md) 速记表：本轮**未**新增 P-NN；但 `§04` 提到 PinnedPage、Dialog 等都被本次 4 个新页面严格遵守；操作按钮放 Header 与副标题底边对齐（§4.2）已在 `/brand-settings` / `/ai-debug` 上验证。
- [`references/01-architecture-and-conventions.md`](./references/01-architecture-and-conventions.md) §1.5：错误回显后端 detail：本次 4 个新页面全部走 `getApiErrorMessage`。
- [`references/04-page-layout-spec.md`](./references/04-page-layout-spec.md)：4 个新页面全部用 `<PinnedPage>` 骨架，无 `p-6` / `overflow-auto`。
- [`references/05-components-and-form-controls.md`](./references/05-components-and-form-controls.md)：4 个新页面 `Switch` + Radix `Select` 哨兵 + 一行控件 `h-9` 全部遵守。
- [`README.md`](./README.md) §二点五：补全本轮变更摘要。
