/**
 * Demo（演示）模式 Mock Server。
 *
 * 仅在 `import.meta.env.VITE_DEMO` 为真时，由 `main.tsx` 调用 `installMockServer()`。
 * 机制（见 plans/interactive-hub-showcase.md §4.2）：
 *   覆写全局 `window.fetch` → 拦截所有 `/api/*` 请求，按「method + 路径正则」匹配路由表，
 *   统一包成后端封套 `{ status: 0, msg: 'ok', data }`。非 `/api` 请求透传给原生 fetch。
 *
 * 为什么覆写全局 fetch 而非在 ApiClient 注入：api.ts 里除了 ApiClient 的请求，还有约 7 处
 * 内联 fetch（头像 / 品牌图标 / 表情包上传导入 / AI 图片上传）绕过了 ApiClient，覆写全局能一网打尽，
 * 且对 api.ts 零侵入。普通构建下本文件不会被引用（main.tsx 的 if 分支被 tree-shake）。
 */
import {
  // 看板：复用 mockData 已有生成器
  generateKeyMetrics,
  generateMonthlyCommandData,
  generateMonthlyUserGroupData,
  generateDailyCommandUsage,
  generateDailyGroupCommandTriggers,
  generateDailyPersonalCommandTriggers,
} from './mockData';
import {
  DEMO_USER,
  generateVersionInfo,
  generateActiveBots,
  generateBrandInfo,
  generateAIWizardStatus,
  generateDashboardBots,
  generatePluginList,
  generatePluginDetail,
  generateThemeConfig,
  generateThemePresets,
  applyThemePreset,
  generateDatabasePlugins,
  generateTableMetadata,
  generateTableData,
  generateMemoryScopes,
  generateMemoryStats,
  generateMemoryEntities,
  generateMemoryEdges,
  generateMemoryCategories,
  generateMemeList,
  generateMemePersonas,
  generateMemeStats,
  generateMemeDetail,
} from './demoMock';

type Ctx = { url: URL; method: string; body: unknown };
type Handler = (ctx: Ctx) => unknown;
interface Route {
  m: string;
  re: RegExp;
  h: Handler;
}

const num = (url: URL, key: string, def: number) => Number(url.searchParams.get(key) ?? def);
const botOf = (url: URL) => url.searchParams.get('bot_id') ?? 'all';
const dateOf = (url: URL) => url.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

// 路由表：find() 取首个命中，因此「更具体的路径」必须排在「通配 :id」之前。
const routes: Route[] = [
  // ── Tier 0 · 启动必备 ──
  { m: 'GET', re: /^\/api\/auth\/me$/, h: () => DEMO_USER },
  { m: 'GET', re: /^\/api\/auth\/admin\/exists$/, h: () => ({ is_admin_exist: true }) },
  { m: 'GET', re: /^\/api\/brand$/, h: () => generateBrandInfo() },
  { m: 'GET', re: /^\/api\/ai\/wizard\/status$/, h: () => generateAIWizardStatus() },
  { m: 'GET', re: /^\/api\/version$/, h: () => generateVersionInfo() },
  { m: 'GET', re: /^\/api\/version\/bots$/, h: () => generateActiveBots() },
  { m: 'GET', re: /^\/api\/version\/bots\/count$/, h: () => ({ count: 3 }) },
  { m: 'GET', re: /^\/api\/version\/bots\/names$/, h: () => ({ names: generateActiveBots().names }) },

  // ── Tier 1 · 看板 ──
  { m: 'GET', re: /^\/api\/dashboard\/bots$/, h: () => generateDashboardBots() },
  { m: 'GET', re: /^\/api\/dashboard\/metrics$/, h: ({ url }) => generateKeyMetrics(botOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/commands$/, h: ({ url }) => generateMonthlyCommandData(botOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/users-groups$/, h: ({ url }) => generateMonthlyUserGroupData(botOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/daily\/commands$/, h: ({ url }) => generateDailyCommandUsage(botOf(url), dateOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/daily\/group-triggers$/, h: ({ url }) => generateDailyGroupCommandTriggers(botOf(url), dateOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/daily\/personal-triggers$/, h: ({ url }) => generateDailyPersonalCommandTriggers(botOf(url), dateOf(url)) },

  // ── Tier 1 · 插件库 / 配置 ──
  { m: 'GET', re: /^\/api\/plugins\/list$/, h: () => generatePluginList() },
  { m: 'GET', re: /^\/api\/plugins$/, h: () => generatePluginList().map((p) => generatePluginDetail(p.id)) },
  { m: 'GET', re: /^\/api\/plugins\/([^/]+)$/, h: ({ url }) => generatePluginDetail(decodeURIComponent(url.pathname.split('/').pop()!)) },

  // ── Tier 1 · 主题 ──
  { m: 'GET', re: /^\/api\/theme\/config$/, h: () => generateThemeConfig() },
  { m: 'GET', re: /^\/api\/theme\/presets$/, h: () => generateThemePresets() },
  // 应用预设：返回 { name, config } → ThemesPage 调 applyThemeConfig 真正切换主题
  { m: 'POST', re: /^\/api\/theme\/presets\/apply$/, h: ({ body }) => applyThemePreset((body as { name?: string })?.name ?? '') },
  { m: 'POST', re: /^\/api\/theme\/presets\/save$/, h: ({ body }) => { const n = (body as { name?: string })?.name ?? 'preset'; return { name: n, filename: `${n}.json` }; } },

  // ── Tier 1 · 插件数据库（DatabasePage）──
  // 注意顺序：更具体的 `/table/:name/data` 必须排在 `/table/:name` 之前。
  { m: 'GET', re: /^\/api\/database\/plugins$/, h: () => generateDatabasePlugins() },
  { m: 'GET', re: /^\/api\/database\/tables$/, h: () => [] },
  { m: 'GET', re: /^\/api\/database\/table\/([^/]+)\/data$/, h: ({ url }) => generateTableData(decodeURIComponent(url.pathname.match(/\/table\/([^/]+)\/data$/)![1]), url.searchParams) },
  { m: 'GET', re: /^\/api\/database\/table\/([^/]+)$/, h: ({ url }) => generateTableMetadata(decodeURIComponent(url.pathname.split('/').pop()!)) },
  { m: 'GET', re: /^\/api\/database\/([^/]+)\/tables$/, h: ({ url }) => { const id = decodeURIComponent(url.pathname.match(/\/database\/([^/]+)\/tables$/)![1]); return generateDatabasePlugins().find((p) => p.plugin_id === id) ?? null; } },

  // ── Tier 1 · AI 记忆图谱（/api/ai/memory/*）──
  { m: 'GET', re: /^\/api\/ai\/memory\/scopes$/, h: () => generateMemoryScopes() },
  { m: 'GET', re: /^\/api\/ai\/memory\/stats$/, h: () => generateMemoryStats() },
  { m: 'GET', re: /^\/api\/ai\/memory\/config$/, h: () => MEMORY_CONFIG },
  { m: 'GET', re: /^\/api\/ai\/memory\/hiergraph\/status$/, h: () => HIERGRAPH_STATUS },
  { m: 'GET', re: /^\/api\/ai\/memory\/entities$/, h: ({ url }) => generateMemoryEntities(num(url, 'page', 1), num(url, 'page_size', 200)) },
  { m: 'GET', re: /^\/api\/ai\/memory\/edges$/, h: ({ url }) => generateMemoryEdges(num(url, 'page', 1), num(url, 'page_size', 500)) },
  { m: 'GET', re: /^\/api\/ai\/memory\/categories$/, h: ({ url }) => generateMemoryCategories(num(url, 'page', 1), num(url, 'page_size', 200)) },
  { m: 'GET', re: /^\/api\/ai\/memory\/episodes$/, h: () => ({ items: [], total: 0, page: 1, page_size: 20 }) },
  { m: 'GET', re: /^\/api\/ai\/memory\/preferences$/, h: () => ({ items: [], total: 0, page: 1, page_size: 20 }) },

  // ── Tier 1 · 智能表情包 ──
  { m: 'GET', re: /^\/api\/meme\/list$/, h: ({ url }) => generateMemeList(url.searchParams) },
  { m: 'GET', re: /^\/api\/meme\/personas$/, h: () => generateMemePersonas() },
  { m: 'GET', re: /^\/api\/meme\/stats$/, h: () => generateMemeStats() },
  // 单条详情（点击表情打开详情弹窗）——必须放在上面三条「具体路径」之后，避免误吞 list/personas/stats。
  { m: 'GET', re: /^\/api\/meme\/([^/]+)$/, h: ({ url }) => generateMemeDetail(decodeURIComponent(url.pathname.split('/').pop()!)) },
];

const MEMORY_CONFIG = {
  observer_enabled: true,
  observer_blacklist: [],
  ingestion_enabled: true,
  batch_interval_seconds: 30,
  batch_max_size: 20,
  llm_semaphore_limit: 4,
  enable_retrieval: true,
  enable_system2: true,
  enable_user_global_memory: true,
  enable_heartbeat_memory: false,
  retrieval_top_k: 8,
  dedup_similarity_threshold: 0.86,
  edge_conflict_threshold: 0.8,
  min_children_per_category: 3,
  max_layers: 3,
  hiergraph_rebuild_ratio: 0.2,
  hiergraph_rebuild_interval_seconds: 3600,
};

const HIERGRAPH_STATUS = {
  scope_key: 'group:114514',
  initialized: true,
  max_layer: 2,
  last_rebuild_at: new Date(Date.now() - 3600_000).toISOString(),
  entity_count_at_last_rebuild: 24,
  current_entity_count: 24,
  group_summary_cache: '这是一个活跃的原神交流群，常聊角色培养、抽卡与深渊。',
  group_summary_updated_at: new Date(Date.now() - 1800_000).toISOString(),
};

/** 兜底空值：按路径末段词形猜测「集合 → []」还是「对象 → 空分页对象」。 */
function emptyFor(pathname: string): unknown {
  const seg = pathname.split('/').filter(Boolean).pop() ?? '';
  if (/(s|list|history|logs|records|items|scopes|presets|categories|entities|edges|episodes|jobs|tasks)$/i.test(seg)) {
    return [];
  }
  // 「万能空对象」：同时覆盖常见分页 / 集合字段名，尽量让未精细 Mock 的页面读到空态
  // （`.items` / `.records` / `.rows` / `.results` / `.list` 都拿到 []）而非崩溃。
  return {
    items: [], records: [], rows: [], data: [], results: [], list: [],
    total: 0, count: 0, page: 1, page_size: 20,
  };
}

function safeJson(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mock 版 fetch：拦 `/api/*`，其余透传。 */
async function mockFetch(originalFetch: typeof fetch, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  const url = new URL(rawUrl, location.origin);

  // 非 API 请求（静态资源 / version.json 等）原样放行。
  if (!url.pathname.startsWith('/api/')) {
    return originalFetch(input as RequestInfo, init);
  }

  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const route = routes.find((r) => r.m === method && r.re.test(url.pathname));

  let payload: { status: number; msg: string; data: unknown };
  if (route) {
    const data = route.h({ url, method, body: safeJson(init?.body) });
    payload = { status: 0, msg: 'ok', data };
  } else if (method === 'GET') {
    payload = { status: 0, msg: 'demo: not mocked', data: emptyFor(url.pathname) };
  } else {
    // 写操作（POST/PUT/DELETE/PATCH）：演示模式一律返回成功封套（改动不持久化）。
    payload = { status: 0, msg: 'demo: 演示模式，修改不会保存', data: safeJson(init?.body) ?? {} };
  }

  await delay(120 + Math.floor(Math.random() * 180)); // 模拟网络延迟，让骨架屏/loading 自然过渡
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

let installed = false;

/** 安装 Mock：覆写 window.fetch。重复调用幂等。 */
export function installMockServer(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => mockFetch(originalFetch, input, init);
  // eslint-disable-next-line no-console
  console.info('[demo] Mock Server 已启用：所有 /api/* 请求由本地假数据接管。');
}
