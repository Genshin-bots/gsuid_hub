import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock, Loader2, RefreshCw, ShieldCheck, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { aiApprovalsApi, getApiErrorMessage, AIApprovalItem, AIApprovalStatus } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Textarea } from '@/components/ui/textarea';

type ViewMode = 'pending' | 'all';

const STATUS_CLASS: Record<AIApprovalStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-600 border-red-500/30',
  expired: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
  auto_approved: 'bg-sky-500/15 text-sky-600 border-sky-500/30',
};

function formatTime(ts: number): string {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
}

export default function AIApprovalsPage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [items, setItems] = useState<AIApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  // 待确认的裁决动作：点批准/拒绝后先进弹窗填备注再提交
  const [resolveTarget, setResolveTarget] = useState<{ item: AIApprovalItem; approved: boolean } | null>(null);
  const [note, setNote] = useState('');

  const loadData = useCallback(async (mode: ViewMode) => {
    try {
      setIsLoading(true);
      const data = await aiApprovalsApi.getList(mode);
      setItems(data.items || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiApprovals.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData(viewMode);
  }, [loadData, viewMode]);

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items]);

  const viewOptions = useMemo(() => [
    { value: 'pending', label: `${t('aiApprovals.tabs.pending')} ${viewMode === 'pending' ? items.length : pendingCount}`, icon: <Clock className="h-4 w-4" /> },
    { value: 'all', label: t('aiApprovals.tabs.all'), icon: <ShieldCheck className="h-4 w-4" /> },
  ], [items.length, pendingCount, t, viewMode]);

  const submitResolve = async () => {
    if (!resolveTarget) return;
    try {
      setIsResolving(true);
      const res = await aiApprovalsApi.resolve(resolveTarget.item.request_id, resolveTarget.approved, note.trim());
      if (res.status !== 0) {
        toast.error(getApiErrorMessage(res, t('aiApprovals.resolveFailed')));
        return;
      }
      // 后端 msg 携带领域回调的结果文本（如"已批准 #ab12，子任务已重新调度"），原样展示
      toast.success(res.msg || t('aiApprovals.resolveSuccess'));
      setResolveTarget(null);
      setNote('');
      await loadData(viewMode);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiApprovals.resolveFailed')));
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 shrink-0" />
            {t('aiApprovals.title')}
          </h1>
          <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiApprovals.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
          <Button variant="outline" onClick={() => loadData(viewMode)} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t('common.refresh') || '刷新'}
          </Button>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <TabButtonGroup
          options={viewOptions}
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
          className="w-max"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('common.loading') || 'Loading...'}
        </div>
      ) : items.length === 0 ? (
        <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <ShieldCheck className="mb-4 h-12 w-12 opacity-50" />
            <p>{viewMode === 'pending' ? t('aiApprovals.emptyPending') : t('aiApprovals.emptyAll')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.request_id} className={cn('transition-all hover:border-primary/40', isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">#{item.short_id}</Badge>
                    <Badge variant="secondary">{item.category}</Badge>
                    {item.interaction === 'question' && (
                      <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30">
                        {t('aiApprovals.interactionQuestion')}
                      </Badge>
                    )}
                    <Badge variant="outline" className={item.audience === 'master' ? 'bg-red-500/10 text-red-600 border-red-500/30' : 'bg-sky-500/10 text-sky-600 border-sky-500/30'}>
                      {t(`aiApprovals.audience.${item.audience}`)}
                    </Badge>
                    <Badge variant="outline" className={STATUS_CLASS[item.status] || ''}>{t(`aiApprovals.status.${item.status}`)}</Badge>
                  </div>
                  <p className="break-all text-sm">{item.title || '-'}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{item.operator_user_id || '-'}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(item.created_at)}</span>
                    {item.status !== 'pending' && item.resolved_by && (
                      <span>{t('aiApprovals.resolvedBy', { by: item.resolved_by, via: item.resolved_via || '-' })}</span>
                    )}
                    {item.resolved_note && <span className="break-all">💬 {item.resolved_note}</span>}
                  </div>
                </div>
                {item.status === 'pending' && (
                  <div className="flex shrink-0 items-center gap-2 self-end lg:self-center">
                    <Button size="sm" className="gap-1.5" onClick={() => { setNote(''); setResolveTarget({ item, approved: true }); }}>
                      <Check className="h-4 w-4" />{t('aiApprovals.approve')}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => { setNote(''); setResolveTarget({ item, approved: false }); }}>
                      <X className="h-4 w-4" />{t('aiApprovals.reject')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resolveTarget} onOpenChange={(open) => { if (!open) { setResolveTarget(null); setNote(''); } }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resolveTarget?.approved ? <Check className="h-5 w-5 text-emerald-500" /> : <X className="h-5 w-5 text-destructive" />}
              {resolveTarget?.approved ? t('aiApprovals.approveDialogTitle') : t('aiApprovals.rejectDialogTitle')}
            </DialogTitle>
            <DialogDescription className="break-all">
              #{resolveTarget?.item.short_id}｜{resolveTarget?.item.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('aiApprovals.noteLabel')}</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder={t('aiApprovals.notePlaceholder')} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveTarget(null); setNote(''); }} disabled={isResolving}>{t('common.cancel')}</Button>
            <Button
              onClick={submitResolve}
              disabled={isResolving}
              variant={resolveTarget?.approved ? 'default' : 'destructive'}
              className="gap-2"
            >
              {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : resolveTarget?.approved ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {resolveTarget?.approved ? t('aiApprovals.approve') : t('aiApprovals.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
