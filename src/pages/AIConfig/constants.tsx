import {
  Cpu,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';

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
 *
 * `icon` 是已实例化的 React 节点（`ReactNode`），方便直接喂给 `ChipGroup`。
 * 之前是 `LucideIcon`（组件引用），调用方需用 `<Icon />` 实例化；现在改为 JSX，
 * 保持工厂函数与组件渲染解耦。
 */
export interface ModelCapability {
  value: 'text' | 'image' | 'audio' | 'video' | string;
  label: string;
  icon: ReactNode;
}

/**
 * 构建模型能力选项的工厂函数。
 * 由于 label 来自 i18n，所以定义为函数，每次根据 t 重新生成。
 */
export const getModelCapabilities = (
  t: (key: string) => string,
): ModelCapability[] => [
  {
    value: 'text',
    label: t('aiConfig.serviceProvider.capabilityText'),
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  {
    value: 'image',
    label: t('aiConfig.serviceProvider.capabilityImage'),
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  {
    value: 'audio',
    label: t('aiConfig.serviceProvider.capabilityAudio'),
    icon: <Cpu className="w-3.5 h-3.5" />,
  },
  {
    value: 'video',
    label: t('aiConfig.serviceProvider.capabilityVideo'),
    icon: <Zap className="w-3.5 h-3.5" />,
  },
];

/**
 * 构建嵌入模型支持的模态选项的工厂函数。
 * 与 `getModelCapabilities` 对称；用于 OpenAI 嵌入模型配置中的 `embedding_modalities` 字段。
 */
export const getEmbeddingModalities = (
  t: (key: string) => string,
): ModelCapability[] => [
  {
    value: 'text',
    label: t('aiConfig.vectorDb.embeddingModalityText'),
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  {
    value: 'image',
    label: t('aiConfig.vectorDb.embeddingModalityImage'),
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  {
    value: 'audio',
    label: t('aiConfig.vectorDb.embeddingModalityAudio'),
    icon: <Cpu className="w-3.5 h-3.5" />,
  },
  {
    value: 'video',
    label: t('aiConfig.vectorDb.embeddingModalityVideo'),
    icon: <Zap className="w-3.5 h-3.5" />,
  },
];
