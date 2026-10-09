/**
 * LogsConfigDialog — 日志控制台配置（保留期 / 轮转 / 黑名单）
 *
 * 由 /logs 页 header「控制台配置」打开；字段与 demoMock.generateLogConfig
 * 及后端 GET/PUT /api/logs/config 对齐。
 */
import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage, logsConfigApi } from '@/lib/api';

interface LogsConfig {
  retention_days?: number;
  rotation_size_mb?: number;
  max_size_per_file?: number;
  enable_file_compression?: boolean;
  include_debug?: boolean;
  blacklisted_sources?: string[];
  blacklisted_modules?: string[];
  [k: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(list: string[] | undefined): string {
  return (list ?? []).join('\n');
}

export default function LogsConfigDialog({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [cfg, setCfg] = useState<LogsConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 黑名单用本地文本态，避免输入中途被数组往返拆坏光标
  const [sourcesText, setSourcesText] = useState('');
  const [modulesText, setModulesText] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const data = (await logsConfigApi.get()) as LogsConfig;
        setCfg(data ?? {});
        setSourcesText(listToLines(data?.blacklisted_sources));
        setModulesText(listToLines(data?.blacklisted_modules));
      } catch (e) {
        toast.error(getApiErrorMessage(e, t('logsConfig.loadFailed')));
        setCfg(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, t]);

  const onNumber = (key: keyof LogsConfig, value: number) => {
    setCfg((prev) => (prev ? { ...prev, [key]: Number.isFinite(value) ? value : undefined } : prev));
  };

  const onSwitch = (key: keyof LogsConfig, value: boolean) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onSave = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const payload: LogsConfig = {
        ...cfg,
        blacklisted_sources: linesToList(sourcesText),
        blacklisted_modules: linesToList(modulesText),
      };
      await logsConfigApi.update(payload);
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
      <DialogContent className="glass-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('logsConfig.title')}
          </DialogTitle>
          <DialogDescription>{t('logsConfig.subtitle')}</DialogDescription>
        </DialogHeader>

        {loading || !cfg ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="logs-retention-days">{t('logsConfig.fields.retentionDays')}</Label>
                <Input
                  id="logs-retention-days"
                  type="number"
                  className="h-9"
                  min={1}
                  max={3650}
                  value={cfg.retention_days ?? 30}
                  onChange={(e) => onNumber('retention_days', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logs-rotation-size">{t('logsConfig.fields.rotationSizeMb')}</Label>
                <Input
                  id="logs-rotation-size"
                  type="number"
                  className="h-9"
                  min={1}
                  max={10240}
                  value={cfg.rotation_size_mb ?? 100}
                  onChange={(e) => onNumber('rotation_size_mb', Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logs-max-file">{t('logsConfig.fields.maxSizePerFile')}</Label>
                <Input
                  id="logs-max-file"
                  type="number"
                  className="h-9"
                  min={1}
                  max={10240}
                  value={cfg.max_size_per_file ?? 50}
                  onChange={(e) => onNumber('max_size_per_file', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col justify-end gap-3 pb-0.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="logs-compression">{t('logsConfig.fields.enableFileCompression')}</Label>
                  <Switch
                    id="logs-compression"
                    checked={!!cfg.enable_file_compression}
                    onCheckedChange={(v) => onSwitch('enable_file_compression', v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="logs-include-debug">{t('logsConfig.fields.includeDebug')}</Label>
                  <Switch
                    id="logs-include-debug"
                    checked={!!cfg.include_debug}
                    onCheckedChange={(v) => onSwitch('include_debug', v)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logs-blacklist-sources">{t('logsConfig.fields.blacklistedSources')}</Label>
              <Textarea
                id="logs-blacklist-sources"
                className="min-h-[88px] font-mono text-sm"
                value={sourcesText}
                onChange={(e) => setSourcesText(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logs-blacklist-modules">{t('logsConfig.fields.blacklistedModules')}</Label>
              <Textarea
                id="logs-blacklist-modules"
                className="min-h-[88px] font-mono text-sm"
                value={modulesText}
                onChange={(e) => setModulesText(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('logsConfig.cancel')}
          </Button>
          <Button className="h-9" onClick={onSave} disabled={saving || loading || !cfg}>
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('logsConfig.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
