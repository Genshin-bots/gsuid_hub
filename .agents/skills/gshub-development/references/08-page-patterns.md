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

**横向长表格的操作列要固定在右缘**（/database 二三十列的表，修改/删除不能要用户滚到头才够得到）：给操作列 `th`/`td` 加 `.table-sticky-right`（`index.css`，含主题自适应背景、行悬停面纱、行分隔线补线）。光固定不够——固定列会被误认为「最后一列」，所以 JS 侧在「右侧还有隐藏列」（`scrollLeft < maxScroll`，**有溢出时初始 scrollLeft=0 也满足**）时一并切换 `.table-sticky-fade`（左侧渐变遮罩，`::before` 挂在固定格左缘）+ `.table-sticky-shadow`（分层阴影），滚到最右后一并退场；同值 setState 防重渲染。实现要点见 `index.css` 该段注释：固定列必须自带背景（glassmorphism 下叠 backdrop-filter，`@supports` 降级；不透明度收进 `--sticky-bg-alpha`，遮罩终点色复用它无缝衔接）；行分隔线用 inset box-shadow 而非 border（collapse 边框模型下 sticky 单元格不带走 tr 的 border-b）。

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

### 无障碍：每个 `DialogContent` 都必须包含 `DialogTitle` + `DialogDescription` ★★

Radix UI 在 dev 模式下会对**缺少** `DialogTitle` 或 `DialogDescription` 的 `DialogContent` 刷出警告（屏幕阅读器无障碍要求）。**别只看 Title 缺失就完事**——`Description` 缺失同样会有警告（"Missing `Description` or `aria-describedby={undefined}`"）。

#### 三种合规写法（任选其一）

```tsx
// ① 视觉可见 + 屏幕阅读器可读（推荐用于正常有上下文的弹窗）
<DialogContent>
  <DialogHeader>
    <DialogTitle>编辑人格：{name}</DialogTitle>
    <DialogDescription>编辑该人格的描述、配置与媒体资源</DialogDescription>
  </DialogHeader>
  …
</DialogContent>

// ② 仅给屏幕阅读器（适合弹窗已经有可见 UI 说明的场景）
<DialogContent>
  <DialogHeader>
    <DialogTitle>移动表情包</DialogTitle>
    <DialogDescription className="sr-only">
      {t('aiMeme.detail.targetFolder')}
    </DialogDescription>
  </DialogHeader>
  …
</DialogContent>

// ③ 自定义标题结构（如 PluginStorePage 的 README 弹窗，原本用 <h2><p>）
//    把视觉占位的 <h2>/<p> 替换为 <DialogTitle>/<DialogDescription>，
//    保留 className 以维持视觉样式不变。
<DialogContent>
  <div className="px-6 py-4 border-b">
    <DialogTitle className="text-lg font-semibold truncate">
      {selectedPlugin?.id}
    </DialogTitle>
    <DialogDescription className="text-sm text-muted-foreground">
      {selectedPlugin?.description}
    </DialogDescription>
  </div>
  …
</DialogContent>
```

#### 新建/补全 Dialog 的四步走
1. **找位置**：每个 DialogContent 的 children（通常是 DialogHeader 内）都必须有 `DialogTitle`。
2. **加 Description**：补一个 `DialogDescription`；若不想让视觉多一行文本就加 `className="sr-only"`。
3. **加 i18n key**：用 `*AriaDesc` 后缀（避免与可见文案混淆），三语言 JSON 同步（见 [§02](./02-i18n.md)）。
4. **全量自检**：跑一遍 grep `<DialogContent` → 逐个核对，避免漏改。

#### 为什么不要让 `DialogTitle` 条件渲染为 null

Radix 的 `DialogContent` 在 mount 时会立刻检查 `titleId`，如果初始 render 时为 null 就刷警告（之后即使 Title 加上也已刷出）。所有 DialogTitle 都必须**稳定地**渲染一个非空元素，包括三元分支、map 列表——每个分支都返回 `DialogTitle`。AppSidebar 重启/暂停弹窗里那个三目嵌套（`completed ? A : restarting ? B : C`）三个分支都要带 `<DialogTitle>`，参见 [§10 P-18](./10-pitfalls-and-performance.md)。

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

## 8.7 Trace 瀑布详情页（AI 历史 `/ai-history`，2026-07-08 重构）

`src/pages/AIHistoryPage.tsx` + `src/components/ai-history/TraceWaterfall.tsx`。左「会话列表」+ 右「Trace 瀑布」详情，是「列表 + 二级详情」的一个变体，几处专有约定：

- **详情不是聊天气泡，是 Logfire 式 Trace 瀑布**：`buildTrace()` 把后端**扁平** `entries` 重建成 span 树——`run_start`→`run_end` = 一个「Agent 运行」span，内含 `ModelRequestNode`=「对话 <model>」span、`tool_call`+`tool_return`（按 `tool_call_id` 配对）= 工具 span、`sub_agent` 的 `agent_linked` = **可展开懒加载**的子 Agent 子瀑布。每行密排：`时间 · 缩进+展开+子数 · 图标+标签 · token 徽章(Σ↗↙) · 甘特条 · 时长`。甘特条相对全局时间窗定位。
- **列表按 `chain_id` 归并**：一条逻辑会话（可能多物理分段）= 一张卡片，key 用 `chain_id`（不是 `session_uuid`）。`segment_count > 1` 显示分段徽章；选中先加载**最新分段**，「加载更早分段」按 `segment_index` 升序拼接。取某分段详情：`source==='memory'` 用真实 `session_id`+`uuid`（实时），`disk` 用 `file_name` 去 `.json` 的 stem 作 `session_id`（O(1)）。
- **`history_reset` 画独立色块（reason 分色）**：`user_clear` 红 / `persona_switch` 紫 / `auto_compact` 灰——三类「历史重置」行为视觉必须可区分。色用 tailwind 颜色 + `dark:` 变体（`darkMode:["class"]`），亮暗都可读。
- **i18n**：文案在 `aiHistory.waterfall.*`（含 `reset.*`）与 `aiHistory.segmentsCount/subAgentsCount/loadEarlierSegments/...`，三语言同步。
- 对接后端契约见 gsuid_core `webconsole/docs/23-ai-session-logs.md`。

## 8.8 Live Chat（控制台内嵌适配器，`/live-chat`）

完整分层、协议、WS、持久化与坑点见 **[§11 Live Chat](./11-live-chat.md)**。此处只记页面模式要点：

- **骨架**：`.page-fill flex glass-card` + 内层 `overflow-hidden rounded-[inherit]` 左右分栏（与 Session 管理同族，**不是** `PinnedPage`）。
- **左会话 / 右消息**：移动端互斥全屏（`showChatOnMobile`）；桌面固定宽侧栏。
- **协议与传输不进页面**：`src/lib/liveChat/*`；UI 在 `src/components/live-chat/*`；`LiveChatPage` 只编排。
- **连接态**：顶栏/侧栏 `ConnectionBadge`；demo 模式不建连。
- **危险操作**：删除会话 / 清空消息用 `AlertDialog`；身份设置用 `Dialog`（Title + Description 齐全）。
- **与相近页分工**：Live Chat = 模拟适配器调试协议；Session 管理 = 已有 Session 的 HTTP 历史；AI 历史 = Trace 瀑布只读；`/console` = 系统日志 WS。
