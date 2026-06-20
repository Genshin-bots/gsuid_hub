# 四、页面排版铁律（页面解剖学）

> 返回 [SKILL 主入口](../SKILL.md)。
> **全站所有页面共享同一套排版骨架**，这是设计一致性的根基。新页面必须逐项对齐本章。
> 排版标准参考页：[`AISkillsPage.tsx`](../../../../src/pages/AISkillsPage.tsx)、[`AIMemoryPage.tsx`](../../../../src/pages/AIMemoryPage.tsx)。

## 4.0 一张图看懂页面骨架

```
┌─ <div className="p-6 space-y-6"> ──────────────────────────────┐  ← 根容器：固定 p-6 + space-y-6
│                                                                  │
│  ┌─ Header（flex items-center justify-between）───────────────┐  │
│  │  <Icon w-8 h-8>  H1(text-3xl font-bold)        [操作按钮]   │  │  ← 标题区
│  │  P(text-muted-foreground mt-1)  ← 副标题                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ TabButtonGroup（可选，多 Tab 页面）─────────────────────┐  │  ← 二级切换
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ 工具栏 / 筛选行（可选）── Input(h-9) Select(h-9) Btn(h-9) ┐  │  ← 控件统一 h-9
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Card.glass-card ──┐  ┌─ Card.glass-card ──┐                  │  ← 内容卡片区
│  │ CardHeader/Title    │  │  …                 │                  │
│  │ CardContent         │  │                    │                  │
│  └─────────────────────┘  └────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

## 4.1 页面根容器（固定写法，无例外）

```tsx
<div className="p-6 space-y-6">
  {/* 页面内容 */}
</div>
```

- 页边距统一 `p-6`（24px）—— **不得**用 `p-4 md:p-6` 这类响应式页边距。
- 块间距统一 `space-y-6`。
- **禁止** `max-w-7xl mx-auto`、`container` 等任何宽度限制，页面占满内容区全宽。

## 4.2 页面标题区域（Header）

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold flex items-center gap-3">
      <Wallet className="w-8 h-8" />
      {t('aiBudget.title')}
    </h1>
    <p className="text-muted-foreground mt-1">{t('aiBudget.description')}</p>
  </div>
  {/* 右侧操作区（可选）：保存/刷新/新建按钮等 */}
</div>
```

| 元素 | 固定规范 |
|------|----------|
| 容器 | `flex items-center justify-between`（标题左、操作区右） |
| 标题 H1 | `text-3xl font-bold`，且 `flex items-center gap-3` 内联图标 |
| 标题图标 | **直接用图标组件** `className="w-8 h-8"`，**不加**任何背景容器（`rounded-xl bg-primary/10` 等） |
| 副标题 | `<p className="text-muted-foreground mt-1">`，**不加** `text-sm`（继承默认字号） |
| 右侧操作区 | 放页面级动作按钮；与 Tab 联动时按 `activeTab` 条件渲染 |

> Header 容器在标题/操作区高度不一致时，也可用 `flex items-end justify-between` 让二者底部对齐——但**默认用 `items-center`**，仅在确有视觉需要时改 `items-end`。

## 4.3 反面示例（禁止使用）

```tsx
<h1 className="text-2xl font-bold">                          {/* ❌ 字号过小，应 text-3xl */}
<div className="w-10 h-10 rounded-xl bg-primary/10">         {/* ❌ 图标带背景容器 */}
  <Icon className="w-5 h-5 text-primary" /></div>
<p className="text-muted-foreground mt-1 text-sm">           {/* ❌ 副标题加了 text-sm */}
<div className="p-6 space-y-6 max-w-7xl mx-auto">            {/* ❌ 根容器加宽度限制 */}
<div className="space-y-6 p-4 md:p-6">                       {/* ❌ 响应式页边距 */}
```

## 4.4 间距 / 尺寸标尺（统一记忆）

| 场景 | 类 |
|------|-----|
| 页面根容器内边距 | `p-6` |
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

- [ ] 根容器 `p-6 space-y-6`，**无** `max-w-*` / 响应式页边距
- [ ] 标题 `text-3xl font-bold` + 内联图标 `w-8 h-8`（无背景容器）
- [ ] 副标题 `text-muted-foreground mt-1`（无 `text-sm`）
- [ ] Header 用 `flex items-center justify-between`
- [ ] 卡片一律 `className="glass-card"`
- [ ] 卡片/弹窗分区标题带 `w-5 h-5` 图标；列表项小标题不带
- [ ] loading / error / empty 三态齐全
