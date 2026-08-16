import {
  Openai,
  Anthropic,
  Gemini,
  Sensenova,
  Longcat,
  Minimax,
  JinaAi,
  XiaomiMimo,
  Antgroup,
  Qwen,
  Doubao,
  Kimi,
  Hunyuan,
  Deepseek,
  Baidu,
  Claude,
  Yi,
  Baichuan,
  Cohere,
  Mistral,
  HuggingFace,
  Replicate,
  Groq,
  GrokXai,
  Pytorch,
  Tensorflow,
  Keras,
  Pandas,
  Numpy,
  Zhipu,
  Kuaishou,
  Wenxin,
  Cogvideo,
  Cogview,
  Tencent,
  Huawei,
  Huaweicloud,
} from '@thesvg/react';
import { Bot } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * 模型 / 厂商 品牌 ICON 解析器
 *
 * 设计要点
 * --------
 * - **优先级**：以「模型名」匹配为主，「provider」匹配为兜底。
 *   因为很多 config 的 provider 是 `openai`（OpenAI 兼容格式），
 *   但底层调用的是第三方厂商的模型（LongCat / SenseNova / MiniMax / 日日新 / Yi / Baichuan...），
 *   此时用模型名匹配能拿到更准确的厂商 Logo。
 * - **统一官方彩版**：多数厂商图标使用 `default` variant（官方彩色 Logo）。
 *   **OpenAI 例外**：官方 path 硬编码白标；渲染时强制 `path` 走 currentColor，
 *   颜色跟父级文字走（Badge / 按钮里即与文案同色，不再写死黑白）。
 * - **回退**：找不到匹配厂商时回退到 lucide 的 `Bot` 图标。
 *
 * 添加新的厂商识别时，只需要在 `BRAND_RULES` 里加一条 `{ pattern, Component }` 即可。
 *
 * 注意：因为 `/mcp-config` 不再展示品牌图标（见 `mcp-icon-lookup.tsx`），本文件
 * 是**唯一**还会从 `@thesvg/react` 拉厂商图标的入口；`/ai-config` 必须是完整列表，
 * 包括 longcat、日日新、yi、baichuan、zhipu、huawei、kuaishou 等冷门厂商。
 */

export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | string;

// 各厂商 SVG 的 variant 联合类型互不相同（含 dark/wordmark/color…），
// 这里用宽松组件类型 + 渲染时透传 variant，避免 BrandRule 被 propTypes 拖垮。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = ComponentType<any>;

interface BrandRule {
  /** 用于匹配模型名（不区分大小写）的子串/正则 */
  pattern: string | RegExp;
  /** 命中后使用的 @thesvg/react 组件名 */
  Component: IconComponent;
  /**
   * 该厂商图标用哪个 variant。统一使用 `default`（官方彩版，主题无关）。
   * 保留该字段是为了 API 兼容；值恒为 `'default'`。
   */
  variant?: string;
}

/**
 * 命中顺序：数组前面的规则优先匹配。
 * `pattern` 是字符串时按 `includes` 比较；是正则时按 `test` 比较。
 *
 * 国产 / 亚洲厂商尽量排在前面；这样「yi」「baichuan」「zhipu」这些短关键词
 * 不会被「tencent」之类误吃掉。
 */
const BRAND_RULES: BrandRule[] = [
  // ----- Anthropic / Claude -----
  { pattern: /(^|[-_./])(claude|anthropic)/i, Component: Claude, variant: 'default' },
  // ----- OpenAI -----
  { pattern: /(^|[-_./])(gpt|openai|o1|o3|o4|chatgpt|sora|dall[-_ ]?e|whisper)/i, Component: Openai, variant: 'default' },
  // ----- Google Gemini -----
  { pattern: /(^|[-_./])gemini/i, Component: Gemini, variant: 'default' },

  // ====== 国产 / 中文厂商（冷门优先） ======
  // ----- 零一万物 Yi / 01.AI（注意别让下面 antgroup / ant 误吃） -----
  { pattern: /(^|[-_./])yi|01[-_.]?ai|zeroone[-_ ]?ai|wanzhi|万知/i, Component: Yi, variant: 'default' },
  // ----- 百川智能 Baichuan -----
  { pattern: /(^|[-_./])baichuan|百川/i, Component: Baichuan, variant: 'default' },
  // ----- 智谱 AI / ChatGLM -----
  { pattern: /zhipu|chatglm|智谱|glm-/i, Component: Zhipu, variant: 'default' },
  // ----- 商汤 SenseNova / 日日新 / SenseChat -----
  { pattern: /sensenova|sensechat|sense[-_ ]?(nova|chat)|日日新|商汤/i, Component: Sensenova, variant: 'default' },
  // ----- 美团 LongCat -----
  { pattern: /longcat/i, Component: Longcat, variant: 'default' },
  // ----- MiniMax -----
  { pattern: /minimax/i, Component: Minimax, variant: 'default' },
  // ----- Jina AI（嵌入 / Rerank / Reader） -----
  { pattern: /jina/i, Component: JinaAi, variant: 'default' },
  // ----- 小米 MiMo -----
  { pattern: /mimo/i, Component: XiaomiMimo, variant: 'default' },
  // ----- 阿里 Qwen / 通义千问 / QwQ -----
  { pattern: /qwen|tongyi|qwq/i, Component: Qwen, variant: 'default' },
  // ----- 字节 Doubao / 豆包 -----
  { pattern: /doubao|[-_ ]?豆包/i, Component: Doubao, variant: 'default' },
  // ----- Moonshot Kimi -----
  { pattern: /kimi|moonshot/i, Component: Kimi, variant: 'default' },
  // ----- 腾讯 Hunyuan / 混元 -----
  { pattern: /hunyuan|混元/i, Component: Hunyuan, variant: 'default' },
  // ----- 腾讯混元 / 通用 Tencent 占位（多数腾讯模型走 hunyuan；非混元的也兜底到 tencent 图标） -----
  { pattern: /tencent|腾讯/i, Component: Tencent, variant: 'default' },
  // ----- Huawei -----
  { pattern: /huawei(?!\.cloud)/i, Component: Huawei, variant: 'default' },
  { pattern: /pangu|盘古|huaweicloud/i, Component: Huaweicloud, variant: 'default' },
  // ----- 快手 KwaiYii -----
  { pattern: /kuaishou|kwaiyii|可灵|kling|快手/i, Component: Kuaishou, variant: 'default' },
  // ----- 智谱 CogView / CogVideo（图像 / 视频模型） -----
  { pattern: /cogvideo|cogview/i, Component: Cogvideo, variant: 'default' },
  // ----- 百度 文心一言 / ERNIE -----
  { pattern: /ernie|wenxin|baidu|文心/i, Component: Baidu, variant: 'default' },
  // ----- 蚂蚁集团 Ling / inclusionAI -----
  { pattern: /(^|[-_./])ling|inclusionai|inclusion[-_ ]?ai/i, Component: Antgroup, variant: 'default' },
  // ----- DeepSeek -----
  { pattern: /deepseek/i, Component: Deepseek, variant: 'default' },

  // ====== 海外厂商 ======
  // ----- xAI Grok -----
  { pattern: /(^|[-_./])(grok|xai)/i, Component: GrokXai, variant: 'default' },
  // ----- Mistral -----
  { pattern: /(^|[-_./])mistral|mixtral/i, Component: Mistral, variant: 'default' },
  // ----- Cohere -----
  { pattern: /(^|[-_./])(cohere|command[-_ ]?r)/i, Component: Cohere, variant: 'default' },
  // ----- Perplexity / Replicate / Hugging Face -----
  { pattern: /perplexity/i, Component: Cohere, variant: 'default' }, // perplexity 没专属图标，借 cohere 风格 placeholder
  { pattern: /hugging[-_ ]?face|hf[-_ ]?/i, Component: HuggingFace, variant: 'default' },
  { pattern: /replicate/i, Component: Replicate, variant: 'default' },
  // ----- Groq -----
  { pattern: /(^|[-_./])groq/i, Component: Groq, variant: 'default' },

  // ====== 框架 / 工具（有些「模型」实际是本地训练框架） ======
  { pattern: /pytorch|torch/i, Component: Pytorch, variant: 'default' },
  { pattern: /tensorflow|tf[-_ ]?(keras|lite|js)|tf2/i, Component: Tensorflow, variant: 'default' },
  { pattern: /keras/i, Component: Keras, variant: 'default' },
  { pattern: /(^|[-_./])pandas|pd[-_ ]?/i, Component: Pandas, variant: 'default' },
  { pattern: /numpy|np[-_ ]?/i, Component: Numpy, variant: 'default' },
];

export interface ModelBrandIconProps {
  /** 用于匹配品牌的模型名（例如 `sensenova-6.7-flash-lite`、`Ling-2.6-flash`） */
  modelName?: string | null;
  /** API 协议类型（`openai` / `anthropic` / `gemini`），在模型名匹配不上时作为兜底 */
  provider?: ProviderName | null;
  /** 图标尺寸（宽高相同），用于覆盖 className 的尺寸。默认 16。 */
  size?: number;
  /** 额外 className，会覆盖默认 `inline-block shrink-0`。 */
  className?: string;
}

/**
 * 根据 `modelName` + `provider` 自动匹配厂商并渲染对应的品牌 SVG 图标。
 *
 * @example
 *   <ModelBrandIcon modelName="sensenova-6.7-flash-lite" provider="openai" />
 *   <ModelBrandIcon modelName="Ling-2.6-flash" provider="openai" />
 *   <ModelBrandIcon modelName="claude-opus-4-6" provider="openai" />
 */
/**
 * OpenAI 官方 default path 硬编码 fill=#fff（白标）。
 * 强制 path 走 currentColor，颜色继承父级（与 Badge / 按钮文字一致）。
 */
const OPENAI_THEME_CLASS = '[&_path]:!fill-current';

function isOpenAiIcon(Component: IconComponent): boolean {
  return Component === Openai;
}

export function ModelBrandIcon({
  modelName,
  provider,
  size = 16,
  className,
}: ModelBrandIconProps) {
  const rule = resolveBrandRule(modelName, provider);
  const Icon = rule.Component;
  const openAiTheme = isOpenAiIcon(Icon);

  // 统一使用 `default`（官方彩版）；OpenAI 单色走 currentColor。
  // variant 为 thesvg 扩展 prop，各厂商联合类型不同，见上方 IconComponent 注释。
  return (
    <Icon
      width={size}
      height={size}
      variant={rule.variant ?? 'default'}
      className={cn(
        'inline-block shrink-0',
        openAiTheme && OPENAI_THEME_CLASS,
        className,
      )}
      aria-hidden="true"
    />
  );
}

/**
 * 对外暴露：只解析规则，不渲染。便于在其它组件里复用匹配结果。
 */
export function resolveBrandRule(
  modelName?: string | null,
  provider?: ProviderName | null,
): BrandRule {
  const haystack = `${modelName ?? ''}`.trim();
  if (haystack) {
    for (const rule of BRAND_RULES) {
      if (matches(rule.pattern, haystack)) return rule;
    }
  }
  // provider 兜底：直接把 `provider` 名映射到厂商图标，避免「Ling」模型用 OpenAI logo
  switch (provider) {
    case 'anthropic':
      return { pattern: /^anthropic$/, Component: Anthropic, variant: 'default' };
    case 'gemini':
      return { pattern: /^gemini$/, Component: Gemini, variant: 'default' };
    case 'openai':
    default:
      return { pattern: /^openai$/, Component: Openai, variant: 'default' };
  }
}

function matches(pattern: string | RegExp, value: string): boolean {
  if (typeof pattern === 'string') {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
  return pattern.test(value);
}

/**
 * Provider（API 协议）专用的品牌图标。
 *
 * 专门用于「provider 类型」开关按钮这种**只关心 API 协议**的场景，
 * 跟 ModelBrandIcon 的区别是它不会去匹配底层模型名。
 *
 * 统一使用 `default`（官方彩版），主题无关。
 */
export interface ProviderBrandIconProps {
  provider: ProviderName;
  size?: number;
  className?: string;
}

export function ProviderBrandIcon({
  provider,
  size = 16,
  className,
}: ProviderBrandIconProps) {
  switch (provider) {
    case 'anthropic':
      return (
        <Anthropic
          width={size}
          height={size}
          variant="default"
          className={cn('inline-block shrink-0', className)}
          aria-hidden="true"
        />
      );
    case 'gemini':
      return (
        <Gemini
          width={size}
          height={size}
          variant="default"
          className={cn('inline-block shrink-0', className)}
          aria-hidden="true"
        />
      );
    case 'openai':
    default:
      return (
        <Openai
          width={size}
          height={size}
          variant="default"
          className={cn(
            'inline-block shrink-0',
            OPENAI_THEME_CLASS,
            className,
          )}
          aria-hidden="true"
        />
      );
  }
}

/** Provider 解析失败时的兜底图标（lucide Bot，主题可控） */
export function FallbackBrandIcon({
  className,
}: {
  size?: number;
  className?: string;
}) {
  // 尺寸由调用方通过 className（如 `w-4 h-4`）控制，与 lucide 习惯保持一致
  return <Bot className={cn('inline-block shrink-0', className)} aria-hidden="true" />;
}
