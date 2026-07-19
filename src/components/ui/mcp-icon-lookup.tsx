import { Server } from 'lucide-react';

/**
 * /mcp-config 页面用图标占位组件
 * ============================================================================
 * 历史变更：
 *   1. 旧版用 `import.meta.glob` 扫整个 `@thesvg/react/dist/`（6,400+ 图标），
 *      每个图标 Rollup 切一块 → dist ≈ 51MB。
 *   2. 中期改成 200+ 白名单命名 import + Vite plugin 把 `default / light / dark /
 *      color / wordmark` 等 variant 砍到只剩 `mono`，dist 砍到 4.4MB，icons
 *      chunk ≈ 380KB。
 *   3. **当前版**：业务上决定 /mcp-config 不展示具体厂商的 brand icon 了——
 *      一律用 lucide-react 的 `<Server />` 占位。这样所有图标 import 都可以
 *      从这里删掉，bundle 里不再有 `thesvg-icons` 这个 chunk。MCP 官方
 *      Logo (`McpModelContextProtocol`) 也不再需要。
 *
 *    API 完全保留（AutoBrandIcon / resolveIconSlug 仍导出），方便别处 import
 *    不报错；也保留了 `AutoBrandIconProps` 形状，方便以后想加回品牌图标时
 *    `git revert` 就能恢复。
 *
 * 主题适配：lucide 的 `Server` 图标默认继承 currentColor，跟随父级文字色，
 * 主题切换自动适配。
 * ============================================================================
 */

/**
 * 历史保留：旧版的命中算法（精确 / 剥后缀 / 前缀 / 子串）现在没有任何可见
 * 副作用，但保留以备后续需要重新启用时方便复用。
 *
 * 命中顺序（命中即返回）：
 *   1. 整串 / 拆出的 token 精确匹配；
 *   2. 剥常见后缀（`xxx-mcp` -> `xxx`）后再精确匹配；
 *   3. 前缀匹配（输入是某 slug 的前缀，或某 slug 是输入的前缀）；
 *   4. 子串匹配（输入里包含某 slug）；
 *   5. 返回 null（走兜底）。
 */
function matchSlug(_rawInput: string): string | null {
  // 现在直接返回 null → 永远走 lucide Server 占位，不再做品牌匹配。
  return null;
}

/**
 * 历史保留：手动「标题 → slug」特殊映射（auto 兜不住的小表）。
 * 现在也是空壳，不会触发。所有兜底落到 lucide Server。
 */
const MANUAL_RULES: Array<{ keywords: string[]; slug: string }> = [
  // 想重新启用品牌匹配时，把白名单（slug → Component）重新 import 进来，
  // 这里把需要的兜底规则补回来即可。
];

/**
 * 主入口：解析输入 → slug。**当前永远返回 null**，调用方走 lucide Server
 * 占位。保留该函数以便旧 import site 不报错。
 */
export function resolveIconSlug(rawInput: string): string | null {
  // 即便有 MANUAL_RULES 也跑一下，免得未来打开开关时漏匹配。
  const haystack = (rawInput ?? '').toLowerCase();
  for (const rule of MANUAL_RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) {
      return rule.slug;
    }
  }
  return matchSlug(rawInput);
}

// ============================================================================
// 4. React 组件：根据 hints 渲染图标占位
// ============================================================================

export interface AutoBrandIconProps {
  /** 传入的提示文本（用于匹配图标）。当前不使用，但保留以免破坏调用方。 */
  hints?: Array<string | undefined | null>;
  className?: string;
  /** 自定义兜底图标。当前不生效（统一 lucide Server），保留字段。 */
  fallback?: unknown;
}

/**
 * 渲染一个 lucide-react 的 `<Server />` 作为 /mcp-config 的品牌图标占位。
 *
 * - 当前实现完全静态（无 useEffect / setState），渲染开销 ≈ 0；
 * - 字体 / 主题跟随父级 currentColor 与 Tailwind color utilities；
 * - 想加回品牌匹配时，只需 git revert 当前文件即可（白名单已经在 git log 里）。
 */
export function AutoBrandIcon({
  // 解构但不引用，避免 lint 警告
  hints: _hints,
  className,
  fallback: _fallback,
}: AutoBrandIconProps) {
  return (
    <Server
      className={['inline-block shrink-0', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    />
  );
}
