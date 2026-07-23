# gsuid_hub 变更纪要（2026-07）

> 本文档汇总本轮（约 2026-07-23 ~ 2026-07-24）对 **gsuid_hub** 控制台前端，以及配套 **gsuid_core/webconsole** 后端的改动。  
> 与开发规范的关系：日常写法仍以 [`docs/skills/gshub-development/`](./skills/gshub-development/SKILL.md) 为准；本文只记**做了什么、为什么、怎么用**。

---

## 一、包管理：Yarn → pnpm

### 动机

仓库同时存在 `yarn.lock` 与 `bun.lockb`，协作易冲突；统一为 **pnpm**。

### 变更

| 动作 | 说明 |
|------|------|
| 删除 | `yarn.lock`、`.yarnrc.yml`、`bun.lockb` |
| 新增 | `pnpm-lock.yaml`、`.npmrc`（`shamefully-hoist=true`、`auto-install-peers=true`） |
| `package.json` | `packageManager` → `pnpm@10.28.2`；`resolutions` → `pnpm.overrides`；新增 `start`（`vite preview`）；`onlyBuiltDependencies` 放行 `@swc/core` / `esbuild` |
| 文档 | 根 `README.md` 开发命令改为 `pnpm *` |

### 常用命令

```bash
corepack enable
pnpm install
pnpm dev          # :8080
pnpm build
pnpm start        # 预览 dist
pnpm test
pnpm check        # biome
```

---

## 二、工程化：Biome + Vitest + 类型基线清零

| 项 | 说明 |
|----|------|
| Biome | `@biomejs/biome` + `biome.json`；脚本 `pnpm format` / `pnpm check` |
| Vitest | `vitest` + `vitest.config.ts`；脚本 `pnpm test`；用例 `src/lib/featureUtils.test.ts` |
| TS 基线修复 | `EChartsWrapper`（`dashed as const`）、`TraceWaterfall`（`Block` 联合收窄）、`hooks/use-toast`（补 sonner 兼容层）、`model-brand-icon`（variant 类型） |
| 验证 | `pnpm test` / `tsc --noEmit -p tsconfig.app.json` / `pnpm build` 均 exit 0 |

纯逻辑助手：`src/lib/featureUtils.ts`（工具诊断、记忆检索校验、统计聚合、运维摘要等）。

---

## 三、功能补全：P0 / P1 / P2（相对后端能力缺口）

在对照 `gsuid_core` 的 `gscore-development` 与 webconsole API 后，补齐下列前端能力（多数为**纯前端吃已有 API**，少数加封装）。

### P0

| 能力 | 位置 | 后端 |
|------|------|------|
| 记忆双路检索试跑 | `/ai-memory` → Tab「检索试跑」`MemorySearchPanel` | `POST /api/ai/memory/search` |
| 统计：记忆 7 项 + 管道健康 | `/ai-statistics` Overview | `summary.memory` |
| 统计：多日 history 趋势 | History trend Tab | `GET /api/ai/statistics/history` |
| 性能跨日 range | Performance 单日/范围 | `GET /api/ai/performance/hourly/range` |
| 记忆配置：idle_flush / 黑名单 / 批间隔 / RF-Mem 只读 | `MemorySettingsDialog` | `GET/PUT /api/ai/memory/config`（idle_flush 后端补字段） |

### P1

| 能力 | 位置 | 后端 |
|------|------|------|
| 工具空 docstring / meta 诊断 | `/ai-tools` 筛选与徽章 | 本地诊断 + 列表 API |
| Skills 同名更新 | 安装对话框「同名则更新」 | `POST /api/ai/skills/clone` + `update` |
| Workspace apply-patch | Kanban 任务详情 | `POST .../workspace/apply-patch` |
| State Store 一级入口 | `/state-store`（**注意**：不是旧 state-config） | `/api/ai/state-store/*` |
| Session 日志 linked_agents | `/ai-history` 详情头 | `.../linked_agents` |

### P2

| 能力 | 位置 | 后端 |
|------|------|------|
| 工具装配预览 | `/ai-tools` Assemble Tab | `POST /api/ai/tools/assemble_preview`（鉴权用户可用，不再仅 LOCAL_TEST） |
| 实体索引浏览器 | `/ai-tools` Entity index Tab | `GET /api/ai/entity_index` |
| Heartbeat 运行态 | Persona 卡片徽章 | `GET /api/persona/heartbeat/status`（新建） |
| 群组画像（只读） | `/group-profile` | state_store scope `__gscore_group_profile__` |

---

## 四、AI 运维诊断中心（`/ai-ops`）

### 动机

P0–P2 之后 CRUD 面已齐；运维仍缺「可观测 / 干跑 / 快照」类入口。统一做在 **AI 运维中心**。

首版曾堆 **13 个 Tab**（工具拓扑 / 意图 / 生命周期 / 多模态 / 插件诊断等与 `/ai-tools`、`/plugins`、`/ai-memory` 高度重叠）。  
**2026-07 收敛**：只保留「别处没有、排障真用得上」的能力，运行态收进顶栏。

### 前端（当前）

- 页面：`src/pages/AIOpsPage.tsx`
- 路由：`/ai-ops`；侧栏「AI 配置 → AI 运维中心」
- API 客户端：`opsApi`（`src/lib/api.ts`）— **后端端点全部保留**，仅 UI 收敛
- i18n：`aiOps.json`（zh-CN / en-US / ja-JP）
- Demo mock：`src/lib/mockServer.ts` 中 `/api/ops/*`

### 页面结构

```
┌ 顶栏 Runtime 状态（可展开明细） ─────────────────────┐
│  Bot 在线 x/y  ·  存活 Session n  ·  续聊窗口 k  [刷新] │
├ 5 个核心 Tab ───────────────────────────────────────┤
│  触发回放（默认）| 黑白名单 | 输出试跑 | 安全策略 | 快照 │
└─────────────────────────────────────────────────────┘
```

| UI | 方法 | 路径 | 写？ | 说明 |
|----|------|------|------|------|
| 顶栏 · Bot | GET | `/api/ops/bots` | 否 | WS 在线摘要 |
| 顶栏 · Session | GET | `/api/ops/sessions` | 否 | 进程内存活 AI Session |
| 顶栏 · 续聊 | GET | `/api/ops/followup` | 否 | 活跃续聊窗口（内存） |
| **触发回放** | POST | `/api/ops/trigger-replay` | 否 | 干跑入口链路，默认 Tab |
| **黑白名单** | GET/PUT | `/api/ops/access` | **是** | AI 入口门禁 |
| **输出试跑** | POST | `/api/ops/output-preview` | 否 | OOC / 归一化 |
| **安全策略** | GET/PUT | `/api/ops/security-output` | **是** | 仅守卫/防火墙/禁词/续聊秒数 |
| **配置快照** | GET / POST | `/api/ops/config-snapshot` · `/import` | import **是** | 灾备 / 换机 |

### UI 已下线（API 仍可用，便于脚本或以后挂回）

| 能力 | 路径 | 为何不在本页 |
|------|------|----------------|
| 工具拓扑 | `/api/ops/tool-topology` | 与 `/ai-tools` 装配预览、Persona 工具包重叠 |
| 意图分类试跑 | `/api/ops/intent` | 内部管线玩具；触发回放已覆盖入口判定 |
| 记忆生命周期 | `/api/ops/lifecycle` · `/run` | 低频且有副作用；应挂 `/ai-memory` |
| 多模态健康度 | `/api/ops/multimodal` | 极窄场景 |
| 插件诊断 | `/api/ops/plugins-diagnostics` | `/plugins` 主场 |
| 安全策略「大杂烩」字段 | 同 security-output | markdown 出图 / 工具召回等回 AI 基础配置或快照导出查看 |

### 后端（`gsuid_core`）

- 模块：`gsuid_core/webconsole/ops_diagnostics_api.py`
- 注册：`setup_frontend.py` 在 AI 开启时导入
- 辅助：`followup_window.list_active_windows()` 等（后端完整端点未删）

### 使用注意

1. **黑白名单 / 安全策略 / 快照导入** 会 `ai_config.set_config` 即时落盘，生产请谨慎。  
2. 快照默认**不**改 `memory_config`，需勾选「同时应用 memory_config」。  
3. **触发回放**不调 LLM、不发消息；只复现 enable → 黑白名单 → persona → 提及/关键词/续聊判定。  
4. 顶栏 Bot / Session / 续聊为**进程内存**，重启清空。  
5. 安全策略 UI **只编辑核心键**；PUT 仍提交当前表单值（与 GET 回填的核心字段），完整键可用「配置快照」导出对照。

---

## 五、路由清理：移除独立 `/database-config` 与 `/state-config`

### 原因

二者配置内容已在 **`/framework-config`** 内按配置名内嵌渲染：

| 框架配置名 | 内嵌组件 |
|------------|----------|
| `GsCore数据库配置` | `DatabaseConfigPage` |
| `GsCore状态配置` | `StateConfigPage` |

独立路由与侧栏入口造成重复、易与 **`/state-store`（AI 持久状态浏览器）** 混淆。

### 变更

| 文件 | 动作 |
|------|------|
| `src/App.tsx` | 删除 `database-config` / `state-config` 路由与 import |
| `src/components/layout/AppSidebar.tsx` | 删除 adminCore 下对应导航项 |
| `DatabaseConfigPage.tsx` / `StateConfigPage.tsx` | **保留**（供 FrameworkConfig 内嵌） |

### 勿混淆

| 路由 | 含义 |
|------|------|
| `/framework-config` | 全部框架级 JSON 配置（含数据库/状态等专项 UI） |
| `/state-store` | AI `state_store` 运行时键值浏览/删除 |
| `/database` | 插件业务表数据 CRUD（SQL 表浏览器） |
| ~~`/database-config`~~ | 已移除独立入口 |
| ~~`/state-config`~~ | 已移除独立入口 |

---

## 六、其它相关后端小改（配套）

| 项 | 位置 | 说明 |
|----|------|------|
| 记忆 config `idle_flush_seconds` | `ai_memory_api.py` | GET/PUT 暴露 |
| Skills clone `update` | `ai_skills_api.py` | 同名覆盖安装 |
| assemble_preview / entity_index | `ai_tools_api.py` | `require_auth_or_local_test`，控制台可调 |
| Heartbeat status | `persona_api.py` | `GET /api/persona/heartbeat/status` |

---

## 七、文件速查

### 前端新增/重点

```
src/pages/AIOpsPage.tsx
src/pages/StateStorePage.tsx
src/pages/GroupProfilePage.tsx
src/components/memory/MemorySearchPanel.tsx
src/components/memory/MemorySettingsDialog.tsx   # 扩展字段
src/lib/featureUtils.ts
src/lib/featureUtils.test.ts
src/hooks/use-toast.ts
src/i18n/locales/*/aiOps.json
biome.json
vitest.config.ts
docs/CHANGELOG-2026-07.md   # 本文
```

### 后端新增/重点

```
gsuid_core/webconsole/ops_diagnostics_api.py
gsuid_core/webconsole/setup_frontend.py          # 注册 ops_diagnostics_api
gsuid_core/ai_core/followup_window.py            # list_active_windows
gsuid_core/ai_core/memory/ingestion/multimodal.py  # get_multimodal_health
gsuid_core/ai_core/memory/lifecycle/consolidation_worker.py  # last report
```

---

## 八、验证清单（落地时自检）

```bash
# 前端
pnpm install
pnpm test
pnpm exec tsc --noEmit -p tsconfig.app.json
pnpm build

# 冒烟
pnpm dev
# 打开：/ai-ops、/ai-memory 检索、/ai-statistics、/ai-tools 装配预览、/state-store、/group-profile
# 确认侧栏无 database-config / state-config；framework-config 仍能打开数据库/状态专项页
```

---

## 九、后续可选

- ~~`/ai-ops` 收敛为顶栏状态 + 5 核心 Tab~~（已完成，见 §四）  
- 配置快照支持差分预览与导入确认表  
- 触发回放支持「命令优先」路径（当前干跑侧重 AI 分流）  
- 记忆页挂 lifecycle 维护；插件页挂 plugins-diagnostics（复用现有 API）  
- 将 `/ai-ops` 顶栏只读摘要沉到 Home 仪表盘
