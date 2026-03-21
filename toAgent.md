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

---

## 9. 关键文件索引

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