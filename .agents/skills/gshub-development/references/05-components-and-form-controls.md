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

## 5.4 页面上方操作区同一外壳高度 ★★★

页面上方操作区（标题栏右侧按钮、其下或同行的分段、搜索、下拉、筛选）必须同一高度。

这一高度是 **`h-10`（40px）**。默认 `TabButtonGroup` 的外壳就是这个高度：

- 外壳 `min-h-10`（含 1px 边框），内钮为外壳内高 `h-[calc(2.5rem-2px)]` = 38px
- 分段过多折行的组（窄屏 `.tab-segment-fill` 两列布局）外壳照常撑高，不裁第二行
- 单行整组 = 40px，与 `h-10` 控件顶底对齐

常量（`src/components/ui/TabButtonGroup.tsx`）：

- `tabToolbarControlClass` = `h-10`
- `tabToolbarIconButtonClass` = `h-10 w-10`（正方形）
- `tabToolbarShellControlClass` 是同一常量的旧名

同行以及上下叠成一列的 `Input` / `SelectTrigger` / `Button` 都套这个类。没有分段的操作行也用它，不要混 `h-9` 和默认 `Button` 的 `h-10`。禁止只对齐内钮，禁止把 group 压矮（不要 `h-8` 外壳、不要 `buttonClassName="h-8 py-0"`）。

组件默认高度并不相同：`Input` = **h-10**、`SelectTrigger` = **h-7**、`Button` 默认 = **h-10**、`Button size="icon"` = **h-10 w-10**。并排时必须显式套常量，否则一行高低不齐（`SelectTrigger` 的 h-7 最容易漏）。

```tsx
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarIconButtonClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';

<div className="flex flex-wrap items-center gap-2">
  <div className={tabToolbarGroupWrapClass}>
    <TabButtonGroup options={…} value={…} onValueChange={…} className="shrink-0" />
  </div>
  <Input className={cn(tabToolbarControlClass, 'pl-9 w-64')} … />
  <Button className={tabToolbarControlClass} variant="outline">…</Button>
  <Button variant="outline" className={cn(tabToolbarIconButtonClass, 'shrink-0 p-0')}>
    <Plus className="h-4 w-4" />
  </Button>
</div>
```

| 场景 | 高度 | 说明 |
|------|------|------|
| 页面上方操作区 | `tabToolbarControlClass` | 标题栏按钮、分段旁的搜索/下拉/筛选，有没有分段都用这一档 |
| `TabButtonGroup` 本身 | 外壳 `min-h-10`，内钮 38px | 禁止压矮；单行整组正好 40px |
| 统计页日期槽 | 外壳 `min-h-10`，内钮 `h-full` | 外壳去对齐预设分段，内钮不要再套 `tabToolbarControlClass` |
| 同一行已有 Switch | 跟开关行对齐 | 不要单把按钮抬到外壳高度 |
| 表格行内 / 分页 / 弹窗底栏 / 卡片内次要按钮 | 紧凑 | 如技能卡编辑/删除，不要抬到外壳高度 |
| `size="sm"` / `size="line"` 的分段 | 外壳 `min-h-9` / 同默认 | `line` 是默认的兼容别名；`sm` 只用于面板内紧凑分段，不用于页面上方操作区 |

参考页：`/ai-knowledge`、`/ai-meme`、`/ai-capability-agents`。

单独使用、不和操作区并排的 `Input` 可以保持默认高度。

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

字段、卡片小标题、表单小节的说明放在标题**右侧**的问号 Tooltip 上，不要写在标题下面的正文段落里。页面 H1 的副标题仍写在标题下方（`text-muted-foreground mt-1`），不受这条约束。

### Tooltip 底色走 `.tooltip-surface`，不要用 `bg-popover` ★★

`TooltipContent` 的底色由 `.tooltip-surface` 画（`src/index.css`）。**不要**在 `TooltipContent` 上加 `bg-popover` / `border` / `shadow-md`。

原因：`bg-popover` 这个类名会让元素命中 index.css 里那族按 `[class*="popover"]` 匹配的浮层玻璃规则 —— 那族规则是给下拉菜单 / 选择列表（内容是整屏高对比小字，必须压住背后的行）准备的，会给命中元素套上**白色 1px 描边 + 顶部白色高光内阴影 + 高填充**。套在 tooltip 上就变成「一圈白色 badge 一样的背景」，在光感 / 液态下尤其明显。

`.tooltip-surface` 是独立的一套：中性底（跟随 `--popover`）+ 一层柔和投影，**不画白色描边**。改配色时改 `.tooltip-surface` 的规则，不要往 `TooltipContent` 的 className 里塞背景类。

### 「?」问号图标钮不要有圆形底板 ★★

问号是**纯图标按钮**，就该只有一个圆环 + 问号（lucide `HelpCircle` 自带圆环），外面**不能**再套一层圆形底色。

历史上 index.css 里有一条 `[data-style=...] button.rounded-full { background: hsl(var(--accent) / 0.3) !important }`（注释写的是「标签输入框的添加按钮」），选择器太宽，命中了**所有** `rounded-full` 按钮 —— 而全库真正用 `button.rounded-full` 的只有「?」问号钮（标签输入框的添加按钮实际用 `rounded-lg`）。问号外面多出的那圈浅色圆底就是它造成的。该规则已删除。

**教训**：写主题级 `button.xxx` 规则时，先确认目标控件的 class 是否唯一。像 `button.rounded-full` 这种「形状类」选择器极易误伤 —— 凡是圆角按钮（图标钮、头像、开关、各种 pill）都会中招。要精确命中就用组件自己的语义 class，别用形状类。

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

### 字段标签优先 `LabelWithHelp`（支持 Markdown）

位置：`src/components/ui/label-with-help.tsx`（AIConfig 侧从 `pages/AIConfig/shared` 桶再导出，用法不变）。

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

**不要**再手搓一套 Label+HelpCircle；长说明一律走 i18n Markdown 字符串，勿塞超长纯文本进 JSX。

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
