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

`Input`(h-10) + `SelectTrigger`(h-9) + `Button`(h-10) 并排不显式统一 `h-9` → 高低不齐。详见 [§05](./05-components-and-form-controls.md)。

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

- [ ] 根容器 `p-6 space-y-6`，**无** `max-w-*` / 响应式页边距（[§04](./04-page-layout-spec.md)）
- [ ] 标题 `text-3xl font-bold` + 内联图标 `w-8 h-8`（无背景容器）；副标题 `text-muted-foreground mt-1`（无 `text-sm`）
- [ ] 卡片/弹窗一律 `className="glass-card"`（**不**用 `isGlass &&`）（[§03](./03-theme-and-styling.md)）
- [ ] 每个筛选行的 `Input`/`Select`/`Button` 都 `h-9`，高度齐平（[§05](./05-components-and-form-controls.md)）
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
- [ ] `npx tsc --noEmit -p tsconfig.app.json` 不新增报错
