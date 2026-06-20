# 八、页面模式与 Dialog/Modal 规范

> 返回 [SKILL 主入口](../SKILL.md)。本章是几类常见页面/弹窗的成型范式，照抄即可保持一致。

## 8.1 卡片式列表页（以 Persona 人格配置为例）

`PersonaConfigPage.tsx` 是卡片式列表页的范式：

### 页面布局
- 页边距 `p-6`，标题用图标 + `text(3xl)`（见 [§04](./04-page-layout-spec.md)）。
- 两列网格：`grid grid-cols-1 md:grid-cols-2 gap-4`。

### 卡片设计
- **头像**：左侧 48×48 圆角方形，加载失败回退 `/ICON.png`。
- **启用开关**：`Switch`（主题色，见 [§05](./05-components-and-form-controls.md)）。
- **状态 Badge**：启用 `bg-red-500/20 text-red-600` / 禁用 `bg-muted text-muted-foreground`；群聊 Badge `bg-primary/10 text-primary`。
- **毛玻璃**：卡片用 `className="glass-card"`（见 [§03](./03-theme-and-styling.md)）。

### 卡片内编辑
- 点击"编辑"在卡片下方展开编辑区。
- 群聊列表用 `TagsInput`（见 [§06](./06-reusable-component-catalog.md)）。
- 展开区内提供保存/取消。

### 核心功能
- 创建对话框（Dialog，名称 + 描述）。
- 编辑对话框（查看/编辑 Markdown 内容，`ScrollArea` 滚动）。
- 删除二次确认（`AlertDialog`）。
- 启用/禁用直接切 Switch 调 API。

### 关键组件
`Card` / `Switch` / `TagsInput` / `Dialog` / `AlertDialog` / `Badge` / `ScrollArea`。

### 弹窗小标题图标规范
- **只在弹窗内分区标题加图标**（如"内容""关联群聊"），卡片列表页本身的小标题不加。
- 用 `flex items-center gap-2` + `h-4 w-4`/`h-5 w-5`。

```tsx
<div className="space-y-4">
  <div className="space-y-2 flex flex-col">
    <Label className="flex items-center gap-2"><Brain className="h-4 w-4" />{t('…personaContent')}</Label>
    <Textarea … />
  </div>
  <div className="space-y-2">
    <Label className="flex items-center gap-2"><User className="h-4 w-4" />{t('…enabledGroups')}</Label>
    <TagsInput … />
  </div>
</div>
```

## 8.2 表格列表页 + 二级详情

见 [§04 §4.6](./04-page-layout-spec.md)：点击任意行打开详情；操作按钮 `e.stopPropagation()` 防冒泡；详情/弹窗标题带 `w-5 h-5` 图标，字段按逻辑分组（`Separator`/`border-b`）。

## 8.3 Dialog/Modal 规范

### Radix Select 空值
`<Select.Item value="">` 报错，用哨兵值（见 [§05 §5.5](./05-components-and-form-controls.md)）。GitHub 镜像等"默认"场景：

```tsx
const DEFAULT_MIRROR_VALUE = '__github_default__';
const toSelectValue = (v: string) => v || DEFAULT_MIRROR_VALUE;       // 后端值 → Select 值
const toMirrorValue  = (v: string) => v === DEFAULT_MIRROR_VALUE ? '' : v;  // Select 值 → 后端值
<SelectItem key={m.value || DEFAULT_MIRROR_VALUE} value={toSelectValue(m.value)}>
```

### 毛玻璃适配
`DialogContent` / `AlertDialogContent` 一律 `className="glass-card"`（**不要** `isGlass &&` 判断，见 [§03](./03-theme-and-styling.md)）。

### 表单弹窗布局
- 内容区 `space-y-4 py-2`；超长内容 `max-h-[80vh] overflow-y-auto`。
- 字段分组：单字段 `space-y-2`（Label + 控件）；多字段并排 `grid grid-cols-1 md:grid-cols-2 gap-4`。
- 底部 `DialogFooter`：取消（`variant="outline"`）+ 主操作；保存中 `<Loader2 className="animate-spin" />`。
- 创建/编辑共用同一弹窗组件时，`open` 变化时按 `mode` 重置/回填表单（`useEffect([open, mode, entity])`）。

### 双态 UI 必须三处同步分支 ★
确认弹窗等双态场景（暂停/恢复、创建/编辑），**动作、图标、文案三者都要按同一条件分支**，不要只分支动作而把文案写死：

```tsx
// ✅
<Button onClick={isPaused ? handleResume : handlePause}>
  {isPaused ? t('sidebar.resumeSystem') : t('sidebar.pauseSystem')}
</Button>
// ❌ onClick 分支了，label 却写死 → 暂停时显示"恢复系统"
<Button onClick={isPaused ? handleResume : handlePause}>{t('sidebar.resumeSystem')}</Button>
```

## 8.4 移动端适配

Dialog 内数据列表移动端用卡片替代表格，`hidden md:block` / `md:hidden` 双布局：

```tsx
{/* 桌面端表格 */}
<div className="hidden md:block"><Table>…</Table></div>

{/* 移动端卡片 */}
<div className="md:hidden space-y-2 p-2">
  {items.map(item => (
    <div key={item.id} className="rounded-lg p-3 space-y-2 border border-border/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium text-sm truncate">{item.name}</span>
          <Badge>状态</Badge>
        </div>
        <Button size="sm" className="shrink-0">操作</Button>
      </div>
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block">{item.url}</code>
    </div>
  ))}
</div>
```

要点：操作按钮放第一行右侧 `shrink-0` 始终可见；名称区 `min-w-0 flex-1` 自动截断；Dialog 宽度 `w-[95vw] max-w-4xl`；按钮区 `flex-col sm:flex-row`。

## 8.5 SSH URL 识别

Git remote 可能用 SSH（`ssh://` 或 `git@` 开头），后端可能识别为 `unknown`，前端额外检测：

```tsx
function isSshUrl(url: string): boolean {
  return url.startsWith('ssh://') || url.startsWith('git@');
}
```

## 8.6 API 接口设计经验

- **仅保存配置 vs 批量应用**：区分"保存配置（影响后续新安装）"与"一键应用（同时切换已安装）"两种操作。
- 用 `frameworkConfigApi.updateFrameworkConfigItem` 保存单个配置项，避免覆盖其他配置。
- **静默失败**：非关键数据获取（如 git mirror info）应静默失败，不影响主页面。
