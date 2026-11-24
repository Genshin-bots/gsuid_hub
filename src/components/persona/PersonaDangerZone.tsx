import { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { PersonaBackupsPanel } from './PersonaBackupsPanel';
import { PersonaResetDialog } from './PersonaResetDialog';
import type { PersonaJobController } from './usePersonaJobController';

interface PersonaDangerZoneProps {
  personaName: string;
  controller: PersonaJobController;
}

/** 人格「记忆与备份」独立页签：重新开始（清空记忆）+ 备份与还原。 */
export function PersonaDangerZone({ personaName, controller }: PersonaDangerZoneProps) {
  const { t } = useLanguage();
  const [resetOpen, setResetOpen] = useState(false);
  const jobRunning =
    controller.job !== null &&
    controller.job.persona === personaName &&
    controller.job.status === 'running';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="glass-card border border-destructive/30 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <LabelWithHelp
                label={t('personaReset.resetButton')}
                description={t('personaReset.resetIntro')}
                className="text-sm font-semibold"
              />
              <p className="mt-1 text-xs text-muted-foreground">{t('personaReset.resetIntro')}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 w-fit shrink-0 gap-1.5"
            disabled={jobRunning}
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            {t('personaReset.resetButton')}
          </Button>
        </div>
      </section>

      <section className="glass-card p-4 sm:p-5">
        <PersonaBackupsPanel personaName={personaName} controller={controller} />
      </section>

      <PersonaResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        personaName={personaName}
        controller={controller}
      />
    </div>
  );
}
