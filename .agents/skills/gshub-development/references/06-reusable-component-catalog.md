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

## 6.1 TabButtonGroup —— 分段切换按钮（含可选下拉二级筛选）★★★

位置：`src/components/ui/TabButtonGroup.tsx`。

用于替代散落的 ToggleGroup / 自定义按钮组，提供统一的标签切换样式。  
**2026-08 起**支持可选 **`dropdown` 拆分按钮**：某一主 Tab 可带「主区 + 右侧 ▾」，用于主分类 + 二级筛选（如「插件 → 按 plugin 名过滤」），**既有无 dropdown 的调用方零改动**。

### 6.1.1 接口

```ts
export interface TabButtonDropdownItem {
  value: string;
  label: string;
  /** 子项前缀图标（推荐 PluginIcon / lucide） */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabButtonOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /**
   * 可选：将该项升级为「主按钮 + 箭头下拉」。
   * 不传 → 普通分段按钮（历史行为不变）。
   */
  dropdown?: {
    items: TabButtonDropdownItem[];
    value: string;                         // 当前二级选中值（由调用方 state 持有）
    onValueChange: (value: string) => void;
    /** 点主按钮时写入的二级值（「全部」）。默认 items[0].value */
    allValue?: string;
    align?: 'start' | 'center' | 'end';   // 下拉对齐，默认 end
    contentClassName?: string;
  };
}

interface TabButtonGroupProps {
  options: TabButtonOption[];
  value: string;                 // 主 Tab 当前值
  onValueChange: (value: string) => void;
  className?: string;            // 作用在内层 glass-card 容器
  buttonClassName?: string;      // 作用在每个分段（含拆分外层）
  disabled?: boolean;            // 整组禁用
}

// 同行对齐常量（导出）
export const tabToolbarControlClass = 'h-11';
export const tabToolbarIconButtonClass = 'h-11 w-11';
export const tabToolbarGroupWrapClass =
  'flex shrink-0 items-center [&_.shadow-safe]:!my-0 [&_.shadow-safe]:!py-0';
```

### 6.1.2 两种形态

| 形态 | 条件 | 外观 | 点击行为 |
|------|------|------|----------|
| **普通分段** | 无 `dropdown` 或 `items` 为空 | 图标 + 文案 | `onValueChange(option.value)` |
| **拆分按钮** | 有 `dropdown.items` | 主区（图标+文案）\| ▾ | 见下表 |

**拆分按钮点击语义（必须遵守，禁止再整钮触发菜单）：**

| 用户操作 | 主 Tab | 二级筛选 |
|----------|--------|----------|
| **点击主区**（文字/左侧图标） | 选中该 `option.value` | 重置为 `allValue`（默认首项，通常 `__all__`） |
| **点击右侧 ▾** | 打开菜单时切到该主 Tab（**保留**当前二级值） | 不变，直到用户点菜单项 |
| **点菜单某子项** | 选中该主 Tab | `dropdown.onValueChange(item.value)` |
| 当前子项 | — | 右侧 ✓ 标记（`DropdownMenuItem` + `Check`，非 RadioItem） |

实现要点（源码契约）：

- 主区与 ▾ 是**两个独立 button**，中间竖线分隔；外层容器统一 active 底色（`bg-primary`）。
- 菜单用 `DropdownMenuItem`（非 `RadioItem`），左侧固定 **20×20 图标槽**，避免插件 PNG 被挤没。
- 子项 `icon` 推荐 `PluginIcon`（`h-4 w-4`）或 lucide；无图标时槽位仍占位，避免文字错位。
- 「全部」哨兵用 **`__all__`**（与 Radix Select 空值约定一致，见 [§05 §5.5](./05-components-and-form-controls.md)），**禁止** `value=""`。

### 6.1.3 基础用法（无下拉）

```tsx
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
  tabToolbarIconButtonClass,
} from '@/components/ui/TabButtonGroup';

// 页内主 Tab（预算 / 知识库 / 运维诊断等）
<TabButtonGroup
  options={[
    { value: 'overview', label: t('aiBudget.tabs.overview'), icon: <Gauge className="w-4 h-4" /> },
    { value: 'config',   label: t('aiBudget.tabs.config'),   icon: <Settings className="w-4 h-4" /> },
  ]}
  value={activeTab}
  onValueChange={setActiveTab}
/>
```

### 6.1.4 下拉二级筛选（参考实现：`/ai-capability-agents`）

业务：来源 Tab = `builtin | plugin | user`；其中 **plugin** 需按 list 接口每项的 `plugin` 字段再筛。

```tsx
import { PluginIcon } from '@/components/ui/plugin-icon';

// state
const [activeSource, setActiveSource] = useState<'builtin' | 'plugin' | 'user'>('builtin');
const [selectedPlugin, setSelectedPlugin] = useState('__all__'); // 二级：全部 / 具体插件名

// options 构造（示意）
const sourceOptions = [
  { value: 'builtin', label: `内置 ${counts.builtin}`, icon: <Package className="h-4 w-4" /> },
  {
    value: 'plugin',
    // 主按钮文案可随二级筛选变化
    label: selectedPlugin === '__all__'
      ? `插件 ${counts.plugin}`
      : `${selectedPlugin} ${pluginCounts.get(selectedPlugin) ?? 0}`,
    icon: selectedPlugin === '__all__'
      ? <Puzzle className="h-4 w-4" />
      : <PluginIcon pluginName={selectedPlugin} className="h-4 w-4" />,
    dropdown: {
      value: selectedPlugin,
      onValueChange: setSelectedPlugin,
      allValue: '__all__',
      align: 'end',
      items: [
        {
          value: '__all__',
          label: `全部插件 (${counts.plugin})`,
          icon: <Puzzle className="h-4 w-4" />,
        },
        ...pluginNames.map((name) => ({
          value: name,
          label: `${name} (${pluginCounts.get(name) ?? 0})`,
          icon: <PluginIcon pluginName={name} className="h-4 w-4" />,
        })),
      ],
    },
  },
  { value: 'user', label: `我的 ${counts.user}`, icon: <UserRound className="h-4 w-4" /> },
];

<TabButtonGroup
  options={sourceOptions}
  value={activeSource}
  onValueChange={(v) => setActiveSource(v as typeof activeSource)}
  className="w-max"
/>
```

列表过滤时：

```ts
profiles.filter((p) => {
  if (p.source !== activeSource) return false;
  if (activeSource === 'plugin' && selectedPlugin !== '__all__') {
    return (p.plugin || '').trim() === selectedPlugin;
  }
  return true;
});
```

注意：`/ai-capability-agents` **不展示 `persona` 来源**（人格投影归 `/persona-config`）；Tab 与过滤都只认 `builtin | plugin | user`。

### 6.1.5 与 Input / Button 同行

保持 **默认 group 高度**，同行控件 `h-11`：

```tsx
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

### 6.1.6 注意事项与反模式

1. **不要加 `w-full`**——默认 `inline-flex` 自适应（确需占满才 `className="w-full"`）。
2. 按钮过多自动 `flex-wrap`。
3. 主 Tab 的 `icon` 经 `asHoverIcon` 包装，外层固定 `w-[22px] h-[22px]`；图标本身 `w-4 h-4`。  
   **下拉子项的 icon 不走 asHoverIcon**，直接渲染（`PluginIcon` 的 `<img>` 必须能显示）。
4. 外壳已带 `glass-card`，**不要再传主题分支 class**。
5. **禁止压矮**：不要 `h-8`/`h-9` 外壳或 `buttonClassName="h-8 py-0"`。详见 [§05 §5.4](./05-components-and-form-controls.md)。
6. 与同行 `items-center` 时用 `tabToolbarGroupWrapClass` 包一层，压掉 `shadow-safe` 竖直 bleed。
7. **禁止**为「带筛选的 Tab」再手搓一层 `Select` + 外挂 Button；应给对应 `TabButtonOption` 加 `dropdown`。
8. **禁止**把整个拆分按钮都做成 `DropdownMenuTrigger`——用户期望点主区 = 全部，只有 ▾ 才展开。
9. 二级 state 由**调用方**持有；列表刷新后若当前插件名消失，应自行回退 `__all__`（参考页已有 `useEffect`）。

### 6.1.7 全站使用面（按页面）

| 页面 | 用途 | 是否用 dropdown |
|------|------|-----------------|
| `/ai-capability-agents` | 来源 builtin / **plugin（下拉按插件）** / user | ✅ plugin 项 |
| `/ai-knowledge` | 文本/图片知识；来源筛选 | 否 |
| `/ai-tools` `/ai-meme` `/ai-budget` `/ai-approvals` | 主 Tab / 筛选 | 否 |
| `/ai-statistics` `/ai-memory` `/ai-ops` `/ai-debug` | 多 Tab | 否 |
| `/ai-kanban` `/batch-push` `/backup` `/database` `/git-update` `/plugins` 等 | 插件选择 / 类型筛选 | 否（`/git-update` 插件 Tab 用 `PluginIcon` 作 **主 icon**） |
| `/themes` `/framework-config` 等 | 二级切换 | 否 |

新增「主分类 + 再按实体细分」的筛选时，**优先复制 `/ai-capability-agents` 的 dropdown 写法**。

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
  /**
   * 禁用「新选中」。多选模式下若该项**已选中**，仍允许点掉取消
   * （用于「主用源出现在备用列表中」：可见、不能再勾上）。
   */
  disabled?: boolean;
  /** 冲突态（如主用又在备用里）— 红色边框提示 */
  conflict?: boolean;
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
  showOrderIndex?: boolean;              // 多选：已选 chip 显示 1-based 顺序（优先级）
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
// 主用禁用 + 有序备用（网络搜索/抓取）：主用可见不可勾选；value 不含主用；showOrderIndex
<ChipGroup
  options={providers.map((p) => ({
    value: p,
    label: p === primary ? `${p} (主用)` : p,
    disabled: p === primary,
  }))}
  value={fallbackOrder.filter((p) => p !== primary)}
  onValueChange={(visible) => onChangeFallback(visible.filter((p) => p !== primary))}
  selectMode="multiple"
  allowEmpty
  showOrderIndex
/>
```

**disabled 契约（2026-08）**：

| 模式 | `option.disabled` 且未选中 | `option.disabled` 且已选中 |
|------|---------------------------|---------------------------|
| multiple | 不可勾选 | **仍可点掉取消** |
| single | 不可选 | 不可操作 |

仅显式 `option.conflict` 走冲突边框样式（`disabled` 已选不自动标红）。参考：`WebSearchSection` / `WebFetchSection` 备用源 Chip。

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

## 6.7 PluginIcon —— 插件 ICON（统一入口）★★

位置：`src/components/ui/plugin-icon.tsx`。  
URL 构建：`getPluginIconUrl(name)`（`src/lib/api.ts`）。

**禁止**在页面里再复制一份「`img` + onError 回退 Package」；`/plugins`、`/git-update`、`/database`、`/ai-capability-agents` 等均应 `import { PluginIcon } from '@/components/ui/plugin-icon'`。

```ts
export interface PluginIconProps {
  pluginName: string;
  className?: string;          // 默认 'w-[18px] h-[18px]'
  fallbackClassName?: string;  // 失败时 Package 图标附加 class
}
```

### 解析顺序（`getPluginIconUrl`）

1. **项目 LOGO 特例**：名称（小写）落在 `PROJECT_LOGO_PLUGIN_NAMES` 时 →  
   `` `${import.meta.env.BASE_URL}ICON.png` ``（即 `public/ICON.png`，与品牌/Demo LOGO 同源）。  
   当前包含：`core_command`（`/plugins` 列表里的核心命令插件无独立 `plugins/*/ICON.png`）。
2. **Demo 模式**：`demoPluginIcon(name)`（`demo-assets/demo-plugin-icons/*.png` 或字母占位）。
3. **正常模式**：`/api/plugins/icon/{name}?token=…`（后端 `plugin_icon_api`）。

### 用法

```tsx
import { PluginIcon } from '@/components/ui/plugin-icon';

// Tab / 列表缩略
<PluginIcon pluginName={plugin.name} />
// 详情大图
<PluginIcon pluginName={selected.name} className="w-10 h-10" />
// 与 TabButtonGroup 下拉子项
{ icon: <PluginIcon pluginName={name} className="h-4 w-4" /> }
// 数据库页「核心功能」显示名 → 实际请求 gsuid_core 图标
<PluginIcon pluginName={name === '核心功能' ? 'gsuid_core' : name} />
```

组件行为：加载失败 → `Package` 兜底；切换 `pluginName` 时重置错误态。  
若需为其它无 ICON 的内置插件复用项目 LOGO，只需在 `PROJECT_LOGO_PLUGIN_NAMES` 追加小写名（**不要**在各页面写死路径）。

## 6.8 ModelBrandIcon / ProviderBrandIcon —— 厂商品牌图标

位置：`src/components/ui/model-brand-icon.tsx`。唯一从 `@thesvg/react` 拉 **LLM 厂商** 图标的入口（MCP 页已不再展示品牌图）。

| 组件 | 用途 |
|------|------|
| `ModelBrandIcon` | 优先按**模型名**匹配厂商；`provider` 仅兜底（因很多配置 `provider=openai` 实为兼容层） |
| `ProviderBrandIcon` | 按协议/厂商类型选图标，不解析模型名 |

要点：

- 规则表 `BRAND_RULES`：匹配到后用官方 `default` 彩版。
- **OpenAI 例外**：官方 path 硬编码白标 → 渲染强制 `path` 走 `currentColor`，颜色继承父级文字（Badge / 按钮里与文案同色，禁止再写死 `text-black`）。
- 网络搜索/抓取 section 的 Jina/Tavily/Exa/MCP 图标在 section 内直接 `import { JinaAi, Tavily, … } from '@thesvg/react'`，**不**走 ModelBrandIcon（那是模型配置专用）。

## 6.9 LabelWithHelp —— AIConfig 字段标签 + Markdown 帮助

位置：`src/pages/AIConfig/shared/LabelWithHelp.tsx`。契约见 [§05 §5.6](./05-components-and-form-controls.md)。  
长说明（多源策略、主备语义）用 **i18n Markdown 字符串**，勿塞超长纯文本进 JSX。

## 6.10 CognitionAttachments —— 节点挂文列表

位置：`src/components/cognition/CognitionAttachments.tsx`。世界枢纽 / 认知节点上的文章列表，**记忆页详情与运行时索引必须复用**，禁止再手写 slot 分组。

- 按 `slot` 分组；`writable` 与 `source` 用 Badge 分开（插件只读 / Agent 可写）。
- 句柄跳转走 `attachmentHref`（`src/lib/cognition.ts`），不要在页面里再解析 `kb_` / `to_`。
- 产品语义见 [§12](./12-memory-graph-and-cognition.md)。
