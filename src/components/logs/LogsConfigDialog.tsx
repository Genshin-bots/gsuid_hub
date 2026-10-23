/**
 * LogsConfigDialog — 日志控制台可见级别。
 *
 * 与 GET/PUT /api/logs/config 的 `visible_levels` 对齐，和 /console 级别筛选共用。
 * 弹层限高，字段区单独滚动，避免矮视口把底部裁出屏幕。
 */
import { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getApiErrorMessage,
  LOG_LEVEL_VALUES,
  logsApi,
  logsConfigApi,
  sanitizeVisibleLevels,
} from '@/lib/api';

interface LevelOption {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FALLBACK_LEVELS: LevelOption[] = LOG_LEVEL_VALUES.map((value) => ({
  label: value.toUpperCase(),
  value,
}));

function sortLevels(list: LevelOption[]): LevelOption[] {
  const order = LOG_LEVEL_VALUES as readonly string[];
  return [...list].sort((a, b) => {
    const ia = order.indexOf(a.value);
    const ib = order.indexOf(b.value);
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export default function LogsConfigDialog({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [options, setOptions] = useState<LevelOption[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setReady(false);
    (async () => {
      try {
        const [levelResult, configResult] = await Promise.allSettled([
          logsApi.getLevels(),
          logsConfigApi.get(),
        ]);
        if (cancelled) return;
        if (configResult.status === 'rejected') {
          toast.error(getApiErrorMessage(configResult.reason, t('logsConfig.loadFailed')));
          setOptions([]);
          setLevels([]);
          return;
        }
        const rawLevels =
          levelResult.status === 'fulfilled' && Array.isArray(levelResult.value)
            ? levelResult.value
            : FALLBACK_LEVELS;
        const filtered = rawLevels.filter(
          (lv): lv is LevelOption =>
            !!lv && typeof lv.value === 'string' && lv.value !== '' && lv.value !== 'all',
        );
        const nextOptions = sortLevels(filtered.length > 0 ? filtered : FALLBACK_LEVELS);
        const allowed = new Set(nextOptions.map((lv) => lv.value));
        setOptions(nextOptions);
        setLevels(
          sanitizeVisibleLevels(configResult.value?.visible_levels).filter((v) => allowed.has(v)),
        );
        setReady(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const allValues = useMemo(() => options.map((lv) => lv.value), [options]);
  const allSelected = allValues.length > 0 && allValues.every((v) => levels.includes(v));

  const onSave = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      await logsConfigApi.update({ visible_levels: levels });
      toast.success(t('logsConfig.saveSuccess'));
      onOpenChange(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('logsConfig.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-6">
            <FileText className="w-5 h-5" />
            {t('logsConfig.title')}
          </DialogTitle>
          <DialogDescription>{t('logsConfig.subtitle')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-1 pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LabelWithHelp
                label={t('logsConfig.fields.visibleLevels')}
                description={t('logsConfig.fields.visibleLevelsHint')}
                className="text-sm font-medium"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={!ready || options.length === 0}
                onClick={() => setLevels(allSelected ? [] : allValues)}
              >
                {allSelected ? t('logsConfig.deselectAll') : t('logsConfig.selectAll')}
              </Button>
            </div>
            <ChipGroup
              options={options}
              value={levels}
              onValueChange={setLevels}
              allowEmpty
              disabled={!ready}
            />
            {ready && levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('logsConfig.emptyHint')}</p>
            ) : null}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('logsConfig.cancel')}
          </Button>
          <Button className="h-9" onClick={onSave} disabled={saving || loading || !ready}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('logsConfig.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
