/**
 * /ai-artifacts — AI 产出物全局浏览
 *
 * 来源：docs/skills/gshub-development/README.md §3.1「完全空缺」第 6 项
 * 后端对应：artifacts_api.py (`/api/ai/artifacts*`)，并扩展支持全量浏览
 *
 * UI 风格参照 [§04 §4.6 表格行点击打开详情](../../docs/skills/gshub-development/references/04-page-layout-spec.md)，
 * 错误回显统一用 getApiErrorMessage（[§01 §1.5](../../docs/skills/gshub-development/references/01-architecture-and-conventions.md)）。
 */
import { useEffect, useState } from 'react';
import {
  Download,
  Eye,
  PackageOpen,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  aiArtifactsApi,
  getApiErrorMessage,
  type AIArtifactItem,
} from '@/lib/api';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function AIArtifactsPage() {
  const { t } = useLanguage();
  const [rootTaskId, setRootTaskId] = useState('');
  const [useAll, setUseAll] = useState(true);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [items, setItems] = useState<AIArtifactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    item: AIArtifactItem;
    payloadPreview: string | null;
  } | null>(null);

  const load = async () => {
    if (!useAll && !rootTaskId.trim()) {
      toast.error(t('aiArtifacts.messages.filterNeeded'));
      return;
    }
    setLoading(true);
    try {
      const res = useAll
        ? await aiArtifactsApi.listByRoot('', { includeExpired, limit: 500 })
        : await aiArtifactsApi.listByRoot(rootTaskId.trim(), { includeExpired, limit: 500 });
      setItems(res.items ?? []);
    } catch (e) {
      // 全量浏览后端可能未上线 → 降级为空列表并提示
      if (useAll) {
        setItems([]);
        console.warn('[AIArtifacts] global list unavailable, backend may need upgrade:', e);
      } else {
        toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.loadFail')));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAll, includeExpired]);

  const openDetail = async (id: string) => {
    setOpenId(id);
    try {
      const data = await aiArtifactsApi.getDetail(id);
      setDetail({ item: data, payloadPreview: data.payload_preview ?? null });
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.loadFail')));
      setDetail(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('aiArtifacts.confirmDelete', { id }))) return;
    try {
      await aiArtifactsApi.delete(id);
      setItems((arr) => arr.filter((a) => a.id !== id));
      toast.success(t('aiArtifacts.messages.deleted'));
      if (openId === id) setOpenId(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.deletedFail')));
    }
  };

  const extend = async (id: string, days: number) => {
    try {
      await aiArtifactsApi.extendTtl(id, days);
      toast.success(t('aiArtifacts.messages.extended'));
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.extendedFail')));
    }
  };

  return (
    <PinnedPage
      className="gap-6"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <PackageOpen className="w-8 h-8 shrink-0" />
              {t('aiArtifacts.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('aiArtifacts.description')}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-9 self-start sm:self-auto shrink-0"
            onClick={load}
          >
            <RefreshCw className="w-4 h-4" />
            {t('aiArtifacts.toolbar.refresh')}
          </Button>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>{t('aiArtifacts.toolbar.filterRoot')}</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-9 font-mono min-w-[280px]"
                placeholder="root_task_id"
                value={rootTaskId}
                onChange={(e) => setRootTaskId(e.target.value)}
                disabled={useAll}
              />
              <Button
                size="sm"
                variant={useAll ? 'default' : 'outline'}
                className="h-9"
                onClick={() => setUseAll(true)}
              >
                {t('aiArtifacts.toolbar.filterRootAll')}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <Switch
              checked={includeExpired}
              onCheckedChange={setIncludeExpired}
            />
            <Label>{t('aiArtifacts.toolbar.includeExpired')}</Label>
          </div>
        </div>
      }
    >
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t('aiArtifacts.title')}</CardTitle>
          <CardDescription>
            {useAll
              ? t('aiArtifacts.modeAll')
              : t('aiArtifacts.modeRoot', { root: rootTaskId || '—' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full rounded-md" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('aiArtifacts.table.noData')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('aiArtifacts.table.kind')}</TableHead>
                  <TableHead>{t('aiArtifacts.table.summary')}</TableHead>
                  <TableHead>{t('aiArtifacts.table.profile')}</TableHead>
                  <TableHead>{t('aiArtifacts.table.size')}</TableHead>
                  <TableHead>{t('aiArtifacts.table.expiresAt')}</TableHead>
                  <TableHead className="text-right">
                    {t('aiArtifacts.table.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(a.id)}
                  >
                    <TableCell>
                      <Badge>{a.artifact_kind}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{a.summary}</TableCell>
                    <TableCell className="font-mono text-xs">{a.from_profile}</TableCell>
                    <TableCell>{formatBytes(a.size_bytes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.expires_at ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(a.id);
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
                            const blob = await aiArtifactsApi.downloadRaw(a.id);
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            extend(a.id, 30);
                          }}
                        >
                          +30
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(a.id);
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
        </CardContent>
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>{openId ?? '—'}</DialogTitle>
            <DialogDescription>
              {detail?.item.artifact_kind} · {detail?.item.from_profile}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] py-2">
            <p className="text-sm">{detail?.item.summary ?? '…'}</p>
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">
                {t('aiArtifacts.detail.payloadTitle')}
              </p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto whitespace-pre-wrap">
                {detail?.payloadPreview ?? t('aiArtifacts.detail.payloadEmpty')}
              </pre>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
