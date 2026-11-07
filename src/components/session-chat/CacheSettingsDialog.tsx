/**
 * 消息缓存设置。
 *
 * 入口在会话管理页头部，和「框架配置 → 消息缓存」。
 * 单位是小时，0 表示不缓存（默认）。
 */
import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { getApiErrorMessage, sessionChatApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const PRESETS = [0, 6, 12, 24, 72, 168];

interface CacheSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CacheSettingsDialog({ open, onOpenChange }: CacheSettingsDialogProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [hours, setHours] = useState(0);
  const [count, setCount] = useState(0);
  const [draft, setDraft] = useState('0');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sessionChatApi.getCacheConfig();
      setHours(data.hours ?? 0);
      setDraft(String(data.hours ?? 0));
      setCount(data.count ?? 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.cacheLoadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const save = async () => {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t('sessionManagement.cacheHoursInvalid'));
      return;
    }
    setSaving(true);
    try {
      const data = await sessionChatApi.setCacheConfig(Math.floor(value));
      setHours(data.hours);
      setDraft(String(data.hours));
      setCount(data.count ?? 0);
      toast.success(
        data.enabled
          ? t('sessionManagement.cacheEnabledToast', { hours: data.hours })
          : t('sessionManagement.cacheDisabledToast'),
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.cacheSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      const data = await sessionChatApi.clearCache();
      setCount(0);
      toast.success(t('sessionManagement.cacheCleared', { count: data.removed }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.cacheClearFailed')));
    } finally {
      setClearing(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t('sessionManagement.cacheTitle')}
            </DialogTitle>
            <DialogDescription>{t('sessionManagement.cacheDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t('sessionManagement.cacheRetention')}
              </span>
              <Input
                type="number"
                min={0}
                step={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-8 w-24 text-xs"
                disabled={loading || saving}
              />
              <span className="text-xs text-muted-foreground">
                {t('sessionManagement.cacheHoursUnit')}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft(String(value))}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[11px] transition-colors',
                    Number(draft) === value
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {value === 0 ? t('sessionManagement.cacheOff') : `${value}h`}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t('sessionManagement.cacheStatus')}
              {loading
                ? t('sessionManagement.cacheReading')
                : hours > 0
                  ? t('sessionManagement.cacheStatusOn', { hours })
                  : t('sessionManagement.cacheStatusOff')}
              {!loading && ` ${t('sessionManagement.cacheStatusCount', { count })}`}
            </p>
            <p className="text-[11px] text-muted-foreground">{t('sessionManagement.cacheNote')}</p>
          </div>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={loading || clearing || saving || count === 0}
            >
              {clearing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              {t('sessionManagement.cacheClear')}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t('sessionManagement.cancel')}
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={loading || saving}>
                {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                {t('sessionManagement.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionManagement.cacheClearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sessionManagement.cacheClearConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sessionManagement.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void clear()}>
              {t('sessionManagement.cacheClear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
