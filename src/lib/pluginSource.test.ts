import { describe, expect, it } from 'vitest';
import type { GitMirrorOption, GitPluginInfo } from '@/lib/api';
import {
  buildPluginMirrorOptions,
  buildPluginReadmeUrls,
  CUSTOM_MIRROR_VALUE,
  CUSTOM_PROXY_VALUE,
  canPluginUseCustomMirror,
  canPluginUseCustomProxy,
  DEFAULT_MIRROR_VALUE,
  getMirrorBadgeMeta,
  getSourceBadgeInfo,
  isEndpointNotFoundError,
  isHttpUrl,
  isMissingConfigItemError,
  isPluginSwitchable,
  normalizeCustomMirrorUrl,
  resolveCommitIssueBaseUrl,
  resolveInitialMirrorSelection,
  resolveMirrorSubmitPayload,
  resolvePluginInitialMirrorSelection,
  resolveReadmeAssetUrl,
  SSH_MIRROR_VALUE,
} from '@/lib/pluginSource';

const t = (key: string) => key;

const AVAILABLE_MIRRORS: GitMirrorOption[] = [
  { label: 'GitHub (默认)', value: '', type: 'default', channel: 'github' },
  { label: 'CNB 镜像', value: 'https://cnb.cool/gscore-mirror/', type: 'mirror', channel: 'cnb' },
  {
    label: 'GitCode 镜像',
    value: 'https://gitcode.com/gscore-mirror/',
    type: 'mirror',
    channel: 'gitcode',
  },
  { label: 'ghproxy 代理', value: 'https://ghproxy.mihomo.me/', type: 'proxy', channel: 'ghproxy' },
  { label: 'SSH 协议', value: 'ssh://', type: 'ssh', channel: 'ssh' },
];

describe('pluginSource helpers', () => {
  it('validates custom mirror URLs and blocks loopback/credentials/non-http schemes', () => {
    expect(normalizeCustomMirrorUrl('https://mirror.example.com/org')).toEqual({
      ok: true,
      url: 'https://mirror.example.com/org/',
    });
    expect(normalizeCustomMirrorUrl('http://192.168.1.10:3000/org/')).toEqual({
      ok: true,
      url: 'http://192.168.1.10:3000/org/',
    });
    expect(normalizeCustomMirrorUrl('http://127.0.0.1:8765/')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(normalizeCustomMirrorUrl('http://localhost/proxy')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(normalizeCustomMirrorUrl('http://100.100.100.200/latest/')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(normalizeCustomMirrorUrl('http://169.254.169.254/latest/')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(normalizeCustomMirrorUrl('http://0/')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(normalizeCustomMirrorUrl('http://2130706433/')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(normalizeCustomMirrorUrl('http://metadata.google.com/')).toEqual({
      ok: false,
      reason: 'loopback',
    });
    expect(isHttpUrl('https://github.com/org/repo')).toBe(true);
    expect(isHttpUrl('http://192.168.1.10:3000/org/repo')).toBe(true);
    expect(isHttpUrl('git@gitea.local:org/repo')).toBe(false);
    expect(isHttpUrl('ssh://git@ssh.github.com:443/org/repo.git')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(normalizeCustomMirrorUrl('https://user:pass@proxy.example.com/')).toEqual({
      ok: false,
      reason: 'credentials',
    });
    expect(normalizeCustomMirrorUrl('file:///etc/passwd')).toEqual({
      ok: false,
      reason: 'invalid_scheme',
    });
    expect(normalizeCustomMirrorUrl('   ')).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('maps initial mirror selection and submit payloads for builtin, SSH, and custom modes', () => {
    expect(resolveInitialMirrorSelection('', 'auto', AVAILABLE_MIRRORS)).toEqual({
      selectValue: DEFAULT_MIRROR_VALUE,
      customUrl: '',
    });
    expect(resolveInitialMirrorSelection('ssh://', 'ssh', AVAILABLE_MIRRORS)).toEqual({
      selectValue: SSH_MIRROR_VALUE,
      customUrl: '',
    });
    expect(
      resolveInitialMirrorSelection('https://my-proxy.example.com/', 'proxy', AVAILABLE_MIRRORS),
    ).toEqual({
      selectValue: CUSTOM_PROXY_VALUE,
      customUrl: 'https://my-proxy.example.com/',
    });
    expect(
      resolveInitialMirrorSelection(
        'https://git.corp.local/gscore-mirror/',
        'mirror',
        AVAILABLE_MIRRORS,
      ),
    ).toEqual({
      selectValue: CUSTOM_MIRROR_VALUE,
      customUrl: 'https://git.corp.local/gscore-mirror/',
    });

    expect(resolveMirrorSubmitPayload(SSH_MIRROR_VALUE, '')).toEqual({
      ok: true,
      mirrorPrefix: 'ssh://',
      mirrorType: 'ssh',
      configMode: 'auto',
    });
    expect(resolveMirrorSubmitPayload(CUSTOM_PROXY_VALUE, 'https://p.example.com')).toEqual({
      ok: true,
      mirrorPrefix: 'https://p.example.com/',
      mirrorType: 'proxy',
      configMode: 'proxy',
    });
    expect(resolveMirrorSubmitPayload(CUSTOM_MIRROR_VALUE, 'https://m.example.com/org')).toEqual({
      ok: true,
      mirrorPrefix: 'https://m.example.com/org/',
      mirrorType: 'mirror',
      configMode: 'mirror',
    });
  });

  it('filters single-plugin mirror options by supported_mirrors and probe states', () => {
    const forkPlugin: GitPluginInfo = {
      name: 'GenshinUID',
      path: '/plugins/GenshinUID',
      remote_url: 'https://github.com/alice/GenshinUID.git',
      is_git_repo: true,
      mirror: 'github',
      source_kind: 'fork',
      upstream_host: 'github.com',
      upstream_url: 'https://github.com/alice/GenshinUID',
      supported_mirrors: ['github', 'ghproxy', 'ssh'],
      mirror_probes: [],
    };
    const forkOptions = buildPluginMirrorOptions(forkPlugin, AVAILABLE_MIRRORS);
    expect(forkOptions).toHaveLength(5);
    expect(forkOptions.find((o) => o.channel === 'cnb')?.disabled).toBe(true);
    expect(forkOptions.find((o) => o.channel === 'cnb')?.disableReason).toBe('fork_mirror_blocked');
    expect(forkOptions.find((o) => o.channel === 'ghproxy')?.disabled).toBe(false);
    expect(forkOptions.find((o) => o.channel === 'ssh')?.disabled).toBe(false);
    expect(isPluginSwitchable(forkPlugin)).toBe(true);
    expect(canPluginUseCustomProxy(forkPlugin)).toBe(true);
    expect(canPluginUseCustomMirror(forkPlugin)).toBe(false);

    const officialWithUnsynced: GitPluginInfo = {
      name: 'DemoUID',
      path: '/plugins/DemoUID',
      remote_url: 'https://github.com/Genshin-bots/DemoUID',
      is_git_repo: true,
      mirror: 'github',
      source_kind: 'official',
      supported_mirrors: ['github', 'gitcode', 'cnb', 'ghproxy', 'ssh'],
      mirror_probes: [
        {
          channel: 'cnb',
          target_url: 'https://cnb.cool/gscore-mirror/DemoUID',
          state: 'not_synced',
          checked_at: 1_700_000_000,
          expires_at: 1_700_000_090,
        },
        {
          channel: 'gitcode',
          target_url: 'https://gitcode.com/gscore-mirror/DemoUID',
          state: 'unreachable',
          checked_at: 1_700_000_000,
          expires_at: 1_700_000_030,
        },
      ],
    };
    const officialOpts = buildPluginMirrorOptions(
      officialWithUnsynced,
      AVAILABLE_MIRRORS,
      1_700_000_010,
    );
    expect(officialOpts.find((o) => o.channel === 'cnb')?.disabled).toBe(true);
    expect(officialOpts.find((o) => o.channel === 'cnb')?.disableReason).toBe('not_synced');
    // unreachable stays enabled so user can retry after transient network jitter
    expect(officialOpts.find((o) => o.channel === 'gitcode')?.disabled).toBe(false);
    expect(officialOpts.find((o) => o.channel === 'gitcode')?.probeState).toBe('unreachable');
    // 后端下发的 expires_at 到期后立即失效（不再依赖魔数阈值）
    const expiredByServerOpts = buildPluginMirrorOptions(
      officialWithUnsynced,
      AVAILABLE_MIRRORS,
      1_700_000_100,
    );
    expect(expiredByServerOpts.find((o) => o.channel === 'cnb')?.disabled).toBe(false);
    expect(expiredByServerOpts.find((o) => o.channel === 'cnb')?.probeState).toBeUndefined();
    // 兼容旧后端（不返回 available_mirrors.channel 与 probe.expires_at）
    const legacyMirrors: GitMirrorOption[] = AVAILABLE_MIRRORS.map(
      ({ channel: _c, ...rest }) => rest,
    );
    const legacyOpts = buildPluginMirrorOptions(
      {
        ...officialWithUnsynced,
        mirror_probes: [
          {
            channel: 'cnb',
            target_url: 'https://cnb.cool/gscore-mirror/DemoUID',
            state: 'not_synced',
            checked_at: 1_700_000_000,
          },
        ],
      },
      legacyMirrors,
      1_700_000_050,
    );
    expect(legacyOpts.find((o) => o.channel === 'cnb')?.disabled).toBe(true);

    const nativeCnbFork: GitPluginInfo = {
      name: 'StarRailUID',
      path: '/plugins/StarRailUID',
      remote_url: 'https://cnb.cool/alice/StarRailUID',
      is_git_repo: true,
      mirror: 'native',
      source_kind: 'fork',
      upstream_host: 'cnb.cool',
      upstream_url: 'https://cnb.cool/alice/StarRailUID',
      supported_mirrors: [],
    };
    expect(isPluginSwitchable(nativeCnbFork)).toBe(false);
    expect(canPluginUseCustomProxy(nativeCnbFork)).toBe(false);
    expect(canPluginUseCustomMirror(nativeCnbFork)).toBe(false);
    expect(canPluginUseCustomProxy(officialWithUnsynced)).toBe(true);
    expect(canPluginUseCustomMirror(officialWithUnsynced)).toBe(true);
    expect(
      buildPluginMirrorOptions(nativeCnbFork, AVAILABLE_MIRRORS).every((o) => o.disabled),
    ).toBe(true);

    // 真实时间戳下超过 90s TTL 的 not_synced 探活自动失效，防止选项被长期锁死
    const expiredNotSynced: GitPluginInfo = {
      ...officialWithUnsynced,
      mirror_probes: [
        {
          channel: 'cnb',
          target_url: 'https://cnb.cool/gscore-mirror/DemoUID',
          state: 'not_synced',
          checked_at: 1_700_000_000,
        },
      ],
    };
    const stillFreshOpts = buildPluginMirrorOptions(
      expiredNotSynced,
      AVAILABLE_MIRRORS,
      1_700_000_050,
    );
    expect(stillFreshOpts.find((o) => o.channel === 'cnb')?.disabled).toBe(true);
    const expiredOpts = buildPluginMirrorOptions(
      expiredNotSynced,
      AVAILABLE_MIRRORS,
      1_700_000_120,
    );
    expect(expiredOpts.find((o) => o.channel === 'cnb')?.disabled).toBe(false);
    expect(expiredOpts.find((o) => o.channel === 'cnb')?.probeState).toBeUndefined();

    // 单插件切换弹窗初始化遵循该插件自身当前镜像与 active_mirror_prefix
    expect(
      resolvePluginInitialMirrorSelection(
        {
          ...officialWithUnsynced,
          mirror: 'cnb',
          active_mirror_prefix: 'https://cnb.cool/gscore-mirror/',
        },
        AVAILABLE_MIRRORS,
      ),
    ).toEqual({ selectValue: 'https://cnb.cool/gscore-mirror/', customUrl: '' });
    expect(
      resolvePluginInitialMirrorSelection(
        {
          ...forkPlugin,
          mirror: 'custom_proxy',
          active_mirror_prefix: 'https://my-proxy.example.com/',
        },
        AVAILABLE_MIRRORS,
      ),
    ).toEqual({
      selectValue: CUSTOM_PROXY_VALUE,
      customUrl: 'https://my-proxy.example.com/',
    });
    expect(
      resolvePluginInitialMirrorSelection(
        {
          ...officialWithUnsynced,
          mirror: 'custom_mirror',
          active_mirror_prefix: 'https://git.corp.local/org/',
        },
        AVAILABLE_MIRRORS,
      ),
    ).toEqual({
      selectValue: CUSTOM_MIRROR_VALUE,
      customUrl: 'https://git.corp.local/org/',
    });
  });

  it('derives badges, issue links, and README URLs without guessing fake GitHub URLs', () => {
    expect(getSourceBadgeInfo('official', 'github.com', t)).toBeNull();
    expect(getSourceBadgeInfo('fork', 'cnb.cool', t)?.label).toContain('cnb.cool');
    expect(
      getMirrorBadgeMeta('native', 'https://git.corp.local/a/b', 'git.corp.local', t).label,
    ).toBe('git.corp.local');
    expect(
      getMirrorBadgeMeta('custom_proxy', 'https://p.io/https://github.com/a/b', 'github.com', t)
        .label,
    ).toBe('gitMirror.customProxyShort');

    expect(
      resolveCommitIssueBaseUrl(
        { upstream_host: 'git.corp.local', upstream_url: 'https://git.corp.local/dev/PluginA' },
        'https://git.corp.local/dev/PluginA',
      ),
    ).toBeNull();
    expect(
      resolveCommitIssueBaseUrl(
        { upstream_host: 'github.com', upstream_url: 'https://github.com/alice/MyFork' },
        'https://ghproxy.com/https://github.com/alice/MyFork.git',
      ),
    ).toBe('https://github.com/alice/MyFork');

    expect(buildPluginReadmeUrls({ id: 'LocalOnly', in_store: false, link: '' }, null)).toEqual([]);
    expect(
      buildPluginReadmeUrls(
        {
          id: 'LocalCNB',
          in_store: false,
          link: '',
          local_upstream_url: 'https://cnb.cool/alice/LocalCNB',
        },
        null,
      )[0],
    ).toBe('https://cnb.cool/alice/LocalCNB/-/git/raw/master/README.md');
    expect(
      buildPluginReadmeUrls(
        {
          id: 'LocalGH',
          in_store: false,
          link: 'https://github.com/alice/LocalGH',
        },
        {
          name: 'LocalGH',
          path: '/plugins/LocalGH',
          remote_url: 'https://my-proxy.example.com/https://github.com/alice/LocalGH.git',
          is_git_repo: true,
          mirror: 'custom_proxy',
          source_kind: 'third_party',
          active_mirror_prefix: 'https://my-proxy.example.com/',
        },
      )[0],
    ).toBe(
      'https://my-proxy.example.com/https://raw.githubusercontent.com/alice/LocalGH/master/README.md',
    );
    expect(
      buildPluginReadmeUrls(
        { id: 'DemoUID', in_store: true, link: 'https://github.com/Genshin-bots/DemoUID' },
        {
          name: 'DemoUID',
          path: '/plugins/DemoUID',
          remote_url: 'https://ghproxy.mihomo.me/https://github.com/Genshin-bots/DemoUID.git',
          is_git_repo: true,
          mirror: 'ghproxy',
          source_kind: 'official',
          active_mirror_prefix: 'https://ghproxy.mihomo.me/',
        },
      )[0],
    ).toBe(
      'https://ghproxy.mihomo.me/https://raw.githubusercontent.com/Genshin-bots/DemoUID/master/README.md',
    );
  });

  it('resolves README relative images against the exact fetched README URL across hosts', () => {
    expect(
      resolveReadmeAssetUrl(
        'https://cnb.cool/gscore-mirror/StarRailUID/-/git/raw/master/README.md',
        './ICON.png',
      ),
    ).toBe('https://cnb.cool/gscore-mirror/StarRailUID/-/git/raw/master/ICON.png');
    expect(
      resolveReadmeAssetUrl(
        'https://raw.githubusercontent.com/Genshin-bots/DemoUID/refs/heads/main/README.md',
        'docs/banner.png',
      ),
    ).toBe(
      'https://raw.githubusercontent.com/Genshin-bots/DemoUID/refs/heads/main/docs/banner.png',
    );
    expect(
      resolveReadmeAssetUrl(
        'https://raw.gitcode.com/gscore-mirror/DemoUID/raw/master/README.md',
        '/assets/logo.png',
      ),
    ).toBe('https://raw.gitcode.com/gscore-mirror/DemoUID/raw/master/assets/logo.png');
    expect(resolveReadmeAssetUrl('https://example.com/README.md', 'https://cdn.io/a.png')).toBe(
      'https://cdn.io/a.png',
    );
    expect(resolveReadmeAssetUrl('https://example.com/README.md', 'data:image/png;base64,AA')).toBe(
      'data:image/png;base64,AA',
    );
  });

  it('only ignores missing config item errors when saving GitMirrorMode on old Core', () => {
    expect(
      isMissingConfigItemError(new Error('配置项 GitMirrorMode 不存在'), 'GitMirrorMode'),
    ).toBe(true);
    expect(
      isMissingConfigItemError(new Error('Config item GitMirrorMode not found'), 'GitMirrorMode'),
    ).toBe(true);
    expect(isMissingConfigItemError(new Error('401 Unauthorized'), 'GitMirrorMode')).toBe(false);
    expect(isMissingConfigItemError(new Error('Failed to fetch'), 'GitMirrorMode')).toBe(false);
    expect(isMissingConfigItemError(new Error('500 Internal Server Error'), 'GitMirrorMode')).toBe(
      false,
    );
    expect(isEndpointNotFoundError(new Error('Not Found'))).toBe(true);
    expect(isEndpointNotFoundError(new Error('HTTP 404 Not Found'))).toBe(true);
    expect(isEndpointNotFoundError(new Error('401 Unauthorized'))).toBe(false);
    expect(isEndpointNotFoundError(new Error('Failed to fetch'))).toBe(false);
  });
});
