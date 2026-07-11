import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { themeApi, ThemeConfig, getAuthToken } from '@/lib/api';

/** 与 LanguageContext 共用：浏览器侧语言偏好（登录前也可持久） */
const LANGUAGE_STORAGE_KEY = 'gsuid_hub_language';

function readStoredLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en-US' || saved === 'ja-JP') {
      return saved;
    }
    const sessionSaved = sessionStorage.getItem('theme_language');
    if (sessionSaved === 'zh-CN' || sessionSaved === 'en-US' || sessionSaved === 'ja-JP') {
      return sessionSaved;
    }
  } catch {
    // ignore storage access errors
  }
  return null;
}

// ============================================================================
// 类型定义
// ============================================================================

type ThemeMode = 'light' | 'dark';
type ThemeStyle = 'solid' | 'glassmorphism';
type ThemeColor = 'red' | 'orchid' | 'blue' | 'green' | 'orange' | 'pink';
type ThemePreset = 'default' | 'shadcn';
type IconColor = 'white' | 'black' | 'colored';
type Language = 'zh-CN' | 'en-US' | 'ja-JP';

// Context类型定义 - 拆分为多个小context
interface ThemeModeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode, autoSave?: boolean) => void;
}

interface ThemeStyleContextType {
  style: ThemeStyle;
  setStyle: (style: ThemeStyle, autoSave?: boolean) => void;
}

interface ThemeColorContextType {
  color: ThemeColor;
  setColor: (color: ThemeColor, autoSave?: boolean) => void;
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset, autoSave?: boolean) => void;
}

interface ThemeBackgroundContextType {
  backgroundImage: string | null;
  setBackgroundImage: (url: string | null, autoSave?: boolean) => void;
  blurIntensity: number;
  setBlurIntensity: (value: number, autoSave?: boolean) => void;
  /** Card opacity percentage (0-100). Applies to both solid and glassmorphism styles. */
  cardOpacity: number;
  setCardOpacity: (value: number, autoSave?: boolean) => void;
}

interface ThemeIconColorContextType {
  iconColor: IconColor;
  setIconColor: (color: IconColor, autoSave?: boolean) => void;
}

interface ThemeLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

interface ThemeActionsContextType {
  /** Snapshot the current theme as a `ThemeConfig` (for saving a preset). */
  getThemeConfig: () => ThemeConfig;
  /** Apply a full theme config to the live UI without re-persisting to the backend. */
  applyThemeConfig: (config: Partial<ThemeConfig>) => void;
}

// ============================================================================
// 颜色配置系统
// ============================================================================

const BASE_COLORS = {
  light: {
    background: '0 0% 100%',
    foreground: '240 10% 4%',
    card: '0 0% 100%',
    cardForeground: '240 10% 4%',
    popover: '0 0% 100%',
    popoverForeground: '240 10% 4%',
    secondary: '240 5% 96%',
    secondaryForeground: '240 6% 10%',
    muted: '240 5% 96%',
    mutedForeground: '240 4% 35%',
    accent: '240 5% 96%',
    accentForeground: '240 6% 10%',
    destructive: '0 84% 60%',
    destructiveForeground: '0 0% 98%',
    border: '240 6% 90%',
    input: '240 6% 90%',
  },
  dark: {
    background: '240 10% 4%',
    foreground: '0 0% 98%',
    card: '240 10% 8%',
    cardForeground: '0 0% 90%',
    popover: '240 10% 6%',
    popoverForeground: '0 0% 95%',
    secondary: '240 4% 16%',
    secondaryForeground: '0 0% 98%',
    muted: '240 4% 16%',
    mutedForeground: '240 5% 80%',
    accent: '240 4% 16%',
    accentForeground: '0 0% 98%',
    destructive: '0 63% 45%',
    destructiveForeground: '0 0% 98%',
    border: '240 4% 16%',
    input: '240 4% 16%',
  },
};

const THEME_COLORS: Record<ThemeColor, Record<ThemeMode, { primary: string; primaryForeground: string; ring: string }>> = {
  red: {
    light: { primary: '0 80% 55%', primaryForeground: '0 0% 100%', ring: '0 80% 55%' },
    dark: { primary: '0 70% 60%', primaryForeground: '0 0% 100%', ring: '0 70% 60%' },
  },
  orchid: {
    light: { primary: '270 50% 50%', primaryForeground: '0 0% 100%', ring: '270 50% 50%' },
    dark: { primary: '270 70% 70%', primaryForeground: '0 0% 100%', ring: '270 70% 70%' },
  },
  blue: {
    light: { primary: '220 70% 50%', primaryForeground: '0 0% 100%', ring: '220 70% 50%' },
    dark: { primary: '220 70% 60%', primaryForeground: '220 70% 10%', ring: '220 70% 60%' },
  },
  green: {
    light: { primary: '150 60% 35%', primaryForeground: '0 0% 100%', ring: '150 60% 35%' },
    dark: { primary: '150 60% 50%', primaryForeground: '150 60% 10%', ring: '150 60% 50%' },
  },
  orange: {
    light: { primary: '30 90% 45%', primaryForeground: '0 0% 100%', ring: '30 90% 45%' },
    dark: { primary: '30 90% 55%', primaryForeground: '30 90% 10%', ring: '30 90% 55%' },
  },
  pink: {
    light: { primary: '330 70% 50%', primaryForeground: '0 0% 100%', ring: '330 70% 50%' },
    dark: { primary: '330 70% 65%', primaryForeground: '330 70% 10%', ring: '330 70% 65%' },
  },
};

const SHADCN_COLORS: Record<ThemeMode, { primary: string; primaryForeground: string; ring: string }> = {
  light: { primary: '222.2 47.4% 11.2%', primaryForeground: '210 40% 98%', ring: '222.2 84% 4.9%' },
  dark: { primary: '210 40% 98%', primaryForeground: '222.2 47.4% 11.2%', ring: '212.7 26.8% 83.9%' },
};

// ============================================================================
// 主题计算函数
// ============================================================================

function computeThemeColors(
  mode: ThemeMode,
  color: ThemeColor,
  preset: ThemePreset
): Record<string, string> {
  const base = BASE_COLORS[mode];
  let primaryConfig;
  if (preset === 'shadcn') {
    primaryConfig = SHADCN_COLORS[mode];
  } else {
    primaryConfig = THEME_COLORS[color][mode];
  }
  
  const accentHsl = primaryConfig.primary.split(' ');
  const accentHue = parseInt(accentHsl[0]);
  const accentSaturation = mode === 'dark' ? '30%' : '40%';
  const accentLightness = mode === 'dark' ? '20%' : '96%';
  const accent = `${accentHue} ${accentSaturation} ${accentLightness}`;
  
  const accentForegroundHue = accentHue;
  const accentForegroundSaturation = mode === 'dark' ? '80%' : '50%';
  const accentForegroundLightness = mode === 'dark' ? '90%' : '40%';
  const accentForeground = `${accentForegroundHue} ${accentForegroundSaturation} ${accentForegroundLightness}`;
  
  return {
    '--background': base.background,
    '--foreground': base.foreground,
    '--card': base.card,
    '--card-foreground': base.cardForeground,
    '--popover': base.popover,
    '--popover-foreground': base.popoverForeground,
    '--secondary': base.secondary,
    '--secondary-foreground': base.secondaryForeground,
    '--muted': base.muted,
    '--muted-foreground': base.mutedForeground,
    '--destructive': base.destructive,
    '--destructive-foreground': base.destructiveForeground,
    '--border': base.border,
    '--input': base.input,
    '--primary': primaryConfig.primary,
    '--primary-foreground': primaryConfig.primaryForeground,
    '--accent': accent,
    '--accent-foreground': accentForeground,
    '--ring': primaryConfig.ring,
    '--sidebar': base.background,
    '--sidebar-background': base.background,
    '--sidebar-foreground': base.foreground,
    '--sidebar-primary': primaryConfig.primary,
    '--sidebar-primary-foreground': primaryConfig.primaryForeground,
    '--sidebar-accent': accent,
    '--sidebar-accent-foreground': accentForeground,
    '--sidebar-border': base.border,
    '--sidebar-ring': primaryConfig.ring,
  };
}

function applyThemeToDOM(colors: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

// ============================================================================
// Contexts
// ============================================================================

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined);
const ThemeStyleContext = createContext<ThemeStyleContextType | undefined>(undefined);
const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);
const ThemeBackgroundContext = createContext<ThemeBackgroundContextType | undefined>(undefined);
const ThemeIconColorContext = createContext<ThemeIconColorContextType | undefined>(undefined);
const ThemeLanguageContext = createContext<ThemeLanguageContextType | undefined>(undefined);
const ThemeActionsContext = createContext<ThemeActionsContextType | undefined>(undefined);

// ============================================================================
// Provider组件
// ============================================================================

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 主题状�?
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [style, setStyleState] = useState<ThemeStyle>('glassmorphism');
  const [color, setColorState] = useState<ThemeColor>('red');
  const [backgroundImage, setBackgroundImageState] = useState<string | null>(null);
  const [blurIntensity, setBlurIntensityState] = useState<number>(12);
  const [cardOpacity, setCardOpacityState] = useState<number>(25);
  const [iconColor, setIconColorState] = useState<IconColor>('colored');
  const [themePreset, setThemePresetState] = useState<ThemePreset>('default');
  // 优先读浏览器已保存的语言，避免未登录时被默认 zh-CN 覆盖
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage() ?? 'zh-CN');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 使用ref存储配置，用于自动保�?
  const configRef = useRef({ mode, style, color, iconColor, backgroundImage, blurIntensity, cardOpacity, themePreset, language });

  // 更新ref
  useEffect(() => {
    configRef.current = { mode, style, color, iconColor, backgroundImage, blurIntensity, cardOpacity, themePreset, language };
  }, [mode, style, color, iconColor, backgroundImage, blurIntensity, cardOpacity, themePreset, language]);

  // 计算当前主题颜色
  const themeColors = useMemo(
    () => computeThemeColors(mode, color, themePreset),
    [mode, color, themePreset]
  );

  // 初始�?
  useEffect(() => {
    const initTheme = async () => {
      try {
        const response = await themeApi.getConfig();
        if (response.status === 0 && response.data) {
          const config = response.data;
          
          if (config.mode && ['light', 'dark'].includes(config.mode)) {
            setModeState(config.mode as ThemeMode);
          }
          if (config.style && ['solid', 'glassmorphism'].includes(config.style)) {
            setStyleState(config.style as ThemeStyle);
          }
          if (config.color && ['red', 'orchid', 'blue', 'green', 'orange', 'pink'].includes(config.color)) {
            setColorState(config.color as ThemeColor);
          }
          if (config.background_image !== undefined) {
            setBackgroundImageState(config.background_image);
          }
          if (config.blur_intensity !== undefined) {
            setBlurIntensityState(config.blur_intensity);
          }
          if (config.card_opacity !== undefined && config.card_opacity !== null) {
            setCardOpacityState(config.card_opacity);
          }
          if (config.icon_color && ['white', 'black', 'colored'].includes(config.icon_color)) {
            setIconColorState(config.icon_color as IconColor);
          }
          if (config.theme_preset && ['default', 'shadcn'].includes(config.theme_preset)) {
            setThemePresetState(config.theme_preset as ThemePreset);
          }
          // 语言：浏览器本地偏好优先（登录页切换后刷新不应被服务端默认中文覆盖）
          const storedLang = readStoredLanguage();
          if (storedLang) {
            setLanguageState(storedLang);
          } else if (config.language && ['zh-CN', 'en-US', 'ja-JP'].includes(config.language)) {
            setLanguageState(config.language as Language);
          }
        }
      } catch {
        loadFromSessionStorage();
      }
      setIsInitialized(true);
    };

    initTheme();
  }, []);

  const loadFromSessionStorage = () => {
    try {
      const savedMode = sessionStorage.getItem('theme_mode') as ThemeMode;
      const savedStyle = sessionStorage.getItem('theme_style') as ThemeStyle;
      const savedColor = sessionStorage.getItem('theme_color') as ThemeColor;
      const savedBg = sessionStorage.getItem('theme_bg');
      const savedBlur = sessionStorage.getItem('theme_blur');
    const savedCardOpacity = sessionStorage.getItem('theme_card_opacity');
      const savedIconColor = sessionStorage.getItem('theme_icon_color') as IconColor;
      const savedPreset = sessionStorage.getItem('theme_preset') as ThemePreset;
      const savedLanguage = readStoredLanguage();

      if (savedMode) setModeState(savedMode);
      if (savedStyle) setStyleState(savedStyle);
      if (savedColor) setColorState(savedColor);
      if (savedBg) setBackgroundImageState(savedBg);
      if (savedBlur) setBlurIntensityState(parseInt(savedBlur, 10));
      if (savedCardOpacity) setCardOpacityState(parseInt(savedCardOpacity, 10));
      if (savedIconColor) setIconColorState(savedIconColor);
      if (savedPreset) setThemePresetState(savedPreset);
      if (savedLanguage) setLanguageState(savedLanguage);
    } catch (e) {
      console.error('Failed to load theme from sessionStorage:', e);
    }
  };

  // 批量应用所有主题设置到DOM - 合并为单一effect减少重绘
  useEffect(() => {
    if (!isInitialized) return;
    
    // 批量DOM操作，使用requestAnimationFrame确保在同一帧内完成
    const applyTheme = () => {
      // 应用主题颜色
      applyThemeToDOM(themeColors);
      
      // 应用模式
      sessionStorage.setItem('theme_mode', mode);
      document.documentElement.classList.toggle('dark', mode === 'dark');
      
      // 应用风格
      sessionStorage.setItem('theme_style', style);
      document.documentElement.setAttribute('data-style', style);
      
      // 保存其他设置到sessionStorage
      sessionStorage.setItem('theme_color', color);
      sessionStorage.setItem('theme_preset', themePreset);
      
      if (backgroundImage) {
        sessionStorage.setItem('theme_bg', backgroundImage);
      } else {
        sessionStorage.removeItem('theme_bg');
      }
      
      sessionStorage.setItem('theme_blur', blurIntensity.toString());
      document.documentElement.style.setProperty('--blur-intensity', `${blurIntensity}px`);

      sessionStorage.setItem('theme_card_opacity', cardOpacity.toString());
      document.documentElement.style.setProperty('--card-opacity', String(cardOpacity / 100));
      
      sessionStorage.setItem('theme_icon_color', iconColor);
      document.documentElement.setAttribute('data-icon-color', iconColor);
    };
    
    // 使用requestAnimationFrame确保批量执行
    requestAnimationFrame(applyTheme);
  }, [themeColors, mode, style, color, themePreset, backgroundImage, blurIntensity, cardOpacity, iconColor, isInitialized]);

  // 保存到后端的统一方法
  const saveToBackend = useCallback(async (overrides?: Partial<typeof configRef.current>) => {
    const config = { ...configRef.current, ...overrides };
    try {
      await themeApi.saveConfig({
        mode: config.mode,
        style: config.style,
        color: config.color,
        icon_color: config.iconColor,
        background_image: config.backgroundImage,
        blur_intensity: config.blurIntensity,
        card_opacity: config.cardOpacity,
        theme_preset: config.themePreset,
        language: config.language,
      });
    } catch (error) {
      console.error('Failed to save theme to backend:', error);
    }
  }, []);

  // 包装的setter方法
  const setMode = useCallback((newMode: ThemeMode, autoSave?: boolean) => {
    setModeState(newMode);
    if (autoSave && isInitialized) {
      saveToBackend({ mode: newMode });
    }
  }, [isInitialized, saveToBackend]);

  const setStyle = useCallback((newStyle: ThemeStyle, autoSave?: boolean) => {
    setStyleState(newStyle);
    if (autoSave && isInitialized) {
      saveToBackend({ style: newStyle });
    }
  }, [isInitialized, saveToBackend]);

  const setColor = useCallback((newColor: ThemeColor, autoSave?: boolean) => {
    setColorState(newColor);
    if (autoSave && isInitialized) {
      saveToBackend({ color: newColor });
    }
  }, [isInitialized, saveToBackend]);

  const setThemePreset = useCallback((newPreset: ThemePreset, autoSave?: boolean) => {
    setThemePresetState(newPreset);
    if (autoSave && isInitialized) {
      saveToBackend({ themePreset: newPreset });
    }
  }, [isInitialized, saveToBackend]);

  const setIconColor = useCallback((newIconColor: IconColor, autoSave?: boolean) => {
    setIconColorState(newIconColor);
    if (autoSave && isInitialized) {
      saveToBackend({ iconColor: newIconColor });
    }
  }, [isInitialized, saveToBackend]);

  const setBackgroundImage = useCallback((url: string | null, autoSave?: boolean) => {
    setBackgroundImageState(url);
    if (autoSave && isInitialized) {
      saveToBackend({ backgroundImage: url });
    }
  }, [isInitialized, saveToBackend]);

  const setBlurIntensity = useCallback((value: number, autoSave?: boolean) => {
    setBlurIntensityState(value);
    if (autoSave && isInitialized) {
      saveToBackend({ blurIntensity: value });
    }
  }, [isInitialized, saveToBackend]);

  const setCardOpacity = useCallback((value: number, autoSave?: boolean) => {
    setCardOpacityState(value);
    if (autoSave && isInitialized) {
      saveToBackend({ cardOpacity: value });
    }
  }, [isInitialized, saveToBackend]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      sessionStorage.setItem('theme_language', lang);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore storage access errors
    }
    // 未登录时保存主题会 401，api 层会整页跳转登录页，导致语言被重置。
    // 登录前只写本地存储；登录后再同步到后端。
    if (isInitialized && getAuthToken()) {
      saveToBackend({ language: lang });
    }
  }, [isInitialized, saveToBackend]);

  // 把当前主题快照成后端 ThemeConfig 结构（用于保存预设）
  const getThemeConfig = useCallback((): ThemeConfig => {
    const c = configRef.current;
    return {
      mode: c.mode,
      style: c.style,
      color: c.color,
      icon_color: c.iconColor,
      background_image: c.backgroundImage,
      blur_intensity: c.blurIntensity,
      card_opacity: c.cardOpacity,
      theme_preset: c.themePreset,
      language: c.language,
    };
  }, []);

  // 应用一份完整主题配置到 UI（不再回写后端：应用预设时后端已落盘）。
  // 字段逐项校验，非法值忽略，与 initTheme 的容错逻辑保持一致。
  const applyThemeConfig = useCallback((config: Partial<ThemeConfig>) => {
    if (config.mode && ['light', 'dark'].includes(config.mode)) {
      setModeState(config.mode as ThemeMode);
    }
    if (config.style && ['solid', 'glassmorphism'].includes(config.style)) {
      setStyleState(config.style as ThemeStyle);
    }
    if (config.color && ['red', 'orchid', 'blue', 'green', 'orange', 'pink'].includes(config.color)) {
      setColorState(config.color as ThemeColor);
    }
    if (config.background_image !== undefined) {
      setBackgroundImageState(config.background_image);
    }
    if (typeof config.blur_intensity === 'number') {
      setBlurIntensityState(Math.max(0, Math.min(24, config.blur_intensity)));
    }
    if (typeof config.card_opacity === 'number') {
      setCardOpacityState(Math.max(0, Math.min(100, config.card_opacity)));
    }
    if (config.icon_color && ['white', 'black', 'colored'].includes(config.icon_color)) {
      setIconColorState(config.icon_color as IconColor);
    }
    if (config.theme_preset && ['default', 'shadcn'].includes(config.theme_preset)) {
      setThemePresetState(config.theme_preset as ThemePreset);
    }
    if (config.language && ['zh-CN', 'en-US', 'ja-JP'].includes(config.language)) {
      setLanguageState(config.language as Language);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, config.language);
        sessionStorage.setItem('theme_language', config.language);
      } catch {
        // ignore
      }
    }
  }, []);

  // Context values
  const modeContext = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  const styleContext = useMemo(() => ({ style, setStyle }), [style, setStyle]);
  const colorContext = useMemo(() => ({ color, setColor, themePreset, setThemePreset }), [color, setColor, themePreset, setThemePreset]);
  const backgroundContext = useMemo(() => ({ backgroundImage, setBackgroundImage, blurIntensity, setBlurIntensity, cardOpacity, setCardOpacity }), [backgroundImage, setBackgroundImage, blurIntensity, setBlurIntensity, cardOpacity, setCardOpacity]);
  const iconColorContext = useMemo(() => ({ iconColor, setIconColor }), [iconColor, setIconColor]);
  const languageContext = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  const actionsContext = useMemo(() => ({ getThemeConfig, applyThemeConfig }), [getThemeConfig, applyThemeConfig]);

  return (
    <ThemeModeContext.Provider value={modeContext}>
      <ThemeStyleContext.Provider value={styleContext}>
        <ThemeColorContext.Provider value={colorContext}>
          <ThemeBackgroundContext.Provider value={backgroundContext}>
            <ThemeIconColorContext.Provider value={iconColorContext}>
              <ThemeLanguageContext.Provider value={languageContext}>
                <ThemeActionsContext.Provider value={actionsContext}>
                  {children}
                </ThemeActionsContext.Provider>
              </ThemeLanguageContext.Provider>
            </ThemeIconColorContext.Provider>
          </ThemeBackgroundContext.Provider>
        </ThemeColorContext.Provider>
      </ThemeStyleContext.Provider>
    </ThemeModeContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useTheme() {
  const modeContext = useContext(ThemeModeContext);
  const styleContext = useContext(ThemeStyleContext);
  const colorContext = useContext(ThemeColorContext);
  const backgroundContext = useContext(ThemeBackgroundContext);
  const iconColorContext = useContext(ThemeIconColorContext);
  const languageContext = useContext(ThemeLanguageContext);
  const actionsContext = useContext(ThemeActionsContext);

  if (modeContext === undefined || actionsContext === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  // 合并所有context
  return {
    mode: modeContext.mode,
    style: styleContext.style,
    color: colorContext.color,
    backgroundImage: backgroundContext.backgroundImage,
    blurIntensity: backgroundContext.blurIntensity,
    cardOpacity: backgroundContext.cardOpacity,
    iconColor: iconColorContext.iconColor,
    themePreset: colorContext.themePreset,
    language: languageContext.language,
    setMode: modeContext.setMode,
    setStyle: styleContext.setStyle,
    setColor: colorContext.setColor,
    setBackgroundImage: backgroundContext.setBackgroundImage,
    setBlurIntensity: backgroundContext.setBlurIntensity,
    setCardOpacity: backgroundContext.setCardOpacity,
    setIconColor: iconColorContext.setIconColor,
    setThemePreset: colorContext.setThemePreset,
    setLanguage: languageContext.setLanguage,
    getThemeConfig: actionsContext.getThemeConfig,
    applyThemeConfig: actionsContext.applyThemeConfig,
  };
}

// 单独导出的便捷hooks
export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (context === undefined) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeStyle() {
  const context = useContext(ThemeStyleContext);
  if (context === undefined) {
    throw new Error('useThemeStyle must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeColor() {
  const context = useContext(ThemeColorContext);
  if (context === undefined) {
    throw new Error('useThemeColor must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeBackground() {
  const context = useContext(ThemeBackgroundContext);
  if (context === undefined) {
    throw new Error('useThemeBackground must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeIconColor() {
  const context = useContext(ThemeIconColorContext);
  if (context === undefined) {
    throw new Error('useThemeIconColor must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeLanguage() {
  const context = useContext(ThemeLanguageContext);
  if (context === undefined) {
    throw new Error('useThemeLanguage must be used within a ThemeProvider');
  }
  return context;
}

export type { ThemeMode, ThemeStyle, ThemeColor, ThemePreset, IconColor };
