import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { brandApi, BrandInfo, getBrandIconUrl } from '@/lib/api';
import { useLanguage } from './LanguageContext';

// ============================================================================
// 工具：同步浏览器 tab favicon
// ============================================================================
// 后端的 /api/brand/icon 是公开接口，可在 <link rel="icon"> 上直接使用。
// 用户上传新图标后，icon_url 不变但内容变了，所以用时间戳强制浏览器重新加载。
function syncFavicon(timestamp: number) {
  if (typeof document === 'undefined') return;
  const href = getBrandIconUrl(timestamp);
  const apply = (selector: string) => {
    const el = document.querySelector<HTMLLinkElement>(selector);
    if (el) el.href = href;
  };
  apply('#favicon');
  apply('#favicon-shortcut');
  apply('#favicon-apple');
  // 兜底：按 rel 选择，避免某些环境下 id 选择失败
  document
    .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    .forEach((el) => {
      el.href = href;
    });
}

// ============================================================================
// 类型定义
// ============================================================================

interface BrandContextType {
  /** 品牌标题（用于侧边栏/页眉） */
  title: string;
  /** 品牌副标题 */
  subtitle: string;
  /** ICON 图片 URL（自动带时间戳防缓存） */
  iconUrl: string;
  /** ICON 来源：`user` 用户上传 / `default` 默认打包图标 */
  iconSource: 'user' | 'default';
  /** 后端返回的默认品牌信息（用于"恢复默认"按钮占位） */
  default: BrandInfo['default'];
  /** 是否已初始化（首次从后端拉取完成） */
  isLoaded: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 拉取最新品牌信息 */
  refresh: () => Promise<void>;
  /** 更新标题/副标题（本地立即生效） */
  updateInfo: (data: { title?: string; subtitle?: string }) => Promise<void>;
  /** 上传 ICON（本地立即生效） */
  uploadIcon: (file: File) => Promise<void>;
  /** 删除 ICON（恢复默认） */
  deleteIcon: () => Promise<void>;
}

const DEFAULT_TITLE = 'GsHub';
const DEFAULT_SUBTITLE = '早柚核心';

// ============================================================================
// Context 创建
// ============================================================================

const BrandContext = createContext<BrandContextType | undefined>(undefined);

// ============================================================================
// Provider 组件
// ============================================================================

interface BrandProviderProps {
  children: ReactNode;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { t, language } = useLanguage();
  const [info, setInfo] = useState<BrandInfo | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // 用 state 保存 icon 时间戳，保证触发 re-render 与 favicon 同步
  const [iconTs, setIconTs] = useState<number>(Date.now());

  // 当 iconTs / 语言 / 品牌变化时同步浏览器 tab favicon + title
  useEffect(() => {
    syncFavicon(iconTs);
    if (typeof document !== 'undefined') {
      // 标题按当前语言取 i18n 词条（与品牌 title 解耦，按用户要求只显示固定的"网页控制台"）
      const next = t('common.pageTitle');
      if (document.title !== next) {
        document.title = next;
      }
    }
  }, [iconTs, t, language]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await brandApi.getBrand();
      if (response.status === 0 && response.data) {
        setInfo(response.data);
        // 拉取成功，刷新一次 icon 时间戳，方便后续换图强制刷新
        setIconTs(Date.now());
      }
    } catch (err) {
      // 公开接口，登录前也会请求；失败时静默回退到默认
      console.warn('[BrandContext] failed to load brand info:', err);
    } finally {
      setIsLoaded(true);
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateInfo = useCallback(async (data: { title?: string; subtitle?: string }) => {
    const result = await brandApi.updateBrand(data);
    setInfo((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        title: result.title,
        subtitle: result.subtitle,
      };
    });
  }, []);

  const uploadIcon = useCallback(async (file: File) => {
    const result = await brandApi.uploadIcon(file);
    // 上传后强制刷新时间戳，绕过浏览器 / 代理缓存
    setIconTs(Date.now());
    setInfo((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        icon_source: result.icon_source,
        // icon_url 固定为 /api/brand/icon，这里不需要更新
      };
    });
  }, []);

  const deleteIcon = useCallback(async () => {
    const result = await brandApi.deleteIcon();
    setIconTs(Date.now());
    setInfo((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        icon_source: result.icon_source,
      };
    });
  }, []);

  const title = info?.title || DEFAULT_TITLE;
  const subtitle = info?.subtitle || DEFAULT_SUBTITLE;
  // 始终带时间戳，确保上传新图后能立即看到
  const iconUrl = getBrandIconUrl(iconTs);
  const iconSource = info?.icon_source ?? 'default';
  const defaultInfo: BrandInfo['default'] = info?.default ?? {
    icon: 'ICON.png',
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE,
  };

  const value = useMemo<BrandContextType>(
    () => ({
      title,
      subtitle,
      iconUrl,
      iconSource,
      default: defaultInfo,
      isLoaded,
      isLoading,
      refresh,
      updateInfo,
      uploadIcon,
      deleteIcon,
    }),
    [title, subtitle, iconUrl, iconSource, defaultInfo, isLoaded, isLoading, refresh, updateInfo, uploadIcon, deleteIcon]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}