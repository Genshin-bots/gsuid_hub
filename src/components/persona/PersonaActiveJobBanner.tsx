import { useState } from 'react';
import { DatabaseBackup, Loader2, Play } from 'lucide-react';

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
import { GlassAlert } from '@/components/ui/glass-alert';
import { Progress } from '@/components/ui/progress';
import { jobOverallPercent } from '@/lib/personaReset';
import { PersonaJobProgress } from './PersonaJobProgress';
import type { PersonaJobController } from './usePersonaJobController';

/** 编辑页顶部：当前人格有后台任务在跑或可续跑时显示。 */
export function PersonaActiveJobBanner({ controller }: { controller: PersonaJobController }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { job, personaName } = controller;
  const visible =
    job !== null &&
    job.persona === personaName &&
    (job.status === 'running' || job.status === 'resumable');

  return (
    <>
      {visible && job.status === 'running' && (
        <GlassAlert tone="info" icon={DatabaseBackup} className="shrink-0">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate">
                {t('personaReset.bannerRunning', {
                  kind: t(`personaReset.jobKind.${job.kind}`),
                  percent: jobOverallPercent(job),
                })}
              </span>
              <Progress value={jobOverallPercent(job)} className="h-1.5" />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-fit shrink-0"
              onClick={() => setOpen(true)}
            >
              {t('personaReset.viewProgress')}
            </Button>
          </div>
        </GlassAlert>
      )}
      {visible && job.status === 'resumable' && (
        <GlassAlert tone="warning" className="shrink-0">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{t('personaReset.resumableTitle')}</span>
              <span className="truncate text-xs">{t('personaReset.resumableDesc')}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setOpen(true)}
              >
                {t('personaReset.viewProgress')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                disabled={controller.resuming}
                onClick={() => void controller.resume()}
              >
                {controller.resuming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t('personaReset.resume')}
              </Button>
            </div>
          </div>
        </GlassAlert>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 shrink-0" />
              {t('personaReset.progressTitle')}
            </DialogTitle>
            <DialogDescription>{t('personaReset.progressDesc')}</DialogDescription>
          </DialogHeader>
          <PersonaJobProgress
            job={job}
            onResume={() => void controller.resume()}
            resuming={controller.resuming}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
