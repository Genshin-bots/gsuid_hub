# AGENTS.md

> 本文件遵循 [AGENTS.md](https://agents.md/)：给编码 Agent 的仓库说明（README for agents）。
> 专题细节（排版铁律、组件契约、已知坑）按需读
> [`.agents/skills/gshub-development/SKILL.md`](.agents/skills/gshub-development/SKILL.md)，
> **不要**一次把所有 `references/` 塞进上下文。源码是唯一事实源。

## Project overview

`gsuid_hub` 是 [gsuid_core](https://github.com/Genshin-bots/gsuid_core) 的 **Web 控制台前端**：

- **不是独立后端**。生产由 Core 挂在 `/app/`；开发时 Vite 把 `/api`、`/ws` 代理到 `http://localhost:8765`。
- **单页 React 应用**。Vite 5 + React 18 + TypeScript，**HashRouter**（适配后端静态挂载）。
- **三类场景**：日常运维、AI 调优、首次部署。
- **三语言**：`zh-CN` / `en-US` / `ja-JP`。亮/暗 + 纯色/毛玻璃由 `ThemeContext` + CSS 变量驱动。

当前版本以 `package.json` 的 `version` 为准（构建写入 `version.json`，运行时 `import.meta.env.PACKAGE_VERSION`）。

## Repository map

```
.
├── AGENTS.md                      # 本文件：Agent 必读（红线 + 结构 + 命令）
├── README.md                      # 人类用户 README（功能、路由、演示模式）
├── package.json                   # 脚本与版本号（包管理只用 pnpm）
├── pnpm-lock.yaml
├── vite.config.ts                 # 代理、BASE_URL、demo 模式、version.json
├── tailwind.config.ts
├── biome.json                     # 格式化：单引号、分号、行宽 100
├── eslint.config.js
├── components.json                # shadcn/ui
├── .agents/skills/                # 开发文档 Skill（给 Agent 按任务加载）
│   └── gshub-development/
├── docs/                          # 变更纪要等（非入门；Skill 已迁走）
├── public/                        # 任意构建都会拷入产物（含 gshub-plugin.js 插件页 SDK）
├── demo-assets/                   # 仅 demo 构建拷入（表情包 / 插件 ICON）
├── src/
│   ├── App.tsx                    # HashRouter 路由表
│   ├── main.tsx                   # 挂载；demo 模式在此装 Mock Server
│   ├── index.css                  # 主题变量 + 页面骨架 CSS（位于 @tailwind utilities 之后）
│   ├── pages/                     # 路由页面（复杂页拆子目录，如 AIConfig/）
│   ├── components/
│   │   ├── ui/                    # shadcn + 项目封装（TabButtonGroup / PluginIcon / …）
│   │   ├── layout/                # AppLayout / AppSidebar / PinnedPage
│   │   ├── config/                # DynamicConfigPanel / ConfigField / TagsInput
│   │   ├── live-chat/             # Live Chat UI
│   │   └── cognition/             # 世界枢纽挂文
│   ├── contexts/                  # Auth / Theme / Language / ConfigDirty / Brand / AIStatus
│   ├── hooks/
│   ├── i18n/locales/              # zh-CN / en-US / ja-JP，按模块拆 JSON
│   └── lib/
│       ├── api.ts                 # 所有 HTTP API + 类型（唯一出入口）
│       ├── liveChat/              # 早柚协议 / WS / 存储 / 媒体
│       ├── cognition.ts
│       ├── mockServer.ts          # demo 模式覆写 fetch
│       └── demoMock.ts
└── scripts/                       # i18n 合并等一次性脚本
```

排版标准参考页：`src/pages/AIToolsPage.tsx`、`AISkillsPage.tsx`、`AIHistoryPage.tsx`。

## Skills

任务对上后再 `Read` 对应 `SKILL.md`，再按索引打开**一篇** `references/`。

| 任务 | Skill |
|------|--------|
| 改前端控制台（页面 / 组件 / i18n / 主题 / 路由 / API 层） | [gshub-development](.agents/skills/gshub-development/SKILL.md) |
| 页面与后端能力对照、覆盖缺口 | [gshub-development/README.md](.agents/skills/gshub-development/README.md) |
| 改后端框架 / 插件 / 适配器 / 部署 | gsuid_core 仓库 `.agents/skills/`（`gscore-development` 等） |
| WebConsole 接口字段 | gsuid_core `gsuid_core/webconsole/docs/` |

`docs/CHANGELOG-2026-07.md` 只记做过什么。改核心机制后同步 Skill 对应章节。

## Setup commands

一律在仓库根目录（含 `package.json`）执行。包管理**只用 pnpm**（Node 18+ / pnpm 9+）。

```sh
pnpm install
pnpm dev                 # 开发：端口 8080，需本机 gsuid_core（代理 /api /ws → :8765）
pnpm dev:demo            # 演示：免登录、Mock 数据，无需后端
pnpm build               # 生产 → dist/，BASE_URL=/app/
pnpm build:demo          # 演示静态 → dist-demo/，BASE_URL=/hub/
pnpm test                # vitest run
pnpm lint                # eslint
pnpm check               # biome check
pnpm format              # biome format --write
pnpm exec tsc --noEmit -p tsconfig.app.json
```

开发联调先起 Core：`http://localhost:8765`，再 `pnpm dev`。控制台地址开发期是 `http://localhost:8080/#/...`。

## Testing

- 测试文件：`src/**/*.{test,spec}.{ts,tsx}`，Vitest，环境 `node`。
- 纯逻辑放 `src/lib/featureUtils.ts` 再测；页面交互优先按 Skill §10 落地清单自查。
- `tsc` 仓库里有历史报错（`EChartsWrapper.tsx`、`use-toast.ts` 等）。核对改动时**只看自己文件是否新增**，不要试图一次清掉全部旧债。
- `pnpm dev:demo` 下若干路由会因 Mock 缺口崩溃（P-26），与本次页面改动无关。先用 HEAD 对照再判责。

## Security notes

- 登录握手是 ECDH + AES-GCM（`src/lib/authCrypto.ts`），不要改成明文密码 POST。
- Token 只放封装层管理的存储；401 由 `ApiClient` 统一清凭证并 `getLoginPath()` 跳登录。
- Live Chat WS 的 `?token=` 用 `getAuthToken()`（登录会话），**不是**核心 `WS_TOKEN`。
- 密钥、自定义 API Host 只走浏览器本地存储，不要写进仓库。
- 生产 `BASE_URL` 是 `/app/`；手写跳转必须用 `getLoginPath()`，禁止写死 `/login`。

---

## 一、绝对红线（Strict Red Lines）

以下规则为**绝对禁止**。细节与反例见 Skill 对应章节。

### 1.1 禁止在页面里散落 `fetch`

所有 HTTP 走 `src/lib/api.ts` 导出的 `xxxApi`。页面只 `import { fooApi, getApiErrorMessage } from '@/lib/api'`。

新增接口：同文件定义类型 → 导出 `xxxApi` 对象 → 方法内用 `api.get/post/put/delete<T>`。查询参数用 `URLSearchParams`，**有值才 `set`**。

WebSocket（控制台日志、Live Chat）不走 `api.ts`，见 `src/lib/liveChat/` 与 `ConsolePanel`。

### 1.2 错误提示必须回显后端消息

后端有两类错误：业务封套 `{status, msg}` 与 FastAPI `{detail}`（字符串或校验数组）。只读 `msg` 会丢掉 `detail`。

统一：`getApiErrorMessage(err/res, fallback)`。本地化文案只作兜底。见 Skill §01 §1.5、§10 P-13。

旧版后端缺新接口时：识别固定文案，`console.warn` 并 UI 降级，不要当成本前端 bug 刷 `console.error`（P-17）。

### 1.3 标题页必须用 `<PinnedPage>`

「H1 + 副标题 + 内容流」的页面根容器是 `<PinnedPage header={…} toolbar={…}>`。

- **禁止**页面自己写 `p-6` / `overflow-auto` / `max-w-* mx-auto`（页边距由 `AppLayout` 给）。
- 三类骨架**互斥**：`PinnedPage`（默认）/ `.page-fill`（无标题全高卡片）/ `.page-viewport`（内部自管滚动，如看板）。
- `toolbar` 只放操作控件（Tab / 筛选）；统计卡、banner 留在 `children`。
- 标题：`text-3xl font-bold` + 内联图标 `w-8 h-8`（不加背景盒）；副标题：`text-muted-foreground mt-1`（不加 `text-sm`）。

见 Skill §04。

### 1.4 `glass-card` 始终应用，禁止 `isGlass &&`

`className="glass-card"` 已按 `[data-style]` 适配纯色/毛玻璃。宿主**禁止** `overflow-hidden`（P-19）。卡片网格加 `glass-card-grid`。

### 1.5 i18n 改一处要改三语言

新增 key：`zh-CN` / `en-US` / `ja-JP` 三份 JSON 同步；新增模块还要改三个 `index.ts`。leaf key 必须对齐。

- 插值：`t('key', { count })`，禁止 `t('key').replace(...)`。
- React `key` / 导航展开态 / `switch`：**禁止**用翻译后的 `title`，用稳定 `id`（P-10）。

见 Skill §02、§09。

### 1.6 Radix Select 禁止 `value=""`

「全部 / 不限」用哨兵 `__all__`，请求前再转回空。见 Skill §05 P-6。

### 1.7 Hooks 永远在最顶层

禁止在 `if` / 三元 / `&&` 分支里调用 Hook。所有 Hook 在分支前一次性调用（P-14）。

### 1.8 长连接 handler 必须挂 ref

Live Chat / 控制台 WS：`onMessage` 放 ref，建连 `useEffect` **禁止**依赖 `identity` / `conversations` / `t`（P-30）。同会话发送用等待锁，避免 Core ~8s 队列 TTL 丢包（P-31）。

### 1.9 早柚协议历史 typo 不要「纠正」

`ButtonData.permisson`、`excute_delete_message`、`excute_ban_user` 必须原样对齐后端。改拼写会让按钮权限和撤回/禁言失效（P-32）。

### 1.10 服务端分页禁止对当前页二次过滤

搜索 / 筛选由后端（或 mock）过滤后再切片。翻页、刷新、增删改必须复用**上次提交**的 query，不能只带 `page`，也不能对 `data.items` 再 `filter` 一遍（否则第二页会空）。参考 `DatabasePage`。

### 1.11 强制复用封装组件，禁止手搓同构控件

| 需求 | 组件 |
|------|------|
| 标题页骨架 | `PinnedPage` |
| 分段切换 / 主+二级筛选 | `TabButtonGroup`（`dropdown` 拆分按钮） |
| 插件 ICON | `PluginIcon` / `getPluginIconUrl` |
| 输入 + 下拉 | `InputWithDropdown` |
| 标签 | `TagsInput` |
| 多选/单选 Chip | `ChipGroup` / `MultiSelectChipGroup` |
| 后端动态字段 | `DynamicConfigPanel` / `ConfigField` |
| 节点挂文 | `CognitionAttachments` |

`TabButtonGroup.dropdown`：**点主区** = 主 Tab + 二级回到 `allValue`；**仅右侧 ▾** 展开菜单。禁止整钮当 `DropdownMenuTrigger`。

### 1.12 注释精简

- 代码能自解释的不写。要写就写**为什么 / 坑 / 边界**，不把 TSX 翻译成中文。
- `#` / `//` 点到为止；禁止用注释代替修复，禁止留「后续再做」占位。
- JSX：`return (` 与根元素之间不能插 `{/* 注释 */}`（P-22）。`PinnedPage` 的 props 注释用 `{/* */}` 放在标签内部。

### 1.13 包管理只用 pnpm

禁止 npm / yarn / bun 装依赖，以免锁文件冲突。

---

## 二、代码风格

Biome（`biome.json`）：

- 缩进 2 空格，行宽 100
- **单引号**、**始终分号**、trailing commas `all`

导入：路径别名 `@/` → `src/`（`tsconfig.app.json` / `vite.config.ts`）。

```tsx
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
```

图标用 `lucide-react`：标题 `w-8 h-8`，卡片小标题 `w-5 h-5`，按钮内 `w-4 h-4`。

样式组合用 `cn()`（tailwind-merge）。自定义 CSS 在 `src/index.css` 的 `@tailwind utilities` **之后**，会压掉同特异性工具类——CSS 段落只写 Tailwind 做不到的（`main:has(…)`、media 内 overflow）；`display` / `gap` 交给组件工具类（P-25、P-21）。

`ease-[cubic-bezier(...)]` 会触发 Tailwind 歧义警告：timing function 提到 `tailwind.config.ts` 再引用（P-15）。

Toast：`import { toast } from 'sonner'`。

---

## 三、路由、布局与导航

- 路由在 `src/App.tsx`，**HashRouter**。浏览器 URL 形如 `/#/database`。
- 登录页独立；其余在 `AppLayout` 子路由。管理页包 `AdminRoute`。
- 侧边栏：`src/components/layout/AppSidebar.tsx` 的 `getNavItems` + `ICON_MAP`。项必须有稳定 `id`。
- 新页面步骤：`src/pages/XXXPage.tsx` → `App.tsx` 注册 Route → 三语言 → `getNavItems` + `ICON_MAP` → 复用封装组件。清单见 Skill §10 C。

页面内操作按钮：

1. 有 `TabButtonGroup` 时把按钮移出 Header，与 group 同行（`sm:items-center`）。
2. 否则放 Header 右侧，与**副标题底边**对齐（`sm:items-end`）。禁止 Header 内 `items-center` 让按钮夹在 H1 和副标题之间。

筛选行高度：无 Tab → 统一 `h-9`；有 Tab → group 保持默认，同行控件 `tabToolbarControlClass`（`h-11`），禁止把 group 压矮。

Dialog：每个 `DialogContent` 必须有 `DialogTitle` + `DialogDescription`（可 `sr-only`）。双态 UI 的动作 / 图标 / 文案 / Title / Description **同一条件分支**（P-4、P-16、P-18）。

Switch：不要加冗余 `data-[state=checked]:bg-primary`；被 `TooltipTrigger asChild` 包裹时外面再套 `<span>`（P-5）。

`Badge` 自带 `whitespace-nowrap`，窄屏会把同行中文挤成单字列。需要折行时加 `whitespace-normal max-w-full`，按钮 `shrink-0`（P-29）。

滚动容器：`SidebarInset` 自己是 `<main>`，真正滚动的是内部那个。调试用 `document.querySelector('.layout-page-inner').parentElement`（P-23）。桌面下 `.layout-page-inner` 的 `scrollWidth - clientWidth` 必须为 0（P-28）。

---

## 四、状态、配置页与 Demo

配置页脏检查：同时比较 `config` 与 `rawConfig`；`originalConfig` 等**全部请求完成**再设，否则保存按钮误亮（Skill §07、P-7）。

任务主备读写路径不同：主配置走 `providerConfigApi.setHighLevelConfig(...)`；备用走 framework-config 字段。网络搜索/抓取多源 UI 见 Skill §07 §7.7。

`/mcp-config` 三种传输：`stdio` / `streamable_http` / `sse`；`type: "http"` 归一为 `streamable_http`。

Demo 模式是**编译期** `--mode demo`（`import.meta.env.VITE_DEMO`），没有运行时开关。普通 `pnpm build` 会 tree-shake 掉 Mock。`demo-assets/` 只在 demo 构建拷入，不要塞进 `public/`。

记忆图谱 ≠ 世界知识：`/ai-memory` 底图是分 scope 的 Entity/Edge；世界枢纽是独立页签。共享逻辑在 `src/lib/cognition.ts`（Skill §12）。

---

## 五、401 与 BASE_URL

401 由封装层统一处理。跳登录：

```ts
import { getLoginPath } from '@/lib/api';
window.location.href = getLoginPath(); // 开发 /login，生产 /app/login
```

`import.meta.env.BASE_URL`：开发 `/`，生产 `/app/`，demo 构建 `/hub/`。

---

## 六、总结

编辑本项目时的优先级：

1. **API → 只走 `api.ts`；错误用 `getApiErrorMessage`**
2. **页面骨架 → `PinnedPage` / `page-fill` / `page-viewport` 三选一，不要手写页边距**
3. **i18n → 三语言 + 稳定 id；插值走 `t(key, params)`**
4. **组件 → 目录里有的不准再搓一份**
5. **主题 → `glass-card` 直写；宿主不 `overflow-hidden`**
6. **长连接 → handler ref；协议 typo 保持原样**
7. **分页 → 复用已提交 query，不对当前页二次过滤**
8. **包管理 → pnpm**

专题细节按 Skills 表按需加载，不要把整本 `references/` 一次读完。
