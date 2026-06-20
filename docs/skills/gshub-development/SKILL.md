---
name: gshub-development
description: >
  当用户要求"开发/维护 GsCore Web 控制台前端（gsuid_hub）"、"新增一个页面 / 配置页 / Tab"、
  "页面排版应该怎么写 / 标题/副标题/图标/页边距怎么排 / p-6 space-y-6 是什么"、
  "主题怎么适配 / glass-card 怎么用 / 毛玻璃 vs 纯色"、"i18n 怎么加翻译 / 三语言怎么同步 /
  index.ts 怎么改 / t() 插值"、"侧边栏怎么加菜单项 / 子菜单 / 展开状态丢失"、
  "Input 和下拉框高度不一致 / 一行筛选组件怎么对齐 / h-9"、
  "InputWithDropdown / TagsInput / ChipGroup / TabButtonGroup / DynamicConfigPanel / ConfigField 怎么用"、
  "Switch 主题色 / Switch 被 Tooltip 包裹失效"、"Radix Select 空值报错"、
  "渐进式配置页 / EXPECTED_CONFIG_KEYS / rawConfig / 预料之外配置项"、
  "保存按钮误亮 / dirty 检查 / originalConfig 竞态"、"卡片列表页 / 表格详情页 / Dialog 弹窗 / 移动端适配"、
  "API 怎么封装 / 401 跳登录 / getLoginPath"、"改前端要注意什么 / 有哪些已知坑 / 性能优化"时触发此 SKILL。
  凡是改动 `src/`（React + TS 前端控制台）的任务都应优先读取此 SKILL。

  面向 **GsCore Web 控制台（gsuid_hub，前端 React 项目）开发者与维护者**的系统级开发规范指南。
  与后端框架 SKILL（`gscore-development` 等，位于 gsuid_core 仓库）不同，本 SKILL 讲的是
  **前端工程自身的设计约束与组件契约**：技术栈与目录结构、路由、API 层封装与 401、i18n 三语言同步、
  主题系统（ThemeContext / CSS HSL 变量 / glass-card 自动适配）、页面排版铁律（页面解剖学：
  p-6 space-y-6 / text-3xl 标题 / 内联 w-8 h-8 图标 / 副标题 / 间距标尺 / 三态）、表单与筛选控件
  统一规范（统一 h-9、Radix Select 哨兵、Tooltip 字段说明、Switch UX）、强制复用的封装组件目录
  （TabButtonGroup / InputWithDropdown / TagsInput / ChipGroup / DynamicConfigPanel）、渐进式配置页
  与脏检查竞态、几类页面模式（卡片列表 / 表格详情 / Dialog / 移动端）、侧边栏多级菜单与稳定 id，
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
| 五 | 组件复用与表单/筛选控件规范（cn/CVA、**一行统一 h-9**、Select 哨兵、Tooltip 字段说明、Switch UX） | [references/05-components-and-form-controls.md](./references/05-components-and-form-controls.md) |
| 六 | 封装组件目录（完整接口）——TabButtonGroup / InputWithDropdown / TagsInput / ChipGroup / DynamicConfigPanel / ConfigField | [references/06-reusable-component-catalog.md](./references/06-reusable-component-catalog.md) |
| 七 | 配置页与状态管理（渐进式配置页 + `EXPECTED_CONFIG_KEYS`/`rawConfig`、双重 dirty 检查、保存竞态、AIConfig 设计） | [references/07-config-pages-and-state.md](./references/07-config-pages-and-state.md) |
| 八 | 页面模式与 Dialog 规范（卡片列表页 / 表格详情 / Dialog/Modal / 双态 UI / 移动端 / SSH URL / API 设计经验） | [references/08-page-patterns.md](./references/08-page-patterns.md) |
| 九 | 侧边栏与导航（`getNavItems`、稳定 `id` 作 key、`ICON_MAP`、AI 启用态条件子菜单、自动展开） | [references/09-sidebar-navigation.md](./references/09-sidebar-navigation.md) |
| 十 | 已知坑 + 性能 + 落地清单（P-1~P-12 坑、性能优化、新页面落地自查清单总表） | [references/10-pitfalls-and-performance.md](./references/10-pitfalls-and-performance.md) |

## 推荐阅读顺序（按需跳转）

1. **第一次接触本前端**：先看 [一、架构与工程约定](./references/01-architecture-and-conventions.md) 建立心智模型。
2. **新增一个页面**：依次过 [四、排版铁律](./references/04-page-layout-spec.md) → [五、控件规范](./references/05-components-and-form-controls.md) / [六、组件目录](./references/06-reusable-component-catalog.md) → [二、i18n](./references/02-i18n.md) → [九、侧边栏](./references/09-sidebar-navigation.md)。
3. **做配置类页面**：重点看 [七、配置页与状态](./references/07-config-pages-and-state.md)（dirty 检查竞态是最容易踩的坑）。
4. **做列表/详情/弹窗类页面**：看 [八、页面模式](./references/08-page-patterns.md)。
5. **改主题/样式**：看 [三、主题与样式](./references/03-theme-and-styling.md)。
6. **动手前必读**：[十、已知坑 + 性能 + 落地清单](./references/10-pitfalls-and-performance.md)——这一章是"别人替你踩过的坑"，写代码前过一遍能省大量返工。

## 关键概念速记（先看这一段再决定读哪一章）

- **页面共享同一套排版骨架**：所有页面根容器统一 `p-6 space-y-6`，**不得**加 `max-w-7xl mx-auto`；标题统一 `text-3xl font-bold` + 内联图标 `w-8 h-8`（**不加**背景容器），副标题 `text-muted-foreground mt-1`（**不加** `text-sm`）。参考页 `AISkillsPage` / `AIMemoryPage`。详见 [§04](./references/04-page-layout-spec.md)。
- **一行筛选控件高度必须统一 h-9**：`Input` 默认 `h-10`、`SelectTrigger` 默认 `h-9`、`Button` 默认 `h-10`——同行并排不显式 `h-9` 就会高低不齐（搜索框+下拉+按钮的工具栏是重灾区）。详见 [§05](./references/05-components-and-form-controls.md)。
- **`glass-card` 始终应用，不要 `isGlass &&`**：`glass-card` 已按 `[data-style]` 自动适配纯色/毛玻璃/亮暗。正确写法是直接 `className="glass-card"`。详见 [§03](./references/03-theme-and-styling.md)、[§10 P-2](./references/10-pitfalls-and-performance.md)。
- **强制复用封装组件，禁止手搓**：输入框+下拉用 `InputWithDropdown`；标签用 `TagsInput`；多选/单选 Chip 用 `ChipGroup`；切换用 `TabButtonGroup`；后端字段动态渲染用 `DynamicConfigPanel`/`ConfigField`。详见 [§06](./references/06-reusable-component-catalog.md)。
- **i18n 改一处要改四处**：新增 key 同步 `zh-CN`/`en-US`/`ja-JP` 三个 JSON；新增模块还要改三个 `index.ts`。三语言 leaf key 逐字段对齐。插值用 `t(key, { count })`。详见 [§02](./references/02-i18n.md)。
- **Radix Select 不能用空字符串 value**：用哨兵 `__all__`，调 API 再转回空。详见 [§05](./references/05-components-and-form-controls.md)。
- **Switch 主题色已内置 + Tooltip 包裹会失效**：不要再加 `data-[state=checked]:bg-primary`；被 `TooltipTrigger asChild` 包裹要用 `<span>` 再包一层。详见 [§05](./references/05-components-and-form-controls.md)、[§10 P-5](./references/10-pitfalls-and-performance.md)。
- **配置页脏检查是高发坑**：渐进式配置页要同时比较 `config` 与 `rawConfig`；多请求逐个加载时 `originalConfig` 必须等**全部**加载完再设，否则保存按钮误亮。详见 [§07](./references/07-config-pages-and-state.md)。
- **侧边栏用稳定 `id` 而非 `title` 作 key**：否则切换语言后展开状态丢失。详见 [§09](./references/09-sidebar-navigation.md)。
- **双态 UI 三处同步分支**：暂停/恢复、创建/编辑等场景，动作、图标、文案三者都要按同一条件分支，别只分支动作而把文案写死。详见 [§08](./references/08-page-patterns.md)、[§10 P-4](./references/10-pitfalls-and-performance.md)。
- **三元 + 字符串拼接要加括号**：`a ? x : y + z` 因 `?:` 优先级低于 `+` 会解析成 `a ? x : (y+z)`。详见 [§10 P-1](./references/10-pitfalls-and-performance.md)。
- **API 统一在 `src/lib/api.ts`**：所有请求经封装，类型同文件定义；401 统一用 `getLoginPath()` 跳登录（兼容开发 `/login` 与生产 `/app/login`）。详见 [§01](./references/01-architecture-and-conventions.md)。

## 关联文档（同仓库其他位置）

- WebConsole 后端接口文档：`gsuid_core/webconsole/docs/`（如本地有 gsuid_core 仓库）
- 后端框架开发 SKILL：gsuid_core 仓库 `docs/skills/gscore-development/`
