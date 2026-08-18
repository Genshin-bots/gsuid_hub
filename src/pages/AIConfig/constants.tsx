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

// ============================================================================
// 枚举选项的本地化标签
//
// 后端枚举值（`incremental` / `cumulative` 等）是技术字符串，落库 / 网络
// 传输都保持原样；UI 为了让不同语言使用者都能看懂，把它映射成本地化标签。
// 约定：
//   • `keyPrefix`：i18n key 前缀，例如 `aiConfig.serviceProvider.usageStatsModeOptions`
//   • 期望 i18n 文件中在该前缀下挂一个对象，键是枚举原文，值是对应语言的标签
//   • 找不到翻译时回落到原文本身，避免显示空白
// ============================================================================

/**
 * 在给定的 i18n 前缀下查找枚举值的本地化标签。找不到则返回原值。
 *
 * 实现思路：调用 `t(prefix.raw)`；现有 i18n 实现里 key 缺失时会原样把
 * key 字符串返回（见 `LanguageContext` 的 `defaultT`），用这个特征即可
 * 判定是否命中翻译。判断全程不依赖任何 i18n 库内部 API。
 */
export const getEnumLabel = (
  t: (key: string) => string,
  keyPrefix: string,
  raw: string,
): string => {
  const key = `${keyPrefix}.${raw}`;
  const translated = t(key);
  // t() 找不到 key 时返回 key 自身；这时回落原文
  return translated === key ? raw : translated;
};

/** `model_effort`：`enable / disable / minimal / low / medium / high / xhigh` */
export const getModelEffortLabel = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.modelEffortOptions', raw);

/** `usage_stats_mode`：`auto / incremental / cumulative` */
export const getUsageStatsModeLabel = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.usageStatsModeOptions', raw);

/** `request_method`：`chat_completions / responses` */
export const getRequestMethodLabel = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.requestMethodOptions', raw);

/** `remote_web_search`：`off / on` */
export const getRemoteWebSearchLabel = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.remoteWebSearchOptions', raw);

/** `send_back_thinking`：`auto / off`（思考回传） */
export const getSendBackThinkingLabel = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.sendBackThinkingOptions', raw);

/** `forward_end_user_id`：`off / hashed / raw`（终端用户标识透传） */
export const getForwardEndUserIdLabel = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.forwardEndUserIdOptions', raw);

/**
 * `request_method` 每个端点的端点级描述。用于在「编辑/新建」对话框下显示一行
 * 说明：当用户切换选项时，下方说明文字会跟着变。原始 `raw` 落库不变。
 *
 * 与 `getRequestMethodLabel` 不同，这里的 i18n value 是长句说明，不是简短标签。
 */
export const getRequestMethodDescription = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.requestMethodDescription', raw);

/** `remote_web_search` 开关说明：默认 on；只对 Responses 生效，Chat 永远本地。 */
export const getRemoteWebSearchDescription = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.remoteWebSearchDescription', raw);

/**
 * `forward_end_user_id` 每个模式的说明。三种模式的隐私与可观测性权衡差别很大
 * （raw 会把原始标识发到上游），必须逐项说明，写法同 `getRequestMethodDescription`。
 */
export const getForwardEndUserIdDescription = (
  t: (key: string) => string,
  raw: string,
): string =>
  getEnumLabel(t, 'aiConfig.serviceProvider.forwardEndUserIdDescription', raw);
