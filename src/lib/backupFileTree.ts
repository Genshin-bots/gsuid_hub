import type {
  BackupFileTreeSort,
  BackupHintEntry,
  BackupHintInfo,
  BackupHintKind,
  FileTreeListing,
  FileTreeNode,
} from '@/lib/api';

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

const HINT_KINDS = new Set<BackupHintKind>(['user_data', 'config', 'regenerable']);
const FILE_TREE_SORTS = new Set<BackupFileTreeSort>(['hint', 'size', 'count']);

export const HINT_KIND_KEYS: Record<BackupHintKind, string> = {
  user_data: 'backup.hintKindUserData',
  config: 'backup.hintKindConfig',
  regenerable: 'backup.hintKindRegenerable',
};

export const HINT_BADGE_VARIANT: Record<BackupHintKind, 'default' | 'secondary' | 'outline'> = {
  user_data: 'default',
  config: 'secondary',
  regenerable: 'outline',
};

function asHint(value: unknown): BackupHintInfo | null {
  if (!isRecord(value)) return null;
  const kind = asString(value.kind);
  if (!HINT_KINDS.has(kind as BackupHintKind)) return null;
  return {
    kind: kind as BackupHintKind,
    plugin: asString(value.plugin),
    desc: asString(value.desc),
    default_selected: value.default_selected === true,
  };
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
    hint: asHint(raw.hint),
    hint_count: asNumber(raw.hint_count),
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
      sort: FILE_TREE_SORTS.has(raw.sort as BackupFileTreeSort)
        ? (raw.sort as BackupFileTreeSort)
        : fallbackSort,
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

export interface SelectionDiff {
  added: string[];
  removed: string[];
}

export function diffSelection(original: string[], current: string[]): SelectionDiff {
  const cur = new Set(current);
  const orig = new Set(original);
  return {
    added: current.filter((p) => !orig.has(p)),
    removed: original.filter((p) => !cur.has(p)),
  };
}

function isPathCoveredBySelection(path: string, selection: Set<string>): boolean {
  for (const s of selection) {
    if (path === s || path.startsWith(`${s}/`)) return true;
  }
  return false;
}

/** `before` 勾选覆盖、`after` 勾选不再覆盖的 user_data 建议项。 */
export function userDataUncoveredByChange(
  hints: BackupHintEntry[],
  before: string[],
  after: string[],
): BackupHintEntry[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return hints.filter(
    (h) =>
      h.kind === 'user_data' &&
      isPathCoveredBySelection(h.path, beforeSet) &&
      !isPathCoveredBySelection(h.path, afterSet),
  );
}

/** 根据建议路径归属反查顶层目录对应的唯一插件名（如 `RHComfyUI` → `RH_ComfyUI`）。 */
export function resolveTopLevelPluginMap(
  hints: readonly BackupHintEntry[] | null | undefined,
): Map<string, string> {
  const buckets = new Map<string, Set<string>>();
  if (!hints) return new Map();
  for (const h of hints) {
    if (!h.path || !h.plugin) continue;
    const slashIdx = h.path.indexOf('/');
    const top = slashIdx === -1 ? h.path : h.path.slice(0, slashIdx);
    if (!top) continue;
    let set = buckets.get(top);
    if (!set) {
      set = new Set();
      buckets.set(top, set);
    }
    set.add(h.plugin);
  }
  const resolved = new Map<string, string>();
  for (const [top, plugins] of buckets) {
    if (plugins.size === 1) {
      const [only] = plugins;
      resolved.set(top, only);
    }
  }
  return resolved;
}
