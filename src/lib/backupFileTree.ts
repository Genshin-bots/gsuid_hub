import type { BackupFileTreeSort, FileTreeListing, FileTreeNode } from '@/lib/api';

export interface LoadedFileTreeNode extends FileTreeNode {
  children: LoadedFileTreeNode[];
  childTotal: number;
  omittedCount: number;
  truncated: boolean;
  loaded: boolean;
  loading: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNodeType(value: unknown): FileTreeNode['type'] {
  return value === 'file' ? 'file' : 'directory';
}

/**
 * Old Core returned `data: [root]` (one directory with nested `children`).
 * Current Core returns `{ children, child_total, truncated, ... }`.
 */
export function extractFileTreeChildren(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    if (
      raw.length === 1 &&
      isRecord(raw[0]) &&
      asNodeType(raw[0].type) === 'directory' &&
      Array.isArray(raw[0].children)
    ) {
      return raw[0].children;
    }
    return raw;
  }
  if (isRecord(raw)) {
    if (Array.isArray(raw.children)) return raw.children;
    if (Array.isArray(raw.nodes)) return raw.nodes;
  }
  return [];
}

export function toLoadedFileTreeNode(raw: unknown): LoadedFileTreeNode | null {
  if (!isRecord(raw)) return null;
  const path = asString(raw.path, asString(raw.id));
  const name = asString(raw.name, path);
  if (!path && !name) return null;

  const nestedRaw = Array.isArray(raw.children) ? raw.children : [];
  const nested = nestedRaw
    .map(toLoadedFileTreeNode)
    .filter((n): n is LoadedFileTreeNode => n != null);
  const hasNested = nested.length > 0;
  const type = asNodeType(raw.type);

  return {
    id: asString(raw.id, path || name),
    name: name || path,
    type,
    path: path || name,
    size_bytes: asNumber(raw.size_bytes),
    file_count: asNumber(raw.file_count, type === 'file' ? 1 : hasNested ? nested.length : 0),
    has_children: typeof raw.has_children === 'boolean' ? raw.has_children : hasNested,
    children: nested,
    childTotal: nested.length,
    omittedCount: 0,
    truncated: false,
    loaded: hasNested,
    loading: false,
  };
}

export function normalizeFileTreeListing(
  raw: unknown,
  fallbackSort: BackupFileTreeSort = 'size',
): FileTreeListing & { children: LoadedFileTreeNode[] } {
  const children = extractFileTreeChildren(raw)
    .map(toLoadedFileTreeNode)
    .filter((n): n is LoadedFileTreeNode => n != null);

  if (isRecord(raw)) {
    return {
      path: asString(raw.path),
      name: asString(raw.name, 'data'),
      type: 'directory',
      size_bytes: asNumber(raw.size_bytes),
      file_count: asNumber(raw.file_count),
      child_total: asNumber(raw.child_total, children.length),
      offset: asNumber(raw.offset),
      limit: asNumber(raw.limit, children.length),
      truncated: Boolean(raw.truncated),
      omitted_count: asNumber(raw.omitted_count),
      sort: raw.sort === 'count' ? 'count' : fallbackSort,
      children,
    };
  }

  return {
    path: '',
    name: 'data',
    type: 'directory',
    size_bytes: 0,
    file_count: 0,
    child_total: children.length,
    offset: 0,
    limit: children.length,
    truncated: false,
    omitted_count: 0,
    sort: fallbackSort,
    children,
  };
}
