# 三、主题与样式系统

> 返回 [SKILL 主入口](../SKILL.md)。

## 3.1 主题状态来源

主题由 `ThemeContext` 统一管理：

```tsx
import { useTheme } from '@/contexts/ThemeContext';
const {
  mode,        // 'light' | 'dark'
  style,       // 'solid' | 'glassmorphism'
  color,       // 'red' | 'orchid' | 'blue' | 'green' | 'orange' | 'pink'
  iconColor,   // 'white' | 'black' | 'colored'
  themePreset, // 'default' | 'shadcn'
  setMode, setStyle, setColor,
} = useTheme();
```

## 3.2 CSS 变量系统（HSL）

颜色用 CSS 变量定义（HSL 三元组，**不含** `hsl()` 包裹）：

```css
:root  { --primary: 220 70% 50%; --primary-foreground: 0 0% 100%;
         --background: 0 0% 100%; --foreground: 240 10% 4%; }
.dark  { --primary: 220 70% 60%; --background: 240 10% 4%; --foreground: 0 0% 98%; }
```

在 `tailwind.config.ts` 映射为 Tailwind 颜色：

```ts
colors: {
  primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
}
```

使用时用语义色，**禁止硬编码颜色值**：

```tsx
<div className="bg-background text-foreground border-border/50">
<span className="text-primary bg-primary/10">
```

## 3.3 颜色规范

- 用 Tailwind 语义变量：`text-primary`、`bg-primary/10`、`border-border/50`。
- 状态色约定：成功 `text-green-500`，警告 `text-amber-500`/`text-yellow-500`，错误 `text-red-500`。
- 避免硬编码 `bg-green-500` 等（除非语义明确且有注释，如危险操作红色）。

## 3.4 `glass-card`：始终应用，禁止 `isGlass &&` 条件判断 ★★

`glass-card` CSS 类**已经**通过 `[data-style]` 选择器自动适配不同主题，并在 `.dark` 下做暗色优化：

- `[data-style="glassmorphism"]` → 半透明背景 + `backdrop-filter: blur()`
- `[data-style="solid"]` → 不透明背景，无模糊效果
- `.dark` → 更低透明度

因此**应始终直接应用 `glass-card`**，无需读 `style` 判断：

```tsx
// ✅ 正确：直接应用，CSS 自动按 data-style 切换
<Card className="glass-card">
<DialogContent className="… glass-card">
<AlertDialogContent className="glass-card">
<div className="rounded-lg p-4 glass-card">
```

```tsx
// ❌ 历史反模式：纯色模式下丢失统一样式
const isGlass = style === 'glassmorphism';
<Card className={cn(isGlass && "glass-card")}>
<Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
```

> 现状：全站绝大多数页面已是「始终 `glass-card`」写法。**新代码一律用始终应用写法**；遇到旧的 `isGlass && / isGlass ?` 条件写法应顺手改正。详见 [§10 已知坑 P-2](./10-pitfalls-and-performance.md)。

## 3.5 布局背景

`AppLayout.tsx` 负责整页背景渲染：

- **solid 模式**：纯色或图片背景。
- **glassmorphism 模式**：毛玻璃 + 渐变/图片背景。

`backdrop-filter` 是 GPU 密集操作，低端设备性能敏感，**避免在长列表的每一项上叠加毛玻璃**（见 [§10 性能](./10-pitfalls-and-performance.md)）。

## 3.6 响应式设计

- 移动端优先，用 `md:`、`lg:` 断点。
- 表格在移动端用卡片布局替代（`hidden md:block` / `md:hidden` 双布局，见 [§08 页面模式](./08-page-patterns.md)）。
- 表单字段移动端单列、桌面端多列（`grid grid-cols-1 md:grid-cols-2`）。

## 3.7 主题相关修改入口

- 改颜色预设 → `ThemeContext.tsx`
- 改 Tailwind 颜色映射 → `tailwind.config.ts`
