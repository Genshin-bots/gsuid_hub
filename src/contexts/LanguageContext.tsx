import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import zhCommon from '@/i18n/locales/zh-CN/common.json';
import zhLogin from '@/i18n/locales/zh-CN/login.json';
import { afterFirstPaint } from '@/lib/afterFirstPaint';

// ============================================================================
// 类型定义
// ============================================================================

export type Language = 'zh-CN' | 'en-US' | 'ja-JP';

export interface LanguageOption {
  code: Language;
  name: string;
  shortName: string;
  flagCode: 'cn' | 'us' | 'jp';
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLanguages: LanguageOption[];
}

// ============================================================================
// 语言文件映射
// ============================================================================

type LocaleTree = Record<string, unknown>;
const zhBoot: LocaleTree = { common: zhCommon, login: zhLogin };
const extraLocaleLoaders: Record<Exclude<Language, 'zh-CN'>, () => Promise<{ default: LocaleTree }>> = {
  'en-US': () => import('@/i18n/locales/en-US'),
  'ja-JP': () => import('@/i18n/locales/ja-JP'),
};

const availableLanguages: LanguageOption[] = [
  { code: 'zh-CN', name: '简体中文', shortName: '中', flagCode: 'cn' },
  { code: 'en-US', name: 'English', shortName: 'EN', flagCode: 'us' },
  { code: 'ja-JP', name: '日本語', shortName: '日', flagCode: 'jp' },
];

// 预定义的翻译函数（不在组件内部创建）
const defaultT = (key: string, locale: Record<string, unknown>, params?: Record<string, string | number>): string => {
  if (!locale) {
    return key;
  }
  const keys = key.split('.');
  let current: unknown = locale;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }
  
  let value = typeof current === 'string' ? current : key;
  
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }
  
  return value;
};

// ============================================================================
// 存储键名
// ============================================================================

const LANGUAGE_STORAGE_KEY = 'gsuid_hub_language';

// ============================================================================
// 工具函数：获取嵌套属性
// ============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // 返回 key 如果找不到翻译
    }
  }
  
  return typeof current === 'string' ? current : path;
}

// ============================================================================
// Context 创建
// ============================================================================

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ============================================================================
// Provider 组件
// ============================================================================

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // 使用 ThemeContext 保存语言到后端（已登录时）/ sessionStorage
  const themeContext = useTheme();
  
  // 浏览器 localStorage 为 UI 语言的主来源；Theme 默认 zh-CN 不应抢先覆盖用户偏好
  const [extraLocales, setExtraLocales] = useState<Partial<Record<Exclude<Language, 'zh-CN'>, LocaleTree>>>({});
  const [zhFull, setZhFull] = useState<LocaleTree | null>(null);

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'zh-CN' || saved === 'en-US' || saved === 'ja-JP') {
        return saved;
      }
    } catch {
      // ignore
    }
    if (themeContext.language === 'zh-CN' || themeContext.language === 'en-US' || themeContext.language === 'ja-JP') {
      return themeContext.language;
    }
    return 'zh-CN';
  });

  // 主题侧语言变化时同步到 UI（例如应用主题预设，会同步写入 localStorage）。
  // 若本地已有用户偏好，以本地为准，避免 getConfig 的默认中文覆盖登录页的选择。
  useEffect(() => {
    if (!themeContext.language) return;

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (stored === 'zh-CN' || stored === 'en-US' || stored === 'ja-JP') {
      if (stored !== language) {
        setLanguageState(stored);
      }
      return;
    }

    if (themeContext.language !== language) {
      setLanguageState(themeContext.language);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, themeContext.language);
      } catch {
        // ignore
      }
    }
  }, [themeContext.language, language]);

  useEffect(() => {
    afterFirstPaint(() => {
      void import('@/i18n/locales/zh-CN').then((mod) => {
        setZhFull(mod.default as unknown as LocaleTree);
      });
    });
  }, []);

  useEffect(() => {
    if (language === 'zh-CN' || extraLocales[language]) return;
    let alive = true;
    extraLocaleLoaders[language]().then((mod) => {
      if (!alive) return;
      setExtraLocales((prev) => ({ ...prev, [language]: mod.default as unknown as LocaleTree }));
    });
    return () => {
      alive = false;
    };
  }, [language, extraLocales]);

  // 保存语言设置到 localStorage；ThemeContext 负责 session / 后端（仅已登录）
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    themeContext.setLanguage(lang);
  }, [themeContext.setLanguage]);

  // 翻译函数 - 使用useMemo缓存
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const pack =
      language === 'zh-CN'
        ? (zhFull ?? zhBoot)
        : extraLocales[language] ?? zhFull ?? zhBoot;
    return defaultT(key, pack, params);
  }, [language, extraLocales, zhFull]);

  // 提供者值 - 使用useMemo避免每次渲染创建新对象
  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t,
    availableLanguages,
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// ============================================================================
// 自定义 Hook
// ============================================================================

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}