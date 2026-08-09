# AIConfig 模块

`AIConfigPage` 的拆分实现。

## 背景

原 `src/pages/AIConfigPage.tsx` 是一个 **2719 行** 的"巨石"组件文件，混揉了：
- 20+ 个 `useState` 状态声明
- 10+ 个 `useCallback` / `useMemo` 数据流
- 9 个 section 渲染函数（每个 50~200 行）
- 6 个对话框
- 1 个复杂的 main render JSX
- 4 个共用子组件

这种结构带来三个主要问题：
1. 难以快速定位功能边界
2. 改一个 section 时要在巨型文件里滚动
3. 子组件、对话框、state handler 全部耦合在同一个闭包内，单元测试困难

## 拆分原则

- **状态按领域下钻到 hooks**：`AIConfigPage` 不再直接维护所有 `useState`，而是调用 6 个领域 hook（`useFrameworkConfig` / `useProviderConfig` / `useEmbeddingConfig` / `useMcpToolsConfig` / `useAIWizard` / `useAIServiceSwitch`）。
- **子组件纯渲染**：所有 section 与 dialog 都是"展示型组件"，业务逻辑由父级注入。
- **可独立测试**：每个 hook / section 文件可以独立 mock 依赖，无需启动整个页面。
- **保持原行为不变**：拆分不引入新功能或修改 UI，所有 `t(...)` 文案与原有 i18n key 一致。

## 目录结构

```
src/pages/AIConfig/
├── README.md                    ← 本文件
├── index.ts                     ← 桶导出（sections / dialogs / shared / hooks / types / constants）
├── types.ts                     ← 与后端字段对应的纯类型
├── constants.tsx                ← getModelCapabilities / getEmbeddingModalities 等工厂函数
├── hooks/                       ← 按领域拆分的状态 + 副作用 hook（6 个）
│   ├── index.ts                 ← hooks 桶导出
│   ├── useFrameworkConfig.ts    ← AI 基础配置列表 / 详情 / 脏检查快照
│   ├── useProviderConfig.ts     ← Provider / OpenAI 配置 + 新建/编辑/删除/管理 Dialog 状态与动作
│   ├── useEmbeddingConfig.ts    ← 嵌入模型配置（summary / local / openai）
│   ├── useMcpToolsConfig.ts     ← MCP 服务列表 / 工具映射 / 参数详情
│   ├── useAIWizard              ← AI 配置体检（wizard checklist / status）
│   └── useAIServiceSwitch.ts    ← AI 服务总开关（确认 dialog + pending restart）
├── shared/                      ← 与具体 section 解耦的通用组件
│   ├── ToggleRow.tsx
│   ├── PersonaAvatar.tsx
│   ├── EmptyState.tsx
│   ├── LabelWithHelp.tsx        ← 字段标签 + Markdown 帮助 tooltip
│   ├── HeadingWithHelp.tsx
│   ├── SidebarItem.tsx
│   └── renderRichText.tsx
├── sections/                    ← 页面右侧 section（含搜索/抓取多源）
│   ├── ServiceSwitchSection.tsx
│   ├── TaskConfigSection.tsx
│   ├── WebSearchSection.tsx     ← 网络搜索：主用 + 多源策略 + 备用分区
│   ├── WebFetchSection.tsx      ← 网页抓取：Jina / local 同构 UI
│   ├── ImageUnderstandSection.tsx
│   ├── VectorDbSection.tsx
│   ├── VoiceRecognitionSection.tsx
│   ├── DocumentExtractSection.tsx
│   ├── MemorySettingsSection.tsx
│   ├── MemeSettingsSection.tsx
│   ├── CommandExecutorSection.tsx
│   ├── GsCoreAiMcpServerSection.tsx
│   └── AdvancedSettingsSection.tsx
└── dialogs/                     ← 8 个对话框
    ├── ManageConfigDialog.tsx
    ├── CreateConfigDialog.tsx
    ├── EditConfigDialog.tsx
    ├── DeleteConfigDialog.tsx
    ├── McpToolDialog.tsx
    ├── EmbeddingWarningDialog.tsx
    ├── AIServiceSwitchDialog.tsx
    └── WizardDialog.tsx
```

入口 `src/pages/AIConfigPage.tsx`（约 **1150 行**，相比原 1846 行减少 ~38%）现在是"装配中心"：
- 调用 6 个 hook 拿到全部状态与回调
- 计算 `aiConfig` / 各 provider config 等派生字段
- 计算 `isConfigDirty` 等保存流派生值
- 把数据与回调通过 props 注入到各个纯渲染 section / dialog

## 每个 Hook 的职责

| Hook | 状态量 | 关键 API | 说明 |
| --- | --- | --- | --- |
| [`useFrameworkConfig`](src/pages/AIConfig/hooks/useFrameworkConfig.ts) | `configList` / `configs` / `originalConfig` / `isLoading` / `isLoadingDetail` / `isSaving` / `hasInitialized` | `frameworkConfigApi.getFrameworkConfigList` / `getFrameworkConfig` | AI 基础配置的列表 + 详情，以及 `updateConfigValue` 字段更新。首次加载后自动初始化脏检查快照 |
| [`useProviderConfig`](src/pages/AIConfig/hooks/useProviderConfig.ts) | `providers` / `allConfigs` / `highLevelConfig` / `lowLevelConfig` / `openaiConfigData` / 新建表单 / 4 个 Dialog open | `providerConfigApi.*` | Provider / OpenAI 配置全生命周期，包含新建/编辑/删除/管理 Dialog 的状态与提交逻辑 |
| [`useEmbeddingConfig`](src/pages/AIConfig/hooks/useEmbeddingConfig.ts) | `embeddingSummary` / `embeddingLocalConfig` / `embeddingOpenaiConfig` + 3 个 original 快照 | `embeddingConfigApi.*` | 嵌入模型配置（provider 切换 / local / openai 字段编辑） |
| [`useMcpToolsConfig`](src/pages/AIConfig/hooks/useMcpToolsConfig.ts) | `mcpConfigs` / `mcpToolsConfigs` / `mcpDetailsEditing` + original 快照 / dialog 状态 | `mcpConfigApi.*` | MCP 服务列表 + 工具映射 + 参数详情编辑。通过参数接收外部 `mcpToolsConfig`（来自 `useFrameworkConfig`）以同步 framework config 的 `*_mcp_tool_id` 字段 |
| [`useAIWizard`](src/pages/AIConfig/hooks/useAIWizard.ts) | `wizardChecklist` / `wizardStatus` / `isBackendPendingRestart` / `isPendingRestart` | `aiWizardApi.*` + 启动时 `fetch('/api/ai/wizard/status')` | AI 配置体检状态 |
| [`useAIServiceSwitch`](src/pages/AIConfig/hooks/useAIServiceSwitch.ts) | `isAISwitchDialogOpen` / `pendingAISwitchValue` / `isHelpOnly` | 无直接 API（通过 `updateConfigValue` 写入 framework config） | AI 服务总开关确认 dialog |

## 每个渲染组件的职责

### `AIConfigPage.tsx`（顶层路由 / 装配中心）

> 调用 6 个 hook → 计算派生 → 渲染

- **派生**：`aiConfig` / `embeddingConfig` / `rerankConfig` / `tavilyConfig` / `exaConfig` / `miniMaxConfig` / `memoryConfig` / `memeConfig` / `mcpToolsConfig` / `qdrantConfig` / `isAIEnabled` / `websearchProvider` / `imageUnderstandProvider` / `embeddingProvider` / `asrProvider` / `documentExtractProvider` / `*ProviderOptions` / `isConfigDirty`
- **保存流**：`executeSave` / `handleSaveConfig` / `handleConfirmEmbeddingSave` + `EmbeddingWarningDialog` 逻辑
- **渲染**：Header + AI 总开关 + Sidebar + 右侧激活 Section + 8 个 Dialog

### sections

| Section | 关键依赖 | 说明 |
| --- | --- | --- |
| `ServiceSwitchSection` | `isAIEnabled` | AI 总开关（也独立渲染在页面顶部） |
| `TaskConfigSection` | `allConfigsList` / `highLevelConfig` / `lowLevelConfig` | 高级/低级任务模型选择 |
| `WebSearchSection` | `websearchProvider` / `websearchLbStrategy` / `websearchFallbackOrder` / jina·tavily·exa / MCP | 网络搜索：默认 Jina；多源策略 + 主备配置分区（见 gshub §07.7） |
| `WebFetchSection` | `webfetchProvider` / `webfetchLb*` / `jinaConfig` / `webFetchConfig` | 网页抓取：默认 Jina Reader + 备用 local |
| `ImageUnderstandSection` | `imageUnderstandProvider` / MCP 工具 | 图片理解服务提供方 |
| `VectorDbSection` | Qdrant / Embedding / Rerank 三大子段 | 向量数据库服务 |
| `VoiceRecognitionSection` | `asrProvider` / MCP 工具 | 语音识别 |
| `DocumentExtractSection` | `documentExtractProvider` / MCP 工具 | 文档提取 |
| `MemorySettingsSection` | `memoryConfig` | 记忆设置（模式 + System-2 + Eval-Mode） |
| `MemeSettingsSection` | `memeConfig`（可能为 undefined） | 表情包设置 |
| `AdvancedSettingsSection` | 排除 `EXCLUDED_KEYS` 后的 aiConfig 字段 | 兜底渲染所有其它字段 |

### dialogs

| Dialog | 触发源 | 说明 |
| --- | --- | --- |
| `ManageConfigDialog` | 任务配置 → 「管理配置」 | 列表 + 跳转编辑/删除/新建 |
| `CreateConfigDialog` | `ManageConfigDialog` → 新建 | 表单含 provider / config name / base url / api keys / model / 能力多选 |
| `EditConfigDialog` | `ManageConfigDialog` → 编辑 | 字段同 Create 但 name 不可改 |
| `DeleteConfigDialog` | `ManageConfigDialog` → 删除 | 二次确认 |
| `McpToolDialog` | 各 section 中 MCP 关联按钮 | 按 MCP 服务分组列出所有工具 |
| `EmbeddingWarningDialog` | 保存前检测到 Embedding / Qdrant 变更 | 重构向量数据前确认 |
| `AIServiceSwitchDialog` | AI 总开关切换 | 启用/禁用确认 + 使用帮助 |
| `WizardDialog` | 顶部「检查配置」按钮 | AI Wizard 状态总览 |

### shared

| 组件 | 用途 |
| --- | --- |
| `ToggleRow` | 「图标 + 标题 + 描述 + Switch」通用行 |
| `LabelWithHelp` | 字段 Label + `?`；string description 按 Markdown 渲染 |
| `HeadingWithHelp` | section 标题 + 帮助 |
| `PersonaAvatar` | 角色头像：远程 + 失败回退 + 禁用置灰 |
| `EmptyState` | 居中图标 + 标题 + 副标题 |
| `SidebarItem` | 桌面 / 移动（折叠）双形态 |
| `renderRichText` | 富文本渲染（Markdown → JSX） |

## 状态 / 事件流向

```
AIConfigPage (装配中心，~1150 行)
    │
    ├── useFrameworkConfig() ─── configs / updateConfigValue / markSaved / isSaving
    │
    ├── useProviderConfig()  ─── providers / allConfigs / highLevel|lowLevel / openaiConfigData
    │     └── 4 个 Dialog 动作: handleCreate|Save|Delete|SetHigh|SetLow
    │
    ├── useEmbeddingConfig() ─── embeddingSummary / local|openai configs + markSaved
    │
    ├── useMcpToolsConfig({mcpToolsConfig, updateConfigValue}) ─── mcpConfigs / mcpToolsConfigs / mcpDetailsEditing
    │
    ├── useAIWizard()        ─── wizardChecklist / wizardStatus / isBackendPendingRestart
    │
    ├── useAIServiceSwitch({aiConfig, updateConfigValue, setPendingRestart})  ─── dialog + confirm
    │
    ├── 派生: aiConfig / 各 provider config / isConfigDirty
    │
    ├── 保存流: executeSave / handleSaveConfig / handleConfirmEmbeddingSave
    │
    └── 渲染
         ├── Header + AI 总开关 + 检查配置 + 保存按钮
         ├── Sidebar
         ├── renderActiveSection()  →  10 个 section
         └── 8 个 Dialog
```

## 添加新 Section 的步骤

1. 在 `sections/` 下新建 `MyNewSection.tsx`，**只依赖 props**，不直接调用 API
2. 在 `sections/...` 中 `export interface MyNewSectionProps` 列出所有依赖
3. 在 `index.ts` 中添加 re-export
4. 在 `AIConfigPage.tsx` 中：
   - 如需新状态：在对应 hook 中添加（或新建 hook）
   - 在 `renderActiveSection()` 的 `switch` 中增加一个 `case`
   - 在 `sidebarItems` 数组中增加一个条目
5. 在 i18n 中补充 `aiConfig.myNew.*` 翻译键

## 添加新 Dialog 的步骤

1. 在 `dialogs/` 下新建 `MyNewDialog.tsx`
2. 定义 props（包含 `open` / `onOpenChange` / 必要数据 / 回调）
3. `index.ts` 中 re-export
4. `AIConfigPage.tsx` 中：
   - 如需新状态：在对应 hook 或 `useAIServiceSwitch` 中添加
   - 渲染 `<MyNewDialog open={...} onOpenChange={...} ... />`

## 添加新 Hook 的步骤

1. 在 `hooks/` 下新建 `useMyNewDomain.ts`
2. `hooks/index.ts` 中 re-export
3. `index.ts`（桶文件）中 `export * from './hooks'` 已涵盖，无需额外修改
4. 在 `AIConfigPage.tsx` 中调用并解构所需状态与回调

## 已知约定

- **i18n 路径**：`aiConfig.*`，请在 `src/i18n/locales/{zh-CN,en-US,ja-JP}/aiConfig.json` 维护。
- **样式 token**：使用 Tailwind 主题色（`text-primary` / `bg-muted/30` 等），与项目其它页面保持一致。
- **玻璃态**：`isGlass` prop 来自 `useTheme().style === 'glassmorphism'`，用于在玻璃主题下切换边框与背景透明度。
- **API 调用**：`@/lib/api` 中的 `frameworkConfigApi` / `providerConfigApi` / `mcpConfigApi` / `embeddingConfigApi` / `aiWizardApi`。API 调用已下沉到各 hooks，子组件只接收最终结果。
- **脏检查**：`useFrameworkConfig` 维护 `originalConfig` 快照；`useEmbeddingConfig` 维护 `originalEmbedding*` 快照；`useMcpToolsConfig` 维护 `originalMcp*` 快照。三者汇总到 `AIConfigPage` 的 `isConfigDirty` 计算中。

## 未来优化方向

- 方案 B：抽取 `useSaveController` hook + `normalizeConfigValue` 工具函数，进一步缩短 `AIConfigPage`
- 方案 C：抽取 `SectionsRouter` / `ConfigPageHeader` / `SidebarMenu` 渲染组件
- 方案 D：把 `aiConfig / tavilyConfig / ...` 等具名配置查找抽到 `useDerivedConfigs` hook
- 给每个 hook / section 写最小测试（mock 依赖 + 断言关键交互）

---

如有任何疑问，请查看 git blame 找到原 `AIConfigPage.tsx` 中的对应行号（拆分按原行号顺序进行）。
