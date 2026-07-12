import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { themeApi, ThemePresetItem, ThemeConfig, getApiErrorMessage } from '@/lib/api';
import {
  Sun, Moon, Palette, Image, Sparkles, Check, Upload, Link, X, Blend, Paintbrush,
  Layers, Droplet, Bookmark, Save, Trash2, Loader2, RefreshCw, CheckCircle2,
  AlertTriangle, FolderOpen, SlidersHorizontal, PanelLeft, SquareStack,
  CornerDownRight, Type, PanelLeftClose, PanelLeftOpen, SeparatorVertical,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// 静态预设数据
// ============================================================================

const themeColors = [
  { id: 'red', name: 'themes.red', color: 'hsl(0 80% 55%)' },
  { id: 'orchid', name: 'themes.orchid', color: 'hsl(270 60% 60%)' },
  { id: 'blue', name: 'themes.blue', color: 'hsl(220 70% 50%)' },
  { id: 'green', name: 'themes.green', color: 'hsl(150 60% 40%)' },
  { id: 'orange', name: 'themes.orange', color: 'hsl(30 90% 50%)' },
  { id: 'pink', name: 'themes.pink', color: 'hsl(330 70% 60%)' },
] as const;

// 二次元背景预设
const animeBgPresets = [
  { id: 'anime3', name: 'themes.animeStreet', value: 'https://cdn.pixabay.com/photo/2024/05/26/15/27/anime-8788959_1280.jpg' },
  { id: 'anime4', name: 'themes.animeRail', value: 'https://files.seeusercontent.com/2026/03/13/5nQg/gg.jpg' },
  { id: 'anime5', name: 'themes.randomWife', value: 'https://api.paugram.com/wallpaper' },
  { id: 'anime6', name: 'themes.ruinsGirl', value: 'https://files.seeusercontent.com/2026/03/13/w5oD/aa.jpg' },
  { id: 'anime7', name: 'themes.kamisatoAyaka', value: 'https://files.seeusercontent.com/2026/06/20/Jth9/aeb070e9498a448d60e76caddd36432b.jpg' },
  { id: 'anime8', name: 'themes.sayu', value: 'https://files.seeusercontent.com/2026/06/20/sgO1/2026-06-21-06-13-29.png' },
  { id: 'anime9', name: 'themes.bidens', value: 'https://files.seeusercontent.com/2026/06/20/u2Sj/a694927.jpg' },
  { id: 'anime10', name: 'themes.blueGirl', value: 'https://files.seeusercontent.com/2026/06/20/qS9l/44873217_p0.jpg' },
  { id: 'anime11', name: 'themes.miku', value: 'https://files.seeusercontent.com/2026/06/20/kL1z/wallpaper894.jpg' },
];

// 图片预设背景
const imagePresets = [
  { id: 'starry', name: 'themes.black', value: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&q=80' },
  { id: 'mountain', name: 'themes.mountain', value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
  { id: 'ocean', name: 'themes.ocean', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80' },
  { id: 'forest', name: 'themes.forest', value: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80' },
  { id: 'city', name: 'themes.city', value: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80' },
  { id: 'aurora', name: 'themes.aurora', value: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80' },
];

// 渐变预设背景
const gradientPresets = [
  { id: 'gradient1', name: 'themes.auroraPurple', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', name: 'themes.gradientBlue', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'gradient3', name: 'themes.gradientOrange', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 'gradient4', name: 'themes.gradientGreen', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'gradient5', name: 'themes.gradientBlack', value: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)' },
];

const iconColorOptions = [
  { id: 'colored', name: 'themes.coloredIcon', icon: '🎨' },
  { id: 'white', name: 'themes.whiteIcon', icon: '⚪' },
  { id: 'black', name: 'themes.blackIcon', icon: '⚫' },
] as const;

// ============================================================================
// 工具函数
// ============================================================================

function formatMtime(sec: number): string {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// 主题色 id → 展示用 HSL（与 themeColors 的色板一致）
const COLOR_HSL: Record<string, string> = Object.fromEntries(themeColors.map((c) => [c.id, c.color]));

function colorHslOf(color?: string): string {
  return (color && COLOR_HSL[color]) || 'hsl(240 5% 55%)';
}

// 预设背景预览：优先真实背景图/渐变，否则用「主题色 → 模式底色」的渐变占位
function PresetPreview({ config }: { config?: ThemeConfig }) {
  const colorHsl = colorHslOf(config?.color);
  const modeBg = config?.mode === 'light' ? 'hsl(0 0% 100%)' : 'hsl(240 10% 8%)';
  const themedGradient = `linear-gradient(135deg, ${colorHsl} 0%, ${modeBg} 100%)`;
  const bg = config?.background_image ?? null;
  const isGradient = !!bg && bg.startsWith('linear-gradient');
  const isImage = !!bg && !isGradient;

  return (
    <div className="absolute inset-0" style={{ background: isGradient ? (bg as string) : themedGradient }}>
      {isImage && (
        <img
          src={bg as string}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 复用：可选项瓷砖（颜色模式 / 风格 / 预设 / 图标色）
// 使用原生 <button>：图标会通过 CSS `inherit` 跟随文字色，避免被 icon-color 主题覆盖。
// ============================================================================

interface SelectTileProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function SelectTile({ active, onClick, icon, label }: SelectTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-1 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border p-4 min-h-[88px] transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
          : 'border-border/60 text-foreground hover:border-primary/50 hover:bg-primary/5'
      )}
    >
      {active && <Check className="absolute right-2 top-2 w-4 h-4 text-primary" />}
      <span className="flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6">{icon}</span>
      <span className="text-sm font-medium truncate max-w-full">{label}</span>
    </button>
  );
}

// 背景缩略图选择按钮
interface BgThumbProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function BgThumb({ active, onClick, label, children }: BgThumbProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative aspect-video w-full rounded-lg overflow-hidden transition-all hover:scale-[1.03]',
        active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-1 ring-border/70'
      )}
    >
      {children}
      {active && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
          <Check className="w-5 h-5 text-primary-foreground drop-shadow" />
        </div>
      )}
      <span className="absolute top-1 right-1 max-w-[85%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium leading-tight backdrop-blur-sm">
        {label}
      </span>
    </button>
  );
}

// ============================================================================
// 页面组件
// ============================================================================

type ThemeTab = 'appearance' | 'background' | 'presets' | 'misc';

export default function ThemesPage() {
  const { t } = useLanguage();
  const {
    mode, style, color, backgroundImage, blurIntensity, cardOpacity,
    iconColor, themePreset, sidebarLayout, borderRadius, uiScale, sidebarDefaultCollapsed,
    setMode, setStyle, setColor, setBackgroundImage, setBlurIntensity, setCardOpacity,
    setIconColor, setThemePreset, setSidebarLayout, setBorderRadius, setUiScale,
    setSidebarDefaultCollapsed, getThemeConfig, applyThemeConfig,
  } = useTheme();

  const [tab, setTab] = useState<ThemeTab>('appearance');
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- 预设状态 ----
  const [presets, setPresets] = useState<ThemePresetItem[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [applyingName, setApplyingName] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ThemePresetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const trimmedName = presetName.trim();
  const nameExists = useMemo(
    () => presets.some((p) => p.name === trimmedName),
    [presets, trimmedName]
  );

  const loadPresets = useCallback(async () => {
    setPresetsLoading(true);
    setPresetsError(null);
    try {
      const res = await themeApi.getPresets();
      if (res.status === 0 && res.data) {
        setPresets(res.data.presets || []);
      } else {
        setPresetsError(getApiErrorMessage(res, t('themes.loadPresetsFailed')));
      }
    } catch (e) {
      setPresetsError(getApiErrorMessage(e, t('themes.loadPresetsFailed')));
    } finally {
      setPresetsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // ---- 背景处理 ----
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('themes.selectImageFile'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('themes.imageSizeLimit'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleSelectBackground(dataUrl);
      toast.success(t('themes.bgUploaded'));
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUrl = () => {
    if (!customUrl.trim()) {
      toast.error(t('themes.enterImageLink'));
      return;
    }
    handleSelectBackground(customUrl.trim());
    setCustomUrl('');
    toast.success(t('themes.bgApplied'));
  };

  const clearBackground = () => {
    setBackgroundImage(null, true);
    toast.success(t('themes.bgCleared'));
  };

  // 选择背景时自动切换到毛玻璃风格
  const handleSelectBackground = (value: string | null) => {
    setBackgroundImage(value, true);
    if (value && style !== 'glassmorphism') {
      setStyle('glassmorphism', true);
      toast.success(t('themes.autoSwitchGlass'));
    }
  };

  const allPresetValues = [...imagePresets.map((p) => p.value), ...gradientPresets.map((p) => p.value), ...animeBgPresets.map((p) => p.value)];
  const isCustomImage = backgroundImage && !allPresetValues.includes(backgroundImage);

  // ---- 预设操作 ----
  const handleSavePreset = async () => {
    if (!trimmedName) {
      toast.error(t('themes.presetNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await themeApi.savePreset({
        name: trimmedName,
        overwrite: nameExists,
        config: getThemeConfig(),
      });
      if (res.status === 0) {
        toast.success(t('themes.savePresetSuccess'));
        setSaveOpen(false);
        setPresetName('');
        loadPresets();
      } else {
        // 回显后端消息（封套 msg 或 FastAPI detail），而非笼统的兜底文案
        toast.error(getApiErrorMessage(res, t('themes.savePresetFailed')));
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('themes.savePresetFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (preset: ThemePresetItem) => {
    setApplyingName(preset.name);
    try {
      const res = await themeApi.applyPreset(preset.name);
      applyThemeConfig(res.config);
      toast.success(t('themes.applyPresetSuccess'));
      loadPresets();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('themes.applyPresetFailed')));
    } finally {
      setApplyingName(null);
    }
  };

  const confirmDeletePreset = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await themeApi.deletePreset(deleteTarget.name);
      toast.success(t('themes.deletePresetSuccess'));
      setDeleteTarget(null);
      loadPresets();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('themes.deletePresetFailed')));
    } finally {
      setDeleting(false);
    }
  };

  const openSaveDialog = () => {
    setPresetName('');
    setSaveOpen(true);
  };

  const currentColorName = themeColors.find((c) => c.id === color)?.name;

  const tabOptions = [
    { value: 'appearance', label: t('themes.tabAppearance'), icon: <Palette className="w-4 h-4" /> },
    { value: 'background', label: t('themes.tabBackground'), icon: <Image className="w-4 h-4" /> },
    { value: 'presets', label: t('themes.tabPresets'), icon: <Bookmark className="w-4 h-4" /> },
    { value: 'misc', label: t('themes.tabMisc'), icon: <SlidersHorizontal className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="min-w-0">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Palette className="w-8 h-8 shrink-0" />
          {t('themes.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('themes.description')}</p>
      </div>

      {/* 二级切换 + 页面级操作：按钮与 button group 同行平齐（垂直居中） */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabButtonGroup
          options={tabOptions}
          value={tab}
          onValueChange={(v) => setTab(v as ThemeTab)}
        />
        <Button onClick={openSaveDialog} className="gap-2 self-start sm:self-auto shrink-0">
          <Save className="w-4 h-4" />
          {t('themes.saveAsPreset')}
        </Button>
      </div>

      {/* ============================ 外观 Tab ============================ */}
      {tab === 'appearance' && (
        <div className="glass-card-grid grid gap-4 lg:grid-cols-2">
          {/* 颜色模式 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {mode === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                {t('themes.colorMode')}
              </CardTitle>
              <CardDescription>{t('themes.colorModeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <SelectTile active={mode === 'light'} onClick={() => setMode('light', true)} icon={<Sun />} label={t('themes.lightMode')} />
                <SelectTile active={mode === 'dark'} onClick={() => setMode('dark', true)} icon={<Moon />} label={t('themes.darkMode')} />
              </div>
            </CardContent>
          </Card>

          {/* 界面风格 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t('themes.interfaceStyle')}
              </CardTitle>
              <CardDescription>{t('themes.styleDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <SelectTile
                  active={style === 'solid'}
                  onClick={() => setStyle('solid', true)}
                  icon={<span className={cn('block w-6 h-6 rounded-lg', style === 'solid' ? 'bg-primary' : 'bg-foreground/70')} />}
                  label={t('themes.solidStyle')}
                />
                <SelectTile
                  active={style === 'glassmorphism'}
                  onClick={() => setStyle('glassmorphism', true)}
                  icon={<span className="block w-6 h-6 rounded-lg bg-gradient-to-br from-primary/50 to-accent/50 backdrop-blur border border-border/50" />}
                  label={t('themes.glassStyle')}
                />
              </div>
            </CardContent>
          </Card>

          {/* 主题预设风格 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                {t('themes.themePreset')}
              </CardTitle>
              <CardDescription>{t('themes.themePresetDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <SelectTile active={themePreset === 'default'} onClick={() => setThemePreset('default', true)} icon={<Palette />} label={t('themes.defaultStyle')} />
                <SelectTile
                  active={themePreset === 'shadcn'}
                  onClick={() => setThemePreset('shadcn', true)}
                  icon={<span className="block w-6 h-6 rounded border-2 border-current" />}
                  label={t('themes.shadcnStyle')}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {themePreset === 'shadcn' ? t('themes.shadcnStyleDesc') : t('themes.defaultStyleDesc')}
              </p>
            </CardContent>
          </Card>

          {/* 图标颜色 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="w-5 h-5" />
                {t('themes.iconColor')}
              </CardTitle>
              <CardDescription>{t('themes.iconColorDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {iconColorOptions.map((option) => (
                  <SelectTile
                    key={option.id}
                    active={iconColor === option.id}
                    onClick={() => setIconColor(option.id, true)}
                    icon={<span className="text-2xl leading-none">{option.icon}</span>}
                    label={t(option.name)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 主题颜色 */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {t('themes.themeColor')}
              </CardTitle>
              <CardDescription>{t('themes.themeColorDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {themeColors.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setColor(theme.id, true)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <span
                      className={cn(
                        'relative h-10 w-full rounded-lg transition-all group-hover:scale-105',
                        color === theme.id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                      )}
                      style={{ backgroundColor: theme.color }}
                    >
                      {color === theme.id && (
                        <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                      )}
                    </span>
                    <span className={cn('text-xs', color === theme.id ? 'text-primary font-medium' : 'text-muted-foreground')}>
                      {t(theme.name)}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 卡片透明度 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplet className="w-5 h-5" />
                {t('themes.cardOpacity')}
              </CardTitle>
              <CardDescription>{t('themes.cardOpacityDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('themes.cardOpacityValue')}</span>
                  <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{cardOpacity}%</span>
                </div>
                <Slider
                  value={[cardOpacity]}
                  onValueChange={(value) => setCardOpacity(value[0])}
                  onValueCommit={(value) => setCardOpacity(value[0], true)}
                  min={0}
                  max={100}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('themes.transparent')}</span>
                  <span>{t('themes.standardOpacity')}</span>
                  <span>{t('themes.opaque')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[{ v: 15, l: 'themes.slight' }, { v: 50, l: 'themes.standard' }, { v: 85, l: 'themes.strong' }].map((p) => (
                  <Button
                    key={p.v}
                    variant="outline"
                    size="sm"
                    className={cn('h-8', cardOpacity === p.v && 'border-primary text-primary')}
                    onClick={() => setCardOpacity(p.v, true)}
                  >
                    {t(p.l)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 毛玻璃强度（仅毛玻璃风格） */}
          {style === 'glassmorphism' && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Blend className="w-5 h-5" />
                  {t('themes.glassIntensity')}
                </CardTitle>
                <CardDescription>{t('themes.glassIntensityDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t('themes.blurIntensity')}</span>
                    <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{blurIntensity}px</span>
                  </div>
                  <Slider
                    value={[blurIntensity]}
                    onValueChange={(value) => setBlurIntensity(value[0])}
                    onValueCommit={(value) => setBlurIntensity(value[0], true)}
                    min={0}
                    max={24}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('themes.clear')}</span>
                    <span>{t('themes.moderate')}</span>
                    <span>{t('themes.blurry')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[{ v: 4, l: 'themes.slight' }, { v: 12, l: 'themes.standard' }, { v: 20, l: 'themes.strong' }].map((p) => (
                    <Button
                      key={p.v}
                      variant="outline"
                      size="sm"
                      className={cn('h-8', blurIntensity === p.v && 'border-primary text-primary')}
                      onClick={() => setBlurIntensity(p.v, true)}
                    >
                      {t(p.l)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============================ 背景 Tab ============================ */}
      {tab === 'background' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              {t('themes.bgSettings')}
            </CardTitle>
            <CardDescription>{t('themes.bgSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 无背景 / 默认 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">{t('themes.default')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                <BgThumb active={backgroundImage === null} onClick={() => handleSelectBackground(null)} label={t('themes.noBg')}>
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted/40" />
                </BgThumb>
              </div>
            </div>

            {/* 二次元背景 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">{t('themes.animeBg')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {animeBgPresets.map((bg) => (
                  <BgThumb key={bg.id} active={backgroundImage === bg.value} onClick={() => handleSelectBackground(bg.value)} label={t(bg.name)}>
                    <img src={bg.value} alt={t(bg.name)} className="w-full h-full object-cover" loading="lazy" />
                  </BgThumb>
                ))}
              </div>
            </div>

            {/* 图片背景 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">{t('themes.imageBg')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {imagePresets.map((bg) => (
                  <BgThumb key={bg.id} active={backgroundImage === bg.value} onClick={() => handleSelectBackground(bg.value)} label={t(bg.name)}>
                    <img src={bg.value} alt={t(bg.name)} className="w-full h-full object-cover" loading="lazy" />
                  </BgThumb>
                ))}
              </div>
            </div>

            {/* 渐变背景 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">{t('themes.gradientBg')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {gradientPresets.map((bg) => (
                  <BgThumb key={bg.id} active={backgroundImage === bg.value} onClick={() => handleSelectBackground(bg.value)} label={t(bg.name)}>
                    <div className="w-full h-full" style={{ background: bg.value }} />
                  </BgThumb>
                ))}
              </div>
            </div>

            {/* 自定义背景 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">{t('themes.customBg')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" className="h-9 sm:flex-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  {t('themes.uploadImage')}
                </Button>
                <div className="flex gap-2 sm:flex-[2]">
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCustomUrl(); }}
                    placeholder={t('themes.imageLink')}
                    className="h-9 flex-1"
                  />
                  <Button onClick={handleCustomUrl} size="icon" variant="outline" className="h-9 w-9 shrink-0">
                    <Link className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isCustomImage && (
                <div className="relative rounded-lg overflow-hidden aspect-video max-w-md">
                  {backgroundImage.startsWith('data:') || backgroundImage.startsWith('http') ? (
                    <img src={backgroundImage} alt={t('themes.currentBg')} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ background: backgroundImage }} />
                  )}
                  <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7" onClick={clearBackground}>
                    <X className="w-4 h-4" />
                  </Button>
                  <span className="absolute bottom-1 left-1 text-xs bg-background/80 px-2 py-0.5 rounded">{t('themes.currentBg')}</span>
                </div>
              )}
            </div>

            {style !== 'glassmorphism' && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/50 pl-2">{t('themes.tip')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================ 杂项 Tab ============================ */}
      {tab === 'misc' && (
        <div className="glass-card-grid grid gap-4 lg:grid-cols-2">
          {/* 侧边栏布局 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PanelLeft className="w-5 h-5" />
                {t('themes.sidebarLayout')}
              </CardTitle>
              <CardDescription>{t('themes.sidebarLayoutDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <SelectTile
                  active={sidebarLayout === 'floating'}
                  onClick={() => setSidebarLayout('floating', true)}
                  icon={<SquareStack />}
                  label={t('themes.sidebarFloating')}
                />
                <SelectTile
                  active={sidebarLayout === 'docked'}
                  onClick={() => setSidebarLayout('docked', true)}
                  icon={<PanelLeft />}
                  label={t('themes.sidebarDocked')}
                />
                <SelectTile
                  active={sidebarLayout === 'line'}
                  onClick={() => setSidebarLayout('line', true)}
                  icon={<SeparatorVertical />}
                  label={t('themes.sidebarLine')}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {sidebarLayout === 'floating'
                  ? t('themes.sidebarFloatingDesc')
                  : sidebarLayout === 'line'
                    ? t('themes.sidebarLineDesc')
                    : t('themes.sidebarDockedDesc')}
              </p>
            </CardContent>
          </Card>

          {/* 侧边栏默认收起 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PanelLeftClose className="w-5 h-5" />
                {t('themes.sidebarDefaultState')}
              </CardTitle>
              <CardDescription>{t('themes.sidebarDefaultStateDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <SelectTile
                  active={!sidebarDefaultCollapsed}
                  onClick={() => setSidebarDefaultCollapsed(false, true)}
                  icon={<PanelLeftOpen />}
                  label={t('themes.sidebarExpanded')}
                />
                <SelectTile
                  active={sidebarDefaultCollapsed}
                  onClick={() => setSidebarDefaultCollapsed(true, true)}
                  icon={<PanelLeftClose />}
                  label={t('themes.sidebarCollapsed')}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {sidebarDefaultCollapsed
                  ? t('themes.sidebarCollapsedDesc')
                  : t('themes.sidebarExpandedDesc')}
              </p>
            </CardContent>
          </Card>

          {/* 圆角强度 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CornerDownRight className="w-5 h-5" />
                {t('themes.borderRadius')}
              </CardTitle>
              <CardDescription>{t('themes.borderRadiusDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('themes.borderRadiusValue')}</span>
                  <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{borderRadius}px</span>
                </div>
                <Slider
                  value={[borderRadius]}
                  onValueChange={(value) => setBorderRadius(value[0])}
                  onValueCommit={(value) => setBorderRadius(value[0], true)}
                  min={0}
                  max={32}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('themes.radiusNone')}</span>
                  <span>{t('themes.radiusMedium')}</span>
                  <span>{t('themes.radiusLarge')}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 0, l: 'themes.radiusNone' },
                  { v: 8, l: 'themes.slight' },
                  { v: 16, l: 'themes.standard' },
                  { v: 24, l: 'themes.radiusDefault' },
                  { v: 32, l: 'themes.radiusLarge' },
                ].map((p) => (
                  <Button
                    key={p.v}
                    variant="outline"
                    size="sm"
                    className={cn('h-8', borderRadius === p.v && 'border-primary text-primary')}
                    onClick={() => setBorderRadius(p.v, true)}
                  >
                    {t(p.l)}
                  </Button>
                ))}
              </div>
              {/* 实时预览块 */}
              <div className="flex items-end gap-3 pt-1">
                {[0.5, 0.75, 1].map((scale) => (
                  <div
                    key={scale}
                    className="bg-primary/15 border border-primary/30 transition-[border-radius]"
                    style={{
                      width: `${2 + scale * 2}rem`,
                      height: `${1.5 + scale}rem`,
                      borderRadius: `calc(var(--radius) * ${scale})`,
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 字体缩放 */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="w-5 h-5" />
                {t('themes.uiScale')}
              </CardTitle>
              <CardDescription>{t('themes.uiScaleDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('themes.uiScaleValue')}</span>
                  <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">{uiScale}%</span>
                </div>
                <Slider
                  value={[uiScale]}
                  onValueChange={(value) => setUiScale(value[0])}
                  onValueCommit={(value) => setUiScale(value[0], true)}
                  min={85}
                  max={120}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>85%</span>
                  <span>100%</span>
                  <span>120%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 90, l: 'themes.scaleSmall' },
                  { v: 100, l: 'themes.scaleDefault' },
                  { v: 110, l: 'themes.scaleLarge' },
                ].map((p) => (
                  <Button
                    key={p.v}
                    variant="outline"
                    size="sm"
                    className={cn('h-8', uiScale === p.v && 'border-primary text-primary')}
                    onClick={() => setUiScale(p.v, true)}
                  >
                    {t(p.l)}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground" style={{ fontSize: '1rem' }}>
                {t('themes.uiScalePreview')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================ 预设 Tab ============================ */}
      {tab === 'presets' && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bookmark className="w-5 h-5" />
                  {t('themes.presets')}
                </CardTitle>
                <CardDescription>{t('themes.presetsDesc')}</CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={loadPresets} disabled={presetsLoading} aria-label={t('themes.refresh')}>
                  <RefreshCw className={cn('w-4 h-4', presetsLoading && 'animate-spin')} />
                </Button>
                <Button size="sm" className="h-9 gap-2" onClick={openSaveDialog}>
                  <Save className="w-4 h-4" />
                  {t('themes.newPreset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {presetsLoading ? (
              <div className="glass-card-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))}
              </div>
            ) : presetsError ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
                <p className="text-muted-foreground">{presetsError}</p>
                <Button variant="outline" size="sm" onClick={loadPresets}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('themes.retry')}
                </Button>
              </div>
            ) : presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">{t('themes.noPresets')}</p>
                <p className="text-sm text-muted-foreground/80 max-w-sm">{t('themes.noPresetsHint')}</p>
                <Button size="sm" className="mt-2 gap-2" onClick={openSaveDialog}>
                  <Save className="w-4 h-4" />
                  {t('themes.saveAsPreset')}
                </Button>
              </div>
            ) : (
              <div className="glass-card-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {presets.map((preset) => (
                  <div
                    key={preset.name}
                    className={cn(
                      'group flex flex-col overflow-hidden rounded-lg border transition-colors',
                      preset.is_active ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/60 hover:border-primary/40'
                    )}
                  >
                    {/* 背景预览 */}
                    <div className="relative h-28 w-full">
                      <PresetPreview config={preset.config} />
                      {/* 顶部右侧徽标 */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {preset.is_active && (
                          <Badge className="border-transparent bg-primary text-primary-foreground hover:bg-primary">{t('themes.activeBadge')}</Badge>
                        )}
                        {!preset.valid && (
                          <Badge variant="destructive" title={t('themes.invalidHint')}>{t('themes.invalidBadge')}</Badge>
                        )}
                      </div>
                    </div>
                    {/* 底部：名称（+ 时间副标题） + 操作 同一行 */}
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border"
                          style={{ background: colorHslOf(preset.config?.color) }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{preset.name}</p>
                          {preset.mtime ? (
                            <p className="truncate text-xs text-muted-foreground leading-tight">{formatMtime(preset.mtime)}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={preset.is_active || !preset.valid || applyingName === preset.name}
                          onClick={() => handleApplyPreset(preset)}
                        >
                          {applyingName === preset.name ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          )}
                          {preset.is_active ? t('themes.applied') : t('themes.apply')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(preset)}
                          aria-label={t('themes.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================ 保存预设弹窗 ============================ */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-primary" />
              {t('themes.saveAsPreset')}
            </DialogTitle>
            <DialogDescription>{t('themes.savePresetDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="preset-name">{t('themes.presetName')}</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && trimmedName && !saving) handleSavePreset(); }}
                placeholder={t('themes.presetNamePlaceholder')}
                autoFocus
              />
              {nameExists ? (
                <p className="text-xs text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('themes.presetExists')}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('themes.presetNameHint')}</p>
              )}
            </div>
            {/* 当前设置摘要 */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t('themes.currentSettings')}</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{mode === 'dark' ? t('themes.darkMode') : t('themes.lightMode')}</Badge>
                <Badge variant="secondary">{style === 'glassmorphism' ? t('themes.glassStyle') : t('themes.solidStyle')}</Badge>
                {currentColorName && <Badge variant="secondary">{t(currentColorName)}</Badge>}
                <Badge variant="secondary">{themePreset === 'shadcn' ? t('themes.shadcnStyle') : t('themes.defaultStyle')}</Badge>
                <Badge variant="secondary">
                  {sidebarLayout === 'floating'
                    ? t('themes.sidebarFloating')
                    : sidebarLayout === 'line'
                      ? t('themes.sidebarLine')
                      : t('themes.sidebarDocked')}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>{t('themes.cancel')}</Button>
            <Button onClick={handleSavePreset} disabled={saving || !trimmedName}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {nameExists ? t('themes.overwriteSave') : t('themes.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================ 删除确认弹窗 ============================ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('themes.deletePresetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('themes.deletePresetConfirm', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('themes.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeletePreset(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {t('themes.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
