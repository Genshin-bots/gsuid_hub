# 六、封装组件目录（完整接口与用法）

> 返回 [SKILL 主入口](../SKILL.md)。这些组件是全站交互一致性的载体，**遇到对应需求必须复用，禁止手搓**。
> 规则与高度统一见 [§05](./05-components-and-form-controls.md)。

## 6.0 PinnedPage —— 固定标题页骨架 ★★★

位置：`src/components/layout/PinnedPage.tsx`。**所有「H1 + 副标题 + 内容流」的标题页都用它当根容器**，
不要再手写 `<div className="space-y-6">`。桌面端标题（+ 操作控件行）常驻、只滚内容；移动端退回普通滚动。

```ts
interface PinnedPageProps {
  header: React.ReactNode;      // 固定区一：标题块 + 与标题同行的右侧按钮
  toolbar?: React.ReactNode;    // 固定区二（可选）：紧贴标题下方的操作控件行
  children: React.ReactNode;    // 滚动区
  bodyClassName?: string;       // 滚动区布局类，默认 'space-y-6'
  className?: string;           // 根容器附加类，默认 'gap-6'（同时决定三段间距）
}
```

```tsx
<PinnedPage
  bodyClassName="space-y-4"   // 原页面是 space-y-4 就原样传
  className="gap-4"           // 标题↔控件行↔内容 三段间距一起改
  header={
    /* 注意：这里是 JS 表达式上下文，注释用 /* *\/ 而非 {/* *\/} */
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 …/><p …/></div>
      <Button className="self-start sm:self-auto shrink-0">…</Button>
    </div>
  }
  toolbar={<TabButtonGroup options={tabOptions} value={tab} onValueChange={setTab} />}
>
  {/* 卡片 / 列表 / Dialog 都放这里 */}
</PinnedPage>
```

**`toolbar` 的判定标准（重要）**：紧贴标题下方那一块，**操作控件**（TabButtonGroup / 二级切换 /
筛选搜索栏 / 与之同行的按钮）→ 放 `toolbar`，随标题常驻；**数据展示**（统计卡 / 看板 / 提示 banner）
→ 留在 `children` 跟着滚。全站 13 个页面有 `toolbar`、13 个没有。

完整机制、对照表、迁移口诀与 4 个例外页面见 [§04 §4.1.0](./04-page-layout-spec.md#410-pinnedpage--固定标题页默认骨架-)。

## 6.1 TabButtonGroup —— 分段切换按钮

位置：`src/components/ui/TabButtonGroup.tsx`。用于替代散落的 ToggleGroup / 自定义按钮组，提供统一的标签切换样式。

```ts
export interface TabButtonOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}
interface TabButtonGroupProps {
  options: TabButtonOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;        // 作用在内层 glass-card 容器
  buttonClassName?: string;  // 作用在每个分段按钮
  disabled?: boolean;
}

// 同行对齐常量（导出）
export const tabToolbarControlClass = 'h-11';
export const tabToolbarIconButtonClass = 'h-11 w-11';
export const tabToolbarGroupWrapClass =
  'flex shrink-0 items-center [&_.shadow-safe]:!my-0 [&_.shadow-safe]:!py-0';
```

用法：

```tsx
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
  tabToolbarIconButtonClass,
} from '@/components/ui/TabButtonGroup';

// 单独使用（页内主 Tab）
<TabButtonGroup
  options={[
    { value: 'overview', label: t('aiBudget.tabs.overview'), icon: <Gauge className="w-4 h-4" /> },
    { value: 'config',   label: t('aiBudget.tabs.config'),   icon: <Settings className="w-4 h-4" /> },
  ]}
  value={activeTab}
  onValueChange={setActiveTab}
/>

// 与 Input / Button 同行：保持默认 group 高度，同行控件 h-11
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

注意事项：
1. **不要加 `w-full`**——组件默认 `inline-flex` 自适应内容宽度（确需占满才传 `className="w-full"`）。
2. 按钮过多自动 `flex-wrap` 换行。
3. icon 经 `asHoverIcon` 包装，外层固定 `w-[22px] h-[22px]` 槽位；图标本身用 `w-4 h-4`。
4. 外壳已带 `glass-card`，会按 `[data-style]` 自动适配毛玻璃/纯色，**不要再传主题分支 class**。
5. **禁止压矮**：不要写 `className="h-9 p-0.5"` / `buttonClassName="h-8 py-0"` 之类把默认高度砍掉；同行对齐用 `tabToolbarControlClass`（`h-11`）。详见 [§05 §5.4](./05-components-and-form-controls.md)。
6. 与同行控件 `items-center` 时，用 `tabToolbarGroupWrapClass` 包一层，压掉外层 `shadow-safe` 的竖直 bleed，避免整行被顶歪。

参考页：`/ai-knowledge`、`/batch-push`、`/ai-meme`、`/ai-budget`、`/ai-statistics` 等。

## 6.2 InputWithDropdown —— 输入框 + 下拉

位置：`src/components/ui/input-with-dropdown.tsx`。替代所有"输入框 + 下拉列表"组合（既支持自由输入又支持从预设列表选）。**禁止手动用 Popover + Input + Button 拼装。**

```ts
export interface InputWithDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;        // 触发按钮占位（无值时）
  inputPlaceholder?: string;   // 下拉内输入框占位
  disabled?: boolean;
  className?: string;
  popoverWidth?: string;       // 默认 'w-[400px]'
}
```

用法：

```tsx
<InputWithDropdown
  value={model}
  onChange={setModel}
  options={['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet']}
  placeholder="选择或输入模型名称"
  inputPlaceholder="输入或选择模型名称"
/>
```

注意：`options` 为空时自动隐藏下拉，仅显示输入框；当前值与选项匹配时自动高亮 `bg-accent`；与 `Select` 区别——`Select` 只能选，`InputWithDropdown` 可选可输入。
已用位置：`ConfigField.tsx` 的 select 类型、`AIConfigPage` 新增/编辑配置对话框（Base URL、模型名）。

## 6.3 TagsInput —— 标签/关键词输入

位置：`src/components/config/TagsInput.tsx`。管理字符串标签列表。**所有需要标签/关键词输入的场景必须用此组件，禁止自行实现标签 UI。**

```ts
interface TagsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  options?: string[];   // 可选预设标签列表
}
```

用法：

```tsx
import { TagsInput } from '@/components/config/TagsInput';

<TagsInput value={tags} onChange={setTags} />
<TagsInput value={tags} onChange={setTags} options={['搞笑', '无语', '开心']} />

<div className="space-y-1.5">
  <Label className="text-xs font-medium text-muted-foreground">情绪标签</Label>
  <TagsInput value={emotionTags} onChange={setEmotionTags} />
</div>
```

特性：已添加标签以 chip 展示可点击删除；「更多」按钮打开 Popover 搜索已添加标签；搜索框回车添加新标签；提供 `options` 时 Popover 显示可选列表；支持复制标签文本。

## 6.4 ChipGroup（MultiSelectChipGroup）—— 多选/单选 Chip

位置：`src/components/ui/MultiSelectChipGroup.tsx`。通用化的平台/模式选择 Chip 组，支持多选与单选。

```ts
interface ChipOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean;
}
interface ChipGroupProps {
  options: ChipOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  className?: string;
  chipClassName?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  selectMode?: 'multiple' | 'single';   // 默认 multiple
  showRadioIndicator?: boolean;          // 单选模式显示单选指示器
}
```

用法：

```tsx
// 多选
<ChipGroup
  options={[{ value: 'mention', label: '提及应答' }, { value: 'schedule', label: '定时巡检' }]}
  value={['mention']} onValueChange={setSelectedModes}
/>
// 单选
<ChipGroup
  options={[{ value: 'openai', label: 'OpenAI兼容' }, { value: 'claude', label: 'Claude' }]}
  value={['openai']} onValueChange={(v) => setProvider(v[0])}
  selectMode="single" showRadioIndicator
/>
```

## 6.5 DynamicConfigPanel —— 后端配置项自动渲染

位置：`src/components/config/DynamicConfigPanel.tsx`。根据后端 `PluginConfigItem.type` 自动渲染对应字段 UI，无需为每个字段手写 Label + Tooltip + ConfigField。

### 后端 type → ConfigField type 映射

| 后端 type | 映射为 |
|-----------|--------|
| `*bool*` | `boolean` |
| `*int*` / `*float*` | `number` |
| `*list*` / `*array*` + options | `multiselect` |
| `*list*` / `*array*` 无 options | `tags` |
| `*gstimer*` | `time` |
| `*time*` / `*date*` | `date` |
| `*str*` + options | `select` |
| `*str*` 无 options | `text` |
| `*dict*` / `*object*` | `text`（JSON 序列化） |
| `*image*` | `image` |

### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `config` | `Record<string, PluginConfigItem>` | 后端配置字段映射 |
| `configId` | `string` | 用于 updateConfigValue |
| `onChange` | `(configId, fieldKey, value) => void` | 值变更回调 |
| `excludeKeys?` | `string[]` | 排除的字段（已手动渲染的） |
| `layout?` | `string[][]` | 自定义布局，同数组内字段并排 |

### 用法

```tsx
import { DynamicConfigPanel } from '@/components/config';

// 自动渲染所有字段
<DynamicConfigPanel config={cfg.config} configId={cfg.id} onChange={updateConfigValue} />

// 自定义布局 + 排除已手动渲染的字段
<DynamicConfigPanel
  config={aiConfig.config} configId={aiConfig.id} onChange={updateConfigValue}
  excludeKeys={['enable', 'enable_rerank', 'enable_memory', 'websearch_provider']}
  layout={[['white_list', 'black_list']]}
/>
```

自动特性：按 `title` 显示标签、按 `desc` 生成 Tooltip 帮助图标、按 key 匹配图标（api_key→Key、max→SlidersHorizontal、host→Globe）、未在 `layout` 指定的字段自动追加末尾。
注意：ToggleRow/ChipGroup/Badge 提示等特殊 UI 字段应 `excludeKeys` 排除后手动渲染；type 映射逻辑与 `PluginsPage.tsx` 的 `convertConfigToFields` 一致。

## 6.6 ConfigField —— 通用配置字段

`src/components/config/ConfigField.tsx` 是单字段渲染的底层组件，`DynamicConfigPanel` 内部即用它。渐进式配置页中"预料之外配置项"也用它兜底渲染（见 [§07](./07-config-pages-and-state.md)）。配合独立 `<Label>` 时设 `showLabel={false}` 避免标签重复。
