import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
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

interface ThemeContextType {
  mode: ThemeMode;
  style: ThemeStyle;
  color: ThemeColor;
  backgroundImage: string | null;
  blurIntensity: number;
  iconColor: IconColor;
  themePreset: ThemePreset;
  language: Language;
  setMode: (mode: ThemeMode, autoSave?: boolean) => void;
  setStyle: (style: ThemeStyle, autoSave?: boolean) => void;
  setColor: (color: ThemeColor, autoSave?: boolean) => void;
  setBackgroundImage: (url: string | null) => void;
  setBlurIntensity: (value: number, autoSave?: boolean) => void;
  setIconColor: (color: IconColor, autoSave?: boolean) => void;
  setThemePreset: (preset: ThemePreset, autoSave?: boolean) => void;
  setLanguage: (lang: Language) => void;
  saveToBackend: () => Promise<void>;
}

// ============================================================================
// 颜色配置系统
// ============================================================================

/**
 * 基础颜色配置 - 定义明暗模式下的基础色板
 * 这些颜色不随主题色变化，提供一致的基础视觉层级
 */
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
    mutedForeground: '240 4% 35%', // 调深一点，对比度更高
    accent: '240 5% 96%',
    accentForeground: '240 6% 10%',
    destructive: '0 84% 60%',
    destructiveForeground: '0 0% 98%',
    border: '240 6% 90%',
    input: '240 6% 90%',
  },
  dark: {
    background: '240 10% 4%',         // #0a0a0b - 深色背景
    foreground: '0 0% 98%',           // #f2f2f2 - 主要文字，对比度 15.3:1
    card: '240 10% 8%',               // #121214 - 卡片背景
    cardForeground: '0 0% 90%',       // #e6e6e6 - 卡片文字，对比度 12.8:1
    popover: '240 10% 6%',            // #0f0f11 - 弹窗背景
    popoverForeground: '0 0% 95%',    // #f2f2f2 - 弹窗文字
    secondary: '240 4% 16%',          // #27272a - 次要背景
    secondaryForeground: '0 0% 98%',  // #fafafa - 次要文字
    muted: '240 4% 16%',              // #27272a - 禁用背景
    mutedForeground: '240 5% 80%',    // #a1a1aa - 次要文字，对比度 7.1:1 (WCAG AA)
    accent: '240 4% 16%',             // #27272a - 强调背景
    accentForeground: '0 0% 98%',     // #fafafa - 强调文字
    destructive: '0 63% 45%',         // #b91c1c - 错误色
    destructiveForeground: '0 0% 98%',// #fafafa - 错误文字
    border: '240 4% 16%',             // #27272a - 边框
    input: '240 4% 16%',              // #27272a - 输入框
  },
};

/**
 * 主题色配置 - 定义五种主题色的亮暗模式变体
 */
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

/**
 * Shadcn 预设颜色配置
 */
const SHADCN_COLORS: Record<ThemeMode, { primary: string; primaryForeground: string; ring: string }> = {
  light: {
    primary: '222.2 47.4% 11.2%',
    primaryForeground: '210 40% 98%',
    ring: '222.2 84% 4.9%',
  },
  dark: {
    primary: '210 40% 98%',
    primaryForeground: '222.2 47.4% 11.2%',
    ring: '212.7 26.8% 83.9%',
  },
};

// ============================================================================
// 主题计算函数
// ============================================================================

/**
 * 计算完整的颜色配置
 * 这是核心函数，所有颜色逻辑都集中在这里
 */
function computeThemeColors(
  mode: ThemeMode,
  color: ThemeColor,
  preset: ThemePreset
): Record<string, string> {
  const base = BASE_COLORS[mode];
  
  // 确定主色配置
  let primaryConfig;
  if (preset === 'shadcn') {
    primaryConfig = SHADCN_COLORS[mode];
  } else {
    primaryConfig = THEME_COLORS[color][mode];
  }
  
  // 计算强调色 - 基于主色的变体
  const accentHsl = primaryConfig.primary.split(' ');
  const accentHue = parseInt(accentHsl[0]);
  const accentSaturation = mode === 'dark' ? '30%' : '40%';
  const accentLightness = mode === 'dark' ? '20%' : '96%';
  const accent = `${accentHue} ${accentSaturation} ${accentLightness}`;
  
  // 计算强调色前景
  const accentForegroundHue = accentHue;
  const accentForegroundSaturation = mode === 'dark' ? '80%' : '50%';
  const accentForegroundLightness = mode === 'dark' ? '90%' : '40%';
  const accentForeground = `${accentForegroundHue} ${accentForegroundSaturation} ${accentForegroundLightness}`;
  
  // 组合所有颜色
  return {
    // 基础颜色
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
    
    // 主题色
    '--primary': primaryConfig.primary,
    '--primary-foreground': primaryConfig.primaryForeground,
    '--accent': accent,
    '--accent-foreground': accentForeground,
    '--ring': primaryConfig.ring,
    
    // 侧边栏颜色 - 与主色板保持一致
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

/**
 * 应用主题到 DOM
 * 这是唯一修改 CSS 变量的入口
 */
function applyThemeToDOM(colors: Record<string, string>) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

// ============================================================================
// Context 实现
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

  // 计算当前主题颜色 - 使用 useMemo 避免不必要的重新计算
  const themeColors = useMemo(
    () => computeThemeColors(mode, color, themePreset),
    [mode, color, themePreset]
  );

  // 初始化 - 从后端或 localStorage 加载配置
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
      } catch (error) {
        // 后端失败时回退到 localStorage
        loadFromLocalStorage();
      }
      setIsInitialized(true);
    };

    initTheme();
  }, []);

  // 从 localStorage 加载配置
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

  // 应用主题颜色 - 这是核心效果，任何颜色变化都会触发
  useEffect(() => {
    if (!isInitialized) return;
    applyThemeToDOM(themeColors);
  }, [themeColors, isInitialized]);

  // 应用模式 - 切换 dark 类
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_mode', mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode, isInitialized]);

  // 应用风格 - 设置 data-style 属性
  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('theme_style', style);
    document.documentElement.setAttribute('data-style', style);
  }, [style, isInitialized]);

  // 保存其他设置到 localStorage
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

  // 保存到后端
  const saveToBackend = useCallback(async () => {
    try {
      await themeApi.saveConfig({
        mode,
        style,
        color,
        icon_color: iconColor,
        background_image: backgroundImage,
        blur_intensity: blurIntensity,
        theme_preset: themePreset,
        language,
      });
    } catch (error) {
      console.error('Failed to save theme to backend:', error);
    }
  }, [mode, style, color, iconColor, backgroundImage, blurIntensity, themePreset, language]);

  // 包装状态更新函数，确保在初始化后才应用
  const setMode = useCallback((newMode: ThemeMode, autoSave?: boolean) => {
    setModeState(newMode);
    if (autoSave) {
      if (!isInitialized) {
        toast.error('系统繁忙，请稍后再试');
        return;
      }
      (async () => {
        try {
          await themeApi.saveConfig({
            mode: newMode,
            style,
            color,
            icon_color: iconColor,
            background_image: backgroundImage,
            blur_intensity: blurIntensity,
            theme_preset: themePreset,
            language,
          });
        } catch (error) {
          console.error('Failed to save mode to backend:', error);
        }
      })();
    }
  }, [isInitialized, style, color, iconColor, backgroundImage, blurIntensity, themePreset, language]);

  const setStyle = useCallback((newStyle: ThemeStyle, autoSave?: boolean) => {
    setStyleState(newStyle);
    if (autoSave) {
      if (!isInitialized) {
        toast.error('系统繁忙，请稍后再试');
        return;
      }
      (async () => {
        try {
          await themeApi.saveConfig({
            mode,
            style: newStyle,
            color,
            icon_color: iconColor,
            background_image: backgroundImage,
            blur_intensity: blurIntensity,
            theme_preset: themePreset,
            language,
          });
        } catch (error) {
          console.error('Failed to save style to backend:', error);
        }
      })();
    }
  }, [isInitialized, mode, color, iconColor, backgroundImage, blurIntensity, themePreset, language]);

  const setColor = useCallback((newColor: ThemeColor, autoSave?: boolean) => {
    setColorState(newColor);
    if (autoSave) {
      if (!isInitialized) {
        toast.error('系统繁忙，请稍后再试');
        return;
      }
      (async () => {
        try {
          await themeApi.saveConfig({
            mode,
            style,
            color: newColor,
            icon_color: iconColor,
            background_image: backgroundImage,
            blur_intensity: blurIntensity,
            theme_preset: themePreset,
            language,
          });
        } catch (error) {
          console.error('Failed to save color to backend:', error);
        }
      })();
    }
  }, [isInitialized, mode, style, iconColor, backgroundImage, blurIntensity, themePreset, language]);
  
  const setThemePreset = useCallback((newPreset: ThemePreset, autoSave?: boolean) => {
    setThemePresetState(newPreset);
    if (autoSave) {
      if (!isInitialized) {
        toast.error('系统繁忙，请稍后再试');
        return;
      }
      (async () => {
        try {
          await themeApi.saveConfig({
            mode,
            style,
            color,
            icon_color: iconColor,
            background_image: backgroundImage,
            blur_intensity: blurIntensity,
            theme_preset: newPreset,
            language,
          });
        } catch (error) {
          console.error('Failed to save theme preset to backend:', error);
        }
      })();
    }
  }, [isInitialized, mode, style, color, iconColor, backgroundImage, blurIntensity, language]);

  const setIconColor = useCallback((newIconColor: IconColor, autoSave?: boolean) => {
    setIconColorState(newIconColor);
    if (autoSave && isInitialized) {
      (async () => {
        try {
          await themeApi.saveConfig({
            mode,
            style,
            color,
            icon_color: newIconColor,
            background_image: backgroundImage,
            blur_intensity: blurIntensity,
            theme_preset: themePreset,
            language,
          });
        } catch (error) {
          console.error('Failed to save theme to backend:', error);
        }
      })();
    }
  }, [isInitialized, mode, style, color, backgroundImage, blurIntensity, themePreset, language]);

  const setBackgroundImage = useCallback(
    (url: string | null, autoSave: boolean = true) => {
      setBackgroundImageState(url);
      // 设置背景图后自动保存到后端
      // 注意：由于 React 状态更新是异步的，这里直接使用传入的 url 参数来确保保存正确的值
      if (autoSave && isInitialized) {
        (async () => {
          try {
            await themeApi.saveConfig({
              mode,
              style,
              color,
              icon_color: iconColor,
              background_image: url,
              blur_intensity: blurIntensity,
              theme_preset: themePreset,
              language,
            });
          } catch (error) {
            console.error('Failed to save theme to backend:', error);
          }
        })();
      }
    },
    [isInitialized, mode, style, color, iconColor, blurIntensity, themePreset, language]
  );

  // 设置毛玻璃强度 - 默认自动保存到后端
  const setBlurIntensity = useCallback((value: number, autoSave: boolean = true) => {
    setBlurIntensityState(value);
    if (autoSave && isInitialized) {
      (async () => {
        try {
          await themeApi.saveConfig({
            mode,
            style,
            color,
            icon_color: iconColor,
            background_image: backgroundImage,
            blur_intensity: value,
            theme_preset: themePreset,
            language,
          });
        } catch (error) {
          console.error('Failed to save blur intensity to backend:', error);
        }
      })();
    }
  }, [isInitialized, mode, style, color, iconColor, backgroundImage, themePreset, language]);

  // 设置语言 - 自动保存到后端和 localStorage
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('theme_language', lang);
    if (isInitialized) {
      (async () => {
        try {
          await themeApi.saveConfig({
            mode,
            style,
            color,
            icon_color: iconColor,
            background_image: backgroundImage,
            blur_intensity: blurIntensity,
            theme_preset: themePreset,
            language: lang,
          });
        } catch (error) {
          console.error('Failed to save language to backend:', error);
        }
      })();
    }
  }, [isInitialized, mode, style, color, iconColor, backgroundImage, blurIntensity, themePreset]);

  // Context value
  const value = useMemo(
    () => ({
      mode,
      style,
      color,
      backgroundImage,
      blurIntensity,
      iconColor,
      themePreset,
      language,
      setMode,
      setStyle,
      setColor,
      setBackgroundImage,
      setBlurIntensity,
      setIconColor,
      setThemePreset,
      setLanguage,
      saveToBackend,
    }),
    [
      mode,
      style,
      color,
      backgroundImage,
      blurIntensity,
      iconColor,
      themePreset,
      language,
      setMode,
      setStyle,
      setColor,
      setBackgroundImage,
      setBlurIntensity,
      setIconColor,
      setThemePreset,
      setLanguage,
      saveToBackend,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// 为了向后兼容，导出类型
export type { ThemeMode, ThemeStyle, ThemeColor, ThemePreset, IconColor };
