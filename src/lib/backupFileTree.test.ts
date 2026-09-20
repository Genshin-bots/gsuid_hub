import { describe, expect, it } from 'vitest';
import {
  extractFileTreeChildren,
  normalizeFileTreeListing,
  toLoadedFileTreeNode,
} from './backupFileTree';

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
