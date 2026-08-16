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
  // Tier 2 · 补 demo 必崩页面所需 mock
  generateLogEntries,
  generateLogDates,
  generateLogSources,
  generateLogLevels,
  generateLogStats,
  generateLogConfig,
  applyLogConfig,
  generatePersonaList,
  generatePersonaDetail,
  generatePersonaConfigAll,
  generateGlobalPersonaConfig,
  generateMCPConfigList,
  generateMCPConfigDetail,
  generateMCPPresets,
  generateAIStatisticsSummary,
  generateTokenByModel,
  generateTokenByType,
  generateActiveUsers,
  generateTriggerDistribution,
  generateIntentDistribution,
  generateErrorStats,
  generateHeartbeatStats,
  generateRAGStats,
  generateTokenByRange,
  generatePerformanceHourly,
  generatePerformanceHourlyRange,
  generateBudgetConfig,
  generateBudgetRules,
  generateBudgetWhitelist,
  generateBudgetOverview,
  generateBackupFileTree,
  generateBackupFiles,
  generateBackupConfig,
  generateKanbanBoard,
  generateKanbanTaskDetail,
  generateKanbanArtifacts,
  generateKanbanCandidates,
  generateKanbanWorkspaceFiles,
  generateProviderList,
  generateTaskConfig,
  generateProviderConfigsSummary,
  generateProviderConfigDetail,
  generateProviderOptions,
  generateEmbeddingProvider,
  generateEmbeddingLocal,
  generateEmbeddingOpenAI,
  generateEmbeddingSummary,
  generateMCPToolsConfigList,
  generateBatchPushTargets,
  generateAllArtifacts,
} from './demoMock';

type Ctx = { url: URL; method: string; body: unknown };
type Handler = (ctx: Ctx) => unknown;
interface Route {
  m: string;
  re: RegExp;
  h: Handler;
}

const DEMO_COGNITION_NODES = [
  {
    id: 101,
    kind: 'entity',
    ref: 'world:GenshinUID:钟离',
    scope_key: '',
    owner_user_id: '',
    title: '钟离',
    summary: '岩神摩拉克斯。公共世界枢纽，正文不在这个节点里。',
    as_of: '5.7',
    source: 'plugin',
    handle: '',
    canon: '',
    decay: 1,
    attachments: [
      {
        id: 1,
        node_id: 101,
        slot: '资料',
        title: '钟离角色图鉴',
        summary: '护盾与石化大招。插件只读篇。',
        as_of: '5.7',
        source: 'plugin',
        writable: false,
        ref: 'plugin:GenshinUID:zhongli',
        handle: 'kb_plugin:zhongli',
      },
      {
        id: 2,
        node_id: 101,
        slot: '资料',
        title: '钟离传说任务笔记',
        summary: 'Agent 补的一篇，可更新。',
        as_of: '2026-08',
        source: 'agent',
        writable: true,
        ref: 'kbdoc:zhongli-note',
        handle: 'kb_kbdoc:zhongli-note',
      },
    ],
  },
  {
    id: 102,
    kind: 'entity',
    ref: 'world:GenshinUID:原神',
    scope_key: '',
    owner_user_id: '',
    title: '原神',
    summary: '提瓦特大陆的开放世界游戏。公共世界枢纽。',
    as_of: '5.7',
    source: 'plugin',
    handle: '',
    canon: '',
    decay: 1,
    attachments: [
      {
        id: 3,
        node_id: 102,
        slot: '资料',
        title: '原神版本手册',
        summary: '当前版本活动与树脂规则。',
        as_of: '5.7',
        source: 'plugin',
        writable: false,
        ref: 'plugin:GenshinUID:genshin',
        handle: 'kb_plugin:genshin',
      },
    ],
  },
  {
    id: 103,
    kind: 'entity',
    ref: 'world:GenshinUID:提瓦特',
    scope_key: '',
    owner_user_id: '',
    title: '提瓦特',
    summary: '七国所在的世界。',
    as_of: '5.7',
    source: 'plugin',
    handle: '',
    canon: '',
    decay: 1,
    attachments: [],
  },
  {
    id: 201,
    kind: 'entity',
    ref: 'ent:ent-4',
    scope_key: 'group:114514',
    owner_user_id: '',
    title: '钟离',
    summary: '本群对钟离的环境镜像，canon 指向世界枢纽。',
    as_of: '',
    source: 'memory',
    handle: '',
    canon: 'world:GenshinUID:钟离',
    decay: 1,
    attachments: [],
  },
  {
    id: 202,
    kind: 'entity',
    ref: 'ent:ent-16',
    scope_key: 'group:114514',
    owner_user_id: '',
    title: '原神',
    summary: '本群对原神的环境镜像。',
    as_of: '',
    source: 'memory',
    handle: '',
    canon: 'world:GenshinUID:原神',
    decay: 1,
    attachments: [],
  },
  {
    id: 203,
    kind: 'entity',
    ref: 'ent:ent-17',
    scope_key: 'group:114514',
    owner_user_id: '',
    title: '提瓦特',
    summary: '本群对提瓦特的环境镜像。',
    as_of: '',
    source: 'memory',
    handle: '',
    canon: 'world:GenshinUID:提瓦特',
    decay: 1,
    attachments: [],
  },
];

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

  // ── Agent runtime (/ai-runtime) ──
  {
    m: 'GET',
    re: /^\/api\/agent_kits\/slots$/,
    h: () => ({
      slots: [
        {
          name: 'memory',
          description: '检索 + 注入 + 工具轨迹 + 记忆工具',
          default_kit_id: 'gscore.memory',
          exclusive: true,
          sealed: false,
          configured: ['gscore.memory'],
          occupants: ['gscore.memory'],
          healthy: true,
          candidates: [{ kit_id: 'gscore.memory', display_name: 'GsCore Memory', owns_tools: [] }],
        },
        {
          name: 'speech',
          description: '出站话术态（密封：可关不可替）',
          default_kit_id: 'gscore.speech',
          exclusive: true,
          sealed: true,
          configured: [],
          occupants: [],
          healthy: false,
          candidates: [],
        },
      ],
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/agent_kits\/hooks$/,
    h: () => ({
      enabled: true,
      total_hooks: 1,
      points: [
        {
          id: 'H05',
          name: 'BEFORE_CONTEXT_ASSEMBLY',
          anchor: 'context_assembly',
          capabilities: ['read'],
          default_timeout_ms: 200,
          wired: true,
          owners: ['gscore.memory'],
        },
        {
          id: 'ON_AI_ERROR',
          name: 'ON_AI_ERROR',
          anchor: 'handle_ai.handle_ai_chat:except',
          capabilities: [],
          default_timeout_ms: 500,
          wired: false,
          owners: [],
        },
      ],
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/relationship\/view/,
    h: ({ url }) => {
      const userId = url.searchParams.get('user_id') || 'demo_user';
      if (userId === 'nobody') {
        return {
          user_id: userId,
          scored: false,
          zone: 'distant',
          zone_label: '不太熟',
          line: '不太熟，公事公办',
        };
      }
      return {
        user_id: userId,
        bot_id: url.searchParams.get('bot_id') || 'onebot',
        scored: true,
        score: 42,
        zone: 'acquaintance',
        zone_label: '认识',
        line: '认识这个人',
        last_delta: 1,
        last_reason: 'pos.first_meaningful',
        last_eval_at: Math.floor(Date.now() / 1000) - 3600,
        daily_gain: 1,
        daily_loss: 0,
        daily_ymd: new Date().toISOString().slice(0, 10),
        last_positive_interact_at: Math.floor(Date.now() / 1000) - 7200,
        interaction_count: 8,
      };
    },
  },
  {
    m: 'GET',
    re: /^\/api\/cognition\/articles$/,
    h: ({ url }) => {
      const handle = url.searchParams.get('handle') || '';
      const limit = Number(url.searchParams.get('limit') ?? 20000);
      const byHandle: Record<string, string> = {
        'kb_plugin:zhongli': '钟离，岩神摩拉克斯。持护盾与石化大招。本篇来自插件图鉴，只读。',
        'kb_kbdoc:zhongli-note': '传说任务笔记：客卿身份、契约与摩拉。Agent 补写，可更新。',
        'kb_plugin:genshin': '原神是提瓦特的开放世界游戏。树脂、活动与版本节奏见本手册。',
      };
      const text = byHandle[handle] || `演示正文（${handle || 'empty'}）`;
      return {
        handle,
        source: 'knowledge',
        mime: 'text/plain',
        text: text.slice(0, Number.isFinite(limit) ? limit : 20000),
        truncated: false,
        size_bytes: text.length,
      };
    },
  },
  {
    m: 'GET',
    re: /^\/api\/cognition\/nodes(?:\/(\d+))?$/,
    h: ({ url }) => {
      const detailId = url.pathname.match(/\/nodes\/(\d+)$/)?.[1];
      const nodes = DEMO_COGNITION_NODES;
      if (detailId) {
        return nodes.find((n) => n.id === Number(detailId)) ?? null;
      }
      const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
      const scopeKey = url.searchParams.get('scope_key') || '';
      const owner = url.searchParams.get('owner_user_id') || '';
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const visible = nodes.filter((n) => {
        if (scopeKey) {
          if (n.scope_key !== '' && n.scope_key !== scopeKey) return false;
        } else if (n.scope_key !== '') {
          return false;
        }
        if (!owner && n.owner_user_id) return false;
        if (owner && n.owner_user_id && n.owner_user_id !== owner) return false;
        if (!keyword) return true;
        return (
          n.title.toLowerCase().includes(keyword) ||
          n.summary.toLowerCase().includes(keyword) ||
          n.ref.toLowerCase().includes(keyword)
        );
      });
      return { nodes: visible.slice(0, Number.isFinite(limit) ? limit : 20) };
    },
  },
  {
    m: 'POST',
    re: /^\/api\/cognition\/rebuild_mount$/,
    h: () => ({
      hubs: DEMO_COGNITION_NODES.filter((n) => n.ref.startsWith('world:')).length,
      attachments: DEMO_COGNITION_NODES.reduce((sum, n) => sum + (n.attachments?.length ?? 0), 0),
      linked_env: DEMO_COGNITION_NODES.filter((n) => n.canon).length,
      skipped_ambiguous: 0,
      skipped_unresolved: 1,
      last_error: '',
    }),
  },

  // ── Ops diagnostics (/ai-ops) ──
  {
    m: 'GET',
    re: /^\/api\/ops\/bots$/,
    h: () => ({
      count: 1,
      connected_count: 1,
      items: [{ ws_bot_id: 'ws-demo', bot_id: 'onebot', connected: true, has_ws: true }],
      ts: Date.now() / 1000,
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/sessions$/,
    h: () => ({
      count: 1,
      idle_threshold: 1800,
      max_ai_history: 30,
      items: [
        {
          session_id: 'demo:group:1',
          persona_name: '早柚',
          history_length: 4,
          idle_seconds: 12,
        },
      ],
      ts: Date.now() / 1000,
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/followup$/,
    h: () => ({
      window_seconds: 120,
      max_total_seconds: 600,
      active_count: 0,
      items: [],
      ts: Date.now() / 1000,
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/multimodal$/,
    h: () => ({
      queue_size: 0,
      queue_max: 2000,
      queue_utilization: 0,
      worker_running: true,
      understand_concurrency: 2,
      rate_window_seconds: 300,
      rate_max_per_window: 12,
      tracked_scopes: 0,
      recent_url_scopes: 0,
      min_desc_len: 15,
    }),
  },
  { m: 'GET', re: /^\/api\/ops\/lifecycle$/, h: () => ({ report: null, ts: Date.now() / 1000 }) },
  {
    m: 'POST',
    re: /^\/api\/ops\/lifecycle\/run$/,
    h: () => ({ report: { ok: true, consolidated: 0, forgotten: 0 }, ts: Date.now() / 1000 }),
  },
  {
    m: 'POST',
    re: /^\/api\/ops\/intent$/,
    h: ({ body }) => ({
      text: (body as { text?: string })?.text,
      intent: '闲聊',
      conf: 0.9,
      reason: 'Demo',
    }),
  },
  {
    m: 'POST',
    re: /^\/api\/ops\/trigger-replay$/,
    h: () => ({
      outcome: 'would_enter_ai',
      trigger_type: 'mention',
      persona_name: '早柚',
      steps: [
        { step: 'enable_ai', pass: true, detail: true },
        { step: 'mention_mode', pass: true, detail: { should_respond: true } },
      ],
    }),
  },
  {
    m: 'POST',
    re: /^\/api\/ops\/output-preview$/,
    h: ({ body }) => {
      const text = String((body as { text?: string })?.text ?? '');
      return { firewall_enabled: true, ooc_hit: null, stages: { raw: text, final: text }, final: text };
    },
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/tool-topology/,
    h: () => ({
      tool_packs: ['dynamic'],
      tool_names: [],
      core_pool: [{ name: 'search_knowledge', plugin: 'core' }],
      core_pool_size: 1,
      category_counts: { buildin: 5, self: 2 },
      ts: Date.now() / 1000,
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/config-snapshot$/,
    h: () => ({
      version: 1,
      exported_at: Date.now() / 1000,
      ai_config: { enable: true },
      access: { black_list: [], white_list: [] },
    }),
  },
  {
    m: 'POST',
    re: /^\/api\/ops\/config-snapshot\/import$/,
    h: () => ({ applied: ['ai_config.enable'], skipped: [], applied_count: 1 }),
  },
  { m: 'GET', re: /^\/api\/ops\/access$/, h: () => ({ black_list: [], white_list: [] }) },
  {
    m: 'PUT',
    re: /^\/api\/ops\/access$/,
    h: ({ body }) => ({
      black_list: (body as { black_list?: string[] })?.black_list ?? [],
      white_list: (body as { white_list?: string[] })?.white_list ?? [],
    }),
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/security-output$/,
    h: () => ({
      content_guard_enable: true,
      output_firewall_enable: true,
      render_long_markdown_as_image: true,
      history_merge_window: 120,
      follow_up_window: 90,
      follow_up_max_total: 600,
    }),
  },
  {
    m: 'PUT',
    re: /^\/api\/ops\/security-output$/,
    h: ({ body }) => (body as { values?: Record<string, unknown> })?.values ?? {},
  },
  {
    m: 'GET',
    re: /^\/api\/ops\/plugins-diagnostics$/,
    h: () => ({
      plugin_count: 2,
      module_cache_size: 10,
      active_bots: ['ws-demo'],
      items: [{ name: 'GenshinUID', enabled: true, sv_count: 3, has_config: true, keys: ['enabled'] }],
      ts: Date.now() / 1000,
    }),
  },
  {
    m: 'POST',
    re: /^\/api\/ai\/memory\/search$/,
    h: ({ body }) => {
      const q = String((body as { query?: string })?.query ?? '');
      return {
        episodes: q ? [{ id: 'ep-1', content: q, score: 0.9 }] : [],
        entities: [],
        edges: [],
      };
    },
  },

  // ── Tier 1 · 看板 ──
  { m: 'GET', re: /^\/api\/dashboard\/bots$/, h: () => generateDashboardBots() },
  { m: 'GET', re: /^\/api\/dashboard\/metrics$/, h: ({ url }) => generateKeyMetrics(botOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/commands$/, h: ({ url }) => generateMonthlyCommandData(botOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/users-groups$/, h: ({ url }) => generateMonthlyUserGroupData(botOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/daily\/commands$/, h: ({ url }) => generateDailyCommandUsage(botOf(url), dateOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/daily\/group-triggers$/, h: ({ url }) => generateDailyGroupCommandTriggers(botOf(url), dateOf(url)) },
  { m: 'GET', re: /^\/api\/dashboard\/daily\/personal-triggers$/, h: ({ url }) => generateDailyPersonalCommandTriggers(botOf(url), dateOf(url)) },
  {
    m: 'GET',
    re: /^\/api\/dashboard\/daily\/command-counts$/,
    h: ({ url }) => {
      const days = Math.min(366, Math.max(1, Number(new URL(url, 'http://x').searchParams.get('days') || 60)));
      const today = new Date();
      const out: Array<{ date: string; count: number }> = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        // 约一半日期有数据，便于测禁用
        const count = i % 3 === 0 ? 0 : Math.floor(Math.random() * 200) + 1;
        out.push({ date, count });
      }
      return out;
    },
  },

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
  // 兼容尾斜杠；返回完整 MemeRecord，缺字段会让 AIMemePage 展开 tags 白屏。
  { m: 'GET', re: /^\/api\/meme\/([^/]+)\/?$/, h: ({ url }) => {
    const segs = url.pathname.split('/').filter(Boolean);
    const id = decodeURIComponent(segs[segs.length - 1] || '');
    return generateMemeDetail(id);
  }},

  // ── Tier 2 · 让 demo 必崩页面也可以打开 ──
  // /logs
  { m: 'GET', re: /^\/api\/logs$/, h: ({ url }) => generateLogEntries(url.searchParams) },
  { m: 'GET', re: /^\/api\/logs\/available-dates$/, h: () => generateLogDates() },
  { m: 'GET', re: /^\/api\/logs\/sources$/, h: () => generateLogSources() },
  { m: 'GET', re: /^\/api\/logs\/levels$/, h: () => generateLogLevels() },
  { m: 'GET', re: /^\/api\/logs\/stats$/, h: () => generateLogStats() },
  { m: 'GET', re: /^\/api\/logs\/config$/, h: () => generateLogConfig() },
  { m: 'PUT', re: /^\/api\/logs\/config$/, h: ({ body }) => applyLogConfig(body) },

  // /persona-config
  { m: 'GET', re: /^\/api\/persona\/list$/, h: () => generatePersonaList() },
  { m: 'GET', re: /^\/api\/persona\/config\/all$/, h: () => generatePersonaConfigAll() },
  { m: 'GET', re: /^\/api\/persona\/config\/global$/, h: () => generateGlobalPersonaConfig() },
  { m: 'GET', re: /^\/api\/persona\/([^/]+)$/, h: ({ url }) => generatePersonaDetail(decodeURIComponent(url.pathname.split('/').pop()!)) },

  // /mcp-config
  { m: 'GET', re: /^\/api\/ai\/mcp\/list$/, h: () => generateMCPConfigList() },
  { m: 'GET', re: /^\/api\/ai\/mcp\/presets$/, h: () => generateMCPPresets() },
  { m: 'GET', re: /^\/api\/ai\/mcp-tools-config\/list$/, h: () => generateMCPToolsConfigList() },
  { m: 'GET', re: /^\/api\/ai\/mcp\/([^/]+)$/, h: ({ url }) => generateMCPConfigDetail(decodeURIComponent(url.pathname.match(/\/mcp\/([^/]+)$/)![1])) },
  { m: 'GET', re: /^\/api\/ai\/mcp\/([^/]+)\/tools$/, h: () => ({ tools: [] }) },

  // /ai-statistics
  { m: 'GET', re: /^\/api\/ai\/statistics\/summary$/, h: () => generateAIStatisticsSummary() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/token-by-model$/, h: () => generateTokenByModel() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/token-by-type$/, h: () => generateTokenByType() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/token-by-range$/, h: () => generateTokenByRange() },
  {
    m: 'GET',
    re: /^\/api\/ai\/statistics\/daily-token-counts$/,
    h: ({ url }) => {
      const days = Math.min(366, Math.max(1, Number(new URL(url, 'http://x').searchParams.get('days') || 60)));
      const today = new Date();
      const out: Array<{
        date: string;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      }> = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        const input_tokens = i % 4 === 0 ? 0 : Math.floor(Math.random() * 5_000_000) + 1000;
        const output_tokens = input_tokens === 0 ? 0 : Math.floor(input_tokens * 0.3);
        out.push({
          date,
          input_tokens,
          output_tokens,
          total_tokens: input_tokens + output_tokens,
        });
      }
      return out;
    },
  },
  { m: 'GET', re: /^\/api\/ai\/statistics\/active-users$/, h: () => generateActiveUsers() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/trigger-distribution$/, h: () => generateTriggerDistribution() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/intent-distribution$/, h: () => generateIntentDistribution() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/errors$/, h: () => generateErrorStats() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/heartbeat$/, h: () => generateHeartbeatStats() },
  { m: 'GET', re: /^\/api\/ai\/statistics\/rag$/, h: () => generateRAGStats() },
  { m: 'GET', re: /^\/api\/ai\/performance\/hourly$/, h: () => generatePerformanceHourly() },
  { m: 'GET', re: /^\/api\/ai\/performance\/hourly\/range$/, h: () => generatePerformanceHourlyRange() },

  // /ai-budget
  { m: 'GET', re: /^\/api\/ai\/budget\/config$/, h: () => generateBudgetConfig() },
  { m: 'GET', re: /^\/api\/ai\/budget\/rules$/, h: ({ url }) => generateBudgetRules(url.searchParams) },
  { m: 'GET', re: /^\/api\/ai\/budget\/whitelist$/, h: () => generateBudgetWhitelist() },
  { m: 'GET', re: /^\/api\/ai\/budget\/overview$/, h: () => generateBudgetOverview() },

  // /backup
  { m: 'GET', re: /^\/api\/backup\/files$/, h: () => generateBackupFiles() },
  { m: 'GET', re: /^\/api\/backup\/file-tree$/, h: () => generateBackupFileTree() },
  { m: 'GET', re: /^\/api\/backup\/config$/, h: () => generateBackupConfig() },

  // /ai-kanban
  { m: 'GET', re: /^\/api\/ai\/kanban\/board$/, h: () => generateKanbanBoard() },
  { m: 'GET', re: /^\/api\/ai\/kanban\/tasks\/([^/]+)$/, h: ({ url }) => generateKanbanTaskDetail() },
  { m: 'GET', re: /^\/api\/ai\/artifacts$/, h: ({ url }) => generateAllArtifacts(url.searchParams) },
  { m: 'GET', re: /^\/api\/ai\/kanban\/tasks\/([^/]+)\/workspace\/files$/, h: () => generateKanbanWorkspaceFiles() },
  { m: 'GET', re: /^\/api\/ai\/capability-agents\/kanban-candidates$/, h: () => generateKanbanCandidates() },

  // /ai-config (Provider/Embedding/Wizard)
  { m: 'GET', re: /^\/api\/provider_config\/providers$/, h: () => generateProviderList() },
  { m: 'GET', re: /^\/api\/provider_config\/task_config\/(high|low)$/, h: ({ url }) => generateTaskConfig(decodeURIComponent(url.pathname.split('/').pop()!)) },
  { m: 'GET', re: /^\/api\/provider_config\/all_configs$/, h: () => generateProviderConfigsSummary() },
  { m: 'GET', re: /^\/api\/provider_config\/config\/([^/]+)\/options$/, h: ({ url }) => generateProviderOptions() },
  { m: 'GET', re: /^\/api\/provider_config\/config\/([^/]+)\/[^/]+$/, h: ({ url }) => generateProviderConfigDetail(decodeURIComponent(url.pathname.split('/').slice(-2, -1)[0])) },
  { m: 'GET', re: /^\/api\/embedding_config\/provider$/, h: () => generateEmbeddingProvider() },
  { m: 'GET', re: /^\/api\/embedding_config\/local$/, h: () => generateEmbeddingLocal() },
  { m: 'GET', re: /^\/api\/embedding_config\/openai$/, h: () => generateEmbeddingOpenAI() },
  { m: 'GET', re: /^\/api\/embedding_config\/summary$/, h: () => generateEmbeddingSummary() },

  // /batch-push（前端联调用 GET /api/BatchPush/targets 获取可选 bot/group/user；演示模式）
  { m: 'GET', re: /^\/api\/BatchPush\/targets(\?.*)?$/, h: (ctx) => generateBatchPushTargets(ctx.url.searchParams) },

  { m: 'GET', re: /^\/api\/live-chat\/bootstrap$/, h: () => ({ masters: [] }) },
  {
    m: 'GET',
    re: /^\/api\/live-chat\/state$/,
    h: () => ({
      identity: { userId: 'master', nickname: 'Master', avatar: '', botSelfId: 'webconsole_bot' },
      conversations: [],
      activeId: null,
    }),
  },
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
