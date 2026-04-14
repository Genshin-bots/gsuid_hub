# GsCore Web Console 开发规范文档

本文档描述项目的代码规范，供 AI 辅助开发参考。

---

## 1. 项目技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript + Vite |
| 路由 | react-router-dom |
| UI 组件库 | shadcn/ui (基于 Radix UI) |
| 样式 | Tailwind CSS |
| 图标 | lucide-react |
| 图表 | recharts |
| 日期处理 | date-fns |
| 表单验证 | react-hook-form + zod |

---

## 2. i18n 国际化规范

### 2.1 翻译文件位置

```
src/i18n/locales/
├── zh-CN.json   # 中文翻译
└── en-US.json   # 英文翻译
```

### 2.2 翻译文件结构

采用**嵌套键**组织，按功能模块分组：

```json
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "loading": "加载中..."
  },
  "sidebar": {
    "dashboard": "数据看板",
    "database": "数据库管理"
  },
  "dashboard": { ... },
  "login": { ... }
}
```

### 2.3 翻译使用方式

```tsx
import { useLanguage } from '@/contexts/LanguageContext';

function MyComponent() {
  const { t } = useLanguage();

  // 基本使用
  <span>{t('common.save')}</span>

  // 变量插值
  <span>{t('common.totalRecords', { total: 100 })}</span>
  <span>{t('common.pageInfo', { current: 1, total: 10 })}</span>
}
```

### 2.4 新增翻译 key 规则

1. 在 `zh-CN.json` 中添加中文翻译
2. 在 `en-US.json` 中添加对应英文翻译
3. 遵循现有模块划分，保持 key 前缀与功能模块一致
4. 变量使用 `{}` 包裹，如 `{total}`, `{current}`

### 2.5 语言切换

通过 `LanguageContext` 的 `setLanguage` 方法切换：

```tsx
const { setLanguage, language } = useLanguage();
setLanguage('zh-CN'); // 或 'en-US'
```

---

## 3. 组件复用规范

### 3.1 组件目录结构

```
src/components/
├── ui/                    # shadcn/ui 基础组件
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── card.tsx
│   └── ...
├── layout/                # 布局组件
│   ├── AppLayout.tsx
│   └── AppSidebar.tsx
├── config/                # 配置相关组件
└── backup/                # 备份相关组件
```

### 3.2 使用 shadcn/ui 组件

所有基础 UI 组件位于 `src/components/ui/`，使用方式：

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
```

### 3.3 组件变体 (CVA)

使用 `class-variance-authority` 定义组件变体：

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive ...",
        outline: "border border-input ...",
        secondary: "bg-secondary ...",
        ghost: "hover:bg-accent ...",
        link: "text-primary underline-offset-4 ...",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

使用变体：

```tsx
<Button variant="destructive" size="sm">
  <Trash className="h-4 w-4" />
  删除
</Button>
```

### 3.4 className 合并工具

使用 `cn()` 函数合并类名（来自 clsx + tailwind-merge）：

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  isActive && "active-class",
  className  // 允许外部覆盖
)}>
```

### 3.5 自定义组件规范

新增业务组件时：

1. 放在对应的功能目录下（如 `src/components/config/`）
2. 优先复用现有 shadcn/ui 组件
3. 使用 TypeScript 定义 props 类型
4. 使用 `cn()` 处理样式合并

---

## 4. 主题风格规范

### 4.1 主题配置来源

主题由 `ThemeContext` 统一管理：

```tsx
const {
  mode,          // 'light' | 'dark'
  style,         // 'solid' | 'glassmorphism'
  color,         // 'red' | 'orchid' | 'blue' | 'green' | 'orange' | 'pink'
  iconColor,     // 'white' | 'black' | 'colored'
  themePreset,   // 'default' | 'shadcn'
  setMode,
  setStyle,
  setColor,
  // ...
} = useTheme();
```

### 4.2 CSS 变量系统

颜色通过 CSS 变量定义，格式为 HSL：

```css
:root {
  --primary: 220 70% 50%;
  --primary-foreground: 0 0% 100%;
  --background: 0 0% 100%;
  --foreground: 240 10% 4%;
  /* ... */
}

.dark {
  --primary: 220 70% 60%;
  --background: 240 10% 4%;
  --foreground: 0 0% 98%;
  /* ... */
}
```

### 4.3 Tailwind 颜色映射

在 `tailwind.config.ts` 中映射到 Tailwind：

```ts
colors: {
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))'
  },
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  // ...
}
```

### 4.4 主题样式使用

```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { mode, color } = useTheme();

  return (
    <div className={cn(
      "bg-background text-foreground",  // 使用 CSS 变量
      mode === 'dark' && "dark-class",
      color === 'blue' && "blue-theme"
    )}>
      内容
    </div>
  );
}
```

### 4.5 布局背景样式

`AppLayout.tsx` 中定义了背景渲染逻辑：

- **solid 模式**: 纯色或图片背景
- **glassmorphism 模式**: 毛玻璃效果 + 渐变/图片背景

---

## 5. API 调用规范

### 5.1 API 方法封装

所有 API 调用在 `src/lib/api.ts` 中统一管理：

```tsx
import { dashboardApi, themeApi, configApi } from '@/lib/api';

// 使用示例
const data = await dashboardApi.getDailyUsage(botId, date);
await themeApi.saveThemeConfig(config);
```

### 5.2 类型定义

API 响应类型在同文件中定义：

```tsx
interface BotItem {
  id: string;
  name: string;
}

interface DailyCommandData {
  date: string;
  commandName: string;
  count: number;
}
```

### 5.3 认证失败处理 (401)

当 API 请求返回 401 状态码时，系统会自动跳转登录页。使用 `getLoginPath()` 函数动态获取登录路径，以兼容开发和生产环境的不同路径配置。

```tsx
import { getLoginPath } from '@/lib/api';

// 获取当前环境对应的登录路径
// 开发模式: /login
// 生产模式: /app/login
const loginPath = getLoginPath();
window.location.href = loginPath;
```

**关键点**：
- `import.meta.env.BASE_URL` 在开发模式为 `/`，生产模式为 `/app/`
- `getLoginPath()` 自动处理路径拼接，确保无论何种部署方式都能正确跳转
- 401 错误会在 `src/lib/api.ts` 的 `ApiClient.request()`、`ApiClient.getRaw()` 等方法中统一处理

---

## 6. AI Tools API

### 6.1 获取 AI 工具列表

```
GET /api/ai/tools/list
```

**请求头**：
```
Authorization: Bearer <token>
```

**响应**：
```json
{
    "success": true,
    "data": {
        "tools": [
            {
                "name": "search_knowledge",
                "description": "检索知识库相关内容..."
            },
            {
                "name": "web_search",
                "description": "使用 Tavily API 进行 web 搜索..."
            }
        ],
        "count": 10
    }
}
```

**响应字段说明**：
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 请求是否成功 |
| data.tools | array | 工具列表 |
| data.tools[].name | string | 工具名称 |
| data.tools[].description | string | 工具描述（docstring） |
| data.count | integer | 工具总数 |

---

### 6.2 获取指定工具详情

```
GET /api/ai/tools/{tool_name}
```

**请求头**：
```
Authorization: Bearer <token>
```

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| tool_name | string | 工具名称 |

**响应（工具存在）**：
```json
{
    "success": true,
    "data": {
        "name": "search_knowledge",
        "description": "检索知识库相关内容..."
    }
}
```

**错误响应（工具不存在）**：
```json
{
    "success": false,
    "error": "Tool 'xxx' not found"
}
```

**错误响应（角色不存在）**：
```json
{
    "status": 1,
    "msg": "角色 'xxx' 不存在",
    "data": null
}
```

---

## 7. 路由规范

### 6.1 路由配置

使用 `react-router-dom`，页面组件位于 `src/pages/`：

```tsx
// App.tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<AppLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="database" element={<DatabasePage />} />
    {/* 更多路由... */}
  </Route>
</Routes>
```

### 6.2 布局组件

`AppLayout` 提供整体布局，包括侧边栏和 Header：

```tsx
<Route path="/" element={<AppLayout />}>
  <Route index element={<Dashboard />} />
</Route>
```

---

## 8. 代码风格要点

### 8.1 导入路径

使用 `@/` 路径别名：

```tsx
import Button from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
```

配置见 `tsconfig.app.json` 和 `vite.config.ts`。

### 7.2 图标使用

使用 `lucide-react` 图标库：

```tsx
import { Save, Trash, Settings, Menu } from 'lucide-react';

<Button><Save className="h-4 w-4" /> 保存</Button>
```

### 7.3 组件文件头注释

参考现有文件的注释风格：

```tsx
// ============================================================================
// 类型定义
// ============================================================================

// ============================================================================
// 工具函数
// ============================================================================

// ============================================================================
// 组件定义
// ============================================================================
```

---

## 9. 常见开发任务参考

### 9.1 新增页面

1. 在 `src/pages/` 创建 `XXXPage.tsx`
2. 在 `App.tsx` 添加路由
3. 在 i18n 文件添加翻译 key
4. 使用现有 UI 组件组合页面

### 9.2 新增 UI 组件

1. 考虑是否可使用现有 shadcn/ui 组件
2. 如需新增，放在 `src/components/ui/` 或相应功能目录
3. 使用 CVA 定义变体
4. 使用 `cn()` 合并 className

### 9.3 新增翻译

1. 在 `zh-CN.json` 和 `en-US.json` 中对应位置添加 key
2. 使用 `t('模块.具体描述')` 方式调用

### 9.4 主题相关修改

1. 修改 `ThemeContext.tsx` 中的颜色配置
2. 或修改 `tailwind.config.ts` 中的颜色映射

### 9.5 渐进式配置页面开发规范

渐进式配置页面（Progressive Configuration Page）是一种混合渲染模式：对于已知的配置项使用精心设计的 UI 组件渲染，对于未知的配置项使用通用的 `ConfigField` 组件兜底。

#### 9.5.1 核心概念

- **预期配置项 (Expected Keys)**: 已知并设计了专门 UI 的配置项
- **预料之外配置项 (Unexpected Keys)**: 后端返回但前端未单独处理的配置项
- **混合渲染**: 预期配置项用定制 UI，预料之外配置项用通用卡片

#### 9.5.2 实现模式

以 `ButtonMarkdownSettings.tsx` 为例：

```tsx
// 1. 定义预期配置项的 key 列表
const EXPECTED_CONFIG_KEYS = [
  'SendMDPlatform',
  'ButtonRow',
  'SendButtonsPlatform',
  // ...
];

// 2. 存储后端返回的原始完整配置
interface LocalButtonMarkdownConfig {
  id: string;
  name: string;
  full_name: string;
  config: ButtonMarkdownConfig;        // 预期配置项（类型安全）
  rawConfig?: Record<string, PluginConfigItem>;  // 原始完整配置
}

// 3. 将后端配置转换为 ConfigFieldDefinition 类型
const convertToConfigField = (key: string, configItem: PluginConfigItem): ConfigFieldDefinition => {
  // 根据 type 判断字段类型
  let type: ConfigFieldType = 'text';
  const rawType = configItem.type?.toLowerCase() || '';
  
  if (rawType.includes('bool')) type = 'boolean';
  else if (rawType.includes('int')) type = 'number';
  else if (rawType.includes('list') || rawType.includes('array')) {
    type = configItem.options ? 'multiselect' : 'tags';
  }
  // ... 其他类型判断
  
  return {
    type,
    label: configItem.title || key,
    value: configItem.value as ConfigValue,
    options: configItem.options,
    // ...
  };
};

// 4. 获取预料之外的配置项
const unexpectedConfigItems = useMemo(() => {
  if (!buttonMdConfig?.rawConfig) return {};
  const items: Record<string, ConfigFieldDefinition> = {};
  for (const [key, configItem] of Object.entries(buttonMdConfig.rawConfig)) {
    if (!EXPECTED_CONFIG_KEYS.includes(key)) {
      items[key] = convertToConfigField(key, configItem);
    }
  }
  return items;
}, [buttonMdConfig?.rawConfig]);

// 5. 处理预料之外的配置项变更
const handleChange = useCallback((fieldKey: string, value: ConfigValue) => {
  // 检查是否是预料之外的配置项
  if (!EXPECTED_CONFIG_KEYS.includes(fieldKey)) {
    // 更新 rawConfig 中的值
    setConfigs(prev => prev.map(c => {
      if (c.id !== buttonMdConfig.id) return c;
      const updatedRawConfig = { ...c.rawConfig };
      if (updatedRawConfig[fieldKey]) {
        updatedRawConfig[fieldKey] = { ...updatedRawConfig[fieldKey], value };
      }
      return { ...c, rawConfig: updatedRawConfig };
    }));
    setDirty(true);
    return;
  }
  // ... 处理预期配置项
}, [...]);

// 6. 保存时包含所有配置项
const handleSaveConfig = async () => {
  // 保存预期配置项
  Object.entries(buttonMdConfig.config).forEach(([key, field]) => {
    configToSave[key] = field.value;
  });
  // 保存预料之外的配置项
  if (buttonMdConfig.rawConfig) {
    Object.entries(buttonMdConfig.rawConfig).forEach(([key, field]) => {
      if (!EXPECTED_CONFIG_KEYS.includes(key)) {
        configToSave[key] = field.value;
      }
    });
  }
  await frameworkConfigApi.updateFrameworkConfig(buttonMdConfig.full_name, configToSave);
};

// 7. 渲染预料之外的配置项
{Object.keys(unexpectedConfigItems).length > 0 && (
  <Card className="glass-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Cog className="w-5 h-5" />
        其他设置
      </CardTitle>
      <CardDescription>由插件或后端新增的配置项</CardDescription>
    </CardHeader>
    <CardContent className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(unexpectedConfigItems).map(([key, field]) => (
          <ConfigField
            key={key}
            fieldKey={key}
            field={field}
            onChange={handleChange}
          />
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

#### 9.5.3 关键要点

1. **存储 `rawConfig`**: 保存后端返回的完整原始配置，用于检测预料之外的配置项
2. **定义 `EXPECTED_CONFIG_KEYS`**: 明确哪些配置项是已知的，用于区分预期和意外
3. **`convertToConfigField` 函数**: 将后端配置转换为 `ConfigFieldDefinition` 类型
4. **handleChange 双向处理**: 既要处理预期配置项的专门逻辑，也要处理意外配置项的通用逻辑
5. **handleSaveConfig 完整保存**: 保存时要包含所有配置项，不能遗漏意外的配置项
6. **使用 `ConfigField` 组件**: 意外配置项通过 `ConfigField` 组件渲染，这是通用的配置字段组件

#### 9.5.4 适用场景

当一个配置组包含：
- 固定的核心配置项（设计专门 UI）
- 可能变化的扩展配置项（无法预知具体有哪些）

---

### 9.6 侧边栏多级菜单开发规范

侧边栏导航配置在 `AppSidebar.tsx` 的 `getNavItems` 函数中：

```tsx
const getNavItems = (t: (key: string) => string): NavItem[] => [
  // 一级菜单（无子菜单）
  { title: t('sidebar.dashboard'), url: '/dashboard', icon: LayoutDashboard },
  
  // 一级菜单（含二级子菜单）
  {
    title: t('sidebar.aiConfig'),  // 父级标题
    icon: Brain,
    children: [
      { title: t('sidebar.basicConfig'), url: '/ai-config', icon: Cog },
      { title: t('sidebar.personaConfig'), url: '/persona-config', icon: User },
      { title: t('sidebar.aiTools'), url: '/ai-tools', icon: Wrench }
    ]
  },
  // ...
];
```

#### 9.6.1 注意事项

1. **ICON_MAP 更新**: 如果使用新图标，需要在 `ICON_MAP` 中添加
2. **NAV_ITEMS_KEYS 更新**: 如果新增顶级菜单 key，需要添加到 `NAV_ITEMS_KEYS` 数组
3. **翻译 key**: 在 i18n 文件中添加 `sidebar.basicConfig`、`sidebar.personaConfig` 和 `sidebar.aiTools`
4. **自动展开**: 系统会根据当前路由自动展开包含该路由的父级菜单

#### 9.6.2 新增页面步骤

1. 创建页面组件：`src/pages/XXXPage.tsx`
2. 在 `App.tsx` 添加路由
3. 在侧边栏 `getNavItems` 中添加导航项
4. 在 i18n 文件中添加翻译

---

### 9.7 AI 工具页面开发规范

AI 工具页面 (`AIToolsPage.tsx`) 是一种只读列表页面，用于展示后端提供的所有 AI 工具：

#### 9.7.1 页面布局

- **页边距**: `p-6` 符合基础配置页面规范
- **大标题**: 使用 Wrench 图标 + 标题，如 `{t('aiTools.title')}`
- **卡片列表**: 使用 Card 组件展示工具列表

#### 9.7.2 页面特性

- **只读展示**: 仅展示后端返回的 AI 工具列表，不支持修改、新增或删除
- **列表渲染**: 使用 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` 响应式布局
- **加载状态**: 使用 Skeleton 组件展示加载状态
- **错误处理**: 显示加载失败的原因

#### 9.7.3 API 调用

```tsx
// 获取 AI 工具列表
// GET /api/ai/tools/list
// 响应: { success: true, data: { tools: [{ name, description }], count: number } }
const data = await aiToolsApi.getToolsList();
```

#### 9.7.4 数据结构

```tsx
interface AITool {
  name: string;        // 工具名称，如 "search_knowledge"
  description: string; // 工具描述（docstring）
}

interface ToolsListResponse {
  success: boolean;
  data: {
    tools: AITool[];
    count: number;
  };
}
```

#### 9.7.5 关键组件

- **Card**: 工具卡片
- **CardHeader**: 卡片头部
- **CardTitle**: 工具名称
- **CardDescription**: 工具描述
- **Skeleton**: 加载状态
- **ScrollArea**: 滚动区域（如需要）

---

### 9.8 Persona 人格配置页面开发规范

人格配置页面 (`PersonaConfigPage.tsx`) 是一种卡片式列表页面：

#### 9.8.1 页面布局

- **页边距**: `p-6` 符合基础配置页面规范
- **大标题**: 使用 Brain 图标 + 标题，如 `{t('personaConfig.title')}`
- **两列布局**: `grid grid-cols-1 md:grid-cols-2 gap-4`

#### 9.8.2 卡片设计

- **头像**: 左侧 48x48 圆角方形，加载失败使用 `/ICON.png`
- **启用开关**: Switch 组件，启用时红色主题 `data-[state=checked]:bg-red-500`
- **状态 Badge**: 启用红色 `bg-red-500/20 text-red-600`，禁用灰色 `bg-muted text-muted-foreground`
- **群聊 Badge**: 主题色 `bg-primary/10 text-primary`
- **毛玻璃支持**: 使用 `isGlass ? "glass-card" : "border border-border/50"`

#### 9.8.3 卡片内编辑

- **展开编辑**: 点击"编辑"按钮在卡片下方展开群聊编辑区域
- **TagsInput**: 使用 TagsInput 组件管理群聊列表
- **保存/取消**: 展开区域内提供保存和取消按钮

#### 9.8.4 核心功能

- **创建对话框**: Dialog 组件，包含名称和描述输入
- **编辑对话框**: 查看/编辑人格 Markdown 内容
- **删除确认**: AlertDialog 二次确认
- **启用/禁用**: 直接切换 Switch 开关调用 API

#### 9.8.5 API 调用模式

```tsx
// 获取人格列表
const listData = await personaApi.getPersonaList();

// 获取人格详情
const detail = await personaApi.getPersona(name);

// 创建新人格
await personaApi.createPersona({ name, query });

// 删除人格
await personaApi.deletePersona(name);

// 切换启用状态 - 更新 enable_persona
await frameworkConfigApi.updateFrameworkConfig(configName, {
  enable_persona: newEnabledList,
});

// 更新群聊关联 - 更新 persona_for_session
await frameworkConfigApi.updateFrameworkConfig(configName, {
  persona_for_session: updatedPersonaForSession,
});
```

#### 9.8.6 Switch 组件样式

- **启用状态**: `bg-red-500 hover:bg-red-600`（红色）
- **禁用状态**: `bg-muted hover:bg-muted/80`（灰色）

#### 9.8.7 关键组件

- **Card**: 人格卡片
- **Switch**: 启用/禁用开关
- **TagsInput**: 群聊标签输入
- **Dialog**: 创建/编辑对话框
- **AlertDialog**: 删除确认
- **Badge**: 状态标签、群聊标签
- **ScrollArea**: 编辑器滚动区域

#### 9.8.8 弹窗小标题 ICON 规范

在弹窗内容中，如果存在多个分区小标题（如"内容"、"关联群聊"等），**仅在弹窗内的分区标题添加 ICON**，卡片列表页面本身的小标题不需要添加 ICON。

示例（在 Dialog 弹窗内）：
```tsx
<div className="space-y-4">
  {/* 人设内容编辑 */}
  <div className="space-y-2 flex flex-col">
    <Label className="flex items-center gap-2">
      <Brain className="h-4 w-4" />
      {t('personaConfig.personaContent')}
    </Label>
    <Textarea ... />
  </div>
  
  {/* 关联群聊编辑 */}
  <div className="space-y-2">
    <Label className="flex items-center gap-2">
      <User className="h-4 w-4" />
      {t('personaConfig.enabledGroups')}
    </Label>
    <TagsInput ... />
  </div>
</div>
```

**规范要点**：
- ICON 只加在打开的卡片/弹窗上
- 卡片列表页面中的小标题不需要 ICON
- 使用 `flex items-center gap-2` 布局
- 图标大小统一使用 `h-4 w-4`

---

### 8.9 性能优化注意事项

#### 8.9.1 图片性能

- **头像图片**: 使用 `?t=Date.now()` 防止缓存
- **背景图片**: 使用 CSS `background-size: cover` 和 `opacity` 降低性能消耗
- **图片错误处理**: 使用 `onError` 隐藏加载失败的图片

#### 8.9.2 状态管理

- **useMemo**: 复杂计算结果使用 `useMemo` 缓存
- **useCallback**: 事件处理函数使用 `useCallback` 避免重复创建
- **useEffect 依赖**: 正确设置依赖项避免不必要的重新渲染

#### 8.9.3 列表渲染

- **虚拟列表**: 大数据量列表使用虚拟滚动
- **分页加载**: 避免一次性加载过多数据
- **骨架屏**: 加载状态使用 Skeleton 组件提升体验

#### 8.9.4 API 请求

- **Promise.all**: 并发请求多个独立 API
- **缓存策略**: 合理使用 React Query 的缓存机制
- **错误处理**: 每个请求都需要错误处理

---

### 8.10 低端设备性能优化建议

#### 8.10.1 发现的问题

1. **图片性能问题**
   - 人格头像使用 `?t=Date.now()` 防止缓存，但每次渲染都会发起新请求
   - 背景图片没有懒加载，大列表滚动时会造成卡顿
   - 建议：添加图片懒加载、缓存机制

2. **useEffect 依赖问题**
   - 部分 useEffect 使用 `[]` 空依赖但内部使用了外部变量（如 `t`）
   - 会导致闭包陷阱，值可能是过时的
   - 建议：确保依赖数组包含所有使用的外部变量

3. **Context 重渲染问题**
   - 一些组件消费多个 Context，任何一个变化都会导致重渲染
   - 建议：使用选择器模式，只订阅需要的状态片段

4. **列表渲染问题**
   - 大数据量列表（如日志）没有虚拟滚动
   - 建议：使用 `react-virtualized` 或 `@tanstack/react-virtual`

5. **毛玻璃效果问题**
   - `backdrop-filter` 是 GPU 密集型操作
   - 建议：在低端设备或设置中提供关闭选项

#### 8.10.2 快速检查清单

- [ ] 列表组件超过 50 项考虑虚拟滚动
- [ ] 图片使用懒加载和适当缓存
- [ ] useEffect 依赖数组完整性检查
- [ ] Context 值使用 useMemo 包装
- [ ] 避免在 render 中创建新的函数/对象
- [ ] 考虑添加 `React.memo` 包装纯展示组件
- [ ] 大列表考虑使用 `will-change` CSS 提示浏览器

---

## 10. TabButtonGroup 组件规范

### 10.1 组件位置
```
src/components/ui/TabButtonGroup.tsx
```

### 10.2 组件说明
用于替代原有散落的 ToggleGroup 和自定义按钮组，提供统一的标签切换按钮样式。

### 10.3 接口定义

```typescript
export interface TabButtonOption {
  value: string;           // 选项值
  label: string;           // 显示文本
  icon?: React.ReactNode;   // 可选的图标
}

interface TabButtonGroupProps {
  options: TabButtonOption[];    // 选项列表
  value: string;                  // 当前选中的值
  onValueChange: (value: string) => void;  // 值变化回调
  className?: string;             // 自定义容器样式
  buttonClassName?: string;        // 自定义按钮样式
  disabled?: boolean;             // 是否禁用
  glassClassName?: string;        // 毛玻璃/主题专用样式
}
```

### 10.4 使用要求

#### 1. 必须导入 useTheme（获取主题状态）
```tsx
import { useTheme } from '@/contexts/ThemeContext';

export default function MyPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  // ...
}
```

#### 2. 必须传入 glassClassName（主题适配）
```tsx
<TabButtonGroup
  options={[...]}
  value={selectedValue}
  onValueChange={setSelectedValue}
  glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
/>
```

#### 3. icon 渲染方式
图标会自动被包裹在 `w-5 h-5 flex-shrink-0 flex items-center justify-center` 的容器中，确保图标大小一致。

### 10.5 已使用该组件的页面

| 页面 | 用途 |
|------|------|
| AIConfigPage | AI 配置选择 |
| AIToolsPage | AI 工具插件过滤 |
| FrameworkConfigPage | 框架配置选择 |
| PluginsPage | 插件选择、配置名称切换 |
| BackupPage | 备份设置/下载切换 |

### 10.6 注意事项

1. **不要使用 w-full** - 组件默认 `inline-flex`，会自动适配内容宽度，不需要父容器设置 `w-full`

2. **换行行为** - 按钮过多时使用 `flex-wrap`，会自动换行到下一行

3. **图标大小** - 统一使用 `w-4 h-4` 或类似大小，组件会自动处理尺寸统一

4. **glassClassName 必传** - 不传会导致页面主题切换时样式不一致

---

## 11. 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/contexts/LanguageContext.tsx` | i18n 上下文，提供 t() 函数 |
| `src/contexts/ThemeContext.tsx` | 主题上下文，管理主题状态 |
| `src/i18n/locales/zh-CN.json` | 中文翻译 |
| `src/i18n/locales/en-US.json` | 英文翻译 |
| `src/lib/utils.ts` | 工具函数，包含 cn() |
| `src/lib/api.ts` | API 接口封装 |
| `tailwind.config.ts` | Tailwind 配置 |
| `src/components/ui/` | shadcn/ui 组件库 |

---

## 5. AI配置页面开发记录

### 5.1 任务概述

为【AI配置】->【基础配置】创建了一个渐进式配置页面，将多个相关配置融合成一个统一且用户友好的界面。

### 5.2 设计原则

1. **渐进式披露（Progressive Disclosure）**
   - 核心配置默认展开，用户一目了然
   - 高级配置默认折叠，减少认知负担
   - 根据用户选择动态显示相关配置（如启用Rerank后显示Rerank模型配置）

2. **配置分组**
   - 按功能将配置分成逻辑组：基础配置、服务提供方、模型配置、搜索配置等
   - 每组有清晰的标题和描述

3. **兼容性设计**
   - 使用 `EXPECTED_CONFIG_KEYS` 记录已知配置项
   - 预料之外的配置项自动归入"其他配置项"区域
   - 确保后端新增配置时前端不会崩溃

### 5.3 新增组件

#### ChipGroup (`src/components/ui/MultiSelectChipGroup.tsx`)

基于 `ButtonMarkdownSettings` 中的平台选择样式，通用化了一个Chip选择组件。**已重命名并增强**：

```tsx
// 类型定义
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
  /** 选择模式：'multiple' 多选（默认），'single' 单选 */
  selectMode?: 'multiple' | 'single';
  /** 单选模式时显示单选指示器 */
  showRadioIndicator?: boolean;
}
```

**使用示例：**

```tsx
// 多选模式（默认）
<ChipGroup
  options={[
    { value: 'mention', label: '提及应答' },
    { value: 'schedule', label: '定时巡检' },
    { value: 'capture', label: '趣向捕捉', disabled: true },
  ]}
  value={['mention', 'schedule']}
  onValueChange={(newValue) => setSelectedModes(newValue)}
/>

// 单选模式
<ChipGroup
  options={[
    { value: 'openai', label: 'OpenAI兼容' },
    { value: 'claude', label: 'Claude' },
  ]}
  value={['openai']}
  onValueChange={(newValue) => setProvider(newValue[0])}
  selectMode="single"
  showRadioIndicator
/>
```

### 5.4 关键实现

1. **层级化的配置结构**
   - 服务提供方作为一级配置，包含AI模型、嵌入模型、网络搜索
   - API配置作为AI模型服务的子配置展开
   - 嵌入模型配置包含嵌入模型名称和Rerank配置
   - Rerank作为嵌入模型的子配置，启用后可修改Rerank模型

2. **一体化布局设计**
   - 移除Card组件，使用连贯的section组织内容
   - 页面占满全宽，使用 `p-6` 内边距
   - 使用 `Separator` 分隔不同功能模块

3. **可折叠的Section**
   - 服务提供方、高级设置可以折叠/展开
   - 使用 `expandedSections` 状态管理展开状态
   - 点击section标题可以切换展开/折叠

4. **渐进式披露（Progressive Disclosure）**
   - AI服务开关始终显示在最顶部
   - AI启用后，才显示行动模式、服务提供方等配置
   - 使用条件渲染 `{isAIEnabled && (...)}` 控制显示

5. **每个配置项都有图标**
   - 所有配置项（包括思考轮数、白名单、黑名单）都有对应图标
   - 图标统一放在Label前面，增强视觉识别

6. **行动模式卡片式选择**
   - 使用 2x2 网格布局展示4个行动模式
   - 每个模式有彩色图标、标题和简短描述
   - 选中状态有视觉反馈（边框变色、勾选标记）

7. **消除重复标签**
   - 每个配置项使用独立的 `<Label>` 组件显示标题
   - `ConfigField` 组件设置 `showLabel={false}` 避免内部标签重复

8. **动态配置展开**
   - 选择特定 provider 后，下方自动显示相关配置
   - 使用圆角背景和缩进区分主配置和子配置

### 5.5 未来需要注意的点

1. **类型安全**
   - `PluginConfigItem` 已从 `@/lib/api` 导出，避免重复定义
   - 使用 `frameworkConfigApi` 的类型定义，而非手动定义

2. **后端兼容性**
   - 后端可能返回新的配置项，必须有兜底处理
   - 使用 `EXPECTED_CONFIG_KEYS` 映射表识别已知配置

3. **组件复用**
   - 类似的平台选择、模式选择场景优先使用 `MultiSelectChipGroup`
   - 如有需要可扩展 `color`、`icon` 等属性

4. **状态管理**
   - 对于复杂的配置页面，考虑使用 `useReducer` 替代多个 `useState`
   - 避免深层嵌套的 `useCallback` 依赖链

5. **渐进式体验**
   - 核心功能放在前面，复杂配置默认折叠
   - 根据用户操作动态显示/隐藏相关配置（如启用开关后显示详细配置）

---

## 6. 列表页面与详情页设计规范

### 6.1 表格行点击打开详情页

对于使用表格（Table）展示数据的列表页面：
- **点击表格中任意行应打开二级详情页面**
- 不应仅依赖编辑按钮打开详情
- 使用 `onClick` 事件处理行点击，通过事件冒泡 `e.stopPropagation()` 避免与操作按钮冲突

```tsx
<TableRow
key={item.id}
className="cursor-pointer"
onClick={() => handleViewDetail(item)}
>
<TableCell>...</TableCell>
<TableCell>
 {/* 操作按钮需要阻止冒泡 */}
 <Button onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
   <Pencil className="w-4 h-4" />
 </Button>
</TableCell>
</TableRow>
```

### 6.2 二级详情页标题规范

二级详情页面（如弹窗 Dialog）的标题需要：
- **添加小 ICON**：与页面主标题风格一致，使用 `flex items-center gap-3` 布局
- **明确的字段间隔区分**：使用分隔线或间距区分不同字段区域
- **ICON 只加在打开的卡片/弹窗上**
- **卡片列表页面中的小标题不需要 ICON**

正确示例：
```tsx
<DialogHeader>
<DialogTitle className="flex items-center gap-3">
 <MessageSquare className="w-5 h-5" />
 {selectedPrompt?.title}
</DialogTitle>
</DialogHeader>
<div className="space-y-4 py-4">
{/* 使用 Card 或分隔线区分不同字段区域 */}
<div className="border-b pb-2">
 <Label className="text-muted-foreground">{t('systemPrompt.descField')}</Label>
 <p className="mt-1">{selectedPrompt?.desc}</p>
</div>
<div className="border-b pb-2">
 <Label className="text-muted-foreground">{t('systemPrompt.contentField')}</Label>
 <pre className="mt-1 whitespace-pre-wrap">{selectedPrompt?.content}</pre>
</div>
</div>
```

### 6.3 字段分组与间隔

详情页中的字段应按逻辑分组：
- 使用 `<Separator />` 或 `border-b` 分隔不同分组
- 每个分组有清晰的 Label 说明
- 保持一致的间距（通常 `space-y-4` 或 `gap-4`）

---

## 7. 配置页面变更检测规范

### 7.1 问题背景

在【框架配置】页面中，配置项分为两类：
1. **预期配置项** - 前端预定义的已知配置项
2. **预料之外配置项** - 由插件或后端动态新增的配置项（显示在"其他设置"卡片中）

### 7.2 数据存储结构

配置组件使用双重存储结构：

```typescript
interface LocalConfig {
  id: string;
  name: string;
  full_name: string;
  config: KnownConfig;           // 预定义的预期配置项
  rawConfig?: Record<string, PluginConfigItem>; // 完整的后端原始配置
}
```

### 7.3 变更检测实现规范

**必须同时跟踪两个状态的原始值：**

```typescript
const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
const [originalRawConfig, setOriginalRawConfig] = useState<Record<string, PluginConfigItem> | undefined>(undefined);
```

**isConfigDirty 必须同时检查两部分：**

```typescript
const isConfigDirty = useMemo(() => {
  if (!config) return false;
  const configChanged = JSON.stringify(config.config) !== JSON.stringify(originalConfig);
  // 关键：同时检查预料之外的配置项（rawConfig）是否有变化
  const rawConfigChanged = config.rawConfig && originalRawConfig ?
    JSON.stringify(config.rawConfig) !== JSON.stringify(originalRawConfig) : false;
  return configChanged || rawConfigChanged;
}, [config, originalConfig, originalRawConfig]);
```

**保存成功后必须同步更新两个原始状态：**

```typescript
const handleSaveConfig = async () => {
  // ... 保存逻辑 ...
  await frameworkConfigApi.updateFrameworkConfig(config.full_name, configToSave);
  setOriginalConfig(JSON.parse(JSON.stringify(config.config)));
  setOriginalRawConfig(JSON.parse(JSON.stringify(config.rawConfig))); // 关键！
  setDirty(false);
};
```

**初始化时保存两个原始状态：**

```typescript
useEffect(() => {
  if (config) {
    setOriginalConfig(JSON.parse(JSON.stringify(config.config)));
    setOriginalRawConfig(JSON.parse(JSON.stringify(config.rawConfig))); // 关键！
    setDirty(false);
  }
}, [config?.id, setDirty]);

// 获取配置详情时
const fetchConfigDetail = async (configName: string) => {
  const data = await frameworkConfigApi.getFrameworkConfig(configName);
  // ... 转换配置 ...
  setConfigs([convertedConfig]);
  setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
  setOriginalRawConfig(JSON.parse(JSON.stringify(data.config))); // 关键！
};
```

### 7.4 常见错误

❌ **错误：只比较 config 部分**
```typescript
const isConfigDirty = useMemo(() => {
  if (!config) return false;
  return JSON.stringify(config.config) !== JSON.stringify(originalConfig); // 漏了 rawConfig！
}, [config, originalConfig]);
```

❌ **错误：保存后只更新 originalConfig**
```typescript
setOriginalConfig(JSON.parse(JSON.stringify(config.config)));
// 漏了 setOriginalRawConfig！
setDirty(false);
```

✅ **正确：同时跟踪和比较两个状态**

### 7.5 需要遵循此规范的文件

- `MiscSettings.tsx` - 杂项配置
- `ButtonMarkdownSettings.tsx` - 按钮和MD配置
- 任何包含 `EXPECTED_CONFIG_KEYS` 和 `rawConfig` 的配置组件

---

## 8. 其他规范

### 8.1 图标使用

- 优先使用 `lucide-react` 图标库
- 图标大小统一：标题用 `w-5 h-5`，按钮内用 `w-4 h-4`
- 使用 `gap-2` 或 `gap-3` 保持图标与文字间距

### 8.2 颜色规范

- 使用 Tailwind 的颜色变量，如 `text-primary`, `bg-primary/10`
- 避免硬编码颜色值
- 状态色：成功 `text-green-500`，警告 `text-amber-500`，错误 `text-red-500`

### 8.3 响应式设计

- 移动端优先，使用 `md:`, `lg:` 等断点
- 表格在移动端使用卡片布局替代
- 表单字段在移动端单列，桌面端可多列

---

*文档版本: 1.1*
*最后更新: 2024年*
