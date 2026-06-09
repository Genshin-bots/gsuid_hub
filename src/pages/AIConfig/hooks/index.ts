/**
 * AIConfig 模块的 hooks 桶导出。
 *
 * 这些 hooks 都被 [`src/pages/AIConfigPage.tsx`](src/pages/AIConfigPage.tsx) 调用，
 * 把原本集中在一个组件里的「状态 + 副作用」按领域拆开。
 */
export { useFrameworkConfig } from './useFrameworkConfig';
export type { UseFrameworkConfigReturn } from './useFrameworkConfig';

export { useProviderConfig } from './useProviderConfig';
export type { UseProviderConfigReturn } from './useProviderConfig';

export { useEmbeddingConfig } from './useEmbeddingConfig';
export type {
  UseEmbeddingConfigReturn,
  EmbeddingFieldMap,
} from './useEmbeddingConfig';

export { useMcpToolsConfig } from './useMcpToolsConfig';
export type {
  UseMcpToolsConfigArgs,
  UseMcpToolsConfigReturn,
} from './useMcpToolsConfig';

export { useAIWizard } from './useAIWizard';
export type {
  UseAIWizardReturn,
  WizardOverallStatus,
} from './useAIWizard';

export { useAIServiceSwitch } from './useAIServiceSwitch';
export type {
  UseAIServiceSwitchArgs,
  UseAIServiceSwitchReturn,
} from './useAIServiceSwitch';
