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
  sidebarLayout, // 'floating' | 'docked' | 'line'（仅分割线、无卡片底）
  borderRadius,  // 0–32 px → CSS --radius（全局圆角）
  uiScale,       // 85–120 % → html font-size
  sidebarDefaultCollapsed, // 侧边栏默认收起
  setMode, setStyle, setColor, setSidebarLayout,
  setBorderRadius, setUiScale, setSidebarDefaultCollapsed,
} = useTheme();
```

`iconColor` 通过 `html[data-icon-color]` 全局给 `.lucide` 上色。`Badge`（`data-slot="badge"`）、
`bg-primary` 选中 Tab、以及 `button` 内的图标必须 **inherit 文字色**，否则浅色主题 + 图标色「黑色」
时，黑底 Badge / 选中 Tab 上的 ICON 会看不见。覆盖规则在 `index.css` 末尾，改全局着色时不要削弱它。

侧边栏布局 class：`floating-sidebar` / `glass-sidebar` / `line-sidebar`（`line` 无卡片/阴影，仅 `border-right`）。

「杂项」各项均持久化到后端 `ThemeConfig`（`sidebar_layout` / `border_radius` / `ui_scale` / `shadow_intensity` / `sidebar_default_collapsed`），并镜像到 sessionStorage（`theme_sidebar_layout` 等）供首屏防闪。**新增杂项字段的完整同步清单**（缺一处都会出 bug）：

1. 前端 `ThemeContext.tsx`：常量/state/早期 effect/applyTheme/saveToBackend/setter/getThemeConfig/applyThemeConfig/miscContext/useTheme 十处；
2. `api.ts` 的 `ThemeConfig` 接口；
3. `demoMock.ts` 的 `THEME_CONFIG`；
4. `main.tsx` 的 `THEME_KEYS` 清理列表；
5. 后端 `gsuid_core/webconsole/theme_api.py`：`DEFAULT_THEME_CONFIG` + `ThemeConfigRequest`（Pydantic 校验）+ `_clamp_config_dict`（二次夹紧）；
6. 三语言 `themes.json` + ThemesPage 杂项 Tab UI。

阴影强度（`shadow_intensity`，0–200%，默认 100）：写入 CSS `--shadow-strength`（0–2）。表面类（`glass-card` 家族 / 侧栏）的阴影 alpha 全部写成 `calc(基准 * var(--shadow-strength))`——**新增表面类阴影时也要照此接入**，否则不吃该配置。作用范围是主题表面类的投影；零散的 Tailwind `shadow-*` 工具类不受控（也不应再新增，见 §3.4.1）。

圆角实现约定：

- 唯一真相源是 CSS 变量 `--radius`（主题杂项写入，单位 px；默认 24px）。
- Tailwind `rounded-sm/md/lg/xl/2xl/3xl` 全部挂到 `--radius`（见 `tailwind.config.ts`）。
- `rounded-full` 与显式 `rounded-[Npx]` 不随主题变。
- 新组件优先用 `rounded-lg` / `rounded-md` 等语义 token，**禁止**再硬编码与主题无关的大圆角。
- ⚠️ `.glass-card` / `.glass-card-flat` **类自身**声明了 `border-radius: var(--radius)`，且规则在 utilities 之后——要在表面类上用**更小**的自定义圆角必须加 important：`!rounded-[3px]`（例：RepeatGroupField）。

`ui_scale` 通过 `html { font-size: N% }` 缩放，一切 rem 尺寸（含 `--layout-gutter`）同步缩放——**新代码尺寸一律用 rem/Tailwind 刻度，不要写 px 字号**，否则不吃缩放。

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

### 3.4.1 表面类的实现结构与硬约束 ★★

`.glass-card` / `.glass-card-flat` / `.glass-card-danger` / `.floating-sidebar` 共用同一结构：**宿主只画边框 + 圆角 + 阴影，真实底色/毛玻璃画在 `::before`（`z-index: -1`，`border-radius: inherit`）**。这是为了绕开 Chrome「同一元素 backdrop-filter + box-shadow 合成出直角阴影」的 bug。由此派生的硬约束：

| 约束 | 原因 |
|------|------|
| 宿主**禁止** `overflow-hidden`（flat 除外） | 会重新触发直角/截断阴影脏边；裁切放内层 `rounded-[inherit]` 包一层（见 [§04 §4.1.3](./04-page-layout-spec.md)） |
| **禁止**对子元素强制 `position: relative` | 会破坏子级 absolute 装饰层的定位参照（Home 英雄区曾被撑高） |
| 宿主上 `shadow-*` 工具类无效 | 表面类阴影为 `!important` 统一投影，不允许每张卡自定阴影 |
| `ring-*` 依然可用 | 表面类阴影头部透传 `var(--tw-ring-offset-shadow)/var(--tw-ring-shadow)`——改这些 box-shadow 时**必须保留这两项**，否则全站选中态 ring 消失 |
| 覆盖类默认圆角需 `!rounded-*` | 类自带 `border-radius: var(--radius)` 且声明在 utilities 之后 |
| 定位/层级声明必须走 `:where(...)`（零特异性） | 表面类默认 `relative + z-index:0`；若写成普通类声明会压掉 Dialog/Sheet 的 `fixed`/`z-50` 工具类——弹层失去定位、沉到遮罩下面，症状是"点开只剩遮罩没内容" |
| 弹层上的 glass-card 无描边 | `.glass-card[role="dialog"/"alertdialog"]` 已统一 `border: none`——半透明 1px 边框叠在深色遮罩上会混成黑色描边线，弹层靠阴影分层即可 |
| `glass-card-flat`：无阴影无 blur | 供 overflow 容器内嵌 / 长列表项使用；`overflow-hidden` 安全；`hover:shadow-*` 可用（:hover 特异性更高） |

## 3.5 布局背景与 gutter

`AppLayout.tsx` 负责整页背景渲染：

- **solid 模式**：纯色或图片背景。
- **glassmorphism 模式**：毛玻璃 + 渐变/图片背景。

布局外边距（`--layout-gutter`，默认 `1.5rem`）：

- 悬浮侧栏四边 padding 与主内容区共用该变量。
- `.layout-page-inner` 四边始终有 padding：左/右/下 = gutter，顶 = `--layout-page-top`（`.page-fill` 页顶/底改为 gutter）。
- 悬浮桌面下 `.page-fill` 用负 `margin-left` 收回一个 gutter，使中缝 = 侧栏右 gutter（仅 `min-width: 768px` 生效，移动端侧栏是抽屉，不收）。
- 页面根 **禁止** 再写 `p-6`（见 [§04 页面排版](./04-page-layout-spec.md)）。

`backdrop-filter` 是 GPU 密集操作，低端设备性能敏感，**避免在长列表的每一项上叠加毛玻璃**（见 [§10 性能](./10-pitfalls-and-performance.md)）。

## 3.6 响应式设计

- 移动端优先，用 `md:`、`lg:` 断点。
- 表格在移动端用卡片布局替代（`hidden md:block` / `md:hidden` 双布局，见 [§08 页面模式](./08-page-patterns.md)）。
- 表单字段移动端单列、桌面端多列（`grid grid-cols-1 md:grid-cols-2`）。

## 3.7 主题相关修改入口

- 改颜色预设 → `ThemeContext.tsx`
- 改 Tailwind 颜色映射 → `tailwind.config.ts`
