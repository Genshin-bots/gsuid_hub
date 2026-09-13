import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, Folder, FolderOpen, File, HardDrive, ArrowDownWideNarrow, Hash } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { cn } from '@/lib/utils';
import {
  backupApi,
  getApiErrorMessage,
  type BackupFileTreeSort,
  type FileTreeNode,
} from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface FileTreeSelectorProps {
  selectedPaths: string[];
  onSelectionChange: (paths: string[]) => void;
  className?: string;
}

interface LoadedNode extends FileTreeNode {
  children: LoadedNode[];
  childTotal: number;
  omittedCount: number;
  truncated: boolean;
  loaded: boolean;
  loading: boolean;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function toLoaded(node: FileTreeNode): LoadedNode {
  return {
    ...node,
    children: [],
    childTotal: 0,
    omittedCount: 0,
    truncated: false,
    loaded: false,
    loading: false,
  };
}

function pathIsUnder(parent: string, child: string): boolean {
  if (!parent) return child !== '';
  return child === parent || child.startsWith(`${parent}/`);
}

function getSelectionState(
  node: FileTreeNode,
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
  onToggle: (node: LoadedNode) => void;
  onExpand: (node: LoadedNode) => void;
  onLoadMore: (node: LoadedNode) => void;
  level: number;
}

function TreeNode({ node, selectedPaths, onToggle, onExpand, onLoadMore, level }: TreeNodeProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const state = getSelectionState(node, selectedPaths);
  const isFolder = node.type === 'directory';
  const canExpand = isFolder && node.has_children;

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

      <span className="text-sm select-none truncate">{node.name}</span>
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

export function FileTreeSelector({
  selectedPaths,
  onSelectionChange,
  className,
}: FileTreeSelectorProps) {
  const { t } = useLanguage();
  const [sort, setSort] = useState<BackupFileTreeSort>('size');
  const [roots, setRoots] = useState<LoadedNode[]>([]);
  const [rootMeta, setRootMeta] = useState({
    truncated: false,
    omittedCount: 0,
    childTotal: 0,
    loading: false,
  });
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const sortGen = useRef(0);

  const applyListing = useCallback((nodes: LoadedNode[], listingChildren: FileTreeNode[], append: boolean) => {
    const incoming = listingChildren.map(toLoaded);
    if (!append) return incoming;
    const seen = new Set(nodes.map((n) => n.path));
    const extra = incoming.filter((n) => !seen.has(n.path));
    return [...nodes, ...extra];
  }, []);

  const fetchRoot = useCallback(
    async (nextSort: BackupFileTreeSort, offset = 0, append = false) => {
      if (!append) sortGen.current += 1;
      const gen = sortGen.current;
      setRootMeta((prev) => ({ ...prev, loading: true }));
      try {
        const listing = await backupApi.getFileTree({
          sort: nextSort,
          offset,
          limit: 100,
        });
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

  const patchNode = useCallback((nodes: LoadedNode[], path: string, fn: (n: LoadedNode) => LoadedNode): LoadedNode[] => {
    return nodes.map((n) => {
      if (n.path === path) return fn(n);
      if (n.children.length === 0) return n;
      return { ...n, children: patchNode(n.children, path, fn) };
    });
  }, []);

  const loadChildren = useCallback(
    async (node: LoadedNode, append: boolean) => {
      if (node.loading) return;
      const gen = sortGen.current;
      setRoots((prev) => patchNode(prev, node.path, (n) => ({ ...n, loading: true })));
      try {
        const listing = await backupApi.getFileTree({
          path: node.path,
          sort,
          offset: append ? node.children.length : 0,
          limit: 100,
        });
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
      onSelectionChange(next);
    },
    [onSelectionChange, selectedPaths, selectedSet],
  );

  return (
    <div className="space-y-3">
      <TabButtonGroup
        options={[
          {
            value: 'size',
            label: t('backup.sortBySize'),
            icon: <ArrowDownWideNarrow className="w-4 h-4" />,
          },
          {
            value: 'count',
            label: t('backup.sortByCount'),
            icon: <Hash className="w-4 h-4" />,
          },
        ]}
        value={sort}
        onValueChange={(v) => setSort(v as BackupFileTreeSort)}
      />
      <div className={cn('border rounded-lg bg-background p-2', className)}>
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
  );
}
