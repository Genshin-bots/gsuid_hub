/**
 * `pages/AIConfig/shared/` 子目录的桶导出文件。
 *
 * 让形如 `import { HeadingWithHelp } from '../shared'` 的相对路径在 Vite
 * 与 TypeScript 都能解析（不带子路径后缀），与 `pages/AIConfig/index.ts`
 * 顶层桶的写法对齐。
 */

export { HeadingWithHelp } from './HeadingWithHelp';
export type { HeadingWithHelpProps } from './HeadingWithHelp';

export { LabelWithHelp } from './LabelWithHelp';
export type { LabelWithHelpProps } from './LabelWithHelp';

export { ToggleRow } from './ToggleRow';
export type { ToggleRowProps } from './ToggleRow';

export { PersonaAvatar } from './PersonaAvatar';
export type { PersonaAvatarProps } from './PersonaAvatar';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { SidebarItem } from './SidebarItem';
export type { SidebarItemProps } from './SidebarItem';

export { renderRichText } from './renderRichText';

export { sameProviderId, filterOutPrimaryProvider } from './providerId';
