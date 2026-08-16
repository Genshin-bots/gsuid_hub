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
export const generateMemeDetail = (memeId: string) => {
  const all = memeRecords();
  if (!all.length) {
    // 极端兜底：无素材时仍返回合法空记录，避免前端展开 undefined
    return {
      meme_id: memeId || 'demo-empty',
      file_path: 'common/placeholder.png',
      file_size: 0,
      file_mime: 'image/png',
      width: 0,
      height: 0,
      source_group: '',
      folder: 'common',
      persona_hint: 'common',
      emotion_tags: [] as string[],
      scene_tags: [] as string[],
      description: '',
      custom_tags: [] as string[],
      status: 'tagged' as const,
      nsfw_score: 0,
      use_count: 0,
      last_used_at: null as string | null,
      last_used_group: '',
      created_at: new Date().toISOString(),
      tagged_at: null as string | null,
      updated_at: new Date().toISOString(),
    };
  }
  return all.find((r) => r.meme_id === memeId) ?? all[0];
};

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

// ===================
// Tier 2 · 补漏洞：让 demo 模式必崩页面也能正常打开
// ===================
// 详见 `docs/skills/gshub-development/references/10-pitfalls-and-performance.md` P-26。
// 这里集中给 /logs /persona-config /mcp-config /ai-statistics /ai-budget /backup /ai-kanban /ai-config
// 这些页面所必需的 mock 数据，让 `npm run dev:demo` 全跑通。

// ---- Logs（LogsPage） ----
const DEMO_LOG_SOURCES = ['onebot-114514', 'tg-sayu', 'dc-sayu', 'gsuid_core', 'GsCoreAI'];
const DEMO_LOG_MODULES = ['handle_event', 'ai_core.handle_ai', 'mcp.loader', 'plugin.loader', 'web'];
const DEMO_LOG_MESSAGES = [
  '收到消息 用户 114514 在群 10086',
  'plugin.match_trigger 命中 gs_help',
  'AI Session 已恢复 session_uuid=8d8e',
  'tool_call to_ai took 0.92s',
  '记忆 ingestion flush 12 episodes',
  'MCP server openai-tools reloaded',
  'heartbeat persona sayu check 1/3 groups',
  'kanban task task-2026-07-20-001 progress',
  'plugin SayuStock.update_available',
  'gsuid_core.scheduler tick at 12:00:00',
];
export const generateLogEntries = (params: URLSearchParams) => {
  const date = params.get('date') ?? new Date().toISOString().split('T')[0];
  const level = params.get('level') ?? '';
  const source = params.get('source') ?? '';
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('page_size') ?? 50);
  const rng = makeRng(hashSeed(`logs:${date}`));
  const levels = ['DEBUG', 'INFO', 'INFO', 'INFO', 'WARNING', 'ERROR'];
  const items: Array<Record<string, unknown>> = [];
  const total = 320;
  for (let i = 0; i < total; i++) {
    items.push({
      id: `log-${i}`,
      timestamp: `${date}T${String(randInt(rng, 0, 23)).padStart(2, '0')}:${String(randInt(rng, 0, 59)).padStart(2, '0')}:${String(randInt(rng, 0, 59)).padStart(2, '0')}.${randInt(rng, 100, 999)}`,
      level: pick(rng, levels),
      source: pick(rng, DEMO_LOG_SOURCES),
      module: pick(rng, DEMO_LOG_MODULES),
      message: pick(rng, DEMO_LOG_MESSAGES),
      bot_id: pick(rng, ['onebot-114514', 'tg-sayu', 'dc-sayu']),
    });
  }
  const filtered = items.filter(
    (it) => (!level || it.level === level) && (!source || it.source === source),
  );
  const start = (page - 1) * pageSize;
  return { items: filtered.slice(start, start + pageSize), total: filtered.length, page, page_size: pageSize };
};
export const generateLogDates = () => {
  const today = new Date();
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().split('T')[0];
  });
};
export const generateLogSources = () => [
  { name: 'onebot-114514', count: 124 },
  { name: 'tg-sayu', count: 64 },
  { name: 'dc-sayu', count: 31 },
  ...DEMO_LOG_SOURCES.filter((s) => !['onebot-114514', 'tg-sayu', 'dc-sayu'].includes(s)).map((s) => ({ name: s, count: 24 })),
];
export const generateLogLevels = () => [
  { label: '全部', value: 'all' },
  { label: 'TRACE', value: 'trace' },
  { label: 'DEBUG', value: 'debug' },
  { label: 'INFO', value: 'info' },
  { label: 'SUCCESS', value: 'success' },
  { label: 'WARNING', value: 'warning' },
  { label: 'ERROR', value: 'error' },
  { label: 'CRITICAL', value: 'critical' },
];
export const generateLogStats = () => ({
  total_entries: 1842,
  by_level: { DEBUG: 512, INFO: 1043, WARNING: 224, ERROR: 58, CRITICAL: 5 },
  by_source: Object.fromEntries(DEMO_LOG_SOURCES.map((s) => [s, Math.floor(80 + Math.random() * 400)])),
  busiest_date: new Date().toISOString().split('T')[0],
});

const DEMO_LOG_LEVEL_VALUES = new Set([
  'trace',
  'debug',
  'info',
  'success',
  'warning',
  'error',
  'critical',
]);

let demoLogsConfig: { visible_levels: string[] } = {
  visible_levels: ['debug', 'info', 'warning', 'error'],
};

export const generateLogConfig = () => ({
  visible_levels: [...demoLogsConfig.visible_levels],
});

export const applyLogConfig = (body: unknown) => {
  const raw =
    body && typeof body === 'object' && Array.isArray((body as { visible_levels?: unknown }).visible_levels)
      ? ((body as { visible_levels: unknown[] }).visible_levels)
      : [];
  const seen = new Set<string>();
  const levels: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const v = item.trim().toLowerCase();
    if (!v || v === 'all' || !DEMO_LOG_LEVEL_VALUES.has(v) || seen.has(v)) continue;
    seen.add(v);
    levels.push(v);
  }
  demoLogsConfig = { visible_levels: levels };
  return generateLogConfig();
};

// ---- Persona（PersonaConfigPage） ----
const DEMO_PERSONAS = [
  {
    name: '早柚',
    description: 'Wind Spirit. 是一只来自璃月的小风精灵，活泼可爱，喜欢早安问候与小憩。',
    enabled: true,
    scope: 'global' as const,
    target_groups: [] as string[],
    ai_mode: ['mention'],
    avatar: demoPlaceholderImage('persona-sayu', '早柚'),
    bound_groups_count: 0,
    is_default: false,
  },
  {
    name: '可莉',
    description: '嘟嘟可大魔王. 西风骑士团火花骑士，热爱炸鱼与画画。',
    enabled: true,
    scope: 'specific' as const,
    target_groups: ['114514', '1919810'],
    ai_mode: ['mention', 'inspect'],
    avatar: demoPlaceholderImage('persona-klee', '可莉'),
    bound_groups_count: 2,
    is_default: false,
  },
  {
    name: '钟离',
    description: '岩神. 来自璃月的神明，沉稳渊博，对人类与历史充满兴趣。',
    enabled: false,
    scope: 'disabled' as const,
    target_groups: [],
    ai_mode: ['mention'],
    avatar: demoPlaceholderImage('persona-zhongli', '钟离'),
    bound_groups_count: 0,
    is_default: false,
  },
  {
    name: '派蒙',
    description: '应急食品. 最好的旅伴。',
    enabled: true,
    scope: 'specific' as const,
    target_groups: ['10086'],
    ai_mode: ['mention'],
    avatar: demoPlaceholderImage('persona-paimon', '派蒙'),
    bound_groups_count: 1,
    is_default: true,
  },
];
export const generatePersonaList = () =>
  DEMO_PERSONAS.map((p) => ({
    name: p.name,
    description: p.description,
    enabled: p.enabled,
    scope: p.scope,
    target_groups: p.target_groups,
    ai_mode: p.ai_mode,
    avatar: p.avatar,
    is_default: p.is_default,
    bound_groups_count: p.bound_groups_count,
    has_audio: false,
  }));
export const generatePersonaDetail = (name: string) => {
  const found = DEMO_PERSONAS.find((p) => p.name === name) ?? DEMO_PERSONAS[0];
  return {
    ...found,
    content_md: `# ${found.name}\n\n${found.description}\n\n## 行为准则\n- 礼貌回应，称呼对方为「旅行者」\n- 不讨论实时新闻\n- 当涉及战斗话题时，给出角色向建议\n`,
    audio: null,
    image: null,
    has_audio: false,
    config: {
      enable_persona: found.enabled,
      ai_mode: found.ai_mode,
      scope: found.scope,
      target_groups: found.target_groups,
      inspect_interval: 30,
      trigger_words: ['早柚', '小风'],
    },
  };
};
export const generatePersonaConfigAll = () =>
  DEMO_PERSONAS.map((p) => ({
    name: p.name,
    enable_persona: p.enabled,
    ai_mode: p.ai_mode,
    scope: p.scope,
    target_groups: p.target_groups,
  }));
export const generateGlobalPersonaConfig = () => {
  const enabled = DEMO_PERSONAS.filter((p) => p.enabled);
  return {
    enabled_personas: enabled.map((p) => p.name),
    default_persona: enabled[0]?.name ?? '早柚',
  };
};

// ---- MCP（MCPConfigPage） ----
const DEMO_MCP_CONFIGS = [
  {
    config_id: 'mcp-openai-tools',
    name: 'OpenAI Tools MCP',
    description: '由 OpenAI 官方维护的计算与文件处理 MCP',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-openai',
    env_keys: ['OPENAI_API_KEY'],
    args: [] as string[],
    url: '',
    headers: {} as Record<string, string>,
    enabled: true,
    tools_count: 6,
    last_loaded_at: new Date(Date.now() - 600_000).toISOString(),
  },
  {
    config_id: 'mcp-brave-search',
    name: 'Brave Search MCP',
    description: 'Brave 搜索 MCP，支持实时网页搜索',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-brave-search',
    env_keys: ['BRAVE_API_KEY'],
    args: [] as string[],
    url: '',
    headers: {} as Record<string, string>,
    enabled: true,
    tools_count: 2,
    last_loaded_at: new Date(Date.now() - 1800_000).toISOString(),
  },
  {
    config_id: 'mcp-filesystem',
    name: 'Filesystem MCP',
    description: '受限访问工作区与产物目录的文件 MCP',
    transport: 'stdio',
    command: 'mcp-server-filesystem',
    env_keys: ['ALLOWED_DIRS'],
    args: ['/data/kanban_workspace'],
    url: '',
    headers: {} as Record<string, string>,
    enabled: false,
    tools_count: 0,
    last_loaded_at: null,
  },
  {
    config_id: 'mcp-remote-http',
    name: 'Remote HTTP MCP',
    description: '通过 Streamable HTTP 连接的远程 MCP',
    transport: 'streamable_http',
    command: '',
    env_keys: [],
    args: [],
    url: 'https://example.com/mcp',
    headers: { Authorization: 'Bearer ••••••••' },
    enabled: true,
    tools_count: 3,
    last_loaded_at: new Date(Date.now() - 300_000).toISOString(),
  },
];
export const generateMCPConfigList = () =>
  DEMO_MCP_CONFIGS.map((c) => ({
    config_id: c.config_id,
    name: c.name,
    description: c.description,
    transport: c.transport,
    command: c.command,
    args: c.args,
    env: Object.fromEntries((c.env_keys ?? []).map((k) => [k, '••••••••'])),
    url: c.url,
    headers: c.headers,
    enabled: c.enabled,
    register_as_ai_tools: false,
    tools: Array.from({ length: c.tools_count }, (_, i) => ({
      name: `tool_${i + 1}`,
      description: 'demo tool',
    })),
    tool_permissions: {},
    last_loaded_at: c.last_loaded_at,
  }));
export const generateMCPConfigDetail = (configId: string) => {
  const c = DEMO_MCP_CONFIGS.find((x) => x.config_id === configId) ?? DEMO_MCP_CONFIGS[0];
  return {
    ...c,
    env: Object.fromEntries(c.env_keys.map((k) => [k, '••••••••'])),
    tools: [
      { name: `${c.name.split(' ')[0].toLowerCase()}_search`, description: '搜索并返回结果', input_schema: { type: 'object', properties: { q: { type: 'string' } } } },
      { name: `${c.name.split(' ')[0].toLowerCase()}_summarize`, description: '对输入文本做摘要', input_schema: { type: 'object', properties: { text: { type: 'string' } } } },
    ],
  };
};
export const generateMCPPresets = () => [
  { name: 'OpenAI Tools', description: 'OpenAI 官方维护的 MCP，包含计算器与文件处理工具', transport: 'stdio' },
  { name: 'Brave Search', description: 'Brave Search 官方 MCP，提供实时搜索能力', transport: 'stdio' },
  { name: 'Filesystem (受限)', description: '限制到 Kanban Workspace 的文件系统 MCP', transport: 'stdio' },
  {
    name: 'Remote HTTP',
    description: '通过 Streamable HTTP 连接的远程 MCP',
    transport: 'streamable_http',
    url: 'https://example.com/mcp',
  },
];

// ---- AI Statistics（AIStatisticsPage） ----
export const generateAIStatisticsSummary = () => ({
  date: new Date().toISOString().split('T')[0],
  token_usage: {
    total_input_tokens: 612_309,
    total_output_tokens: 933_120,
    total_cache_read_tokens: 280_000,
    total_cache_write_tokens: 16_882,
    by_model: [],
    by_type: [],
  },
  latency: { avg: 1.24, p95: 3.8 },
  intent_distribution: {
    闲聊: { count: 120, percentage: 45 },
    角色互动: { count: 80, percentage: 30 },
    数据查询: { count: 66, percentage: 25 },
  },
  errors: {
    timeout: 4,
    rate_limit: 2,
    network_error: 1,
    usage_limit: 0,
    agent_error: 1,
    api_529_error: 0,
    total: 8,
  },
  heartbeat: {
    should_speak_true: 18,
    should_speak_false: 42,
    conversion_rate: 30,
  },
  trigger_distribution: {
    mention: { count: 100, percentage: 50 },
    command: { count: 60, percentage: 30 },
    inspect: { count: 40, percentage: 20 },
  },
  rag: { hit_count: 72, miss_count: 28, hit_rate: 72 },
  memory: {
    observations: 240,
    ingestions: 210,
    ingestion_errors: 3,
    retrievals: 180,
    entities_created: 42,
    edges_created: 65,
    episodes_created: 88,
  },
  efficiency: {
    user_turn_count: 128,
    agent_run_count: 341,
    root_agent_run_count: 130,
    nested_agent_run_count: 211,
    user_turn_agent_run_count: 320,
    user_turn_input_tokens: 420_000,
    user_turn_output_tokens: 192_000,
    user_turn_cache_read_tokens: 280_000,
    user_turn_cache_write_tokens: 16_000,
    avg_tokens_per_user_turn: 4781.25,
    avg_input_tokens_per_user_turn: 3281.25,
    avg_output_tokens_per_user_turn: 1500,
    avg_tokens_per_agent_run: 4528.21,
    avg_input_tokens_per_agent_run: 1795.63,
    avg_output_tokens_per_agent_run: 2735.25,
    avg_agent_runs_per_user_turn: 2.5,
  },
  active_users: [],
});
export const generateTokenByModel = () => [
  { model: 'anthropic/claude-opus-4-8', total_tokens: 1_122_000, input_tokens: 360_000, output_tokens: 762_000, requests: 3_120 },
  { model: 'anthropic/claude-haiku-4-5', total_tokens: 482_000, input_tokens: 200_000, output_tokens: 120_000, requests: 7_801 },
  { model: 'openai/gpt-4o-mini', total_tokens: 210_311, input_tokens: 52_309, output_tokens: 51_120, requests: 1_461 },
  { model: 'local/embedding-bge-m3', total_tokens: 28_000, input_tokens: 0, output_tokens: 0, requests: 100 },
];
export const generateTokenByType = () => [
  { type: 'chat', total_tokens: 1_500_000, requests: 9_000 },
  { type: 'tool_call', total_tokens: 220_000, requests: 2_800 },
  { type: 'embedding', total_tokens: 110_000, requests: 600 },
  { type: 'rerank', total_tokens: 12_311, requests: 82 },
];
export const generateActiveUsers = () => [
  { user_id: '10086', display_name: '旅行者-夜兰', interactions: 412, kind: 'user' },
  { user_id: '1919810', display_name: '可莉的团长', interactions: 318, kind: 'user' },
  { user_id: 'group:114514', display_name: '原神内鬼群', interactions: 1_240, kind: 'group' },
  { user_id: 'group:10086', display_name: '日常吹水', interactions: 982, kind: 'group' },
];
export const generateTriggerDistribution = () => [
  { trigger: 'mention', count: 6_120, ratio: 0.49 },
  { trigger: 'command', count: 4_812, ratio: 0.385 },
  { trigger: 'inspect', count: 1_122, ratio: 0.09 },
  { trigger: 'auto', count: 428, ratio: 0.035 },
];
export const generateIntentDistribution = () => [
  { intent: '闲聊', count: 5_320 },
  { intent: '角色互动', count: 2_812 },
  { intent: '数据查询', count: 1_120 },
  { intent: '其它', count: 628 },
];
export const generateErrorStats = () => [
  { code: 'rate_limit', count: 32, last_seen_at: new Date(Date.now() - 600_000).toISOString() },
  { code: 'timeout', count: 18, last_seen_at: new Date(Date.now() - 1200_000).toISOString() },
  { code: 'bad_request', count: 12, last_seen_at: new Date(Date.now() - 3600_000).toISOString() },
  { code: 'auth_error', count: 4, last_seen_at: new Date(Date.now() - 7200_000).toISOString() },
];
export const generateHeartbeatStats = () => ({
  inspected_groups: 12,
  raised_alerts: 3,
  total_rounds: 168,
  avg_round_seconds: 4.2,
});
export const generateRAGStats = () => ({
  total_queries: 982,
  hit_count: 720,
  hit_rate: 0.733,
  top_docs: [
    { doc_id: 'doc-001', title: '原神角色图鉴', hit_count: 312 },
    { doc_id: 'doc-013', title: '七圣召唤规则', hit_count: 192 },
    { doc_id: 'doc-029', title: '深渊配队攻略', hit_count: 99 },
  ],
});
export const generateTokenByRange = () => ({
  start: new Date(Date.now() - 6 * 86400_000).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0],
  total: {
    input_tokens: 612_309,
    output_tokens: 933_120,
    cache_read_tokens: 280_000,
    cache_write_tokens: 16_882,
    total_tokens: 1_545_429,
  },
  daily: Array.from({ length: 7 }).map((_, i) => {
    const input = 70_000 + i * 5_000;
    const output = 90_000 + i * 4_000;
    return {
      date: new Date(Date.now() - (6 - i) * 86400_000).toISOString().split('T')[0],
      input_tokens: input,
      output_tokens: output,
      cache_read_tokens: Math.floor(input * 0.2),
      cache_write_tokens: Math.floor(input * 0.03),
      total_tokens: input + output,
    };
  }),
  by_model: [
    {
      model: 'anthropic/claude-opus-4-8',
      input_tokens: 360_000,
      output_tokens: 762_000,
      cache_read_tokens: 100_000,
      cache_write_tokens: 8_000,
      total_tokens: 1_122_000,
    },
    {
      model: 'anthropic/claude-haiku-4-5',
      input_tokens: 200_000,
      output_tokens: 120_000,
      cache_read_tokens: 80_000,
      cache_write_tokens: 4_000,
      total_tokens: 320_000,
    },
  ],
});
export const generatePerformanceHourly = () => {
  return Array.from({ length: 24 }).map((_, i) => ({
    hour: i,
    providers: [
      {
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        request_count: 20 + Math.floor(Math.random() * 40),
        ttft_min_ms: 200,
        ttft_max_ms: 1200,
        ttft_avg_ms: 400 + Math.floor(Math.random() * 300),
        tps_min: 20,
        tps_max: 90,
        tps_avg: 35 + Math.random() * 20,
        input_tokens: 5000 + Math.floor(Math.random() * 3000),
        output_tokens: 3000 + Math.floor(Math.random() * 2000),
        cache_read_tokens: 800,
        cache_write_tokens: 120,
        tool_call_count: 2 + Math.floor(Math.random() * 6),
      },
    ],
  }));
};
export const generatePerformanceHourlyRange = () => {
  // Flat rows matching HourlyPerformanceRangeItem for aggregatePerformanceByDate
  const rows: Array<{
    date: string;
    hour: number;
    provider: string;
    model: string;
    request_count: number;
    ttft_min_ms: number;
    ttft_max_ms: number;
    ttft_avg_ms: number;
    tps_min: number;
    tps_max: number;
    tps_avg: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    tool_call_count: number;
  }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - (6 - i) * 86400_000);
    const date = d.toISOString().split('T')[0];
    for (const hour of [9, 12, 18, 21]) {
      rows.push({
        date,
        hour,
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        request_count: 80 + Math.floor(Math.random() * 40),
        ttft_min_ms: 200,
        ttft_max_ms: 1200,
        ttft_avg_ms: 450 + Math.floor(Math.random() * 200),
        tps_min: 20,
        tps_max: 80,
        tps_avg: 40 + Math.random() * 15,
        input_tokens: 12_000,
        output_tokens: 8_000,
        cache_read_tokens: 2_000,
        cache_write_tokens: 400,
        tool_call_count: 10 + Math.floor(Math.random() * 8),
      });
    }
  }
  return rows;
};

// ---- AI Budget（AIBudgetPage） ----
const DEMO_BUDGET_RULES = [
  {
    rule_id: 'rule-global-5h',
    name: '全局 5h 限额',
    scope_type: 'global',
    window: '5h',
    token_limit: 200_000,
    enabled: true,
  },
  {
    rule_id: 'rule-group-114514',
    name: '原神内鬼群 每天限额',
    scope_type: 'group',
    scope_id: '114514',
    window: 'daily',
    token_limit: 80_000,
    enabled: true,
  },
  {
    rule_id: 'rule-member-10086',
    name: '夜兰 个人每周限额',
    scope_type: 'member',
    scope_id: '10086',
    window: 'weekly',
    token_limit: 30_000,
    enabled: false,
  },
];
export const generateBudgetConfig = () => ({
  enable: true,
  count_mode: 'input_output',
  exemption_admins: true,
  notify_on_block: true,
});
export const generateBudgetRules = (params: URLSearchParams) => {
  const scope = params.get('scope_type');
  const rules = scope ? DEMO_BUDGET_RULES.filter((r) => r.scope_type === scope) : DEMO_BUDGET_RULES;
  return rules.map((r) => ({
    ...r,
    current_usage: Math.floor(Math.random() * (r.token_limit * 0.4)),
    usage_ratio: Math.random() * 0.4,
    last_check_at: new Date(Date.now() - 300_000).toISOString(),
  }));
};
export const generateBudgetWhitelist = () => [
  { entry_id: 'wl-1', scope_type: 'user', scope_id: '10086', note: '群主' },
  { entry_id: 'wl-2', scope_type: 'group', scope_id: '114514', note: '' },
];
export const generateBudgetOverview = () => ({
  today_total: { tokens: 31_421, requests: 192 },
  week_total: { tokens: 211_840, requests: 1_212 },
  hit_count_today: 4,
  hit_count_week: 18,
  top_consumers: [
    { scope_type: 'group', scope_id: '114514', tokens_today: 9_124, requests_today: 58 },
    { scope_type: 'user', scope_id: '10086', tokens_today: 5_812, requests_today: 32 },
  ],
});

// ---- Backup（BackupPage） ----
export const generateBackupFileTree = () => ({
  root: {
    name: 'backups',
    path: '',
    type: 'directory',
    children: [
      {
        name: '2026-07-19',
        path: '2026-07-19',
        type: 'directory',
        children: [
          { name: 'database.zip', path: '2026-07-19/database.zip', type: 'file', size_bytes: 1_482_311 },
          { name: 'config.zip', path: '2026-07-19/config.zip', type: 'file', size_bytes: 218_422 },
        ],
      },
      {
        name: '2026-07-20',
        path: '2026-07-20',
        type: 'directory',
        children: [
          { name: 'database.zip', path: '2026-07-20/database.zip', type: 'file', size_bytes: 1_511_882 },
          { name: 'config.zip', path: '2026-07-20/config.zip', type: 'file', size_bytes: 224_121 },
          { name: 'workspace.zip', path: '2026-07-20/workspace.zip', type: 'file', size_bytes: 91_222_311 },
        ],
      },
    ],
  },
});
export const generateBackupFiles = () => [
  { file_id: 'bf-20260719-db', name: 'database.zip', size_bytes: 1_482_311, created_at: '2026-07-19T03:00:12Z' },
  { file_id: 'bf-20260719-cfg', name: 'config.zip', size_bytes: 218_422, created_at: '2026-07-19T03:00:13Z' },
  { file_id: 'bf-20260720-db', name: 'database.zip', size_bytes: 1_511_882, created_at: '2026-07-20T03:00:11Z' },
  { file_id: 'bf-20260720-cfg', name: 'config.zip', size_bytes: 224_121, created_at: '2026-07-20T03:00:12Z' },
];
export const generateBackupConfig = () => ({
  schedule: 'daily',
  retention_count: 14,
  auto_upload: false,
  upload_target: null,
});

// ---- AI Kanban（AIKanbanPage） ----
export const generateKanbanBoard = () => {
  const makeCard = (column: string, display: string, kind: 'root' | 'subtask') => ({
    id: `${column}-${Math.random().toString(36).slice(2, 9)}`,
    root_task_id: 'demo-root-001',
    parent_task_id: kind === 'root' ? null : 'demo-root-001',
    ordinal: 0,
    display,
    goal: '完成该任务的预期输出',
    status: 'pending',
    kanban_column: column as 'target' | 'progress' | 'Done' | 'Blocked' | 'failed',
    agent_profile: kind === 'root' ? 'root_planner' : 'coder_agent',
    persona_name: '早柚',
    dependency_task_ids: [],
    not_before: null,
    respawn_count: 0,
    failure_reason: null,
    input_artifact_ids: [],
    output_artifact_id: null,
    workspace_path: '/data/kanban_workspace',
    subtask_count: 0,
    subtask_done_count: 0,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 600_000).toISOString(),
  });
  return {
    columns: {
      target: [makeCard('target', '整理本月看板演示任务', 'root')],
      progress: [
        makeCard('progress', '收集原神角色数据', 'subtask'),
        makeCard('progress', '写作 README.md', 'subtask'),
      ],
      Done: [makeCard('Done', '调试 MCP Server 连接', 'subtask')],
      Blocked: [],
      failed: [makeCard('failed', '尝试加载网络字体（被 GFW 拦截）', 'subtask')],
    },
    summary: { task_count: 5, subtask_count: 4, updated_at: new Date().toISOString() },
  };
};
export const generateKanbanTaskDetail = () => {
  const root = {
    id: 'demo-root-001',
    root_task_id: 'demo-root-001',
    parent_task_id: null,
    ordinal: 0,
    display: '整理本月看板演示任务',
    goal: '展示看板页结构',
    status: 'pending',
    kanban_column: 'target' as const,
    agent_profile: 'root_planner',
    persona_name: '早柚',
    dependency_task_ids: [],
    not_before: null,
    respawn_count: 0,
    failure_reason: null,
    input_artifact_ids: [],
    output_artifact_id: null,
    workspace_path: '/data/kanban_workspace',
    subtask_count: 4,
    subtask_done_count: 1,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 600_000).toISOString(),
  };
  return {
    task: root,
    root,
    subtasks: [
      { ...root, id: 'demo-sub-1', display: '收集原神角色数据', kanban_column: 'progress' as const, status: 'pending', subtask_count: 0, subtask_done_count: 0 },
      { ...root, id: 'demo-sub-2', display: '写作 README.md', kanban_column: 'progress' as const, status: 'pending', subtask_count: 0, subtask_done_count: 0 },
      { ...root, id: 'demo-sub-3', display: '调试 MCP Server 连接', kanban_column: 'Done' as const, status: 'done', subtask_count: 0, subtask_done_count: 0 },
      { ...root, id: 'demo-sub-4', display: '尝试加载网络字体', kanban_column: 'failed' as const, status: 'failed', failure_reason: 'GFW', subtask_count: 0, subtask_done_count: 0 },
    ],
    logs: [
      { event_type: 'run_start', content: 'task started', timestamp: new Date(Date.now() - 600_000).toISOString() },
      { event_type: 'tool_call', content: 'websearch 关键字 原神', timestamp: new Date(Date.now() - 540_000).toISOString() },
      { event_type: 'tool_return', content: 'ok', timestamp: new Date(Date.now() - 540_000).toISOString() },
    ],
    artifacts: [
      {
        id: 'demo-art-1',
        kind: 'text',
        artifact_kind: 'markdown',
        summary: '原神角色名 + 元素 + 武器类型的小结',
        mime: 'text/markdown',
        size_bytes: 1_204,
        from_profile: 'researcher',
        created_at: new Date(Date.now() - 600_000).toISOString(),
      },
    ],
  };
};
export const generateKanbanArtifacts = () => ({
  items: [
    {
      id: 'demo-art-1',
      root_task_id: 'demo-root-001',
      task_id: 'demo-sub-1',
      parent_task_id: 'demo-root-001',
      from_profile: 'researcher',
      artifact_kind: 'markdown',
      mime: 'text/markdown',
      summary: '原神角色名 + 元素 + 武器类型的小结',
      size_bytes: 1_204,
      has_inline: true,
      has_payload_path: false,
      payload_path: null,
      created_at: new Date(Date.now() - 600_000).toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    },
    {
      id: 'demo-art-2',
      root_task_id: 'demo-root-001',
      task_id: 'demo-sub-2',
      parent_task_id: 'demo-root-001',
      from_profile: 'writer',
      artifact_kind: 'markdown',
      mime: 'text/markdown',
      summary: 'README v2 初稿',
      size_bytes: 8_211,
      has_inline: true,
      has_payload_path: false,
      payload_path: null,
      created_at: new Date(Date.now() - 300_000).toISOString(),
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    },
  ],
  count: 2,
});
export const generateKanbanCandidates = () => ({
  candidates: [
    { node_id: 'cap-researcher', display_name: '研究员', when_to_use: '需要做联网搜索或资料检索', match_keywords: ['搜索', '资料'], tool_names: ['websearch', 'fetch_url'], source: 'builtin' },
    { node_id: 'cap-writer', display_name: '写作者', when_to_use: '需要写长文、文档', match_keywords: ['写作', '文档'], tool_names: ['file_write', 'compose_text'], source: 'builtin' },
  ],
});
export const generateKanbanWorkspaceFiles = () => ({
  task_id: 'demo-root-001',
  files: [
    { path: 'input/characters.json', size_bytes: 1_204, mime: 'application/json', updated_at: new Date(Date.now() - 600_000).toISOString() },
    { path: 'output/README.md', size_bytes: 8_211, mime: 'text/markdown', updated_at: new Date(Date.now() - 300_000).toISOString() },
  ],
});

// ---- AI Config（AIConfigPage） ----
const DEMO_PROVIDERS = [
  { provider: 'anthropic', display_name: 'Anthropic', enabled: true, presets: ['claude-opus-4-8', 'claude-haiku-4-5'] },
  { provider: 'openai', display_name: 'OpenAI', enabled: true, presets: ['gpt-4o', 'gpt-4o-mini'] },
  { provider: 'gemini', display_name: 'Gemini', enabled: true, presets: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
  { provider: 'local', display_name: '本机服务 (Ollama / vLLM / SGLang)', enabled: false, presets: [] },
];
export const generateProviderList = () => ({
  providers: DEMO_PROVIDERS,
  default_provider: 'anthropic',
});
export const generateTaskConfig = (task: string) => {
  const all = DEMO_PROVIDERS.flatMap((p) => p.presets.map((m) => ({ provider: p.provider, model_name: m })));
  return {
    task_level: task,
    provider_config_name: `${task}-main`,
    provider: 'anthropic',
    model_name: task === 'high' ? 'claude-opus-4-8' : 'claude-haiku-4-5',
    fallback_provider_config_name: null,
    '2nd_provider_config_name': `${task}-backup`,
  };
};
export const generateProviderConfigsSummary = () => ({
  providers: DEMO_PROVIDERS.filter((p) => p.enabled),
  all_configs: [
    { name: 'high-main', provider: 'anthropic', model_name: 'claude-opus-4-8' },
    { name: 'high-backup', provider: 'openai', model_name: 'gpt-4o-mini' },
    { name: 'low-main', provider: 'anthropic', model_name: 'claude-haiku-4-5' },
    { name: 'low-backup', provider: 'gemini', model_name: 'gemini-2.5-flash' },
  ],
});
export const generateProviderConfigDetail = (provider: string) => ({
  provider,
  display_name: DEMO_PROVIDERS.find((p) => p.provider === provider)?.display_name ?? provider,
  config_options: {
    base_url: 'https://api.example.com/v1',
    api_key_secret: true,
    model_name: 'gpt-4o-mini',
    timeout_seconds: 30,
    max_retries: 2,
    proxy: '',
    custom_headers: '',
  },
  advanced_options: {
    stream_chunk_size: 64,
    response_cache: true,
    usage_stats_mode: 'auto',
  },
});
export const generateProviderOptions = () => ({
  providers: DEMO_PROVIDERS.map((p) => p.provider),
  presets_by_provider: Object.fromEntries(DEMO_PROVIDERS.map((p) => [p.provider, p.presets])),
  usage_stats_modes: ['auto', 'incremental', 'cumulative'],
});
export const generateEmbeddingProvider = () => ({
  provider: 'openai',
  available: ['openai', 'local', 'voyage'],
  current_config: { model_name: 'text-embedding-3-small', batch_size: 64 },
});
export const generateEmbeddingLocal = () => ({
  enabled: false,
  model_name: 'BAAI/bge-m3',
  device: 'cpu',
  max_seq_length: 512,
  cache_dir: '/data/embedding_cache',
});
export const generateEmbeddingOpenAI = () => ({
  enabled: true,
  base_url: 'https://api.openai.com/v1',
  api_key_set: true,
  model_name: 'text-embedding-3-small',
  batch_size: 64,
});
export const generateEmbeddingSummary = () => ({
  active: 'openai',
  available: ['openai', 'local'],
  issue_count: 0,
});
export const generateMCPToolsConfigList = () => ({
  items: [
    { item_key: 'web_search', display_name: 'Brave Search', enabled: true, tool_name: 'brave_search', details: { max_results: 5 } },
    { item_key: 'echo', display_name: 'Echo', enabled: false, tool_name: 'mcp_echo', details: {} },
  ],
});

// ---- Batch Push (BatchPushPage) ----
// 四维与后端 message_api 一致：
// - bots[].bot_id = WS 连接 key（仅用于 push_bot；**不可**当作 targets?bot_id=）
// - items / bot_self_ids 的 bot_id = 平台 id（onebot / telegram / …）
// - targets?bot_id= 只按平台过滤群/用户；选中 WS 连接不应清空目标列表
const DEMO_PUSH_BOTS = [
  { bot_id: 'ws-onebot-a', name: 'ws-onebot-a (OneBot)', ws_bot_id: 'ws-onebot-a', connected: true },
  { bot_id: 'ws-telegram', name: 'ws-telegram (Telegram)', ws_bot_id: 'ws-telegram', connected: true },
  { bot_id: 'ws-discord', name: 'ws-discord (Discord)', ws_bot_id: 'ws-discord', connected: false },
];
/** 演示：onebot 平台挂 3 个不同 bot_self_id，精准推送时必须选中其一 */
const DEMO_PUSH_BOT_SELF_IDS = [
  { id: '10001:onebot', bot_id: 'onebot', bot_self_id: '10001', label: '10001 (onebot)' },
  { id: '10002:onebot', bot_id: 'onebot', bot_self_id: '10002', label: '10002 (onebot)' },
  { id: '10003:onebot', bot_id: 'onebot', bot_self_id: '10003', label: '10003 (onebot)' },
  { id: 'tg-bot:telegram', bot_id: 'telegram', bot_self_id: 'tg-bot', label: 'tg-bot (telegram)' },
  { id: 'dc-bot:discord', bot_id: 'discord', bot_self_id: 'dc-bot', label: 'dc-bot (discord)' },
];
const DEMO_PUSH_PLATFORMS = ['onebot', 'telegram', 'discord'];

/**
 * 模拟一个数据集：每个平台下挂若干群/用户，用于演示分页 + 筛选。
 * 体量刻意做大（每平台 60 群 + 80 用户），便于看到分页/筛选效果。
 */
const DEMO_PUSH_RAW_GROUPS: { bot_id: string; group_id: string }[] = DEMO_PUSH_PLATFORMS.flatMap(
  (platform) =>
    Array.from({ length: 60 }, (_, i) => ({
      bot_id: platform,
      group_id: `${platform}-g${i + 1}`,
    })),
);
const DEMO_PUSH_RAW_USERS: { bot_id: string; user_id: string }[] = DEMO_PUSH_PLATFORMS.flatMap(
  (platform) =>
    Array.from({ length: 80 }, (_, i) => ({
      bot_id: platform,
      user_id: `${platform}-u${i + 1}`,
    })),
);

export const generateBatchPushTargets = (params?: URLSearchParams) => {
  const bot_id = params?.get('bot_id') || undefined;
  const bot_self_id = params?.get('bot_self_id') || undefined;
  const kind = params?.get('kind') || 'all';
  const q = (params?.get('q') || '').toLowerCase();
  const limit = Math.max(1, Math.min(1000, parseInt(params?.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(params?.get('offset') || '0', 10));

  const matchesQ = (label: string, value: string) =>
    !q || label.toLowerCase().includes(q) || value.toLowerCase().includes(q);

  const allGroupLabel = '全部群 (ALLGROUP)';
  const allUserLabel = '全部用户 (ALLUSER)';

  const macros: {
    kind: 'macro';
    bot_id: '';
    bot_self_id: '';
    label: string;
    value: 'ALLGROUP' | 'ALLUSER';
  }[] = [];
  if (!bot_id && offset === 0) {
    if ((kind === 'all' || kind === 'group') && matchesQ(allGroupLabel, 'ALLGROUP')) {
      macros.push({
        kind: 'macro',
        bot_id: '',
        bot_self_id: '',
        label: allGroupLabel,
        value: 'ALLGROUP',
      });
    }
    if ((kind === 'all' || kind === 'user') && matchesQ(allUserLabel, 'ALLUSER')) {
      macros.push({
        kind: 'macro',
        bot_id: '',
        bot_self_id: '',
        label: allUserLabel,
        value: 'ALLUSER',
      });
    }
  }

  const buildGroupItems = () =>
    DEMO_PUSH_RAW_GROUPS.filter((g) => !bot_id || g.bot_id === bot_id)
      .map((g) => {
        const label = `${g.bot_id} · ${g.group_id}`;
        const value = `g:${g.group_id}|${g.bot_id}`;
        return {
          kind: 'group' as const,
          bot_id: g.bot_id,
          bot_self_id: '',
          label,
          value,
        };
      })
      .filter((it) => matchesQ(it.label, it.value))
      .sort((a, b) =>
        a.bot_id === b.bot_id ? a.value.localeCompare(b.value) : a.bot_id.localeCompare(b.bot_id),
      );

  const buildUserItems = () =>
    DEMO_PUSH_RAW_USERS.filter((u) => !bot_id || u.bot_id === bot_id)
      .map((u) => {
        const label = `${u.bot_id} · ${u.user_id}`;
        const value = `u:${u.user_id}|${u.bot_id}`;
        return {
          kind: 'user' as const,
          bot_id: u.bot_id,
          bot_self_id: '',
          label,
          value,
        };
      })
      .filter((it) => matchesQ(it.label, it.value))
      .sort((a, b) =>
        a.bot_id === b.bot_id ? a.value.localeCompare(b.value) : a.bot_id.localeCompare(b.bot_id),
      );

  const groupItems = kind === 'user' ? [] : buildGroupItems();
  const userItems = kind === 'group' ? [] : buildUserItems();

  const all = [...macros, ...groupItems, ...userItems];
  const total = all.length;
  const items = all.slice(offset, offset + limit);
  const has_more = offset + limit < total;

  // bot_self_ids 始终返回全集（仅显式 bot_self_id 时收窄），与后端一致
  let bot_self_ids = DEMO_PUSH_BOT_SELF_IDS;
  if (bot_self_id) bot_self_ids = bot_self_ids.filter((x) => x.bot_self_id === bot_self_id);

  return {
    bots: DEMO_PUSH_BOTS,
    bot_self_ids,
    items,
    total,
    limit,
    offset,
    has_more,
  };
};

// ---- Knowledge 备份 ----
export const generateKnowledgeBackupExport = () => 'documents';
export const generateMemeExportName = () => `memes-${new Date().toISOString().split('T')[0]}.meme`;

// ---- AI Artifacts 全局列表（按 root_task_id 列）----
export const generateAllArtifacts = (params: URLSearchParams) => ({
  items: (generateKanbanArtifacts().items as any[]).map((a) => ({ ...a })),
  count: 2,
});

