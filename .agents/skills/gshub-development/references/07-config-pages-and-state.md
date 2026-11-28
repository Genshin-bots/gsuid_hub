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

## 7.6 任务模型路由：星型节点图谱（Star-Topology Routing Graph）★★

`/ai-config`「模型服务」页签下半区使用零外部画布依赖（`React + SVG`）的星型节点路由图谱（`AIConfig/graph/TaskRoutingGraphSection.tsx` + `AIConfig/hooks/useTaskGraphConfig.ts`），替代早期的高/低级双下拉框。

- **中心配置枢纽（`StarHubCard`）**：圆角 `glass-card` 卡片，展示 `ModelBrandIcon`、配置名、模型名与卡片内部「备用配置（`secondary`）」。新增用户（`high=""`、`low=""`）默认展示两个 `+` 空枢纽（`slot_high` / `slot_low`）并预连默认任务线，点击选择已有配置或创建后自动绑定；存量用户即便高/低级指向同一配置也保留两个独立初始枢纽，支持从已添加配置中增删枢纽（删除有连线的枢纽时弹窗迁移任务）。
- **「默认高级 / 默认低级」徽章是推导态而非 role 标签**：后端保存时按 `chat` / `turn_router` 连向的枢纽分别写入高/低档槽位，因此前端徽章也必须按 `edges.chat` / `edges.turn_router` 动态推导（连线目标缺失时回退 role 标签，对齐后端 fallback）。改线后徽章自动跟着走，**不要**退回按 `node.role` 静态标注。
- **环绕任务卫星（`StarSatelliteBubble`）**：圆形气泡，半径按近 30 天用量（`Token 用量` / `调用次数` 可切换）做 `log1p` 对数映射并钳制在 `[26px, 54px]`（0 用量仍以最小半径展示）；主对话（`chat`）与自主行动（`autonomy`）带专属高亮环。层级是**父子扇形折叠**而非聚合球：`CORE_STAR_TASK_IDS`（11 个一级核心任务，`aiTaskKinds.ts`）常驻一级轨道；内置低频任务按 `BUILTIN_LOW_FREQ_PARENT_MAP` 挂为对应核心任务的子节点（`capability_agent:<node_id>` 挂 `capability_agent`；未知新任务按默认档位兜底归 `chat` / `turn_router`），点击父节点徽标逐个展开，或用工具栏「展开全部 / 收起」一键切换（`showAllChildren`）；子节点被改连到其他枢纽后自动脱离父级成为独立卫星（`capability_agent` 子代理的"拆分"就是这条路径，无独立拆分对话框），可通过「跟随父节点」并回。`follows_caller=true`（如 `image_understand`）不入图。
- **主动保存与整包排除契约**：图谱上的连线、增删枢纽、主备切换、节点拖拽均先保存在 `useTaskGraphConfig` 草稿态并点亮页面右上角「保存配置」（`isConfigDirty`）；点击保存时校验所有有任务连线的枢纽已完成配置选择且主配置存在于 `allConfigsList`（否则拦截提示并自动定位到问题节点），已不存在的备用配置（`secondary`）在卡片/顶栏标黄提示且保存前自动剥离（带 warning toast），避免历史残留配置死锁保存流；通过 `PUT /api/ai_task_models/graph` 原子落库并由后端同步 `high_level_*` / `low_level_*` / `task_model_overrides`。因此 `AIConfigPage.executeSave` 向 `frameworkConfigApi.updateFrameworkConfig` 提交整包时**必须排除** `IMMEDIATE_TASK_CONFIG_KEYS`（`high_level_provider_config_name`、`low_level_provider_config_name`、`high_level_2nd_provider_config_name`、`low_level_2nd_provider_config_name`、`task_model_overrides`、`task_model_graph`），避免旧快照覆盖图谱刚写入的值。`AdvancedSettingsSection` 是**白名单制**（`ADVANCED_PRIMARY_GROUPS` / `EXPERT_TUNING_GROUPS`，见 `runtimeConfigKeys`）：这组键不在白名单内自然不会重复渲染，无需也不要维护排除清单。
- **画布滚轮与视口契约**：画布内直接支持滚轮缩放；同时监听外层 `.page-pinned-body` 滚动，在连续滚页惯性期（280ms 内）放行普通滚轮，避免滚页过程中画布滑过鼠标下方时劫持滚轮变成误缩放，且内联画布高度按视口自适应留出上下卡片可视余量。全屏态或 `Ctrl/Cmd + 滚轮` 始终直接缩放，按 `Esc` 退出全屏。`ResizeObserver` 必须等 `draftGraph` 挂载（`hasDraftGraph`）后再绑定并测量真实宽高，避免首次 loading 态跳过挂载导致镜头偏心。
- **工具栏操作语义**：`undo`（经 `undoStackRef` 同步读取栈顶以兼容 React 18 批处理；拖拽起点压栈，上限 50 步）、`放弃草稿`（`discardDraftChanges`，回滚到上次保存态，本身也可被 undo）、`自动整理`（重算布局）、`恢复默认双枢纽`（有确认弹窗）。拖拽占位 `+` 枢纽松手时的 click 会命中卡片本体，`handleRequestCreateForHub` 必须自查 `suppressNextClickRef`（popover 那条路径之外）。
- **「+ 枢纽 → 新建配置 → 自动绑定」时序契约**：`markPendingBindHub` 记录的 pending 绑定在 `allConfigsList` 出现新配置时被消费；对话框**取消**时靠 `createDialogOpen` 关闭沿清除。无竞态的前提是 `useProviderConfig.handleCreateConfig` **先 `await fetchAllConfigs()` 再 `setIsCreateDialogOpen(false)`**——调换顺序会让成功路径被误判为取消。
- **旧版 Core 降级（P-17）**：`GET /api/ai_task_models` 响应缺 `graph` 字段即判定旧后端（`isGraphUnsupported`），图谱顶部出横幅提示升级；此时草稿可编辑但**不计入页面脏状态**（否则保存按钮永久误亮）、保存流程跳过图谱提交。

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
`AIConfigPage.tsx` 顶部页签栏相邻的两个独立页签（`webSearch` / `webFetch`）。
对应后端 `ai_config` 字段 `websearch_*` / `webfetch_*`（热读，**无需重启**）。

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
2. **多源策略** `TabButtonGroup size="sm"` 分段控件：无 / 错误切换 / 自动分流（带策略图标）；
   文案用 `LabelWithHelp` + **Markdown 多行 tooltip**。
3. **备用顺序** 仅当策略为 `error_switch` | `auto_balance` 时显示（`none` 时整块隐藏）：
   - 多选 Chip，`allowEmpty` + **`showOrderIndex`**（选中 chip 显示 1-based 优先级）；
   - **主用项仍展示**，但 `disabled: true`，标签可标「主用」；
   - **value 与数据层均不含主用**（不写入 `*_fallback_order`）；
   - **切换主用时**在 `AIConfigPage` 静默从 fallback 剔除新主用（无 toast）；
     **无 soft-memory**——旧主用不会自动回到备用勾选，需用户再次点选；
   - provider 身份用 `sameProviderId`（trim + 大小写不敏感）比较；
   - `onValueChange` 只写回可见选中（已过滤主用）。
4. **源配置卡**：主用与所有备用 provider 合并在一张「源配置」`ConfigCard` 内，
   用 `TabButtonGroup size="sm"` 切换当前编辑的 provider——主用在首位（徽标「主用」），
   备用按 `fallback_order` 顺序（徽标为 1-based 顺序号），均带品牌图标；
   下方整宽渲染所选源的 `DynamicConfigPanel`（默认 3 列）或 MCP 关联 UI。
   本地 `selectedProvider` 状态在选中项离开列表时回落到主用；
   策略为 `none` / 仅主用一个源时隐藏切换器，改为一行「图标 + 名称 + 主用徽标」。
   仅渲染 `effectiveFallbacks`（过滤掉主用）。

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

详见 gsuid_core：`.agents/skills/gscore-ai-core-api/references/11-mcp-image-search-and-meme.md` §11.3 / §11.3b、
`.agents/skills/gscore-deploy/references/13-ai.md`。

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
