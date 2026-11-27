import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  MinusCircle,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Progress } from '@/components/ui/progress';
import type { PersonaJobStep, PersonaJobStepStatus, PersonaJobView } from '@/lib/api';
import {
  countKeyLabel,
  formatDuration,
  jobOverallPercent,
  jobStepFraction,
} from '@/lib/personaReset';
import { cn } from '@/lib/utils';

const STEP_ICON: Record<PersonaJobStepStatus, { icon: typeof Circle; className: string }> = {
  pending: { icon: Circle, className: 'text-muted-foreground' },
  running: { icon: Loader2, className: 'animate-spin text-primary' },
  done: { icon: CheckCircle2, className: 'text-green-600 dark:text-green-400' },
  skipped: { icon: MinusCircle, className: 'text-muted-foreground' },
  failed: { icon: XCircle, className: 'text-destructive' },
};

function StepRow({ step }: { step: PersonaJobStep }) {
  const { t } = useLanguage();
  const fraction = jobStepFraction(step);
  const { icon: Icon, className } = STEP_ICON[step.status];
  const name = t(`personaReset.steps.${step.key}`);
  return (
    <li className={cn('flex flex-col gap-1.5', step.status === 'skipped' && 'opacity-60')}>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Icon className={cn('h-4 w-4 shrink-0', className)} />
        <span className="min-w-0 flex-1 truncate" title={name}>
          {name}
        </span>
        {step.total > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {step.done} / {step.total}
          </span>
        )}
      </div>
      {step.status !== 'skipped' &&
        (fraction === null ? (
          <Progress value={100} className="h-1.5 animate-pulse opacity-60" />
        ) : (
          <Progress value={fraction * 100} className="h-1.5" />
        ))}
    </li>
  );
}

interface PersonaJobProgressProps {
  job: PersonaJobView | null;
  onRetry?: () => void;
  onResume?: () => void;
  resuming?: boolean;
}

export function PersonaJobProgress({ job, onRetry, onResume, resuming }: PersonaJobProgressProps) {
  const { t } = useLanguage();

  if (!job) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('personaReset.loading')}
      </div>
    );
  }

  const percent = jobOverallPercent(job);
  const running = job.status === 'running';
  const vectorsRunning = job.steps.some(
    (step) => step.key === 'vectors' && step.status === 'running',
  );
  const counts = Object.entries(job.counts);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="min-w-0 truncate font-medium">
            {t(`personaReset.jobKind.${job.kind}`)} · {job.persona}
          </span>
          <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>
            {t(`personaReset.jobStatus.${job.status}`)}
          </Badge>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {running && job.eta_seconds > 0
              ? t('personaReset.eta', { duration: formatDuration(t, job.eta_seconds) })
              : ''}
          </span>
        </div>
        <Progress value={percent} className="h-2.5" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('personaReset.overall', { percent })}
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {job.steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </ul>

      {running && (
        <GlassAlert tone="info">
          {vectorsRunning ? t('personaReset.vectorsHint') : t('personaReset.runningHint')}
        </GlassAlert>
      )}

      {job.status === 'done' && (
        <GlassAlert tone="success" icon={CheckCircle2}>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">{t('personaReset.doneTitle')}</span>
            {counts.length > 0 && (
              <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {counts.map(([key, value]) => (
                  <li key={key} className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate" title={countKeyLabel(t, key)}>
                      {countKeyLabel(t, key)}
                    </span>
                    <span className="shrink-0 tabular-nums">{value}</span>
                  </li>
                ))}
              </ul>
            )}
            {job.backup_file && (
              <span className="truncate" title={job.backup_file}>
                {t('personaReset.backupFileSaved', { file: job.backup_file })}
              </span>
            )}
          </div>
        </GlassAlert>
      )}

      {job.status === 'failed' && (
        <GlassAlert tone="danger" icon={XCircle}>
          <div className="flex flex-col gap-2">
            <span className="font-medium">{t('personaReset.failedTitle')}</span>
            {job.error && <span className="whitespace-pre-wrap">{job.error}</span>}
            {onRetry && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit gap-1.5"
                onClick={onRetry}
              >
                <RotateCcw className="h-4 w-4" />
                {t('personaReset.retry')}
              </Button>
            )}
          </div>
        </GlassAlert>
      )}

      {job.status === 'resumable' && (
        <GlassAlert tone="warning" icon={AlertTriangle}>
          <div className="flex flex-col gap-2">
            <span className="font-medium">{t('personaReset.resumableTitle')}</span>
            <span>{t('personaReset.resumableDesc')}</span>
            {onResume && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit gap-1.5"
                onClick={onResume}
                disabled={resuming}
              >
                {resuming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t('personaReset.resume')}
              </Button>
            )}
          </div>
        </GlassAlert>
      )}
    </div>
  );
}
