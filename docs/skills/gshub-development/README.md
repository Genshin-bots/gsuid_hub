# GsCore Web Console (gsuid_hub) — README & 能力对照索引

> 本文件是 `docs/skills/gshub-development/` 的**主索引与能力全景**，给第一次接触本仓库的人 /
> 准备扩前端控制台的人**一张完整的鸟瞰图**。
> 它与同目录 `SKILL.md` 的分工是：
> - **`SKILL.md` + `references/` 01–12**：开发规范与已知坑（**怎么写**一个页面/组件；§11 为 Live Chat，§12 为记忆图谱 / 世界知识）
> - **本 `README.md`**：功能全景与跟后端能力的对照、**当前前端覆盖了哪些、还差哪些**
>
> **更新原则**：本文档描述的是**前端控制台当前已实现的能力**，并通过"→ 对应后端 API"链接回 gsuid_core。
> 任何新前端能力、改名/改路由、增加 API 调用前，请同步更新本文件。

---

## 一、项目与本控制台定位

`gsuid_hub` 是 [gsuid_core](https://github.com/Genshin-bots/gsuid_core) 的网页控制台前端，定位与目标用户：

- **单页 React 应用**，由后端在 `/app/`（生产）或 `/`（开发）挂载，提供一套**远程管理** UI。
- **三类使用场景**：
  1. **日常运维**：登录 → 看看板 → 处理审批 → 调度任务。
  2. **AI 调优**：配置 Provider / 人格 / 知识 / 记忆 / MCP / 工具 / 技能，调试会话，回看历史。
  3. **首次部署**：初始化管理员 → 上传品牌 → 安装插件 → 启用 AI。
- **目标体验**：与日常 SaaS 控制台同级的视觉与交互一致性，全亮/暗 + 纯色/毛玻璃，三语言。

实现细节见仓库根 `README.md`，开发规范见同目录 [`SKILL.md`](./SKILL.md) 与 `references/01–12`。

---

## 二、当前实现的页面与对应后端能力

> 路由与页面组件：`src/App.tsx`、`src/pages/`。
> 与后端 API 的对接细节见 `gsuid_core/gsuid_core/webconsole/docs/` 的同号文件。

### 2.1 概览与运维

| 前端路由 | 页面组件 | 主要功能 | 后端 API 群（gsuid_core 端点） |
|---|---|---|---|
| `/login` | `Login.tsx` | RSA 公钥加密登录、初始化管理员、记住自定义 API Host | `auth_api.py`（`/api/auth/{login,register,admin/exists,me,pubkey}`） |
| `/home` | `HomePage.tsx` | Hero 大标题、Bot 数、版本号、快捷入口 | `version_api.py`（`/api/version`）、`dashboard_api.py::bots` |
| `/dashboard` | `Dashboard.tsx` | 关键指标、命令趋势、用户/群活跃、Bot 列表 | `dashboard_api.py`（`/api/dashboard/{metrics,commands,users-groups,daily/*,bots}`） |
| `/database` | `DatabasePage.tsx` | 跨插件浏览表结构与数据，单条 CRUD | `database_api.py`（`/api/database/*`） |
| `/console` | `ConsolePage.tsx` | WebSocket 实时控制台 + 远程命令 + 日志级别筛选 | `web_api.py`（WS）、`system_api.py`（`/api/system/{info,health,restart,stop,resume}`）、`remote_command` |
| `/live-chat` | `LiveChatPage.tsx` | **控制台内嵌适配器**（见 [§11](./references/11-live-chat.md)）：WS 早柚协议上报/下发、会话持久化、图文音视文件/按钮/引用/@/戳一戳/echo 回执 | WS `/ws/webconsole_livechat` + REST `/api/live-chat/*` |
| `/logs` | `LogsPage.tsx` | 按日期 / 等级 / 来源 / 关键词分页查日志、上下文窗 | `logs_api.py`（`/api/logs*`，含 `/stream` SSE 与 `/config`） |
| `/traces` | `TracesPage.tsx` | 命令执行追踪链（按 trace_id 聚合逐条事件） | `trace_api.py`（`/api/traces`） |
| `/scheduler` | `SchedulerPage.tsx` | APScheduler 任务列表 / 立即运行 / 暂停 / 恢复 / 删除 | `scheduler_api.py`（`/api/scheduler/jobs*`） |
| `/backup` | `BackupPage.tsx` | 备份文件树 / 创建 / 下载 / 删除 / 配置 | `backup_api.py`（`/api/backup*`） |
| `/themes` | `ThemesPage.tsx` | 主题配置 (mode/style/color) + 背景图 + 圆角 + 阴影 + 缩放 + 字体 + 预设管理 | `theme_api.py`（`/api/theme*`）+ `assets_api.py` |
| `/settings` | `SettingsPage.tsx` | 头像、用户名、密码、API Host、语言 | `auth_api.py`（`/api/auth/{avatar,name,password}`） |

### 2.2 配置管理

| 前端路由 | 页面组件 | 主要功能 | 后端 API 群 |
|---|---|---|---|
| `/core-config` | `CoreConfigPage.tsx` | `CoreConfig` 顶层配置项编辑 | `core_config_api.py`（`/api/core/config*`） |
| `/framework-config` | `FrameworkConfigPage.tsx` | 框架级配置分组浏览 + 动态字段；**数据库配置 / 状态配置**在选中对应条目时内嵌 `DatabaseConfigPage` / `StateConfigPage`（无独立路由） | `/api/framework-config*` |
| `/state-store` | `StateStorePage.tsx` | AI 持久状态（state_store）scope/key 浏览与批量删除 | `state_store_api.py` |

### 2.3 插件与市场

| 前端路由 | 页面组件 | 主要功能 | 后端 API 群 |
|---|---|---|---|
| `/plugins` | `PluginsPage.tsx` | 本地插件的启用/禁用/重载/配置/SV；图标统一 `PluginIcon`（`core_command` → `public/ICON.png`） | `plugins_api.py` + `plugin_icon_api`（`getPluginIconUrl`） |
| `/plugin-store` | `PluginStorePage.tsx` | 插件市场白名单浏览、安装（含 URL 安装）、更新、卸载、README 全文 | `plugins_api.py`（`/api/plugin-store*`） |
| `/git-update` | `GitUpdatePage.tsx` | 多插件 Git 状态、远程 Commit、本地历史、回退、强制更新、一键更新全部 | `git_update_api.py`（`/api/git-update*`） + `git_mirror_api.py`（`/api/git-mirror*`） |

### 2.4 AI 能力子系统（重点）

| 前端路由 | 页面组件 | 主要功能 | 后端 API 群 | 关键 SKILL 章节 |
|---|---|---|---|---|
| `/ai-config` | `AIConfigPage.tsx` (`AIConfig/`) | Provider / 高低级任务主备 / Embedding / **网络搜索（Jina 默认 + 多源策略）** / **网页抓取（Jina+local）** / Rerank + AI 向导 | `framework-config` + `provider_config_api` / `embedding_config_api` / `ai_wizard_api` | [§07 §7.5–7.7](./references/07-config-pages-and-state.md) |
| `/persona-config` | `PersonaConfigPage.tsx` | 多 Persona 卡片列表 + 头像/立绘/音频上传 + Markdown 编辑 + 作用范围 | `persona_api.py`（`/api/persona/*`） | [§08 §8.1](./references/08-page-patterns.md) |
| `/mcp-config` | `MCPConfigPage.tsx` | MCP 服务器 CRUD、**stdio / SSE / Streamable HTTP** 三传输、环境变量、工具发现、JSON 导入（含 `type: "http"`）、预设、热重载、工具参数映射 | `mcp_config_api.py`（`/api/ai/mcp*`、`/api/ai/mcp-tools-config/*`） | [§03 主题](./references/03-theme-and-styling.md)、[§07 §7.8](./references/07-config-pages-and-state.md)、[§10 P-26](./references/10-pitfalls-and-performance.md) |
| `/ai-capability-agents` | `AICapabilityAgentsPage.tsx` | 能力代理节点（**builtin / plugin / user**，不含 persona）；plugin Tab 用 **TabButtonGroup dropdown** 按 `plugin` 字段筛选；工具挂载 + 关键词 + 编辑/删除 | `capability_agents_api.py`（`/api/ai/capability-agents*`） | [§06 §6.1 dropdown](./references/06-reusable-component-catalog.md)、[§09](./references/09-sidebar-navigation.md) |
| `/ai-tool-outputs` | `AIToolOutputsPage.tsx` | FileOS 工具落盘（`to_`/`sa_` 等）浏览、筛选、预览、批量删除 | `tool_outputs_api.py`（`/api/ai/tool-outputs*`） | — |
| `/ai-tools` | `AIToolsPage.tsx` | 工具列表 + 分类 + 详情 | `ai_tools_api.py`（`/api/ai/tools*`） | [§04 排版参考页](./references/04-page-layout-spec.md) |
| `/ai-skills` | `AISkillsPage.tsx` | 技能列表 + 详情 + Git 克隆安装 + Markdown 编辑 + 删除 | `ai_skills_api.py`（`/api/ai/skills*`） | [§04 排版参考页](./references/04-page-layout-spec.md) |
| `/ai-knowledge` | `AIKnowledgePage.tsx` | 文本/图片知识库分页、搜索、批量导入、文档管理、Image RAG | `knowledge_base_api.py`（`/api/ai/knowledge*`）+ `image_rag_api.py`（`/api/ai/images*`） | [§07 渐进式配置](./references/07-config-pages-and-state.md) |
| `/ai-memory` | `AIMemoryPage.tsx` | Episode / Entity / Edge / Category / Preference / Scope / Hiergraph / Stats；**独立「世界枢纽」页签 + 挂文预览** | `ai_memory_api.py`（`/api/ai/memory*`）+ `cognitionApi` | [§12](./references/12-memory-graph-and-cognition.md)、[§07 §7.1](./references/07-config-pages-and-state.md) |
| `/ai-meme` | `AIMemePage.tsx` | 表情包素材：上传 / VLM 打标 / 标签 / 文件夹 / 检索；**按条件清空**（筛选/全部，`memeApi.purge`） | `meme_api.py`（`/api/meme*`） | [§10 P-17](./references/10-pitfalls-and-performance.md)、[§11.9](./references/11-live-chat.md) |
| `/ai-scheduled-tasks` | `AIScheduledTasksPage.tsx` | 内部定时任务 CRUD、暂停/恢复、统计 | `ai_scheduled_task_api.py` | — |
| `/ai-kanban` | `AIKanbanPage.tsx` | 长任务五列看板、任务详情、Artifacts、Workspace 文件、approve/reject、评估能力代理 | `kanban_api.py`（`/api/ai/kanban*`、`/api/ai/artifacts*`、`/api/ai/kanban/...workspace*`） | [§04 §4.1.1 page-viewport](./references/04-page-layout-spec.md) |
| `/ai-approvals` | `AIApprovalsPage.tsx` | 高危操作审批中心 / 通过或拒绝 | `approvals_api.py`（`/api/ai/approvals/list`、`/resolve`） | — |
| `/ai-budget` | `AIBudgetPage.tsx` | AI 预算规则、白名单、用量排行、scope 窗口、check 干跑预览、reset | `budget_api.py`（`/api/ai/budget*`） | [§05 §5.7 控件规范](./references/05-components-and-form-controls.md) |
| `/ai-statistics` | `AIStatisticsPage.tsx` | Token 用量（按模型/按类型/按区间）+ **User Turn / Agent Run 效率**（回合均耗、运行均耗、嵌套占比）+ 活跃用户/群 + 触发/意图分布 + 错误 + Heartbeat + RAG + 历史 + **小时级性能** | `ai_statistics_api.py`、`ai_performance_api.py` | [§10 P-26](./references/10-pitfalls-and-performance.md) |
| `/ai-history` | `AIHistoryPage.tsx` | AI Session 列表 / Trace 瀑布图（链 ↔ 分段 ↔ 子 agent）/ 统计 | `ai_session_logs_api.py`（`/api/ai/session_logs*`）+ `history_api.py`（`/api/history*`） | [§08 §8.7 Trace 瀑布](./references/08-page-patterns.md) |
| `/session-management` | `SessionManagementPage.tsx` | Session 列表 + 历史对话 + Persona + 给 Session 发消息 | `history_api.py` | [§04 §4.1.1 page-fill](./references/04-page-layout-spec.md) |
| `/ai-ops` | `AIOpsPage.tsx` | **运维诊断中心（收敛版）**：顶栏 Bot/Session/续聊状态 + 5 Tab（触发回放 / 黑白名单 / 输出试跑 / 安全策略 / 配置快照）。工具拓扑·意图·生命周期·多模态·插件诊断仅保留后端 API | `ops_diagnostics_api.py`（`/api/ops/*`） | 见 [`docs/CHANGELOG-2026-07.md`](../../CHANGELOG-2026-07.md) §四 |
| `/ai-runtime` | `AIRuntimePage.tsx` | **Agent 运行时诊断**：套件槽健康（密封槽空占用红字）/ Hook 接线 / 关系温度 / **认知索引（world 枢纽、节点挂文、重建挂载）** | `agent_kits_api.py`（`/api/agent_kits/*`、`/api/relationship/view`、`/api/cognition/nodes`、`/api/cognition/rebuild_mount`） | [§12](./references/12-memory-graph-and-cognition.md)、[§04 PinnedPage](./references/04-page-layout-spec.md) |
| `/group-profile` | `GroupProfilePage.tsx` | 群组画像只读（标签/词汇映射/称呼） | state_store `__gscore_group_profile__` | — |
| `/ai-debug` | `AIDebugPage.tsx` | 记忆图谱 / 编排任务 / self_model | `agent_debug_api.py` | — |
| `/ai-artifacts` | `AIArtifactsPage.tsx` | Artifact 全局浏览（TTL / 下载 / 过期筛选） | `artifacts_api.py` | — |

### 2.5 当前 API 全景（`src/lib/api.ts`）

按字母顺序与领域分组：

| 领域 | 数量 | 命名（ApiGroup） | 后端对应 |
|---|---|---|---|
| 总览与系统 | 5 | `dashboardApi`、`databaseApi`、`versionApi`、`brandApi`、`systemApi` | `dashboard_api.py` / `database_api.py` / `version_api.py` / `brand_api.py` / `system_api.py` |
| 认证与账户 | 1 | `authApi`（含头像上传、用户名、密码） | `auth_api.py` |
| 配置 | 3 | `configApi`、`frameworkConfigApi`、`openaiConfigApi` | `core_config_api.py` / `plugins_api.py` / `provider_config_api.py` |
| Provider / Embedding / Wizard | 4 | `providerConfigApi`、`embeddingConfigApi`、`aiWizardApi`、`openaiConfigApi` | `provider_config_api.py` / `embedding_config_api.py` / `ai_wizard_api.py` |
| 插件 | 4 | `pluginsApi`、`pluginStoreApi`、`gitMirrorApi`、`gitUpdateApi` | `plugins_api.py` / `plugin_icon_api.py` |
| 运维 | 6 | `logsApi`、`traceApi`、`remoteCommandApi`、`schedulerApi`、`backupApi`、**`liveChatApi`** | 同名 + live-chat REST；消息通道为 WS `/ws/webconsole_livechat` |
| 主题与资源 | 2 | `themeApi`、`assetsApi` | `theme_api.py` / `assets_api.py` |
| AI 能力 | 8 | `personaApi`、`mcpConfigApi`、`capabilityAgentsApi`、`aiKnowledgeApi`、`aiImageApi`、`memeApi`、`aiToolsApi`、`aiSkillsApi` | 同名 |
| AI 运行 | 7 | `historyApi`、`aiSessionLogsApi`、`agentDebugApi`、`aiScheduledTasksApi`、`aiKanbanApi`、`aiApprovalsApi`、`aiStateStoreApi` | 同名 |
| AI 度量 | 3 | `aiStatisticsApi`、`aiPerformanceApi`、`aiBudgetApi` | 同名 |
| 运维诊断 | 1 | **`opsApi`** | `ops_diagnostics_api.py` |
| Agent 运行时 | 3 | **`agentKitsApi`**、**`relationshipApi`**、**`cognitionApi`** | `agent_kits_api.py` |
| 其它 | — | `aiArtifactsApi`、`aiToolOutputsApi`、`batchPushApi`、`brandSettingsApi`、`logsConfigApi`、`memoryApi` / `memorySettingsApi` | 见 CHANGELOG；图标 `getPluginIconUrl` |

> **完整变更纪要（pnpm、P0–P2、AI Ops、路由清理）**：[`docs/CHANGELOG-2026-07.md`](../../CHANGELOG-2026-07.md)。

---

## 二点五、2026-07-20 完整补全清单

> 历史快照。下方二节的"已完整实现 / 部分实现 / 完全空缺"分区**已根据此轮补全重新评估**。
> 此处仅作存档；新增/改动如下：

| 改动类型 | 路径 | 说明 |
|---|---|---|
| 新页面 | `src/pages/BrandSettingsPage.tsx` | `/brand-settings` 标题/副标题/ICON 编辑与实时预览 |
| 新页面 | `src/pages/BatchPushPage.tsx` | `/batch-push` HTML 推文 + WS bot / **bot_self_id 可选手填** / 群用户多选 + ALL* 宏 |
| 新页面 | `src/pages/AIDebugPage.tsx` | `/ai-debug` 三 Tab（记忆图谱 / Agent 任务 / self_model） |
| 新页面 | `src/pages/AIArtifactsPage.tsx` | `/ai-artifacts` 全局浏览 + TTL 延长 + 下载 |
| 新组件 | `src/components/memory/MemorySettingsDialog.tsx` | AIMemoryPage 弹窗：记忆子系统 14 个常用字段 + HierGraph 重建 |
| 新组件 | `src/components/logs/LogsConfigDialog.tsx` | LogsPage 弹窗：保留 / 轮转 / 黑名单 |
| 增强 (frontend) | `src/lib/api.ts` | 新增 `aiArtifactsApi` / `batchPushApi` / `brandSettingsApi` / `memorySettingsApi` / `logsConfigApi`；`agentDebugApi` 补 listTasks / getTask / abortTask / getSelfModel / setSelfModel |
| 增强 (frontend) | `src/lib/demoMock.ts` + `src/lib/mockServer.ts` | 补 36 个 mock 端点（让 8 个 demo 必崩页面不崩） |
| 增强 (backend) | `gsuid_core/webconsole/message_api.py` | 新增 `/api/BatchPush/targets`；修复 ALLGROUP 分支 `group_sends[bot_id]` typo bug |
| 增强 (backend) | `gsuid_core/webconsole/artifacts_api.py` | 扩展 list endpoint 支持**全量浏览**（不传 task/root 时返回最新 N 条）+ `?include_expired=` 参数 |
| 增强 (frontend) | `src/App.tsx` + `AppSidebar.tsx` | 注册 4 个新路由与导航项 |
| i18n | `src/i18n/locales/{zh-CN,en-US,ja-JP}` | 新增 `brandSettings.json` / `batchPush.json` / `aiDebug.json` / `aiArtifacts.json`；为已有 aiKnowledge / aiMeme / sidebar 补新 key；三 index.ts 注册新模块 |
| 触发器增强 | `src/pages/AIKnowledgePage.tsx` | toolbar 新增「深度对账」按钮（POST `/api/ai/knowledge/reconcile`），并 toast 返回 5 项统计 |
| 触发器增强 | `src/pages/AIMemePage.tsx` | toolbar 新增「导出 .meme」「导入 .meme」按钮 + 导入 Dialog（persona hint / skip / auto tag） |
| 触发器增强 | `src/pages/AIMemoryPage.tsx` | header 右侧新增「记忆设置」按钮 → 打开 MemorySettingsDialog |
| 触发器增强 | `src/pages/LogsPage.tsx` | header 右侧新增「控制台配置」按钮 → 打开 LogsConfigDialog |

---

## 二点六、2026-07 Live Chat + 表情清空

| 改动类型 | 路径 | 说明 |
|---|---|---|
| 新页面 | `src/pages/LiveChatPage.tsx` | `/live-chat`：控制台内嵌 GsCore 适配器（page-fill 左右分栏） |
| 新模块 | `src/lib/liveChat/*` | 协议解析 / 媒体 / WS 客户端 / 后端状态持久化 |
| 新组件 | `src/components/live-chat/*` | ConnectionBadge / ConversationSidebar / MessageBubble / MessageComposer |
| API | `src/lib/api.ts` → `liveChatApi` | `GET/PUT /api/live-chat/state` 等 |
| 路由 / 导航 | `App.tsx` + `AppSidebar.tsx` | `live-chat` 路由；侧栏 id=`liveChat`；图标 `MessageCircle` |
| i18n | `liveChat.json` + `sidebar.liveChat` + 三语言 `index.ts` | 新建模块并注册 |
| 增强 | `AIMemePage` + `memeApi.purge` | 「清空表情」：全部 / 当前筛选；`getApiErrorMessage` |
| 规范文档 | `docs/skills/gshub-development/references/11-live-chat.md` | 分层、协议、P-30/P-31/P-32 |

---

## 二点七、2026-08 TabButtonGroup 下拉 + PluginIcon + 能力代理筛选

> 前端组件与体验更新（版本 **v0.1.2**）。规范正文见 [§06 §6.1 / §6.7](./references/06-reusable-component-catalog.md)。

| 改动类型 | 路径 | 说明 |
|---|---|---|
| **增强组件** | `src/components/ui/TabButtonGroup.tsx` | 可选 `option.dropdown`：**拆分按钮**——点主区 = 主 Tab + 二级重置 `allValue`；**仅右侧 ▾** 展开菜单；子项支持 `icon` + 选中 ✓ |
| **新组件** | `src/components/ui/plugin-icon.tsx` | 统一插件 ICON；失败回退 Package；切换 name 重置错误态 |
| **API 工具** | `getPluginIconUrl` + `PROJECT_LOGO_PLUGIN_NAMES` | `core_command` → `` `${BASE_URL}ICON.png` ``（`public/ICON.png`）；其它走 `/api/plugins/icon/{name}` 或 demo 图 |
| **页面** | `AICapabilityAgentsPage.tsx` | ① 去掉 **persona** Tab/列表（人格归 `/persona-config`）② plugin 用 dropdown 按 list 的 `plugin` 字段筛选 ③ 下拉子项与主 Tab 挂 `PluginIcon` |
| **复用收敛** | `PluginsPage` / `GitUpdatePage` / `DatabasePage` | 删除页内重复 `PluginIcon`，改 import 共享组件 |
| **类型** | `AgentNodeItem.plugin?` | list 接口插件来源字段，供二级筛选 |
| **i18n** | `aiCapabilityAgents.json`（zh/en/ja） | `allPlugins` / `pluginFilterLabel`；文案去掉人格投影表述 |
| **规范文档** | `SKILL.md`、`references/05`、`06`、`01`、本文 | 补全 dropdown 交互契约、PluginIcon 解析顺序、全站使用面表 |
| 版本 | `package.json` / `README.md` | **v0.1.0 → v0.1.2** |

### 交互契约速查（TabButtonGroup.dropdown）

```
┌──────────────────┬─────┐
│ 📦 插件 plugin 12│  ▾  │   ← 同一 option，视觉一体
└────────┬─────────┴──┬──┘
         │            │
    点主区          点箭头
         │            │
  主 Tab=plugin    打开菜单
  二级=__all__     （可保留当前二级）
                      │
                 点某插件名
                      │
              二级=该 plugin
```

- 哨兵：`__all__` 表示「全部」，**禁止空字符串**。
- 禁止整钮 `DropdownMenuTrigger`；禁止为同需求再手搓 Select 行。
- 完整 props / 反模式 / 参考代码：[§06 §6.1](./references/06-reusable-component-catalog.md)。

---

## 二点八、2026-08 网络搜索/抓取多源 + 批量推送 bot_self_id

> 与 gsuid_core 后端 Jina 默认主用、多源 failover、BatchPush 精准账号同轮落地。规范见 [§07 §7.7](./references/07-config-pages-and-state.md)、后端 `webconsole/docs/10-batch-push.md` + `gscore-ai-core-api` §11.3/§11.3b。

| 改动类型 | 路径 | 说明 |
|---|---|---|
| **Section** | `AIConfig/sections/WebSearchSection.tsx` | 主用 Jina/Tavily/Exa/MCP；策略 none/error_switch/auto_balance；备用有序 Chip；主用/备用配置分区；`@thesvg` 品牌图标 |
| **Section** | `AIConfig/sections/WebFetchSection.tsx` | 「网页抓取服务」：主用 Jina/local；同构多源 UI；Jina Key 可选 |
| **装配** | `AIConfigPage.tsx` | 派生 `websearch_*` / `webfetch_*`；保存时剥离备用含主用并 toast |
| **组件** | `MultiSelectChipGroup.tsx` | `disabled`：禁新选、已选可取消；`conflict` 样式 |
| **组件** | `LabelWithHelp.tsx` | string description → Markdown tooltip（多行策略说明） |
| **组件** | `model-brand-icon.tsx` | OpenAI path → currentColor + 亮/暗文字色 |
| **页面** | `BatchPushPage.tsx` | `InputWithDropdown` 机器人账号（列表+手填）→ `push_bot_self_id`；非宏 tag 追加 `\|{bot_self_id}`；**WS bot 只写 push_bot，不写 targets?bot_id** |
| **API** | `batchPushApi` / targets | 消费 `bot_self_ids`；`push_bot` 空=全部 active；`targets?bot_id=`=平台 id |
| **i18n** | `aiConfig` / `batchPush`（zh/en/ja） | 多源策略 Markdown 文案、抓取服务标题、账号选择器 |
| **规范文档** | `SKILL` / `05` / `06` / `07` / 本文 | 见对应章节 |

### 备用 Chip 交互速查

```
主用 Chip: [ Jina ● ] [ Tavily ] [ Exa ] [ MCP ]
策略 Chip: [ 无 ] [ 错误切换 ● ] [ 自动分流 ]
备用 Chip: [ Jina (主用) 禁用 ] [ Tavily ✓ ] [ Exa ] …
              ↑ 可见不选中          ↑ 已选配置区展示
```

- 策略=`none`：整块备用 UI + 备用配置区隐藏。
- 无任何备用勾选：不渲染备用配置面板。
- **切换主用时静默从 fallback 剔除新主用**（无 soft-memory：旧主用不会自动回到备用勾选；需用户再点）。
- 落库前再兜底剥离「备用含主用」；provider 比较 **trim + 大小写不敏感**。

---

## 二点九、2026-08 世界知识 + 节点挂文

> 对齐 gsuid_core `10fdea759be2f5faf389987e13651a7b250b1b8f`（Everything is Memory · Write）。规范正文见 [§12](./references/12-memory-graph-and-cognition.md)。

| 改动类型 | 路径 | 说明 |
|---|---|---|
| **API** | `cognitionApi` | 节点补 `canon` / `attachments[]`；新增 `getNode`、`rebuildMount` |
| **共享** | `src/lib/cognition.ts` | `isWorldHub` / `hubForEntity` / `attachmentHref` / 旧后端降级 |
| **组件** | `src/components/cognition/CognitionAttachments.tsx` | 按 slot 列出挂文；只读 vs 可写；句柄跳转原库页 |
| **世界页签** | `AIMemoryPage` | 独立「世界枢纽」Tab；挂文「打开文章」就地预览 |
| **索引** | `AIRuntimePage` CognitionPanel | world / 环境筛选、挂文列表、重建挂载（不碰记忆图） |
| **Demo** | `mockServer.ts` | 钟离 / 原神 / 提瓦特枢纽 + plugin/agent 挂文 + `ent:` 镜像 |
| **i18n** | `aiMemory` / `aiRuntime` / `aiConfig` | 三语言同步 |
| **规范** | `SKILL.md` + `references/12` | 两层模型、叠层约定、ACL |

---

## 三、后端已具备但前端尚未覆盖 / 覆盖薄弱的板块（"待补"清单）

> 这是 2026-07-20 一次盘点结果。**与 gsuid_core 后端端点的对照**（46 个 API 文件、约 250 端点）。
> 加 ★ 的表示**完全没有对应页面**或对应 UI 调用，纯空白。

### 3.1 完全没有前端页面的子系统

| 后端模块 | 端点数 | 前端空缺描述 | 建议页面 |
|---|---|---|---|
| **agent_debug_api**（Agent 可视化调试台） | 8 | `Memory Graph View`、`Orchestration Board`、`Persona Evolution Inspector` 三个面板**全部缺**。`AIKanbanPage` 只覆盖了部分 Orchestration；`AIMemoryPage` 只覆盖了基础浏览，缺 Edge 软删除/合并、`memory/conflicts` 解决、`agent_debug/self_model` 修正。 | 新增 `/ai-debug` 路由 / 拆 3 个 Tab |
| **artifacts_api**（AI 产出物） | 5 | `AIKanbanPage` 内已调用 artifacts 列表/详情/下载/删除/TTL 延长，但**没有独立页面**做资源全局浏览。 | 新增 `/ai-artifacts` |
| **workspace_api**（Kanban 任务工作区） | 4 | workspace 文件列表、上传、下载、apply-patch 仅在 Kanban 任务详情 Dialog 部分暴露，缺全局浏览。 | AIKanban 详情弹窗 + 全局工作区 |
| **state_store_api**（State 状态存储） | 6 | ~~缺独立页~~ → 已有 `/state-store`（`StateStorePage` + `StateStoreViewer`） | — |
| **brand_api**（品牌信息） | 5 | 仅 `BrandContext` 读 `GET /api/brand` 在登录页/布局展示，**完全没有 UI 编辑**。 | 新增 `/brand-settings` |
| **message_api::BatchPush** | 1 | ~~完全无入口~~ → 已有 `/batch-push`（含 `bot_self_id` 手填） | — |
| **plugin_icon_api** | 1 | ~~未走接口~~ → 已通过 `getPluginIconUrl` / `PluginIcon` 统一接入；`core_command` 用项目 `ICON.png` | — |
| **ai_skills_api** `/api/ai/skills/...` 中 clip/install/market actions | — | 当前只覆盖 list/detail/clone/markdown；缺**已克隆技能的更新/卸载** UI。 | AISkillsPage |

### 3.2 API 已封装（`src/lib/api.ts` 有函数）但前端无调用入口 / 调用不全

| API 函数 | 前端页面是否调用 | 问题与建议 |
|---|---|---|
| `aiKnowledgeApi.backupExport` / `backupImport` | **无调用** | `AIKnowledgePage` 没有 "导出 JSONL 备份" 与 "从备份导入" 按钮。 |
| `aiKnowledgeApi.reconcile`（深度对账） | **无调用** | 同上，缺乏运维入口。 |
| `aiKnowledgeApi.bulk`（批量导入） | **有** | 仅是表层调用，建议加进度条（后端在切片）。 |
| `aiKnowledgeApi.deleteDocument`（整篇文档删除） | **有，部分** | 推荐在 AIKnowledgePage 加"按文档聚合"的二级视图。 |
| `memeApi.purgeRejected` / `batchRetagPending` / `export` / `import` | **已有 UI**（导出/导入/清已拒绝/重打标）；`memeApi.purge` **已有**（清空全部/筛选） | stats 在旧版后端仍需 P-17 降级兼容。 |
| `mcpConfigApi.getToolsConfigList` / `update` | 部分内嵌 | mcp_tools_config 工具参数映射有 API 但 UI 入口弱。 |
| `aiMemoryApi.getConfig` / `updateConfig`（记忆子系统配置） | **无独立页** | 已内嵌 `aiMemory.page` 内部；建议单开"记忆设置" tab 或下钻。 |
| `aiMemoryApi.rebuildHierGraph` | **无调用** | "重建分层语义图"按钮缺。 |
| `aiMemoryApi.getPreferences` / `update` / `delete` | 部分内嵌 | **"偏好记忆规则"管理页**独立出来价值更大（Procedural Memory 纠偏）。 |
| `aiMemoryApi.getCategories` / `getHierGraphStatus` | 部分 | 推荐在 AI Memory 页加"分类浏览" + "HierGraph 状态卡片"。 |
| `aiKanbanApi.evaluateMesh` / `kanbanCandidates` | 部分调用 | 看板选中任务的"自动重试/能力匹配"按钮需提升可视性。 |
| `aiKanbanApi.workspaceFiles` / `applyPatch` | 部分 | 任务详情里的工作区管理 UI 偏弱。 |
| `aiKanbanApi.deleteArtifact` / `extendTtl` | 部分 | TTL 延长按钮缺。 |
| `aiSessionLogsApi` 的分段合并 | **有** | 已实现，但分段合并加载与"加载更早分段"逻辑需复核。 |
| `openaiConfigApi` | **有** | `AIConfigPage` 有 OpenAI 兼容层；高级功能（rerank 统计、月度配额）未完整。 |
| `versionApi.bots` / `botCount` / `botNames` | 部分 | Home 与 Dashboard 有，建议加 `/system/bots` 详情页（运行时长、所属适配器、最后心跳）。 |
| `logsApi.stream` SSE | **待复核** | `LogsPage` 是否真的用了 SSE？还是要加"实时"tab。 |
| `logsApi.config` GET/PUT | **无独立页** | 日志控制台自身的轮转/级别策略配置页缺失。 |
| `authApi.password` POST | 部分 | SettingsPage 有；找回密码/改密强度校验建议显式化。 |

### 3.3 demo 模式必崩的页面（P-26 已知）

`pnpm dev:demo` 因 Mock Server 缺端点，下表中的路由**无论改没改都会崩**（来自
[`SKILL.md §10 P-26`](./references/10-pitfalls-and-performance.md)）：

| 路由 | 缺失 mock | 症状 |
|---|---|---|
| `/logs` | `/api/logs*` | `Cannot read properties of undefined (reading 'toLocaleString')` |
| `/persona-config` | `/api/persona*` | `Cannot read properties of undefined (reading 'enable_persona')` |
| `/mcp-config` | `/api/ai/mcp*` | `Cannot read properties of undefined (reading 'length')` |
| `/ai-statistics` | `/api/ai/statistics/*` | `tokenByModel.map is not a function` |
| `/ai-budget` | `/api/ai/budget/*` | `Cannot read properties of undefined (reading 'length')` |
| `/backup` | `/api/backup/file-tree` | `nodes.map is not a function` |
| `/ai-kanban` | `/api/ai/kanban/*` | `Cannot read properties of undefined (reading 'task_count')` |
| `/ai-config` | `/api/ai/mcp*` | `mcpConfigs is not iterable` |

修 `mockServer.ts` + `demoMock.ts` 补齐即可（这是 Mock 数据缺口，**不是**前端代码 bug）。

---

## 四、整体能力对照概览（"前后端交叉表"）

下面这张表按"控制台期望覆盖的能力"列出，与后端 API 是否提供、前端是否实现交叉对照。
**TODO 标记**：⬛ 未做 / 🟨 部分实现 / 🟩 完整实现 / 🟦 仅后端有。

| 能力板块 | 后端 API 群 | 前端覆盖 |
|---|---|---|
| 登录 / 注册 / 管理员初始化 | `auth_api` | 🟩 Login/Auth |
| Bot 列表与活跃度 | `dashboard_api` + `version_api` | 🟩 Dashboard + Home |
| 命令 / 触发 / 用户 / 群统计 | `dashboard_api` | 🟩 Dashboard |
| 系统信息 / 健康 / 启停 | `system_api` | 🟩 Console + Sidebar |
| 历史日志查询 / 上下文 / 流 | `logs_api` | 🟩 LogsPage（流待复核） |
| 日志控制台轮转配置 | `logs_api::config` | ⬛ 缺独立页 |
| 命令追踪 / 链路 | `trace_api` | 🟩 TracesPage |
| 调度任务 | `scheduler_api` | 🟩 SchedulerPage |
| 备份 | `backup_api` | 🟩 BackupPage |
| 主题与背景 | `theme_api` + `assets_api` | 🟩 ThemesPage |
| 账户（头像 / 用户名 / 密码） | `auth_api` | 🟩 SettingsPage |
| 核心 / 框架配置 | `core_config_api` + `framework-config` | 🟩 CoreConfig + FrameworkConfig（库/状态专项 UI 内嵌） |
| AI State Store | `state_store_api` | 🟩 `/state-store` |
| AI 运维诊断 | `ops_diagnostics_api` | 🟩 `/ai-ops` |
| Agent 套件 / Hook / 关系温度 / 认知索引 | `agent_kits_api` | 🟩 `/ai-runtime` + `/ai-config`（含 world 枢纽 / 挂文 / 重建挂载） |
| 插件启用 / 禁用 / 重载 / 配置 / SV | `plugins_api` | 🟩 PluginsPage |
| 插件市场（白名单 + URL 安装） | `plugins_api::plugin-store` | 🟩 PluginStorePage |
| Git 镜像与更新 | `git_mirror_api` + `git_update_api` | 🟩 GitUpdatePage |
| Provider 模型高低级（含主备） | `provider_config_api` | 🟩 AIConfigPage |
| OpenAI 兼容 / Embedding | `embedding_config_api` + `openai_config` | 🟩 AIConfigPage |
| Web Search / Web Fetch / Rerank | `ai_config` 字段（`websearch_*` / `webfetch_*`）+ 各源 StringConfig | 🟩 AIConfigPage（Jina 默认 + 多源策略） |
| 批量推送（含 bot_self_id） | `message_api::BatchPush` + `/targets` | 🟩 BatchPushPage |
| AI 配置向导 | `ai_wizard_api` | 🟩 AIConfigPage 内嵌 Dialog |
| Persona CRUD + 媒体 | `persona_api` | 🟩 PersonaConfigPage |
| MCP 服务器 + 工具发现 + 热重载（stdio / SSE / Streamable HTTP） | `mcp_config_api` | 🟩 MCPConfigPage |
| MCP 工具参数映射 | `mcp_config_api::tools-config` | 🟨 UI 入口弱 |
| Capability Agent 节点 | `capability_agents_api` | 🟩 AICapabilityAgentsPage（builtin/plugin/user + plugin 下拉筛选） |
| AI 工具落盘 Tool Outputs | `tool_outputs_api` | 🟩 `/ai-tool-outputs` |
| AI 工具与分类 | `ai_tools_api` | 🟩 AIToolsPage |
| AI 技能（克隆 / 编辑） | `ai_skills_api` | 🟩 AISkillsPage |
| AI 知识库文本/图片 + Image RAG | `knowledge_base_api` + `image_rag_api` | 🟩 AIKnowledgePage |
| AI 知识备份导入/导出/对账 | 同上（`backup/*`、`reconcile`） | ⬛ 缺 UI |
| AI 记忆 Episode / Entity / Edge | `ai_memory_api` | 🟩 AIMemoryPage |
| 世界知识枢纽 + 节点挂文 | `agent_kits_api`（`/api/cognition/*`） | 🟩 `/ai-memory` 世界枢纽页签 + `/ai-runtime` 认知 Tab |
| AI 记忆 Category / HierGraph | `ai_memory_api` | 🟨 仅基础 |
| AI 偏好记忆 Procedural 规则 | `ai_memory_api::preferences` | 🟨 部分，需独立管理 |
| AI 记忆子系统配置 | `ai_memory_api::config` | ⬛ 无独立页 |
| AI 表情包素材 | `meme_api` | 🟩 AIMemePage（stats 部分需降级兼容） |
| AI 表情批量维护 | `meme_api`（`batch_*`、`export`、`import`、`purge`） | 🟩 导出/导入/清已拒绝/重打标/按条件清空 |
| AI 内部定时任务 | `ai_scheduled_task_api` | 🟩 AIScheduledTasksPage |
| AI Kanban 长任务 + 能力代理 | `kanban_api` | 🟩 AIKanbanPage |
| AI Kanban 工作区文件 | `workspace_api` | 🟨 任务详情有，全局无 |
| AI Artifacts 全局浏览 | `artifacts_api` | 🟩 `/ai-artifacts` |
| AI 高危操作审批中心 | `approvals_api` | 🟩 AIApprovalsPage |
| AI 预算规则 / 白名单 / 用量 | `budget_api` | 🟩 AIBudgetPage |
| AI 统计（Token / 触发 / 错误 / RAG） | `ai_statistics_api` | 🟩 AIStatisticsPage |
| AI 小时级性能 | `ai_performance_api` | 🟩 AIStatisticsPage 内嵌 |
| AI Session 历史与 Trace 瀑布 | `ai_session_logs_api` | 🟩 AIHistoryPage |
| Session 实时收发 / 历史回放 | `history_api` | 🟩 SessionManagementPage |
| Agent 可视化调试台 | `agent_debug_api` | ⬛ 整个缺失 |
| State Store 状态存储 | `state_store_api` | 🟨 偏弱 |
| 品牌信息 | `brand_api` | ⬛ 无独立编辑页 |
| 批量推送 | `message_api::BatchPush` | 🟩 BatchPushPage（bot_self_id） |
| 插件图标统一缓存 | `plugin_icon_api` | 🟩 `PluginIcon` + `getPluginIconUrl`（含 core_command→ICON.png） |
| 数据库浏览与 CRUD | `database_api` | 🟩 DatabasePage |
| 实时 WebSocket 控制台 | `web_api` | 🟩 ConsolePage |
| **Live Chat 控制台适配器** | WS `webconsole_livechat` + `/api/live-chat/*` | 🟩 LiveChatPage（[§11](./references/11-live-chat.md)） |
| 远程命令 | `remote_command`（`system_api` + RPC） | 🟩 ConsolePage |
| 资源（图片 / 文件预览 / 上传） | `assets_api` | 🟩 主题背景图 + 备份图标 |

**汇总**：
- 🟩 已完整实现：**24 个** 能力板块
- 🟨 / ⬛ 旧「待补」表（§三、§五）**大量过时**（2026-07-20 快照）；以 [`CHANGELOG-2026-07.md`](../../CHANGELOG-2026-07.md) 与当前代码为准。

---

## 五、推荐路线（精简）

多数 2026-07-20 清单项已落地。`/ai-ops` 已按「独有 + 排障」收敛为顶栏状态 + 5 Tab。可选增强：

1. 配置快照差分预览与导入确认（危险字段高亮）。  
2. 触发回放扩展「命令优先」路径与步骤时间线导出。  
3. 记忆页挂「生命周期立即维护」；插件页挂诊断摘要（复用现有 `/api/ops/*`）。  
4. 主备 Provider「当前实际生效」拓扑可视化（放 `/ai-tools` 或 AI 配置，不塞回 ops 大杂烩）。

---

## 六、文档维护约定

- **新页面**：在 `src/pages/XXXPage.tsx` 与 `src/App.tsx` 注册后，**必须**回填本文档 §二 的表格行（路由 / 功能 / 后端 API 群）。
- **新后端 API**：一旦在 `gsuid_core` 落地、若 30 天内前端未对接，应在 §三 "待补清单"登记一行，避免成为隐性债务。
- **新封装组件**：在 `references/06-reusable-component-catalog.md` 加章节，并在 `SKILL.md` 速记表里加一行。
- **TabButtonGroup / PluginIcon 行为变更**：同步 [§06 §6.1 / §6.7](./references/06-reusable-component-catalog.md) 与本文 §二点七。
- **网络搜索/抓取 / 批量推送账号**：同步 [§07 §7.7](./references/07-config-pages-and-state.md) 与本文 §二点八；后端契约同步 gsuid_core 对应 docs。
- **新踩坑**：`references/10-pitfalls-and-performance.md` 加 `P-NN` 章节，必要时 `SKILL.md` 速记区同步。
- **Live Chat / 协议适配器改动**：同步 [§11](./references/11-live-chat.md) 与本文档 §二 `/live-chat` 行。
- **记忆图谱 / 世界知识 / 节点挂文**：同步 [§12](./references/12-memory-graph-and-cognition.md) 与本文 §二点九。

---

## 七、关联文档（同仓库）

- [`SKILL.md`](./SKILL.md) — 主入口与开发规范（必读）
- [`references/01-architecture-and-conventions.md`](./references/01-architecture-and-conventions.md) 起按章节读（至 [§12 记忆图谱与世界知识](./references/12-memory-graph-and-cognition.md)）
- 仓库根 [`README.md`](../../../../README.md) — 项目总览
- `gsuid_core` 仓库 `docs/skills/gscore-development/` — 后端框架规范
- `gsuid_core/gsuid_core/webconsole/docs/` — 后端接口契约（按编号 01–43 阅读）
