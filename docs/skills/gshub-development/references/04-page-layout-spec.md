# 四、页面排版铁律（页面解剖学）

> 返回 [SKILL 主入口](../SKILL.md)。
> **全站所有页面共享同一套排版骨架**，这是设计一致性的根基。新页面必须逐项对齐本章。
> 排版标准参考页：[`AISkillsPage.tsx`](../../../../src/pages/AISkillsPage.tsx)、[`AIMemoryPage.tsx`](../../../../src/pages/AIMemoryPage.tsx)。

## 4.0 一张图看懂页面骨架

```
┌─ AppLayout <main overflow-auto> ───────────────────────────────┐
│  ┌─ .layout-page-inner ─────────────────────────────────────┐  │
│  │  pt: --layout-page-top（大于侧栏 gutter，顶部呼吸距）       │  │
│  │  px/pb: --layout-gutter                                   │  │
│  │  ┌─ <PinnedPage> 标题页（默认，占全站 26 个页面）───────┐  │  │
│  │  │  .page-pinned-header  ← 桌面常驻，永不滚动           │  │  │
│  │  │  .page-pinned-body    ← 桌面唯一滚动容器             │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │  ┌─ .page-fill.glass-card 全高单卡片 ───────────────────┐  │  │
│  │  │  （负 margin 拉回与侧栏外框对齐；overflow 在内层）     │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## 4.1 页面根容器

**「H1 + 副标题 + 竖向内容流」的标题页一律用 `<PinnedPage>`**（见 [§4.1.0](#410-pinnedpage--固定标题页默认骨架-)），
不要再手写 `<div className="space-y-6">` 根容器：

```tsx
{/* 标题页（默认）：标题区桌面常驻，只有下方内容滚动 */}
<PinnedPage header={<div>{/* H1 + 副标题 + 同行按钮 */}</div>}>
  {/* 筛选区、卡片、列表…… */}
</PinnedPage>

{/* 全高单卡片：阴影宿主不要 overflow-hidden */}
<div className="page-fill flex glass-card">
  <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
    {/* 列表 + 详情 */}
  </div>
</div>
```

### 4.1.0 PinnedPage —— 固定标题页（默认骨架）★★★

位置：[`src/components/layout/PinnedPage.tsx`](../../../../src/components/layout/PinnedPage.tsx)，
CSS 机制在 `src/index.css` 的 `.page-pinned` 段落。

**行为**：
- **桌面（≥768px）**：`main` 的竖直滚动被锁死，标题区（H1 + 副标题 + **与标题同行**的右侧按钮）常驻视口，
  只有 `.page-pinned-body` 滚动。页面只有一条滚动条。
- **移动端（<768px）**：整块退化为普通流式布局，标题随内容一起滚走（`main` 恢复 `overflow: auto`）。
  移动端竖向空间稀缺——标题块堆叠后约 150px，占 667px 屏的 ~22%，常驻不划算；且锁死 `main`
  会让整页无法滚动（与 `.page-viewport` 的既定约定一致）。

```tsx
import { PinnedPage } from '@/components/layout/PinnedPage';

<PinnedPage
  header={
    /* 固定区一：标题块 + 与标题同行的右侧操作按钮 */
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 overflow-x-auto">
        <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
          <Wrench className="w-8 h-8 shrink-0" />
          {t('aiTools.title')}
        </h1>
        <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiTools.description')}</p>
      </div>
      <Button className="self-start sm:self-auto shrink-0">{t('…action')}</Button>
    </div>
  }
  toolbar={
    /* 固定区二（可选）：紧贴标题下方的操作控件行 */
    <TabButtonGroup options={tabOptions} value={tab} onValueChange={setTab} />
  }
>
  {/* 滚动区：卡片、列表、Dialog…… */}
</PinnedPage>
```

| Prop | 作用 |
|------|------|
| `header` | **固定区一**。只放标题块 + 与标题**同行**的右侧按钮 |
| `toolbar` | **固定区二（可选）**。紧贴标题下方的**操作控件行**——判定标准见下 |
| `children` | 滚动区内容 |
| `bodyClassName` | 滚动区布局类，默认 `space-y-6`。原来是 `space-y-3` / `space-y-4` 的页面原样传入 |
| `className` | 根容器附加类，默认 `gap-6`——**同时**决定「标题↔控件行↔内容」三段间距。传 `gap-3`/`gap-4` 覆盖（`cn` 用 tailwind-merge，后传的赢） |

#### toolbar 放什么：「操作控件」进，「数据展示」留 ★★★

紧贴标题下方那一块，按**它是不是操作控件**决定去留——这是全站一致性的关键判断：

| 放进 `toolbar`（随标题常驻） | 留在 `children`（跟着滚） |
|---------------------------|------------------------|
| `TabButtonGroup` / 二级切换（/ai-knowledge 的「文本知识 / 图片知识」） | 统计卡片 / 数据看板（/ai-memory、/dashboard、/scheduler 的 Stats） |
| 筛选 + 搜索栏（/ai-capability-agents 的来源 Tab，含 plugin **dropdown** 二级筛选 + 搜索） | 提示 banner / 错误提示（/persona-config 的全局启用提示、/ai-skills 的错误卡） |
| 与控件行同行的操作按钮（/themes 的「保存为预设」） | 结果展示（/mcp-config 的 Reload Result） |
| 两级导航控件（/database 的插件选择 + 数据表选择） | 表单卡片、列表、详情（/core-config、/settings） |

当前 **13 个**页面有 `toolbar`：`/ai-knowledge`、`/ai-capability-agents`、`/ai-approvals`、`/ai-budget`、
`/ai-tools`、`/backup`、`/console`、`/database`、`/framework-config`、`/git-update`、`/plugin-store`、
`/plugins`、`/themes`；其余 13 个标题页下方是数据展示，不传 `toolbar`。

**要点**：
- `toolbar` 可直接传条件表达式，falsy 时整段不渲染、**也不会多出一段 gap**：
  `toolbar={!isLoading && cats.length > 0 && <div>…</div>}`（/ai-tools 即如此）。
- 多个控件行要**自己包一层**给间距（`toolbar={<div className="space-y-6">…</div>}`），
  因为 `.page-pinned-toolbar` 只是个普通容器（/database、/plugin-store 是例子）。
- 结构是**扁平单层 flex column**：header / toolbar / body 三者同级、共用根容器的同一个 `gap`，
  因此间距节奏与迁移前的 `space-y-6`（三者同为 space-y 兄弟）逐像素一致，不需要给控件行单开 gap 属性。

**迁移口诀**：原 `<div className="space-y-N">` → `<PinnedPage bodyClassName="space-y-N" className="gap-N">`；
第一个子元素（标题块）挪进 `header={…}`；若紧随其后的是**操作控件行**，再把它挪进 `toolbar={…}`；
根闭合 `</div>` → `</PinnedPage>`。`children` 的缩进不变，只有 header / toolbar 块 +2。

⚠️ **`header={…}` / `toolbar={…}` 里的注释要用 `/* */` 而非 `{/* */}`**：它们是 JS 表达式上下文，
写 `{/* Header */}` 等于塞了两个表达式 → 语法错误。

**哪些页面不套 PinnedPage**（三个例外，见 [§4.1.1](#411-两类页面的边距设计语言-)）：
- 无标题的全高单卡片页（`/ai-history`、`/session-management`、`/live-chat`）→ `.page-fill`；
- 有标题但页面内部自管滚动（`/ai-kanban` 横向看板）→ `.page-viewport`；
- 首页 `/home`：H1 是 hero 大标题（`text-3xl font-black … lg:text-5xl`）而非页面 Header，不属于标题页；
- `/ai-config`：自带 `flex-1 min-h-0 flex flex-col` + `shrink-0` 头部的全高卡片布局，**已经**是固定标题，
  但它是「隐式」锁高（靠 `.layout-page-inner` 撑满）且**没有做移动端 media 降级**——属于历史遗留，
  改动前先读懂它的 ScrollArea 结构，不要盲目套 PinnedPage。

- **普通页顶部**用 `--layout-page-top`（默认 `2.75rem`），**不要**与侧栏顶对齐。
- **中缝**约 `2×gutter` 呼吸距；`.page-fill` 在悬浮模式下拉回 `1×gutter` 与侧栏对齐。
- **阴影**：`.glass-card` 用 `::before`（`z-index: -1`）画毛玻璃，宿主只画圆角阴影；**禁止**在 glass-card 宿主上写 `overflow-hidden`，也**禁止**对子元素强制 `position: relative`（会破坏 absolute 装饰层）。
- **卡片网格**外圈加 `glass-card-grid`；紧凑控件（`TabButtonGroup`）自带 `shadow-safe`。
- CSS 已对 `.layout-page-inner .overflow-x-auto` 注入 `--shadow-bleed` 内边距（因 `overflow-x` 会连带裁切竖直阴影）。
- **全高单卡片**根节点加 `.page-fill`：`main:has(.page-fill)` 会把上下 padding 收成 gutter，与悬浮侧栏顶底对齐；**标题页不要**加 `page-fill`（保持 `--layout-page-top`）。
- 页面根 **禁止** 再写 `p-6` / `overflow-auto`（滚动交给 AppLayout main）。

### 4.1.1 三类页面的边距设计语言 ★★★

全站页面按外框形态分**三类**，边距各有对齐目标，这是「视觉统一感」的来源：

| 页面类型 | 例子 | 上边距 | 下/左/右 | 对齐目标 |
|---------|------|--------|---------|---------|
| **标题页**（`<PinnedPage>`，H1 + 内容流） | /plugins、/ai-skills、/ai-tools | `--layout-page-top`（2.75rem） | `--layout-gutter`（1.5rem） | 标题上方留足呼吸距，**不**与侧栏顶平齐（平齐会显得顶死） |
| **全高单卡片页**（`.page-fill`） | /ai-history、会话管理、/live-chat | `--layout-gutter` | `--layout-gutter` | 卡片外框**四边与悬浮侧栏卡片对齐**：顶=侧栏顶、底=侧栏底、中缝=侧栏左右外距 |
| **视口锁定标题页**（`.page-viewport`） | /ai-kanban | `--layout-page-top` | `--layout-gutter` | 有标题但页面内部自管滚动（横向看板） |

判定标准：
- 页面是「标题 + 若干卡片往下排」→ **标题页**，用 `<PinnedPage>`（默认选择，占全站绝大多数）。
- 页面唯一的表面层就是一张撑满视口的大卡片（内部自己分栏/滚动）→ `.page-fill`。
- 有标题、但滚动形态特殊（横向看板、列内滚）→ `.page-viewport`。

三者的 CSS 都靠 `main:has(.xxx)` 选择器锁 `main` 的滚动，**互斥、不要叠加**。

**第三种：视口锁定标题页（`.page-viewport`）**，如 `/ai-kanban`：有标题但整页高度锁死视口、**main 不再竖直滚动**，滚动全部发生在页面内部（看板列内滚、底部横向滚动条始终贴视口底端）。写法：

```tsx
<div className="page-viewport flex flex-1 min-h-0 flex-col gap-4">
  <div>{/* H1 + 副标题 */}</div>
  <Card className="glass-card shrink-0">{/* 筛选区 */}</Card>
  {/* 横滚容器：flex-1 吃掉剩余高度 → 横向滚动条落在视口底端；
      加大 --shadow-bleed 给列卡片阴影留位 */}
  <div className="min-h-0 flex-1 overflow-x-auto [--shadow-bleed:1.5rem]">
    <div className="flex h-full min-w-max gap-4">
      {/* 每列：h-full 定高，任务列表 min-h-0 flex-1 overflow-y-auto 内滚 */}
    </div>
  </div>
</div>
```

要点：`main:has(.page-viewport)` 会锁 main 滚动并把 `.layout-page-inner` 撑满高度（保留 `--layout-page-top` 顶距）；页面内所有中间层都要 `min-h-0` 才能把高度约束传到内滚容器；列表/看板列**固定高度 + 内部滚动**，不要让内容无限撑长页面。

⚠️ **视口锁定仅桌面（≥768px）生效**：移动端标题/筛选区堆叠后极易超出视口高度，锁死 main 会让整页无法滚动。CSS 已把 `main:has(.page-viewport)` 规则包在 `@media (min-width: 768px)` 内——移动端自动退回普通滚动页，此时内滚区域要自己给**移动端高度上限**（如看板列 `max-h-[70dvh] md:max-h-none`），否则 `h-full` 对 auto 高度父级不生效、内容会无限撑长。

新增页面时的取值全部走 CSS 变量（`src/index.css` `:root`），**不要**在页面里写死 px/rem：

- `--layout-gutter: 1.5rem` — 悬浮侧栏四边、内容区左右下、page-fill 四边。
- `--layout-page-top: 2.75rem` — 标题页顶部呼吸距。
- `--shadow-bleed: 0.75rem` — 阴影安全区（见下）。

### 4.1.2 阴影不被裁切的三件套 ★★

`.glass-card` 阴影会外溢约 8–12px，任何 `overflow` 容器都会把它切成直角。三个工具：

1. **`glass-card-grid`**：卡片网格外圈加，竖直方向负 margin + padding 留出阴影位（水平不加，保证与下方全宽控件右缘对齐）。
2. **`shadow-safe`**：任意需要竖直阴影安全区的容器（TabButtonGroup 已内置）。
3. **`.layout-page-inner .overflow-x-auto` 自动注入**：标题行 `min-w-0 overflow-x-auto` 这类横滚容器免手工处理。

### 4.1.3 glass-card 内的全出血子元素（图片头/表格/色条） ★★

glass-card 宿主不裁切（`overflow: visible`），所以**顶到卡片边缘的方角子元素要自己贴合圆角**：

```tsx
{/* 卡片顶部图片区：自己继承上圆角 */}
<Card className="glass-card">
  <div className="relative aspect-square overflow-hidden rounded-t-[inherit]">…</div>
</Card>

{/* 卡片内滚动表格：滚动裁切放内层并继承圆角 */}
<div className="rounded-lg glass-card">
  <div className="overflow-auto max-h-[400px] rounded-[inherit]">…</div>
</div>
```

- 非 glass-card 的普通容器（终端卡、日志框等）**照常用 `overflow-hidden`**，该约束只针对带阴影的 `.glass-card` / `.floating-sidebar` 宿主。
- `.glass-card-flat` 无阴影，`overflow-hidden` 安全，可直接加（如 RepeatGroupField 裁顶部色条）。

## 4.2 页面标题区域（Header）

```tsx
{/* 有右侧操作按钮时：底部对齐（items-end），并做移动端响应式堆叠 */}
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div className="min-w-0">
    <h1 className="text-3xl font-bold flex items-center gap-3">
      <Wallet className="w-8 h-8 shrink-0" />
      {t('aiBudget.title')}
    </h1>
    <p className="text-muted-foreground mt-1">{t('aiBudget.description')}</p>
  </div>
  {/* 右侧操作区（可选）：保存/刷新/新建按钮等 */}
  <Button className="self-start sm:self-auto shrink-0">…</Button>
</div>
```

| 元素 | 固定规范 |
|------|----------|
| 容器 | `flex items-end justify-between`（标题左、操作区右）。**只有标题、无右侧操作时**可退化为 `flex items-center justify-between` |
| 标题 H1 | `text-3xl font-bold`，且 `flex items-center gap-3` 内联图标 |
| 标题图标 | **直接用图标组件** `className="w-8 h-8"`，**不加**任何背景容器（`rounded-xl bg-primary/10` 等） |
| 副标题 | `<p className="text-muted-foreground mt-1">`，**不加** `text-sm`（继承默认字号） |
| 右侧操作区 | 放页面级动作按钮；与 Tab 联动时按 `activeTab` 条件渲染 |

### 页面级操作按钮的放置：优先与 button group 平齐，否则与副标题底边对齐 ★★

页面级操作按钮（保存/新建/刷新等）有**两种**合规摆放位置，按以下优先级选择：

**① 首选——与 button group 同行平齐**（页面在标题下方紧跟 `TabButtonGroup` / 二级切换时）：
把操作按钮**从 Header 移出**，与 button group 放在**同一行**、垂直居中（`items-center`、`justify-between`）。这样按钮顶到 Tab 行、不占额外竖向空间，视觉更紧凑统一。**仅在 button group 那一行有足够横向空间、不挤压 Tab 时**采用。

```tsx
{/* 标题块：纯 H1 + 副标题，无右侧操作 */}
<div className="min-w-0">
  <h1 className="text-3xl font-bold flex items-center gap-3"><Palette className="w-8 h-8 shrink-0" />{t('…title')}</h1>
  <p className="text-muted-foreground mt-1">{t('…description')}</p>
</div>

{/* button group 与操作按钮同行平齐 */}
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <TabButtonGroup options={tabOptions} value={tab} onValueChange={…} />
  <Button className="self-start sm:self-auto shrink-0">{t('…action')}</Button>
</div>
```

**② 退路——放在 Header，与副标题底边对齐**（页面**没有** button group，或那一行放不下/会挤压 Tab 时）：
按钮放回 Header 右侧，容器用底部对齐 `items-end`（响应式 `sm:items-end`），让**按钮底边与副标题（`<p>`）底边落在同一条水平线上**。

```tsx
// ✅ 正确：按钮底边与副标题底边对齐
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div><h1 …/><p className="text-muted-foreground mt-1">…</p></div>
  <Button className="self-start sm:self-auto shrink-0">保存</Button>
</div>
```

> **共同禁忌**：标题块是「H1 + 副标题」两行，高度大于单行按钮。在 Header 里用 `items-center` 会让按钮**垂直居中**到 H1 与副标题之间，「浮在半空」、与副标题错位——**禁止**。
> - 响应式统一：移动端堆叠用 `flex-col` + 按钮 `self-start`；`sm:` 起恢复 `sm:flex-row` + 按钮 `sm:self-auto`。
> - 仅当 Header **没有**右侧操作区（纯标题块）时，Header 对齐方式才无所谓，可用 `items-center`。

## 4.3 反面示例（禁止使用）

```tsx
<h1 className="text-2xl font-bold">                          {/* ❌ 字号过小，应 text-3xl */}
<div className="w-10 h-10 rounded-xl bg-primary/10">         {/* ❌ 图标带背景容器 */}
  <Icon className="w-5 h-5 text-primary" /></div>
<p className="text-muted-foreground mt-1 text-sm">           {/* ❌ 副标题加了 text-sm */}
<div className="p-6 space-y-6 max-w-7xl mx-auto">            {/* ❌ 根容器写页边距 / 加宽度限制 */}
<div className="space-y-6 p-4 md:p-6">                       {/* ❌ 根容器写页边距（已由 AppLayout 提供） */}
<div className="space-y-6 flex-1 overflow-auto h-full">      {/* ❌ 根容器自己滚动（滚动在 PinnedPage body / AppLayout main） */}
<Card className="glass-card overflow-hidden">                {/* ❌ glass-card 宿主裁切（阴影/圆角脏边） */}

{/* ❌ 标题页手写根容器：标题不会固定，与全站 26 个页面不一致 */}
<div className="space-y-6">
  <div><h1 …/><p …/></div>
  …
</div>

{/* ❌ header/toolbar 里用 JSX 注释：它们是 JS 表达式上下文 → 语法错误 */}
<PinnedPage header={ {/* Header */} <div …/> }>

{/* ❌ 把控件行塞进 header：会和标题挤在同一段，破坏 Header 的对齐规范。
       控件行有专门的 toolbar 槽 */}
<PinnedPage header={<><div><h1 …/></div><TabButtonGroup … /></>}>

{/* ❌ 把统计卡 / 看板塞进 toolbar：数据展示应该跟着滚，常驻会白吃视口高度 */}
<PinnedPage toolbar={<div className="grid grid-cols-4 gap-4"><StatsCard …/></div>}>

{/* ❌ 控件行留在 children：滚两下切换器就不见了，只固定标题等于半个功能 */}
<PinnedPage header={<div><h1 …/></div>}>
  <TabButtonGroup … />
  …
</PinnedPage>
```

## 4.4 间距 / 尺寸标尺（统一记忆）

| 场景 | 类 |
|------|-----|
| 页面根容器内边距 | **不写**（由 AppLayout `.layout-page-inner` 统一提供） |
| 页面块间距 | `space-y-6` |
| 卡片网格间距 | `gap-4` |
| 表单字段组内间距 | `space-y-2`（Label + 控件）；分组 `space-y-4` |
| 卡片内边距 | `CardContent` 默认；紧凑工具栏用 `py-3` |
| 一行筛选/表单控件高度 | `h-9`（见 [§05](./05-components-and-form-controls.md)） |
| 标题图标 | `w-8 h-8` ／ 卡片小标题 `w-5 h-5` ／ 按钮内 `w-4 h-4` |
| 图标-文字间距 | 标题 `gap-3`，小标题/按钮 `gap-2` |

## 4.5 卡片区 / 分区标题

内容用 `Card`（始终 `className="glass-card"`，见 [§03](./03-theme-and-styling.md)）组织，卡片标题带 `w-5 h-5` 图标：

```tsx
<Card className="glass-card">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Gauge className="w-5 h-5" />
      {t('aiBudget.config.countMode')}
    </CardTitle>
    <CardDescription>{t('aiBudget.config.countModeDesc')}</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">…</CardContent>
</Card>
```

多卡片网格：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`（统计卡）/ `grid grid-cols-1 lg:grid-cols-2 gap-4`（双列）。

### 分区小标题图标规范

- **图标只加在「打开的卡片/弹窗」的分区标题上**（`CardTitle`、`DialogTitle`、弹窗内分区 `Label`）。
- **卡片列表页面本身的列表项小标题不加图标**。
- 统一 `flex items-center gap-2` + `w-5 h-5`（弹窗主标题可 `gap-3`）。

## 4.6 列表页面与详情页

### 表格行点击打开详情

表格列表页：**点击任意行**应打开二级详情页（不要只靠编辑按钮）。

```tsx
<TableRow className="cursor-pointer" onClick={() => handleViewDetail(item)}>
  <TableCell>…</TableCell>
  <TableCell>
    {/* 操作按钮阻止冒泡 */}
    <Button onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
      <Pencil className="w-4 h-4" />
    </Button>
  </TableCell>
</TableRow>
```

### 二级详情/弹窗标题

```tsx
<DialogHeader>
  <DialogTitle className="flex items-center gap-3">
    <MessageSquare className="w-5 h-5" />
    {selected?.title}
  </DialogTitle>
</DialogHeader>
<div className="space-y-4 py-4">
  <div className="border-b pb-2">
    <Label className="text-muted-foreground">{t('…descField')}</Label>
    <p className="mt-1">{selected?.desc}</p>
  </div>
</div>
```

字段按逻辑分组，用 `<Separator />` 或 `border-b` 分隔，分组间距 `space-y-4`/`gap-4`。

## 4.7 加载态 / 空态 / 错误态（统一三态）

每个数据区块都应处理三态：

```tsx
if (loading) return <XxxSkeleton />;                         // 骨架屏（Skeleton 组件）
if (error)   return <ErrorCard onRetry={refetch} />;         // 错误 + 重试按钮
if (items.length === 0) return <EmptyState icon={…} />;      // 空态：居中图标 + 文案
```

- 骨架屏用 `Skeleton`，形状贴近真实内容（卡片用 `h-24 rounded-lg` 等）。
- 错误态：`<p className="text-muted-foreground">{error}</p>` + `<Button variant="outline" onClick={retry}><RefreshCw …/>重试</Button>`。
- 空态：居中 `w-8 h-8 text-muted-foreground` 图标 + 说明文字，`py-8 text-center`。

## 4.8 落地自查（页面骨架部分）

- [ ] 根容器：标题页用 `<PinnedPage>`（**无** `p-6` / `overflow-auto` / `max-w-*`）；全高单卡片页 `page-fill flex glass-card` + 内层 clip
- [ ] `header={…}` 只放标题块 + 同行按钮
- [ ] 标题下方若是**操作控件行**（TabButtonGroup / 筛选搜索）→ 放 `toolbar={…}`；若是**数据展示**（统计卡/看板/提示 banner）→ 留在 `children`
- [ ] 原 `space-y-N` / 间距不是 6 的页面，把 `bodyClassName="space-y-N"` + `className="gap-N"` 传全
- [ ] `header={…}` / `toolbar={…}` 内注释用 `/* */`，不是 `{/* */}`
- [ ] 卡片网格加 `glass-card-grid`；glass-card 宿主无 `overflow-hidden`，全出血子元素 `rounded-t-[inherit]`
- [ ] 标题 `text-3xl font-bold` + 内联图标 `w-8 h-8`（无背景容器）
- [ ] 副标题 `text-muted-foreground mt-1`（无 `text-sm`）
- [ ] 页面级操作按钮：有 button group 时与其同行平齐（`sm:items-center`）；否则放 Header 与副标题底边对齐（`sm:items-end`）。**禁止** Header 内 `items-center` 让按钮浮在两行之间
- [ ] 卡片一律 `className="glass-card"`
- [ ] 卡片/弹窗分区标题带 `w-5 h-5` 图标；列表项小标题不带
- [ ] loading / error / empty 三态齐全
