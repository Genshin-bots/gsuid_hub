# 九、侧边栏与导航

> 返回 [SKILL 主入口](../SKILL.md)。源码 `src/components/layout/AppSidebar.tsx`。

## 9.1 导航配置 `getNavItems`

侧边栏导航在 `getNavItems(t, isAIEnabled, isAdmin)` 中构造，`NavItem` 同时支持一级项与含 `children` 的二级菜单：

```tsx
interface NavItem {
  id: string;          // ★ 稳定标识符，不随语言变化，用于追踪展开/选中状态
  title: string;       // t(...) 翻译后的显示名
  url?: string;
  icon?: React.ElementType;
  children?: NavItem[];
  adminOnly?: boolean; // 后端整页 require_admin 时打标，非 admin 侧栏隐藏
}

const getNavItems = (t, isAIEnabled, isAdmin): NavItem[] => [
  { id: 'home', title: t('sidebar.home'), url: '/home', icon: Home },
  { id: 'dashboard', title: t('sidebar.dashboard'), url: '/dashboard', icon: LayoutDashboard },
  {
    id: 'adminCore', title: t('sidebar.adminCore'), icon: Cog,
    children: [
      { id: 'coreConfig', title: t('sidebar.coreConfig'), url: '/core-config', icon: Cog, adminOnly: true },
      // …
    ],
  },
  {
    id: 'aiConfig', title: t('sidebar.aiConfig'), icon: Brain,
    children: aiConfigChildren,        // 依 isAIEnabled 动态裁剪
  },
];
```

`filterAdminNav` 在 `getNavItems` 末尾按 `isAdmin` 去掉 `adminOnly` 项；空分组一并去掉。
整页 admin 的路由还要包 `AdminRoute`（直链 `/core-config` 等会回首页）：`/core-config`、`/backup`、`/database`、`/batch-push`。
读写分离的页（框架配置、插件、调度、git 更新）侧栏仍对普通用户可见，写接口 403 由页面 toast。
重启 / 暂停按钮仅 `user.role === 'admin'` 显示。

## 9.2 用稳定 `id` 作 key / 状态键（不要用 `title`）★★

**所有** React `key`、展开状态 `expandedItems`、自动展开判断、AI 配置菜单识别，都用不随语言变化的 `id`：

```tsx
const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

<MemoizedNavItem
  key={item.id}                                   // ← id 而非 title
  isExpanded={expandedItems[item.id] ?? false}
  onToggle={() => toggleExpanded(item.id)}
/>

{item.children?.map(child => (
  <SidebarMenuItem key={child.id}>…</SidebarMenuItem>   // ← 子项也用 id
))}

// 识别 AI 配置菜单用 id 常量，不用翻译后的标题
const AI_CONFIG_ID = 'aiConfig';
const toggleExpanded = (id: string) => {
  const willExpand = !expandedItems[id];
  setExpandedItems(prev => ({ ...prev, [id]: willExpand }));
  if (willExpand && id === AI_CONFIG_ID) refreshAIStatus();   // 展开 AI 菜单时复核 AI 状态
};
```

> **为什么**：早期用 `t('sidebar.xxx')`（翻译后的标题）当 key 和状态键，**切换语言后 title 变了**，`expandedItems` 里旧标题的展开状态全部失配 → 展开态丢失、`refreshAIStatus` 触发条件失效。改用 `id` 后状态与语言解耦。这是本次更新的核心修复，**新增菜单项务必带 `id`**。

## 9.3 自动展开当前路由所在父菜单

`url` 可能为空，拼接前做空值兜底：

```tsx
const hasActiveChild = item.children.some(child =>
  currentPath === child.url || currentPath.startsWith((child.url || '') + '/')
);
if (hasActiveChild) setExpandedItems(prev => ({ ...prev, [item.id]: true }));
```

## 9.4 新增图标要登记 `ICON_MAP`

侧边栏图标走 `ICON_MAP`（持久化/反序列化用）。新图标要先 `import` 再加入映射：

```tsx
import { …, Wallet } from 'lucide-react';
const ICON_MAP: Record<string, React.ElementType> = { …, Wallet };
```

## 9.5 AI 启用态条件子菜单

`aiConfig` 子菜单依 `isAIEnabled`（来自 `useAIStatus()`）裁剪：

```tsx
const aiConfigChildren: NavItem[] = isAIEnabled
  ? [ /* 基础配置 / 人格 / AI预算 / MCP / 工具 / 技能 / 统计 / … 全量 */ ]
  : [ { id: 'ai-basicConfig', … }, { id: 'ai-history', … } ];  // 未启用只保留两项
```

展开 AI 配置菜单时主动 `refreshAIStatus()` 复核，保证未点 `/ai-config` 也能显示完整子菜单。

## 9.6 新增菜单项步骤

1. `getNavItems` 加 `{ id, title: t('sidebar.xxx'), url, icon }`（**带稳定 `id`**）。
2. 新图标 → `import` + 加入 `ICON_MAP`。
3. 三语言 `sidebar.json` 加 `xxx` 文案（见 [§02](./02-i18n.md)）。
4. `App.tsx` 注册路由、创建页面（见 [§01](./01-architecture-and-conventions.md)、[§04](./04-page-layout-spec.md)）。
5. 后端整页 `require_admin` 时加 `adminOnly: true`，路由包 `<AdminRoute>`。

## 9.7 运维分组中的 Live Chat 示例

`/live-chat` 挂在运维相关子菜单（与会话管理、批量推送并列），登记方式：

```tsx
// AppSidebar.tsx — getNavItems 子项
{ id: 'liveChat', title: t('sidebar.liveChat'), url: '/live-chat', icon: MessageCircle },

// ICON_MAP
MessageCircle,

// sidebar.json（三语言）
"liveChat": "实时聊天" | "Live Chat" | "リアルタイムチャット"
```

页面与协议细节见 [§11](./11-live-chat.md)；`App.tsx` 路由：`path="live-chat"`。
