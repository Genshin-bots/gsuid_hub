import {
  Cpu,
  MessageSquare,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * 本地类型与常量定义文件
 *
 * 此处只放置不依赖 React props/state 的纯常量与工厂函数。
 * 其它类型请参考 `./types.ts`。
 */

/**
 * 嵌入模型字段定义（动态 schema）。
 * 与后端 `EmbeddingConfigField` 保持一致；这里只取前端渲染需要的字段。
 */
export interface EmbeddingConfigField {
  title?: string;
  desc?: string;
  options?: string[];
  data?: unknown;
}

/**
 * 嵌入式模型提供方 - local / openai 兼容。
 */
export type EmbeddingProvider = 'local' | 'openai' | string;

/**
 * 模型能力（用于在「创建 / 编辑配置」弹窗中让用户多选）
 */
export interface ModelCapability {
  value: 'text' | 'image' | 'audio' | 'video' | string;
  label: string;
  icon: LucideIcon;
}

/**
 * 构建模型能力选项的工厂函数。
 * 由于 label 来自 i18n，所以定义为函数，每次根据 t 重新生成。
 */
export const getModelCapabilities = (
  t: (key: string) => string,
): ModelCapability[] => [
  { value: 'text', label: t('aiConfig.serviceProvider.capabilityText'), icon: MessageSquare },
  { value: 'image', label: t('aiConfig.serviceProvider.capabilityImage'), icon: Sparkles },
  { value: 'audio', label: t('aiConfig.serviceProvider.capabilityAudio'), icon: Cpu },
  { value: 'video', label: t('aiConfig.serviceProvider.capabilityVideo'), icon: Zap },
];
