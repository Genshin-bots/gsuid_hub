import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import zhCN from '@/i18n/locales/zh-CN.json';
import enUS from '@/i18n/locales/en-US.json';

// ============================================================================
// 类型定义
// ============================================================================

export type Language = 'zh-CN' | 'en-US';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLanguages: { code: Language; name: string }[];
}

// ============================================================================
// 语言文件映射
// ============================================================================

const locales: Record<Language, Record<string, unknown>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const availableLanguages: { code: Language; name: string }[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en-US', name: 'English' },
];

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
  // 使用 ThemeContext 保存语言到后端
  const themeContext = useTheme();
  
  // 同步本地状态与 ThemeContext
  const [language, setLanguageState] = useState<Language>(() => {
    // 优先使用 ThemeContext 中已初始化的语言
    if (themeContext.language) {
      return themeContext.language;
    }
    // 从 localStorage 读取保存的语言设置
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en-US') {
      return saved;
    }
    // 默认使用中文
    return 'zh-CN';
  });

  // 同步语言变化到 ThemeContext
  useEffect(() => {
    if (themeContext.language && themeContext.language !== language) {
      setLanguageState(themeContext.language);
    }
  }, [themeContext.language]);

  // 保存语言设置到 localStorage 和后端
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    // 调用 ThemeContext 保存到后端
    themeContext.setLanguage(lang);
  }, [themeContext.setLanguage]);

  // 翻译函数
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const locale = locales[language];
    if (!locale) {
      console.warn(`Locale '${language}' not found`);
      return key;
    }
    let value = getNestedValue(locale, key);
    
    // 如果有参数，进行替换
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    
    return value;
  }, [language]);

  // 提供者值
  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    availableLanguages,
  };

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