# 五、组件复用与表单/筛选控件规范

> 返回 [SKILL 主入口](../SKILL.md)。封装组件的完整接口见 [§06 组件目录](./06-reusable-component-catalog.md)。

## 5.1 基础约定

- 基础 UI 来自 `src/components/ui/`（shadcn/ui）；业务组件放对应功能目录（`config/` 等）。
- **优先复用现有 shadcn/ui 组件**，确需新增再放 `ui/` 或功能目录。
- 用 TypeScript 定义 props 类型。
- 用 `cn()` 处理样式合并，允许外部 `className` 覆盖。

### 引入方式

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
```

## 5.2 `cn()` 合并类名

来自 clsx + tailwind-merge：

```tsx
import { cn } from '@/lib/utils';
<div className={cn("base-class", isActive && "active-class", className)}>
```

## 5.3 组件变体（CVA）

用 `class-variance-authority` 定义变体（Button 为例）：

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium …",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive …",
        outline: "border border-input …",
        secondary: "bg-secondary …",
        ghost: "hover:bg-accent …",
        link: "text-primary underline-offset-4 …",
      },
      size: {
        default: "h-10 px-4 py-2",   // ← Button 默认 h-10
        sm: "h-9 rounded-md px-3",    // ← h-9
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

使用：`<Button variant="destructive" size="sm"><Trash className="h-4 w-4" />删除</Button>`。

### Button 子图标 hover 微动效（默认开启）

`Button` 对**直接子节点**中的 lucide 图标（`forwardRef` + PascalCase `displayName`）
自动 `asHoverIcon` 包装，hover 时按图标类型播一次微动效。

**安全门**：普通 function 组件（如 `LanguageFlag`）**绝不**包装，避免丢掉 `code` 等 props 白屏。
`asHoverIcon` 自身也有同样门禁。

```tsx
// ✅ lucide 图标：hover 自动动
<Button><Plus className="h-4 w-4" />新建</Button>
<Button size="icon"><RefreshCw className="h-4 w-4" /></Button>

// ✅ 业务组件：原样渲染，不受影响
<Button><LanguageFlag code="cn" />中文</Button>

// 持续转圈：有 animate-spin 时跳过 hover 动效
<Button disabled><Loader2 className="h-4 w-4 animate-spin" />保存中</Button>

// 个别按钮关闭动效
<Button iconMotion={false}><Settings className="h-4 w-4" />设置</Button>
```

非 `Button` 的可点击卡片（如 `/home` 快捷导航）自行加 `hoverIconGroupClass` + `SidebarHoverIcon`。

## 5.4 一行筛选/表单控件高度必须统一 ★★

默认高度不一致：`Input` = **h-10**(40px)、`SelectTrigger` = **h-9**(36px)、`Button` 默认 = **h-10**、`Button size="sm"` = **h-9**、`Button size="icon"` = **h-10 w-10**、`TabButtonGroup` 默认外壳 ≈ **h-11**(44px，`p-1` + 内钮 `py-2` + 22px 图标)。

按「这一行有没有 TabButtonGroup」分两档，**禁止混用**：

### A. 没有 TabButtonGroup → 统一 `h-9`

搜索框 + 下拉 + 按钮的纯筛选行：

```tsx
// ✅ 正确：工具栏所有控件 h-9 对齐
<div className="flex flex-wrap items-center gap-3">
  <div className="relative flex-1 min-w-[200px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <Input className="h-9 pl-9" placeholder={…} value={search} onChange={…} />
  </div>
  <Select value={f} onValueChange={setF}>
    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
    <SelectContent>…</SelectContent>
  </Select>
  <Button size="sm" className="h-9"><Plus className="w-4 h-4 mr-2" />新建</Button>
  <Button size="sm" variant="outline" className="h-9 w-9 p-0"><RefreshCw className="w-4 h-4" /></Button>
</div>

// ❌ 错误：Input 默认 h-10、Select h-9、Button 默认 h-10 → 一行高低不齐
<Input className="pl-9" />
<SelectTrigger className="w-[140px] h-9" />
<Button>新建</Button>
```

### B. 有 TabButtonGroup → 以 **默认高度 group** 为基准，同行控件 `h-11` ★★★

`TabButtonGroup` 默认高度是视觉主锚，**不要压矮**（禁止 `h-8` / `h-9` 外壳、禁止 `buttonClassName="h-8 py-0"` 一类矮版）。

同行 `Input` / `SelectTrigger` / `Button` 用组件导出的常量对齐：

```tsx
import {
  TabButtonGroup,
  tabToolbarControlClass,      // 'h-11'
  tabToolbarIconButtonClass,   // 'h-11 w-11'
  tabToolbarGroupWrapClass,    // 压掉 shadow-safe 竖直 bleed，便于 items-center
} from '@/components/ui/TabButtonGroup';

<div className="flex flex-wrap items-center gap-2">
  <div className={tabToolbarGroupWrapClass}>
    <TabButtonGroup options={…} value={…} onValueChange={…} className="shrink-0" />
  </div>
  <Input className={cn(tabToolbarControlClass, 'pl-9 w-64')} … />
  <Button className={tabToolbarControlClass} variant="outline">…</Button>
  <Button size="icon" className={cn(tabToolbarIconButtonClass, 'shrink-0')}>
    <Plus className="h-4 w-4" />
  </Button>
</div>
```

| 场景 | 高度 | 说明 |
|------|------|------|
| 纯筛选行（无 Tab） | `h-9` | Input / Select / Button 显式 `h-9` |
| 含默认 `TabButtonGroup` | `h-11` | 用 `tabToolbarControlClass` / `tabToolbarIconButtonClass` |
| `TabButtonGroup` 本身 | **保持默认** | 禁止压成矮版 |

参考页：`/ai-knowledge` 工具栏、`/batch-push` 目标行、`/ai-meme` 筛选行。

补充：
- 单独使用的 `Input`（不与其他控件并排）可用默认高度。
- 搜索框 `Input` 与旁边的 `Select` 对齐时，按上面 A/B 规则取同一档。

## 5.5 Radix Select 空值哨兵

`<Select.Item value="">` 会运行时报错（空串被 Radix 用于清除选择/占位）。"全部/不限"用非空哨兵值，调 API 时再转回：

```tsx
const options = [
  { value: '__all__', label: t('…all') },
  { value: 'group', label: '群聊' },
];
// API 调用时转换
const params: any = {};
if (scopeFilter !== '__all__') params.scope_type = scopeFilter;
```

同理后端 GitHub 镜像等"默认/空"场景用哨兵 `__github_default__`，并提供 `toSelectValue`/`toMirrorValue` 互转。

## 5.6 字段说明用 Tooltip + HelpCircle / LabelWithHelp

字段补充说明放 Label 右侧的悬浮 Tooltip，而非独立一行文字（省空间、减视觉噪音）。

### 通用手搓（简单一行文案）

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

<div className="flex items-center gap-1.5">
  <Label>{t('config.notifyCooldown')}</Label>
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs"><p>{t('config.notifyCooldownDesc')}</p></TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
<Input className="h-9" … />
```

### AIConfig：优先 `LabelWithHelp`（支持 Markdown）

位置：`src/pages/AIConfig/shared/LabelWithHelp.tsx`（与 `HeadingWithHelp` 对称，用于子表单字段）。

- `description` 为 **string** → 轻量 Markdown（`**加粗**`、段落、列表；heading 压成加粗段落）；
- 为 ReactNode → 原样展示；
- 可选前置 `icon`。

```tsx
import { LabelWithHelp } from '../shared';

// i18n 可写多行 Markdown，例如多源策略说明
<LabelWithHelp
  icon={<GitBranch className="w-3.5 h-3.5 text-muted-foreground" />}
  label={t('aiConfig.serviceProvider.lbStrategy')}
  description={t('aiConfig.serviceProvider.lbStrategyDesc')}
  className="text-xs font-medium text-muted-foreground"
/>
```

**不要**在 AIConfig section 里再手搓一套 Label+HelpCircle，除非该字段不在 AIConfig 模块。

## 5.7 Switch 组件 UX 规范

组件层已内置主题色：选中 `bg-primary`、未选中 `bg-input`（自动适配亮/暗）。

```tsx
// ✅ 正确：直接用，无需额外 className
<Switch checked={isEnabled} onCheckedChange={setIsEnabled} />

// ❌ 冗余：组件已内置主题色
<Switch className="data-[state=checked]:bg-primary" />
// ❌ 禁止：硬编码颜色
<Switch className="data-[state=checked]:bg-green-500" />

// ✅ 允许：不影响颜色的样式
<Switch className="scale-110" />
```

- 危险操作可用红色，但**必须注释说明**：`className="data-[state=checked]:bg-destructive"`。
- **被 `TooltipTrigger asChild` 包裹会失效**：Radix Tooltip 把自己的 `data-state`(open/closed) 覆盖到子元素，盖掉 Switch 的 `data-state`(checked/unchecked)，使 `data-[state=checked]:bg-primary` 失效。解决：用 `<span>` 再包一层：

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span><Switch checked={enabled} onCheckedChange={setEnabled} /></span>
  </TooltipTrigger>
  <TooltipContent><p>提示文字</p></TooltipContent>
</Tooltip>
```

### Switch 检查清单

- [ ] 选中态用主题色 `bg-primary`，未选中 `bg-input`
- [ ] 无冗余 `data-[state=checked]:bg-primary`
- [ ] 无硬编码颜色（`bg-green-500`/`bg-red-500`）
- [ ] 被 Tooltip 包裹时用 `<span>` 包一层

## 5.8 自定义业务组件规范

1. 放对应功能目录（如 `src/components/config/`）。
2. 优先复用现有 shadcn/ui 组件。
3. TypeScript 定义 props。
4. 用 `cn()` 处理样式合并。

## 5.9 强制复用的封装组件（禁止手搓）

详细接口见 [§06 组件目录](./06-reusable-component-catalog.md)。**遇到以下需求必须用对应封装组件，禁止手动拼装：**

| 需求 | 必须用的组件 |
|------|-------------|
| 输入框 + 下拉列表（可输入也可从预设选） | `InputWithDropdown` |
| 标签/关键词输入 | `TagsInput` |
| 多选/单选 Chip 组 | `ChipGroup`（`MultiSelectChipGroup`） |
| 标签页/分段切换按钮 | `TabButtonGroup` |
| **主 Tab + 二级筛选下拉**（点主区=全部，点 ▾ 才展开） | `TabButtonGroup` 的 `option.dropdown`（见 [§06 §6.1](./06-reusable-component-catalog.md)） |
| 插件 ICON（列表/Tab/下拉子项） | `PluginIcon` + `getPluginIconUrl`（见 [§06 §6.7](./06-reusable-component-catalog.md)） |
| 按后端 `PluginConfigItem.type` 动态渲染字段 | `DynamicConfigPanel` / `ConfigField` |
