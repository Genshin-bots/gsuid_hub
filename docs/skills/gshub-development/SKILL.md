---
name: gshub-development
description: >
  当用户要求"开发/维护 GsCore Web 控制台前端（gsuid_hub）"、"新增一个页面 / 配置页 / Tab"、
  "页面排版应该怎么写 / 标题/副标题/图标/页边距怎么排 / 上边距和侧边栏怎么对齐 / page-fill 是什么"、
  "标题怎么固定 / 滚动时标题不动 / PinnedPage 怎么用 / page-pinned / 只滚内容不滚标题 /
  固定标题栏的移动端怎么办"、
  "主题怎么适配 / glass-card 怎么用 / 毛玻璃 vs 纯色"、"i18n 怎么加翻译 / 三语言怎么同步 /
  index.ts 怎么改 / t() 插值"、"侧边栏怎么加菜单项 / 子菜单 / 展开状态丢失"、
  "Input 和下拉框高度不一致 / 一行筛选组件怎么对齐 / h-9 / TabButtonGroup 同行 h-11"、
  "TabButtonGroup 下拉 / 拆分按钮 / dropdown / 主按钮全部 / 箭头展开 / 二级筛选"、
  "PluginIcon / 插件 ICON / core_command ICON / getPluginIconUrl"、
  "InputWithDropdown / TagsInput / ChipGroup / TabButtonGroup / DynamicConfigPanel / ConfigField 怎么用"、
  "Switch 主题色 / Switch 被 Tooltip 包裹失效"、"Radix Select 空值报错"、
  "渐进式配置页 / EXPECTED_CONFIG_KEYS / rawConfig / 预料之外配置项"、
  "保存按钮误亮 / dirty 检查 / originalConfig 竞态"、"卡片列表页 / 表格详情页 / Dialog 弹窗 / 移动端适配"、
  "API 怎么封装 / 401 跳登录 / getLoginPath"、"改前端要注意什么 / 有哪些已知坑 / 性能优化"、
  "Live Chat / 实时聊天 / webconsole_livechat / MessageReceive / MessageSend / 早柚协议 /
  控制台适配器 / WS 二进制帧 / echo 回执 / STALE_CHAT_REQUEST_TTL / awaitingByConv"、
  "记忆图谱 / world 知识 / 世界枢纽 / 节点挂文 / attach_article / cognition 挂载"时触发此 SKILL。
  凡是改动 `src/`（React + TS 前端控制台）的任务都应优先读取此 SKILL。

  面向 **GsCore Web 控制台（gsuid_hub，前端 React 项目）开发者与维护者**的系统级开发规范指南。
  与后端框架 SKILL（`gscore-development` 等，位于 gsuid_core 仓库）不同，本 SKILL 讲的是
  **前端工程自身的设计约束与组件契约**：技术栈与目录结构、路由、API 层封装与 401、i18n 三语言同步、
  主题系统（ThemeContext / CSS HSL 变量 / glass-card 自动适配 / 侧栏三布局 / 圆角与 UI 缩放）、
  页面排版铁律（页面解剖学：layout-gutter/page-top 边距体系 / PinnedPage 固定标题页 /
  page-fill 全高卡片页 / page-viewport 视口锁定页 /
  text-3xl 标题 / 内联 w-8 h-8 图标 / 副标题 / 间距标尺 / 三态）、表单与筛选控件
  统一规范（筛选行 h-9 / 含 Tab 行 h-11、Radix Select 哨兵、Tooltip 字段说明、Switch UX）、强制复用的封装组件目录
  （TabButtonGroup 含 dropdown 拆分按钮 / PluginIcon / InputWithDropdown / TagsInput / ChipGroup / DynamicConfigPanel / CognitionAttachments）、渐进式配置页
  与脏检查竞态、几类页面模式（卡片列表 / 表格详情 / Dialog / 移动端）、侧边栏多级菜单与稳定 id、
  **Live Chat 控制台内嵌适配器**（早柚协议 WS、段解析、状态持久化、8s 队列 TTL）、
  **记忆图谱与世界知识**（scope 隔离的记忆图 + 公共 `world:` 枢纽 + 节点挂文）、
  以及一份**前端已知坑 + 性能 + 落地清单**。**源码永远是唯一事实源**，本 SKILL 是设计意图与规范的沉淀。
---

# GsCore Web 控制台（gsuid_hub）前端开发与维护指南（核心入口）

> 本 SKILL 面向**前端控制台本身的开发者 / 维护者**，描述 `src/` 的工程结构、API 封装、i18n、
> 主题、排版与组件契约，以及后续开发必须遵守的约束与踩过的坑。
> 目标：让不熟悉本项目的人也能写出与全站视觉/交互一致、不踩历史坑的页面。
>
> 内容按章节拆分为「主入口 + `references/` 子文档」。需要某专题细节时，顺着下表的相对路径
> **按需** `Read` 对应文件，**不要**一次性把所有内容塞进上下文。
> **源码永远是唯一事实源**，本 SKILL 是规范与设计意图的沉淀；改动规范后请同步更新对应章节。

## 谁该读这个 SKILL（与其他 SKILL 的分工）

| 你的任务 | 该读的 SKILL / 文档 |
|----------|---------------------|
| **改前端控制台**（页面 / 组件 / i18n / 主题 / 路由 / API 层） | **本 SKILL** |
| 改后端框架核心（handler / ai_core / 启动 / 数据库 / webconsole 后端） | gsuid_core 仓库 `gscore-development` |
| 写后端业务插件 / 适配器 / 查 AI Core API | gsuid_core 仓库对应 SKILL |
| 对接 WebConsole 后端接口（请求/响应字段） | `gsuid_core/webconsole/docs/` |

## 文档目录索引

| 章节 | 主题 | 链接 |
|------|------|------|
| 一 | 架构与工程约定（技术栈、目录、路由、代码风格、API 层 + 401、关键文件索引、新页面步骤） | [references/01-architecture-and-conventions.md](./references/01-architecture-and-conventions.md) |
| 二 | i18n 国际化（三语言目录、嵌套键、新增 key 的四处同步、t() 插值、自查命令、稳定 id） | [references/02-i18n.md](./references/02-i18n.md) |
| 三 | 主题与样式（ThemeContext、CSS HSL 变量、颜色/状态色、`glass-card` 始终应用、响应式） | [references/03-theme-and-styling.md](./references/03-theme-and-styling.md) |
| 四 | **页面排版铁律（页面解剖学）**——根容器/标题/图标/副标题/间距标尺/卡片分区/列表详情/三态 | [references/04-page-layout-spec.md](./references/04-page-layout-spec.md) |
| 五 | 组件复用与表单/筛选控件规范（cn/CVA、**一行高度：无 Tab→h-9 / 有 Tab→h-11**、Select 哨兵、Tooltip / **LabelWithHelp Markdown**、Switch UX） | [references/05-components-and-form-controls.md](./references/05-components-and-form-controls.md) |
| 六 | 封装组件目录——**TabButtonGroup dropdown** / **PluginIcon** / InputWithDropdown / TagsInput / **ChipGroup（disabled 可取消）** / DynamicConfigPanel / **ModelBrandIcon** / LabelWithHelp | [references/06-reusable-component-catalog.md](./references/06-reusable-component-catalog.md) |
| 七 | 配置页与状态（渐进式 + dirty 竞态、AIConfig、**任务主备**、**网络搜索/网页抓取多源主备 UI**、**/mcp-config 三传输**） | [references/07-config-pages-and-state.md](./references/07-config-pages-and-state.md) |
| 八 | 页面模式与 Dialog 规范（卡片列表页 / 表格详情 / Dialog/Modal / 双态 UI / 移动端 / SSH URL / API 设计经验） | [references/08-page-patterns.md](./references/08-page-patterns.md) |
| 九 | 侧边栏与导航（`getNavItems`、稳定 `id` 作 key、`ICON_MAP`、AI 启用态条件子菜单、自动展开） | [references/09-sidebar-navigation.md](./references/09-sidebar-navigation.md) |
| 十 | 已知坑 + 性能 + 落地清单（P-1~P-32 坑、性能优化、新页面落地自查清单总表） | [references/10-pitfalls-and-performance.md](./references/10-pitfalls-and-performance.md) |
| 十一 | **Live Chat**（控制台内嵌适配器：早柚协议、WS 二进制帧、段解析、状态持久化、发送等待锁） | [references/11-live-chat.md](./references/11-live-chat.md) |
| 十二 | **记忆图谱与世界知识**（scope 记忆图 / `world:` 枢纽 / 节点挂文 / `cognitionApi`） | [references/12-memory-graph-and-cognition.md](./references/12-memory-graph-and-cognition.md) |

## 推荐阅读顺序（按需跳转）

1. **第一次接触本前端**：先看 [一、架构与工程约定](./references/01-architecture-and-conventions.md) 建立心智模型。
2. **新增一个页面**：依次过 [四、排版铁律](./references/04-page-layout-spec.md) → [五、控件规范](./references/05-components-and-form-controls.md) / [六、组件目录](./references/06-reusable-component-catalog.md) → [二、i18n](./references/02-i18n.md) → [九、侧边栏](./references/09-sidebar-navigation.md)。
3. **做配置类页面**：重点看 [七、配置页与状态](./references/07-config-pages-and-state.md)（dirty 检查竞态是最容易踩的坑）。
4. **做列表/详情/弹窗类页面**：看 [八、页面模式](./references/08-page-patterns.md)。
5. **改主题/样式**：看 [三、主题与样式](./references/03-theme-and-styling.md)。
6. **改 Live Chat / 早柚协议 / 控制台 WS 适配器**：看 [十一、Live Chat](./references/11-live-chat.md)（协议分层、echo、8s TTL、handler ref）。
7. **改记忆图谱 / 世界知识 / 节点挂文**：看 [十二、记忆图谱与世界知识](./references/12-memory-graph-and-cognition.md)（两层模型、叠层约定、`cognitionApi`）。
8. **动手前必读**：[十、已知坑 + 性能 + 落地清单](./references/10-pitfalls-and-performance.md)——这一章是"别人替你踩过的坑"，写代码前过一遍能省大量返工。

## 关键概念速记（先看这一段再决定读哪一章）

- **标题页一律用 `<PinnedPage>` ★★★**：「H1 + 副标题 + 内容流」的页面（全站 26 个）根容器是 `<PinnedPage header={…} toolbar={…}>`，**不要**再手写 `<div className="space-y-6">`。桌面（≥768px）标题区 + 同行按钮 + **操作控件行**常驻视口、只有内容滚；移动端（<768px）退回普通滚动（标题跟着滚走——移动端竖向空间稀缺）。详见 [§04 §4.1.0](./references/04-page-layout-spec.md)、[§06 §6.0](./references/06-reusable-component-catalog.md)。
- **`toolbar` 的取舍：操作控件进、数据展示留 ★★**：紧贴标题下方那一块，是 `TabButtonGroup` / 二级切换 / 筛选搜索栏（如 /ai-knowledge 的「文本知识 / 图片知识」、/ai-capability-agents 的来源筛选）→ 放 `toolbar={…}` 随标题常驻；是统计卡 / 看板 / 提示 banner（如 /ai-memory、/dashboard）→ 留在 `children` 跟着滚。全站 13 个页面有 `toolbar`、13 个没有。详见 [§04 §4.1.0](./references/04-page-layout-spec.md)。
- **`TabButtonGroup` 可选 dropdown 拆分按钮 ★★**：某一 `option` 可挂 `dropdown`——**点主区 = 选中主 Tab + 二级回到「全部」**；**仅右侧 ▾ 展开菜单**选子项。子项支持 `icon`（插件用 `PluginIcon`）。参考页 `/ai-capability-agents`（plugin 按 list 的 `plugin` 字段过滤）。**禁止**整钮触发菜单、禁止再手搓 Select+Button。详见 [§06 §6.1](./references/06-reusable-component-catalog.md)。
- **插件 ICON 统一 `PluginIcon` ★**：走 `getPluginIconUrl`；`core_command` 等无独立 ICON 的内置插件映射到 `public/ICON.png`。详见 [§06 §6.7](./references/06-reusable-component-catalog.md)。
- **页面共享同一套排版骨架**：页边距由 AppLayout 统一提供（**不得**写 `p-6` / `overflow-auto` / `max-w-7xl mx-auto`）。三类骨架互斥：`<PinnedPage>`（标题页，默认）/ `.page-fill`（无标题全高单卡片，如 /ai-history、/session-management、**/live-chat**）/ `.page-viewport`（有标题但内部自管滚动，如 /ai-kanban）。标题统一 `text-3xl font-bold` + 内联图标 `w-8 h-8`（**不加**背景容器），副标题 `text-muted-foreground mt-1`（**不加** `text-sm`）。参考页 `AIToolsPage` / `AIHistoryPage`。详见 [§04](./references/04-page-layout-spec.md)。
- **Live Chat = 控制台内嵌适配器，不是 Session UI ★★**：`/live-chat` 经 WS `/ws/webconsole_livechat` 完整对接早柚 `MessageReceive`/`MessageSend`。`?token=` 用登录会话（`getAuthToken()`），**不是**核心 `WS_TOKEN`；`masters` 用 `liveChatApi.getBootstrap()`。协议解析与媒体在 `src/lib/liveChat/`，页面只编排。WS handler 必须挂 ref（避免重连风暴）；同会话发送要 `awaitingByConv` 防 8s 队列 TTL 丢包；`echo` 空包也要回执。详见 [§11](./references/11-live-chat.md)、[§10 P-30/P-31](./references/10-pitfalls-and-performance.md)。
- **记忆图谱 ≠ 世界知识 ★★**：`/ai-memory` 的 Sigma 底图只画分 scope 的 Entity/Edge。世界知识在独立的「世界枢纽」页签，本身也是一张 Sigma 图（青绿枢纽 + 琥珀挂文）。点枢纽看详情，点挂文就地预览。环境实体只在完整命中一颗枢纽时连 `canon`。共享逻辑在 `src/lib/cognition.ts` + `WorldHubGraph`。详见 [§12](./references/12-memory-graph-and-cognition.md)。
- **glass-card 宿主禁止 `overflow-hidden`**：阴影/毛玻璃靠宿主 `overflow: visible` + `::before`；裁切放内层 `rounded-[inherit]`，卡片网格加 `glass-card-grid` 防阴影被切。详见 [§04 §4.1.2/4.1.3](./references/04-page-layout-spec.md)、[§10 P-19](./references/10-pitfalls-and-performance.md)。
- **页面级操作按钮的摆放 ★★**：①首选——页面有 button group（`TabButtonGroup`/二级切换）时，把按钮**移出 Header**、与 button group **同行平齐**（`sm:items-center`、`justify-between`）；②否则放 Header 右侧、与**副标题底边对齐**（`sm:items-end`）。两种都**禁止**在 Header 内用 `items-center`（会让按钮浮在 H1 与副标题之间、与副标题错位）。详见 [§04 §4.2](./references/04-page-layout-spec.md)。
- **一行筛选控件高度分两档 ★★**：无 `TabButtonGroup` 时统一 `h-9`；**有** `TabButtonGroup` 时保持默认 group 高度、同行 `Input`/`Select`/`Button` 用 `tabToolbarControlClass`（`h-11`），**禁止**把 group 压成 h-8/h-9 矮版。详见 [§05 §5.4](./references/05-components-and-form-controls.md)、[§06 §6.1](./references/06-reusable-component-catalog.md)。
- **`glass-card` 始终应用，不要 `isGlass &&`**：`glass-card` 已按 `[data-style]` 自动适配纯色/毛玻璃/亮暗。正确写法是直接 `className="glass-card"`。详见 [§03](./references/03-theme-and-styling.md)、[§10 P-2](./references/10-pitfalls-and-performance.md)。
- **强制复用封装组件，禁止手搓**：标题页骨架用 `PinnedPage`；输入框+下拉用 `InputWithDropdown`；标签用 `TagsInput`；多选/单选 Chip 用 `ChipGroup`；切换用 `TabButtonGroup`（主分类+二级筛选用 `dropdown`）；插件图用 `PluginIcon`；后端字段动态渲染用 `DynamicConfigPanel`/`ConfigField`；节点挂文用 `CognitionAttachments`。详见 [§06](./references/06-reusable-component-catalog.md)。
- **自定义 CSS 位于 `@tailwind utilities` 之后 ★★**：`src/index.css` 里的 `.page-pinned` / `.glass-card` 等段落会**压掉同特异性的工具类**。所以 CSS 段落只写 Tailwind 做不到的（`main:has(…)`、media 内 overflow 锁定），`display`/`gap` 等交给组件的工具类，否则调用方的 `gap-4` 会失效。详见 [§10 P-25](./references/10-pitfalls-and-performance.md)、[§10 P-21](./references/10-pitfalls-and-performance.md)。
- **页面里有两层嵌套 `<main>` ★**：`SidebarInset` 自身渲染成 `<main>`，真正的滚动容器是它内部那个。调试/E2E 里取滚动容器要用 `document.querySelector('.layout-page-inner').parentElement`。详见 [§10 P-23](./references/10-pitfalls-and-performance.md)。
- **固定区过宽会被永久裁掉、够不着 ★★**：桌面 `main` 已 `overflow: hidden`，header/toolbar 不再有「页面级横向滚动条」兜底。自检：桌面下 `.layout-page-inner` 的 `scrollWidth - clientWidth` 必须为 `0`。详见 [§10 P-28](./references/10-pitfalls-and-performance.md)。
- **`Badge` 自带 `whitespace-nowrap`，会把同行文本挤成「单字列」★★**：Badge 永不收缩 → 抢走整行宽度，兄弟中文 `<span>` 的 min-content 只有一个字 → 被压成竖条，按钮被顶出屏幕。修法四件套：`flex-col sm:flex-row` 堆叠 + 内层 `flex-wrap` + Badge `whitespace-normal max-w-full` + 按钮 `shrink-0`。注意 en-US/ja-JP 文案更长，**只按中文目测会漏**。详见 [§10 P-29](./references/10-pitfalls-and-performance.md)。
- **demo 模式下 8 个页面必崩，与前端改动无关 ★**：Mock Server 未覆盖 `/api/logs` 等端点，`/logs`、`/ai-budget`、`/backup` 等在 **HEAD 原始代码上同样崩溃**。改完页面若见崩溃，先用「临时换回 HEAD 版本复现」取证再排查。详见 [§10 P-26](./references/10-pitfalls-and-performance.md)。
- **i18n 改一处要改四处**：新增 key 同步 `zh-CN`/`en-US`/`ja-JP` 三个 JSON；新增模块还要改三个 `index.ts`。三语言 leaf key 逐字段对齐。插值用 `t(key, { count })`。详见 [§02](./references/02-i18n.md)。
- **Radix Select 不能用空字符串 value**：用哨兵 `__all__`，调 API 再转回空。详见 [§05](./references/05-components-and-form-controls.md)。
- **Switch 主题色已内置 + Tooltip 包裹会失效**：不要再加 `data-[state=checked]:bg-primary`；被 `TooltipTrigger asChild` 包裹要用 `<span>` 再包一层。详见 [§05](./references/05-components-and-form-controls.md)、[§10 P-5](./references/10-pitfalls-and-performance.md)。
- **配置页脏检查是高发坑**：渐进式配置页要同时比较 `config` 与 `rawConfig`；多请求逐个加载时 `originalConfig` 必须等**全部**加载完再设，否则保存按钮误亮。详见 [§07](./references/07-config-pages-and-state.md)。
- **侧边栏用稳定 `id` 而非 `title` 作 key**：否则切换语言后展开状态丢失。详见 [§09](./references/09-sidebar-navigation.md)。
- **双态 UI 三处同步分支**：暂停/恢复、创建/编辑等场景，动作、图标、文案三者都要按同一条件分支，别只分支动作而把文案写死。详见 [§08](./references/08-page-patterns.md)、[§10 P-4](./references/10-pitfalls-and-performance.md)。
- **三元 + 字符串拼接要加括号**：`a ? x : y + z` 因 `?:` 优先级低于 `+` 会解析成 `a ? x : (y+z)`。详见 [§10 P-1](./references/10-pitfalls-and-performance.md)。
- **API 统一在 `src/lib/api.ts`**：所有请求经封装，类型同文件定义；401 统一用 `getLoginPath()` 跳登录（兼容开发 `/login` 与生产 `/app/login`）。详见 [§01](./references/01-architecture-and-conventions.md)。
- **错误提示必须回显后端消息 ★**：后端错误有封套 `{status,msg}` 与 FastAPI `{detail}`（字符串/校验数组）两类，**只读 `msg` 会漏掉 `detail`**、导致 toast 与真实原因无关。统一用 `getApiErrorMessage(err/res, fallback)` 解析，本地化文案只兜底。详见 [§01 §1.5](./references/01-architecture-and-conventions.md)、[§10 P-13](./references/10-pitfalls-and-performance.md)。
- **任务配置主备双配置 ★★**：高级 / 低级任务各 2 个字段（主 + 备用），但**读写路径不同**——主配置走 `providerConfigApi.setHighLevelConfig(...)`（仅接受 `'high' | 'low'`）；备用配置走 framework-config 的 `updateConfigValue(aiConfig.id, 'high_level_2nd_provider_config_name', v)`。详见 [§07 §7.6](./references/07-config-pages-and-state.md)。
- **网络搜索 / 网页抓取多源 UI ★★**：`WebSearchSection` / `WebFetchSection`——主用 Chip + 策略（none/error_switch/auto_balance）+ 备用有序多选（`showOrderIndex`）；默认主用 **Jina**；策略非 none 才显示备用。主用在备用列表中 **disabled 展示、不写入 fallback 字段**；切换主用时静默剔除；保存时兜底剥离「备用含主用」并用 `applyConfigsAndMarkSaved` 原子同步。字段说明用 `LabelWithHelp`（Markdown tooltip）。详见 [§07 §7.7](./references/07-config-pages-and-state.md)、[§06 §6.4](./references/06-reusable-component-catalog.md)。
- **`/mcp-config` 三种传输 ★**：`stdio`（本地命令）/ `streamable_http`（推荐远程）/ `sse`（旧版远程）。`http` / `type: "http"` 归一为 `streamable_http`。SSE 与 HTTP 共用 URL+headers 表单。`tools`/`args`/`env` 必须 `?? []` / `?? {}`。详见 [§07 §7.8](./references/07-config-pages-and-state.md)。
- **ChipGroup `disabled` 多选可取消 ★**：`option.disabled` 禁止**新勾选**，已选中仍可点掉；用于主用源占位。详见 [§06 §6.4](./references/06-reusable-component-catalog.md)。
- **批量推送 bot_self_id ★**：`/batch-push` 用 `InputWithDropdown` 选手填机器人账号；提交 `push_bot_self_id`，非宏 tag 追加第三段。后端契约见 `webconsole/docs/10-batch-push.md`。
- **Radix Dialog 无障碍 ★★**：每个 `DialogContent` 都必须包含 `DialogTitle` + `DialogDescription`（描述可 `className="sr-only"` 隐藏）。任意一个缺，dev 模式都会刷屏警告。详见 [§08 §8.3](./references/08-page-patterns.md)、[§10 P-16 / P-18](./references/10-pitfalls-and-performance.md)。
- **Hooks 永远在最顶层调用 ★★★**：在 `if` / 三元 / `&&` 分支里调用 `useTheme()` 等会导致"Hooks 顺序变化"警告 + Context 取错值。所有 Hook 在分支前一次性调用，分支内只解构使用。详见 [§10 P-14](./references/10-pitfalls-and-performance.md)。
- **Tailwind 任意值类名歧义**：带 `(` `)` 的 `ease-[cubic-bezier(...)]` 会触发 v3.4 内容扫描器"ambiguous class"误报警告。把 timing function 提到 `tailwind.config.ts` 命名为 `ease-out-soft` 等再引用。详见 [§10 P-15](./references/10-pitfalls-and-performance.md)。
- **后端版本不匹配别误报为前端 bug ★**：调用仅新版后端支持的端点时，识别后端特有错误文案（如"预保留路径名"），降级为 `console.warn` 并提示"请升级 gsuid_core"。详见 [§01 §1.5.1](./references/01-architecture-and-conventions.md)、[§10 P-17](./references/10-pitfalls-and-performance.md)。

## 关联文档（同仓库其他位置）

- WebConsole 后端接口文档：`gsuid_core/webconsole/docs/`（如本地有 gsuid_core 仓库）
- 后端框架开发 SKILL：gsuid_core 仓库 `docs/skills/gscore-development/`
