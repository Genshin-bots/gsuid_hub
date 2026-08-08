/**
 * /ai-tool-outputs — FileOS 工具落盘浏览
 *
 * 后端：tool_outputs_api.py（`/api/ai/tool-outputs*`）
 * 与 /ai-artifacts（Kanban res_*）不同：本页管理 to_/sa_ 等工具全文落盘。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  FileSearch,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  aiToolOutputsApi,
  getApiErrorMessage,
  type AIToolOutputDetail,
  type AIToolOutputItem,
} from '@/lib/api';

const TOOL_ALL = '__all__';
const PAGE_SIZE = 50;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={mono ? 'font-mono truncate min-w-0 flex-1' : 'truncate min-w-0 flex-1'}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

export default function AIToolOutputsPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<AIToolOutputItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [toolName, setToolName] = useState(TOOL_ALL);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await aiToolOutputsApi.toolNames();
        setToolNames(res.tool_names ?? []);
      } catch {
        // 后端未升级时忽略
      }
    })();
  }, []);

  useEffect(() => {
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

  const applySearch = () => {
    setOffset(0);
    setKeyword(keywordDraft.trim());
  };

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
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiToolOutputs.messages.deletedFail')));
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
      load();
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
    <PinnedPage
      className="gap-6"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileSearch className="w-8 h-8 shrink-0" />
              {t('aiToolOutputs.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('aiToolOutputs.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {selected.size > 0 && (
              <Button
                variant="destructive"
                className="h-9"
                onClick={removeBatch}
              >
                <Trash2 className="w-4 h-4" />
                {t('aiToolOutputs.toolbar.batchDelete', { count: selected.size })}
              </Button>
            )}
            <Button variant="outline" className="h-9" onClick={load}>
              <RefreshCw className="w-4 h-4" />
              {t('aiToolOutputs.toolbar.refresh')}
            </Button>
          </div>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[200px] flex-1">
            <Label>{t('aiToolOutputs.toolbar.keyword')}</Label>
            <Input
              className="h-9"
              placeholder={t('aiToolOutputs.toolbar.keywordPlaceholder')}
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
            />
          </div>
          <div className="space-y-1 min-w-[180px]">
            <Label>{t('aiToolOutputs.toolbar.toolName')}</Label>
            <Select
              value={toolName}
              onValueChange={(v) => {
                setToolName(v);
                setOffset(0);
              }}
            >
              <SelectTrigger className="h-9">
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
          </div>
          <Button className="h-9" onClick={applySearch}>
            {t('aiToolOutputs.toolbar.search')}
          </Button>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch
              checked={includeExpired}
              onCheckedChange={(v) => {
                setIncludeExpired(v);
                setOffset(0);
              }}
            />
            <Label>{t('aiToolOutputs.toolbar.includeExpired')}</Label>
          </div>
        </div>
      }
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t('aiToolOutputs.title')}</CardTitle>
          <CardDescription>
            {t('aiToolOutputs.modeSummary', {
              from: pageFrom,
              to: pageTo,
              total,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-32 w-full rounded-md" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('aiToolOutputs.table.noData')}
            </p>
          ) : (
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
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const blob = await aiToolOutputsApi.downloadRaw(row.id);
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${row.id}.md`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              toast.error(
                                getApiErrorMessage(err, t('aiToolOutputs.messages.downloadFail')),
                              );
                            }
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
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                {t('aiToolOutputs.pagination.prev')}
              </Button>
              <Button
                variant="outline"
                className="h-9"
                disabled={!canNext || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
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

          <Tabs defaultValue="payload" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="self-start mx-6 mt-3 shrink-0">
              <TabsTrigger value="overview">{t('aiToolOutputs.detail.tabOverview')}</TabsTrigger>
              <TabsTrigger value="payload">{t('aiToolOutputs.detail.tabPayload')}</TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="flex-1 min-h-0 overflow-auto px-6 py-4 mt-0 space-y-4 data-[state=inactive]:hidden"
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
                    value={
                      detail.has_payload_path
                        ? 'disk'
                        : detail.has_inline
                          ? 'inline'
                          : '—'
                    }
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
                      {payloadCopied
                        ? t('aiToolOutputs.detail.copied')
                        : t('common.copy')}
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
    </PinnedPage>
  );
}
