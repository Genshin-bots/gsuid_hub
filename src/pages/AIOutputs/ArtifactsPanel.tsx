/**
 * AI 产出物面板 —— 合并页的「产出物」页签（原 /ai-artifacts）
 *
 * 后端：artifacts_api.py（`/api/ai/artifacts*`）
 * 页面壳（标题 / 页签 / 常驻筛选行）由 AIOutputsPage 负责，本文件只出内容：
 * - ArtifactsFilters：受控筛选行，挂到合并页 PinnedPage 的 toolbar
 * - ArtifactsPanel：列表卡片 + 详情 Dialog
 *
 * 筛选状态提升到合并页（筛选行在常驻区），列表加载仍留在本组件内；
 * 回车 / 刷新由合并页递增 refreshKey 触发，不跨组件传函数引用。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock, Copy, Download, Eye, PackageOpen, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { aiArtifactsApi, getApiErrorMessage, type AIArtifactItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatBytes } from './constants';
import { MetaRow } from './shared';

export interface ArtifactsPanelProps {
  rootTaskId: string;
  onRootTaskIdChange: (value: string) => void;
  /** true = 全局浏览；false = 按 root_task_id 过滤 */
  useAll: boolean;
  onUseAllChange: (value: boolean) => void;
  includeExpired: boolean;
  onIncludeExpiredChange: (value: boolean) => void;
  /** 合并页每次点刷新 / 回车搜索 +1，面板内 effect 盯着它重新 load */
  refreshKey: number;
  onRefresh: () => void;
}

/** 常驻筛选行。控件高度对齐 TabButtonGroup 内钮（h-10），与页签行同一视觉节奏。 */
export function ArtifactsFilters(props: ArtifactsPanelProps) {
  const { t } = useLanguage();
  const {
    rootTaskId,
    onRootTaskIdChange,
    useAll,
    onUseAllChange,
    includeExpired,
    onIncludeExpiredChange,
    onRefresh,
  } = props;

  return (
    // 一行放完：输入框 + 「全部」切换 + 含已过期开关。
    // 不用外置 Label——输入框 disabled 时的框内灰字已经说明了筛选维度，
    // 再挂一行 Label 会把「全部」按钮挤到第二行。
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className={cn(
          tabToolbarControlClass,
          // 内容等宽便于核对 ID；框内灰字是中文，placeholder 单独回正常字体
          'min-w-0 flex-1 font-mono placeholder:font-sans sm:max-w-[480px]',
        )}
        placeholder={t('aiArtifacts.toolbar.filterRoot')}
        value={rootTaskId}
        onChange={(e) => onRootTaskIdChange(e.target.value)}
        onKeyDown={(e) => {
          // rootTaskId 不进自动加载的依赖（否则每敲一个字都打一次接口），
          // 回车显式触发一次刷新。
          if (e.key === 'Enter') onRefresh();
        }}
        disabled={useAll}
      />
      <Button
        variant={useAll ? 'default' : 'outline'}
        className={cn(tabToolbarControlClass, 'shrink-0')}
        onClick={() => onUseAllChange(!useAll)}
      >
        {t('aiArtifacts.toolbar.filterRootAll')}
      </Button>
      <div className="flex shrink-0 items-center gap-2 pl-1">
        <Switch checked={includeExpired} onCheckedChange={onIncludeExpiredChange} />
        <Label className="whitespace-nowrap">{t('aiArtifacts.toolbar.includeExpired')}</Label>
      </div>
    </div>
  );
}

export function ArtifactsPanel(props: ArtifactsPanelProps) {
  const { t } = useLanguage();
  const { useAll, rootTaskId, includeExpired, refreshKey } = props;
  const [items, setItems] = useState<AIArtifactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    item: AIArtifactItem & {
      payload_kind?: string;
      raw_url?: string | null;
    };
    payloadPreview: string | null;
    payloadKind: 'text' | 'image' | string;
  } | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const imageObjectUrlRef = useRef<string | null>(null);
  const [payloadCopied, setPayloadCopied] = useState(false);
  const payloadCopyTimerRef = useRef<number | null>(null);

  const revokeImageUrl = () => {
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
      imageObjectUrlRef.current = null;
    }
    setImageObjectUrl(null);
  };

  const load = useCallback(async () => {
    if (!useAll && !rootTaskId.trim()) {
      toast.error(t('aiArtifacts.messages.filterNeeded'));
      return;
    }
    setLoading(true);
    try {
      // 全局浏览必须显式传 scope=all，后端据此走「按 created_at 倒序拉最近 N 条」分支
      const res = useAll
        ? await aiArtifactsApi.listByRoot('', {
            includeExpired,
            limit: 500,
            scope: 'all',
          })
        : await aiArtifactsApi.listByRoot(rootTaskId.trim(), {
            includeExpired,
            limit: 500,
          });
      setItems(res.items ?? []);
    } catch (e) {
      // 全量浏览失败 → 降级为空列表并提示（旧版后端缺 scope=all）
      if (useAll) {
        setItems([]);
        console.warn('[AIArtifacts] global list unavailable, backend may need upgrade:', e);
      } else {
        toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.loadFail')));
      }
    } finally {
      setLoading(false);
    }
  }, [useAll, rootTaskId, includeExpired, t]);

  // load 跟着 rootTaskId 变，但自动加载只在 useAll / includeExpired / refreshKey 变化时跑，
  // 所以用 ref 取最新实现，不把 load 放进 effect 依赖。
  const loadRef = useRef(load);
  loadRef.current = load;
  const rootTaskIdRef = useRef(rootTaskId);
  rootTaskIdRef.current = rootTaskId;

  useEffect(() => {
    // 「按 root_task_id 过滤」且输入框还空着时不自动拉：此时拉也只会弹「请提供 root_task_id」。
    // 合并页切页签会卸载本面板，切回来时若正停在「输入框为空」状态，
    // 原先靠 justToggled 判跳转过的写法会误弹 toast，改成直接判「现在能不能拉」。
    if (!useAll && !rootTaskIdRef.current.trim()) return;
    void loadRef.current();
  }, [useAll, includeExpired, refreshKey]);

  const openDetail = async (id: string) => {
    setOpenId(id);
    revokeImageUrl();
    setDetail(null);
    try {
      const data = await aiArtifactsApi.getDetail(id);
      const kind = data.payload_kind || (data.mime?.startsWith('image/') ? 'image' : 'text');
      setDetail({
        item: data,
        payloadPreview: data.payload_preview ?? null,
        payloadKind: kind,
      });
      // 图片：鉴权拉 raw blob，勿把二进制当 UTF-8 塞进 <pre>
      if (kind === 'image' && data.has_payload_path) {
        try {
          const blob = await aiArtifactsApi.downloadRaw(id);
          const url = URL.createObjectURL(blob);
          imageObjectUrlRef.current = url;
          setImageObjectUrl(url);
        } catch (imgErr) {
          console.warn('[AIArtifacts] image preview failed', imgErr);
        }
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.loadFail')));
      setDetail(null);
    }
  };

  // 切换 / 关闭 dialog 时重置 copied 反馈与图片 blob URL
  useEffect(() => {
    if (!openId) {
      revokeImageUrl();
      if (payloadCopyTimerRef.current) {
        window.clearTimeout(payloadCopyTimerRef.current);
        payloadCopyTimerRef.current = null;
        setPayloadCopied(false);
      }
    }
    return () => {
      if (payloadCopyTimerRef.current) {
        window.clearTimeout(payloadCopyTimerRef.current);
      }
    };
  }, [openId]);

  const handleCopyPayload = async () => {
    const text = detail?.payloadPreview;
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
      toast.error(t('aiArtifacts.detail.copyFailed'));
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
      void loadRef.current();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.extendedFail')));
    }
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>{t('aiArtifacts.title')}</CardTitle>
            <CardDescription>
              {useAll
                ? t('aiArtifacts.modeAll')
                : t('aiArtifacts.modeRoot', { root: rootTaskId || '—' })}
            </CardDescription>
          </div>
          <Button variant="outline" className="shrink-0" onClick={() => void loadRef.current()}>
            <RefreshCw className="w-4 h-4" />
            {t('aiArtifacts.toolbar.refresh')}
          </Button>
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
                  <TableHead className="text-right">{t('aiArtifacts.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a.id)}>
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

      <Dialog
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            revokeImageUrl();
          }
        }}
      >
        {/* max-w-4xl + max-h-[95vh]：
            - 默认 max-w-lg=512px 对长 ID + 代码块太窄
            - 改 Tabs 后元数据 / 摘要不再抢占 payload 空间，给 max-h 加到 95vh 让 payload 尽可能占满视口
            - 拆出 fixed header（标题+元信息条）+ tabs body（Payload 默认 / Overview 收纳元数据），
              payload section 在自己 tab 内 flex-1 吃满 body 高度 */}
        <DialogContent className="glass-card max-w-4xl max-h-[95vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-4 pb-3 border-b border-border/40 space-y-2">
            <DialogTitle className="font-mono text-base break-all pr-8">
              {openId ?? '—'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detail?.item.artifact_kind} · {detail?.item.from_profile}
            </DialogDescription>
            {/* 摘要压缩成 header 末行（最多 2 行截断），既保留上下文又不挤占 payload 空间。
                line-clamp-2 让超长摘要只显示前 2 行；title= 提供 hover 完整内容。 */}
            {detail?.item.summary && (
              <p
                className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap"
                title={detail.item.summary}
              >
                {detail.item.summary}
              </p>
            )}
            {/* 元信息条：size / mime / expires 三个最常用的字段 inline 一行 */}
            {detail?.item && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <PackageOpen className="w-3 h-3" />
                  {formatBytes(detail.item.size_bytes)}
                </span>
                {detail.item.mime && <span className="font-mono">{detail.item.mime}</span>}
                {detail.item.expires_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t('aiArtifacts.detail.expiresAt', { time: detail.item.expires_at })}
                  </span>
                )}
              </div>
            )}
          </DialogHeader>

          {/* Tabs：默认切到 Payload（用户主诉求），Overview tab 收纳完整元数据 grid。
              Radix Tabs 内部用 data-state 控制 mount/unmount，所以切回 Overview 时状态保留。
              TabsContent 默认带 mt-2 间距 + display，需要重置为 mt-0 才能贴合 TabsList。 */}
          <Tabs defaultValue="payload" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="self-start mx-6 mt-3 shrink-0">
              <TabsTrigger value="overview">{t('aiArtifacts.detail.tabOverview')}</TabsTrigger>
              <TabsTrigger value="payload">{t('aiArtifacts.detail.tabPayload')}</TabsTrigger>
            </TabsList>

            {/* Overview tab：摘要全文 + 元数据 grid。
                overflow-auto 让字段超长时整块滚动（少见，但元数据 7 字段 4 行可能撑爆小视口）。 */}
            <TabsContent
              value="overview"
              className="flex-1 min-h-0 overflow-auto px-6 py-4 mt-0 space-y-5 data-[state=inactive]:hidden"
            >
              {detail ? (
                <>
                  <section>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      {t('aiArtifacts.detail.summaryTitle')}
                    </h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {detail.item.summary || '…'}
                    </p>
                  </section>
                  <section className="border-t border-border/40 pt-4">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      {t('aiArtifacts.detail.metadataTitle')}
                    </h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      <MetaRow label="root_task_id" value={detail.item.root_task_id} mono />
                      <MetaRow label="task_id" value={detail.item.task_id} mono />
                      <MetaRow
                        label="parent_task_id"
                        value={detail.item.parent_task_id ?? '—'}
                        mono
                      />
                      <MetaRow label="created_at" value={detail.item.created_at ?? '—'} mono />
                      <MetaRow label="has_inline" value={detail.item.has_inline ? '✓' : '—'} />
                      <MetaRow
                        label="has_payload_path"
                        value={detail.item.has_payload_path ? '✓' : '—'}
                      />
                      <MetaRow
                        label="payload_path"
                        value={detail.item.payload_path ?? '—'}
                        mono
                        className="sm:col-span-2"
                      />
                    </dl>
                  </section>
                </>
              ) : (
                <Skeleton className="h-40 w-full rounded-md" />
              )}
            </TabsContent>

            {/* Payload tab：flex-1 吃满 Tabs body 高度。
                没有 max-h 卡顿，没有元数据抢空间——这是用户点开 dialog 的核心诉求。 */}
            <TabsContent
              value="payload"
              className="flex-1 min-h-0 flex flex-col px-6 py-4 mt-0 data-[state=inactive]:hidden"
            >
              {detail ? (
                <section className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {detail.payloadKind === 'image'
                        ? t('aiArtifacts.detail.imageTitle')
                        : t('aiArtifacts.detail.payloadTitle')}
                    </h4>
                    {detail.payloadKind === 'image' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            const blob = await aiArtifactsApi.downloadRaw(detail.item.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${detail.item.id}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (e) {
                            toast.error(getApiErrorMessage(e, t('aiArtifacts.messages.loadFail')));
                          }
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t('aiArtifacts.actions.download')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={handleCopyPayload}
                        disabled={!detail.payloadPreview}
                      >
                        {payloadCopied ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {payloadCopied ? t('aiArtifacts.detail.copied') : t('common.copy')}
                      </Button>
                    )}
                  </div>
                  {detail.payloadKind === 'image' ? (
                    <div className="flex-1 min-h-0 overflow-auto rounded-md bg-muted/40 p-3 flex items-center justify-center">
                      {imageObjectUrl ? (
                        <img
                          src={imageObjectUrl}
                          alt={detail.item.summary || detail.item.id}
                          className="max-w-full max-h-[70vh] object-contain rounded-md shadow-sm"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('aiArtifacts.detail.imageLoading')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <pre className="flex-1 min-h-0 bg-muted rounded-md p-3 text-sm font-mono overflow-auto whitespace-pre-wrap leading-relaxed">
                      {detail.payloadPreview ?? t('aiArtifacts.detail.payloadEmpty')}
                    </pre>
                  )}
                </section>
              ) : (
                <Skeleton className="h-full w-full rounded-md" />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
