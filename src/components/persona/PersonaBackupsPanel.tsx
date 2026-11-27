import { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
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
import { LabelWithHelp } from '@/components/ui/label-with-help';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage, personaResetApi, type PersonaBackupInfo } from '@/lib/api';
import { resetItemLabel } from '@/lib/personaReset';
import { formatBytes } from '@/lib/utils';
import { PersonaRestoreDialog } from './PersonaRestoreDialog';
import type { PersonaJobController } from './usePersonaJobController';

interface PersonaBackupsPanelProps {
  personaName: string;
  controller: PersonaJobController;
}

export function PersonaBackupsPanel({ personaName, controller }: PersonaBackupsPanelProps) {
  const { t } = useLanguage();
  const { backupsVersion, refreshBackups } = controller;
  const [backups, setBackups] = useState<PersonaBackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PersonaBackupInfo | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    personaResetApi
      .listBackups(personaName)
      .then((list) => {
        if (!cancelled) setBackups(Array.isArray(list) ? list : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err, ''));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personaName, backupsVersion]);

  const handleDownload = useCallback(
    async (file: string) => {
      setDownloading(file);
      try {
        const blob = await personaResetApi.downloadBackup(personaName, file);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        toast.error(getApiErrorMessage(err, t('personaReset.downloadFailed')));
      } finally {
        setDownloading(null);
      }
    },
    [personaName, t],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await personaResetApi.deleteBackup(personaName, deleteTarget);
      toast.success(t('personaReset.deleteSuccess'));
      refreshBackups();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('personaReset.deleteFailed')));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <LabelWithHelp
          label={t('personaReset.backups')}
          description={t('personaReset.backupsHelp')}
          className="text-sm font-semibold"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8 shrink-0"
          onClick={refreshBackups}
          disabled={loading}
          title={t('common.refresh')}
          aria-label={t('common.refresh')}
        >
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      {loadError !== null ? (
        <span className="text-sm text-destructive">
          {loadError || t('personaReset.backupsLoadFailed')}
        </span>
      ) : loading && backups.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('personaReset.loading')}
        </div>
      ) : backups.length === 0 ? (
        <span className="py-2 text-sm text-muted-foreground">{t('personaReset.backupsEmpty')}</span>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{t('personaReset.colTime')}</TableHead>
                <TableHead className="whitespace-nowrap">{t('personaReset.colItems')}</TableHead>
                <TableHead className="whitespace-nowrap">{t('personaReset.colSize')}</TableHead>
                <TableHead className="whitespace-nowrap">{t('personaReset.colModel')}</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  {t('personaReset.colActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => {
                const itemNames = backup.items.map((key) => resetItemLabel(t, key)).join('、');
                const time = new Date(backup.created_at * 1000).toLocaleString();
                return (
                  <TableRow key={backup.file}>
                    <TableCell className="whitespace-nowrap tabular-nums" title={backup.file}>
                      {time}
                    </TableCell>
                    <TableCell className="max-w-[16rem]">
                      <span className="block truncate" title={itemNames}>
                        {itemNames}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatBytes(backup.size_bytes)}
                    </TableCell>
                    <TableCell className="max-w-[10rem]">
                      <span className="block truncate" title={backup.embedding_model}>
                        {backup.embedding_model || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title={t('personaReset.download')}
                          aria-label={t('personaReset.download')}
                          disabled={downloading === backup.file}
                          onClick={() => void handleDownload(backup.file)}
                        >
                          {downloading === backup.file ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title={t('personaReset.restore')}
                          aria-label={t('personaReset.restore')}
                          onClick={() => {
                            setRestoreTarget(backup);
                            setRestoreOpen(true);
                          }}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title={t('personaReset.delete')}
                          aria-label={t('personaReset.delete')}
                          onClick={() => setDeleteTarget(backup.file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PersonaRestoreDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        personaName={personaName}
        file={restoreTarget?.file ?? null}
        backupModel={restoreTarget?.embedding_model ?? ''}
        controller={controller}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('personaReset.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('personaReset.deleteConfirmDesc', { file: deleteTarget ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
