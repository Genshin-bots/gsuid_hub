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

- **状态留在主页面**：`AIConfigPage` 仍然是状态的唯一拥有者，section / dialog 通过 props 接收所需数据与回调。
- **子组件纯渲染**：所有 section 与 dialog 都是"展示型组件"，业务逻辑由父级注入。
- **可独立测试**：每个 section 文件可以独立 mock 父级回调，无需启动整个页面。
- **保持原行为不变**：拆分不引入新功能或修改 UI，所有 `t(...)` 文案与原有 i18n key 一致。

## 目录结构

```
src/pages/AIConfig/
├── README.md                    ← 本文件
├── index.ts                     ← 桶导出
├── types.ts                     ← 与后端字段对应的纯类型
├── constants.ts                 ← getModelCapabilities 等工厂函数
├── shared/                      ← 与具体 section 解耦的通用组件
│   ├── ToggleRow.tsx
│   ├── PersonaAvatar.tsx
│   ├── EmptyState.tsx
│   └── SidebarItem.tsx
├── sections/                    ← 页面右侧的 9 个 section
│   ├── ServiceSwitchSection.tsx
│   ├── TaskConfigSection.tsx
│   ├── WebSearchSection.tsx
│   ├── ImageUnderstandSection.tsx
│   ├── VectorDbSection.tsx
│   ├── VoiceRecognitionSection.tsx
│   ├── DocumentExtractSection.tsx
│   ├── MemorySettingsSection.tsx
│   ├── MemeSettingsSection.tsx
│   └── AdvancedSettingsSection.tsx
└── dialogs/                     ← 6 个对话框
    ├── ManageConfigDialog.tsx
    ├── CreateConfigDialog.tsx
    ├── EditConfigDialog.tsx
    ├── DeleteConfigDialog.tsx
    ├── McpToolDialog.tsx
    ├── EmbeddingWarningDialog.tsx
    └── WizardDialog.tsx
```

入口 `src/pages/AIConfigPage.tsx` 现在 **只剩 1 个文件**，
它从 `./AIConfig` 引入子组件并维护所有状态。

## 每个文件的职责

### `AIConfigPage.tsx`（顶层路由）

> ⚠️ **本文件是整个页面的"状态枢纽"**。所有 useState / useEffect / useMemo 仍在此处维护。

- 状态：configs / providers / mcpConfigs / embeddingSummary / wizardStatus / 各种 dialog open
- 副作用：从 `frameworkConfigApi` / `providerConfigApi` / `mcpConfigApi` / `embeddingConfigApi` / `aiWizardApi` 拉取数据
- 派生：`isConfigDirty` / `taskModelLacksImage` / `mcpToolOptions` 等
- 回调：handleSetHighLevelConfig / handleCreateOpenaiConfig / handleSaveConfig / executeSave 等
- 渲染：Header + ServiceSwitch + Sidebar + 右侧激活 Section + 6 个 Dialog

### sections

| Section | 关键依赖 | 说明 |
| --- | --- | --- |
| `ServiceSwitchSection` | `isAIEnabled` | AI 总开关（也独立渲染在页面顶部） |
| `TaskConfigSection` | `allConfigsList` / `highLevelConfig` / `lowLevelConfig` | 高级/低级任务模型选择 |
| `WebSearchSection` | `websearchProvider` / `tavilyConfig` / `exaConfig` / `miniMaxConfig` / MCP 工具 | 网络搜索服务提供方 |
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
| `WizardDialog` | 顶部「检查配置」按钮 | AI Wizard 状态总览 |

### shared

| 组件 | 用途 |
| --- | --- |
| `ToggleRow` | 「图标 + 标题 + 描述 + Switch」通用行 |
| `PersonaAvatar` | 角色头像：远程 + 失败回退 + 禁用置灰 |
| `EmptyState` | 居中图标 + 标题 + 副标题 |
| `SidebarItem` | 桌面 / 移动（折叠）双形态 |

## 状态 / 事件流向

```
AIConfigPage (state owner)
    │
    ├── Sidebar  ── 切 activeSection
    │
    ├── ServiceSwitchSection  ── onToggle(checked)  →  updateConfigValue(aiConfigId, 'enable', v)
    │
    ├── <activeSection>  ── 由 renderActiveSection() 决定
    │     │
    │     ├── TaskConfigSection      ── onSet{High,Low}LevelConfig(name)
    │     ├── WebSearchSection       ── onChangeProvider / onUpdateConfig / onOpenMcpToolDialog
    │     ├── ImageUnderstandSection ── 同上
    │     ├── VectorDbSection        ── onSwitchEmbeddingProvider / onUpdateEmbedding{Local,Openai}Field
    │     ├── VoiceRecognitionSection
    │     ├── DocumentExtractSection
    │     ├── MemorySettingsSection  ── onToggleMemory / onUpdateConfig
    │     ├── MemeSettingsSection    ── onUpdateConfig
    │     └── AdvancedSettingsSection── onUpdateConfig
    │
    └── 6 Dialogs  ── 各自接收 props + onXxx 回调
```

## 添加新 Section 的步骤

1. 在 `sections/` 下新建 `MyNewSection.tsx`，**只依赖 props**，不直接调用 API
2. 在 `sections/...` 中 `export interface MyNewSectionProps` 列出所有依赖
3. 在 `index.ts` 中添加 re-export
4. 在 `AIConfigPage.tsx` 中：
   - 添加对应的 `useState` / `useEffect` / handler
   - 在 `renderActiveSection()` 的 `switch` 中增加一个 `case`
   - 在 `sidebarItems` 数组中增加一个条目
5. 在 i18n 中补充 `aiConfig.myNew.*` 翻译键

## 添加新 Dialog 的步骤

1. 在 `dialogs/` 下新建 `MyNewDialog.tsx`
2. 定义 props（包含 `open` / `onOpenChange` / 必要数据 / 回调）
3. `index.ts` 中 re-export
4. `AIConfigPage.tsx` 中：
   - 添加 `[isMyNewOpen, setIsMyNewOpen] = useState(false)`
   - 渲染 `<MyNewDialog open={isMyNewOpen} onOpenChange={setIsMyNewOpen} ... />`

## 已知约定

- **i18n 路径**：`aiConfig.*`，请在 `src/i18n/locales/{zh-CN,en-US,ja-JP}/aiConfig.json` 维护。
- **样式 token**：使用 Tailwind 主题色（`text-primary` / `bg-muted/30` 等），与项目其它页面保持一致。
- **玻璃态**：`isGlass` prop 来自 `useTheme().style === 'glassmorphism'`，用于在玻璃主题下切换边框与背景透明度。
- **API 调用**：`@/lib/api` 中的 `frameworkConfigApi` / `providerConfigApi` / `mcpConfigApi` / `embeddingConfigApi` / `aiWizardApi`。所有调用都集中在 `AIConfigPage.tsx`，子组件只接收最终结果。

## 未来优化方向

- 把状态管理下沉到 `useReducer` 或 `@/hooks/useAIConfig.ts`，进一步解耦主页面
- 将 6 个 dialog 改为 `useDialogState` hook 集中管理 open 状态
- 给每个 section 写最小测试（mock props + 断言关键交互）

---

如有任何疑问，请查看 git blame 找到原 `AIConfigPage.tsx` 中的对应行号（拆分按原行号顺序进行）。
