/**
 * 桶导出文件。
 *
 * 外部推荐通过以下方式导入：
 *   import { ServiceSwitchSection, TaskConfigSection } from './AIConfig';
 *   import type { LocalFrameworkConfig } from './AIConfig';
 *
 * 该入口同时被 `./AIConfigPage.tsx`（顶层路由）和外部测试使用。
 */

// shared
export { ToggleRow } from './shared/ToggleRow';
export type { ToggleRowProps } from './shared/ToggleRow';
export { PersonaAvatar } from './shared/PersonaAvatar';
export type { PersonaAvatarProps } from './shared/PersonaAvatar';
export { EmptyState } from './shared/EmptyState';
export type { EmptyStateProps } from './shared/EmptyState';
export { SidebarItem } from './shared/SidebarItem';
export type { SidebarItemProps } from './shared/SidebarItem';
export { HeadingWithHelp } from './shared/HeadingWithHelp';
export type { HeadingWithHelpProps } from './shared/HeadingWithHelp';
export { LabelWithHelp } from './shared/LabelWithHelp';
export type { LabelWithHelpProps } from './shared/LabelWithHelp';
export { renderRichText } from './shared/renderRichText';

// sections
export { ServiceSwitchSection } from './sections/ServiceSwitchSection';
export type { ServiceSwitchSectionProps } from './sections/ServiceSwitchSection';
export { TaskConfigSection } from './sections/TaskConfigSection';
export type { TaskConfigSectionProps } from './sections/TaskConfigSection';
export { WebSearchSection } from './sections/WebSearchSection';
export type { WebSearchSectionProps } from './sections/WebSearchSection';
export { WebFetchSection } from './sections/WebFetchSection';
export type { WebFetchSectionProps } from './sections/WebFetchSection';
export { ImageUnderstandSection } from './sections/ImageUnderstandSection';
export type { ImageUnderstandSectionProps } from './sections/ImageUnderstandSection';
export { VectorDbSection } from './sections/VectorDbSection';
export type { VectorDbSectionProps } from './sections/VectorDbSection';
export { VoiceRecognitionSection } from './sections/VoiceRecognitionSection';
export type { VoiceRecognitionSectionProps } from './sections/VoiceRecognitionSection';
export { DocumentExtractSection } from './sections/DocumentExtractSection';
export type { DocumentExtractSectionProps } from './sections/DocumentExtractSection';
export { MemorySettingsSection } from './sections/MemorySettingsSection';
export type { MemorySettingsSectionProps } from './sections/MemorySettingsSection';
export { MemeSettingsSection } from './sections/MemeSettingsSection';
export type { MemeSettingsSectionProps } from './sections/MemeSettingsSection';
export { AdvancedSettingsSection } from './sections/AdvancedSettingsSection';
export type { AdvancedSettingsSectionProps } from './sections/AdvancedSettingsSection';
export { RelationshipSettingsSection } from './sections/RelationshipSettingsSection';
export type { RelationshipSettingsSectionProps } from './sections/RelationshipSettingsSection';
export { AgentKitsSettingsSection } from './sections/AgentKitsSettingsSection';
export type { AgentKitsSettingsSectionProps } from './sections/AgentKitsSettingsSection';
export { CognitionSettingsSection } from './sections/CognitionSettingsSection';
export type { CognitionSettingsSectionProps } from './sections/CognitionSettingsSection';
export { GsCoreAiMcpServerSection } from './sections/GsCoreAiMcpServerSection';
export type { GsCoreAiMcpServerSectionProps } from './sections/GsCoreAiMcpServerSection';
export { CommandExecutorSection } from './sections/CommandExecutorSection';
export type { CommandExecutorSectionProps } from './sections/CommandExecutorSection';

// dialogs
export { ManageConfigDialog } from './dialogs/ManageConfigDialog';
export type { ManageConfigDialogProps } from './dialogs/ManageConfigDialog';
export { CreateConfigDialog } from './dialogs/CreateConfigDialog';
export type { CreateConfigDialogProps } from './dialogs/CreateConfigDialog';
export { EditConfigDialog } from './dialogs/EditConfigDialog';
export type { EditConfigDialogProps } from './dialogs/EditConfigDialog';
export { DeleteConfigDialog } from './dialogs/DeleteConfigDialog';
export type { DeleteConfigDialogProps } from './dialogs/DeleteConfigDialog';
export { McpToolDialog } from './dialogs/McpToolDialog';
export type { McpToolDialogProps, McpToolInfo } from './dialogs/McpToolDialog';
export { EmbeddingWarningDialog } from './dialogs/EmbeddingWarningDialog';
export type { EmbeddingWarningDialogProps } from './dialogs/EmbeddingWarningDialog';
export { AIServiceSwitchDialog } from './dialogs/AIServiceSwitchDialog';
export type { AIServiceSwitchDialogProps } from './dialogs/AIServiceSwitchDialog';
export { WizardDialog } from './dialogs/WizardDialog';
export type { WizardDialogProps } from './dialogs/WizardDialog';

// hooks
export * from './hooks';

// types & constants
export type { LocalFrameworkConfig, ConfigFileItem, ProviderType } from './types';
export {
  getModelCapabilities,
  getEmbeddingModalities,
  getEnumLabel,
  getModelEffortLabel,
  getUsageStatsModeLabel,
  getRequestMethodLabel,
  getRequestMethodDescription,
  type ModelCapability,
  type EmbeddingConfigField,
  type EmbeddingProvider,
} from './constants.tsx';
