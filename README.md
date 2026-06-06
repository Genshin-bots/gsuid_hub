# GsCore Frontend / gsuid_hub v0.0.14

GsCore 网页控制台前端项目。该项目为 [gsuid_core](https://github.com/Genshin-bots/gsuid_core) 提供一套现代化、响应式、可国际化的 Web 管理控制台，用于管理核心配置、插件、日志、数据库、AI 能力与运行状态。

- 后端项目：[gsuid_core](https://github.com/Genshin-bots/gsuid_core) 💖 一套业务逻辑，多个平台支持！
- 前端项目：[gsuid_hub](https://github.com/Genshin-bots/gsuid_hub) 💖 易于使用的网页控制台，控制你的一切！
- 详细文档：[docs.sayu-bot.com](https://docs.sayu-bot.com)（[快速开始](https://docs.sayu-bot.com/Started/InstallCore.html)｜[网页控制台](https://docs.sayu-bot.com/Started/WebConsole.html)｜[插件市场](https://docs.sayu-bot.com/InstallPlugins/PluginsList.html)）

## 项目概览

`gsuid_hub` 是一个基于 Vite + React + TypeScript 的单页应用，使用 Hash Router 适配后端挂载场景。生产环境默认以 `/app/` 作为基础路径，开发环境通过 Vite 代理连接本地后端 `http://localhost:8765`。

项目当前主要能力包括：

- 首页与数据看板：查看系统版本、Bot 连接状态、用户/群组/命令统计趋势。
- 数据库管理：浏览插件与核心数据表，支持分页、搜索、筛选与记录操作。
- 核心与框架配置：管理核心配置、框架配置、数据库配置、状态配置、图片上传/发送配置等。
- 插件生态：插件启停、插件配置、插件商城、安装/更新/卸载、Git 镜像与 Git 更新管理。
- 运行维护：实时控制台、历史日志、调度器、备份、重启/暂停/恢复核心。
- AI 管理：模型提供方、嵌入模型、Web 搜索、人格、MCP、工具、技能、知识库、记忆、表情包、定时任务、系统提示词、会话与运行日志。
- 控制台设置：账户、头像、密码、主题、背景、语言等。

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
| 国际化 | 自定义 i18n，上下文驱动，支持 `zh-CN` / `en-US` / `ja-JP` |
| 通知 | shadcn toast、sonner |

## 项目结构

```text
.
├── docs/                         # 补充文档
│   ├── API_DOC.md
│   └── toAgent.md
├── public/                       # 静态资源
│   ├── ICON.png
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── components/               # 通用组件
│   │   ├── backup/               # 备份文件树等组件
│   │   ├── charts/               # 图表封装
│   │   ├── config/               # 配置表单、动态配置面板、配置字段组件
│   │   ├── layout/               # 应用布局与侧边栏
│   │   └── ui/                   # shadcn/ui 与项目扩展 UI 组件
│   ├── contexts/                 # Auth、Theme、Language、ConfigDirty 等上下文
│   ├── hooks/                    # 自定义 Hooks
│   ├── i18n/locales/             # 多语言资源
│   │   ├── zh-CN/
│   │   ├── en-US/
│   │   └── ja-JP/
│   ├── lib/                      # API 客户端、模拟数据、工具函数
│   ├── pages/                    # 页面组件
│   ├── App.tsx                   # 应用入口与路由定义
│   ├── main.tsx                  # React 挂载入口
│   ├── index.css                 # 全局样式与主题变量
│   └── App.css                   # 应用级样式
├── components.json               # shadcn/ui 配置
├── vite.config.ts                # Vite 配置
├── tailwind.config.ts            # Tailwind 配置
├── eslint.config.js              # ESLint 配置
├── package.json                  # 项目脚本与依赖
└── README.md
```

## 路由与页面

应用在登录后进入受保护布局，主要路由如下：

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | Login | 登录与管理员初始化入口 |
| `/home` | HomePage | 首页，展示系统与运行概览 |
| `/dashboard` | Dashboard | 数据看板、Bot 指标、命令趋势 |
| `/database` | DatabasePage | 数据库表浏览与数据管理 |
| `/plugins` | PluginsPage | 本地插件管理与配置 |
| `/plugin-store` | PluginStorePage | 插件商城、安装、更新与卸载 |
| `/git-update` | GitUpdatePage | 插件 Git 状态、更新、回退、强制更新 |
| `/logs` | LogsPage | 历史日志查询、过滤与上下文查看 |
| `/console` | ConsolePage | 实时控制台与远程命令执行 |
| `/scheduler` | SchedulerPage | 调度任务查看、执行、暂停与删除 |
| `/themes` | ThemesPage | 主题、背景、颜色与风格配置 |
| `/settings` | SettingsPage | 账户、头像、用户名与密码设置 |
| `/core-config` | CoreConfigPage | 核心配置 |
| `/framework-config` | FrameworkConfigPage | 框架配置与动态配置表单 |
| `/database-config` | DatabaseConfigPage | 数据库连接配置 |
| `/state-config` | StateConfigPage | 状态相关配置 |
| `/backup` | BackupPage | 备份文件、备份策略与下载 |
| `/ai-config` | AIConfigPage | AI 基础配置、模型提供方、嵌入、搜索、记忆等 |
| `/persona-config` | PersonaConfigPage | AI 人格创建、编辑、资源与启用范围管理 |
| `/mcp-config` | MCPConfigPage | MCP 服务器、工具发现、导入与热重载 |
| `/ai-tools` | AIToolsPage | AI 工具列表、分类与详情 |
| `/ai-skills` | AISkillsPage | AI 技能列表、详情、克隆、编辑与删除 |
| `/ai-statistics` | AIStatisticsPage | AI Token、费用与模型使用统计 |
| `/ai-scheduled-tasks` | AIScheduledTasksPage | AI 定时任务创建、暂停、恢复与删除 |
| `/ai-knowledge` | AIKnowledgePage | AI 知识库分页、搜索、创建、编辑与删除 |
| `/ai-meme` | AIMemePage | AI 表情包素材管理、上传、打标、移动与删除 |
| `/ai-memory` | AIMemoryPage | AI 记忆浏览、知识图谱与记忆刷新/删除 |
| `/system-prompt` | SystemPromptPage | 系统提示词管理与搜索 |
| `/session-management` | SessionManagementPage | 会话列表、历史记录、人格内容与消息发送 |
| `/ai-history` | AIHistoryPage | AI Session 运行日志、链路详情与统计 |

## 核心功能

### 认证与 API

- 登录后通过 Token 与 Cookie 访问后端接口。
- API 客户端集中封装在 `src/lib/api.ts`。
- 支持自定义 API Host，保存在浏览器本地存储。
- 遇到 `401` 会清理本地认证信息并跳转登录页。
- 支持 JSON、FormData、Blob 下载等请求场景。

### 配置管理

- 核心配置、框架配置、数据库配置、状态配置、图片上传与图片发送配置。
- 动态配置面板可根据后端配置项类型渲染表单。
- 对预期配置项与额外配置项进行兼容展示，便于适配后端配置变化。
- 配置变更可通过 `ConfigDirtyContext` 统一追踪。

### 插件管理

- 本地插件列表、插件详情、插件配置、服务配置、SV 配置。
- 插件启用/禁用、重载、安装、更新、卸载。
- 插件图标、插件商城信息、插件 Git 状态统一展示。
- 支持 Git 镜像源设置与插件 Git 更新/回退操作。

### AI 能力管理

- Provider 配置、高低级任务模型、OpenAI 兼容配置、Embedding、Rerank、Web Search 等。
- AI 配置向导状态检查，辅助发现关键缺失项。
- 人格配置：Markdown 内容、头像/立绘/音频、触发模式、作用范围、群组关联。
- MCP 管理：服务器配置、环境变量、工具发现、JSON 导入、预设、热重载。
- AI 工具与技能：工具浏览、技能详情、Git 克隆、Markdown 编辑。
- 知识与记忆：文本知识库、图片知识库、记忆数据库、图谱可视化。
- 表情包管理：素材上传、VLM 打标、标签编辑、使用统计与文件夹管理。
- 会话与日志：历史会话、OpenAI 格式消息、运行事件日志、子 Agent 链路与统计。

### 日志、调度与维护

- 实时控制台：远程命令执行与运行输出展示。
- 历史日志：按日期、等级、来源、关键词分页查询，并支持上下文定位。
- 调度器：查看任务、立即运行、暂停、恢复、删除。
- 备份：备份文件列表、创建备份、下载、删除、备份目录选择。
- 系统控制：侧边栏提供暂停、恢复、重启核心入口。

### 主题与国际化

- 支持亮色 / 暗色模式。
- 支持纯色 / 毛玻璃两种视觉风格。
- 支持默认主题色与 shadcn 预设。
- 支持背景图、模糊强度、图标颜色配置。
- 支持简体中文、英文、日文，语言设置可与后端主题配置同步。

### 响应式体验

- 桌面端使用可折叠侧边栏。
- 移动端适配卡片化布局与滚动区域。
- 表格、配置面板、弹窗、分页与工具栏在窄屏下进行适配。

## 开发指南

### 环境要求

- Node.js 18+
- npm / yarn / bun 任选其一

> 项目当前同时存在 `package-lock.json`、`yarn.lock` 与 `bun.lockb`。协作开发时建议团队统一包管理器，避免锁文件冲突。

### 安装依赖

```bash
npm install
```

或：

```bash
yarn install
```

或：

```bash
bun install
```

### 启动开发服务器

```bash
npm run dev
```

默认开发端口为 `8080`，Vite 会将：

- `/api` 代理到 `http://localhost:8765`
- `/ws` 代理到 `http://localhost:8765`

因此本地开发时通常需要先启动 `gsuid_core` 后端服务。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/`。生产模式基础路径为 `/app/`，构建结束后会生成 `dist/version.json`，包含版本号、构建时间与构建模式。

### 开发构建

```bash
npm run build:dev
```

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

## Vite 配置要点

- 开发基础路径：`/`
- 生产基础路径：`/app/`
- 开发代理：`/api` 与 `/ws` 指向本地后端 `http://localhost:8765`
- 版本注入：从 `package.json` 读取版本并注入 `PACKAGE_VERSION`
- 构建优化：按 React、Radix UI、Recharts、TanStack Virtual 等依赖拆分 chunk
- 生产构建：使用 esbuild 压缩，移除 `console` 与 `debugger`
- 路径别名：`@` 指向 `src`

示例：

```ts
import Component from '@/components/Example';
```

## API 模块概览

主要 API 封装位于 `src/lib/api.ts`，当前包含：

- `dashboardApi`：数据看板与 Bot 信息
- `configApi`：核心配置
- `pluginsApi` / `pluginStoreApi`：插件与插件商城
- `frameworkConfigApi`：框架配置
- `providerConfigApi` / `openaiConfigApi` / `embeddingConfigApi`：AI 模型与嵌入配置
- `logsApi` / `remoteCommandApi`：日志与远程命令
- `schedulerApi`：调度器
- `backupApi`：备份
- `databaseApi`：数据库浏览与记录操作
- `authApi`：登录、注册、用户信息、头像、密码
- `assetsApi`：资源上传与预览
- `systemApi` / `versionApi`：系统控制与版本信息
- `themeApi`：主题配置
- `personaApi`：AI 人格
- `aiToolsApi` / `aiSkillsApi`：AI 工具与技能
- `aiKnowledgeApi` / `aiImageApi`：文本与图片知识库
- `historyApi`：会话历史
- `systemPromptApi`：系统提示词
- `aiScheduledTasksApi`：AI 定时任务
- `gitMirrorApi` / `gitUpdateApi`：Git 镜像与更新
- `mcpConfigApi`：MCP 配置
- `memeApi`：AI 表情包素材
- `aiSessionLogsApi`：AI 运行日志
- `aiWizardApi`：AI 配置检查与状态

## 样式与 UI 约定

- 通用样式位于 `src/index.css` 与 `src/App.css`。
- UI 基于 shadcn/ui 与 Radix UI 组件构建。
- 样式组合使用 `cn` 工具函数，来源于 `src/lib/utils.ts`。
- 主题依赖 CSS Variables，Tailwind 配置映射变量到设计令牌。
- 复杂表单优先复用 `components/config` 下的配置组件。

## 国际化约定

- 语言资源按模块拆分在 `src/i18n/locales/{locale}/` 目录中。
- 当前支持：
  - `zh-CN`：简体中文
  - `en-US`：English
  - `ja-JP`：日本語
- 页面与组件通过 `useLanguage()` 获取 `t()` 函数。
- 新增页面时建议同步新增对应语言资源，并在 locale 的 `index.ts` 中导入导出。

## 浏览器支持

- Chrome / Edge 90+
- Firefox 90+
- Safari 15+
- 不支持 Internet Explorer

## 许可证与鸣谢

本项目为 GsCore 管理控制台的前端部分，仅供学习与交流使用，请勿用于商业用途。

- [GPL-3.0 License](https://github.com/Genshin-bots/gsuid_hub/blob/master/LICENSE)
- [爱发电](https://afdian.com/a/KimigaiiWuyi)
- © [@KimigaiiWuyi](https://github.com/KimigaiiWuyi)
