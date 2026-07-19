import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from 'react';
import { McpModelContextProtocol } from '@thesvg/react';

/**
 * 自动从 `@thesvg/react` 库里搜索与标题匹配的图标。
 *
 * 设计动机
 * --------
 * MCP 接入的厂商几百个，手写规则表（MCP_BRAND_RULES）很快就会维护不住。
 * 这个模块走「**先按标题在图标库里查，没找到再回退到手动规则**」的双层策略：
 *
 * 1. **自动层**：用 Vite 的 `import.meta.glob` 把 `@thesvg/react` 整个 dist 目录
 *    扫描成一张 `slug -> () => Promise<Module>` 的懒加载表。运行时拿到「GitLab」/
 *    「Sentry」这样的标题，就走模糊匹配在表里找对应的 `gitlab` / `sentry`。
 * 2. **手动层**：少数「标题 -> slug」不是 1:1 的特殊映射（例如 `Email` 库里没图标，
 *    但有 Gmail），继续用 MCP_BRAND_RULES 这种小表兜底。
 * 3. **最终兜底**：两者都没命中 → 用 MCP 官方 Logo（McpModelContextProtocol）。
 *
 * 主题适配
 * --------
 * 优先尝试 `variant="mono"`（绝大多数图标都支持、currentColor 主题可控）。
 * `mono` 不存在的图标会在 @thesvg/react 内部自动回落 `default`（其内部实现：
 *   `const _v = _variants[variant] || _variants.default;`），所以一律传 `mono`
 *   不会崩，最多展示官方彩版。
 */

// ============================================================================
// 1. 用 import.meta.glob 懒加载整个图标库
// ============================================================================

/**
 * 每个模块的形状（与 @thesvg/react 包内单个图标模块一致）：
 *   export default forwardRef(function Foo({ variant, ... }, ref) { ... });
 */
type IconModuleShape = {
  default: ComponentType<SVGProps<SVGSVGElement> & { variant?: string }>;
};

/**
 * Vite 在构建时扫描 `@thesvg/react/dist/*.js`，得到 `{ slug: () => Promise<Module> }`。
 * 这是一个**懒加载表**，bundle 不会实际包含任何图标代码；只有当 `loader()` 被调用
 * 时，Vite 才会把对应 chunk 拉进来。
 */
const ICON_LOADERS: Record<string, () => Promise<IconModuleShape>> = (() => {
  // `import.meta.glob` 在 Vite 编译时执行，返回值是静态对象。
  // 用相对路径规避「包名 glob」的兼容性差异（不同 Vite 版本行为不一致）。
  // 路径相对当前文件 src/components/ui/mcp-icon-lookup.tsx 计算：
  //   ../      = src/components/
  //   ../../   = src/
  //   ../../../= 仓库根（node_modules 所在）
  // @ts-expect-error import.meta.glob 是 Vite 编译时 API，类型由 vite/client 提供
  const mod = import.meta.glob<IconModuleShape>(
    '../../../node_modules/@thesvg/react/dist/*.js',
  );
  // 把绝对路径压平成 `slug -> loader`，方便后续按 slug 查找。
  const out: Record<string, () => Promise<IconModuleShape>> = {};
  for (const [absPath, loader] of Object.entries(mod)) {
    const m = absPath.match(/\/([^/]+)\.js$/);
    if (m) out[m[1]] = loader as () => Promise<IconModuleShape>;
  }
  return out;
})();

/** 所有可用的图标 slug 集合（key 为小写）。 */
const AVAILABLE_SLUGS: ReadonlySet<string> = new Set(Object.keys(ICON_LOADERS));

/**
 * 已加载的图标组件缓存：slug -> React Component。
 * 同一个 slug 只 import 一次，第二次直接命中缓存。
 */
const COMPONENT_CACHE: Map<string, ComponentType<SVGProps<SVGSVGElement> & { variant?: string }>> =
  new Map();

async function loadIconComponent(
  slug: string,
): Promise<ComponentType<SVGProps<SVGSVGElement> & { variant?: string }> | null> {
  const cached = COMPONENT_CACHE.get(slug);
  if (cached) return cached;
  const loader = ICON_LOADERS[slug];
  if (!loader) return null;
  const mod = await loader();
  const Comp = mod.default;
  if (Comp) COMPONENT_CACHE.set(slug, Comp);
  return Comp ?? null;
}

// ============================================================================
// 2. 标题 -> slug 的模糊匹配算法
// ============================================================================

/**
 * 把任意输入字符串标准化成「可匹配的查询字符串」。
 * 规则：
 * - 转小写、去首尾空格；
 * - 拆分括号里的副标题（如 "Email (SMTP/IMAP)" -> "email smtp imap"）。
 */
function normalizeQuery(input: string): string[] {
  if (!input) return [];
  const stripped = input
    .toLowerCase()
    .replace(/[()\[\]{}]/g, ' ') // 括号 -> 空格
    .replace(/[\s\-_./\\,:]+/g, ' ') // 各种分隔符 -> 空格
    .trim();
  if (!stripped) return [];
  // 同时返回整体 + 每个 token；整体优先
  const tokens = stripped.split(/\s+/).filter(Boolean);
  return Array.from(new Set([stripped, ...tokens]));
}

/** 常见要剥掉的后缀（用于剥离 `xxx-mcp` / `xxx-search` 之类的） */
const STRIPPABLE_SUFFIXES = [
  'mcp',
  'search',
  'server',
  'integration',
  'service',
  'api',
  'tool',
  'tools',
  'client',
  'sdk',
  'app',
  'plugin',
  'extension',
];

function tryExact(candidates: string[]): string | null {
  for (const c of candidates) {
    if (AVAILABLE_SLUGS.has(c)) return c;
  }
  return null;
}

function tryStripSuffix(token: string): string | null {
  if (!token) return null;
  // 一次只剥一个后缀，递归剥两次
  for (const suf of STRIPPABLE_SUFFIXES) {
    if (token === suf) continue;
    if (token.endsWith(`-${suf}`)) {
      const stem = token.slice(0, -suf.length - 1);
      if (AVAILABLE_SLUGS.has(stem)) return stem;
    }
    if (token.endsWith(suf) && token.length > suf.length) {
      const stem = token.slice(0, -suf.length);
      if (AVAILABLE_SLUGS.has(stem)) return stem;
    }
  }
  return null;
}

function tryPrefixMatch(candidates: string[]): string | null {
  // 在所有候选里找：存在某个 slug 是候选的前缀，且尽量长
  let best: string | null = null;
  let bestLen = 0;
  for (const c of candidates) {
    if (c.length < 3) continue;
    for (const slug of AVAILABLE_SLUGS) {
      if (slug.length < 3) continue;
      if (c.startsWith(slug) && slug.length > bestLen) {
        best = slug;
        bestLen = slug.length;
      }
      // 反向：slug 以 c 开头（更宽松）
      if (slug.startsWith(c) && c.length > bestLen) {
        best = slug;
        bestLen = c.length;
      }
    }
  }
  return best;
}

/**
 * 判断 `needle` 在 `haystack` 中出现的位置，前后是否是「非字母字符」或字符串边界。
 * 用来防止 `"known"` 命中 `"RandomUnknownVendor"` 这种子串误报：
 * "known" 在 "unknown" 中前后都贴着字母 (Un-Known-d)，属于词内匹配，应该拒绝。
 */
function hasWordBoundaryMatch(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return false;
    const before = idx === 0 ? '' : haystack[idx - 1];
    const after =
      idx + needle.length === haystack.length
        ? ''
        : haystack[idx + needle.length];
    const isBoundaryBefore = before === '' || !/[a-z0-9]/i.test(before);
    const isBoundaryAfter = after === '' || !/[a-z0-9]/i.test(after);
    if (isBoundaryBefore && isBoundaryAfter) return true;
    from = idx + 1;
  }
  return false;
}

function trySubstring(candidates: string[]): string | null {
  // 候选中包含某个 slug（取最长的，且 slug 长度 >= 3 避免噪音）。
  // 同时要求 slug 在候选中出现在「词边界」上，防止子串误报。
  let best: string | null = null;
  let bestLen = 0;
  for (const c of candidates) {
    if (c.length < 3) continue;
    for (const slug of AVAILABLE_SLUGS) {
      if (slug.length < 3) continue;
      if (c.includes(slug) && slug.length > bestLen) {
        // 同时要求前后是词边界，否则继续往下找更长的
        if (hasWordBoundaryMatch(c, slug)) {
          best = slug;
          bestLen = slug.length;
        }
      }
    }
  }
  return best;
}

/**
 * 给定任意输入字符串，匹配出最可能的图标 slug。
 *
 * 匹配顺序（命中即返回）：
 *   1. 整串 / 拆出的 token 精确匹配；
 *   2. 剥常见后缀（`xxx-mcp` -> `xxx`）后再精确匹配；
 *   3. 前缀匹配（输入是某 slug 的前缀，或某 slug 是输入的前缀）；
 *   4. 子串匹配（输入里包含某 slug）；
 *   5. 返回 null（走兜底）。
 */
function matchSlug(rawInput: string): string | null {
  const candidates = normalizeQuery(rawInput);
  if (candidates.length === 0) return null;

  // 1. 精确匹配（含整串）
  const exact = tryExact(candidates);
  if (exact) return exact;

  // 2. 剥后缀后再精确匹配（每个 token 都试一次）
  for (const c of candidates) {
    const stripped = tryStripSuffix(c);
    if (stripped) return stripped;
  }

  // 3. 前缀匹配
  const prefix = tryPrefixMatch(candidates);
  if (prefix) return prefix;

  // 4. 子串匹配（兜底，最宽松）
  const sub = trySubstring(candidates);
  if (sub) return sub;

  return null;
}

// ============================================================================
// 3. 手动「标题 → slug」特殊映射（auto 兜不住的小表）
// ============================================================================

/**
 * 关键词命中即返回指定 slug。例如：
 * - 「Email (SMTP/IMAP)」标题里没有「gmail」字面量，
 *   但这类协议实际最常对接 Gmail，所以手动指定 slug=gmail。
 */
const MANUAL_RULES: Array<{ keywords: string[]; slug: string }> = [
  { keywords: ['email', 'gmail', 'smtp', 'imap'], slug: 'gmail' },
  // 其他兜不住的例子以后在这里追加
];

function matchWithManual(rawInput: string): string | null {
  const haystack = rawInput.toLowerCase();
  for (const rule of MANUAL_RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) {
      if (AVAILABLE_SLUGS.has(rule.slug)) return rule.slug;
    }
  }
  return null;
}

/**
 * 主入口：给定任意标题，返回最佳匹配的图标 slug。
 * 顺序：手动规则 → 自动匹配。
 */
export function resolveIconSlug(rawInput: string): string | null {
  return matchWithManual(rawInput) ?? matchSlug(rawInput);
}

// ============================================================================
// 4. React 组件：根据标题自动加载并渲染图标
// ============================================================================

export interface AutoBrandIconProps {
  /**
   * 用于匹配的标题。可以传：
   * - 显示名（如 "GitLab"、"Sentry"）
   * - 命令（"uvx gitlab-mcp"）
   * - URL
   * 多个值会拼起来一起匹配。
   */
  hints: Array<string | undefined | null>;
  className?: string;
  /** 找不到时的兜底图标（不传则用 MCP 官方 Logo）。 */
  fallback?: ComponentType<SVGProps<SVGSVGElement> & { variant?: string }>;
}

/**
 * 自动从 `@thesvg/react` 库中查图标并渲染。
 *
 * - 首次渲染时占位（兜底图标），加载完后无缝替换为目标厂商图标。
 * - 每个 slug 只 import 一次（内部缓存），后续同一 slug 不再触发网络/打包请求。
 */
export function AutoBrandIcon({
  hints,
  className,
  fallback,
}: AutoBrandIconProps) {
  const query = useMemo(
    () => hints.filter((s): s is string => !!s && s.trim().length > 0).join(' '),
    [hints],
  );

  const slug = useMemo(() => (query ? resolveIconSlug(query) : null), [query]);

  const [Icon, setIcon] = useState<
    ComponentType<SVGProps<SVGSVGElement> & { variant?: string }> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setIcon(null);
      return;
    }
    loadIconComponent(slug).then((Comp) => {
      if (!cancelled) setIcon(() => Comp);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 加载中 / 没命中：兜底
  if (!Icon) {
    const Fallback = fallback ?? (McpModelContextProtocol as ComponentType<SVGProps<SVGSVGElement> & { variant?: string }>);
    return <Fallback variant="mono" className={className} aria-hidden="true" />;
  }

  // 命中：渲染实际图标。一律传 mono，不支持的图标内部会回落 default（彩版）。
  return <Icon variant="mono" className={className} aria-hidden="true" />;
}