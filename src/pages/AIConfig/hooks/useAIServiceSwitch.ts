/**
 * useAIServiceSwitch
 *
 * 负责「AI 服务总开关」相关的状态：
 * - isAISwitchDialogOpen：确认 dialog 是否打开
 * - pendingAISwitchValue：待生效的目标开关值
 * - isHelpOnly：当前 dialog 是「启用帮助」还是「切换确认」
 *
 * 切换流程：
 * 1. 用户点 Switch → handleAISwitchChange
 * 2. dialog 打开，确认后 → handleConfirmAISwitch 写入 frameworkConfig 的 `enable` 字段
 * 3. 同时设置 useAIWizard 的 setIsPendingRestart(true)，提示用户需要重启
 *
 * 由 [`src/pages/AIConfigPage.tsx`](src/pages/AIConfigPage.tsx) 调用。
 */
import { useCallback, useState } from 'react';
import type { ConfigValue } from '@/components/config';
import type { LocalFrameworkConfig } from '../types';

export interface UseAIServiceSwitchArgs {
  /** 来自 useFrameworkConfig 的 aiConfig（即 name 包含「AI 配置」的条目） */
  aiConfig: LocalFrameworkConfig | undefined;
  /** 来自 useFrameworkConfig 的字段写入函数 */
  updateConfigValue: (
    configId: string,
    fieldKey: string,
    value: ConfigValue,
  ) => void;
  /** 当前 AI 是否启用（用于「使用帮助」按钮可见性） */
  isAIEnabled: boolean;
  /** 写入 AIStatusContext（侧边栏订阅） */
  setGlobalAIEnabled: (enabled: boolean) => void;
  /** 写入 useAIWizard，标记需要重启 */
  setPendingRestart: (pending: boolean) => void;
}

export interface UseAIServiceSwitchReturn {
  isAISwitchDialogOpen: boolean;
  pendingAISwitchValue: boolean;
  isHelpOnly: boolean;
  handleAISwitchChange: (checked: boolean) => void;
  handleConfirmAISwitch: () => void;
  handleOpenHelp: () => void;
  setIsAISwitchDialogOpen: (open: boolean) => void;
}

export function useAIServiceSwitch(
  args: UseAIServiceSwitchArgs,
): UseAIServiceSwitchReturn {
  const {
    aiConfig,
    updateConfigValue,
    isAIEnabled,
    setGlobalAIEnabled,
    setPendingRestart,
  } = args;

  const [isAISwitchDialogOpen, setIsAISwitchDialogOpen] = useState(false);
  const [pendingAISwitchValue, setPendingAISwitchValue] = useState(false);
  const [isHelpOnly, setIsHelpOnly] = useState(false);

  /**
   * 处理 AI 服务总开关的切换。当开关状态改变时，显示确认对话框而不是直接更新。
   */
  const handleAISwitchChange = useCallback((checked: boolean) => {
    setPendingAISwitchValue(checked);
    setIsHelpOnly(false);
    setIsAISwitchDialogOpen(true);
  }, []);

  /**
   * 确认 AI 服务开关的切换，实际更新配置。
   */
  const handleConfirmAISwitch = useCallback(() => {
    setIsAISwitchDialogOpen(false);
    if (aiConfig) {
      updateConfigValue(aiConfig.id, 'enable', pendingAISwitchValue);
      // 同步侧边栏 AI 状态
      setGlobalAIEnabled(pendingAISwitchValue);
      // 标记需要重启核心服务后才能执行检查配置
      setPendingRestart(true);
    }
  }, [
    aiConfig,
    pendingAISwitchValue,
    updateConfigValue,
    setGlobalAIEnabled,
    setPendingRestart,
  ]);

  /**
   * 打开使用帮助（重新显示 AI 服务开关确认对话框）
   */
  const handleOpenHelp = useCallback(() => {
    if (isAIEnabled) {
      setPendingAISwitchValue(true);
      setIsHelpOnly(true);
      setIsAISwitchDialogOpen(true);
    }
  }, [isAIEnabled]);

  return {
    isAISwitchDialogOpen,
    pendingAISwitchValue,
    isHelpOnly,
    handleAISwitchChange,
    handleConfirmAISwitch,
    handleOpenHelp,
    setIsAISwitchDialogOpen,
  };
}
