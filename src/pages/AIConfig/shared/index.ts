/**
 * `pages/AIConfig/shared/` 子目录的桶导出文件。
 *
 * 让形如 `import { ConfigCard } from '../shared'` 的相对路径在 Vite
 * 与 TypeScript 都能解析（不带子路径后缀），与 `pages/AIConfig/index.ts`
 * 顶层桶的写法对齐。
 */

export { ConfigCard } from './ConfigCard';
export type { ConfigCardCollapsible, ConfigCardProps } from './ConfigCard';

export { ConfigGroup } from './ConfigGroup';
export type { ConfigGroupProps } from './ConfigGroup';

export { ConfigGroupList } from './ConfigGroupList';
export type { ConfigGroupListProps } from './ConfigGroupList';

export { SettingRow, settingListClass } from './SettingRow';
export type { SettingRowProps } from './SettingRow';

export { fieldGridClass, fieldWideClass, fieldGrid2Class, fieldWide2Class } from './fieldGrid';

export { LabelWithHelp } from '@/components/ui/label-with-help';
export type { LabelWithHelpProps } from '@/components/ui/label-with-help';

export { PersonaAvatar } from './PersonaAvatar';
export type { PersonaAvatarProps } from './PersonaAvatar';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { SidebarItem } from './SidebarItem';
export type { SidebarItemProps } from './SidebarItem';

export { renderRichText } from './renderRichText';

export { sameProviderId, filterOutPrimaryProvider } from './providerId';
