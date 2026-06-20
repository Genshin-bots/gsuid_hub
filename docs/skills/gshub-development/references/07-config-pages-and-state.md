# 七、配置页与状态管理

> 返回 [SKILL 主入口](../SKILL.md)。

## 7.1 渐进式配置页（Progressive Configuration Page）

混合渲染：已知配置项用精心设计的专门 UI，未知配置项用通用 `ConfigField` 兜底，保证后端新增字段时前端不崩。

- **预期配置项（Expected Keys）**：已知并设计了专门 UI 的配置项。
- **预料之外配置项（Unexpected Keys）**：后端返回但前端未单独处理的配置项。
- **混合渲染**：预期项用定制 UI，意外项用通用卡片。

### 实现模式（以 `ButtonMarkdownSettings.tsx` 为例）

```tsx
// 1. 定义预期配置项 key 列表
const EXPECTED_CONFIG_KEYS = ['SendMDPlatform', 'ButtonRow', 'SendButtonsPlatform', /* … */];

// 2. 同时保存原始完整配置
interface LocalButtonMarkdownConfig {
  id: string; name: string; full_name: string;
  config: ButtonMarkdownConfig;                   // 预期配置项（类型安全）
  rawConfig?: Record<string, PluginConfigItem>;   // 原始完整配置
}

// 3. 后端配置 → ConfigFieldDefinition
const convertToConfigField = (key, configItem): ConfigFieldDefinition => {
  let type: ConfigFieldType = 'text';
  const rawType = configItem.type?.toLowerCase() || '';
  if (rawType.includes('bool')) type = 'boolean';
  else if (rawType.includes('int')) type = 'number';
  else if (rawType.includes('list') || rawType.includes('array'))
    type = configItem.options ? 'multiselect' : 'tags';
  // …
  return { type, label: configItem.title || key, value: configItem.value, options: configItem.options };
};

// 4. 取出预料之外的配置项
const unexpectedConfigItems = useMemo(() => {
  if (!cfg?.rawConfig) return {};
  const items: Record<string, ConfigFieldDefinition> = {};
  for (const [key, item] of Object.entries(cfg.rawConfig))
    if (!EXPECTED_CONFIG_KEYS.includes(key)) items[key] = convertToConfigField(key, item);
  return items;
}, [cfg?.rawConfig]);

// 5. handleChange 双向处理（意外项更新 rawConfig）
// 6. handleSaveConfig 必须包含两部分（预期 + 意外），不能漏
// 7. 渲染意外项到「其他设置」卡片
{Object.keys(unexpectedConfigItems).length > 0 && (
  <Card className="glass-card">
    <CardHeader><CardTitle className="flex items-center gap-2"><Cog className="w-5 h-5" />其他设置</CardTitle>
      <CardDescription>由插件或后端新增的配置项</CardDescription></CardHeader>
    <CardContent className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(unexpectedConfigItems).map(([key, field]) => (
          <ConfigField key={key} fieldKey={key} field={field} onChange={handleChange} />
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

适用场景：一个配置组既有固定核心配置项（设计专门 UI），又有可能变化的扩展配置项（无法预知）。

## 7.2 配置页变更检测（dirty）必须双比较 ★

渐进式配置页**必须同时跟踪并比较 `config` 与 `rawConfig` 两个原始快照**：

```tsx
const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
const [originalRawConfig, setOriginalRawConfig] = useState<Record<string, PluginConfigItem> | undefined>();

const isConfigDirty = useMemo(() => {
  if (!config) return false;
  const configChanged = JSON.stringify(config.config) !== JSON.stringify(originalConfig);
  const rawConfigChanged = config.rawConfig && originalRawConfig
    ? JSON.stringify(config.rawConfig) !== JSON.stringify(originalRawConfig) : false;
  return configChanged || rawConfigChanged;     // 漏掉 rawConfig 是经典 bug
}, [config, originalConfig, originalRawConfig]);
```

- **初始化时**保存两个原始快照。
- **保存成功后**同步更新两个原始快照（漏 `setOriginalRawConfig` → 意外项改动检测不到/误报）。
- 获取配置详情后也要 `setOriginalRawConfig(JSON.parse(JSON.stringify(data.config)))`。

常见错误：
```tsx
// ❌ 只比较 config（漏 rawConfig）
return JSON.stringify(config.config) !== JSON.stringify(originalConfig);
// ❌ 保存后只更新 originalConfig（漏 setOriginalRawConfig）
```

需遵循此规范的文件：`MiscSettings.tsx`、`ButtonMarkdownSettings.tsx`，及任何含 `EXPECTED_CONFIG_KEYS` + `rawConfig` 的配置组件。

## 7.3 多请求加载下的保存按钮误亮（竞态）★★

`AIConfigPage` 把配置抽进 `useFrameworkConfig` hook，多个详情**逐个异步加载**。若在全部加载完成前就设 `originalConfig`，会脏检查误判、保存按钮误亮。规范做法：

```tsx
// 1) 用 ref 去重，避免 useEffect 依赖 configs 时重复请求
const fetchedConfigNamesRef = useRef<Set<string>>(new Set());
useEffect(() => {
  configList.forEach(c => {
    if (!configs[c.id] && !fetchedConfigNamesRef.current.has(c.full_name)) {
      fetchedConfigNamesRef.current.add(c.full_name);
      fetchConfigDetail(c.full_name);
    }
  });
}, [configList, configs, fetchConfigDetail]);

// 2) 等「所有」详情加载完，再初始化原始快照
useEffect(() => {
  if (configList.length > 0 &&
      Object.keys(configs).length >= configList.length &&  // ← 关键门控
      !hasInitialized) {
    setOriginalConfig(JSON.parse(JSON.stringify(configs)));
    setHasInitialized(true);
  }
}, [configs, configList, hasInitialized]);

// 3) 非配置操作（切换高/低级任务、刷新列表）完成后也要同步 originalConfig
// 4) 保存时只发送「实际变化」的配置，避免并发写入后端竞态
const changedConfigs = Object.values(configs).filter(c => {
  const original = originalConfig[c.id];
  if (!original) return true;
  return JSON.stringify(c.config) !== JSON.stringify(original.config);
});
```

### ⚠️ 本次更新引入的权衡（务必知晓）

`AIConfigPage` 的脏检查改成：`originalConfig` 为空时回退为 `Object.keys(configs).length > 0`：

```tsx
const configChanged =
  Object.keys(originalConfig).length === 0
    ? Object.keys(configs).length > 0
    : JSON.stringify(configs) !== JSON.stringify(originalConfig);
```

- **解决**：某详情请求失败时 `configs` 永远到不了 `configList.length`、`hasInitialized` 永不为 true、`originalConfig` 永远为空 → 旧逻辑下保存按钮**永久禁用**（改了也存不了）。回退分支让此时仍能检测「有内容即可存」。
- **代价**：首次正常加载短暂窗口内（部分详情已到、`originalConfig` 尚未初始化）按钮会**短暂误亮**，全部加载完自愈。
- 本次还把保存按钮 `disabled` 去掉了 `isSectionsLocked`（`!isAIEnabled || pendingRestart`）。改这块前确认是否符合预期，优先考虑"详情加载失败时单独标记错误态"，而非让 `originalConfig` 长期为空。

## 7.4 `refresh()` 不要遗漏快照重置

`useFrameworkConfig.refresh()` 会 `setConfigs({})` + `setHasInitialized(false)`，但**未重置 `originalConfig`**。刷新期间 `originalConfig` 持旧快照、`configs` 为空 → 脏检查误判为脏（按钮误亮），直到重新加载完成自愈。新增类似 hook 时，刷新应一并清空原始快照。

## 7.5 AI 配置页设计原则（参考实现）

`AIConfigPage`（AI 基础配置）是渐进式配置页的旗舰实现，设计原则：

1. **渐进式披露**：核心配置默认展开，高级配置默认折叠（`expandedSections` 状态）；按用户选择动态显示相关配置（启用 Rerank 后才显示 Rerank 模型配置）。
2. **配置分组**：基础/服务提供方/模型/搜索等逻辑组，每组有标题+描述。
3. **兼容性**：`EXPECTED_CONFIG_KEYS` 记录已知项，意外项归入"其他配置项"，后端新增不崩。
4. **一体化布局**：用连贯 section + `Separator` 分隔，页面占满 `p-6`。
5. **每个配置项都有图标**，统一放 Label 前。
6. **消除重复标签**：独立 `<Label>` 显示标题，`ConfigField` 设 `showLabel={false}`。

后续注意：复杂配置页考虑 `useReducer` 替代多个 `useState`；避免深层嵌套的 `useCallback` 依赖链；`PluginConfigItem` 从 `@/lib/api` 导出复用，勿重复定义。
