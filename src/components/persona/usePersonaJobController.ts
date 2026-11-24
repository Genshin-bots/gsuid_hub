import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { getApiErrorMessage, personaResetApi, type PersonaJobView } from '@/lib/api';
import { isJobPolling, PERSONA_JOB_POLL_INTERVAL_MS } from '@/lib/personaReset';

export interface PersonaJobController {
  personaName: string | null;
  /** 当前跟踪的 reset / restore 任务；页面级唯一，弹窗与顶部提示条共用这一份。 */
  job: PersonaJobView | null;
  track: (target: PersonaJobView | string) => void;
  resume: () => Promise<void>;
  resuming: boolean;
  backupsVersion: number;
  refreshBackups: () => void;
}

export function usePersonaJobController(personaName: string | null): PersonaJobController {
  const { t } = useLanguage();
  const [job, setJob] = useState<PersonaJobView | null>(null);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [pollRetry, setPollRetry] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [backupsVersion, setBackupsVersion] = useState(0);

  useEffect(() => {
    setJob(null);
    setTrackedId(null);
    if (!personaName) return;
    let cancelled = false;
    personaResetApi
      .getActiveJob(personaName)
      .then((active) => {
        if (cancelled || !active || typeof active.job_id !== 'string') return;
        setJob(active);
        setTrackedId(active.job_id);
      })
      .catch((err: unknown) => {
        // 旧版后端没有该接口：静默降级，不影响人格编辑
        console.warn('[persona-reset] active job unavailable:', getApiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [personaName]);

  const jobMatchesTracked = job !== null && job.job_id === trackedId;
  const shouldPoll = trackedId !== null && (!jobMatchesTracked || isJobPolling(job.status));

  useEffect(() => {
    if (!shouldPoll || !trackedId) return;
    let cancelled = false;
    // 首次拉取立即触发；出错重试与后续轮询一律按间隔退避，避免 0ms 紧循环。
    const delay = jobMatchesTracked || pollRetry > 0 ? PERSONA_JOB_POLL_INTERVAL_MS : 0;
    const timer = window.setTimeout(() => {
      personaResetApi
        .getJob(trackedId)
        .then((next) => {
          if (cancelled) return;
          setPollRetry(0);
          setJob(next);
          if (!isJobPolling(next.status)) setBackupsVersion((v) => v + 1);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.warn('[persona-reset] poll failed:', getApiErrorMessage(err));
          setPollRetry((n) => n + 1);
        });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [shouldPoll, trackedId, jobMatchesTracked, job, pollRetry]);

  const track = useCallback((target: PersonaJobView | string) => {
    setPollRetry(0);
    if (typeof target === 'string') {
      setJob(null);
      setTrackedId(target);
      return;
    }
    setJob(target);
    setTrackedId(target.job_id);
  }, []);

  const jobId = job?.job_id ?? null;
  const resume = useCallback(async () => {
    if (!jobId) return;
    setResuming(true);
    try {
      const res = await personaResetApi.resumeJob(jobId);
      track(res.job_id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('personaReset.resumeFailed')));
    } finally {
      setResuming(false);
    }
  }, [jobId, track, t]);

  const refreshBackups = useCallback(() => setBackupsVersion((v) => v + 1), []);

  return { personaName, job, track, resume, resuming, backupsVersion, refreshBackups };
}
