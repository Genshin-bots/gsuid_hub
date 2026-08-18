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

## 7.6 任务配置：主备双配置（Primary + Backup）★

任务配置页（`TaskConfigSection`）展示 **2 个区块**：
- 高级任务（含主配置 + 备用配置）
- 低级任务（含主配置 + 备用配置）

每个区块内的备用配置通过左侧的细竖线 (`border-l-2 border-primary/20 ml-1`) 视觉上
弱化（图标/文字色用 `text-muted-foreground`），让用户一眼看出主备层级关系。
**不要把主备拆成 4 个独立区块**——会破坏"一个任务一组配置"的语义，导致用户
找不到归属。

### 字段命名与持久化位置

| 字段 key | 来源 | 类型 | 说明 |
|----------|------|------|------|
| `high_level_provider_config_name` | `aiConfig.config.*` | string | 高级任务主配置 |
| `high_level_2nd_provider_config_name` | `aiConfig.config.*` | string | 高级任务备用配置 |
| `low_level_provider_config_name` | `aiConfig.config.*` | string | 低级任务主配置 |
| `low_level_2nd_provider_config_name` | `aiConfig.config.*` | string | 低级任务备用配置 |

存储的是 `provider++config_name` 形式的 full name（与 `AllConfigItem.name` 同源）。
真实数据来自 `GET /api/framework-config/GsCore AI AI配置`。

### 主备双配置语义

- **主配置**：正常请求使用。
- **备用配置**：主配置失败或触发限流时由后端自动切换，确保服务可用。
- 建议备用配置选**不同 provider**（避免单点故障）。

### 读写路径——两套并存，**不要混用**

⚠️ **重要**：主配置和备用配置**走两条不同的保存路径**，原因是历史原因：
后端的 `provider_config` 系列接口只接受 `'high' | 'low'` 作为 task level（参见 `src/lib/api.ts:1064-1078`），
不支持 `'high_2nd' | 'low_2nd'`。

| 配置 | 读 | 写 |
|------|-----|-----|
| **主** high/low | `useProviderConfig.allConfigs.high_level_config / low_level_config`（来自 `providerConfigApi.getAllConfigs()`） | `providerConfigApi.setHighLevelConfig(...) / setLowLevelConfig(...)`（自动同步 framework-config） |
| **备用** 2nd | `aiConfig.config.high_level_2nd_provider_config_name?.value`（直接读 framework-config） | `updateConfigValue(aiConfig.id, 'high_level_2nd_provider_config_name', v)`（与其它 framework-config 字段走同一保存流） |

**踩坑记录**：曾尝试给 `providerConfigApi.setTaskConfig` 加上 `'high_2nd' | 'low_2nd'` 后端
参数，**未确认后端支持前不要这么改**——可能 404。当前实现走 framework-config 路径，
绕过 `providerConfigApi` 限制，跟现有 `websearch_provider` / `image_understand_provider` 等
枚举型字段走的是同一条路。

### 派生校验

页面侧需要校验「选中的备用配置是否仍然存在」——避免出现「配置被删除但 framework-config
字段还指向它」的悬挂引用：

```tsx
const isHighLevel2ndConfigValid =
  !!highLevel2ndConfigValue &&
  provider.allConfigsList.some((c) => c.name === highLevel2ndConfigValue);
```

不通过时显示红色 `notSelectedWarning`（复用现有 key），行为与主配置一致。

### AdvancedSettingsSection 必须排除

`AdvancedSettingsSection` 通过遍历 `aiConfig.config` 渲染"其它"字段，所以新加的 4 个 key
**必须** 加进 `EXCLUDED_KEYS` 数组，否则会和 TaskConfigSection 重复展示：

```ts
const EXCLUDED_KEYS: string[] = [
  // ...
  'high_level_provider_config_name',
  'low_level_provider_config_name',
  'high_level_2nd_provider_config_name',
  'low_level_2nd_provider_config_name',
  // ...
];
```

### i18n 同步点（参考 §02）

每个语言文件需要同步：
- `aiConfig.providerConfig.highLevelTask2nd` / `highLevelTask2ndDesc`
- `aiConfig.providerConfig.lowLevelTask2nd` / `lowLevelTask2ndDesc`
- `aiConfig.providerConfig.setHighLevel2ndSuccess` / `setLowLevel2ndSuccess`

修改 `taskConfig.description` 时建议把「主备双配置语义」写进去，避免用户疑惑为什么要选
两套配置。

### 备用配置 UI 标签的措辞

备用配置的 i18n key 文案**不要再带"高级 / 低级"前缀**（如"高级任务（备用）"），
因为它已经被包裹在"高级任务"区块内，加前缀会重复并显得累赘。
直接用「备用配置 / Backup Config / 予備設定」即可。

## 7.6a OpenAI Provider：远端 Web Search（`remote_web_search`）

位置：`CreateConfigDialog` / `EditConfigDialog`。OpenAI 在「请求方式」下方；Anthropic 在「最大并发」下方。Gemini 不展示。

| UI | 后端字段 | 取值 | 默认 |
|----|----------|------|------|
| 远端 Web Search | `remote_web_search` | `off` / `on` | `on` |

默认 `on`：OpenAI 把请求方式改成 Responses、或直接用 Anthropic 配置，即可用上游内置 `web_search`。`chat_completions` 无视本开关，永远本地 `web_search_tool`。读写走 `useProviderConfig` create/save（Anthropic 分支也要带这个字段）。i18n：`aiConfig.serviceProvider.remoteWebSearch*`。

## 7.6b OpenAI Provider：终端用户标识（`forward_end_user_id`）★

位置：`AIConfig/dialogs/CreateConfigDialog.tsx`、`EditConfigDialog.tsx`；仅 **openai**
provider 的创建 / 编辑弹窗展示。

### 字段

| UI / 表单 | 后端字段 | 类型 | 说明 |
|-----------|----------|------|------|
| 终端用户标识模式 | `forward_end_user_id` | `off` / `hashed` / `raw` | 是否向请求体携带 OpenAI `user` 字段 |
| 摘要盐值 | `end_user_id_salt` | secret string | `hashed` 模式专用；管理员 GET 下发明文，前端默认隐藏 |

选项列表来自 `GET /api/provider_config/options` 的 `forward_end_user_id` 数组（与后端
`FORWARD_MODES` 同源）。`constants.tsx` 中 `FORWARD_END_USER_ID_OPTIONS` 附带各模式说明文案。

### 读写

- 创建：`useProviderConfig.createConfig` 把 `forward_end_user_id`、`end_user_id_salt` 写入
  openai profile JSON。
- 编辑：`EditConfigDialog` 通过 `onChangeField` 更新；盐值空串表示清除。

### i18n

`aiConfig.serviceProvider.forwardEndUserId*`、`endUserIdSalt*` — 三语
`src/i18n/locales/{zh-CN,en-US,ja-JP}/aiConfig.json`。

> 自建网关按人鉴权时，通常将该 profile 设为 `raw` 或 `hashed`，并在账号侧配置
> `ACCOUNT_LLM_CREDENTIAL_CONFIGS`；详见 gsuid_core `24-provider-config.md` 与部署文档
> `13-ai.md` §13.3.1。

## 7.7 网络搜索 / 网页抓取：多源主备 UI ★★

位置：`AIConfig/sections/WebSearchSection.tsx`、`WebFetchSection.tsx`；装配于
`AIConfigPage.tsx`。对应后端 `ai_config` 字段 `websearch_*` / `webfetch_*`（热读，**无需重启**）。

### 字段与默认

| 字段 | 默认 | 说明 |
|------|------|------|
| `websearch_provider` | `Jina` | 主用：Jina / Tavily / Exa / MCP |
| `websearch_lb_strategy` | `error_switch` | `none` / `error_switch` / `auto_balance` |
| `websearch_fallback_order` | `[]` | 备用有序列表（不含主用语义）；空=后端自动收集已配置源 |
| `webfetch_provider` | `Jina` | 主用：Jina / local |
| `webfetch_lb_strategy` | `error_switch` | 同搜索 |
| `webfetch_fallback_order` | `[]`（字段缺失时 UI 也显示空） | 空=后端默认（通常含 local）；**勿在前端合成未落盘默认值** |

密钥配置独立 StringConfig：`jina_config`（搜索+抓取共用）、`tavily_config`、`exa_config`、
`web_fetch_config`（local）。Jina 搜索 **Key 必填**；Jina 抓取 **Key 可选**。

### UI 结构（两 section 同构）

1. **主用源** `ChipGroup` 单选（`selectMode="single"` + 品牌图标 `@thesvg/react`）。
2. **多源策略** 单选 Chip：无 / 错误切换 / 自动分流；文案用 `LabelWithHelp` + **Markdown 多行 tooltip**。
3. **备用顺序** 仅当策略为 `error_switch` | `auto_balance` 时显示（`none` 时整块隐藏）：
   - 多选 Chip，`allowEmpty` + **`showOrderIndex`**（选中 chip 显示 1-based 优先级）；
   - **主用项仍展示**，但 `disabled: true`，标签可标「主用」；
   - **value 与数据层均不含主用**（不写入 `*_fallback_order`）；
   - **切换主用时**在 `AIConfigPage` 静默从 fallback 剔除新主用（无 toast）；
     **无 soft-memory**——旧主用不会自动回到备用勾选，需用户再次点选；
   - provider 身份用 `sameProviderId`（trim + 大小写不敏感）比较；
   - `onValueChange` 只写回可见选中（已过滤主用）。
4. **配置分区**：主用块 `border-primary/30 bg-primary/5` + 实心 Badge；备用块虚线边框 + 仅渲染
   `effectiveFallbacks`（过滤掉主用）的配置面板；**无备用勾选则不渲染备用配置区**。

### 保存时剥离「备用=主用」

`executeSave` 写入 `websearch_fallback_order` / `webfetch_fallback_order` 前，从数组剔除当前
主用（`filterOutPrimaryProvider`，兜底后端脏数据 / 大小写漂移）；若发生剔除则 toast 警告，
并用 **`applyConfigsAndMarkSaved`** 原子同步 `configs` + `originalConfig`，避免 dirty 状态与后端不一致。

### AdvancedSettingsSection 排除

下列 key 必须进 `EXCLUDED_KEYS`，避免与 WebSearch/WebFetch section 重复：

```ts
'websearch_provider', 'websearch_lb_strategy', 'websearch_fallback_order',
'webfetch_provider', 'webfetch_lb_strategy', 'webfetch_fallback_order',
```

### 后端契约

详见 gsuid_core：`docs/skills/gscore-ai-core-api/references/11-mcp-image-search-and-meme.md` §11.3 / §11.3b、
`docs/skills/gscore-deploy/references/13-ai.md`。

## 7.8 `/mcp-config` 传输方式：stdio / SSE / Streamable HTTP ★

位置：`src/pages/MCPConfigPage.tsx` + `src/lib/api.ts` 的 `MCPTransport`。
后端契约：`gsuid_core/webconsole/docs/26-mcp-config.md`。

### 三种传输

| `transport` | 含义 | 表单字段 | 何时用 |
|-------------|------|----------|--------|
| `stdio` | 本地子进程 | `command` / `args` / `env` | 默认；`uvx` / `npx` 启动本地 MCP |
| `streamable_http` | Streamable HTTP（当前推荐远程传输） | `url` / `headers` | 远程 MCP，URL 多为 `…/mcp` |
| `sse` | 旧版 HTTP+SSE | `url` / `headers` | 仅当服务端仍只提供 `/sse` |

类型别名：`http` / `streamable-http` / 官方 JSON 的 `type: "http"` 一律归一为 `streamable_http`。
未写 `transport` 时：URL 路径以 `/sse` 结尾 → `sse`；其它 http(s) URL → `streamable_http`；否则 → `stdio`。

### UI 约束

- 表单用 `ToggleGroup` 三选一，`flex-wrap`，**不要**再做成 stdio/sse 两档。
- `sse` 与 `streamable_http` **共用** URL + headers 区块（`isHttpMcpTransport`），不要复制两套表单。
- 列表 Badge 短文案：`stdio` / `SSE` / `HTTP`；展开详情用完整 i18n。
- 列表渲染必须兜底：`config.tools ?? []`、`config.args ?? []`、`config.env ?? {}`。远程配置的 `to_dict` 会省略空 `args`，直接 `.length` 会崩（P-26）。

### i18n

三语 `mcpConfig.json` 同步：`transportHelp` / `transportStdio` / `transportSse` / `transportStreamableHttp` / `url*` / `headersHelp`。
