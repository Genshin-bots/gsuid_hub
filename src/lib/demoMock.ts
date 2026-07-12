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

import { DEMO_MEME_META } from './demoMemeMeta';

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

/** 已内置真实 ICON.png 的插件名（来自 gsuid_core/plugins/<x>/ICON.png，放在 demo-assets/demo-plugin-icons/）。 */
const DEMO_PLUGIN_ICON_IDS = new Set([
  'GenshinUID', 'ZZZeroUID', 'WutheringWavesUID', 'ArknightsUID', 'BlueArchiveUID',
  'LOLegendsUID', 'MajsoulUID', 'SayuStock', 'WzryUID', 'gsuid_core',
]);

/** 插件图标：优先返回内置的**真实 PNG**（/hub/demo-plugin-icons/<name>.png）；
 *  未内置者再退回「渐变底 + 首字母」占位，避免裂图/发素。 */
export function demoPluginIcon(name: string): string {
  if (DEMO_PLUGIN_ICON_IDS.has(name)) {
    return `${import.meta.env.BASE_URL}demo-plugin-icons/${name}.png`;
  }
  const rng = makeRng(hashSeed(`plugin-icon:${name}`));
  const h1 = randInt(rng, 0, 360);
  const h2 = (h1 + randInt(rng, 30, 120)) % 360;
  // 取前 1–2 个字母（去掉非字母字符），无字母则回退首字符
  const letters = (name.replace(/[^A-Za-z]/g, '').slice(0, 2) || name.slice(0, 2)).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h1},66%,56%)"/>` +
    `<stop offset="1" stop-color="hsl(${h2},62%,46%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="128" height="128" rx="28" fill="url(#g)"/>` +
    `<text x="64" y="64" font-size="56" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="ui-sans-serif,system-ui,sans-serif">${letters}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ───────────────────────── Tier 0 · 启动必备 ─────────────────────────

/** Demo 品牌图标：用 hub 自带的真实 PNG（public/ICON.png），而非 emoji 占位图。
 *  `import.meta.env.BASE_URL` 在 demo 构建下为 `/hub/`，解析为 `/hub/ICON.png`。 */
export const DEMO_BRAND_ICON = `${import.meta.env.BASE_URL}ICON.png`;

/** 假 admin 用户，喂给 AuthContext → isAuthenticated 恒真 → 跳过登录页。
 *  头像用真实 PNG（项目 LOGO，/hub/ICON.png），而非 emoji 占位图（见用户反馈：左下角应为图片头像）。 */
export const DEMO_USER = {
  id: 'demo-admin',
  email: 'admin@demo.sayu-bot.com',
  name: '演示管理员',
  role: 'admin' as const,
  avatar: DEMO_BRAND_ICON,
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
  // 副标题保持短（4 字）——过长会把侧边栏顶部的「收起」按钮挤出裁切（见用户反馈）。
  subtitle: '演示模式',
  icon_url: DEMO_BRAND_ICON,
  icon_source: 'default' as const,
  default: {
    icon: DEMO_BRAND_ICON,
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

// 仅列内置了真实 ICON.png 的插件（见 DEMO_PLUGIN_ICON_IDS），避免按钮组/列表出现占位渐变图标。
const PLUGIN_DEFS: Array<{ id: string; name: string; desc: string; enabled: boolean; status: string }> = [
  { id: 'GenshinUID', name: 'GenshinUID', desc: '原神 UID 查询面板、抽卡分析、深渊统计等一站式原神插件', enabled: true, status: 'ok' },
  { id: 'ZZZeroUID', name: 'ZZZeroUID', desc: '绝区零 代理人面板、邦布与驱动盘查询', enabled: true, status: 'ok' },
  { id: 'WutheringWavesUID', name: 'WutheringWavesUID', desc: '鸣潮 共鸣者面板与声骸词条分析', enabled: true, status: 'ok' },
  { id: 'ArknightsUID', name: 'ArknightsUID', desc: '明日方舟 干员练度与抽卡记录查询', enabled: false, status: 'disabled' },
  { id: 'BlueArchiveUID', name: 'BlueArchiveUID', desc: '蔚蓝档案 学生编成与攻略查询', enabled: true, status: 'ok' },
  { id: 'LOLegendsUID', name: 'LOLegendsUID', desc: '英雄联盟 召唤师战绩与对局数据查询', enabled: true, status: 'ok' },
  { id: 'MajsoulUID', name: 'MajsoulUID', desc: '雀魂麻将 牌谱、段位与立直率统计', enabled: false, status: 'disabled' },
  { id: 'SayuStock', name: 'SayuStock', desc: '早柚股市 A股 / 基金 行情查询与订阅推送', enabled: true, status: 'ok' },
  { id: 'WzryUID', name: 'WzryUID', desc: '王者荣耀 战绩查询与英雄出装数据', enabled: true, status: 'update_available' },
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

/** 绫华主题壁纸：直接用 gsuid_core 预设 themes_builtin/绫华.json 里的官方在线图
 *  （与其余预设一样走 URL，不再本地内置，省体积；联网加载）。 */
const DEMO_AYAKA_BG = 'https://files.seeusercontent.com/2026/06/20/Jth9/aeb070e9498a448d60e76caddd36432b.jpg';

/** 默认演示主题：直接加载「纯色质感」预设（light + 玻璃拟态 + 蓝色 + 透明磨砂卡片 + 透出底层装饰）——
 *  比带壁纸的预设更适合做首屏展示，不会喧宾夺主盖住内嵌面板的布局；
 *  也避免了某个动画背景在窄屏里被裁切的问题（见用户反馈：希望默认就是纯色质感）。 */
const THEME_CONFIG = {
  mode: 'light' as const,
  style: 'glassmorphism' as const,
  color: 'blue',
  icon_color: 'colored' as const,
  background_image: null,
  blur_intensity: 7,
  theme_preset: 'shadcn' as const,
  language: 'zh-CN' as const,
  card_opacity: 55,
  sidebar_layout: 'floating' as const,
  border_radius: 8,
  ui_scale: 97,
  shadow_intensity: 55,
  sidebar_default_collapsed: false,
};

export const generateThemeConfig = () => ({ ...THEME_CONFIG });

/** 内嵌 gsuid_core 自带的主题预设（gsuid_core/webconsole/themes_builtin/*.json）。
 *  演示模式没有真实后端预设目录，故把这些 JSON 直接内联，让「主题预设」标签页可用、可一键应用。 */
const BUILTIN_THEME_PRESETS: Array<{ name: string; config: Record<string, unknown> }> = [
  { name: '纯色质感', config: { mode: 'light', style: 'glassmorphism', color: 'blue', icon_color: 'colored', background_image: null, blur_intensity: 7, card_opacity: 55, theme_preset: 'shadcn', language: 'zh-CN' } },
  { name: '清澈波纹', config: { mode: 'light', style: 'glassmorphism', color: 'blue', icon_color: 'colored', background_image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80', blur_intensity: 11, card_opacity: 45, theme_preset: 'shadcn', language: 'zh-CN' } },
  { name: '磨砂岩石', config: { mode: 'dark', style: 'glassmorphism', color: 'blue', icon_color: 'colored', background_image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80', blur_intensity: 7, card_opacity: 55, theme_preset: 'shadcn', language: 'zh-CN' } },
  { name: '黑夜街道', config: { mode: 'dark', style: 'glassmorphism', color: 'blue', icon_color: 'colored', background_image: 'https://cdn.pixabay.com/photo/2024/05/26/15/27/anime-8788959_1280.jpg', blur_intensity: 7, card_opacity: 55, theme_preset: 'shadcn', language: 'zh-CN' } },
  { name: '初音未来', config: { mode: 'dark', style: 'glassmorphism', color: 'blue', icon_color: 'colored', background_image: 'https://files.seeusercontent.com/2026/06/20/kL1z/wallpaper894.jpg', blur_intensity: 7, card_opacity: 34, theme_preset: 'default', language: 'zh-CN' } },
  { name: '绫华', config: { mode: 'light', style: 'glassmorphism', color: 'orchid', icon_color: 'colored', background_image: DEMO_AYAKA_BG, blur_intensity: 8, card_opacity: 26, theme_preset: 'default', language: 'zh-CN' } },
  { name: '鬼针草', config: { mode: 'light', style: 'glassmorphism', color: 'pink', icon_color: 'colored', background_image: 'https://files.seeusercontent.com/2026/06/20/u2Sj/a694927.jpg', blur_intensity: 1, card_opacity: 54, theme_preset: 'default', language: 'zh-CN' } },
  { name: '随机老婆', config: { mode: 'light', style: 'glassmorphism', color: 'blue', icon_color: 'colored', background_image: 'https://api.paugram.com/wallpaper', blur_intensity: 8, card_opacity: 27, theme_preset: 'default', language: 'zh-CN' } },
];

export const generateThemePresets = () => {
  const now = Math.floor(Date.now() / 1000);
  return {
    path: 'gsuid_core/webconsole/themes_builtin',
    presets: BUILTIN_THEME_PRESETS.map((p, i) => ({
      name: p.name,
      filename: `${p.name}.json`,
      size_bytes: 280 + i * 9,
      mtime: now - i * 86400,
      is_active: p.name === '纯色质感', // 默认主题即纯色质感预设 → 预设页高亮「已应用」
      valid: true,
      config: p.config,
    })),
  };
};

/** 应用某个预设：返回 { name, config }，供 ThemesPage 调 applyThemeConfig 真正切换主题。 */
export const applyThemePreset = (name: string) => {
  const found = BUILTIN_THEME_PRESETS.find((p) => p.name === name);
  return { name, config: found ? found.config : { ...THEME_CONFIG } };
};

// ───────────────────────── Tier 1 · AI 记忆图谱 ─────────────────────────
// 页面流程：getScopes() → 选中首个 scope → getStats / getEntities / getEdges / getCategories。
// 用同一 scope_key + 一致的 entity id 体系，保证 sigma 力导图能连边成网。

const MEMORY_SCOPE_KEY = 'group:114514';

const ENTITY_NAMES = [
  '早柚', '旅行者', '派蒙', '可莉', '钟离', '雷电将军', '甘雨', '胡桃',
  '宵宫', '神里绫华', '枫原万叶', '八重神子', '纳西妲', '温迪', '达达利亚', '魈',
  '原神', '提瓦特', '蒙德', '璃月', '稻妻', '须弥', '枫丹', '至冬',
  '抽卡', '深渊', '圣遗物', '武器', '元素反应', '剧情', '联机', '体力',
  '树脂', '每日委托', '锻造', '料理', '尘歌壶', '七圣召唤',
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
  // 额外补大量交叉边，让力导图明显成网（去重避免重复连线）。
  const seen = new Set(edges.map((e) => `${e.source_entity_id}->${e.target_entity_id}`));
  let attempts = 0;
  const TARGET_CROSS = Math.round(entities.length * 2.4); // 边/点 ≈ 3.4，足够密
  while (edges.length - (entities.length - 1) < TARGET_CROSS && attempts++ < TARGET_CROSS * 12) {
    const a = randInt(rng, 0, entities.length - 1);
    const b = randInt(rng, 0, entities.length - 1);
    if (a === b) continue;
    const key = `${entities[a].id}->${entities[b].id}`;
    if (seen.has(key) || seen.has(`${entities[b].id}->${entities[a].id}`)) continue;
    seen.add(key);
    const k = edges.length;
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

// ───────────────────────── Tier 1 · 智能表情包（真实素材，来自 .meme 归档）─────────────────────────

/** demo 表情包真实图片地址：指向 demo-assets/demo-memes/（构建后 /hub/demo-memes/<file>）。 */
export const demoMemeImageUrl = (memeId: string): string => {
  const m = DEMO_MEME_META.find((x) => x.meme_id === memeId);
  return m ? `${import.meta.env.BASE_URL}demo-memes/${m.file}` : demoPlaceholderImage(memeId);
};

// 真实归档里 status 全是 'tagged'，会让「待打标/手动/已拒绝」等统计与筛选 Tab 全空。
// 演示模式下按下标确定性地分散状态（图片/标签/描述仍是真实的），让统计卡与筛选都有内容。
const MEME_STATUS_CYCLE = ['tagged', 'tagged', 'tagged', 'tagged', 'pending', 'manual', 'tagged', 'rejected'] as const;

/** 由真实元数据构建完整 MemeRecord（补齐使用次数/时间等运营字段，种子化稳定）。 */
const buildMemeRecords = () =>
  DEMO_MEME_META.map((m, i) => {
    const rng = makeRng(hashSeed(m.meme_id));
    const used = randInt(rng, 0, 132);
    const daysAgo = (lo: number, hi: number) =>
      new Date(Date.now() - randInt(rng, lo, hi) * 86400_000).toISOString();
    return {
      meme_id: m.meme_id,
      file_path: `${m.folder}/${m.file}`,
      file_size: m.file_size,
      file_mime: m.file_mime,
      width: m.width,
      height: m.height,
      source_group: `${randInt(rng, 100000, 999999)}`,
      folder: m.folder,
      persona_hint: m.persona_hint,
      emotion_tags: m.emotion_tags,
      scene_tags: m.scene_tags,
      description: m.description,
      custom_tags: m.custom_tags,
      status: MEME_STATUS_CYCLE[i % MEME_STATUS_CYCLE.length],
      nsfw_score: m.nsfw_score,
      use_count: used,
      last_used_at: used > 0 ? daysAgo(0, 30) : null,
      last_used_group: `${randInt(rng, 100000, 999999)}`,
      created_at: daysAgo(30, 220),
      tagged_at: daysAgo(0, 30),
      updated_at: daysAgo(0, 20),
    };
  });

let memeCache: ReturnType<typeof buildMemeRecords> | null = null;
const memeRecords = () => (memeCache ??= buildMemeRecords());

/** 单条详情：MemeDetailDialog 点击表情时调用 GET /api/meme/{id}。
 *  必须返回完整记录——否则 `[...meme.emotion_tags]` 等会因字段缺失而抛错白屏（见用户反馈）。 */
export const generateMemeDetail = (memeId: string) =>
  memeRecords().find((r) => r.meme_id === memeId) ?? memeRecords()[0];

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

// ───────────────────────── Tier 1 · 插件数据库 ─────────────────────────
// DatabasePage 流程：getPlugins() → 选中首个插件首张表 → getTableMetadata(table) + getTableData(table)。
// 形状以 api.ts 的 PluginDatabaseInfo / DatabaseTableInfo / PaginatedData 为准。

interface DemoDbColumn { name: string; title: string; type: string; nullable: boolean; default: unknown }
interface DemoDbTable {
  table_name: string;
  label: string;
  pk_name: string;
  columns: DemoDbColumn[];
  rowCount: number;
  makeRow: (rng: () => number, i: number) => Record<string, unknown>;
}
interface DemoDbPlugin { plugin_id: string; plugin_name: string; tables: DemoDbTable[] }

const DB_BOTS = ['onebot', 'telegram', 'discord'] as const;
const col = (name: string, title: string, type: string, nullable = false, def: unknown = null): DemoDbColumn =>
  ({ name, title, type, nullable, default: def });

const genshinUid = (rng: () => number) => `${pick(rng, ['1', '5', '6', '7', '8', '9'])}${randInt(rng, 10000000, 99999999)}`;
const maskCookie = (rng: () => number) =>
  `account_id=${randInt(rng, 10000000, 99999999)};cookie_token=${hashSeed(String(rng())).toString(16)}************`;
const onoff = (rng: () => number) => (rng() > 0.4 ? 'on' : 'off');

const DB_PLUGINS: DemoDbPlugin[] = [
  {
    plugin_id: 'GenshinUID',
    plugin_name: 'GenshinUID',
    tables: [
      {
        table_name: 'GsBind', label: '原神绑定', pk_name: 'id', rowCount: 36,
        columns: [
          col('id', 'ID', 'INTEGER'), col('bot_id', 'Bot', 'TEXT'), col('user_id', '用户ID', 'TEXT'),
          col('group_id', '群号', 'TEXT', true), col('uid', '原神UID', 'TEXT', true), col('sr_uid', '星铁UID', 'TEXT', true),
        ],
        makeRow: (rng, i) => ({
          id: i + 1, bot_id: pick(rng, DB_BOTS), user_id: `${randInt(rng, 100000, 9999999)}`,
          group_id: rng() > 0.3 ? `${randInt(rng, 100000, 999999)}` : null,
          uid: genshinUid(rng), sr_uid: rng() > 0.5 ? genshinUid(rng) : null,
        }),
      },
      {
        table_name: 'GsUser', label: '原神用户', pk_name: 'id', rowCount: 28,
        columns: [
          col('id', 'ID', 'INTEGER'), col('bot_id', 'Bot', 'TEXT'), col('user_id', '用户ID', 'TEXT'),
          col('uid', '原神UID', 'TEXT'), col('cookie', 'Cookie', 'TEXT', true),
          col('stoken', 'SToken', 'TEXT', true), col('sign_switch', '自动签到', 'TEXT'), col('push_switch', '推送开关', 'TEXT'),
        ],
        makeRow: (rng, i) => ({
          id: i + 1, bot_id: pick(rng, DB_BOTS), user_id: `${randInt(rng, 100000, 9999999)}`,
          uid: genshinUid(rng), cookie: maskCookie(rng), stoken: rng() > 0.5 ? maskCookie(rng) : null,
          sign_switch: onoff(rng), push_switch: onoff(rng),
        }),
      },
    ],
  },
  {
    plugin_id: 'ZZZeroUID',
    plugin_name: 'ZZZeroUID',
    tables: [
      {
        table_name: 'ZzzBind', label: '绝区零绑定', pk_name: 'id', rowCount: 22,
        columns: [
          col('id', 'ID', 'INTEGER'), col('bot_id', 'Bot', 'TEXT'), col('user_id', '用户ID', 'TEXT'),
          col('group_id', '群号', 'TEXT', true), col('uid', '绝区零UID', 'TEXT'),
        ],
        makeRow: (rng, i) => ({
          id: i + 1, bot_id: pick(rng, DB_BOTS), user_id: `${randInt(rng, 100000, 9999999)}`,
          group_id: rng() > 0.3 ? `${randInt(rng, 100000, 999999)}` : null, uid: genshinUid(rng),
        }),
      },
      {
        table_name: 'ZzzUser', label: '绝区零用户', pk_name: 'id', rowCount: 19,
        columns: [
          col('id', 'ID', 'INTEGER'), col('bot_id', 'Bot', 'TEXT'), col('user_id', '用户ID', 'TEXT'),
          col('uid', '绝区零UID', 'TEXT'), col('cookie', 'Cookie', 'TEXT', true), col('sign_switch', '自动签到', 'TEXT'),
        ],
        makeRow: (rng, i) => ({
          id: i + 1, bot_id: pick(rng, DB_BOTS), user_id: `${randInt(rng, 100000, 9999999)}`,
          uid: genshinUid(rng), cookie: maskCookie(rng), sign_switch: onoff(rng),
        }),
      },
    ],
  },
  {
    plugin_id: 'gsuid_core',
    plugin_name: 'gsuid_core',
    tables: [
      {
        table_name: 'Subscribe', label: '订阅推送', pk_name: 'id', rowCount: 31,
        columns: [
          col('id', 'ID', 'INTEGER'), col('bot_id', 'Bot', 'TEXT'), col('user_id', '用户ID', 'TEXT'),
          col('group_id', '群号', 'TEXT', true), col('task_name', '任务', 'TEXT'), col('extra_message', '备注', 'TEXT', true),
        ],
        makeRow: (rng, i) => ({
          id: i + 1, bot_id: pick(rng, DB_BOTS), user_id: `${randInt(rng, 100000, 9999999)}`,
          group_id: rng() > 0.25 ? `${randInt(rng, 100000, 999999)}` : null,
          task_name: pick(rng, ['原神签到', '体力提醒', '米游币获取', '星铁签到', '深渊推送', '版本活动']),
          extra_message: rng() > 0.6 ? pick(rng, ['每日 08:00', '体力溢出提醒', '仅限管理员']) : null,
        }),
      },
    ],
  },
];

let dbDataCache: Record<string, Record<string, unknown>[]> | null = null;
function dbRows(table: DemoDbTable): Record<string, unknown>[] {
  dbDataCache ??= {};
  if (dbDataCache[table.table_name]) return dbDataCache[table.table_name];
  const rng = makeRng(hashSeed(`db:${table.table_name}`));
  const rows = Array.from({ length: table.rowCount }, (_, i) => table.makeRow(rng, i));
  dbDataCache[table.table_name] = rows;
  return rows;
}
const findTable = (tableName: string): DemoDbTable | undefined => {
  for (const p of DB_PLUGINS) {
    const t = p.tables.find((tb) => tb.table_name === tableName);
    if (t) return t;
  }
  return undefined;
};
const tableInfo = (t: DemoDbTable) => ({ table_name: t.table_name, label: t.label, pk_name: t.pk_name, columns: t.columns });

export const generateDatabasePlugins = () =>
  DB_PLUGINS.map((p) => ({ plugin_id: p.plugin_id, plugin_name: p.plugin_name, tables: p.tables.map(tableInfo) }));

export const generateTableMetadata = (tableName: string) => {
  const t = findTable(tableName);
  return t ? tableInfo(t) : { table_name: tableName, label: tableName, pk_name: 'id', columns: [] };
};

export const generateTableData = (tableName: string, params: URLSearchParams) => {
  const t = findTable(tableName);
  const page = Number(params.get('page') ?? 1);
  const perPage = Number(params.get('per_page') ?? 20);
  if (!t) return { items: [], total: 0, page, per_page: perPage };
  let rows = dbRows(t);
  const search = params.get('search');
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q)));
  }
  const start = (page - 1) * perPage;
  return { items: rows.slice(start, start + perPage), total: rows.length, page, per_page: perPage };
};
