import {
  Openai,
  Anthropic,
  Gemini,
  Sensenova,
  Longcat,
  Minimax,
  XiaomiMimo,
  Antgroup,
  Qwen,
  Doubao,
  Kimi,
  Hunyuan,
  Deepseek,
  Baidu,
  Claude,
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
 *   但底层调用的是第三方厂商的模型（LongCat / SenseNova / MiniMax 等），
 *   此时用模型名匹配能拿到更准确的厂商 Logo。
 * - **主题适配**：所有厂商图标的 `default` 变体几乎都有硬编码白色填充，
 *   强行放在浅色背景的按钮 / Badge 上会「看不见」。本组件统一根据主题
 *   选择 *light / mono / default* 三种变体：
 *     - OpenAI：使用 `light`（path 不带 fill，继承 currentColor）
 *     - Anthropic / Claude：使用 `mono`（继承 currentColor）
 *     - Gemini：保持 `default`（官方彩版，主题无关）
 *     - 其余国产厂商：暂未深究，按 `light`/`mono` 处理，主题出错再说
 * - **回退**：找不到匹配厂商时回退到 lucide 的 `Bot` 图标，主题完全可控。
 *
 * 添加新的厂商识别时，只需要在 `BRAND_RULES` 里加一条 `{ pattern, Component }` 即可。
 */

export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | string;

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface BrandRule {
  /** 用于匹配模型名（不区分大小写）的子串/正则 */
  pattern: string | RegExp;
  /** 命中后使用的 @thesvg/react 组件名 */
  Component: IconComponent;
  /**
   * 该厂商图标用哪个 variant：
   * - `light` / `mono`：path 使用 currentColor，主题可控
   * - `default`：主题无关（彩版 / 硬编码白色），适合放深色背景上
   */
  variant?: 'light' | 'mono' | 'default';
}

/**
 * 命中顺序：数组前面的规则优先匹配。
 * `pattern` 是字符串时按 `includes` 比较；是正则时按 `test` 比较。
 */
const BRAND_RULES: BrandRule[] = [
  // ----- Anthropic / Claude -----
  { pattern: /(^|[\-_./])(claude|anthropic)/i, Component: Claude, variant: 'mono' },
  // ----- OpenAI -----
  { pattern: /(^|[\-_./])(gpt|openai|o1|o3|o4|chatgpt|sora|dall[\-_ ]?e|whisper)/i, Component: Openai, variant: 'light' },
  // ----- Google Gemini -----
  { pattern: /(^|[\-_./])gemini/i, Component: Gemini, variant: 'default' },
  // ----- DeepSeek -----
  { pattern: /deepseek/i, Component: Deepseek, variant: 'light' },
  // ----- 商汤 SenseNova / SenseChat -----
  { pattern: /sensenova|sensechat|sense[\-_ ]?(nova|chat)/i, Component: Sensenova, variant: 'light' },
  // ----- 美团 LongCat -----
  { pattern: /longcat/i, Component: Longcat, variant: 'light' },
  // ----- MiniMax -----
  { pattern: /minimax/i, Component: Minimax, variant: 'light' },
  // ----- 小米 MiMo -----
  { pattern: /mimo/i, Component: XiaomiMimo, variant: 'light' },
  // ----- 阿里 Qwen / 通义千问 / QwQ -----
  { pattern: /qwen|tongyi|qwq/i, Component: Qwen, variant: 'light' },
  // ----- 字节 Doubao / 豆包 -----
  { pattern: /doubao|[\-_ ]?豆包/i, Component: Doubao, variant: 'light' },
  // ----- Moonshot Kimi -----
  { pattern: /kimi|moonshot/i, Component: Kimi, variant: 'light' },
  // ----- 腾讯 Hunyuan / 混元 -----
  { pattern: /hunyuan|混元/i, Component: Hunyuan, variant: 'light' },
  // ----- 百度 文心一言 / ERNIE -----
  { pattern: /ernie|wenxin|baidu/i, Component: Baidu, variant: 'light' },
  // ----- 蚂蚁集团 Ling / inclusionAI -----
  { pattern: /(^|[\-_./])ling|inclusionai|inclusion[\-_ ]?ai/i, Component: Antgroup, variant: 'light' },
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
export function ModelBrandIcon({
  modelName,
  provider,
  size = 16,
  className,
}: ModelBrandIconProps) {
  const rule = resolveBrandRule(modelName, provider);
  const Icon = rule.Component;

  // Openai 在 light 变体下没有外层 fill，由 currentColor 驱动；
  // 其余厂商图标内部 path 一般也不带 fill，主题继承父级 color。
  // 只在确实没颜色继承时（少见）给一个 text-muted-foreground 兜底。
  return (
    <Icon
      width={size}
      height={size}
      variant={rule.variant}
      className={cn('inline-block shrink-0', className)}
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
      return { pattern: /^anthropic$/, Component: Anthropic, variant: 'mono' };
    case 'gemini':
      return { pattern: /^gemini$/, Component: Gemini, variant: 'default' };
    case 'openai':
    default:
      return { pattern: /^openai$/, Component: Openai, variant: 'light' };
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
 * 主题适配：
 * - OpenAI → `light`（currentColor）
 * - Anthropic → `mono`（currentColor）
 * - Gemini → `default`（官方彩版，主题无关）
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
          variant="mono"
          className={cn('inline-block shrink-0', className)}
          aria-hidden="true"
        />
      );
    case 'gemini':
      return (
        <Gemini
          width={size}
          height={size}
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
          variant="light"
          className={cn('inline-block shrink-0', className)}
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