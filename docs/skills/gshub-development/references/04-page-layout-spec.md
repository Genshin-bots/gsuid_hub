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
│  │  ┌─ space-y-6 普通页 ──────────────────────────────────┐  │  │
│  │  │  Header / Cards …                                    │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │  ┌─ .page-fill.glass-card 全高单卡片 ───────────────────┐  │  │
│  │  │  （负 margin 拉回与侧栏外框对齐；overflow 在内层）     │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## 4.1 页面根容器

```tsx
{/* 普通多卡片页：顶部呼吸距由 layout-page-inner 提供 */}
<div className="space-y-6">
  {/* 页面内容 */}
</div>

{/* 全高单卡片：阴影宿主不要 overflow-hidden */}
<div className="page-fill flex glass-card">
  <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
    {/* 列表 + 详情 */}
  </div>
</div>
```

- **普通页顶部**用 `--layout-page-top`（默认 `2.75rem`），**不要**与侧栏顶对齐。
- **中缝**约 `2×gutter` 呼吸距；`.page-fill` 在悬浮模式下拉回 `1×gutter` 与侧栏对齐。
- **阴影**：`.glass-card` 用 `::before`（`z-index: -1`）画毛玻璃，宿主只画圆角阴影；**禁止**在 glass-card 宿主上写 `overflow-hidden`，也**禁止**对子元素强制 `position: relative`（会破坏 absolute 装饰层）。
- **卡片网格**外圈加 `glass-card-grid`；紧凑控件（`TabButtonGroup`）自带 `shadow-safe`。
- CSS 已对 `.layout-page-inner .overflow-x-auto` 注入 `--shadow-bleed` 内边距（因 `overflow-x` 会连带裁切竖直阴影）。
- **全高单卡片**根节点加 `.page-fill`：`main:has(.page-fill)` 会把上下 padding 收成 gutter，与悬浮侧栏顶底对齐；**标题页不要**加 `page-fill`（保持 `--layout-page-top`）。
- 页面根 **禁止** 再写 `p-6` / `overflow-auto`（滚动交给 AppLayout main）。

### 4.1.1 两类页面的边距设计语言 ★★★

全站页面按外框形态分**两类**，边距各有对齐目标，这是「视觉统一感」的来源：

| 页面类型 | 例子 | 上边距 | 下/左/右 | 对齐目标 |
|---------|------|--------|---------|---------|
| **标题页**（H1 + 多卡片流） | /plugins、/ai-skills | `--layout-page-top`（2.75rem） | `--layout-gutter`（1.5rem） | 标题上方留足呼吸距，**不**与侧栏顶平齐（平齐会显得顶死） |
| **全高单卡片页**（`.page-fill`） | /ai-history、会话管理 | `--layout-gutter` | `--layout-gutter` | 卡片外框**四边与悬浮侧栏卡片对齐**：顶=侧栏顶、底=侧栏底、中缝=侧栏左右外距 |

判定标准：页面唯一的表面层就是一张撑满视口的大卡片（内部自己分栏/滚动）→ 用 `.page-fill`；页面是「标题 + 若干卡片往下排、整页滚动」→ 标题页，什么都不用加。

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
<div className="space-y-6 flex-1 overflow-auto h-full">      {/* ❌ 根容器自己滚动（滚动在 AppLayout main） */}
<Card className="glass-card overflow-hidden">                {/* ❌ glass-card 宿主裁切（阴影/圆角脏边） */}
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

- [ ] 根容器：标题页 `space-y-6`（**无** `p-6` / `overflow-auto` / `max-w-*`）；全高单卡片页 `page-fill flex glass-card` + 内层 clip
- [ ] 卡片网格加 `glass-card-grid`；glass-card 宿主无 `overflow-hidden`，全出血子元素 `rounded-t-[inherit]`
- [ ] 标题 `text-3xl font-bold` + 内联图标 `w-8 h-8`（无背景容器）
- [ ] 副标题 `text-muted-foreground mt-1`（无 `text-sm`）
- [ ] 页面级操作按钮：有 button group 时与其同行平齐（`sm:items-center`）；否则放 Header 与副标题底边对齐（`sm:items-end`）。**禁止** Header 内 `items-center` 让按钮浮在两行之间
- [ ] 卡片一律 `className="glass-card"`
- [ ] 卡片/弹窗分区标题带 `w-5 h-5` 图标；列表项小标题不带
- [ ] loading / error / empty 三态齐全
