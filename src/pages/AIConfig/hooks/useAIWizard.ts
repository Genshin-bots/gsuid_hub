/**
 * useAIWizard
 *
 * 负责「AI Wizard（配置体检）」相关的状态：
 * - isBackendPendingRestart：启动时检测 /api/ai/wizard/status 是否存在（404 = 未就绪）
 * - isPendingRestart：AI 总开关刚刚被切换、尚未重启（由 useAIServiceSwitch 写入）
 * - isWizardDialogOpen / wizardChecklist / wizardStatus / wizardSummary / wizardUsable 等
 *
 * 由 [`src/pages/AIConfigPage.tsx`](src/pages/AIConfigPage.tsx) 调用。
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  aiWizardApi,
  type AIWizardChecklistItem,
  type AIWizardStatusResponse,
} from '@/lib/api';

export type WizardOverallStatus =
  | 'overall_ok'
  | 'overall_warning'
  | 'overall_error';

export interface UseAIWizardReturn {
  /** 后端 AI 服务是否已就绪（/api/ai/wizard/status 存在） */
  isBackendPendingRestart: boolean;
  /** AI 总开关刚刚切换，需要重启核心服务才能跑 wizard */
  isPendingRestart: boolean;
  setIsPendingRestart: (pending: boolean) => void;

  /** WizardDialog 是否打开 */
  isWizardDialogOpen: boolean;
  setIsWizardDialogOpen: (open: boolean) => void;

  /** 加载标志 */
  isWizardLoading: boolean;

  /** 整体状态 */
  wizardOverallStatus: WizardOverallStatus;
  /** 当前是否可用 */
  wizardUsable: boolean;
  /** 检查项列表 */
  wizardChecklist: AIWizardChecklistItem[];
  /** 概览 */
  wizardSummary: { total: number; ok: number; warning: number; error: number };
  /** 后端 wizard status 原始响应 */
  wizardStatus: AIWizardStatusResponse | null;

  /** 拉取 wizard checklist + status 并打开 dialog */
  fetchWizardChecklist: () => Promise<void>;
}

export function useAIWizard(): UseAIWizardReturn {
  const [isBackendPendingRestart, setIsBackendPendingRestart] = useState(false);
  const [isPendingRestart, setIsPendingRestart] = useState(false);

  const [isWizardDialogOpen, setIsWizardDialogOpen] = useState(false);
  const [isWizardLoading, setIsWizardLoading] = useState(false);
  const [wizardChecklist, setWizardChecklist] = useState<AIWizardChecklistItem[]>(
    [],
  );
  const [wizardOverallStatus, setWizardOverallStatus] =
    useState<WizardOverallStatus>('overall_ok');
  const [wizardUsable, setWizardUsable] = useState(false);
  const [wizardSummary, setWizardSummary] = useState({
    total: 0,
    ok: 0,
    warning: 0,
    error: 0,
  });
  const [wizardStatus, setWizardStatus] =
    useState<AIWizardStatusResponse | null>(null);

  // 启动时检测后端 AI 服务是否已就绪
  useEffect(() => {
    let cancelled = false;
    const checkBackendStatus = async () => {
      try {
        const res = await fetch(`/api/ai/wizard/status?_t=${Date.now()}`, {
          credentials: 'include',
        });
        if (cancelled) return;
        // 404 意味着后端还未加载 AI 核心，需要重启
        setIsBackendPendingRestart(res.status === 404);
      } catch {
        if (!cancelled) setIsBackendPendingRestart(false);
      }
    };
    checkBackendStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWizardChecklist = useCallback(async () => {
    try {
      setIsWizardLoading(true);
      const [checklistResponse, statusResponse] = await Promise.all([
        aiWizardApi.getChecklist(),
        aiWizardApi.getStatus(),
      ]);
      console.log('Wizard checklist:', checklistResponse);
      console.log('Wizard status:', statusResponse);
      setWizardChecklist(checklistResponse.items);
      setWizardOverallStatus(checklistResponse.overall_status);
      setWizardUsable(checklistResponse.usable);
      setWizardSummary(checklistResponse.summary);
      setWizardStatus(statusResponse);
      setIsWizardDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch wizard checklist:', error);
      toast.error(error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsWizardLoading(false);
    }
  }, []);

  return {
    isBackendPendingRestart,
    isPendingRestart,
    setIsPendingRestart,
    isWizardDialogOpen,
    setIsWizardDialogOpen,
    isWizardLoading,
    wizardOverallStatus,
    wizardUsable,
    wizardChecklist,
    wizardSummary,
    wizardStatus,
    fetchWizardChecklist,
  };
}
