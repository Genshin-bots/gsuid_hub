import { useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Eye,
  Key,
  Loader2,
  RefreshCw,
  Table2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import {
  aiStateStoreApi,
  AIStateStoreKeyItem,
  AIStateStoreScope,
  AIStateStoreRecordItem,
} from '@/lib/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatBytes(size?: number): string {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function valueTypeClass(valueType: string) {
  if (valueType === 'dict') return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
  if (valueType === 'list') return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
  if (valueType === 'string') return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
  if (valueType === 'scalar') return 'bg-purple-500/15 text-purple-600 border-purple-500/30';
  return 'bg-muted text-muted-foreground border-border/50';
}

export interface StateStoreViewerHandle {
  refresh: () => void;
  openBatchDelete: () => void;
}

interface StateStoreViewerProps {
  onSelectionChange?: (count: number) => void;
}

const StateStoreViewer = forwardRef<StateStoreViewerHandle, StateStoreViewerProps>(function StateStoreViewer(props, ref) {
  const { t } = useLanguage();
  const { style, cardOpacity, blurIntensity } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { onSelectionChange } = props;

  const [scopes, setScopes] = useState<AIStateStoreScope[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [keys, setKeys] = useState<AIStateStoreKeyItem[]>([]);
  const [isLoadingScopes, setIsLoadingScopes] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [prefixFilter, setPrefixFilter] = useState('');
  const [includeExpired, setIncludeExpired] = useState(false);

  // Value viewer state
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedValue, setExpandedValue] = useState<unknown>(null);
  const [isLoadingValue, setIsLoadingValue] = useState(false);

  // Record collection viewer state
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [collectionRecords, setCollectionRecords] = useState<AIStateStoreRecordItem[]>([]);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionOffset, setCollectionOffset] = useState(0);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [collectionWarning, setCollectionWarning] = useState<string | null>(null);

  // Single delete confirmation state
  const [deletePending, setDeletePending] = useState<{ scope: string; state_key: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Batch delete state
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const loadScopes = useCallback(async () => {
    try {
      setIsLoadingScopes(true);
      const data = await aiStateStoreApi.getScopes();
      setScopes(data.scopes || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.stateStore.messages.loadScopesFailed'));
    } finally {
      setIsLoadingScopes(false);
    }
  }, [t]);

  const loadKeys = useCallback(async () => {
    if (!selectedScope) {
      setKeys([]);
      return;
    }
    try {
      setIsLoadingKeys(true);
      const data = await aiStateStoreApi.getKeys({
        scope: selectedScope,
        prefix: prefixFilter.trim() || undefined,
        include_expired: includeExpired,
      });
      setKeys(data.items || []);
      setSelectedKeys(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.stateStore.messages.loadKeysFailed'));
      setKeys([]);
    } finally {
      setIsLoadingKeys(false);
    }
  }, [selectedScope, prefixFilter, includeExpired, t]);

  useEffect(() => {
    loadScopes();
  }, [loadScopes]);

  useEffect(() => {
    if (selectedScope) {
      loadKeys();
      setExpandedKey(null);
      setExpandedValue(null);
      setExpandedCollection(null);
      setCollectionRecords([]);
    } else {
      setKeys([]);
      setExpandedKey(null);
      setExpandedValue(null);
      setExpandedCollection(null);
    }
  }, [selectedScope, loadKeys]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selectedKeys.size);
  }, [selectedKeys.size, onSelectionChange]);

  // Imperative handle for parent
  useImperativeHandle(ref, () => ({
    refresh: () => {
      loadScopes();
      if (selectedScope) loadKeys();
    },
    openBatchDelete: () => {
      if (selectedKeys.size > 0) setBatchDeleteOpen(true);
    },
  }), [loadScopes, loadKeys, selectedScope, selectedKeys]);

  const toggleValue = async (keyItem: AIStateStoreKeyItem) => {
    if (expandedKey === keyItem.state_key) {
      setExpandedKey(null);
      setExpandedValue(null);
      setExpandedCollection(null);
      return;
    }
    if (keyItem.is_record_collection && keyItem.record_collection_name) {
      setExpandedKey(keyItem.state_key);
      setExpandedValue(null);
      setExpandedCollection(keyItem.state_key);
      setCollectionOffset(0);
      await loadRecords(keyItem.record_collection_name, 0);
      return;
    }
    try {
      setIsLoadingValue(true);
      setExpandedKey(keyItem.state_key);
      setExpandedCollection(null);
      const data = await aiStateStoreApi.getValue({
        scope: selectedScope,
        state_key: keyItem.state_key,
      });
      setExpandedValue(data.value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.stateStore.messages.loadValueFailed'));
      setExpandedValue(null);
    } finally {
      setIsLoadingValue(false);
    }
  };

  const loadRecords = async (collectionName: string, offset: number) => {
    try {
      setIsLoadingRecords(true);
      setCollectionWarning(null);
      const data = await aiStateStoreApi.getRecords({
        scope: selectedScope,
        collection: collectionName,
        limit: 50,
        offset,
      });
      setCollectionRecords(data.records || []);
      setCollectionTotal(data.total || 0);
      setCollectionOffset(offset);
      if (data.warning) setCollectionWarning(data.warning);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.stateStore.messages.loadRecordsFailed'));
      setCollectionRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const runDelete = async () => {
    if (!deletePending) return;
    try {
      setIsDeleting(true);
      await aiStateStoreApi.deleteEntry({
        scope: deletePending.scope,
        state_key: deletePending.state_key,
      });
      toast.success(t('aiKanban.stateStore.messages.deleteSuccess'));
      setDeletePending(null);
      await loadKeys();
      await loadScopes();
      if (expandedKey === deletePending.state_key) {
        setExpandedKey(null);
        setExpandedValue(null);
        setExpandedCollection(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.stateStore.messages.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Checkbox helpers
  const toggleKey = (stateKey: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(stateKey);
      else next.delete(stateKey);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(new Set(keys.map((k) => k.state_key)));
    } else {
      setSelectedKeys(new Set());
    }
  };

  const allSelected = keys.length > 0 && selectedKeys.size === keys.length;
  const someSelected = selectedKeys.size > 0 && !allSelected;

  // Batch delete
  const runBatchDelete = async () => {
    if (selectedKeys.size === 0 || !selectedScope) return;
    try {
      setIsBatchDeleting(true);
      const data = await aiStateStoreApi.batchDeleteEntries({
        scope: selectedScope,
        state_keys: Array.from(selectedKeys),
      });
      const deletedCount = data.deleted_count || 0;
      const notFoundCount = data.not_found_count || 0;
      toast.success(t('aiKanban.stateStore.messages.batchDeleteSuccess', { deleted: deletedCount, notFound: notFoundCount }));
      setBatchDeleteOpen(false);
      setSelectedKeys(new Set());
      await loadKeys();
      await loadScopes();
      // Clear expanded if any deleted key was expanded
      if (expandedKey && selectedKeys.has(expandedKey)) {
        setExpandedKey(null);
        setExpandedValue(null);
        setExpandedCollection(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.stateStore.messages.batchDeleteFailed'));
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const recordColumns = useMemo(() => {
    if (collectionRecords.length === 0) return [];
    return Object.keys(collectionRecords[0]);
  }, [collectionRecords]);

  const totalPages = Math.ceil(collectionTotal / 50);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filter bar - single row, consistent height */}
      <Card className="glass-card shrink-0">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto_auto] md:items-center">
            {/* Scope selector */}
            <div className="flex items-center gap-2 min-w-0 max-w-full">
              <Label className="text-xs text-muted-foreground shrink-0">{t('aiKanban.stateStore.selectScope')}</Label>
              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger className="h-9 min-w-0">
                  <SelectValue placeholder={t('aiKanban.stateStore.selectScopePlaceholder')} className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {scopes.map((s) => (
                    <SelectItem key={s.scope} value={s.scope}>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="px-1 py-0 text-[10px]">{s.key_count}</Badge>
                        <span className="truncate">{s.scope}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prefix filter */}
            <div className="flex items-center gap-2 min-w-0">
              <Label className="text-xs text-muted-foreground shrink-0">{t('aiKanban.stateStore.prefixFilter')}</Label>
              <Input
                value={prefixFilter}
                onChange={(e) => setPrefixFilter(e.target.value)}
                placeholder="record:"
                onBlur={() => selectedScope && loadKeys()}
                onKeyDown={(e) => e.key === 'Enter' && selectedScope && loadKeys()}
                className="h-9"
              />
            </div>

            {/* Include expired checkbox */}
            <div className="flex items-center gap-2 shrink-0">
              <Checkbox
                id="includeExpired"
                checked={includeExpired}
                onCheckedChange={(checked) => setIncludeExpired(!!checked)}
              />
              <Label htmlFor="includeExpired" className="text-sm cursor-pointer whitespace-nowrap">{t('aiKanban.stateStore.includeExpired')}</Label>
            </div>

            {/* Refresh keys button */}
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={loadKeys} disabled={!selectedScope || isLoadingKeys}>
              {isLoadingKeys ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
              {t('aiKanban.stateStore.refreshKeys')}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Keys list - scrollable area；仅竖直留 p-2 给阴影/间距，水平贴齐上方筛选卡外缘 */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2 px-0">
      {!selectedScope ? (
        <Card className="glass-card-flat shadow-none">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Database className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>{t('aiKanban.stateStore.selectScopeHint')}</p>
          </CardContent>
        </Card>
      ) : isLoadingKeys ? (
        <Card className="glass-card-flat shadow-none">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            {t('common.loading')}
          </CardContent>
        </Card>
      ) : keys.length === 0 ? (
        <Card className="glass-card-flat shadow-none">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Key className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>{t('aiKanban.stateStore.noKeys')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select all row */}
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-2">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  // indeterminate state for partial selection
                  (el as unknown as HTMLInputElement).indeterminate = someSelected;
                }
              }}
              onCheckedChange={(checked) => toggleAll(!!checked)}
            />
            <span className="text-sm text-muted-foreground">
              {allSelected
                ? t('aiKanban.stateStore.deselectAll')
                : t('aiKanban.stateStore.selectAll', { count: keys.length })}
            </span>
          </div>

          {keys.map((keyItem) => (
            <Card
              key={keyItem.state_key}
              className={cn(
                'glass-card shadow-none transition-all',
                expandedKey === keyItem.state_key && '!border-primary/60',
                selectedKeys.has(keyItem.state_key) && '!border-destructive/50',
              )}
              style={{
                ['--card-opacity' as string]: (cardOpacity / 100).toString(),
                ['--blur-intensity' as string]: `${blurIntensity}px`,
              }}
            >
              <CardContent className="p-4">
                {/* Key header row */}
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={selectedKeys.has(keyItem.state_key)}
                    onCheckedChange={(checked) => toggleKey(keyItem.state_key, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Expandable key info */}
                  <div
                    className="flex cursor-pointer flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between min-w-0"
                    onClick={() => toggleValue(keyItem)}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ChevronRight className={cn(
                          'h-4 w-4 shrink-0 transition-transform',
                          expandedKey === keyItem.state_key && 'rotate-90',
                        )} />
                        <span className="font-mono text-sm font-medium break-all">{keyItem.state_key}</span>
                        <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', valueTypeClass(keyItem.value_type))}>
                          {keyItem.value_type}
                        </Badge>
                        {keyItem.is_record_collection && (
                          <Badge className="px-1.5 py-0 text-[10px] bg-indigo-500/15 text-indigo-600 border-indigo-500/30">
                            <Table2 className="mr-1 h-3 w-3" />record
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-7">
                        <span>{t('aiKanban.stateStore.version')}: {keyItem.version}</span>
                        <span>{formatBytes(keyItem.size_bytes)}</span>
                        <span>{t('aiKanban.stateStore.updated')}: {formatDate(keyItem.updated_at)}</span>
                        {keyItem.expire_at && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {t('aiKanban.stateStore.expires')}: {formatDate(keyItem.expire_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Single delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletePending({ scope: selectedScope, state_key: keyItem.state_key });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Expanded value view */}
                {expandedKey === keyItem.state_key && !keyItem.is_record_collection && (
                  <div className="mt-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {t('aiKanban.stateStore.valuePreview')}
                    </div>
                    {isLoadingValue ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('common.loading')}
                      </div>
                    ) : expandedValue !== null ? (
                      <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap font-mono">
                        {JSON.stringify(expandedValue, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('aiKanban.stateStore.noValue')}</p>
                    )}
                  </div>
                )}

                {/* Expanded record collection view */}
                {expandedCollection === keyItem.state_key && keyItem.is_record_collection && (
                  <div className="mt-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Table2 className="h-3.5 w-3.5" />
                        {t('aiKanban.stateStore.recordCollection')}: {keyItem.record_collection_name}
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{collectionTotal}</Badge>
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={collectionOffset <= 0 || isLoadingRecords}
                            onClick={() => {
                              const newOffset = Math.max(0, collectionOffset - 50);
                              if (keyItem.record_collection_name) {
                                loadRecords(keyItem.record_collection_name, newOffset);
                              }
                            }}
                          >
                            {t('aiKanban.stateStore.prevPage')}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {Math.floor(collectionOffset / 50) + 1} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={collectionOffset + 50 >= collectionTotal || isLoadingRecords}
                            onClick={() => {
                              const newOffset = collectionOffset + 50;
                              if (keyItem.record_collection_name) {
                                loadRecords(keyItem.record_collection_name, newOffset);
                              }
                            }}
                          >
                            {t('aiKanban.stateStore.nextPage')}
                          </Button>
                        </div>
                      )}
                    </div>
                    {collectionWarning && (
                      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mr-2 inline h-4 w-4" />
                        {collectionWarning}
                      </div>
                    )}
                    {isLoadingRecords ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('common.loading')}
                      </div>
                    ) : collectionRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('aiKanban.stateStore.noRecords')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/50">
                              {recordColumns.map((col) => (
                                <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {collectionRecords.map((record, idx) => (
                              <tr key={record._rid || idx} className="border-b border-border/30 hover:bg-muted/30">
                                {recordColumns.map((col) => (
                                  <td key={col} className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate">
                                    {typeof record[col] === 'object' && record[col] !== null
                                      ? JSON.stringify(record[col])
                                      : String(record[col] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Single delete confirmation dialog */}
      <AlertDialog open={!!deletePending} onOpenChange={(open) => !open && setDeletePending(null)}>
        <AlertDialogContent className="glass-card border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('aiKanban.stateStore.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiKanban.stateStore.deleteDescription', {
                key: deletePending?.state_key || '',
                scope: deletePending?.scope || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {t('aiKanban.stateStore.deleteWarning')}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={runDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('common.loading') : t('aiKanban.stateStore.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete confirmation dialog */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={(open) => !open && setBatchDeleteOpen(false)}>
        <AlertDialogContent className="glass-card border-destructive/50 max-w-[92vw] sm:max-w-[600px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('aiKanban.stateStore.batchDelete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiKanban.stateStore.batchDelete.description', { count: selectedKeys.size, scope: selectedScope })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-3">
            <ul className="space-y-1">
              {Array.from(selectedKeys).map((key) => (
                <li key={key} className="font-mono text-xs text-muted-foreground break-all">• {key}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {t('aiKanban.stateStore.batchDelete.warning')}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={runBatchDelete}
              disabled={isBatchDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBatchDeleting ? t('common.loading') : t('aiKanban.stateStore.batchDelete.confirm', { count: selectedKeys.size })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default StateStoreViewer;
