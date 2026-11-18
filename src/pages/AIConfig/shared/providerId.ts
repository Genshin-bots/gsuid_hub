import type { LocalFrameworkConfig } from '../types';

/**
 * 网络搜索 / 网页抓取等多源配置的 provider id 比较。
 * 后端 options 多为 `Jina`/`local`，但大小写漂移时仍应视为同一源，
 * 避免主用禁用、备用剥离、save-time strip 失效。
 */
export function sameProviderId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** 从备用顺序中剔除与主用同 id 的项（trim + 大小写不敏感）。 */
export function filterOutPrimaryProvider(order: readonly string[], primary: string): string[] {
  return order.filter((p) => p && !sameProviderId(p, primary));
}

export function isMcpProviderId(provider: string): boolean {
  const key = provider.trim().toLowerCase();
  return key === 'mcp' || key === 'modelcontextprotocol' || key === 'model_context_protocol';
}

const NON_PROVIDER_CONFIG_MARKERS = [
  'ai配置',
  '嵌入模型配置',
  'rerank模型配置',
  '记忆配置',
  '表情包配置',
  'mcp 工具配置',
  'qdrant',
  '命令执行器',
];

function isExcludedGlobalConfig(cfg: LocalFrameworkConfig): boolean {
  const combined = `${cfg.name} ${cfg.full_name}`.toLowerCase();
  return NON_PROVIDER_CONFIG_MARKERS.some((marker) => combined.includes(marker));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCoreAiPrefix(value: string): string {
  return value.trim().replace(/^gscore\s*ai\s*/i, '').trim();
}

function getProviderSearchableText(cfg: LocalFrameworkConfig): string {
  const parts = [stripCoreAiPrefix(cfg.name), stripCoreAiPrefix(cfg.full_name)].filter(Boolean);
  return parts.join(' ').toLowerCase();
}

function containsProviderToken(haystack: string, providerKey: string): boolean {
  if (/^[a-z0-9._-]+$/i.test(providerKey)) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(providerKey)}([^a-z0-9]|$)`, 'i');
    return re.test(haystack);
  }
  return haystack.includes(providerKey);
}

/**
 * 按 provider id 从后端下发的框架配置字典中动态解析对应配置。
 * 后端新增搜索/抓取源时遵循 `GsCore AI <Provider>搜索配置` / `<Provider>抓取配置` / `<Provider>搜索抓取配置`
 * 命名即可自动匹配，无需修改前端代码。
 */
export function resolveProviderFrameworkConfig(
  configs: Record<string, LocalFrameworkConfig>,
  provider: string,
  kind: 'search' | 'fetch',
): LocalFrameworkConfig | undefined {
  const key = provider.trim().toLowerCase();
  if (!key || isMcpProviderId(key)) return undefined;

  const list = Object.values(configs).filter((cfg) => !isExcludedGlobalConfig(cfg));

  if (kind === 'fetch' && key === 'local') {
    return (
      list.find(
        (c) => c.name.includes('WebFetch抓取配置') || c.full_name.includes('WebFetch抓取配置'),
      ) ??
      list.find((c) => {
        const name = `${c.name} ${c.full_name}`.toLowerCase();
        return name.includes('webfetch') && (name.includes('抓取') || name.includes('fetch'));
      })
    );
  }

  const canonicalNames =
    kind === 'search'
      ? [`${key}搜索配置`, `${key}搜索抓取配置`, `${key} search`]
      : [`${key}抓取配置`, `${key}搜索抓取配置`, `${key} fetch`];

  for (const target of canonicalNames) {
    const exact = list.find((c) => getProviderSearchableText(c).includes(target));
    if (exact) return exact;
  }

  const preferredKeywords =
    kind === 'search' ? ['搜索', 'search'] : ['抓取', 'fetch', 'reader'];
  const fallbackKeywords = ['搜索', '抓取', 'search', 'fetch', 'reader'];

  const candidates = list.filter((c) => {
    const combined = getProviderSearchableText(c);
    return (
      containsProviderToken(combined, key) &&
      fallbackKeywords.some((kw) => combined.includes(kw))
    );
  });

  if (candidates.length === 0) return undefined;
  return (
    candidates.find((c) => {
      const combined = getProviderSearchableText(c);
      return preferredKeywords.some((kw) => combined.includes(kw));
    }) ?? candidates[0]
  );
}

/** 个别历史配置需隐藏的废弃字段。 */
export function getExcludedKeysForProvider(provider: string): string[] | undefined {
  if (provider.trim().toLowerCase() === 'exa') {
    // 旧 exa_config 可能仍带 search_type。Core 不读它，面板也不渲染。
    return ['search_type'];
  }
  return undefined;
}
