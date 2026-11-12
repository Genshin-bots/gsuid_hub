import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';

interface SystemControlDialogsProps {
  showRestartDialog: boolean;
  setShowRestartDialog: (open: boolean) => void;
  isRestarting: boolean;
  restartProgress: number;
  restartCompleted: boolean;
  handleRestart: () => void;
  showPauseDialog: boolean;
  setShowPauseDialog: (open: boolean) => void;
  isPaused: boolean;
  isPausing: boolean;
  pauseProgress: number;
  pauseCompleted: boolean;
  handlePause: () => void;
  handleResume: () => void;
}

export function SystemControlDialogs({
  showRestartDialog,
  setShowRestartDialog,
  isRestarting,
  restartProgress,
  restartCompleted,
  handleRestart,
  showPauseDialog,
  setShowPauseDialog,
  isPaused,
  isPausing,
  pauseProgress,
  pauseCompleted,
  handlePause,
  handleResume,
}: SystemControlDialogsProps) {
  const { t } = useLanguage();

  return (
    <>
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent>
          <DialogHeader>
            {restartCompleted ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="h-5 w-5 animate-spin text-green-500" />
                  {t('sidebar.restartSuccess')}
                </DialogTitle>
                <DialogDescription>{t('sidebar.restartSuccessDesc')}</DialogDescription>
              </>
            ) : isRestarting ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="h-5 w-5 animate-spin" />
                  {t('sidebar.restartSystem')}
                </DialogTitle>
                <DialogDescription>{t('sidebar.restartingDesc')}</DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle>{t('sidebar.confirmRestartTitle')}</DialogTitle>
                <DialogDescription className="italic text-red-500">
                  {t('sidebar.confirmRestartDesc')}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {isRestarting && (
            <div className="py-4">
              <Progress value={restartProgress} className="h-2" />
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {Math.round(restartProgress)}%
              </p>
            </div>
          )}

          <DialogFooter>
            {restartCompleted ? (
              <Button variant="default" onClick={() => setShowRestartDialog(false)}>
                {t('common.confirm')}
              </Button>
            ) : isRestarting ? null : (
              <>
                <Button variant="outline" onClick={() => setShowRestartDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={handleRestart}>
                  {t('sidebar.restartSystem')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            {pauseCompleted ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="h-5 w-5 animate-spin text-green-500" />
                  {isPaused ? t('sidebar.pauseSuccess') : t('sidebar.resumeSuccess')}
                </DialogTitle>
                <DialogDescription>
                  {isPaused ? t('sidebar.pauseSuccessDesc') : t('sidebar.resumeSuccessDesc')}
                </DialogDescription>
              </>
            ) : isPausing ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="h-5 w-5 animate-spin" />
                  {isPaused ? t('sidebar.resumingSystem') : t('sidebar.pausingSystem')}
                </DialogTitle>
                <DialogDescription>
                  {isPaused ? t('sidebar.resumingDesc') : t('sidebar.pausingDesc')}
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle>
                  {isPaused ? t('sidebar.confirmResumeTitle') : t('sidebar.confirmPauseTitle')}
                </DialogTitle>
                <DialogDescription className="italic text-red-500">
                  {isPaused ? t('sidebar.confirmResumeDesc') : t('sidebar.confirmPauseDesc')}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {isPausing && (
            <div className="py-4">
              <Progress value={pauseProgress} className="h-2" />
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {Math.round(pauseProgress)}%
              </p>
            </div>
          )}

          <DialogFooter>
            {pauseCompleted ? (
              <Button variant="default" onClick={() => setShowPauseDialog(false)}>
                {t('common.confirm')}
              </Button>
            ) : isPausing ? null : (
              <>
                <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={isPaused ? handleResume : handlePause}>
                  {isPaused ? t('sidebar.resumeSystem') : t('sidebar.pauseSystem')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
