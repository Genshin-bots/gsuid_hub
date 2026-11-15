import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  HardDrive,
  ArrowDownWideNarrow,
  Lightbulb,
  Loader2,
  Hash,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  backupApi,
  getApiErrorMessage,
  type BackupFileTreeSort,
  type BackupHintEntry,
  type BackupHintKind,
} from '@/lib/api';
import {
  HINT_BADGE_VARIANT,
  HINT_KIND_KEYS,
  normalizeFileTreeListing,
  resolveTopLevelPluginMap,
  userDataUncoveredByChange,
  type LoadedFileTreeNode,
} from '@/lib/backupFileTree';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface FileTreeSelectorProps {
  selectedPaths: string[];
  onSelectionChange: (paths: string[]) => void;
  /** undefined = 还在拉取；null = 旧 Core 无该接口（隐藏 hint 选项） */
  hints?: BackupHintEntry[] | null;
  className?: string;
}

type LoadedNode = LoadedFileTreeNode;

const HINT_GROUP_ORDER: BackupHintKind[] = ['user_data', 'config', 'regenerable'];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function pathIsUnder(parent: string, child: string): boolean {
  if (!parent) return child !== '';
  return child === parent || child.startsWith(`${parent}/`);
}

function getSelectionState(
  node: LoadedNode,
  selectedPaths: Set<string>,
): 'checked' | 'unchecked' | 'indeterminate' {
  if (selectedPaths.has(node.path)) return 'checked';
  for (const p of selectedPaths) {
    if (p !== node.path && pathIsUnder(p, node.path)) return 'checked';
  }
  if (node.type === 'file') return 'unchecked';
  for (const p of selectedPaths) {
    if (p !== node.path && pathIsUnder(node.path, p)) return 'indeterminate';
  }
  return 'unchecked';
}

interface TreeNodeProps {
  node: LoadedNode;
  selectedPaths: Set<string>;
  topLevelPluginMap: Map<string, string>;
  onToggle: (node: LoadedNode) => void;
  onExpand: (node: LoadedNode) => void;
  onLoadMore: (node: LoadedNode) => void;
  level: number;
}

function TreeNode({
  node,
  selectedPaths,
  topLevelPluginMap,
  onToggle,
  onExpand,
  onLoadMore,
  level,
}: TreeNodeProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const state = getSelectionState(node, selectedPaths);
  const isFolder = node.type === 'directory';
  const canExpand = isFolder && node.has_children;
  const pluginOwner =
    node.hint?.plugin || (level === 0 ? topLevelPluginMap.get(node.path) : undefined);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !node.loaded && !node.loading) {
      onExpand(node);
    }
  };

  const content = (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer min-w-0',
      )}
      style={{ paddingLeft: `${level * 16 + 8}px` }}
    >
      {canExpand ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="p-0.5 hover:bg-accent rounded shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronRight
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                isOpen && 'rotate-90',
              )}
            />
          </button>
        </CollapsibleTrigger>
      ) : (
        <span className="w-5 shrink-0" />
      )}

      <Checkbox
        checked={state === 'checked'}
        ref={(el) => {
          if (el) {
            (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate =
              state === 'indeterminate';
          }
        }}
        onCheckedChange={() => onToggle(node)}
      />

      {isFolder ? (
        isOpen ? (
          <FolderOpen className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <Folder className="w-4 h-4 text-primary shrink-0" />
        )
      ) : (
        <File className="w-4 h-4 text-muted-foreground shrink-0" />
      )}

      {pluginOwner && <PluginIcon pluginName={pluginOwner} className="w-4 h-4 shrink-0" />}

      <span className="text-sm select-none truncate" title={node.name}>
        {node.name}
      </span>
      {node.hint ? (
        <Badge
          variant={HINT_BADGE_VARIANT[node.hint.kind]}
          className="shrink-0"
          title={`${node.hint.plugin} · ${node.hint.desc}`}
        >
          {t(HINT_KIND_KEYS[node.hint.kind])}
        </Badge>
      ) : (
        isFolder &&
        (node.hint_count ?? 0) > 0 && (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            {t('backup.hintContains', { count: node.hint_count ?? 0 })}
          </Badge>
        )
      )}
      <span className="text-xs text-muted-foreground ml-auto shrink-0 tabular-nums">
        {isFolder
          ? t('backup.nodeMetaDir', { size: formatBytes(node.size_bytes), count: node.file_count })
          : formatBytes(node.size_bytes)}
      </span>
    </div>
  );

  if (!canExpand) {
    return content;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      {content}
      <CollapsibleContent>
        {node.loading && node.children.length === 0 && (
          <div
            className="text-xs text-muted-foreground py-1"
            style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
          >
            {t('backup.treeLoading')}
          </div>
        )}
        {node.loaded && node.children.length === 0 && (
          <div
            className="text-xs text-muted-foreground py-1"
            style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
          >
            {t('backup.emptyDir')}
          </div>
        )}
        {node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            selectedPaths={selectedPaths}
            topLevelPluginMap={topLevelPluginMap}
            onToggle={onToggle}
            onExpand={onExpand}
            onLoadMore={onLoadMore}
            level={level + 1}
          />
        ))}
        {node.truncated && (
          <div style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }} className="py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={node.loading}
              onClick={() => onLoadMore(node)}
            >
              {node.loading
                ? t('backup.treeLoading')
                : t('backup.moreItems', { count: node.omittedCount })}
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface HintListProps {
  hints: BackupHintEntry[];
  selectedPaths: string[];
  onSelectionChange: (paths: string[]) => void;
}

/** 「按建议」平铺视图：按 kind 分组列出登记项，末尾是跟建议无关的「其他已选」。 */
function HintListView({ hints, selectedPaths, onSelectionChange }: HintListProps) {
  const { t } = useLanguage();
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const groups = HINT_GROUP_ORDER.map((kind) => ({
    kind,
    items: hints.filter((h) => h.kind === kind),
  })).filter((g) => g.items.length > 0);
  const others = selectedPaths.filter(
    (p) => !hints.some((h) => h.path === p || p.startsWith(`${h.path}/`)),
  );

  const togglePath = (path: string, checked: boolean) => {
    const next = selectedPaths.filter((p) => !pathIsUnder(path, p));
    if (!checked) next.push(path);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.kind} className="space-y-1.5">
          <div className="text-sm font-medium flex items-center gap-2">
            <Badge variant={HINT_BADGE_VARIANT[group.kind]}>{t(HINT_KIND_KEYS[group.kind])}</Badge>
          </div>
          <ul className="space-y-1">
            {group.items.map((h) => {
              const coverer = selectedPaths.find((s) => s !== h.path && h.path.startsWith(`${s}/`));
              const checked = selectedSet.has(h.path) || !!coverer;
              return (
                <li
                  key={h.path}
                  className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    className="mt-2.5 shrink-0"
                    checked={checked}
                    disabled={!!coverer}
                    onCheckedChange={() => togglePath(h.path, checked)}
                  />
                  <PluginIcon
                    pluginName={h.plugin}
                    className="w-7 h-7 mt-1 shrink-0 rounded-md"
                    fallbackClassName="p-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-mono truncate" title={h.path}>
                        {h.path}
                      </span>
                      {!h.exists && (
                        <Badge variant="outline" className="shrink-0 text-muted-foreground">
                          {t('backup.hintNotExists')}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0 tabular-nums">
                        {h.exists
                          ? t('backup.nodeMetaDir', {
                              size: formatBytes(h.size_bytes),
                              count: h.file_count,
                            })
                          : '—'}
                      </span>
                    </div>
                    <div
                      className="text-xs text-muted-foreground truncate"
                      title={`${h.plugin} · ${h.desc}`}
                    >
                      {h.plugin} · {h.desc}
                    </div>
                    {coverer && (
                      <div className="text-xs text-muted-foreground">
                        {t('backup.hintCoveredBy', { path: coverer })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {others.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-sm font-medium text-muted-foreground">
            {t('backup.otherSelected')}
          </div>
          <ul className="space-y-1">
            {others.map((p) => (
              <li
                key={p}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  className="shrink-0"
                  checked
                  onCheckedChange={() => togglePath(p, true)}
                />
                <span className="text-sm font-mono truncate">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FileTreeSelector({
  selectedPaths,
  onSelectionChange,
  hints,
  className,
}: FileTreeSelectorProps) {
  const { t } = useLanguage();
  const [sort, setSort] = useState<BackupFileTreeSort>('hint');
  const [roots, setRoots] = useState<LoadedNode[]>([]);
  const [rootMeta, setRootMeta] = useState({
    truncated: false,
    omittedCount: 0,
    childTotal: 0,
    loading: false,
  });
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const topLevelPluginMap = useMemo(() => resolveTopLevelPluginMap(hints), [hints]);
  const sortGen = useRef(0);
  const hintsUnavailable = hints === null;
  const hintsAvailable = Array.isArray(hints);

  // 仅当确认后端不支持 hints（hints === null）时回退 size；加载中（undefined）保持默认 'hint'
  useEffect(() => {
    if (hints === null && sort === 'hint') setSort('size');
  }, [hints, sort]);

  const applyListing = useCallback(
    (nodes: LoadedNode[], listingChildren: LoadedNode[], append: boolean) => {
      if (!append) return listingChildren;
      const seen = new Set(nodes.map((n) => n.path));
      const extra = listingChildren.filter((n) => !seen.has(n.path));
      return [...nodes, ...extra];
    },
    [],
  );

  const fetchRoot = useCallback(
    async (nextSort: BackupFileTreeSort, offset = 0, append = false) => {
      if (nextSort === 'hint') return;
      if (!append) sortGen.current += 1;
      const gen = sortGen.current;
      setRootMeta((prev) => ({ ...prev, loading: true }));
      try {
        // Old Core returned `data: [root]`; listing.children was undefined → setRoots .map crash.
        const listing = normalizeFileTreeListing(
          await backupApi.getFileTree({
            sort: nextSort,
            offset,
            limit: 100,
          }),
          nextSort,
        );
        if (gen !== sortGen.current) return;
        setRoots((prev) => applyListing(append ? prev : [], listing.children, append));
        setRootMeta({
          truncated: listing.truncated,
          omittedCount: listing.omitted_count,
          childTotal: listing.child_total,
          loading: false,
        });
      } catch (error) {
        if (gen !== sortGen.current) return;
        setRootMeta((prev) => ({ ...prev, loading: false }));
        toast.error(getApiErrorMessage(error, t('backup.treeLoadFailed')));
      }
    },
    [applyListing, t],
  );

  useEffect(() => {
    void fetchRoot(sort, 0, false);
  }, [sort, fetchRoot]);

  const patchNode = useCallback(
    (nodes: LoadedNode[], path: string, fn: (n: LoadedNode) => LoadedNode): LoadedNode[] => {
      return nodes.map((n) => {
        if (n.path === path) return fn(n);
        if (n.children.length === 0) return n;
        return { ...n, children: patchNode(n.children, path, fn) };
      });
    },
    [],
  );

  const loadChildren = useCallback(
    async (node: LoadedNode, append: boolean) => {
      if (node.loading) return;
      const gen = sortGen.current;
      setRoots((prev) => patchNode(prev, node.path, (n) => ({ ...n, loading: true })));
      try {
        const listing = normalizeFileTreeListing(
          await backupApi.getFileTree({
            path: node.path,
            sort,
            offset: append ? node.children.length : 0,
            limit: 100,
          }),
          sort,
        );
        if (gen !== sortGen.current) return;
        setRoots((prev) =>
          patchNode(prev, node.path, (n) => ({
            ...n,
            loading: false,
            loaded: true,
            children: applyListing(n.children, listing.children, append),
            childTotal: listing.child_total,
            omittedCount: listing.omitted_count,
            truncated: listing.truncated,
          })),
        );
      } catch (error) {
        if (gen !== sortGen.current) return;
        setRoots((prev) => patchNode(prev, node.path, (n) => ({ ...n, loading: false })));
        toast.error(getApiErrorMessage(error, t('backup.treeLoadFailed')));
      }
    },
    [applyListing, patchNode, sort, t],
  );

  const [uncoverConfirm, setUncoverConfirm] = useState<{
    hints: BackupHintEntry[];
    next: string[];
  } | null>(null);

  // 取消勾选会先确认：新选择不再覆盖某个 user_data 建议项时弹出列表
  const requestSelectionChange = useCallback(
    (next: string[]) => {
      if (Array.isArray(hints)) {
        const uncovered = userDataUncoveredByChange(hints, selectedPaths, next);
        if (uncovered.length > 0) {
          setUncoverConfirm({ hints: uncovered, next });
          return;
        }
      }
      onSelectionChange(next);
    },
    [hints, selectedPaths, onSelectionChange],
  );

  const handleToggle = useCallback(
    (node: LoadedNode) => {
      const state = getSelectionState(node, selectedSet);
      let next: string[];
      if (state === 'checked') {
        next = selectedPaths.filter((p) => !pathIsUnder(node.path, p));
      } else {
        next = selectedPaths.filter((p) => !pathIsUnder(node.path, p));
        next.push(node.path);
      }
      requestSelectionChange(next);
    },
    [requestSelectionChange, selectedPaths, selectedSet],
  );

  const sortOptions = [
    ...(!hintsUnavailable
      ? [{ value: 'hint', label: t('backup.sortByHint'), icon: <Lightbulb className="w-4 h-4" /> }]
      : []),
    {
      value: 'size',
      label: t('backup.sortBySize'),
      icon: <ArrowDownWideNarrow className="w-4 h-4" />,
    },
    { value: 'count', label: t('backup.sortByCount'), icon: <Hash className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-3">
      <TabButtonGroup
        options={sortOptions}
        value={sort}
        onValueChange={(v) => setSort(v as BackupFileTreeSort)}
      />
      {sort === 'hint' && !hintsUnavailable ? (
        <div className={cn('rounded-lg border border-border/40 bg-transparent p-3', className)}>
          {hintsAvailable ? (
            <HintListView
              hints={hints}
              selectedPaths={selectedPaths}
              onSelectionChange={requestSelectionChange}
            />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-3">
              <HardDrive className="w-4 h-4" />
              {t('backup.treeLoading')}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'relative rounded-lg border border-border/40 bg-transparent p-2',
            className,
          )}
          aria-busy={rootMeta.loading}
        >
          {rootMeta.loading && roots.length > 0 && (
            <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          <div className={cn(rootMeta.loading && roots.length > 0 && 'opacity-60')}>
            {rootMeta.loading && roots.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-3">
                <HardDrive className="w-4 h-4" />
                {t('backup.treeLoading')}
              </div>
            )}
            {roots.map((item) => (
              <TreeNode
                key={item.id}
                node={item}
                selectedPaths={selectedSet}
                topLevelPluginMap={topLevelPluginMap}
                onToggle={handleToggle}
                onExpand={(n) => void loadChildren(n, false)}
                onLoadMore={(n) => void loadChildren(n, true)}
                level={0}
              />
            ))}
            {rootMeta.truncated && (
              <div className="px-2 py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={rootMeta.loading}
                  onClick={() => void fetchRoot(sort, roots.length, true)}
                >
                  {rootMeta.loading
                    ? t('backup.treeLoading')
                    : t('backup.moreItems', { count: rootMeta.omittedCount })}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!uncoverConfirm}
        onOpenChange={(open) => !open && setUncoverConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.uncoverTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('backup.uncoverDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-48 overflow-y-auto space-y-1.5">
            {uncoverConfirm?.hints.map((h) => (
              <li key={h.path} className="flex items-start gap-2.5 text-sm min-w-0">
                <PluginIcon
                  pluginName={h.plugin}
                  className="w-6 h-6 mt-0.5 shrink-0 rounded"
                  fallbackClassName="p-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono truncate" title={h.path}>
                    {h.path}
                  </div>
                  <div
                    className="text-xs text-muted-foreground truncate"
                    title={`${h.plugin} · ${h.desc}`}
                  >
                    {h.plugin} · {h.desc}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('backup.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (uncoverConfirm) onSelectionChange(uncoverConfirm.next);
                setUncoverConfirm(null);
              }}
            >
              {t('backup.uncoverConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
