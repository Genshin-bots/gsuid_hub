/**
 * 插件来源归属、镜像通道展示、自定义镜像校验与仓库链接解析纯函数。
 * 不依赖 React，供 GitMirrorDialog / GitUpdatePage / PluginsPage / PluginStorePage 复用与单测。
 */

import type {
  GitMirrorOption,
  GitPluginInfo,
  MirrorDisplay,
  MirrorProbeResult,
  MirrorType,
  PluginSourceKind,
  ProbeState,
} from '@/lib/api';
import { parseGitHubRepo } from '@/lib/featureUtils';

export const DEFAULT_MIRROR_VALUE = '__github_default__';
export const CUSTOM_PROXY_VALUE = '__custom_proxy__';
export const CUSTOM_MIRROR_VALUE = '__custom_mirror__';
export const SSH_MIRROR_VALUE = 'ssh://';

export type MirrorBadgeTone = 'primary' | 'green' | 'blue' | 'violet' | 'slate' | 'amber';

export interface SourceBadgeMeta {
  label: string;
  tone: 'amber' | 'violet' | 'slate';
  title?: string;
}

export const SOURCE_BADGE_CLASSES: Record<SourceBadgeMeta['tone'], string> = {
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40',
  slate: 'bg-muted/80 text-muted-foreground border-border',
};

export interface MirrorBadgeMeta {
  label: string;
  tone: MirrorBadgeTone;
  iconKind: 'ssh' | 'server' | 'link' | 'globe' | 'unknown';
}

export type CustomMirrorErrorReason =
  | 'empty'
  | 'invalid_scheme'
  | 'credentials'
  | 'loopback'
  | 'invalid_url';

export type NormalizeCustomMirrorResult =
  | { ok: true; url: string }
  | { ok: false; reason: CustomMirrorErrorReason };

const OBVIOUS_LOCAL_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::1',
  '::',
  '100.100.100.200',
  'metadata.google.internal',
  'metadata.google.com',
]);

/** 轻量前端表单拦截明显本机回环与元数据地址；深层 SSRF / DNS / 跳转复核以 Core 后端为唯一真值源。 */
function isBlockedLocalHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return true;
  if (OBVIOUS_LOCAL_HOSTS.has(lower) || lower.endsWith('.localhost')) return true;
  if (lower.startsWith('127.') || lower.startsWith('169.254.')) return true;
  if (lower.startsWith('fe80:')) return true;
  return false;
}

/** 仅允许合法的 http:// 或 https:// URL，避免 SSH/SCP 仓库地址被渲染成相对路径死链。 */
export function isHttpUrl(raw: string | null | undefined): boolean {
  const trimmed = (raw || '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 校验并规范化自定义镜像/反代前缀 URL，拦截本机回环、元数据与内嵌凭据。 */
export function normalizeCustomMirrorUrl(raw: string): NormalizeCustomMirrorResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, reason: 'invalid_scheme' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials' };
  if (!parsed.hostname) return { ok: false, reason: 'invalid_url' };
  if (isBlockedLocalHost(parsed.hostname)) return { ok: false, reason: 'loopback' };
  const clean = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  return { ok: true, url: `${clean}/` };
}

/** 检测是否为 SSH 协议的 git remote URL。 */
export function isSshRemoteUrl(url: string): boolean {
  return url.startsWith('ssh://') || url.startsWith('git@');
}

/** 根据后端 source_kind 生成紧凑来源徽标元数据；official 与旧版未知返回 null。 */
export function getSourceBadgeInfo(
  sourceKind: PluginSourceKind | null | undefined,
  upstreamHost: string | undefined,
  t: (key: string) => string,
  upstreamUrl?: string,
): SourceBadgeMeta | null {
  if (!sourceKind || sourceKind === 'official') return null;
  const host = (upstreamHost || '').trim();
  switch (sourceKind) {
    case 'fork':
      return {
        label:
          host && host.toLowerCase() !== 'github.com'
            ? `${t('gitMirror.sourceFork')} · ${host}`
            : t('gitMirror.sourceFork'),
        tone: 'amber',
        title: upstreamUrl || host || undefined,
      };
    case 'third_party':
      return {
        label:
          host && host.toLowerCase() !== 'github.com'
            ? `${t('gitMirror.sourceThirdParty')} · ${host}`
            : t('gitMirror.sourceThirdParty'),
        tone: 'violet',
        title: upstreamUrl || host || undefined,
      };
    case 'git_local_only':
      return {
        label: t('gitMirror.sourceGitLocalOnly'),
        tone: 'slate',
        title: upstreamUrl || undefined,
      };
    case 'local':
      return {
        label: t('gitMirror.sourceLocal'),
        tone: 'slate',
      };
    default:
      return null;
  }
}

/** 根据 mirror 通道、remote_url 与 upstream_host 解析镜像展示徽标元数据。 */
export function getMirrorBadgeMeta(
  mirror: MirrorDisplay | string | undefined,
  remoteUrl: string,
  upstreamHost: string | undefined,
  t: (key: string) => string,
): MirrorBadgeMeta {
  if (mirror === 'ssh' || (remoteUrl && isSshRemoteUrl(remoteUrl))) {
    return { label: t('gitMirror.ssh'), tone: 'green', iconKind: 'ssh' };
  }
  switch (mirror) {
    case 'gitcode':
      return { label: t('gitMirror.gitcode'), tone: 'green', iconKind: 'server' };
    case 'cnb':
      return { label: t('gitMirror.cnb'), tone: 'green', iconKind: 'server' };
    case 'ghproxy':
      return { label: t('gitMirror.ghproxy'), tone: 'blue', iconKind: 'link' };
    case 'custom_proxy':
      return { label: t('gitMirror.customProxyShort'), tone: 'blue', iconKind: 'link' };
    case 'custom_mirror':
      return { label: t('gitMirror.customMirrorShort'), tone: 'violet', iconKind: 'server' };
    case 'native': {
      const host = (upstreamHost || '').trim();
      return {
        label: host || t('gitMirror.nativeSource'),
        tone: 'slate',
        iconKind: 'globe',
      };
    }
    case 'github':
      return { label: t('gitMirror.github'), tone: 'primary', iconKind: 'globe' };
    default:
      return { label: t('gitMirror.unknown'), tone: 'amber', iconKind: 'unknown' };
  }
}

function normalizePrefixCompare(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === SSH_MIRROR_VALUE) return trimmed.toLowerCase();
  return trimmed.replace(/\/+$/, '').toLowerCase();
}

/** 将后端 current_mirror + current_mirror_mode 映射为下拉框选中值与自定义输入框初值。 */
export function resolveInitialMirrorSelection(
  currentMirror: string,
  currentMode: MirrorType | undefined,
  availableMirrors: GitMirrorOption[],
): { selectValue: string; customUrl: string } {
  const trimmed = (currentMirror || '').trim();
  if (!trimmed) {
    return { selectValue: DEFAULT_MIRROR_VALUE, customUrl: '' };
  }
  const targetNorm = normalizePrefixCompare(trimmed);
  for (const option of availableMirrors) {
    if (normalizePrefixCompare(option.value) === targetNorm) {
      return { selectValue: option.value || DEFAULT_MIRROR_VALUE, customUrl: '' };
    }
  }
  if (trimmed.toLowerCase().startsWith('ssh://')) {
    return { selectValue: SSH_MIRROR_VALUE, customUrl: '' };
  }
  if (currentMode === 'mirror') {
    return { selectValue: CUSTOM_MIRROR_VALUE, customUrl: trimmed };
  }
  return { selectValue: CUSTOM_PROXY_VALUE, customUrl: trimmed };
}

export type MirrorSubmitPayload =
  | {
      ok: true;
      mirrorPrefix: string;
      mirrorType: MirrorType;
      configMode: 'auto' | 'proxy' | 'mirror';
    }
  | { ok: false; reason: CustomMirrorErrorReason };

/** 将前端 Select 选中项 + 自定义输入框转换为后端 API 请求载荷。 */
export function resolveMirrorSubmitPayload(
  selectValue: string,
  customUrl: string,
): MirrorSubmitPayload {
  if (selectValue === DEFAULT_MIRROR_VALUE) {
    return { ok: true, mirrorPrefix: '', mirrorType: 'default', configMode: 'auto' };
  }
  if (selectValue === SSH_MIRROR_VALUE) {
    return { ok: true, mirrorPrefix: SSH_MIRROR_VALUE, mirrorType: 'ssh', configMode: 'auto' };
  }
  if (selectValue === CUSTOM_PROXY_VALUE) {
    const check = normalizeCustomMirrorUrl(customUrl);
    if ('reason' in check) return { ok: false, reason: check.reason };
    return { ok: true, mirrorPrefix: check.url, mirrorType: 'proxy', configMode: 'proxy' };
  }
  if (selectValue === CUSTOM_MIRROR_VALUE) {
    const check = normalizeCustomMirrorUrl(customUrl);
    if ('reason' in check) return { ok: false, reason: check.reason };
    return { ok: true, mirrorPrefix: check.url, mirrorType: 'mirror', configMode: 'mirror' };
  }
  return { ok: true, mirrorPrefix: selectValue, mirrorType: 'auto', configMode: 'auto' };
}

/** 优先读取后端下发的稳定 channel，旧版 Core 未提供时按前缀与 type 兜底推导。 */
export function channelForMirrorOption(option: GitMirrorOption): string {
  const explicit = (option.channel || '').trim().toLowerCase();
  if (explicit) return explicit;
  const value = option.value.trim().toLowerCase();
  if (!value || option.type === 'default') return 'github';
  if (value === SSH_MIRROR_VALUE || option.type === 'ssh') return 'ssh';
  if (value.includes('cnb.cool')) return 'cnb';
  if (value.includes('gitcode.com')) return 'gitcode';
  if (option.type === 'proxy') return 'ghproxy';
  return 'custom_mirror';
}

export interface PluginMirrorOptionState {
  option: GitMirrorOption;
  selectValue: string;
  channel: string;
  disabled: boolean;
  probeState?: ProbeState;
  probeDetail?: string;
  disableReason?:
    | 'native_only'
    | 'fork_mirror_blocked'
    | 'third_party_mirror_blocked'
    | 'not_synced';
}

/** 判断单个插件是否允许切换镜像源（原生非 GitHub 仓库或无 remote 仓库禁止切换）。 */
export function isPluginSwitchable(plugin: GitPluginInfo): boolean {
  if (!plugin.is_git_repo || !plugin.remote_url) return false;
  if (plugin.supported_mirrors !== undefined) return plugin.supported_mirrors.length > 0;
  return true;
}

/**
 * 判断单个插件是否支持自定义 GitHub 反代（保留 owner/repo，仅要求 GitHub 上游）。
 * 后端 supported_mirrors 只包含内置通道，因此按 ghproxy/github 通道或 upstream_host 判定。
 */
export function canPluginUseCustomProxy(plugin: GitPluginInfo | null): boolean {
  if (!plugin?.is_git_repo || !plugin.remote_url) return false;
  if (plugin.supported_mirrors !== undefined) {
    return (
      plugin.supported_mirrors.includes('ghproxy') || plugin.supported_mirrors.includes('github')
    );
  }
  const host = (plugin.upstream_host || '').trim().toLowerCase();
  return !host || host === 'github.com';
}

/**
 * 判断单个插件是否支持自定义扁平镜像组织（仅 official 的 GitHub 仓库允许，与后端 build_safe_mirror_url 对齐）。
 */
export function canPluginUseCustomMirror(plugin: GitPluginInfo | null): boolean {
  if (!canPluginUseCustomProxy(plugin)) return false;
  if (plugin?.source_kind !== undefined) {
    return plugin.source_kind === 'official';
  }
  return true;
}

/** 根据单个插件自身当前 remote/mirror 状态初始化单插件切换弹窗选中项，避免误用全局下拉项覆盖 origin。 */
export function resolvePluginInitialMirrorSelection(
  plugin: GitPluginInfo,
  availableMirrors: GitMirrorOption[],
): { selectValue: string; customUrl: string } {
  const activePrefix = (plugin.active_mirror_prefix || '').trim();
  if (plugin.mirror === 'ssh' || isSshRemoteUrl(plugin.remote_url)) {
    return { selectValue: SSH_MIRROR_VALUE, customUrl: '' };
  }
  if (plugin.mirror === 'custom_proxy') {
    return { selectValue: CUSTOM_PROXY_VALUE, customUrl: activePrefix };
  }
  if (plugin.mirror === 'custom_mirror') {
    return { selectValue: CUSTOM_MIRROR_VALUE, customUrl: activePrefix };
  }
  if (activePrefix) {
    const targetNorm = normalizePrefixCompare(activePrefix);
    const byPrefix = availableMirrors.find((m) => normalizePrefixCompare(m.value) === targetNorm);
    if (byPrefix) {
      return { selectValue: byPrefix.value || DEFAULT_MIRROR_VALUE, customUrl: '' };
    }
  }
  if (plugin.mirror === 'cnb' || plugin.mirror === 'gitcode' || plugin.mirror === 'ghproxy') {
    const byChannel = availableMirrors.find((m) => channelForMirrorOption(m) === plugin.mirror);
    if (byChannel) {
      return { selectValue: byChannel.value || DEFAULT_MIRROR_VALUE, customUrl: '' };
    }
  }
  return { selectValue: DEFAULT_MIRROR_VALUE, customUrl: '' };
}

const PROBE_OK_TTL_SECONDS = 15 * 60;
const PROBE_NOT_SYNCED_TTL_SECONDS = 90;
const PROBE_FAIL_TTL_SECONDS = 30;

function isProbeStillFresh(probe: MirrorProbeResult, nowSeconds: number): boolean {
  if (typeof probe.expires_at === 'number') {
    return nowSeconds < probe.expires_at;
  }
  const ttl =
    probe.state === 'unreachable'
      ? PROBE_FAIL_TTL_SECONDS
      : probe.state === 'not_synced'
        ? PROBE_NOT_SYNCED_TTL_SECONDS
        : PROBE_OK_TTL_SECONDS;
  return nowSeconds - probe.checked_at < ttl;
}

/** 为单插件切换弹窗生成去重后的可选通道列表，融合 supported_mirrors 与探活状态。 */
export function buildPluginMirrorOptions(
  plugin: GitPluginInfo | null,
  availableMirrors: GitMirrorOption[],
  nowSeconds: number = Date.now() / 1000,
): PluginMirrorOptionState[] {
  const deduped: GitMirrorOption[] = [];
  const seen = new Set<string>();
  for (const opt of availableMirrors) {
    const key = normalizePrefixCompare(opt.value) || DEFAULT_MIRROR_VALUE;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(opt);
  }

  const probeByChannel = new Map<string, MirrorProbeResult>();
  for (const probe of plugin?.mirror_probes ?? []) {
    if (!isProbeStillFresh(probe, nowSeconds)) continue;
    probeByChannel.set(probe.channel, probe);
  }

  const supportedSet =
    plugin?.supported_mirrors !== undefined ? new Set(plugin.supported_mirrors) : null;

  return deduped.map((option) => {
    const selectValue = option.value || DEFAULT_MIRROR_VALUE;
    const channel = channelForMirrorOption(option);
    const probe = probeByChannel.get(channel);

    let disabled = false;
    let disableReason: PluginMirrorOptionState['disableReason'];

    if (supportedSet !== null) {
      if (supportedSet.size === 0) {
        disabled = true;
        disableReason = 'native_only';
      } else if (!supportedSet.has(channel)) {
        disabled = true;
        disableReason =
          plugin?.source_kind === 'fork' ? 'fork_mirror_blocked' : 'third_party_mirror_blocked';
      }
    }

    if (!disabled && probe?.state === 'not_synced') {
      disabled = true;
      disableReason = 'not_synced';
    }

    return {
      option,
      selectValue,
      channel,
      disabled,
      probeState: probe?.state,
      probeDetail: probe?.detail,
      disableReason,
    };
  });
}

/**
 * 解析提交记录 #issue 链接的 GitHub 仓库基址（仅返回真实 github.com/owner/repo）。
 * 严禁在非 GitHub 宿主或未知来源时猜拼 Genshin-bots/<pluginName>。
 */
export function resolveCommitIssueBaseUrl(
  info: { upstream_url?: string; upstream_host?: string } | null | undefined,
  remoteUrl?: string,
): string | null {
  const upstreamHost = (info?.upstream_host || '').trim().toLowerCase();
  if (upstreamHost && upstreamHost !== 'github.com') return null;

  const candidate = (info?.upstream_url || '').trim();
  if (candidate) {
    const slug = parseGitHubRepo(candidate);
    return slug ? `https://github.com/${slug}` : null;
  }

  if (!remoteUrl) return null;
  const cleaned = remoteUrl
    .trim()
    .replace(/^ssh:\/\/git@(?:ssh\.)?github\.com(?::\d+)?\//i, 'https://github.com/');
  const slug = parseGitHubRepo(cleaned);
  return slug ? `https://github.com/${slug}` : null;
}

const DEFAULT_GHPROXY_PREFIX = 'https://ghproxy.mihomo.me/';

function resolveProxyPrefix(gitInfo?: GitPluginInfo | null): string {
  const recorded = (gitInfo?.active_mirror_prefix || '').trim();
  if (recorded && /^https?:\/\//i.test(recorded)) {
    return `${recorded.replace(/\/+$/, '')}/`;
  }
  const remote = (gitInfo?.remote_url || '').trim();
  const innerIdx = remote.search(/https?:\/\/github\.com\//i);
  if (innerIdx > 0) {
    const extracted = remote.slice(0, innerIdx).replace(/\/+$/, '');
    if (/^https?:\/\//i.test(extracted)) return `${extracted}/`;
  }
  return DEFAULT_GHPROXY_PREFIX;
}

/** 构造插件详情弹窗的 README raw 候选地址；无仓库链接的纯本地插件返回空数组。 */
export function buildPluginReadmeUrls(
  plugin: {
    id: string;
    link?: string;
    in_store?: boolean;
    local_source_kind?: PluginSourceKind | null;
    local_upstream_url?: string;
  },
  gitInfo?: GitPluginInfo | null,
): string[] {
  const storeLink = (plugin.link || '').trim();
  const localUpstream = (plugin.local_upstream_url || gitInfo?.upstream_url || '').trim();
  const remoteUrl = (gitInfo?.remote_url || '').trim();

  // 非商店本地插件：仅当确有上游仓库地址时才尝试拉 README，绝不猜拼 github.com/<id>
  if (plugin.in_store === false) {
    const target = storeLink || localUpstream || remoteUrl;
    if (!target) return [];
    const ghSlug = parseGitHubRepo(target);
    if (ghSlug) {
      const [owner, repo] = ghSlug.split('/');
      const directUrls = [
        `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/master/README.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/README.md`,
      ];
      if (gitInfo?.mirror === 'ghproxy' || gitInfo?.mirror === 'custom_proxy') {
        const proxyPrefix = resolveProxyPrefix(gitInfo);
        return [
          `${proxyPrefix}https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
          `${proxyPrefix}https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
          ...directUrls,
        ];
      }
      return directUrls;
    }
    const cnbMatch = target.match(/cnb\.cool\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#]|$)/i);
    if (cnbMatch) {
      return [
        `https://cnb.cool/${cnbMatch[1]}/${cnbMatch[2]}/-/git/raw/master/README.md`,
        `https://cnb.cool/${cnbMatch[1]}/${cnbMatch[2]}/-/git/raw/main/README.md`,
      ];
    }
    const gcMatch = target.match(/gitcode\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#]|$)/i);
    if (gcMatch) {
      return [
        `https://raw.gitcode.com/${gcMatch[1]}/${gcMatch[2]}/raw/master/README.md`,
        `https://raw.gitcode.com/${gcMatch[1]}/${gcMatch[2]}/raw/main/README.md`,
      ];
    }
    return [];
  }

  // 商店条目：若本地是 official 且走了已知加速源，优先走对应加速源；Fork 时仍以商店上游为准
  const useOfficialMirror =
    gitInfo?.is_git_repo &&
    (gitInfo.source_kind === undefined || gitInfo.source_kind === 'official');
  const mirror = useOfficialMirror ? gitInfo?.mirror || 'github' : 'github';
  const effectiveUrl = useOfficialMirror && remoteUrl ? remoteUrl : storeLink;
  if (!effectiveUrl) return [];

  if (mirror === 'cnb') {
    const cnbMatch = effectiveUrl.match(/cnb\.cool\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#]|$)/i);
    if (cnbMatch) {
      return [
        `https://cnb.cool/${cnbMatch[1]}/${cnbMatch[2]}/-/git/raw/master/README.md`,
        `https://cnb.cool/${cnbMatch[1]}/${cnbMatch[2]}/-/git/raw/main/README.md`,
      ];
    }
  }
  if (mirror === 'gitcode') {
    const gcMatch = effectiveUrl.match(
      /gitcode\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#]|$)/i,
    );
    if (gcMatch) {
      return [
        `https://raw.gitcode.com/${gcMatch[1]}/${gcMatch[2]}/raw/master/README.md`,
        `https://raw.gitcode.com/${gcMatch[1]}/${gcMatch[2]}/raw/main/README.md`,
      ];
    }
  }

  const repoSlug = parseGitHubRepo(effectiveUrl) || parseGitHubRepo(storeLink);
  if (!repoSlug) return [];
  const [owner, repo] = repoSlug.split('/');
  const directUrls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/master/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/README.md`,
  ];
  if (mirror === 'ghproxy' || mirror === 'custom_proxy') {
    const proxyPrefix = resolveProxyPrefix(gitInfo);
    return [
      `${proxyPrefix}https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
      `${proxyPrefix}https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      ...directUrls,
    ];
  }
  return directUrls;
}

/**
 * 将 README 内的相对路径图片解析为绝对 raw URL，基准与实际成功拉取 README 的地址保持一致。
 * 这样无论是 GitHub（main/master）、Fork 官方回退、CNB、GitCode 还是反代，图文均指向同一仓库分支。
 */
export function resolveReadmeAssetUrl(readmeUrl: string, src: string): string {
  const rawSrc = src.trim();
  if (!rawSrc || !readmeUrl) return rawSrc;
  if (/^(https?:)?\/\//i.test(rawSrc) || /^(data:|blob:|#)/i.test(rawSrc)) {
    return rawSrc;
  }
  try {
    const cleanRel = rawSrc.replace(/^\/+/, '');
    return new URL(cleanRel, readmeUrl).toString();
  } catch {
    return rawSrc;
  }
}

/**
 * 判断保存框架配置项时的错误是否属于「旧版核心尚未定义该配置项」。
 * 仅此类兼容降级允许静默忽略，鉴权失败（401/403）、5xx 或断网错误必须继续抛出给用户。
 */
export function isMissingConfigItemError(error: unknown, itemName?: string): boolean {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error === 'object' && error !== null && 'msg' in error
          ? String((error as { msg?: unknown }).msg ?? '')
          : '';
  const text = raw.trim();
  if (!text) return false;
  if (
    /(401|403|500|502|503|504|unauthorized|forbidden|network|failed to fetch|timeout)/i.test(text)
  ) {
    return false;
  }
  const hasMissingPhrase =
    /配置项.*不存在/.test(text) || /(item|config).*(not found|does not exist)/i.test(text);
  if (!hasMissingPhrase) return false;
  if (itemName && text.toLowerCase().includes(itemName.toLowerCase())) return true;
  return /配置项.*不存在/.test(text);
}

/** 判断请求错误是否属于旧版核心尚未提供新接口（404 / Not Found），供精准降级使用。 */
export function isEndpointNotFoundError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error === 'object' && error !== null && 'msg' in error
          ? String((error as { msg?: unknown }).msg ?? '')
          : '';
  const text = raw.trim();
  if (!text) return false;
  if (/(401|403|500|502|503|504|unauthorized|forbidden|failed to fetch|timeout)/i.test(text)) {
    return false;
  }
  return /\b404\b/i.test(text) || /^not found$/i.test(text) || /not found/i.test(text);
}
