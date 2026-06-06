import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react';
import { aiWizardApi, getAuthToken } from '@/lib/api';

interface AIStatusContextType {
  /** AI 服务是否启用（来自 wizard/status 接口） */
  isAIEnabled: boolean;
  /** 显式设置启用状态（用于 /ai-config 页面切换时立刻同步） */
  setAIEnabled: (enabled: boolean) => void;
  /** 强制从后端刷新（用于重新拉取最新状态） */
  refresh: () => Promise<void>;
  /** 是否已完成首次加载 */
  isLoaded: boolean;
}

const AIStatusContext = createContext<AIStatusContextType | undefined>(undefined);

interface AIStatusProviderProps {
  children: ReactNode;
}

export function AIStatusProvider({ children }: AIStatusProviderProps) {
  const [isAIEnabled, setIsAIEnabledState] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    // 未登录不请求，避免在登录界面触发 401 重定向
    if (!localStorage.getItem('auth_token') && !document.cookie.includes('auth_token')) {
      setIsLoaded(true);
      return;
    }
    try {
      const response = await aiWizardApi.getStatus();
      if (response && typeof response === 'object' && 'ai_enabled' in response) {
        setIsAIEnabledState(Boolean((response as { ai_enabled: boolean }).ai_enabled));
      }
    } catch {
      // ignore
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 启动时拉取一次
  useEffect(() => {
    refresh();
  }, [refresh]);

  const setAIEnabled = useCallback((enabled: boolean) => {
    setIsAIEnabledState(enabled);
  }, []);

  const value = useMemo<AIStatusContextType>(() => ({
    isAIEnabled,
    setAIEnabled,
    refresh,
    isLoaded,
  }), [isAIEnabled, setAIEnabled, refresh, isLoaded]);

  return (
    <AIStatusContext.Provider value={value}>
      {children}
    </AIStatusContext.Provider>
  );
}

export function useAIStatus() {
  const context = useContext(AIStatusContext);
  if (context === undefined) {
    throw new Error('useAIStatus must be used within an AIStatusProvider');
  }
  return context;
}
