import { useEffect, useState } from 'react';
import { AlertTriangle, ArchiveRestore, DatabaseBackup, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getApiErrorMessage,
  personaResetApi,
  type PersonaResetItemKey,
  type PersonaRestorePreview,
} from '@/lib/api';
import { formatDuration, resetItemLabel } from '@/lib/personaReset';
import { PersonaJobProgress } from './PersonaJobProgress';
import type { PersonaJobController } from './usePersonaJobController';

type Phase = 'loading' | 'error' | 'select' | 'progress';

interface PersonaRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaName: string;
  file: string | null;
  backupModel: string;
  controller: PersonaJobController;
}

export function PersonaRestoreDialog({
  open,
  onOpenChange,
  personaName,
  file,
  backupModel,
  controller,
}: PersonaRestoreDialogProps) {
  const { t } = useLanguage();
  const { track } = controller;
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [preview, setPreview] = useState<PersonaRestorePreview | null>(null);
  const [selected, setSelected] = useState<PersonaResetItemKey[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setPhase('loading');
    setLoadError('');
    setConfirmText('');
    personaResetApi
      .getRestorePreview(personaName, file)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setSelected(data.items);
        if (data.active_job) {
          track(data.active_job);
          setPhase('progress');
        } else {
          setPhase('select');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(getApiErrorMessage(err, ''));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, file, personaName, reloadKey, track]);

  const toggle = (key: PersonaResetItemKey, next: boolean) => {
    setSelected((prev) => (next ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const canStart =
    phase === 'select' &&
    !submitting &&
    file !== null &&
    selected.length > 0 &&
    confirmText === personaName;

  const handleStart = async () => {
    if (!canStart || !file) return;
    setSubmitting(true);
    try {
      const res = await personaResetApi.startRestore(personaName, file, {
        items: selected,
        confirm_name: confirmText,
      });
      track(res.job_id);
      setPhase('progress');
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('personaReset.startFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => setReloadKey((k) => k + 1);
  const inProgress = phase === 'progress';
  const overwritten = preview
    ? selected.filter((key) => (preview.overwrite_counts[key] ?? 0) > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-2">
            {inProgress ? (
              <DatabaseBackup className="h-5 w-5 shrink-0" />
            ) : (
              <ArchiveRestore className="h-5 w-5 shrink-0" />
            )}
            <span className="truncate">
              {inProgress
                ? t('personaReset.progressTitle')
                : t('personaReset.restoreTitle', { file: file ?? '' })}
            </span>
          </DialogTitle>
          <DialogDescription>
            {inProgress ? t('personaReset.progressDesc') : t('personaReset.restoreDesc')}
          </DialogDescription>
        </DialogHeader>

        {phase === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('personaReset.loading')}
          </div>
        )}

        {phase === 'error' && (
          <GlassAlert tone="danger">
            <div className="flex flex-col gap-2">
              <span>{loadError || t('personaReset.loadFailed')}</span>
              <Button type="button" size="sm" variant="outline" className="w-fit" onClick={retry}>
                {t('personaReset.retry')}
              </Button>
            </div>
          </GlassAlert>
        )}

        {phase === 'progress' && (
          <PersonaJobProgress
            job={controller.job}
            onRetry={retry}
            onResume={() => void controller.resume()}
            resuming={controller.resuming}
          />
        )}

        {phase === 'select' && preview && (
          <div className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-col gap-1">
              <h4 className="px-2 text-sm font-semibold">{t('personaReset.restoreItems')}</h4>
              {preview.items.length === 0 && (
                <span className="px-2 text-sm text-muted-foreground">
                  {t('personaReset.restoreNoItems')}
                </span>
              )}
              {preview.items.map((key) => {
                const id = `persona-restore-${key}`;
                const name = resetItemLabel(t, key);
                return (
                  <div
                    key={key}
                    className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={id}
                      checked={selected.includes(key)}
                      onCheckedChange={(value) => toggle(key, value === true)}
                    />
                    <Label
                      htmlFor={id}
                      className="min-w-0 flex-1 cursor-pointer truncate text-sm"
                      title={name}
                    >
                      {name}
                    </Label>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {t('personaReset.restoreImport', { count: preview.import_counts[key] ?? 0 })}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-destructive">
                      {t('personaReset.restoreOverwrite', {
                        count: preview.overwrite_counts[key] ?? 0,
                      })}
                    </span>
                  </div>
                );
              })}
            </section>

            {overwritten.length > 0 && (
              <GlassAlert tone="danger" icon={AlertTriangle}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{t('personaReset.restoreOverwriteWarning')}</span>
                  <ul className="flex flex-col gap-0.5">
                    {overwritten.map((key) => (
                      <li key={key} className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{resetItemLabel(t, key)}</span>
                        <span className="shrink-0 tabular-nums">
                          {preview.overwrite_counts[key] ?? 0}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span>{t('personaReset.restoreOverwriteNote')}</span>
                </div>
              </GlassAlert>
            )}

            {preview.vector_texts > 0 &&
              selected.some(
                (key) => key === 'self_memory' || key === 'global_group' || key === 'global_user',
              ) && (
                <section className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
                  <span>
                    {preview.throughput_per_sec > 0
                      ? t('personaReset.restoreVector', {
                          count: preview.vector_texts,
                          duration: formatDuration(t, preview.vector_eta_seconds),
                        })
                      : t('personaReset.restoreVectorUnknown', { count: preview.vector_texts })}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('personaReset.restoreModel', { model: preview.embedding_model || '-' })}
                  </span>
                  {backupModel && (
                    <span className="truncate text-xs text-muted-foreground">
                      {t('personaReset.restoreBackupModel', { model: backupModel })}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t('personaReset.restoreModelNote')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('personaReset.restoreVectorHint')}
                  </span>
                </section>
              )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="persona-restore-confirm" className="truncate">
                {t('personaReset.confirmNameLabel', { name: personaName })}
              </Label>
              <Input
                id="persona-restore-confirm"
                value={confirmText}
                autoComplete="off"
                placeholder={personaName}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleStart();
                }}
              />
              {selected.length === 0 && preview.items.length > 0 && (
                <span className="text-xs text-destructive">{t('personaReset.noItemSelected')}</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {phase === 'select' ? t('common.cancel') : t('common.close')}
          </Button>
          {phase === 'select' && (
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              disabled={!canStart}
              onClick={() => void handleStart()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
              {submitting ? t('personaReset.starting') : t('personaReset.restore')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
