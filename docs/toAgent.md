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

## 6. 路由规范

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

## 7. 代码风格要点

### 7.1 导入路径

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

## 8. 常见开发任务参考

### 8.1 新增页面

1. 在 `src/pages/` 创建 `XXXPage.tsx`
2. 在 `App.tsx` 添加路由
3. 在 i18n 文件添加翻译 key
4. 使用现有 UI 组件组合页面

### 8.2 新增 UI 组件

1. 考虑是否可使用现有 shadcn/ui 组件
2. 如需新增，放在 `src/components/ui/` 或相应功能目录
3. 使用 CVA 定义变体
4. 使用 `cn()` 合并 className

### 8.3 新增翻译

1. 在 `zh-CN.json` 和 `en-US.json` 中对应位置添加 key
2. 使用 `t('模块.具体描述')` 方式调用

### 8.4 主题相关修改

1. 修改 `ThemeContext.tsx` 中的颜色配置
2. 或修改 `tailwind.config.ts` 中的颜色映射

### 8.5 渐进式配置页面开发规范

渐进式配置页面（Progressive Configuration Page）是一种混合渲染模式：对于已知的配置项使用精心设计的 UI 组件渲染，对于未知的配置项使用通用的 `ConfigField` 组件兜底。

#### 8.5.1 核心概念

- **预期配置项 (Expected Keys)**: 已知并设计了专门 UI 的配置项
- **预料之外配置项 (Unexpected Keys)**: 后端返回但前端未单独处理的配置项
- **混合渲染**: 预期配置项用定制 UI，预料之外配置项用通用卡片

#### 8.5.2 实现模式

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

#### 8.5.3 关键要点

1. **存储 `rawConfig`**: 保存后端返回的完整原始配置，用于检测预料之外的配置项
2. **定义 `EXPECTED_CONFIG_KEYS`**: 明确哪些配置项是已知的，用于区分预期和意外
3. **`convertToConfigField` 函数**: 将后端配置转换为 `ConfigFieldDefinition` 类型
4. **handleChange 双向处理**: 既要处理预期配置项的专门逻辑，也要处理意外配置项的通用逻辑
5. **handleSaveConfig 完整保存**: 保存时要包含所有配置项，不能遗漏意外的配置项
6. **使用 `ConfigField` 组件**: 意外配置项通过 `ConfigField` 组件渲染，这是通用的配置字段组件

#### 8.5.4 适用场景

当一个配置组包含：
- 固定的核心配置项（设计专门 UI）
- 可能变化的扩展配置项（无法预知具体有哪些）

---

### 8.6 侧边栏多级菜单开发规范

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

#### 8.6.1 注意事项

1. **ICON_MAP 更新**: 如果使用新图标，需要在 `ICON_MAP` 中添加
2. **NAV_ITEMS_KEYS 更新**: 如果新增顶级菜单 key，需要添加到 `NAV_ITEMS_KEYS` 数组
3. **翻译 key**: 在 i18n 文件中添加 `sidebar.basicConfig`、`sidebar.personaConfig` 和 `sidebar.aiTools`
4. **自动展开**: 系统会根据当前路由自动展开包含该路由的父级菜单

#### 8.6.2 新增页面步骤

1. 创建页面组件：`src/pages/XXXPage.tsx`
2. 在 `App.tsx` 添加路由
3. 在侧边栏 `getNavItems` 中添加导航项
4. 在 i18n 文件中添加翻译

---

### 8.7 Persona 人格配置页面开发规范

人格配置页面 (`PersonaConfigPage.tsx`) 是一种卡片式列表页面：

#### 8.7.1 页面布局

- **页边距**: `p-6` 符合基础配置页面规范
- **大标题**: 使用 Brain 图标 + 标题，如 `{t('personaConfig.title')}`
- **两列布局**: `grid grid-cols-1 md:grid-cols-2 gap-4`

#### 8.7.2 卡片设计

- **头像**: 左侧 48x48 圆角方形，加载失败使用 `/ICON.png`
- **启用开关**: Switch 组件，启用时红色主题 `data-[state=checked]:bg-red-500`
- **状态 Badge**: 启用红色 `bg-red-500/20 text-red-600`，禁用灰色 `bg-muted text-muted-foreground`
- **群聊 Badge**: 主题色 `bg-primary/10 text-primary`
- **毛玻璃支持**: 使用 `isGlass ? "glass-card" : "border border-border/50"`

#### 8.7.3 卡片内编辑

- **展开编辑**: 点击"编辑"按钮在卡片下方展开群聊编辑区域
- **TagsInput**: 使用 TagsInput 组件管理群聊列表
- **保存/取消**: 展开区域内提供保存和取消按钮

#### 8.7.4 核心功能

- **创建对话框**: Dialog 组件，包含名称和描述输入
- **编辑对话框**: 查看/编辑人格 Markdown 内容
- **删除确认**: AlertDialog 二次确认
- **启用/禁用**: 直接切换 Switch 开关调用 API

#### 8.7.5 Switch 组件样式

- **启用状态**: `bg-red-500 hover:bg-red-600`（红色）
- **禁用状态**: `bg-muted hover:bg-muted/80`（灰色）

#### 8.7.6 关键组件

- **Card**: 人格卡片
- **Switch**: 启用/禁用开关
- **TagsInput**: 群聊标签输入
- **Dialog**: 创建/编辑对话框
- **AlertDialog**: 删除确认
- **Badge**: 状态标签、群聊标签
- **ScrollArea**: 编辑器滚动区域

#### 8.7.7 弹窗小标题 ICON 规范

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

### 8.8 性能优化注意事项

#### 8.8.1 图片性能

- **头像图片**: 使用 `?t=Date.now()` 防止缓存
- **背景图片**: 使用 CSS `background-size: cover` 和 `opacity` 降低性能消耗
- **图片错误处理**: 使用 `onError` 隐藏加载失败的图片

#### 8.8.2 状态管理

- **useMemo**: 复杂计算结果使用 `useMemo` 缓存
- **useCallback**: 事件处理函数使用 `useCallback` 避免重复创建
- **useEffect 依赖**: 正确设置依赖项避免不必要的重新渲染

#### 8.8.3 列表渲染

- **虚拟列表**: 大数据量列表使用虚拟滚动
- **分页加载**: 避免一次性加载过多数据
- **骨架屏**: 加载状态使用 Skeleton 组件提升体验

#### 8.8.4 API 请求

- **Promise.all**: 并发请求多个独立 API
- **缓存策略**: 合理使用 React Query 的缓存机制
- **错误处理**: 每个请求都需要错误处理

---

### 8.9 低端设备性能优化建议

#### 8.9.1 发现的问题

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

#### 8.9.2 快速检查清单

- [ ] 列表组件超过 50 项考虑虚拟滚动
- [ ] 图片使用懒加载和适当缓存
- [ ] useEffect 依赖数组完整性检查
- [ ] Context 值使用 useMemo 包装
- [ ] 避免在 render 中创建新的函数/对象
- [ ] 考虑添加 `React.memo` 包装纯展示组件
- [ ] 大列表考虑使用 `will-change` CSS 提示浏览器

---

## 9. TabButtonGroup 组件规范

### 9.1 组件位置
```
src/components/ui/TabButtonGroup.tsx
```

### 9.2 组件说明
用于替代原有散落的 ToggleGroup 和自定义按钮组，提供统一的标签切换按钮样式。

### 9.3 接口定义

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

### 9.4 使用要求

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

### 9.5 已使用该组件的页面

| 页面 | 用途 |
|------|------|
| AIConfigPage | AI 配置选择 |
| AIToolsPage | AI 工具插件过滤 |
| FrameworkConfigPage | 框架配置选择 |
| PluginsPage | 插件选择、配置名称切换 |
| BackupPage | 备份设置/下载切换 |

### 9.6 注意事项

1. **不要使用 w-full** - 组件默认 `inline-flex`，会自动适配内容宽度，不需要父容器设置 `w-full`

2. **换行行为** - 按钮过多时使用 `flex-wrap`，会自动换行到下一行

3. **图标大小** - 统一使用 `w-4 h-4` 或类似大小，组件会自动处理尺寸统一

4. **glassClassName 必传** - 不传会导致页面主题切换时样式不一致

---

## 10. 关键文件索引

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

## 11. AI配置页面开发记录

### 11.1 任务概述

为【AI配置】->【基础配置】创建了一个渐进式配置页面，将多个相关配置融合成一个统一且用户友好的界面。

### 11.2 设计原则

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

### 11.3 新增组件

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

#### TagsInput (`src/components/config/TagsInput.tsx`)

标签输入组件，用于管理字符串标签列表。支持搜索已添加标签、回车添加自定义标签、可选标签列表选择。**所有需要标签/关键词输入的场景必须使用此组件，禁止自行实现标签输入 UI。**

```tsx
// 类型定义
interface TagsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  options?: string[];  // 可选的预设标签列表
}
```

**使用示例：**

```tsx
import { TagsInput } from '@/components/config/TagsInput';

// 基本用法 - 自由输入标签
<TagsInput
  value={tags}
  onChange={setTags}
/>

// 带预设选项
<TagsInput
  value={tags}
  onChange={setTags}
  options={['搞笑', '无语', '开心', '吐槽']}
/>

// 配合 Label 使用
<div className="space-y-1.5">
  <Label className="text-xs font-medium text-muted-foreground">情绪标签</Label>
  <TagsInput value={emotionTags} onChange={setEmotionTags} />
</div>
```

**功能特性：**
- 已添加标签以 chip 形式展示，支持点击删除
- 点击「更多」按钮打开 Popover，可搜索已添加标签
- 在 Popover 搜索框中输入新标签后回车即可添加
- 如提供 `options` 参数，Popover 中会显示可选标签列表
- 支持复制标签文本

### 11.4 关键实现

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

### 11.5 未来需要注意的点

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

## 12. 列表页面与详情页设计规范

### 12.1 表格行点击打开详情页

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

### 12.2 二级详情页标题规范

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

### 12.3 字段分组与间隔

详情页中的字段应按逻辑分组：
- 使用 `<Separator />` 或 `border-b` 分隔不同分组
- 每个分组有清晰的 Label 说明
- 保持一致的间距（通常 `space-y-4` 或 `gap-4`）

---

## 13. 配置页面变更检测规范

### 13.1 问题背景

在【框架配置】页面中，配置项分为两类：
1. **预期配置项** - 前端预定义的已知配置项
2. **预料之外配置项** - 由插件或后端动态新增的配置项（显示在"其他设置"卡片中）

### 13.2 数据存储结构

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

### 13.3 变更检测实现规范

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

### 13.4 常见错误

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

### 13.5 需要遵循此规范的文件

- `MiscSettings.tsx` - 杂项配置
- `ButtonMarkdownSettings.tsx` - 按钮和MD配置
- 任何包含 `EXPECTED_CONFIG_KEYS` 和 `rawConfig` 的配置组件

---

## 14. 其他规范

### 14.1 图标使用

- 优先使用 `lucide-react` 图标库
- 图标大小统一：标题用 `w-5 h-5`，按钮内用 `w-4 h-4`
- 使用 `gap-2` 或 `gap-3` 保持图标与文字间距

### 14.2 颜色规范

- 使用 Tailwind 的颜色变量，如 `text-primary`, `bg-primary/10`
- 避免硬编码颜色值
- 状态色：成功 `text-green-500`，警告 `text-amber-500`，错误 `text-red-500`

### 14.3 响应式设计

- 移动端优先，使用 `md:`, `lg:` 等断点
- 表格在移动端使用卡片布局替代
- 表单字段在移动端单列，桌面端可多列

---

## 15. InputWithDropdown 组件规范

### 15.1 组件位置

```
src/components/ui/input-with-dropdown.tsx
```

### 15.2 组件说明

用于替代项目中所有"输入框 + 下拉列表"的组合模式。当一个配置项既支持自由输入又支持从预设列表中选择时，**必须**使用此组件，禁止手动拼装 Popover + Input + Button。

### 15.3 接口定义

```typescript
export interface InputWithDropdownProps {
  /** 当前值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 下拉选项列表 */
  options: string[];
  /** 触发按钮的占位文本（无值时显示） */
  placeholder?: string;
  /** 下拉面板中输入框的占位文本 */
  inputPlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义容器样式 */
  className?: string;
  /** Popover 宽度，默认 'w-[400px]' */
  popoverWidth?: string;
}
```

### 15.4 使用示例

#### 基本用法

```tsx
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';

<InputWithDropdown
  value={model}
  onChange={setModel}
  options={['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet']}
  placeholder="选择或输入模型名称"
  inputPlaceholder="输入或选择模型名称"
/>
```

#### 在配置页面中使用

```tsx
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';

<div className="space-y-2">
  <Label>API Base URL</Label>
  <InputWithDropdown
    value={baseUrl}
    onChange={setBaseUrl}
    options={['https://api.openai.com/v1', 'https://api.deepseek.com/v1']}
    placeholder="选择或输入 API Base URL"
    inputPlaceholder="https://api.openai.com/v1"
  />
</div>
```

#### 禁用状态

```tsx
<InputWithDropdown
  value={value}
  onChange={onChange}
  options={options}
  disabled={true}
/>
```

### 15.5 已使用该组件的位置

| 位置 | 用途 |
|------|------|
| `ConfigField.tsx` select 类型 | 所有配置页面的下拉选择字段（核心配置、插件配置、框架配置等） |
| `AIConfigPage.tsx` 新增配置对话框 | API Base URL、模型名称选择 |
| `AIConfigPage.tsx` 编辑配置对话框 | API Base URL、模型名称选择 |

### 15.6 注意事项

1. **禁止手动拼装** - 遇到"输入框 + 下拉列表"的组合需求时，必须使用此组件，不要手动使用 Popover + Input + Button 拼装
2. **options 为空时** - 组件会自动隐藏下拉列表区域，仅显示输入框
3. **选中高亮** - 当前值与选项匹配时会自动高亮显示 `bg-accent`
4. **Popover 宽度** - 默认 `w-[400px]`，可通过 `popoverWidth` 属性自定义
5. **与 Select 组件的区别** - `Select` 只能从列表中选择，`InputWithDropdown` 既可选择也可自由输入

---

## 16. DynamicConfigPanel 通用配置面板组件

### 16.1 组件位置

`src/components/config/DynamicConfigPanel.tsx`

### 16.2 功能说明

根据后端 `PluginConfigItem` 的 `type` 字段自动渲染对应的配置字段 UI，无需手动为每个字段编写 Label + Tooltip + ConfigField 代码。

### 16.3 后端 type → ConfigField type 映射

| 后端 type | 映射为 ConfigField type |
|-----------|----------------------|
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

### 16.4 Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `config` | `Record<string, PluginConfigItem>` | 后端返回的配置字段映射 |
| `configId` | `string` | 配置 ID，用于 updateConfigValue |
| `onChange` | `(configId, fieldKey, value) => void` | 值变更回调 |
| `excludeKeys?` | `string[]` | 需要排除的字段 key 列表 |
| `layout?` | `string[][]` | 自定义布局，同数组内的字段并排显示 |

### 16.5 使用示例

```tsx
import { DynamicConfigPanel } from '@/components/config';

// 基本用法 - 自动渲染所有字段
<DynamicConfigPanel
  config={configData.config}
  configId={configData.id}
  onChange={updateConfigValue}
/>

// 自定义布局 - api_key 独占一行，max_results 和 search_depth 并排
<DynamicConfigPanel
  config={configData.config}
  configId={configData.id}
  onChange={updateConfigValue}
  layout={[['api_key'], ['max_results', 'search_depth']]}
/>

// 排除已手动渲染的字段
<DynamicConfigPanel
  config={aiConfig.config}
  configId={aiConfig.id}
  onChange={updateConfigValue}
  excludeKeys={['enable', 'enable_rerank', 'enable_memory', 'websearch_provider']}
  layout={[['white_list', 'black_list']]}
/>
```

### 16.6 自动特性

- 根据字段 `title` 显示标签（中文标题）
- 根据字段 `desc` 自动生成 Tooltip 帮助图标
- 根据字段 key 自动匹配图标（api_key→Key, max→SlidersHorizontal, host→Globe 等）
- 未在 `layout` 中指定的字段自动追加到末尾

### 16.7 已使用该组件的位置

| 位置 | 用途 |
|------|------|
| `AIConfigPage.tsx` 嵌入模型服务面板 | 嵌入模型配置、Rerank 模型配置 |
| `AIConfigPage.tsx` 网络搜索服务面板 | Tavily、Exa、MiniMax 搜索配置 |
| `AIConfigPage.tsx` 高级设置面板 | HuggingFace 地址、白名单、黑名单 |
| `AIConfigPage.tsx` 记忆配置面板 | 记忆会话、检索 Top-K |

### 16.8 注意事项

1. **特殊 UI 字段需手动渲染** - 如 ToggleRow（开关）、ChipGroup（多选标签）、Badge 提示等特殊 UI 的字段，应通过 `excludeKeys` 排除后手动渲染
2. **新增搜索服务** - 只需添加 `useMemo` 获取配置 + 一行 `<DynamicConfigPanel>` 即可，无需手动编写每个字段的 Label/Tooltip/ConfigField
3. **type 映射与插件配置页面一致** - 映射逻辑参考 `PluginsPage.tsx` 中的 `convertConfigToFields` 函数

---

## 17. 配置保存按钮竞态问题规范

### 17.1 问题描述

在 `AIConfigPage.tsx` 中，配置数据通过多个异步请求逐个加载。如果在所有配置加载完成前就设置 `originalConfig`（用于判断是否有变更），会导致保存按钮误亮。

### 17.2 根本原因

1. **部分加载导致 dirty 误判** - `fetchConfigDetail` 逐个异步加载配置，第一个配置到达时 `configs` 就有 key 了，`originalConfig` 被设置为不完整的快照，后续配置到达后 `configs` 与 `originalConfig` 不一致
2. **非配置操作触发 configs 变更** - 如切换高/低级任务后调用 `fetchAllConfigs()`，会重新构建 `configs` 对象，但 `originalConfig` 未同步更新
3. **重复请求** - useEffect 依赖 `configs`，每次请求完成更新 `configs` 后又触发 effect 重新运行

### 17.3 解决方案

```tsx
// 1. 使用 ref 跟踪已请求过的配置，避免重复请求
const fetchedConfigNamesRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (configList.length > 0) {
    configList.forEach(config => {
      if (!configs[config.id] && !fetchedConfigNamesRef.current.has(config.full_name)) {
        fetchedConfigNamesRef.current.add(config.full_name);
        fetchConfigDetail(config.full_name);
      }
    });
  }
}, [configList, configs, fetchConfigDetail]);

// 2. 等待所有配置都加载完成后再设置 originalConfig
useEffect(() => {
  if (configList.length > 0 && Object.keys(configs).length >= configList.length && !hasInitialized) {
    setOriginalConfig(JSON.parse(JSON.stringify(configs)));
    setHasInitialized(true);
  }
}, [configs, configList, hasInitialized]);

// 3. 非配置操作（如切换高/低级任务）完成后同步 originalConfig
const handleSetHighLevelConfig = useCallback(async (configName, provider) => {
  await providerConfigApi.setHighLevelConfig(configName, provider);
  await fetchAllConfigs();
  setOriginalConfig(JSON.parse(JSON.stringify(configs))); // 同步
}, [configs, fetchAllConfigs]);

// 4. 只保存实际发生变化的配置，避免并发写入竞态
const handleSaveConfig = async () => {
  const changedConfigs = Object.values(configs).filter(config => {
    const original = originalConfig[config.id];
    if (!original) return true;
    return JSON.stringify(config.config) !== JSON.stringify(original.config);
  });
  for (const config of changedConfigs) {
    await frameworkConfigApi.updateFrameworkConfig(config.full_name, configToSave);
  }
  setOriginalConfig(JSON.parse(JSON.stringify(configs)));
};
```

### 17.4 注意事项

1. **originalConfig 必须在所有配置加载完成后才设置** - 使用 `Object.keys(configs).length >= configList.length` 判断
2. **非配置变更操作也需要同步 originalConfig** - 如切换高/低级任务、刷新配置列表等
3. **保存时只发送变化的配置** - 避免并发写入导致后端竞态条件
4. **使用 ref 避免重复请求** - useEffect 依赖 `configs` 时，用 ref 记录已请求的配置名

---

## 18. Dialog/Modal 组件开发规范

### 18.1 Radix UI Select 空值问题

**问题**：Radix UI 的 `Select.Item` 不允许空字符串 `""` 作为 `value` 属性，否则会抛出运行时错误。

**解决方案**：使用特殊占位符常量替代空字符串：

```tsx
const DEFAULT_MIRROR_VALUE = '__github_default__';

// 后端值 → Select 值
const toSelectValue = (value: string) => value || DEFAULT_MIRROR_VALUE;
// Select 值 → 后端值
const toMirrorValue = (value: string) => value === DEFAULT_MIRROR_VALUE ? '' : value;

// SelectItem 中使用
<SelectItem key={mirror.value || DEFAULT_MIRROR_VALUE} value={toSelectValue(mirror.value)}>
```

### 18.2 毛玻璃主题适配

**规则**：`glass-card` CSS 类已通过 `[data-style="glassmorphism"]` 和 `[data-style="solid"]` 选择器自动适配不同主题模式（纯色/毛玻璃/亮暗）。**应始终应用 `glass-card`**，无需手动判断 `isGlass`。

**错误模式** ❌：
```tsx
// 不要这样做！glass-card 已经自动适配主题
const isGlass = style === 'glassmorphism';
<DialogContent className={cn("...", isGlass && "glass-card")}>
<Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
```

**正确模式** ✅：
```tsx
// 直接应用 glass-card，CSS 会根据 data-style 自动切换效果
<DialogContent className="... glass-card">
<AlertDialogContent className="glass-card">
<Card className="glass-card">
<div className="rounded-lg p-4 glass-card">
```

**CSS 行为说明**：
- `[data-style="glassmorphism"]` → 半透明背景 + `backdrop-filter: blur()`
- `[data-style="solid"]` → 不透明背景，无模糊效果
- `.dark` → 暗色模式优化（更低透明度）

### 18.3 移动端适配

**规则**：Dialog 内的数据列表在移动端应使用卡片布局替代表格，确保操作按钮始终可见。

**模式**：使用 `hidden md:block` / `md:hidden` 双布局：
```tsx
{/* 桌面端表格 */}
<div className="hidden md:block">
  <Table>
    {/* 表格内容 */}
  </Table>
</div>

{/* 移动端卡片列表 */}
<div className="md:hidden space-y-2 p-2">
  {items.map((item) => (
    <div key={item.id} className="rounded-lg p-3 space-y-2 border border-border/50">
      {/* 第一行：名称 + 状态 + 操作按钮（flex justify-between） */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium text-sm truncate">{item.name}</span>
          <Badge>状态</Badge>
        </div>
        <Button size="sm" className="shrink-0">操作</Button>
      </div>
      {/* 第二行：详细信息 */}
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block">{item.url}</code>
    </div>
  ))}
</div>
```

**关键点**：
- 移动端卡片中，操作按钮必须放在第一行右侧（`shrink-0`），确保始终可见
- 使用 `min-w-0 flex-1` 让名称区域自动截断
- Dialog 宽度使用 `w-[95vw] max-w-4xl` 确保移动端占满屏幕
- 按钮区域使用 `flex-col sm:flex-row` 确保移动端按钮垂直排列

### 18.4 SSH URL 识别

**规则**：Git remote URL 可能使用 SSH 协议（`ssh://` 或 `git@` 开头），后端可能无法识别而返回 `unknown`。前端应额外检测。

```tsx
function isSshUrl(url: string): boolean {
  return url.startsWith('ssh://') || url.startsWith('git@');
}
```

### 18.5 API 接口设计经验

- **仅保存配置 vs 批量应用**：区分"保存配置（影响后续新安装）"和"一键应用（同时切换已安装）"两种操作
- **使用 `frameworkConfigApi.updateFrameworkConfigItem`** 保存单个配置项，避免覆盖其他配置
- **静默失败**：非关键数据获取（如 git mirror info）应静默失败，不影响主页面功能

---

## 19. 页面排版铁律

**所有页面必须严格遵循以下排版规范，确保全站视觉一致性。**

### 19.1 页面根容器

```tsx
<div className="p-6 space-y-6">
  {/* 页面内容 */}
</div>
```

- **页边距**：统一使用 `p-6`（24px），不得使用 `max-w-7xl mx-auto` 等额外宽度限制
- **内容间距**：统一使用 `space-y-6`

### 19.2 页面标题区域

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold flex items-center gap-3">
      <IconComponent className="w-8 h-8" />
      {t('pageTitle')}
    </h1>
    <p className="text-muted-foreground mt-1">{t('pageDescription')}</p>
  </div>
  {/* 右侧操作按钮 */}
</div>
```

- **标题字号**：统一使用 `text-3xl font-bold`
- **标题 ICON**：直接使用图标组件，`className="w-8 h-8"`，**不加**背景容器（如 `rounded-xl bg-primary/10` 等）
- **ICON 与标题**：通过 `flex items-center gap-3` 水平排列
- **描述文字**：使用 `text-muted-foreground mt-1`，**不加** `text-sm`（继承默认字号）

### 19.3 反面示例（禁止使用）

```tsx
// ❌ 错误：标题字号过小
<h1 className="text-2xl font-bold">

// ❌ 错误：ICON 带背景容器
<div className="w-10 h-10 rounded-xl bg-primary/10">
  <Icon className="w-5 h-5 text-primary" />
</div>

// ❌ 错误：描述文字加了 text-sm
<p className="text-muted-foreground mt-1 text-sm">

// ❌ 错误：根容器加了宽度限制
<div className="p-6 space-y-6 max-w-7xl mx-auto">
```

### 19.4 参考页面

[`AISkillsPage.tsx`](src/pages/AISkillsPage.tsx) 是排版标准参考页面，所有新页面和现有页面都应与其保持一致。

---

## 20. Switch 组件 UX 规范

### 20.1 组件位置

```
src/components/ui/switch.tsx
```

### 20.2 默认样式

Switch 组件已在组件层面内置了主题色行为：

```tsx
// 组件内部已包含以下默认样式
"data-[state=checked]:bg-primary data-[state=unchecked]:bg-input aria-[checked=true]:bg-primary aria-[checked=false]:bg-input"
```

- **选中状态**：使用主题色 `bg-primary`（自动适配亮/暗模式）
- **未选中状态**：使用 `bg-input`（灰色输入框背景色）

### 20.3 Tooltip + Switch 兼容性问题

**⚠️ 重要**：当 Switch 被 `TooltipTrigger asChild` 包裹时，Radix UI 的 Tooltip 会将自己的 `data-state`（`closed`/`open`）覆盖到子元素上，导致 Switch 的 `data-state`（`checked`/`unchecked`）被覆盖，`data-[state=checked]:bg-primary` 选择器失效。

**解决方案**：用 `<span>` 包裹 Switch，让 Tooltip 的 `data-state` 作用在 `<span>` 上而不是 Switch 上：

```tsx
// ✅ 正确：用 span 包裹，避免 data-state 被覆盖
<Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Switch checked={enabled} onCheckedChange={setEnabled} />
    </span>
  </TooltipTrigger>
  <TooltipContent>
    <p>提示文字</p>
  </TooltipContent>
</Tooltip>

// ❌ 错误：Switch 直接作为 asChild 子元素，data-state 会被 Tooltip 覆盖
<Tooltip>
  <TooltipTrigger asChild>
    <Switch checked={enabled} onCheckedChange={setEnabled} />
  </TooltipTrigger>
  <TooltipContent>
    <p>提示文字</p>
  </TooltipContent>
</Tooltip>
```

**受影响的场景**：
- 任何使用 `<TooltipTrigger asChild><Switch ... /></TooltipTrigger>` 的地方
- 任何使用 `asChild` 并可能覆盖 `data-state` 的 Radix UI 组件

### 20.3 使用规则

#### ✅ 正确用法 - 直接使用，无需额外 className

```tsx
<Switch
  checked={isEnabled}
  onCheckedChange={setIsEnabled}
/>
```

#### ❌ 错误用法 - 不要手动覆盖主题色

```tsx
// 不要这样做！组件已内置主题色
<Switch
  checked={isEnabled}
  onCheckedChange={setIsEnabled}
  className="data-[state=checked]:bg-primary"  // 冗余！
/>

// 不要使用硬编码颜色
<Switch
  className="data-[state=checked]:bg-green-500"  // 禁止！
/>
```

#### ✅ 允许的额外 className

只允许添加不影响颜色的样式，如尺寸调整：

```tsx
<Switch
  checked={isAIEnabled}
  onCheckedChange={handleToggle}
  className="scale-110"  // 仅调整大小，不影响颜色
/>
```

### 20.4 特殊场景

如果某个 Switch 需要使用非主题色（如红色表示危险操作），必须有明确的设计理由，并在代码注释中说明：

```tsx
// 危险操作开关使用红色主题
<Switch
  checked={isDangerous}
  onCheckedChange={handleToggle}
  className="data-[state=checked]:bg-destructive"
/>
```

### 20.5 检查清单

- [ ] Switch 选中状态是否使用主题色（`bg-primary`）
- [ ] Switch 未选中状态是否使用灰色（`bg-input`）
- [ ] 是否有冗余的 `data-[state=checked]:bg-primary` className
- [ ] 是否有硬编码的颜色值（如 `bg-green-500`、`bg-red-500`）

---

*文档版本: 2.4*
*最后更新: 2026年*
