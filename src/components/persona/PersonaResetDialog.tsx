import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, DatabaseBackup, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
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
import { LabelWithHelp } from '@/components/ui/label-with-help';
import {
  getApiErrorMessage,
  personaResetApi,
  type PersonaResetItemKey,
  type PersonaResetItemPreview,
  type PersonaResetPreview,
} from '@/lib/api';
import {
  cancelPendingGlobal,
  confirmPendingGlobal,
  estimateBackup,
  formatDuration,
  initialResetSelection,
  resetItemLabel,
  toggleResetItem,
  type ResetSelectionState,
} from '@/lib/personaReset';
import { cn, formatBytes } from '@/lib/utils';
import { PersonaJobProgress } from './PersonaJobProgress';
import type { PersonaJobController } from './usePersonaJobController';

type Phase = 'loading' | 'error' | 'select' | 'progress';

const EMPTY_SELECTION: ResetSelectionState = {
  checked: [],
  globalConfirmed: false,
  pendingGlobal: null,
};

interface ItemRowProps {
  item: PersonaResetItemPreview;
  checked: boolean;
  onToggle: (key: PersonaResetItemKey, next: boolean) => void;
}

function ResetItemRow({ item, checked, onToggle }: ItemRowProps) {
  const { t } = useLanguage();
  const id = `persona-reset-${item.key}`;
  const name = resetItemLabel(t, item.key);
  const desc = t(`personaReset.items.${item.key}.desc`);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onToggle(item.key, value === true)}
      />
      <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <span className="truncate text-xs font-normal text-muted-foreground" title={desc}>
          {desc}
        </span>
      </Label>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {t(`personaReset.units.${item.unit}`, { count: item.count })}
      </span>
    </div>
  );
}

interface PersonaResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaName: string;
  controller: PersonaJobController;
}

export function PersonaResetDialog({
  open,
  onOpenChange,
  personaName,
  controller,
}: PersonaResetDialogProps) {
  const { t } = useLanguage();
  const { track } = controller;
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [preview, setPreview] = useState<PersonaResetPreview | null>(null);
  const [selection, setSelection] = useState<ResetSelectionState>(EMPTY_SELECTION);
  const [backup, setBackup] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('loading');
    setLoadError('');
    setConfirmText('');
    setBackup(false);
    personaResetApi
      .getResetPreview(personaName)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setSelection(initialResetSelection(data.items));
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
  }, [open, personaName, reloadKey, track]);

  const items = useMemo(() => preview?.items ?? [], [preview]);
  const personaItems = items.filter((item) => item.group === 'persona');
  const globalItems = items.filter((item) => item.group === 'global');
  const estimate = useMemo(() => estimateBackup(items, selection.checked), [items, selection]);

  const handleToggle = useCallback(
    (key: PersonaResetItemKey, next: boolean) => {
      setSelection((prev) => toggleResetItem(prev, items, key, next));
    },
    [items],
  );

  const canStart =
    phase === 'select' &&
    !submitting &&
    selection.checked.length > 0 &&
    confirmText === personaName;

  const handleStart = async () => {
    if (!canStart) return;
    setSubmitting(true);
    try {
      const res = await personaResetApi.startReset(personaName, {
        items: selection.checked,
        confirm_name: confirmText,
        backup,
        confirm_global: selection.globalConfirmed,
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
  const otherPersonas = preview?.other_personas ?? [];
  const inProgress = phase === 'progress';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex min-w-0 items-center gap-2">
              {inProgress ? (
                <DatabaseBackup className="h-5 w-5 shrink-0" />
              ) : (
                <RotateCcw className="h-5 w-5 shrink-0 text-destructive" />
              )}
              <span className="truncate">
                {inProgress
                  ? t('personaReset.progressTitle')
                  : t('personaReset.resetTitle', { name: personaName })}
              </span>
            </DialogTitle>
            <DialogDescription>
              {inProgress ? t('personaReset.progressDesc') : t('personaReset.resetDesc')}
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
              {preview.legacy_self_key && (
                <GlassAlert tone="info">{t('personaReset.legacySelfKeyHint')}</GlassAlert>
              )}

              <section className="flex flex-col gap-1">
                <h4 className="px-2 text-sm font-semibold">{t('personaReset.groupPersona')}</h4>
                {personaItems.map((item) => (
                  <ResetItemRow
                    key={item.key}
                    item={item}
                    checked={selection.checked.includes(item.key)}
                    onToggle={handleToggle}
                  />
                ))}
              </section>

              {globalItems.length > 0 && (
                <section className="flex flex-col gap-1 rounded-lg border border-destructive/30 p-2">
                  <div className="flex min-w-0 items-center gap-2 px-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    <LabelWithHelp
                      label={t('personaReset.groupGlobal')}
                      description={t('personaReset.groupGlobalHelp')}
                      className="text-sm font-semibold"
                    />
                  </div>
                  {globalItems.map((item) => (
                    <ResetItemRow
                      key={item.key}
                      item={item}
                      checked={selection.checked.includes(item.key)}
                      onToggle={handleToggle}
                    />
                  ))}
                </section>
              )}

              <section className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Checkbox
                    id="persona-reset-backup"
                    checked={backup}
                    onCheckedChange={(value) => setBackup(value === true)}
                  />
                  <LabelWithHelp
                    htmlFor="persona-reset-backup"
                    label={t('personaReset.backupFirst')}
                    description={t('personaReset.backupHelp')}
                    className="cursor-pointer text-sm font-medium"
                  />
                </div>
                {backup && (
                  <div className="flex flex-col gap-1 pl-7 text-xs text-muted-foreground">
                    <span className="truncate">
                      {t('personaReset.backupEstimate', {
                        duration: formatDuration(t, estimate.seconds),
                        size: formatBytes(estimate.bytes),
                      })}
                    </span>
                    {estimate.unsupported.length > 0 && (
                      <span className="truncate">
                        {t('personaReset.backupUnsupported', {
                          names: estimate.unsupported.map((k) => resetItemLabel(t, k)).join('、'),
                        })}
                      </span>
                    )}
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-2">
                <Label htmlFor="persona-reset-confirm" className="truncate">
                  {t('personaReset.confirmNameLabel', { name: personaName })}
                </Label>
                <Input
                  id="persona-reset-confirm"
                  value={confirmText}
                  autoComplete="off"
                  placeholder={personaName}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleStart();
                  }}
                />
                {selection.checked.length === 0 && (
                  <span className="text-xs text-destructive">
                    {t('personaReset.noItemSelected')}
                  </span>
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
                className={cn('gap-1.5')}
                disabled={!canStart}
                onClick={() => void handleStart()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {submitting ? t('personaReset.starting') : t('personaReset.start')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={selection.pendingGlobal !== null}
        onOpenChange={(next) => {
          if (!next) setSelection(cancelPendingGlobal);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              {t('personaReset.globalConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <span>{t('personaReset.globalConfirmDesc')}</span>
                <span className="font-medium text-foreground">
                  {otherPersonas.length > 0
                    ? t('personaReset.globalConfirmOthers', { names: otherPersonas.join('、') })
                    : t('personaReset.globalConfirmNoOthers')}
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelection(cancelPendingGlobal)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setSelection(confirmPendingGlobal)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('personaReset.globalConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
