import { useState, useEffect, useRef, useCallback } from 'react';
import { systemApi } from '@/lib/api';
import { getCustomApiHost } from '@/lib/api';

/**
 * 系统控制Hook - 管理重启/暂停/恢复状态
 * 从AppSidebar中抽离出来，减少组件复杂度并优化性能
 */
export function useSystemControl() {
  // Restart state
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartProgress, setRestartProgress] = useState(0);
  const [restartCompleted, setRestartCompleted] = useState(false);
  const restartTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pause state
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseProgress, setPauseProgress] = useState(0);
  const [pauseCompleted, setPauseCompleted] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        clearInterval(restartTimerRef.current);
      }
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
      }
    };
  }, []);

  const handleRestart = useCallback(async () => {
    setIsRestarting(true);
    setRestartProgress(0);
    setRestartCompleted(false);

    const startTime = Date.now();
    const duration = 70000;
    const targetProgress = 99;
    let backendResponded = false;

    restartTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * targetProgress, targetProgress);
      setRestartProgress(progress);

      if (!backendResponded && progress > 10) {
        try {
          const apiHost = getCustomApiHost();
          const url = apiHost ? `${apiHost}/api/system/health` : '/api/system/health';
          const response = await fetch(url, { method: 'GET' }).catch(() => null);

          if (response && response.ok) {
            backendResponded = true;
            setRestartProgress(100);
            setRestartCompleted(true);
            if (restartTimerRef.current) {
              clearInterval(restartTimerRef.current);
            }
          }
        } catch {
          // Backend not responding yet
        }
      }

      if (progress >= targetProgress && !backendResponded) {
        if (restartTimerRef.current) {
          clearInterval(restartTimerRef.current);
        }
      }
    }, 500);

    try {
      await systemApi.restartCore();
    } catch {
      console.log('Restart command sent, backend may be restarting...');
    }
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setShowRestartDialog(false);
      setIsRestarting(false);
      setRestartProgress(0);
      setRestartCompleted(false);
      if (restartTimerRef.current) {
        clearInterval(restartTimerRef.current);
      }
    } else {
      setShowRestartDialog(true);
    }
  }, []);

  const handlePause = useCallback(async () => {
    setIsPausing(true);
    setPauseProgress(0);
    setPauseCompleted(false);

    const startTime = Date.now();
    const duration = 10000;
    const targetProgress = 99;
    let backendStopped = false;

    pauseTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * targetProgress, targetProgress);
      setPauseProgress(progress);

      if (!backendStopped && progress > 30) {
        try {
          const apiHost = getCustomApiHost();
          const url = apiHost ? `${apiHost}/api/system/health` : '/api/system/health';
          const response = await fetch(url, { method: 'GET' }).catch(() => null);

          if (!response || !response.ok) {
            backendStopped = true;
            setIsPaused(true);
            setPauseProgress(100);
            setPauseCompleted(true);
            if (pauseTimerRef.current) {
              clearInterval(pauseTimerRef.current);
            }
          }
        } catch {
          // Backend not responding
        }
      }

      if (progress >= targetProgress && !backendStopped) {
        if (pauseTimerRef.current) {
          clearInterval(pauseTimerRef.current);
        }
      }
    }, 500);

    try {
      await systemApi.stopCore();
    } catch {
      console.log('Stop command sent, backend may be stopping...');
    }
  }, []);

  const handleResume = useCallback(async () => {
    setIsPausing(true);
    setPauseProgress(0);
    setPauseCompleted(false);

    const startTime = Date.now();
    const duration = 10000;
    const targetProgress = 99;
    let backendResponded = false;

    pauseTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * targetProgress, targetProgress);
      setPauseProgress(progress);

      if (!backendResponded && progress > 30) {
        try {
          const apiHost = getCustomApiHost();
          const url = apiHost ? `${apiHost}/api/system/health` : '/api/system/health';
          const response = await fetch(url, { method: 'GET' }).catch(() => null);

          if (response && response.ok) {
            backendResponded = true;
            setIsPaused(false);
            setPauseProgress(100);
            setPauseCompleted(true);
            if (pauseTimerRef.current) {
              clearInterval(pauseTimerRef.current);
            }
          }
        } catch {
          // Backend not responding yet
        }
      }

      if (progress >= targetProgress && !backendResponded) {
        if (pauseTimerRef.current) {
          clearInterval(pauseTimerRef.current);
        }
      }
    }, 500);

    try {
      await systemApi.resumeCore();
    } catch {
      console.log('Resume command sent, backend may be resuming...');
    }
  }, []);

  const handlePauseDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setShowPauseDialog(false);
      setIsPausing(false);
      setPauseProgress(0);
      setPauseCompleted(false);
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
      }
    } else {
      setShowPauseDialog(true);
    }
  }, []);

  return {
    // Restart state
    showRestartDialog,
    setShowRestartDialog: handleDialogClose,
    isRestarting,
    restartProgress,
    restartCompleted,
    handleRestart,
    // Pause state
    showPauseDialog,
    setShowPauseDialog: handlePauseDialogClose,
    isPaused,
    isPausing,
    pauseProgress,
    pauseCompleted,
    handlePause,
    handleResume,
  };
}