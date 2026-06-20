# 一、架构与工程约定

> 返回 [SKILL 主入口](../SKILL.md)。本章覆盖技术栈、目录、路由、代码风格、API 层、关键文件索引。

## 1.1 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript + Vite |
| 路由 | react-router-dom |
| UI 组件库 | shadcn/ui（基于 Radix UI） |
| 样式 | Tailwind CSS |
| 图标 | lucide-react |
| 图表 | recharts / ECharts（`EChartsWrapper`） |
| 日期处理 | date-fns |
| 表单验证 | react-hook-form + zod |
| Toast | sonner（`import { toast } from 'sonner'`） |

## 1.2 目录结构

```
src/
├── pages/                  # 路由页面，每个页面一个 XXXPage.tsx
│   └── AIConfig/           # 复杂页面可拆子目录（hooks/ components/）
├── components/
│   ├── ui/                 # shadcn/ui 基础组件 + 项目封装组件
│   │   ├── button.tsx  dialog.tsx  card.tsx  switch.tsx …
│   │   ├── TabButtonGroup.tsx          # 分段切换按钮
│   │   ├── input-with-dropdown.tsx     # 输入框 + 下拉
│   │   └── MultiSelectChipGroup.tsx    # 多选/单选 Chip
│   ├── layout/             # AppLayout.tsx / AppSidebar.tsx
│   ├── config/             # ConfigField / TagsInput / DynamicConfigPanel
│   ├── backup/             # 备份相关
│   └── charts/             # 图表封装
├── contexts/               # LanguageContext / ThemeContext 等全局上下文
├── hooks/                  # useSystemControl / useAIStatus 等通用 hooks
├── i18n/locales/           # zh-CN / en-US / ja-JP 三语言目录
└── lib/
    ├── api.ts              # 所有 API 封装 + 类型定义（唯一出入口）
    └── utils.ts            # cn() 等工具
```

## 1.3 路由规范

使用 `react-router-dom`，页面组件位于 `src/pages/`。`AppLayout` 提供整体布局（侧边栏 + Header），业务页面作为其子路由：

```tsx
// App.tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<AppLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="ai-budget" element={<AIBudgetPage />} />
    {/* 更多路由… */}
  </Route>
</Routes>
```

## 1.4 代码风格要点

### 导入路径别名 `@/`

```tsx
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
```

配置见 `tsconfig.app.json` 与 `vite.config.ts`。

### 图标使用（lucide-react）

```tsx
import { Save, Trash, Settings, Wallet } from 'lucide-react';
<Button><Save className="h-4 w-4" /> 保存</Button>
```

图标尺寸约定：页面标题 `w-8 h-8`、卡片小标题 `w-5 h-5`、按钮内 `w-4 h-4`；与文字间距 `gap-2`/`gap-3`。

### 文件头分区注释

```tsx
// ============================================================================
// 类型定义 / Helpers / 工具函数 / 组件定义
// ============================================================================
```

## 1.5 API 层封装规范

**所有 API 调用集中在 `src/lib/api.ts`**，禁止在页面里散落 `fetch`。

```tsx
import { dashboardApi, themeApi, aiBudgetApi } from '@/lib/api';
const data = await dashboardApi.getDailyUsage(botId, date);
```

新增一组接口时：

1. 在文件中定义请求/响应 `interface`（与该 API 组放在一起）。
2. 导出一个 `xxxApi` 对象，方法体内调用统一的 `api`（`api.get/post/put/delete<T>`）。
3. 查询参数用 `URLSearchParams`，仅在有值时 `set`，避免发送空参数。

范式（AI Budget，本次更新示例）：

```ts
export interface AIBudgetConfig {
  enable: boolean;
  count_mode: 'input_output' | 'total_with_cache' | 'output_only';
  /* … */
}

export const aiBudgetApi = {
  getConfig: () => api.get<AIBudgetConfig>('/api/ai/budget/config'),
  updateConfig: (data: Partial<AIBudgetConfig>) =>
    api.put<AIBudgetConfig>('/api/ai/budget/config', data),
  getRules: (params: { scope_type?: string; q?: string; with_usage?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.scope_type) query.set('scope_type', params.scope_type);
    if (params.q) query.set('q', params.q);
    if (params.with_usage) query.set('with_usage', 'true');
    const qs = query.toString();
    return api.get<AIBudgetRule[]>(`/api/ai/budget/rules${qs ? `?${qs}` : ''}`);
  },
};
```

页面侧只 `import { aiBudgetApi, AIBudgetConfig } from '@/lib/api'`。

## 1.6 401 认证失败处理

401 由封装层（`ApiClient.request()` / `getRaw()` 等）**统一**处理并跳登录，页面不要各自判断。跳转用 `getLoginPath()`：

```tsx
import { getLoginPath } from '@/lib/api';
window.location.href = getLoginPath();  // 开发 → /login，生产 → /app/login
```

关键点：`import.meta.env.BASE_URL` 开发为 `/`、生产为 `/app/`；`getLoginPath()` 负责拼接，保证两种部署都能正确跳转。

## 1.7 类型定义约定

- API 响应类型在 `api.ts` 同文件定义，**从 `@/lib/api` 导出复用**（如 `PluginConfigItem`），避免在页面里重复定义。
- 使用 `frameworkConfigApi` 等已有 API 对象的类型，而非手动重定义。

## 1.8 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/contexts/LanguageContext.tsx` | i18n 上下文，提供 `t()` 函数 |
| `src/contexts/ThemeContext.tsx` | 主题上下文，管理主题状态 |
| `src/i18n/locales/{zh-CN,en-US,ja-JP}/` | 三语言翻译模块目录，按顶级模块拆 JSON |
| `src/lib/api.ts` | 所有 API 接口封装 + 类型 |
| `src/lib/utils.ts` | 工具函数（含 `cn()`） |
| `tailwind.config.ts` | Tailwind 配置 / 颜色映射 |
| `src/components/ui/` | shadcn/ui 与项目封装组件库 |
| `src/components/layout/AppSidebar.tsx` | 侧边栏导航（`getNavItems` / `ICON_MAP`） |
| `src/pages/AISkillsPage.tsx` `AIMemoryPage.tsx` | **排版标准参考页**（见 [§04](./04-page-layout-spec.md)） |

## 1.9 新增页面标准步骤

1. 创建 `src/pages/XXXPage.tsx`（严格遵循 [§04 排版铁律](./04-page-layout-spec.md)）。
2. 在 `src/App.tsx` 注册 `<Route>`（`AppLayout` 子路由）。
3. 三语言补翻译（见 [§02](./02-i18n.md)）。
4. `AppSidebar.tsx` 的 `getNavItems` 增加导航项 + `ICON_MAP` 登记图标（见 [§09](./09-sidebar-navigation.md)）。
5. 复用已有封装组件拼装页面（见 [§05](./05-components-and-form-controls.md)、[§06](./06-reusable-component-catalog.md)）。

> 完整自查清单见 [§10 已知坑 · 新页面落地清单](./10-pitfalls-and-performance.md)。
