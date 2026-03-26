import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { themeApi, ThemeConfigResponse } from '@/lib/api';
import { toast } from 'sonner';

// ============================================================================
// 类型定义
// ============================================================================

type ThemeMode = 'light' | 'dark';
type ThemeStyle = 'solid' | 'glassmorphism';
type ThemeColor = 'red' | 'orchid' | 'blue' | 'green' | 'orange' | 'pink';
type ThemePreset = 'default' | 'shadcn';
type IconColor = 'white' | 'black' | 'colored';
type Language = 'zh-CN' | 'en-US';

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
  setBackgroundImage: (url: string | null) => void;
  blurIntensity: number;
  setBlurIntensity: (value: number, autoSave?: boolean) => void;
}

interface ThemeIconColorContextType {
  iconColor: IconColor;
  setIconColor: (color: IconColor, autoSave?: boolean) => void;
}

interface ThemeLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
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

// ============================================================================
// Provider组件
// ============================================================================

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 主题状态
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [style, setStyleState] = useState<ThemeStyle>('glassmorphism');
  const [color, setColorState] = useState<ThemeColor>('red');
  const [backgroundImage, setBackgroundImageState] = useState<string | null>(null);
  const [blurIntensity, setBlurIntensityState] = useState<number>(12);
  const [iconColor, setIconColorState] = useState<IconColor>('colored');
  const [themePreset, setThemePresetState] = useState<ThemePreset>('default');
  const [language, setLanguageState] = useState<Language>('zh-CN');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 使用ref存储配置，用于自动保存
  const configRef = useRef({ mode, style, color, iconColor, backgroundImage, blurIntensity, themePreset, language });

  // 更新ref
  useEffect(() => {
    configRef.current = { mode, style, color, iconColor, backgroundImage, blurIntensity, themePreset, language };
  }, [mode, style, color, iconColor, backgroundImage, blurIntensity, themePreset, language]);

  // 计算当前主题颜色
  const themeColors = useMemo(
    () => computeThemeColors(mode, color, themePreset),
    [mode, color, themePreset]
  );

  // 初始化
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
          if (config.icon_color && ['white', 'black', 'colored'].includes(config.icon_color)) {
            setIconColorState(config.icon_color as IconColor);
          }
          if (config.theme_preset && ['default', 'shadcn'].includes(config.theme_preset)) {
            setThemePresetState(config.theme_preset as ThemePreset);
          }
          if (config.language && ['zh-CN', 'en-US'].includes(config.language)) {
            setLanguageState(config.language as Language);
          }
        }
      } catch {
        loadFromLocalStorage();
      }
      setIsInitialized(true);
    };

    initTheme();
  }, []);

  const loadFromLocalStorage = () => {
    try {
      const savedMode = localStorage.getItem('theme_mode') as ThemeMode;
      const savedStyle = localStorage.getItem('theme_style') as ThemeStyle;
      const savedColor = localStorage.getItem('theme_color') as ThemeColor;
      const savedBg = localStorage.getItem('theme_bg');
      const savedBlur = localStorage.getItem('theme_blur');
      const savedIconColor = localStorage.getItem('theme_icon_color') as IconColor;
      const savedPreset = localStorage.getItem('theme_preset') as ThemePreset;
      const savedLanguage = localStorage.getItem('theme_language') as Language;

      if (savedMode) setModeState(savedMode);
      if (savedStyle) setStyleState(savedStyle);
      if (savedColor) setColorState(savedColor);
      if (savedBg) setBackgroundImageState(savedBg);
      if (savedBlur) setBlurIntensityState(parseInt(savedBlur, 10));
      if (savedIconColor) setIconColorState(savedIconColor);
      if (savedPreset) setThemePresetState(savedPreset);
      if (savedLanguage) setLanguageState(savedLanguage);
    } catch (e) {
      console.error('Failed to load theme from localStorage:', e);
    }
  };

  // 应用主题颜色 - 合并到单一effect
  useEffect(() => {
    if (!isInitialized) return;
    applyThemeToDOM(themeColors);
  }, [themeColors, isInitialized]);

  // 应用模式
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_mode', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode, isInitialized]);

  // 应用风格
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_style', style);
    document.documentElement.setAttribute('data-style', style);
  }, [style, isInitialized]);

  // 保存其他设置
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_color', color);
    localStorage.setItem('theme_preset', themePreset);
  }, [color, themePreset, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    if (backgroundImage) {
      localStorage.setItem('theme_bg', backgroundImage);
    } else {
      localStorage.removeItem('theme_bg');
    }
  }, [backgroundImage, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_blur', blurIntensity.toString());
    document.documentElement.style.setProperty('--blur-intensity', `${blurIntensity}px`);
  }, [blurIntensity, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_icon_color', iconColor);
    document.documentElement.setAttribute('data-icon-color', iconColor);
  }, [iconColor, isInitialized]);

  // 保存到后端的统一方法
  const saveToBackend = useCallback(async () => {
    const config = configRef.current;
    try {
      await themeApi.saveConfig({
        mode: config.mode,
        style: config.style,
        color: config.color,
        icon_color: config.iconColor,
        background_image: config.backgroundImage,
        blur_intensity: config.blurIntensity,
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
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setStyle = useCallback((newStyle: ThemeStyle, autoSave?: boolean) => {
    setStyleState(newStyle);
    if (autoSave && isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setColor = useCallback((newColor: ThemeColor, autoSave?: boolean) => {
    setColorState(newColor);
    if (autoSave && isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setThemePreset = useCallback((newPreset: ThemePreset, autoSave?: boolean) => {
    setThemePresetState(newPreset);
    if (autoSave && isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setIconColor = useCallback((newIconColor: IconColor, autoSave?: boolean) => {
    setIconColorState(newIconColor);
    if (autoSave && isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setBackgroundImage = useCallback((url: string | null) => {
    setBackgroundImageState(url);
    if (isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setBlurIntensity = useCallback((value: number, autoSave?: boolean) => {
    setBlurIntensityState(value);
    if (autoSave && isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('theme_language', lang);
    if (isInitialized) {
      saveToBackend();
    }
  }, [isInitialized, saveToBackend]);

  // Context values
  const modeContext = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  const styleContext = useMemo(() => ({ style, setStyle }), [style, setStyle]);
  const colorContext = useMemo(() => ({ color, setColor, themePreset, setThemePreset }), [color, setColor, themePreset, setThemePreset]);
  const backgroundContext = useMemo(() => ({ backgroundImage, setBackgroundImage, blurIntensity, setBlurIntensity }), [backgroundImage, setBackgroundImage, blurIntensity, setBlurIntensity]);
  const iconColorContext = useMemo(() => ({ iconColor, setIconColor }), [iconColor, setIconColor]);
  const languageContext = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return (
    <ThemeModeContext.Provider value={modeContext}>
      <ThemeStyleContext.Provider value={styleContext}>
        <ThemeColorContext.Provider value={colorContext}>
          <ThemeBackgroundContext.Provider value={backgroundContext}>
            <ThemeIconColorContext.Provider value={iconColorContext}>
              <ThemeLanguageContext.Provider value={languageContext}>
                {children}
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

  if (modeContext === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  // 合并所有context
  return {
    mode: modeContext.mode,
    style: styleContext.style,
    color: colorContext.color,
    backgroundImage: backgroundContext.backgroundImage,
    blurIntensity: backgroundContext.blurIntensity,
    iconColor: iconColorContext.iconColor,
    themePreset: colorContext.themePreset,
    language: languageContext.language,
    setMode: modeContext.setMode,
    setStyle: styleContext.setStyle,
    setColor: colorContext.setColor,
    setBackgroundImage: backgroundContext.setBackgroundImage,
    setBlurIntensity: backgroundContext.setBlurIntensity,
    setIconColor: iconColorContext.setIconColor,
    setThemePreset: colorContext.setThemePreset,
    setLanguage: languageContext.setLanguage,
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
