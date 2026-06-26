/**
 * Demo（演示）模式专用 Mock 数据生成器。
 *
 * 只在 `import.meta.env.VITE_DEMO` 为真时被 `mockServer.ts` 引用，普通构建会被 tree-shake。
 * 设计目标（见 plans/interactive-hub-showcase.md §4.6）：
 *  · 种子化伪随机（LCG）→ 每次刷新数字稳定，截图/录屏一致；
 *  · 真实感命名（真实插件生态名、平台名、脱敏假名），不出现 test1/test2；
 *  · 时间序列叠加趋势 + 周末波动，让折线/柱状图好看；
 *  · 图片资源用内置 SVG `data:` 占位图，避免一墙裂图。
 *
 * 形状以 src/lib/api.ts 的 interface（以及 AIMemoryPage 内联类型）为准，照抄字段即可。
 */

// ───────────────────────── 工具：种子 RNG / 取值 ─────────────────────────

/** 线性同余发生器（LCG）——可复现伪随机。 */
export function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** FNV-1a 字符串哈希 → 32 位种子。 */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const randInt = (rng: () => number, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;
const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** 生成一个彩色渐变 + emoji 的 SVG data-URI 占位图（用于头像 / 表情包 / 品牌图标）。 */
export function demoPlaceholderImage(seed: string, label?: string): string {
  const rng = makeRng(hashSeed(seed));
  const h1 = randInt(rng, 0, 360);
  const h2 = (h1 + randInt(rng, 40, 170)) % 360;
  const emoji = pick(rng, ['😀', '😎', '🥳', '🤖', '✨', '🎉', '🔥', '💡', '🌈', '🐱', '🍻', '👍', '😭', '🤔', '🥰', '😴']);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h1},72%,62%)"/>` +
    `<stop offset="1" stop-color="hsl(${h2},70%,48%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="256" height="256" rx="20" fill="url(#g)"/>` +
    `<text x="128" y="128" font-size="120" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
    (label ? `<text x="128" y="232" font-size="22" fill="rgba(255,255,255,.92)" text-anchor="middle" font-family="sans-serif">${label}</text>` : '') +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ───────────────────────── Tier 0 · 启动必备 ─────────────────────────

/** 假 admin 用户，喂给 AuthContext → isAuthenticated 恒真 → 跳过登录页。 */
export const DEMO_USER = {
  id: 'demo-admin',
  email: 'admin@demo.sayu-bot.com',
  name: '演示管理员',
  role: 'admin' as const,
  avatar: demoPlaceholderImage('demo-admin'),
};

export const generateVersionInfo = () => ({
  version: 'demo-2.x',
  commit: 'demo0000',
  python: { version: '3.11.8', implementation: 'CPython', compiler: 'GCC 12.2.0' },
  platform: { system: 'Linux', release: '6.1.0', machine: 'x86_64', processor: 'x86_64' },
  pid: 4242,
  executable: '/usr/local/bin/python',
  dependencies: { fastapi: '0.110.0', uvicorn: '0.29.0', pydantic: '2.6.4', sqlalchemy: '2.0.29' },
});

export const generateActiveBots = () => ({
  count: 3,
  names: ['OneBot V11', 'Telegram', 'Discord'],
  bots: [
    { name: 'OneBot V11', ws_bot_id: 'onebot-114514', bot_id: '10001', connected: true },
    { name: 'Telegram', ws_bot_id: 'tg-sayu', bot_id: 'sayu_bot', connected: true },
    { name: 'Discord', ws_bot_id: 'dc-sayu', bot_id: 'sayu#0001', connected: true },
  ],
});

export const generateBrandInfo = () => ({
  title: '早柚核心',
  subtitle: 'GsCore 网页控制台 · 演示模式',
  icon_url: demoPlaceholderImage('gscore-brand'),
  icon_source: 'default' as const,
  default: {
    icon: demoPlaceholderImage('gscore-brand'),
    title: '早柚核心',
    subtitle: 'GsCore 网页控制台',
  },
});

export const generateAIWizardStatus = () => ({
  ai_enabled: true,
  ai_enable_range: {
    mode: 'all' as const,
    mode_desc: '全部群聊 / 私聊均可使用',
    white_list: [],
    black_list: [],
    note: '演示模式：AI 能力已对全部会话开启',
  },
  high_level_model: {
    configured: true,
    provider: 'anthropic',
    config_name: 'claude-main',
    model_name: 'claude-opus-4-8',
    full_name: 'anthropic / claude-opus-4-8',
  },
  low_level_model: {
    configured: true,
    provider: 'anthropic',
    config_name: 'claude-fast',
    model_name: 'claude-haiku-4-5',
    full_name: 'anthropic / claude-haiku-4-5',
  },
  vision_support: {
    available: true,
    high_level_vision: { supported: true, model_name: 'claude-opus-4-8', note: '支持图片理解' },
    low_level_vision: { supported: true, model_name: 'claude-haiku-4-5', note: '支持图片理解' },
    vlm_fallback: { configured: true, provider: 'anthropic', tools: ['describe_image'], note: '已配置' },
  },
  persona: {
    persona_count: 3,
    enabled_count: 2,
    inspect_enabled_count: 1,
    configured: true,
    personas: [
      { name: '早柚', ai_mode: ['提及应答'], inspect_interval: null, has_inspect: false, scope: 'global' as const, target_groups: [], is_enabled: true, scope_desc: '全局启用' },
      { name: '可莉', ai_mode: ['提及应答', '定时巡检'], inspect_interval: 30, has_inspect: true, scope: 'specific' as const, target_groups: ['114514'], is_enabled: true, scope_desc: '指定 1 个群' },
      { name: '钟离', ai_mode: ['提及应答'], inspect_interval: null, has_inspect: false, scope: 'disabled' as const, target_groups: [], is_enabled: false, scope_desc: '已禁用' },
    ],
    note: '演示数据',
  },
  memory: { enabled: true, memory_mode: ['群聊', '私聊'], memory_session: 'group' },
  embedding: { provider: 'openai', configured: true, issues: [], model_name: 'text-embedding-3-small', note: '已配置' },
  web_search: { provider: 'tavily', configured: true, issues: [], note: '已配置' },
  missing_configs: [],
  summary: { total_issues: 0, critical_count: 0, warning_count: 0, info_count: 0, ai_usable: true, note: '演示模式：AI 全部能力可用' },
});

// ───────────────────────── Tier 1 · 看板（复用 mockData 已有生成器，这里只补 bots）─────────────────────────

export const generateDashboardBots = () => [
  { id: 'all', name: '汇总' },
  { id: 'onebot-114514', name: 'OneBot V11' },
  { id: 'tg-sayu', name: 'Telegram' },
  { id: 'dc-sayu', name: 'Discord' },
];

// ───────────────────────── Tier 1 · 插件库 / 插件配置 ─────────────────────────

const PLUGIN_DEFS: Array<{ id: string; name: string; desc: string; enabled: boolean; status: string }> = [
  { id: 'GenshinUID', name: 'GenshinUID', desc: '原神 UID 查询面板、抽卡分析、深渊统计等一站式原神插件', enabled: true, status: 'ok' },
  { id: 'StarRailUID', name: 'StarRailUID', desc: '崩坏：星穹铁道 角色面板、遗器评分、模拟宇宙', enabled: true, status: 'ok' },
  { id: 'ZZZeroUID', name: 'ZZZeroUID', desc: '绝区零 代理人面板、邦布与驱动盘查询', enabled: true, status: 'ok' },
  { id: 'WutheringWavesUID', name: 'WutheringWavesUID', desc: '鸣潮 共鸣者面板与声骸词条分析', enabled: false, status: 'disabled' },
  { id: 'gsuid_core', name: 'gsuid_core', desc: '早柚核心框架本体（内置）', enabled: true, status: 'ok' },
  { id: 'GsHelp', name: 'GsHelp', desc: '统一帮助图生成与命令索引', enabled: true, status: 'ok' },
  { id: 'GsAdmin', name: 'GsAdmin', desc: '核心管理插件：权限、订阅与推送管理', enabled: true, status: 'ok' },
  { id: 'ArknightsUID', name: 'ArknightsUID', desc: '明日方舟 干员练度与抽卡记录', enabled: false, status: 'disabled' },
  { id: 'BlueArchiveUID', name: 'BlueArchiveUID', desc: '蔚蓝档案 学生编成与攻略查询', enabled: true, status: 'ok' },
  { id: 'Esec', name: 'Esec', desc: '娱乐插件合集：表情包、梗图与小游戏', enabled: true, status: 'update_available' },
];

export const generatePluginList = () =>
  PLUGIN_DEFS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.desc,
    enabled: p.enabled,
    status: p.status,
    icon: demoPlaceholderImage(`plugin-${p.id}`),
    commit: hashSeed(p.id).toString(16).slice(0, 7),
  }));

/** 单个插件详情：含多种 option_type 的配置项，把配置面板撑满。 */
export const generatePluginDetail = (name: string) => {
  const base = PLUGIN_DEFS.find((p) => p.id === name) ?? PLUGIN_DEFS[0];
  const cfg = (
    value: unknown,
    def: unknown,
    type: string,
    title: string,
    desc: string,
    extra: Record<string, unknown> = {},
  ) => ({ value, default: def, type, title, desc, ...extra });

  return {
    id: base.id,
    name: base.name,
    description: base.desc,
    enabled: base.enabled,
    status: base.status,
    icon: demoPlaceholderImage(`plugin-${base.id}`),
    config: {
      enable: cfg(true, true, 'bool', '启用插件', '总开关，关闭后本插件所有命令失效'),
      auto_clean: cfg(false, false, 'bool', '自动清理缓存', '每日凌晨清理生成的临时图片'),
      max_concurrency: cfg(8, 4, 'int', '最大并发', '同时处理的请求上限', { min_value: 1, max_value: 32 }),
      cache_ttl: cfg(3600, 1800, 'int', '缓存有效期（秒）', '查询结果缓存时长'),
      api_token: cfg('', '', 'str', 'API Token', '第三方数据源访问令牌', { secret: true }),
      render_mode: cfg('html', 'html', 'str', '渲染模式', '面板图片的渲染方式', { options: ['html', 'pil', 'simple'] }),
      theme: cfg('default', 'default', 'str', '面板主题', '内置面板配色', { options: ['default', 'dark', 'genshin', 'starrail'] }),
      push_groups: cfg(['114514', '1919810'], [], 'list', '推送群列表', '定时推送目标群号'),
      welcome_text: cfg('欢迎使用早柚核心~', '', 'str', '欢迎语', '新成员入群欢迎文案'),
    },
    config_names: ['基础配置', '高级配置'],
    service_config: {
      enabled: base.enabled,
      pm: 6,
      priority: 5,
      area: 'ALL',
      black_list: [],
      white_list: [],
      prefix: [],
      force_prefix: [],
      disable_force_prefix: false,
      allow_empty_prefix: false,
    },
  };
};

// ───────────────────────── Tier 1 · 主题 ─────────────────────────

const THEME_CONFIG = {
  mode: 'light' as const,
  style: 'glassmorphism' as const,
  color: '#6c8cff',
  icon_color: 'colored' as const,
  background_image: null,
  blur_intensity: 18,
  theme_preset: 'default' as const,
  language: 'zh-CN' as const,
  card_opacity: 72,
};

export const generateThemeConfig = () => ({ ...THEME_CONFIG });

export const generateThemePresets = () => {
  const now = Math.floor(Date.now() / 1000);
  const presets = [
    { name: '默认石墨', color: '#6c8cff', mode: 'light', style: 'glassmorphism', active: true },
    { name: '暗夜玻璃', color: '#8b5cf6', mode: 'dark', style: 'glassmorphism', active: false },
    { name: '青柠晴空', color: '#22c55e', mode: 'light', style: 'solid', active: false },
    { name: '蜜桃日落', color: '#fb7185', mode: 'light', style: 'glassmorphism', active: false },
    { name: '深海靛蓝', color: '#0ea5e9', mode: 'dark', style: 'solid', active: false },
  ];
  return {
    path: '/demo/data/theme_presets',
    presets: presets.map((p, i) => ({
      name: p.name,
      filename: `${p.name}.json`,
      size_bytes: 320 + i * 16,
      mtime: now - i * 86400,
      is_active: p.active,
      valid: true,
      config: {
        ...THEME_CONFIG,
        color: p.color,
        mode: p.mode as 'light' | 'dark',
        style: p.style as 'solid' | 'glassmorphism',
      },
    })),
  };
};

// ───────────────────────── Tier 1 · AI 记忆图谱 ─────────────────────────
// 页面流程：getScopes() → 选中首个 scope → getStats / getEntities / getEdges / getCategories。
// 用同一 scope_key + 一致的 entity id 体系，保证 sigma 力导图能连边成网。

const MEMORY_SCOPE_KEY = 'group:114514';

const ENTITY_NAMES = [
  '早柚', '旅行者', '派蒙', '可莉', '钟离', '雷电将军', '甘雨', '胡桃',
  '原神', '提瓦特', '蒙德', '璃月', '稻妻', '须弥', '抽卡', '深渊',
  '圣遗物', '武器', '元素反应', '剧情', '联机', '体力', '树脂', '每日委托',
];

const ENTITY_TAGS = ['人物', '地点', '游戏', '玩法', '系统', '概念'];

let memoryGraphCache: { entities: any[]; edges: any[]; categories: any[] } | null = null;

function buildMemoryGraph() {
  if (memoryGraphCache) return memoryGraphCache;
  const rng = makeRng(hashSeed(MEMORY_SCOPE_KEY));
  const baseTime = Date.parse('2026-06-01T08:00:00Z');

  const entities = ENTITY_NAMES.map((name, i) => ({
    id: `ent-${i}`,
    scope_key: MEMORY_SCOPE_KEY,
    name,
    summary: `「${name}」相关的记忆实体，由对话沉淀生成。`,
    tag: [pick(rng, ENTITY_TAGS)],
    is_speaker: i < 3,
    user_id: i < 3 ? `${100000 + i}` : null,
    created_at: new Date(baseTime + i * 3600_000).toISOString(),
    updated_at: new Date(baseTime + i * 7200_000).toISOString(),
  }));

  // 让每个节点至少连一条边，整体成网（力导图才有「网络感」）。
  const edges: any[] = [];
  const facts = ['提到了', '喜欢', '询问过', '关联到', '位于', '隶属于', '讨论了', '推荐了'];
  for (let i = 1; i < entities.length; i++) {
    const src = i;
    const tgt = randInt(rng, 0, i - 1);
    edges.push({
      id: `edge-${edges.length}`,
      scope_key: MEMORY_SCOPE_KEY,
      fact: `${entities[src].name} ${pick(rng, facts)} ${entities[tgt].name}`,
      source_entity_id: entities[src].id,
      target_entity_id: entities[tgt].id,
      valid_at: new Date(baseTime + i * 5400_000).toISOString(),
      invalid_at: null,
      created_at: new Date(baseTime + i * 5400_000).toISOString(),
      mention_count: randInt(rng, 1, 24),
      decay_score: Number(rng().toFixed(3)),
      last_accessed: new Date(baseTime + i * 9000_000).toISOString(),
    });
  }
  // 额外补一些交叉边，增加聚类感。
  for (let k = 0; k < 18; k++) {
    const a = randInt(rng, 0, entities.length - 1);
    const b = randInt(rng, 0, entities.length - 1);
    if (a === b) continue;
    edges.push({
      id: `edge-${edges.length}`,
      scope_key: MEMORY_SCOPE_KEY,
      fact: `${entities[a].name} ${pick(rng, facts)} ${entities[b].name}`,
      source_entity_id: entities[a].id,
      target_entity_id: entities[b].id,
      valid_at: new Date(baseTime + k * 4000_000).toISOString(),
      invalid_at: null,
      created_at: new Date(baseTime + k * 4000_000).toISOString(),
      mention_count: randInt(rng, 1, 12),
      decay_score: Number(rng().toFixed(3)),
      last_accessed: new Date(baseTime + k * 6000_000).toISOString(),
    });
  }

  const categories = ['角色', '世界观', '游戏玩法', '玩家偏好'].map((name, i) => ({
    id: `cat-${i}`,
    scope_key: MEMORY_SCOPE_KEY,
    name,
    summary: `「${name}」聚类，归纳了相关实体。`,
    tag: ['聚类'],
    layer: 1,
    parent_id: null,
    child_categories_count: 0,
    member_entities_count: randInt(rng, 3, 8),
    created_at: new Date(baseTime).toISOString(),
    updated_at: new Date(baseTime + 86400_000).toISOString(),
  }));

  memoryGraphCache = { entities, edges, categories };
  return memoryGraphCache;
}

export const generateMemoryScopes = () => {
  const g = buildMemoryGraph();
  return [
    {
      scope_key: MEMORY_SCOPE_KEY,
      scope_type: 'group',
      scope_id: '114514',
      episode_count: 128,
      entity_count: g.entities.length,
      edge_count: g.edges.length,
      category_count: g.categories.length,
    },
    {
      scope_key: 'private:10001',
      scope_type: 'private',
      scope_id: '10001',
      episode_count: 42,
      entity_count: 9,
      edge_count: 14,
      category_count: 2,
    },
  ];
};

export const generateMemoryStats = () => {
  const g = buildMemoryGraph();
  return {
    scope_key: MEMORY_SCOPE_KEY,
    episode_count: 128,
    entity_count: g.entities.length,
    speaker_entity_count: g.entities.filter((e) => e.is_speaker).length,
    edge_count: g.edges.length,
    active_edge_count: g.edges.length,
    category_count: g.categories.length,
    observation_queue_size: 3,
    scope_keys: [MEMORY_SCOPE_KEY, 'private:10001'],
  };
};

const paginate = <T>(items: T[], page = 1, pageSize = 100) => ({
  items,
  total: items.length,
  page,
  page_size: pageSize,
});

export const generateMemoryEntities = (page = 1, pageSize = 100) =>
  paginate(buildMemoryGraph().entities, page, pageSize);
export const generateMemoryEdges = (page = 1, pageSize = 100) =>
  paginate(buildMemoryGraph().edges, page, pageSize);
export const generateMemoryCategories = (page = 1, pageSize = 100) =>
  paginate(buildMemoryGraph().categories, page, pageSize);

// ───────────────────────── Tier 1 · 智能表情包 ─────────────────────────

const MEME_DESCS = [
  '派蒙惊讶张嘴', '旅行者无奈摊手', '可莉开心蹦跳', '钟离淡定喝茶', '雷电将军挥刀',
  '甘雨害羞捂脸', '胡桃坏笑', '早柚摸鱼睡觉', '八重神子托腮', '宵宫放烟花',
  '魈翻白眼', '温迪喝酒', '达达利亚比心', '神里绫华微笑', '枫原万叶看书',
  '荒泷一斗大笑', '五郎敬礼', '九条裟罗严肃', '珊瑚宫心海思考', '托马做饭',
];
const MEME_FOLDERS = ['开心', '无奈', '惊讶', '生气', '害羞', '日常'];
const MEME_STATUSES = ['tagged', 'tagged', 'tagged', 'pending', 'manual', 'rejected'] as const;
const MEME_PERSONAS = ['早柚', '可莉', '钟离', '通用'];

const buildMemeRecords = () => {
  const rng = makeRng(hashSeed('memes'));
  return MEME_DESCS.map((desc, i) => {
    const id = `meme-${String(i + 1).padStart(3, '0')}`;
    const folder = pick(rng, MEME_FOLDERS);
    return {
      meme_id: id,
      file_path: `/demo/memes/${id}.png`,
      file_size: randInt(rng, 30_000, 400_000),
      file_mime: 'image/png',
      width: 240,
      height: 240,
      source_group: `${randInt(rng, 100000, 999999)}`,
      folder,
      persona_hint: pick(rng, MEME_PERSONAS),
      emotion_tags: [folder, pick(rng, ['可爱', '搞笑', '高冷', '元气'])],
      scene_tags: [pick(rng, ['聊天', '整活', '回复', '斗图'])],
      description: desc,
      custom_tags: [],
      status: MEME_STATUSES[i % MEME_STATUSES.length],
      nsfw_score: Number((rng() * 0.1).toFixed(3)),
      use_count: randInt(rng, 0, 88),
      last_used_at: rng() > 0.3 ? new Date(Date.now() - randInt(rng, 0, 30) * 86400_000).toISOString() : null,
      last_used_group: `${randInt(rng, 100000, 999999)}`,
      created_at: new Date(Date.now() - randInt(rng, 1, 120) * 86400_000).toISOString(),
      tagged_at: new Date(Date.now() - randInt(rng, 0, 60) * 86400_000).toISOString(),
      updated_at: new Date(Date.now() - randInt(rng, 0, 30) * 86400_000).toISOString(),
    };
  });
};

let memeCache: ReturnType<typeof buildMemeRecords> | null = null;
const memeRecords = () => (memeCache ??= buildMemeRecords());

export const generateMemeList = (params: URLSearchParams) => {
  let records = memeRecords();
  const folder = params.get('folder');
  const status = params.get('status');
  const persona = params.get('persona_hint');
  const q = params.get('q');
  if (folder) records = records.filter((r) => r.folder === folder);
  if (status) records = records.filter((r) => r.status === status);
  if (persona) records = records.filter((r) => r.persona_hint === persona);
  if (q) records = records.filter((r) => r.description.includes(q));
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('page_size') ?? 24);
  const start = (page - 1) * pageSize;
  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    page,
    page_size: pageSize,
  };
};

export const generateMemePersonas = () => {
  const records = memeRecords();
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.persona_hint, (counts.get(r.persona_hint) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([persona_hint, count]) => ({ persona_hint, count, folder: '' }))
    .sort((a, b) => b.count - a.count);
};

export const generateMemeStats = () => {
  const records = memeRecords();
  const status_counts: Record<string, number> = {};
  const folder_counts: Record<string, number> = {};
  let total_usage = 0;
  for (const r of records) {
    status_counts[r.status] = (status_counts[r.status] ?? 0) + 1;
    folder_counts[r.folder] = (folder_counts[r.folder] ?? 0) + 1;
    total_usage += r.use_count;
  }
  const top_memes = [...records]
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, 5)
    .map((r) => ({ meme_id: r.meme_id, description: r.description, use_count: r.use_count, file_path: r.file_path }));
  return { total: records.length, status_counts, folder_counts, total_usage, top_memes };
};
