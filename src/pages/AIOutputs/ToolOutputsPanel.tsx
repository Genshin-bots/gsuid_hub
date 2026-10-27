/**
 * 工具落盘面板 —— 合并页的「工具落盘」页签（原 /ai-tool-outputs）
 *
 * 后端：tool_outputs_api.py（`/api/ai/tool-outputs*`）
 * 与产出物面板的 res_* 不同：本面板管 FileOS 工具全文落盘（to_ / sa_ 等）。
 *
 * 页面壳（标题 / 页签 / 常驻筛选行）由 AIOutputsPage 负责，本文件只出内容：
 * - ToolOutputsFilters：受控筛选行，挂到合并页 PinnedPage 的 toolbar
 * - ToolOutputsPanel：列表卡片 + 详情 Dialog
 *
 * 筛选 / 翻页状态提升到合并页，列表加载留在本组件内；
 * 回车 / 查询 / 刷新由合并页递增 refreshKey 触发，不跨组件传函数引用。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Eye, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabButtonGroup, tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import {
  aiToolOutputsApi,
  getApiErrorMessage,
  type AIToolOutputDetail,
  type AIToolOutputItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatBytes, TOOL_ALL } from './constants';
import { MetaRow } from './shared';

const PAGE_SIZE = 50;

export interface ToolOutputsPanelProps {
  /** 已提交的查询词（回车 / 点「查询」才写入） */
  keyword: string;
  keywordDraft: string;
  onKeywordDraftChange: (value: string) => void;
  onSearch: () => void;
  toolName: string;
  onToolNameChange: (value: string) => void;
  toolNames: string[];
  includeExpired: boolean;
  onIncludeExpiredChange: (value: boolean) => void;
  offset: number;
  onOffsetChange: (value: number) => void;
  refreshKey: number;
  onRefresh: () => void;
}

/** 常驻筛选行。控件高度对齐 TabButtonGroup 内钮（h-10），与页签行同一视觉节奏。 */
export function ToolOutputsFilters(props: ToolOutputsPanelProps) {
  const { t } = useLanguage();
  const {
    keywordDraft,
    onKeywordDraftChange,
    onSearch,
    toolName,
    onToolNameChange,
    toolNames,
    includeExpired,
    onIncludeExpiredChange,
  } = props;

  return (
    // 窄屏两行、每行都铺满：第一行输入框（basis-full 独占），第二行「工具下拉（flex-1）+ 查询 + 含已过期」；
    // ≥768 回到原样（一行自适应，工具下拉 150px）。
    <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 md:w-auto md:min-w-auto md:justify-end">
      <Input
        className={cn(
          tabToolbarControlClass,
          'min-w-0 basis-full md:w-[240px] md:flex-initial',
        )}
        placeholder={t('aiToolOutputs.toolbar.keywordPlaceholder')}
        value={keywordDraft}
        onChange={(e) => onKeywordDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch();
        }}
      />
      <Select value={toolName} onValueChange={onToolNameChange}>
        <SelectTrigger className={cn(tabToolbarControlClass, 'w-full min-w-0 flex-1 md:w-[150px] md:flex-none')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOOL_ALL}>{t('aiToolOutputs.toolbar.toolAll')}</SelectItem>
          {toolNames.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button className={cn(tabToolbarControlClass, 'shrink-0')} onClick={onSearch}>
        {t('aiToolOutputs.toolbar.search')}
      </Button>
      <div className="flex shrink-0 items-center gap-2 pl-1">
        <Switch checked={includeExpired} onCheckedChange={onIncludeExpiredChange} />
        <Label className="whitespace-nowrap cursor-pointer">
          {t('aiToolOutputs.toolbar.includeExpired')}
        </Label>
      </div>
    </div>
  );
}

export function ToolOutputsPanel(props: ToolOutputsPanelProps) {
  const { t } = useLanguage();
  const { keyword, toolName, includeExpired, offset, refreshKey, onOffsetChange } = props;
  const [items, setItems] = useState<AIToolOutputItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('payload');
  const [detail, setDetail] = useState<AIToolOutputDetail | null>(null);
  const [payloadCopied, setPayloadCopied] = useState(false);
  const payloadCopyTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiToolOutputsApi.list({
        keyword: keyword.trim() || undefined,
        tool_name: toolName === TOOL_ALL ? undefined : toolName,
        include_expired: includeExpired,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setSelected(new Set());
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiToolOutputs.messages.loadFail')));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [keyword, toolName, includeExpired, offset, t]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void loadRef.current();
  }, [keyword, toolName, includeExpired, offset, refreshKey]);

  useEffect(() => {
    setDetailTab('payload');
    if (!openId && payloadCopyTimerRef.current) {
      window.clearTimeout(payloadCopyTimerRef.current);
      payloadCopyTimerRef.current = null;
      setPayloadCopied(false);
    }
    return () => {
      if (payloadCopyTimerRef.current) {
        window.clearTimeout(payloadCopyTimerRef.current);
      }
    };
  }, [openId]);

  const openDetail = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    try {
      const data = await aiToolOutputsApi.getDetail(id);
      setDetail(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiToolOutputs.messages.loadFail')));
    }
  };

  const removeOne = async (id: string) => {
    if (!window.confirm(t('aiToolOutputs.confirmDelete', { id }))) return;
    try {
      await aiToolOutputsApi.delete(id);
      toast.success(t('aiToolOutputs.messages.deleted'));
      if (openId === id) setOpenId(null);
      void loadRef.current();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiToolOutputs.messages.deletedFail')));
    }
  };

  /** 移动端卡片与桌面表格共用，避免两处各写一份下载逻辑 */
  const downloadRow = async (id: string) => {
    try {
      const blob = await aiToolOutputsApi.downloadRaw(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiToolOutputs.messages.downloadFail')));
    }
  };

  const removeBatch = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(t('aiToolOutputs.confirmBatchDelete', { count: ids.length }))) {
      return;
    }
    try {
      const res = await aiToolOutputsApi.batchDelete(ids);
      toast.success(t('aiToolOutputs.messages.batchDeleted', { count: res.deleted }));
      void loadRef.current();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiToolOutputs.messages.deletedFail')));
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(items.map((i) => i.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleCopyPayload = async () => {
    const text = detail?.payload_preview;
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setPayloadCopied(true);
      if (payloadCopyTimerRef.current) {
        window.clearTimeout(payloadCopyTimerRef.current);
      }
      payloadCopyTimerRef.current = window.setTimeout(() => setPayloadCopied(false), 1500);
    } catch {
      toast.error(t('aiToolOutputs.detail.copyFailed'));
    }
  };

  const pageFrom = total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>{t('aiToolOutputs.title')}</CardTitle>
            <CardDescription>
              {t('aiToolOutputs.modeSummary', {
                from: pageFrom,
                to: pageTo,
                total,
              })}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <Button variant="destructive" className="whitespace-nowrap" onClick={removeBatch}>
                <Trash2 className="w-4 h-4" />
                {t('aiToolOutputs.toolbar.batchDelete', { count: selected.size })}
              </Button>
            )}
            <Button variant="outline" className="whitespace-nowrap" onClick={props.onRefresh}>
              <RefreshCw className="w-4 h-4" />
              {t('aiToolOutputs.toolbar.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          {loading ? (
            <Skeleton className="h-32 w-full rounded-md" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('aiToolOutputs.table.noData')}
            </p>
          ) : (
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={items.length > 0 && selected.size === items.length}
                        onCheckedChange={(c) => toggleAll(c === true)}
                        aria-label="select all"
                      />
                    </TableHead>
                    <TableHead>{t('aiToolOutputs.table.tool')}</TableHead>
                    <TableHead>{t('aiToolOutputs.table.summary')}</TableHead>
                    <TableHead>{t('aiToolOutputs.table.owner')}</TableHead>
                    <TableHead>{t('aiToolOutputs.table.size')}</TableHead>
                    <TableHead>{t('aiToolOutputs.table.createdAt')}</TableHead>
                    <TableHead className="text-right">{t('aiToolOutputs.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(row.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(c) => toggleOne(row.id, c === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className="whitespace-normal max-w-full">
                          {row.tool_name || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate" title={row.summary}>
                        {row.summary || row.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">
                        {row.owner_user_id || '—'}
                      </TableCell>
                      <TableCell>{formatBytes(row.size_bytes)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.created_at ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(row.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              void downloadRow(row.id);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeOne(row.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 移动端：7 列表格在 ~311px 内只剩复选框一列，操作列够不到 → 卡片替代表格 */}
          {items.length > 0 && (
            <div className="md:hidden space-y-2">
              {items.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Checkbox
                      className="mt-0.5 shrink-0"
                      checked={selected.has(row.id)}
                      onCheckedChange={(c) => toggleOne(row.id, c === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <Badge className="whitespace-normal max-w-full">{row.tool_name || '—'}</Badge>
                      <p className="mt-1 text-sm line-clamp-2 break-words">
                        {row.summary || row.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-mono">{row.owner_user_id || '—'}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{formatBytes(row.size_bytes)}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{row.created_at ?? '—'}</span>
                    <div className="ml-auto flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        aria-label={t('aiToolOutputs.table.actions')}
                        onClick={() => openDetail(row.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={() => void downloadRow(row.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive"
                        onClick={() => removeOne(row.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t('aiToolOutputs.pagination.label', { from: pageFrom, to: pageTo, total })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-9"
                disabled={!canPrev || loading}
                onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
              >
                {t('aiToolOutputs.pagination.prev')}
              </Button>
              <Button
                variant="outline"
                className="h-9"
                disabled={!canNext || loading}
                onClick={() => onOffsetChange(offset + PAGE_SIZE)}
              >
                {t('aiToolOutputs.pagination.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="glass-card max-w-4xl max-h-[95vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-4 pb-3 border-b border-border/40 space-y-2">
            <DialogTitle className="font-mono text-base break-all pr-8">
              {openId ?? '—'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detail?.tool_name ?? '…'} · {formatBytes(detail?.size_bytes ?? 0)}
            </DialogDescription>
            {detail?.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2" title={detail.summary}>
                {detail.summary}
              </p>
            )}
          </DialogHeader>

          <Tabs
            value={detailTab}
            onValueChange={setDetailTab}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="mx-6 mt-3 shrink-0 self-start">
              <TabButtonGroup
                value={detailTab}
                onValueChange={setDetailTab}
                options={[
                  { value: 'overview', label: t('aiToolOutputs.detail.tabOverview') },
                  { value: 'payload', label: t('aiToolOutputs.detail.tabPayload') },
                ]}
              />
            </div>

            <TabsContent
              value="overview"
              className="flex-1 min-h-0 overflow-auto px-6 py-4 mt-0 space-y-3 md:space-y-4 data-[state=inactive]:hidden"
            >
              {detail ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <MetaRow label="id" value={detail.id} mono />
                  <MetaRow label="tool_name" value={detail.tool_name || '—'} mono />
                  <MetaRow label="owner_user_id" value={detail.owner_user_id || '—'} mono />
                  <MetaRow label="scope_key" value={detail.scope_key || '—'} mono />
                  <MetaRow label="session_id" value={detail.session_id || '—'} mono />
                  <MetaRow label="task_id" value={detail.task_id || '—'} mono />
                  <MetaRow label="root_task_id" value={detail.root_task_id || '—'} mono />
                  <MetaRow label="created_at" value={detail.created_at ?? '—'} mono />
                  <MetaRow label="expires_at" value={detail.expires_at ?? '—'} mono />
                  <MetaRow
                    label="storage"
                    value={detail.has_payload_path ? 'disk' : detail.has_inline ? 'inline' : '—'}
                  />
                </dl>
              ) : (
                <Skeleton className="h-40 w-full rounded-md" />
              )}
            </TabsContent>

            <TabsContent
              value="payload"
              className="flex-1 min-h-0 flex flex-col px-6 py-4 mt-0 data-[state=inactive]:hidden"
            >
              {detail ? (
                <section className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {detail.payload_truncated
                        ? t('aiToolOutputs.detail.payloadTruncated', {
                            chars: detail.payload_full_chars,
                          })
                        : t('aiToolOutputs.detail.payloadTitle')}
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={handleCopyPayload}
                      disabled={!detail.payload_preview}
                    >
                      {payloadCopied ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {payloadCopied ? t('aiToolOutputs.detail.copied') : t('common.copy')}
                    </Button>
                  </div>
                  <pre className="flex-1 min-h-0 overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words">
                    {detail.payload_preview || t('aiToolOutputs.detail.payloadEmpty')}
                  </pre>
                </section>
              ) : (
                <Skeleton className="h-40 w-full rounded-md" />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
