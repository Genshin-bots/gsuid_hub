import { describe, expect, it } from 'vitest';
import {
  classifyBackupSource,
  diffSelection,
  extractFileTreeChildren,
  normalizeFileTreeListing,
  resolveTopLevelPluginMap,
  sortBackupFilesNewestFirst,
  toLoadedFileTreeNode,
  userDataUncoveredByChange,
} from './backupFileTree';
import type { BackupHintEntry } from './api';

describe('extractFileTreeChildren', () => {
  it('reads children from the current listing object', () => {
    const children = extractFileTreeChildren({
      path: '',
      children: [{ path: 'config', name: 'config' }],
    });
    expect(children).toHaveLength(1);
  });

  it('unwraps the old Core [root] array (listing.children was undefined on that shape)', () => {
    const raw = [
      {
        id: '.',
        name: 'data',
        type: 'directory',
        path: '.',
        children: [
          { id: 'config', name: 'config', type: 'directory', path: 'config', children: [] },
          { id: 'db', name: 'db', type: 'directory', path: 'db', children: [] },
        ],
      },
    ];
    expect((raw as { children?: unknown }).children).toBeUndefined();
    const children = extractFileTreeChildren(raw);
    expect(children.map((n) => (n as { name: string }).name)).toEqual(['config', 'db']);
  });

  it('returns [] when children/nodes are missing (the production crash shape)', () => {
    expect(extractFileTreeChildren(undefined)).toEqual([]);
    expect(extractFileTreeChildren(null)).toEqual([]);
    expect(extractFileTreeChildren({})).toEqual([]);
    expect(extractFileTreeChildren({ truncated: true })).toEqual([]);
  });

  it('accepts a nodes alias', () => {
    const children = extractFileTreeChildren({ nodes: [{ path: 'a', name: 'a' }] });
    expect(children).toHaveLength(1);
  });
});

describe('normalizeFileTreeListing', () => {
  it('matches current Core list_backup_dir / GET /api/backup/file-tree data', () => {
    // Exact keys from gsuid_core.webconsole.backup_api.list_backup_dir + _entry_node.
    const raw = {
      path: '',
      name: 'data',
      type: 'directory',
      size_bytes: 10,
      file_count: 1,
      child_total: 1,
      offset: 0,
      limit: 100,
      truncated: false,
      omitted_count: 0,
      sort: 'size',
      children: [
        {
          id: 'config',
          name: 'config',
          type: 'directory',
          path: 'config',
          size_bytes: 10,
          file_count: 1,
          has_children: true,
        },
      ],
    };
    const listing = normalizeFileTreeListing(raw);
    expect(listing.children).toHaveLength(1);
    expect(listing.children[0]).toMatchObject({
      path: 'config',
      has_children: true,
      loaded: false,
      children: [],
    });
  });

  it('keeps pagination fields from the current API', () => {
    const listing = normalizeFileTreeListing({
      path: 'plugin-res',
      name: 'plugin-res',
      type: 'directory',
      size_bytes: 10,
      file_count: 120,
      child_total: 120,
      offset: 0,
      limit: 100,
      truncated: true,
      omitted_count: 20,
      sort: 'size',
      children: [
        {
          id: 'plugin-res/a.bin',
          name: 'a.bin',
          type: 'file',
          path: 'plugin-res/a.bin',
          size_bytes: 10,
          file_count: 1,
          has_children: false,
        },
      ],
    });
    expect(listing.truncated).toBe(true);
    expect(listing.omitted_count).toBe(20);
    expect(listing.child_total).toBe(120);
    expect(listing.children).toHaveLength(1);
    expect(listing.children[0].name).toBe('a.bin');
  });

  it('keeps hint/hint_count fields and the hint sort from the current API', () => {
    const listing = normalizeFileTreeListing({
      path: '',
      name: 'data',
      type: 'directory',
      size_bytes: 10,
      file_count: 1,
      child_total: 2,
      offset: 0,
      limit: 100,
      truncated: false,
      omitted_count: 0,
      sort: 'hint',
      children: [
        {
          id: 'GenshinUID',
          name: 'GenshinUID',
          type: 'directory',
          path: 'GenshinUID',
          size_bytes: 10,
          file_count: 2,
          has_children: true,
          hint: null,
          hint_count: 3,
        },
        {
          id: 'GsData.db',
          name: 'GsData.db',
          type: 'file',
          path: 'GsData.db',
          size_bytes: 10,
          file_count: 1,
          has_children: false,
          hint: {
            kind: 'user_data',
            plugin: 'GsCore',
            desc: '主数据库',
            default_selected: true,
          },
          hint_count: 0,
        },
      ],
    });
    expect(listing.sort).toBe('hint');
    expect(listing.children[0].hint).toBeNull();
    expect(listing.children[0].hint_count).toBe(3);
    expect(listing.children[1].hint).toMatchObject({ kind: 'user_data', plugin: 'GsCore' });
  });

  it('defaults hint to null and hint_count to 0 on old Core payloads', () => {
    const node = toLoadedFileTreeNode({
      id: 'config',
      name: 'config',
      type: 'directory',
      path: 'config',
    });
    expect(node?.hint).toBeNull();
    expect(node?.hint_count).toBe(0);
  });

  it('drops hint objects whose kind is unknown', () => {
    const node = toLoadedFileTreeNode({
      path: 'x',
      name: 'x',
      type: 'file',
      hint: { kind: 'mystery', plugin: 'p', desc: 'd', default_selected: false },
    });
    expect(node?.hint).toBeNull();
  });

  it('does not throw when mapping children of an old [root] payload', () => {
    const listing = normalizeFileTreeListing([
      {
        id: '.',
        name: 'data',
        type: 'directory',
        path: '.',
        children: [
          {
            id: 'config',
            name: 'config',
            type: 'directory',
            path: 'config',
            children: [
              {
                id: 'config/settings.json',
                name: 'settings.json',
                type: 'file',
                path: 'config/settings.json',
                children: [],
              },
            ],
          },
        ],
      },
    ]);
    expect(listing.children.map((n) => n.name)).toEqual(['config']);
    expect(listing.children[0].loaded).toBe(true);
    expect(listing.children[0].children[0]?.name).toBe('settings.json');
  });
});

describe('toLoadedFileTreeNode', () => {
  it('fills missing size/count so the tree row can render', () => {
    const node = toLoadedFileTreeNode({ name: 'config', path: 'config', type: 'directory' });
    expect(node).toMatchObject({
      id: 'config',
      size_bytes: 0,
      file_count: 0,
      has_children: false,
      loaded: false,
      children: [],
    });
  });
});

const hintEntry = (path: string, kind: BackupHintEntry['kind']): BackupHintEntry => ({
  path,
  plugin: 'TestPlugin',
  kind,
  desc: 'desc',
  default_selected: false,
  exists: true,
  selected: false,
  size_bytes: 0,
  file_count: 0,
});

describe('diffSelection', () => {
  it('computes added/removed without touching unchanged entries', () => {
    expect(diffSelection(['a', 'b/c'], ['b/c', 'd'])).toEqual({
      added: ['d'],
      removed: ['a'],
    });
    expect(diffSelection([], [])).toEqual({ added: [], removed: [] });
    expect(diffSelection(['x'], [])).toEqual({ added: [], removed: ['x'] });
  });
});

describe('userDataUncoveredByChange', () => {
  const hints = [
    hintEntry('GsData.db', 'user_data'),
    hintEntry('GenshinUID/players', 'user_data'),
    hintEntry('config.json', 'config'),
  ];

  it('flags user_data hints covered before but not after, incl. ancestor uncheck', () => {
    // 取消祖先 GenshinUID → players 提示失去覆盖
    const hit = userDataUncoveredByChange(hints, ['GsData.db', 'GenshinUID'], ['GsData.db']);
    expect(hit.map((h) => h.path)).toEqual(['GenshinUID/players']);
  });

  it('ignores non-user_data kinds and still-covered hints', () => {
    const hit = userDataUncoveredByChange(hints, ['GsData.db', 'config.json'], ['config.json']);
    expect(hit.map((h) => h.path)).toEqual(['GsData.db']);
    expect(userDataUncoveredByChange(hints, ['GsData.db', 'config.json'], [])).toHaveLength(1); // config 不是 user_data，不报
  });
});

describe('resolveTopLevelPluginMap', () => {
  it('maps top-level directories to unique plugin names and omits conflicts', () => {
    const map = resolveTopLevelPluginMap([
      { ...hintEntry('RHComfyUI/gemini', 'config'), plugin: 'RH_ComfyUI' },
      { ...hintEntry('RHComfyUI/output', 'user_data'), plugin: 'RH_ComfyUI' },
      { ...hintEntry('GenshinUID/players', 'user_data'), plugin: 'GenshinUID' },
      { ...hintEntry('shared/a', 'config'), plugin: 'PluginA' },
      { ...hintEntry('shared/b', 'config'), plugin: 'PluginB' },
    ]);
    expect(map.get('RHComfyUI')).toBe('RH_ComfyUI');
    expect(map.get('GenshinUID')).toBe('GenshinUID');
    expect(map.has('shared')).toBe(false);
    expect(resolveTopLevelPluginMap(null).size).toBe(0);
  });
});

describe('classifyBackupSource', () => {
  it('distinguishes manual NowFile, scheduled date archives, pre-restore, and uploads', () => {
    expect(classifyBackupSource('NowFile-2026-11-16.zip')).toBe('manual');
    expect(classifyBackupSource('2026-11-16-2026-11-16.zip')).toBe('auto');
    expect(classifyBackupSource('2026-11-16.zip')).toBe('auto');
    expect(classifyBackupSource('pre-restore-1700000000-2026-11-16.zip')).toBe('pre_restore');
    expect(classifyBackupSource('upload-backup-2026-11-16.zip')).toBe('uploaded');
    expect(classifyBackupSource('custom-archive.zip')).toBe('unknown');
  });
});

describe('sortBackupFilesNewestFirst', () => {
  it('places newest created backups at the top and handles invalid dates cleanly', () => {
    const input = [
      { fileName: '2026-11-09-2026-11-09.zip', created: '2026-11-09T00:55:00' },
      { fileName: '2026-11-16-2026-11-16.zip', created: '2026-11-16T00:55:00' },
      { fileName: 'NowFile-2026-11-16.zip', created: '2026-11-16T04:56:00' },
      { fileName: 'missing-date.zip', created: '' },
    ];
    const sorted = sortBackupFilesNewestFirst(input);
    expect(sorted.map((f) => f.fileName)).toEqual([
      'NowFile-2026-11-16.zip',
      '2026-11-16-2026-11-16.zip',
      '2026-11-09-2026-11-09.zip',
      'missing-date.zip',
    ]);
    // 不修改原数组顺序
    expect(input[0].fileName).toBe('2026-11-09-2026-11-09.zip');
  });
});
