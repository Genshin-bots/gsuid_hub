# 十、已知坑、性能与落地清单

> 返回 [SKILL 主入口](../SKILL.md)。本章是「别人替你踩过的坑」，写代码前过一遍能省大量返工。

## A. 已知坑清单

### P-1 三元 `?:` 与字符串 `+` 拼接的优先级陷阱 ★

`?:` 优先级**低于** `+`：

```tsx
// ❌ 实际解析为： mode==='create' ? t('createFailed') : (t('updateFailed') + ': ' + e.message)
//   → create 失败时丢掉了 ': ' + e.message
toast.error(mode === 'create' ? t('…createFailed') : t('…updateFailed') + ': ' + e.message);
// ✅ 整体加括号
toast.error((mode === 'create' ? t('…createFailed') : t('…updateFailed')) + ': ' + e.message);
```

### P-2 `glass-card` 用 `isGlass &&` 条件判断（反模式）★

`glass-card` 已自动适配主题，应**始终直接应用**。详见 [§03](./03-theme-and-styling.md)。

### P-3 一行筛选/表单控件高度不统一 ★★

`Input`(h-10) + `SelectTrigger`(h-9) + `Button`(h-10) 并排不显式统一高度 → 高低不齐。

- **无 TabButtonGroup**：统一 `h-9`。
- **有 TabButtonGroup**：保持默认 group 高度，同行用 `tabToolbarControlClass`（`h-11`）；**禁止**把 group 压成 `h-8`/`h-9` 矮版。

详见 [§05 §5.4](./05-components-and-form-controls.md)、[§06 §6.1](./06-reusable-component-catalog.md)。

### P-4 条件渲染里把分支文案写死 ★

容器/动作按状态分支，但内部文案忘了同样分支。**双态 UI 的动作、图标、文案三者要按同一条件分支**。详见 [§08 §8.3](./08-page-patterns.md)。

### P-5 Switch 被 `TooltipTrigger asChild` 包裹导致主题色失效 ★

Radix Tooltip 的 `data-state` 覆盖 Switch 的 `data-state`。用 `<span>` 再包一层。详见 [§05 §5.7](./05-components-and-form-controls.md)。

### P-6 Radix `Select.Item value=""` 运行时报错

"全部/不限"用哨兵值 `__all__`，调 API 再转回空。详见 [§05 §5.5](./05-components-and-form-controls.md)。

### P-7 配置页脏检查漏 `rawConfig` / 加载竞态导致按钮误亮 ★★

同时比较 `config` 与 `rawConfig`；`originalConfig` 等全部配置加载完再设；注意 `refresh()` 漏重置快照的窗口期误报。详见 [§07](./07-config-pages-and-state.md)。

### P-8 i18n 漏同步三语言 / 漏改 index.ts ★

新增 key 三处 JSON 同步、leaf key 对齐；新增模块还要改三个 `index.ts`。提交前跑 [§02 自查命令](./02-i18n.md)。

### P-9 变量插值手写 `.replace`（脱离规范）

用 `t(key, { count })`，不要 `t(key).replace('{count}', …)`。详见 [§02 §2.6](./02-i18n.md)。

### P-10 用翻译后的 `title` 当 React key / 状态键 ★

切换语言后 title 变化 → key/状态失配（展开态丢失等）。一律用稳定 `id`。详见 [§09](./09-sidebar-navigation.md)。

### P-11 useEffect 依赖与闭包

- 空依赖 `[]` 内用了 `t`/外部变量 → 闭包陷阱拿到旧值。依赖数组要完整。
- 依赖 `configs` 的 effect 会在请求完成后重复触发；用 `ref` 记录已请求项去重。
- 事件处理用 `useCallback`、复杂计算用 `useMemo`，避免 render 内新建函数/对象。

### P-13 错误 toast 丢弃后端 `detail`，提示与真实原因无关 ★

错误响应有两类：业务封套 `{status,msg}` 与 FastAPI 异常 `{detail}`（字符串或校验数组）。只写
`toast.error(res.msg || fallback)` / `e.message` 时，遇到 FastAPI 的 `{detail}`（如保存预设名非法返回
`{"detail":"预设名称仅支持字母/数字/中横线/下划线/点号/空格，长度 1-64"}`）会漏读，只显示笼统兜底文案。
统一用 `getApiErrorMessage(err/res, fallback)`（`@/lib/api`），解析 `msg → detail → Error.message → fallback`。
详见 [§01 §1.5](./01-architecture-and-conventions.md)。

### P-12 类型/构建注意

- `tsconfig` 的 `noUnusedLocals`/`noUnusedParameters` 为 `false`，未使用变量不会构建报错，但应清理。
- 仓库存在历史 `tsc` 报错（`EChartsWrapper.tsx`、`use-toast.ts` 等），**核对改动是否新增报错时要区分既有错误**。

### P-14 React Hooks 在条件分支里调用 → 顺序变化导致崩溃 ★★★

**症状**：浏览器 console 警告

```
Warning: React has detected a change in the order of Hooks called by Sidebar.
   Previous render            Next render
   ------------------------------------------------------
1. useContext                 useContext
…
9. undefined                  useContext
```

**根因**：在 `if`/`三元` 等条件分支里调用 Hook（如 `useTheme()`），不同渲染路径下 Hook 数量不一致 → React 抛错、状态错乱、Context 取错值。

```tsx
// ❌ mobile / 非 mobile / collapsible='none' 三条分支各调一次
const Sidebar = ({ isMobile, collapsible }) => {
  const { mode } = useTheme();              // 总是调
  if (collapsible === 'none') return <… />; // 此分支 useTheme 调 1 次
  if (isMobile) {
    const { style } = useTheme();           // 此分支调 2 次 → 顺序漂移
    return <Sheet>…</Sheet>;
  }
  // 此分支调 1 次
};

// ✅ 所有 Hook 在分支前一次性调用；分支内只用解构出的值
const Sidebar = ({ isMobile, collapsible }) => {
  const { mode, style: themeStyle } = useTheme();
  if (collapsible === 'none') return <… />;
  if (isMobile) return <Sheet className={themeStyle === 'glassmorphism' ? '…' : '…'}>…</Sheet>;
  …
};
```

**自检命令**：`grep -rn "use[A-Z][a-zA-Z]*(" src/ | grep -E "(if|\?|&&) "` 查条件分支里的 Hook。Hooks 永远要在**最顶层**调用。

### P-15 Tailwind 任意值类名歧义警告 ★

**症状**：dev server 启动时刷

```
warn - The class `ease-[cubic-bezier(0.4,0,0.2,1)]` is ambiguous
       and matches multiple utilities.
```

**根因**：Tailwind v3.4 的内容扫描器对带 `(` `)` 的任意值类名（如 `ease-[cubic-bezier(...)]`）判定为歧义。这是**误报**——CSS 实际生成正确——但每次启动都刷几行警告很烦。

**修复**：把用到的 cubic-bezier / 复杂 timing function **提到 `tailwind.config.ts` 命名**，再用名字引用：

```ts
// tailwind.config.ts → theme.extend
transitionTimingFunction: {
  'out-soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
},
```

```tsx
// ❌ 之前：直接写 arbitrary value → 歧义警告
className="transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
// ✅ 之后：用命名 ease
className="transition-all duration-300 ease-out-soft"
```

**全局替换技巧**：

```bash
# 1. 找所有命中点
grep -rn "ease-\[cubic-bezier" src/
# 2. replace_all 替换为 ease-out-soft
# 3. 在 tailwind.config.ts 加命名
```

类似易踩的任意值类名还有 `[transition-timing-function:...]`、`[animation-timing-function:...]` 等，遇到警告就用同样的命名思路下沉到 config。

### P-16 Radix Dialog 缺 Title / Description → 控制台刷屏警告 ★★

详见 [§08 §8.3 Dialog 无障碍](./08-page-patterns.md)。要点：
- 每个 `DialogContent` 必须有 `DialogTitle`（可放在 `DialogHeader`/div/任意嵌套层中，但**必须**在 children 里）。
- 每个 `DialogContent` 必须有 `DialogDescription` **或** `aria-describedby`。
- 不想让描述文字挤占 UI 时用 `<DialogDescription className="sr-only">…</DialogDescription>`。
- 旧的"自定义 `<h2><p>` 标题"模式（如 PluginStorePage README 弹窗）需替换为 `<DialogTitle>` + `<DialogDescription>`，保留 `className` 维持视觉。
- 三语言 JSON 同步加 `*AriaDesc` 后缀的 key。

### P-17 后端版本不匹配：识别特定错误并降级日志级别 ★

**场景**：前端调一个**新版后端才提供**的端点，但用户跑的是旧版后端。每次进页面 `console.error` 都会刷一遍，前端噪音极大，又不是前端 bug。

**反模式**：把所有 `fetch` 失败都 `console.error`——把"后端缺接口"误报成"前端代码 bug"，误导排查方向。

**正确做法**：识别该后端特有的错误特征，降级为 `console.warn` 并提示根因：

```tsx
const fetchStats = useCallback(async () => {
  try {
    setIsLoadingStats(true);
    const data = await memeApi.getStats();           // /api/meme/stats 仅新版后端支持
    setStats(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('预保留路径名')) {
      // 旧版后端没有独立 /stats 端点，请求被 /{meme_id} 兜底，
      // 又因 'stats' 是预保留 meme_id 而报错。这不是前端 bug，
      // 升级后端即可恢复。
      console.warn(
        '[AIMemePage] /api/meme/stats 不可用：当前 gsuid_core 版本过旧，' +
        '缺少独立的统计端点。统计概览区域将保持为空，请升级 gsuid_core。',
        msg,
      );
    } else {
      console.warn('Failed to fetch meme stats:', msg);  // 其它错误也用 warn
    }
  } finally {
    setIsLoadingStats(false);
  }
}, []);
```

**判断"前端 bug vs 后端不兼容"的启发式**：
- 错误消息是后端固定文案（"预保留路径名"、"路由未注册"、"404 Not Found" 等）→ 后端问题。
- 错误是 JS 异常（TypeError、undefined.xxx）→ 前端问题。
- 不确定就先 `console.warn` + 在 UI 上保持优雅降级（空状态/Skeleton），比 `console.error` 友好。

### P-18 DialogTitle 不要写"看着像、实际不是"的条件分支 ★★

详见 [§08 §8.3](./08-page-patterns.md)。双态 UI 三处同步（[P-4](#p-4-条件渲染里把分支文案写死-)）之外，DialogHeader 里的 DialogTitle/DialogDescription 也得同步分支。例如暂停/恢复确认弹窗：

```tsx
// ✅ 三分支全都有 Title+Description
<DialogHeader>
  {completed ? (
    <><DialogTitle>{t('…success')}</DialogTitle>
       <DialogDescription>{t('…successDesc')}</DialogDescription></>
  ) : running ? (
    <><DialogTitle>{t('…running')}</DialogTitle>
       <DialogDescription>{t('…runningDesc')}</DialogDescription></>
  ) : (
    <><DialogTitle>{isPaused ? t('…resume') : t('…pause')}</DialogTitle>
       <DialogDescription>{isPaused ? t('…resumeDesc') : t('…pauseDesc')}</DialogDescription></>
  )}
</DialogHeader>
```

任何分支为 `null` 或只渲染 `DialogDescription` 不渲染 `DialogTitle`，都会触发 Radix 警告（甚至运行时警告比正常 Title 渲染早一帧——一旦初始 render 是 null，警告就刷了，之后再加 Title 也来不及）。

### P-19 glass-card 宿主写 `overflow-hidden` / 全出血子元素戳出圆角 ★★

`.glass-card` 宿主必须 `overflow: visible`（阴影/合成需要），因此：

- **不要**在 glass-card 上写 `overflow-hidden`（写了也会被类内 `overflow: visible` 压掉，等于死代码 + 误导）。
- 顶到卡片边缘的方角子元素（图片头、表格、色条）会**戳出圆角**，需自己贴合：图片区 `overflow-hidden rounded-t-[inherit]`；卡内滚动区内层加 `rounded-[inherit]`。详见 [§04 §4.1.3](./04-page-layout-spec.md)。
- 非 glass-card 的普通容器不受此限制，照常 `overflow-hidden`。

### P-20 Tailwind `ring-*` 是 box-shadow：写死 box-shadow 会杀掉 ring ★★

`ring-1/ring-2`、`focus-visible:ring` 全部编译成 `box-shadow`。任何「统一投影」的 CSS（如表面类的 `box-shadow: … !important`）都必须在**阴影列表头部**透传：

```css
box-shadow:
  var(--tw-ring-offset-shadow, 0 0 #0000),
  var(--tw-ring-shadow, 0 0 #0000),
  0 2px 6px …;
```

漏掉这两项的症状：卡片选中态 `ring-2 ring-primary`、`hover:ring-*` 全部无声失效。

### P-21 表面类自带 `--radius` 圆角，小圆角要 `!rounded-[Npx]` ★

`.glass-card` / `.glass-card-flat` 声明了 `border-radius: var(--radius)` 且位于 utilities 之后，普通 `rounded-[3px]` 会被压掉（同特异性、后者胜）。需要更小圆角时用 `!rounded-[3px]`。`rounded-lg/xl/2xl/3xl` 本就等于 `var(--radius)`，无冲突。

### P-22 JSX `return (` 与根元素之间不能插 `{/* 注释 */}`

`return (\n {/* … */}\n <div>…)` 会让 esbuild 报 `Expected ")"`——JSX 注释也是表达式，等于 return 了两个子节点。注释写成 `//` 放在 `return` 之前，或放到根元素**内部**。

### P-23 页面里有**两层嵌套 `<main>`**，`document.querySelector('main')` 拿到的是外层 ★★

**症状**：写调试脚本 / E2E 时测「main 是否在滚动」，永远得到 `overflow: hidden`、`scrollHeight === clientHeight`，
误判成「滚动容器坏了」。

**根因**：`SidebarInset`（`src/components/ui/sidebar.tsx`）**自己就渲染成 `<main>`**，
而 `AppLayout` 又在它内部放了真正的滚动 `<main className="flex-1 min-h-0 flex flex-col overflow-auto">`：

```
<main (SidebarInset) class="flex flex-col overflow-hidden">   ← querySelector('main') 命中这个
  <LayoutHeader/>
  <main class="flex-1 min-h-0 overflow-auto">                 ← 真正的滚动容器
    <div class="layout-page-inner">…</div>
  </main>
</main>
```

**正确取法**：`document.querySelector('.layout-page-inner').parentElement`。

> 顺带：嵌套 `<main>` 本身不符合 HTML 语义（一个文档应只有一个 `main`），属历史遗留。
> `main:has(.page-fill/.page-viewport/.page-pinned)` 这类选择器会**同时命中内外两层**，
> 目前无害（外层本来就 `overflow: hidden`），但改这块 CSS 时要意识到它匹配了两个节点。

### P-24 `overflow` 滚动容器会裁掉 glass-card 阴影——负 margin + padding 抵消 ★★

`.page-pinned-body` 是页面唯一滚动容器；`overflow-y: auto` 会让 `overflow-x` 计算值也变成 `auto`（CSS 规范），
于是卡片的四向外溢阴影被切成直角。修复模式（`src/index.css` `.page-pinned-body`）：

```css
margin: calc(var(--shadow-bleed) * -1);   /* -0.75rem：向四周溢出到 gutter 里 */
padding: var(--shadow-bleed);             /*  0.75rem：把内容推回原位 */
```

盒模型账要算清楚，否则会平移半个 gutter：
- 左右：gutter 1.5rem > bleed 0.75rem，溢出后仍在页面留白内，**内容净位移 0**，滚动条落在距视口边 0.75rem 处。
- 上下：flex `gap-6` 与 `margin-top:-0.75rem` + `padding-top:0.75rem` 相抵，
  header 底边到首张卡片仍是 **1.5rem**（与旧 `space-y-6` 完全一致）。

同类既有机制：`.glass-card-grid`、`.shadow-safe`、`.layout-page-inner .overflow-x-auto` 自动注入（见 [§04 §4.1.2](./04-page-layout-spec.md)）。

### P-25 自定义 CSS 在 `@tailwind utilities` 之后——别在里面写 `gap`/`display` ★★

`src/index.css` 的 `.page-fill` / `.page-pinned` 等段落位于 `@tailwind utilities`（第 16 行）**之后**，
同特异性下**后者胜**。所以在 `.page-pinned { gap: 1.5rem }` 里写死 gap，会把调用方传的 `gap-3` 压掉（和 [P-21](#p-21-表面类自带---radius-圆角小圆角要-roundednpx-) 同源）。

**分工原则**：
- CSS 段落只写 Tailwind **做不到**的东西：`main:has(…)` 选择器、media query 内的 `overflow` 锁定。
- `display` / `flex-direction` / `gap` 一律由组件侧的**工具类**提供（`PinnedPage` 上的 `flex flex-col gap-6`），
  这样 `cn()`（tailwind-merge）能让调用方的 `gap-4` 正常覆盖。

### P-26 demo 模式的页面崩溃 ≠ 你改坏了 ★

`pnpm dev:demo` 的 Mock Server（`src/lib/mockServer.ts`）**只覆盖了部分 `/api/*`**，未匹配的请求会
穿透到 `originalFetch` → 404 → 页面拿到 `undefined` 字段后崩溃。当前已知在 demo 模式下**必崩**的页面
（在**未改动的 HEAD 代码**上同样复现，与前端改动无关）：

| 路由 | 报错 | 缺失的 mock |
|------|------|------------|
| `/logs` | `Cannot read properties of undefined (reading 'toLocaleString')` | `/api/logs/*` |
| `/persona-config` | `… (reading 'enable_persona')` | 人格配置 |
| `/mcp-config` | `… (reading 'length')` | MCP 配置 |
| `/ai-statistics` | `tokenByModel.map is not a function` | 统计 |
| `/ai-budget` | `… (reading 'length')` | 预算 |
| `/backup` | `nodes.map is not a function` | 备份树 |
| `/ai-kanban` | `… (reading 'task_count')` | 看板 |
| `/ai-config` | `mcpConfigs is not iterable` | AI 配置 |

**判定方法**（别凭感觉甩锅，用这招取证）：把可疑页面临时换成 HEAD 版本再复现一次——

```bash
git show HEAD:src/pages/XxxPage.tsx > /tmp/Xxx.HEAD.tsx
cp src/pages/XxxPage.tsx /tmp/Xxx.mine.tsx      # 先备份自己的改动！
cp /tmp/Xxx.HEAD.tsx src/pages/XxxPage.tsx      # 临时回退
# …复现…
cp /tmp/Xxx.mine.tsx src/pages/XxxPage.tsx      # 一定要还原
```

同样的错、同样的行 → 是既有问题（demo 数据缺口），不是你的改动。
⚠️ 工作区可能有**用户未提交的改动**（如 AIBudgetPage），务必先备份再回退，`git checkout` 会直接丢掉它们。

### P-27 Git Bash 会把 `/ai-meme` 这种参数改写成 Windows 路径 ★

**症状**：给脚本传路由 `/ai-meme`，脚本里收到 `C:/Program Files/Git/ai-meme`，页面渲染成 404。

**根因**：MSYS/Git-Bash 的 POSIX 路径转换会把「看起来像绝对路径」的参数自动转成 Windows 路径。

**修复**：`MSYS_NO_PATHCONV=1 node script.mjs /ai-meme`，或参数不带前导 `/`（在脚本里再拼）。

### P-28 固定区（header/toolbar）过宽会被**永久裁掉、够不着** ★★

**症状**：桌面端某个宽控件行（如 `/ai-knowledge` 在 xl 断点处的「切换 + 搜索 + 5 个按钮」一行）
右侧按钮被切掉，且**没有任何办法滚到**——鼠标怎么拖都出不来。

**根因**：`main:has(.page-pinned)` 在桌面把 `main` 设成了 `overflow: hidden`。迁移前 `main` 是
`overflow: auto`，内容太宽时会给出**页面级横向滚动条**兜底；锁死之后这条退路没了。
而 `.page-pinned-body` 因为自带 `overflow-y:auto`（连带 `overflow-x:auto`）能自己横向滚，
**只有 header / toolbar 这两个普通容器会被硬裁**。

**修复**（已内置在 `src/index.css`）：让固定区自己兜横向溢出——

```css
.page-pinned-toolbar {
  overflow-x: auto;                          /* 自己横向滚，不再依赖 main */
  margin: calc(var(--shadow-bleed) * -1);    /* overflow-x:auto 连带裁竖直阴影 → 上下留位 */
  padding: var(--shadow-bleed);              /* 负 margin 与内边距相抵，净位移 0 */
}
.page-pinned-header,
.page-pinned-toolbar,
.page-pinned-body {
  min-width: 0;   /* flex item 默认 min-width:auto，会拒绝窄于 min-content */
}
```

**启示**：**任何**把滚动容器从 `main` 挪到页面内部的改动，都要重新检查「原本靠 main 兜底的溢出
现在谁来兜」。自检：`document.querySelector('.layout-page-inner')` 的 `scrollWidth - clientWidth`
在桌面必须为 `0`——大于 0 就意味着有内容被 `main: overflow:hidden` 裁掉且不可达。

### P-29 `Badge` 自带 `whitespace-nowrap`——放进 flex 行会把兄弟挤成「单字列」★★

**症状**（/ai-budget 看板曾如此）：移动端一行里的状态文案被压成**每行一个字**的竖条，
同行的按钮被顶出屏幕右侧、点不到。

**根因**：`src/components/ui/badge.tsx` 的基类含 **`whitespace-nowrap`**，所以 Badge 的
min-content 宽 = 整句话的宽度，**永不收缩**。把它塞进 `flex items-center` 且外层
`justify-between`、又没有 `flex-wrap` 时：

- Badge 抢走一整行宽度；
- 兄弟 `<span>` 是可换行文本，min-content 只有**一个字**（中文尤其致命）→ 被压成单字列；
- 按钮没有 `shrink-0`，被挤出容器。

`en-US` / `ja-JP` 的文案通常比中文长得多（本例 en 的提示 ~2 倍长），**只按中文目测会漏掉**。

```tsx
// ❌ 一行硬排：Badge 不换行 + 无 flex-wrap + 按钮无 shrink-0
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <AlertTriangle className="w-5 h-5" />
    <span className="font-medium">{t('…statusOff')}</span>
    <Badge variant="outline">{t('…tipOff')}</Badge>
  </div>
  <Button size="sm">{t('…refresh')}</Button>
</div>

// ✅ 移动端堆叠 + 状态组可换行 + Badge 允许折行 + 按钮不缩
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
    <AlertTriangle className="w-5 h-5 shrink-0" />
    <span className="font-medium">{t('…statusOff')}</span>
    <Badge variant="outline" className="max-w-full whitespace-normal">{t('…tipOff')}</Badge>
  </div>
  <Button size="sm" className="shrink-0 self-start sm:self-auto">{t('…refresh')}</Button>
</div>
```

**四件套**：`flex-col sm:flex-row` 堆叠 ／ 内层 `flex-wrap` ／ Badge `whitespace-normal max-w-full`
／ 按钮 `shrink-0 self-start sm:self-auto`；图标一律 `shrink-0`。

**自检**：窄屏（390 / 360）下遍历 DOM，任何元素的 `getBoundingClientRect().right` 都不应超过
`.layout-page-inner` 的右边界；同时留意某个文本节点的**高度异常大**（= 被挤成竖条）。

### P-30 Live Chat / 长连接：handler 进 useEffect 依赖 → WS 断连风暴 ★★★

**症状**：改昵称、切会话、语言切换后「消息发出去了但 AI 从不回复」；Network 里 WS 反复
close/open；core 日志出现请求被丢弃。

**根因**：把 `onMessage` 闭包或 `identity` / `conversations` / `t` 放进「建连」的
`useEffect` 依赖 → 每次状态更新都 `disconnect` + 新建 socket。Core 适配器队列里的未完成
请求超过 **STALE_CHAT_REQUEST_TTL ≈ 8s** 会被当作陈旧请求丢弃。

**修法**：

```tsx
const handleIncomingRef = useRef<(msg: MessageSend) => void>(() => {});
handleIncomingRef.current = (msg) => { /* 读 identityRef / activeIdRef / tRef */ };

useEffect(() => {
  if (!coreLoaded) return;
  const client = new LiveChatWsClient({ token: getAuthToken() || '', … });
  client.setHandlers({ onMessage: (m) => handleIncomingRef.current(m) });
  client.connect();
  return () => client.disconnect();
}, [coreLoaded]); // 仅建连相关；禁止 identity / conversations / t
```

同类长连接（Console 日志 WS 等）同样适用。详见 [§11 §11.4](./11-live-chat.md)。

### P-31 Live Chat：同会话连发被 8s 队列 TTL 丢弃 ★★

**症状**：用户快速连发两条，只有第一条有回复，或两条都没回复；后端侧请求「进了队列又没了」。

**根因**：GsCore 对适配器未完成 chat 请求有约 **8 秒** 陈旧 TTL。同一会话在上一轮 AI 还在跑时
再上报，后发请求可能在队列里等到超时被丢。

**修法**（`LiveChatPage` 已实现）：

- `awaitingByConv[convId]`：发送成功置 true；收到 `role==='bot'` 或 120s 保险超时后清 false；
- 发送 / +1 / 重试前若 awaiting → `toast.message(t('liveChat.waitForReply'))` 并 return；
- 空下发（TTL 丢弃导致 content 无有效段）**不要画气泡**，但仍要处理 `echo` 回执。

详见 [§11 §11.6](./11-live-chat.md)。

### P-32 早柚协议历史 typo 字段不要「纠正」★

后端 / 协议里长期存在：

- `ButtonData.permisson`（应为 permission）
- `excute_delete_message` / `excute_ban_user`（应为 execute_…）

前端 `types.ts` / `protocol.ts` **必须原样对齐**。改成正确拼写会导致按钮权限与撤回/禁言
控制包全部失效。若后端某天正式改名，再做兼容双读。

## B. 性能优化

### B.1 图片
- 头像图片用 `?t=Date.now()` 防缓存（注意每次渲染会发新请求，可酌情缓存）。
- 背景图 CSS `background-size: cover` + `opacity` 降耗；`onError` 隐藏加载失败的图。
- 大列表的头像/背景考虑懒加载。

### B.2 状态管理
- 复杂计算 `useMemo` 缓存；事件处理 `useCallback`；`useEffect` 依赖正确。
- 多 Context 消费者任一变化都重渲染 → 用选择器只订阅需要的片段；Context 值 `useMemo` 包装。

### B.3 列表渲染
- 列表 >50 项考虑虚拟滚动（`@tanstack/react-virtual` 等）。
- 大数据分页加载；加载态用 `Skeleton` 骨架屏。
- 纯展示组件考虑 `React.memo`；大列表可用 `will-change` 提示浏览器。

### B.4 API 请求
- 并发独立请求用 `Promise.all`；每个请求都要错误处理。
- 合理利用缓存机制。

### B.5 毛玻璃
- `backdrop-filter` GPU 密集，避免叠在长列表每一项；低端设备/设置中可提供关闭选项。

### 快速检查清单
- [ ] 列表 >50 项考虑虚拟滚动
- [ ] 图片懒加载与适当缓存
- [ ] useEffect 依赖完整
- [ ] Context 值 useMemo 包装
- [ ] 避免 render 中新建函数/对象
- [ ] 纯展示组件 `React.memo`

## C. 新页面落地自查清单（总）

- [ ] 根容器：标题页用 `<PinnedPage>`（**无** `p-6` / `overflow-auto` / `max-w-*`，页边距由 AppLayout 提供）；全高单卡片页 `page-fill flex glass-card` + 内层 clip（[§04](./04-page-layout-spec.md)）
- [ ] `PinnedPage` 的 `header={…}` 只放标题 + 同行按钮；`bodyClassName`/`className` 跟随原页面间距；注释用 `/* */`（[§04 §4.1.0](./04-page-layout-spec.md)）
- [ ] 卡片网格加 `glass-card-grid`；glass-card 宿主无 `overflow-hidden`（P-19）
- [ ] 标题 `text-3xl font-bold` + 内联图标 `w-8 h-8`（无背景容器）；副标题 `text-muted-foreground mt-1`（无 `text-sm`）
- [ ] 卡片/弹窗一律 `className="glass-card"`（**不**用 `isGlass &&`）（[§03](./03-theme-and-styling.md)）
- [ ] 筛选行高度齐平：无 Tab → `h-9`；有 TabButtonGroup → 默认高度 + 同行 `h-11`（`tabToolbarControlClass`），禁止压矮 group（[§05](./05-components-and-form-controls.md)）
- [ ] `Select` 的"全部"用 `__all__`，非空串
- [ ] 字段说明用 Tooltip + `HelpCircle`，不用独立文字行
- [ ] 输入+下拉用 `InputWithDropdown`、标签用 `TagsInput`、切换用 `TabButtonGroup`、后端字段用 `DynamicConfigPanel`（不手搓）（[§06](./06-reusable-component-catalog.md)）
- [ ] Switch 不加冗余 `data-[state=checked]:bg-primary`；被 Tooltip 包裹时加 `<span>`
- [ ] loading / error / empty 三态齐全
- [ ] 三语言 JSON 同步 + 必要时三个 `index.ts`；leaf key 对齐（跑自查命令）
- [ ] 插值用 `t(key, params)`
- [ ] 侧边栏 `getNavItems` 项带稳定 `id`；新图标进 `ICON_MAP`（[§09](./09-sidebar-navigation.md)）
- [ ] `App.tsx` 注册路由
- [ ] 配置页脏检查同时比 `config` 与 `rawConfig`，原始快照等全部加载完再设（[§07](./07-config-pages-and-state.md)）
- [ ] 双态 UI 的动作/图标/文案都按同一条件分支（P-4）
- [ ] 三元 + 字符串拼接整体加括号（P-1）
- [ ] Live Chat / 长连接：WS handler 用 ref，建连 effect 不依赖业务 state（P-30）；同会话防连发（P-31）
- [ ] 协议 typo 字段保持兼容（P-32）；详见 [§11](./11-live-chat.md)
- [ ] `npx tsc --noEmit -p tsconfig.app.json` 不新增报错
