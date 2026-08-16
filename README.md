# GsCore Frontend / gsuid_hub v0.1.2

GsCore 网页控制台前端项目。该项目为 [gsuid_core](https://github.com/Genshin-bots/gsuid_core) 提供一套现代化、响应式、可国际化的 Web 管理控制台，用于管理核心配置、插件、日志、数据库、AI 能力与运行状态。

- 后端项目：[gsuid_core](https://github.com/Genshin-bots/gsuid_core) 💖 一套业务逻辑，多个平台支持！
- 前端项目：[gsuid_hub](https://github.com/Genshin-bots/gsuid_hub) 💖 易于使用的网页控制台，控制你的一切！
- 详细文档：[docs.sayu-bot.com](https://docs.sayu-bot.com)（[快速开始](https://docs.sayu-bot.com/Started/InstallCore.html)｜[网页控制台](https://docs.sayu-bot.com/Started/WebConsole.html)｜[插件市场](https://docs.sayu-bot.com/InstallPlugins/PluginsList.html)）

## 项目概览

`gsuid_hub` 是一个基于 Vite + React + TypeScript 的单页应用，使用 Hash Router 适配后端挂载场景。生产环境默认以 `/app/` 作为基础路径，开发环境通过 Vite 代理连接本地后端 `http://localhost:8765`。

模块按职责分为五块：

| 模块 | 覆盖范围 | 主要页面 |
| --- | --- | --- |
| **概览与数据** | 系统/Bot 运行概览、指标趋势、数据表浏览 | `/home`、`/dashboard`、`/database` |
| **配置管理** | 核心 / 框架 / 数据库 / 状态存储 / 群组画像 | `/core-config`、`/framework-config`、`/state-store`、`/group-profile` |
| **插件生态** | 本地插件、商城、安装更新卸载、Git 镜像与更新；插件 ICON 统一组件 | `/plugins`、`/plugin-store`、`/git-update` |
| **AI 能力** | 提供方与模型、人格、MCP、能力代理、工具/技能/知识/记忆/表情、定时任务、看板、审批、预算、统计、Artifacts、工具落盘、会话与运行日志、运维诊断与调试 | `/ai-*`、`/persona-config`、`/mcp-config`、`/session-management` |
| **运维与设置** | 实时控制台、**实时聊天（控制台适配器）**、历史日志、命令追踪、调度、备份、主题、账户、品牌、批量推送 | `/console`、`/live-chat`、`/logs`、`/traces`、`/scheduler`、`/backup`、`/themes`、`/settings`、`/brand-settings`、`/batch-push` |

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端框架 | React 18、TypeScript |
| 构建工具 | Vite 5、@vitejs/plugin-react-swc |
| 路由 | React Router DOM 6（HashRouter） |
| 数据请求 | 原生 fetch 封装、@tanstack/react-query |
| UI 组件 | Tailwind CSS、shadcn/ui、Radix UI、lucide-react |
| 表单与校验 | react-hook-form、zod、@hookform/resolvers |
| 图表与可视化 | Recharts、ECharts、echarts-for-react、Graphology、Sigma |
| Markdown | react-markdown、remark-gfm、rehype-raw、react-syntax-highlighter |
| 主题 | CSS Variables、Tailwind、内置亮/暗色与毛玻璃主题系统 |
| 国际化 | 自定义 i18n，上下文驱动，支持 `zh-CN` / `en-US` / `ja-JP`（每种语言按模块拆分为独立 JSON，含 `liveChat` 等） |
| 通知 | shadcn toast、sonner |

## 项目结构

```text
.
├── docs/
│   └── skills/
│       └── gshub-development/    # 前端开发规范 SKILL（排版/组件/i18n/主题/已知坑）
├── public/                       # 静态资源（任何构建都会原样打包）
├── demo-assets/                  # 仅「演示模式」用的较大静态资源（普通构建不打包，详见下文）
│   ├── demo-memes/               # 演示用真实表情包图片
│   └── demo-plugin-icons/        # 演示用真实插件图标
├── src/
│   ├── components/
│   │   ├── ai-history/           # AI 运行链路 / 瀑布图
│   │   ├── backup/               # 备份文件树等组件
│   │   ├── brand/                # 品牌信息展示
│   │   ├── charts/               # 图表封装（EChartsWrapper 等）
│   │   ├── config/               # 配置表单、动态配置面板、配置字段组件
│   │   ├── layout/               # AppLayout / AppSidebar / PinnedPage
│   │   ├── live-chat/            # Live Chat UI（气泡 / 侧栏 / 输入 / 连接徽章）
│   │   └── ui/                   # shadcn/ui + 项目封装（TabButtonGroup / PluginIcon / …）
│   ├── contexts/                 # Auth / Theme / Language / ConfigDirty / AIStatus / Brand
│   ├── hooks/                    # use-mobile、useSystemControl
│   ├── i18n/locales/             # 多语言资源（zh-CN / en-US / ja-JP）
│   ├── lib/                      # API 客户端、liveChat 协议/WS、演示 Mock、工具函数
│   ├── pages/                    # 页面组件（复杂页面拆子目录，如 AIConfig/）
│   ├── App.tsx                   # 应用入口与路由定义
│   ├── main.tsx                  # React 挂载入口
│   ├── index.css                 # 全局样式、主题变量与页面骨架 CSS
│   └── App.css                   # 应用级样式
├── components.json               # shadcn/ui 配置
├── vite.config.ts                # Vite 配置
├── tailwind.config.ts            # Tailwind 配置
├── eslint.config.js              # ESLint 配置
├── package.json                  # 项目脚本与依赖
└── README.md
```

## 路由与页面

应用在登录后进入受保护布局（`AppLayout`），主要路由如下：

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | Login | 登录与管理员初始化入口 |
| `/home` | HomePage | 首页，系统与运行概览 |
| `/dashboard` | Dashboard | 数据看板、Bot 指标、命令趋势 |
| `/database` | DatabasePage | 数据库表浏览与数据管理 |
| `/plugins` | PluginsPage | 本地插件管理与配置；图标 `PluginIcon`（`core_command` 用项目 `ICON.png`） |
| `/plugin-store` | PluginStorePage | 插件商城、安装、更新与卸载 |
| `/git-update` | GitUpdatePage | 插件 Git 状态、更新、回退、强制更新 |
| `/logs` | LogsPage | 历史日志查询、过滤与上下文查看 |
| `/traces` | TracesPage | 命令执行追踪日志与链路详情 |
| `/console` | ConsolePage | 实时控制台与远程命令执行 |
| `/live-chat` | LiveChatPage | 控制台内嵌适配器：经 WS 完整对接早柚协议（文本/媒体/按钮/引用/@/戳一戳/echo） |
| `/scheduler` | SchedulerPage | 调度任务查看、执行、暂停与删除 |
| `/themes` | ThemesPage | 主题、背景、颜色与风格配置 |
| `/settings` | SettingsPage | 账户、头像、用户名与密码设置 |
| `/brand-settings` | BrandSettingsPage | 品牌标题 / 副标题 / ICON 编辑与预览 |
| `/batch-push` | BatchPushPage | 批量推送（WS Bot / 机器人账号 bot_self_id 可选手填 / 群与用户 / ALL* 宏） |
| `/backup` | BackupPage | 备份文件、备份策略与下载 |
| `/core-config` | CoreConfigPage | 核心配置 |
| `/framework-config` | FrameworkConfigPage | 框架配置与动态配置表单（库/状态配置内嵌） |
| `/state-store` | StateStorePage | AI 持久状态（state_store）浏览与批量删除 |
| `/group-profile` | GroupProfilePage | 群组画像（标签 / 词汇 / 称呼）只读 |
| `/ai-config` | AIConfigPage | AI 基础配置、模型提供方、嵌入、网络搜索/网页抓取（Jina 多源）、记忆等 |
| `/persona-config` | PersonaConfigPage | AI 人格创建、编辑、资源与启用范围管理 |
| `/mcp-config` | MCPConfigPage | MCP 服务器、工具发现、导入与热重载 |
| `/ai-capability-agents` | AICapabilityAgentsPage | 能力代理（**builtin / plugin / user**；plugin 下拉按插件筛选；工具包/关键词/边界） |
| `/ai-tools` | AIToolsPage | AI 工具列表、分类与详情 |
| `/ai-skills` | AISkillsPage | AI 技能列表、详情、克隆、编辑与删除 |
| `/ai-knowledge` | AIKnowledgePage | AI 知识库分页、搜索、批量导入与文档管理 |
| `/ai-memory` | AIMemoryPage | AI 记忆浏览、知识图谱、世界枢纽与挂文预览 |
| `/ai-meme` | AIMemePage | AI 表情包素材管理、上传、打标、移动、按条件清空与删除 |
| `/ai-scheduled-tasks` | AIScheduledTasksPage | AI 定时任务创建、暂停、恢复与删除 |
| `/ai-kanban` | AIKanbanPage | AI 长任务看板（列内滚动 + 横向滚动） |
| `/ai-approvals` | AIApprovalsPage | AI 高危操作审批中心 |
| `/ai-budget` | AIBudgetPage | AI 预算规则、白名单、用量与诊断 |
| `/ai-statistics` | AIStatisticsPage | AI Token、费用与模型使用统计 |
| `/ai-history` | AIHistoryPage | AI Session 运行日志、链路详情与统计 |
| `/ai-artifacts` | AIArtifactsPage | AI 产出物全局浏览、TTL、下载 |
| `/ai-tool-outputs` | AIToolOutputsPage | FileOS 工具落盘浏览、筛选、预览与批量删除 |
| `/ai-ops` | AIOpsPage | AI 运维诊断（触发回放 / 黑白名单 / 试跑 / 安全 / 配置快照） |
| `/ai-debug` | AIDebugPage | Agent 调试（记忆图谱 / 编排任务 / self_model） |
| `/session-management` | SessionManagementPage | 会话列表、历史记录、人格内容与消息发送 |

## 页面骨架（先读这一节再动 UI）★

全站页面共享同一套排版骨架，由 `AppLayout` 统一提供页边距（页面**不要**自己写 `p-6` / `overflow-auto` / `max-w-*`）。
骨架分三类，**互斥**：

| 骨架 | 用法 | 行为 | 例子 |
| --- | --- | --- | --- |
| **`<PinnedPage>`**（默认，26 个页面） | `src/components/layout/PinnedPage.tsx` | 桌面（≥768px）标题区、同行按钮与**操作控件行**（`toolbar`）**常驻视口**，只有下方内容滚动；移动端（<768px）退回普通滚动 | `/ai-tools`、`/ai-meme`、`/plugins` |
| **`.page-fill`** | 根容器 `page-fill flex glass-card` | 无标题的全高单卡片，四边与悬浮侧栏对齐，内部自己分栏滚动 | `/ai-history`、`/session-management`、`/live-chat` |
| **`.page-viewport`** | 根容器加 `page-viewport` | 有标题但页面内部自管滚动（横向看板） | `/ai-kanban` |

```tsx
import { PinnedPage } from '@/components/layout/PinnedPage';

<PinnedPage
  header={
    /* 固定区一：只放标题块 + 与标题同行的按钮 */
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold flex items-center gap-3"><Wrench className="w-8 h-8" />{t('aiTools.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('aiTools.description')}</p>
      </div>
      <Button className="self-start sm:self-auto shrink-0">{t('common.refresh')}</Button>
    </div>
  }
  /* 固定区二（可选）：紧贴标题下方的操作控件行 */
  toolbar={<TabButtonGroup options={tabOptions} value={tab} onValueChange={setTab} />}
>
  {/* 滚动区：卡片、列表、Dialog…… */}
</PinnedPage>
```

**`toolbar` 放什么**：紧贴标题下方那一块，**操作控件**（`TabButtonGroup` / 二级切换 / 筛选搜索栏 /
与之同行的按钮）→ 放 `toolbar`，随标题常驻；**数据展示**（统计卡 / 看板 / 提示 banner）→ 留在
`children` 跟着滚。典型有 toolbar 的页面：`/ai-knowledge`、`/ai-capability-agents`、`/database`、
`/plugins`、`/git-update`、`/ai-artifacts`、`/ai-tool-outputs` 等。

机制、对照表、迁移口诀与例外页面见 [`docs/skills/gshub-development/references/04-page-layout-spec.md`](docs/skills/gshub-development/references/04-page-layout-spec.md)。

### TabButtonGroup（含下拉拆分按钮）

位置：`src/components/ui/TabButtonGroup.tsx`。全站分段切换（知识库类型、预算 Tab、插件选择等）统一用它。

**普通用法**（仅主 Tab）：

```tsx
<TabButtonGroup
  options={[
    { value: 'text', label: t('…'), icon: <FileText className="w-4 h-4" /> },
    { value: 'image', label: t('…'), icon: <Image className="w-4 h-4" /> },
  ]}
  value={tab}
  onValueChange={setTab}
/>
```

**下拉二级筛选**（`option.dropdown`，参考 `/ai-capability-agents` 的「插件」）：

| 操作 | 行为 |
| --- | --- |
| 点主区（图标 + 文案） | 选中该主 Tab，二级筛选重置为「全部」（`allValue`，常用 `__all__`） |
| 点右侧 ▾ | **仅**展开菜单；打开时切到该主 Tab，保留当前二级值 |
| 点菜单项 | 主 Tab 选中 + 二级变为该项；左侧可挂 `PluginIcon` |

```tsx
{
  value: 'plugin',
  label: selectedPlugin === '__all__' ? `插件 ${n}` : `${selectedPlugin} ${n}`,
  icon: <Puzzle className="h-4 w-4" />,
  dropdown: {
    value: selectedPlugin,
    onValueChange: setSelectedPlugin,
    allValue: '__all__',
    items: [
      { value: '__all__', label: '全部插件', icon: <Puzzle className="h-4 w-4" /> },
      { value: 'GenshinUID', label: 'GenshinUID (3)', icon: <PluginIcon pluginName="GenshinUID" className="h-4 w-4" /> },
    ],
  },
}
```

完整接口、反模式与全站使用面见  
[`docs/skills/gshub-development/references/06-reusable-component-catalog.md`](docs/skills/gshub-development/references/06-reusable-component-catalog.md) §6.1。

### PluginIcon

位置：`src/components/ui/plugin-icon.tsx`，URL 由 `getPluginIconUrl(name)` 构建。

- 默认：`/api/plugins/icon/{name}`
- **`core_command`**：无独立插件 ICON，使用项目 `public/ICON.png`
- Demo：`demo-assets/demo-plugin-icons/` 或字母占位
- 使用页：`/plugins`、`/git-update`、`/database`、`/ai-capability-agents` 等（**禁止**页内再手写一份 img 回退）

## 核心功能

### 认证与 API

- 登录后通过 Token 与 Cookie 访问后端接口。
- API 客户端集中封装在 `src/lib/api.ts`，禁止在页面里散落 `fetch`。
- 支持自定义 API Host，保存在浏览器本地存储。
- 遇到 `401` 由封装层统一清理认证信息并跳转登录页（`getLoginPath()` 兼容开发 `/login` 与生产 `/app/login`）。
- 错误提示统一用 `getApiErrorMessage(err/res, fallback)` 解析，兼容业务封套 `{status,msg}` 与 FastAPI `{detail}` 两类响应。
- 支持 JSON、FormData、Blob 下载等请求场景。

### 配置管理

- 核心配置、框架配置、数据库配置、状态配置、图片上传与图片发送配置。
- 动态配置面板（`DynamicConfigPanel` / `ConfigField`）可根据后端配置项类型渲染表单。
- 对预期配置项与额外配置项做兼容展示，适配后端配置变化。
- 配置变更通过 `ConfigDirtyContext` 统一追踪。

### 插件管理

- 本地插件列表、插件详情、插件配置、服务配置、SV 配置。
- 插件启用/禁用、重载、安装、更新、卸载。
- 插件图标统一 `PluginIcon` / `getPluginIconUrl`（含 `core_command` → 项目 LOGO）。
- 商城信息、Git 状态与镜像源；Git 更新/回退/强制更新。

### AI 能力管理

- Provider 配置、高低级任务模型（含主备双配置）、OpenAI 兼容配置、Embedding、Rerank、Web Search。
- AI 配置向导状态检查，辅助发现关键缺失项。
- 人格配置：Markdown 内容、头像/立绘/音频、触发模式、作用范围、群组关联（**独立** `/persona-config`，不混入能力代理页）。
- MCP 管理：服务器配置、环境变量、工具发现、JSON 导入、预设、热重载。
- 能力代理（`/ai-capability-agents`）：来源 **builtin / plugin / user**；plugin 支持 Tab 下拉按 `plugin` 字段筛选；工具包、关键词、白名单、边界覆盖。
- 工具与技能：工具浏览、技能详情、Git 克隆、Markdown 编辑。
- 知识与记忆：文本/图片知识库、批量分片导入、记忆数据库与图谱可视化（公共 world 枢纽 + 节点挂文）。
- 表情包管理：素材上传、VLM 打标、标签编辑、使用统计、文件夹管理与**按条件清空**（筛选/全部）。
- 长任务与审批：任务看板、高危操作审批中心。
- Artifacts / 工具落盘：全局产出物浏览；FileOS 工具全文落盘（`/ai-tool-outputs`）。
- 运维诊断与调试：`/ai-ops`、`/ai-debug`。
- 预算与统计：预算规则/白名单/用量诊断、Token 与费用统计。
- 会话与日志：历史会话、OpenAI 格式消息、运行事件日志、子 Agent 链路与统计。

### 实时聊天（Live Chat · 控制台内嵌适配器）

- 路由 `/live-chat`：浏览器扮演 GsCore 平台适配器，经 WebSocket `/ws/webconsole_livechat` 上报
  `MessageReceive`、接收 `MessageSend`（二进制 JSON 帧）。
- 支持文本、图片、语音、视频、文件、@、引用回复、Markdown、按钮、合并转发、戳一戳、echo 回执与撤回控制包。
- 会话与身份经 `/api/live-chat/*` 持久化到后端（localStorage 仅作兜底与迁移）；同会话发送有等待锁，避免 core 约 8s 队列 TTL 丢包。
- 实现分层：`src/lib/liveChat/`（协议 / WS / 存储 / 媒体）+ `src/components/live-chat/`（UI）+ `LiveChatPage`（编排）。
- 开发与维护约定见 [`docs/skills/gshub-development/references/11-live-chat.md`](docs/skills/gshub-development/references/11-live-chat.md)。

### 日志、调度与维护

- 实时控制台：远程命令执行与运行输出展示（SSE 推送 + 虚拟滚动）。
- 历史日志：按日期、等级、来源、关键词分页查询，支持上下文定位。
- 命令追踪：按日期查看命令执行链路与逐条事件日志。
- 调度器：查看任务、立即运行、暂停、恢复、删除。
- 备份：备份文件列表、创建备份、下载、删除、备份目录选择。
- 系统控制：侧边栏提供暂停、恢复、重启核心入口。

### 主题与国际化

- 亮色 / 暗色模式；纯色 / 毛玻璃两种视觉风格（`glass-card` 自动适配，**不要**写 `isGlass &&`）。
- 主题色、shadcn 预设、背景图、模糊强度、圆角强度、阴影强度、UI 缩放。
- 简体中文 / English / 日本語，语言设置可与后端主题配置同步。
- 新增 key 需同步三份 JSON（新增模块还要改三个 `index.ts`）。

### 响应式体验

- 桌面端可折叠侧边栏（悬浮 / 贴边等布局）；移动端为抽屉式侧栏 + 顶部 Header。
- 标题固定（`PinnedPage`）仅桌面生效，移动端退回普通滚动以保住竖向空间。
- 表格、配置面板、弹窗、分页与工具栏在窄屏下均做适配。

## 开发指南

### 环境要求

- Node.js 18+
- [pnpm](https://pnpm.io/) 9+（推荐通过 Corepack：`corepack enable`）

> 本项目统一使用 **pnpm** 管理依赖，请勿再使用 npm / yarn / bun 安装，以免产生冲突的锁文件。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发服务器（端口 `8080`，需后端） |
| `pnpm dev:demo` | 演示模式开发（端口 `8080`，免登录、无需后端） |
| `pnpm build` | 生产构建 → `dist/`（基础路径 `/app/`） |
| `pnpm build:dev` | 开发模式构建 |
| `pnpm build:demo` | 演示模式构建 → `dist-demo/`（基础路径 `/hub/`） |
| `pnpm start` / `pnpm preview` | 预览生产构建 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 单元测试（Vitest） |
| `pnpm check` / `pnpm format` | Biome 检查 / 格式化 |
| `pnpm exec tsc --noEmit -p tsconfig.app.json` | 类型检查 |

开发时 Vite 会把 `/api` 与 `/ws` 代理到 `http://localhost:8765`，因此通常需要先启动 `gsuid_core` 后端。
构建结束后会生成 `version.json`（版本号、构建时间、构建模式）。

> 更完整的变更说明见 [`docs/CHANGELOG-2026-07.md`](docs/CHANGELOG-2026-07.md)；  
> 2026-08 组件更新（TabButtonGroup 下拉、PluginIcon、能力代理筛选）见  
> [`docs/skills/gshub-development/README.md`](docs/skills/gshub-development/README.md) §二点七。

### 开发规范（必读）

改动 `src/` 前请先读 [`docs/skills/gshub-development/`](docs/skills/gshub-development/SKILL.md)，它沉淀了全站的设计约束与踩过的坑：

| 章节 | 主题 |
| --- | --- |
| [一](docs/skills/gshub-development/references/01-architecture-and-conventions.md) | 架构与工程约定（目录、路由、API 层 + 401、错误回显） |
| [二](docs/skills/gshub-development/references/02-i18n.md) | i18n 三语言同步 |
| [三](docs/skills/gshub-development/references/03-theme-and-styling.md) | 主题与样式（CSS 变量、`glass-card`） |
| [四](docs/skills/gshub-development/references/04-page-layout-spec.md) | **页面排版铁律**（`PinnedPage` / `page-fill` / `page-viewport`、标题、间距标尺） |
| [五](docs/skills/gshub-development/references/05-components-and-form-controls.md) | 表单/筛选控件规范（无 Tab→`h-9` / 有 Tab→`h-11`、Select 哨兵） |
| [六](docs/skills/gshub-development/references/06-reusable-component-catalog.md) | 封装组件目录（**TabButtonGroup.dropdown**、**PluginIcon**、PinnedPage…，禁止手搓） |
| [七](docs/skills/gshub-development/references/07-config-pages-and-state.md) | 配置页与脏检查竞态 |
| [八](docs/skills/gshub-development/references/08-page-patterns.md) | 页面模式与 Dialog 无障碍 |
| [九](docs/skills/gshub-development/references/09-sidebar-navigation.md) | 侧边栏与导航 |
| [十](docs/skills/gshub-development/references/10-pitfalls-and-performance.md) | **已知坑（P-1 ~ P-32）+ 性能 + 落地清单** |
| [十一](docs/skills/gshub-development/references/11-live-chat.md) | **Live Chat**（早柚协议、WS 适配器、状态持久化、发送等待锁） |

## 演示模式（Demo Mode）

`gsuid_hub` 内置一套**演示模式**：免登录、纯前端 Mock 数据、可独立静态部署。它专为 [GenshinUID-docs](https://github.com/KimigaiiWuyi/GenshinUID-docs) 首页内嵌的「可交互控制台」设计——访客无需后端即可直接体验控制台的真实交互。

### 启动与构建

| 命令 | 用途 | 基础路径 | 产物 |
| --- | --- | --- | --- |
| `pnpm dev:demo` | 演示模式开发（端口 `8080`，无需后端） | `/` | — |
| `pnpm build:demo` | 演示模式构建（纯静态产物） | `/hub/` | `dist-demo/` |

> 普通 `pnpm dev` / `pnpm build` **不会**进入演示模式，且需要真实后端（代理 `/api`、`/ws` 到 `http://localhost:8765`）。

### 工作原理（编译期开关）

演示模式由 Vite 的 `--mode demo` 触发，是**编译期常量**而非运行时开关：

- `vite.config.ts` 据此设 `isDemo`，并通过 `define` 注入 `import.meta.env.VITE_DEMO`。
- 所有演示逻辑都包在 `if (import.meta.env.VITE_DEMO)` 内。普通构建下该常量为 `undefined`，相关分支与 Mock 代码会被 **tree-shake 移除——零体积、零影响**。
- **没有任何运行时入口**（URL 参数 / localStorage / Host 等）能切入演示模式。

演示模式开启后（见 `src/main.tsx`）：

- 安装 **Mock Server**（`src/lib/mockServer.ts`）：覆写 `window.fetch`，接管 `/api/*` 请求，返回 `src/lib/demoMock.ts` 内置的拟真数据。
- 写入假 Token（`demo-token`），跳过登录。
- 用「内存版」localStorage 顶替真实存储：每次刷新都是干净初始状态，多个内嵌 iframe 互不串台。
- 当以 `?embed=1` 加载时，给 `<html>` 加 `demo-embed` 类，锁定侧边栏（可见但不可点击）。

> ⚠️ **Mock 覆盖不全**：未被 Mock 命中的请求会穿透到真实 fetch → 404，页面拿到 `undefined` 后崩溃。
> 目前 `/logs`、`/persona-config`、`/mcp-config`、`/ai-statistics`、`/ai-budget`、`/backup`、`/ai-kanban`、`/ai-config`
> 在演示模式下**必崩**（属既有问题，与页面改动无关）。详见 [§10 P-26](docs/skills/gshub-development/references/10-pitfalls-and-performance.md)。

### 演示静态资源（`demo-assets/`）

演示用到的较大静态资源（真实表情包图片、插件图标，约 2MB）放在仓库根的 **`demo-assets/`**，而非 `public/`：

- Vite 会把 `public/` 整目录无条件拷进**任何**构建产物。若把这些只在演示用的资源放 `public/`，普通 `pnpm build`（后端部署用的 `dist/`）也会白白增重约 2MB。
- 为此 `vite.config.ts` 增加了 `copy-demo-assets` 插件：**仅当 `isDemo`** 时把 `demo-assets/` 拷进 `dist-demo/` 根目录（运行时 URL 仍是 `${BASE_URL}demo-*/…`，与放在 `public/` 时一致）。
- 结果：`pnpm build:demo` 携带演示资源；普通 `pnpm build` 的 `dist/` 不含它们。

主题预设不依赖本地图片：演示模式把 `gsuid_core/webconsole/themes_builtin/*.json` 的预设**内联**进 `demoMock.ts`，其背景图均为在线 URL，故无需打包任何主题图片。

### 在 GenshinUID-docs 中的接入

GenshinUID-docs 通过其 `scripts/hub.mjs` 自动执行 `build:demo`，再把 `dist-demo/` 拷入文档站的 `public/hub/`，以同源 iframe（`/hub/…`）内嵌——无需任何独立端口或服务。

## Vite 配置要点

- 开发基础路径：`/`；生产基础路径：`/app/`
- 开发代理：`/api` 与 `/ws` 指向本地后端 `http://localhost:8765`
- 版本注入：从 `package.json` 读取版本并注入 `PACKAGE_VERSION`
- 构建优化：按 React、Radix UI、Recharts、TanStack Virtual 等依赖拆分 chunk
- 生产构建：使用 esbuild 压缩，移除 `console` 与 `debugger`
- 演示模式（`--mode demo`）：注入 `import.meta.env.VITE_DEMO`；基础路径 dev `/`、build `/hub/`；产物输出 `dist-demo/`
- `copy-demo-assets` 插件：仅演示构建把 `demo-assets/` 拷入产物
- 路径别名：`@` 指向 `src`

```ts
import Component from '@/components/Example';
```

## API 模块概览

主要 API 封装位于 `src/lib/api.ts`，当前导出（节选）：

| 领域 | API 对象 |
| --- | --- |
| 概览与数据 | `dashboardApi`、`databaseApi`、`versionApi`、`brandApi` |
| 配置 | `configApi`、`frameworkConfigApi` |
| 插件 | `pluginsApi`、`pluginStoreApi`、`gitMirrorApi`、`gitUpdateApi`；图标 `getPluginIconUrl` |
| 运维 | `logsApi`、`traceApi`、`remoteCommandApi`、`schedulerApi`、`backupApi`、`systemApi`、`liveChatApi`、`opsApi` |
| 账户与资源 | `authApi`、`assetsApi`、`themeApi` |
| AI 模型与配置 | `providerConfigApi`、`openaiConfigApi`、`embeddingConfigApi`、`aiWizardApi`、`mcpConfigApi` |
| AI 能力 | `personaApi`、`aiToolsApi`、`aiSkillsApi`、`capabilityAgentsApi`、`aiKnowledgeApi`、`aiImageApi`、`memeApi` |
| AI 运行 | `historyApi`、`aiSessionLogsApi`、`agentDebugApi`、`aiScheduledTasksApi`、`aiKanbanApi`、`aiApprovalsApi`、`aiStateStoreApi`、`aiArtifactsApi`、`aiToolOutputsApi` 等 |
| AI 度量 | `aiStatisticsApi`、`aiPerformanceApi`、`aiBudgetApi` |
| 其它 | `batchPushApi` 等（以 `src/lib/api.ts` 导出为准） |

## 样式与 UI 约定

- 全局样式与主题变量位于 `src/index.css`（含 `.page-pinned` / `.page-fill` / `.page-viewport` 页面骨架 CSS）。
- UI 基于 shadcn/ui 与 Radix UI 构建，样式组合统一用 `cn()`（`src/lib/utils.ts`，内部是 tailwind-merge）。
- 主题依赖 CSS Variables，Tailwind 配置把变量映射到设计令牌。
- 卡片一律 `className="glass-card"`（已自动适配亮/暗与纯色/毛玻璃，**不要**用 `isGlass &&` 条件判断）。
- 一行筛选高度：**无** `TabButtonGroup` 时统一 `h-9`；**有** Tab 时 group 保持默认、同行控件 `tabToolbarControlClass`（`h-11`）。
- 分段切换用 `TabButtonGroup`；主分类 + 二级筛选用 `dropdown`；插件图标用 `PluginIcon`。
- 复杂表单优先复用 `components/config` 下的配置组件。
- ⚠️ `src/index.css` 的自定义段落位于 `@tailwind utilities` **之后**，会压掉同特异性的工具类——
  自定义类里只写 Tailwind 做不到的（`main:has(…)`、media 内 overflow 锁定），`display`/`gap` 交给工具类。

## 国际化约定

- 语言资源按模块拆分在 `src/i18n/locales/{locale}/`（当前每种语言 **50+** 个模块 JSON + 一个 `index.ts`，以目录为准）。
- 当前支持 `zh-CN`（简体中文）、`en-US`（English）、`ja-JP`（日本語）。
- 页面与组件通过 `useLanguage()` 获取 `t()` 函数，插值用 `t(key, { count })`，**不要**手写 `.replace()`。
- 新增 key 要同步三份 JSON 并保证 leaf key 逐字段对齐；新增模块还要改三个 `index.ts`。

## 浏览器支持

- Chrome / Edge 105+、Firefox 121+、Safari 15.4+
- 不支持 Internet Explorer

> 下限由 CSS `:has()` 决定——页面骨架（`main:has(.page-pinned)` 等）依赖它锁定滚动容器。
> 更老的浏览器不会白屏，只是标题固定失效、退化为整页滚动。

## 许可证与鸣谢

本项目为 GsCore 管理控制台的前端部分，仅供学习与交流使用，请勿用于商业用途。

- [GPL-3.0 License](https://github.com/Genshin-bots/gsuid_hub/blob/master/LICENSE)
- [爱发电](https://afdian.com/a/KimigaiiWuyi)
- © [@KimigaiiWuyi](https://github.com/KimigaiiWuyi)
