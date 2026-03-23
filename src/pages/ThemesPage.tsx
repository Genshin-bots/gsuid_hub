import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sun, Moon, Palette, Image, Sparkles, Check, Upload, Link, X, Blend, Contrast, Paintbrush, Layers } from 'lucide-react';
import { toast } from 'sonner';

const themeColors = [
  { id: 'red', name: 'themes.red', color: 'hsl(0 80% 55%)' },
  { id: 'blue', name: 'themes.blue', color: 'hsl(220 70% 50%)' },
  { id: 'green', name: 'themes.green', color: 'hsl(150 60% 40%)' },
  { id: 'orange', name: 'themes.orange', color: 'hsl(30 90% 50%)' },
  { id: 'pink', name: 'themes.pink', color: 'hsl(330 70% 60%)' },
] as const;

// 二次元背景预设 - 萌妹子
const animeBgPresets = [
  { id: 'anime3', name: 'themes.animeStreet', value: 'https://cdn.pixabay.com/photo/2024/05/26/15/27/anime-8788959_1280.jpg' },
  { id: 'anime4', name: 'themes.animeRail', value: 'https://files.seeusercontent.com/2026/03/13/5nQg/gg.jpg' },
  { id: 'anime5', name: 'themes.randomWife', value: 'https://api.paugram.com/wallpaper' },
  { id: 'anime6', name: 'themes.ruinsGirl', value: 'https://files.seeusercontent.com/2026/03/13/w5oD/aa.jpg' },
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

// ICON 颜色选项
const iconColorOptions = [
  { id: 'colored', name: 'themes.coloredIcon', icon: '🎨' },
  { id: 'white', name: 'themes.whiteIcon', icon: '⚪' },
  { id: 'black', name: 'themes.blackIcon', icon: '⚫' },
] as const;

export default function ThemesPage() {
  const { t } = useLanguage();
  const {
    mode, style, color, backgroundImage, blurIntensity,
    iconColor, themePreset,
    setMode, setStyle, setColor, setBackgroundImage, setBlurIntensity,
    setIconColor, setThemePreset, saveToBackend
  } = useTheme();
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setBackgroundImage(dataUrl);
      toast.success(t('themes.bgUploaded'));
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUrl = () => {
    if (!customUrl.trim()) {
      toast.error(t('themes.enterImageLink'));
      return;
    }
    setBackgroundImage(customUrl);
    setCustomUrl('');
    toast.success(t('themes.bgApplied'));
  };

  const clearBackground = () => {
    setBackgroundImage(null);
    toast.success(t('themes.bgCleared'));
  };

  // 选择背景时自动切换到毛玻璃风格
  const handleSelectBackground = (value: string | null) => {
    setBackgroundImage(value);
    if (value && style !== 'glassmorphism') {
      setStyle('glassmorphism');
      toast.success(t('themes.autoSwitchGlass'));
    }
  };

  const isGradient = (value: string | null) => value?.startsWith('linear-gradient');
  const allPresetValues = [...imagePresets.map(p => p.value), ...gradientPresets.map(p => p.value)];
  const isCustomImage = backgroundImage && !allPresetValues.includes(backgroundImage);

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Palette className="w-8 h-8" />
          {t('themes.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('themes.description')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Color Mode */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mode === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              {t('themes.colorMode')}
            </CardTitle>
            <CardDescription>{t('themes.colorModeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={mode === 'light' ? 'default' : 'outline'}
                className="flex-1 h-20 flex-col gap-2"
                onClick={() => setMode('light', true)}
              >
                <Sun className="w-6 h-6" />
                {t('themes.lightMode')}
              </Button>
              <Button
                variant={mode === 'dark' ? 'default' : 'outline'}
                className="flex-1 h-20 flex-col gap-2"
                onClick={() => setMode('dark', true)}
              >
                <Moon className="w-6 h-6" />
                {t('themes.darkMode')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Style */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('themes.interfaceStyle')}
            </CardTitle>
            <CardDescription>{t('themes.styleDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={style === 'solid' ? 'default' : 'outline'}
                className="flex-1 h-20 flex-col gap-2"
                onClick={() => setStyle('solid', true)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary" />
                {t('themes.solidStyle')}
              </Button>
              <Button
                variant={style === 'glassmorphism' ? 'default' : 'outline'}
                className="flex-1 h-20 flex-col gap-2"
                onClick={() => setStyle('glassmorphism', true)}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/50 to-accent/50 backdrop-blur border border-border/50" />
                {t('themes.glassStyle')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Theme Colors */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              {t('themes.themeColor')}
            </CardTitle>
            <CardDescription>{t('themes.themeColorDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {themeColors.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setColor(theme.id, true)}
                  className={`relative aspect-square rounded-xl transition-all hover:scale-105 ${
                    color === theme.id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                  }`}
                  style={{ backgroundColor: theme.color }}
                >
                  {color === theme.id && (
                    <Check className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {themeColors.map((theme) => (
                <span
                  key={theme.id}
                  className={`text-xs px-2 py-1 rounded-full ${
                    color === theme.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {t(theme.name)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Theme Preset (Shadcn) */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              {t('themes.themePreset')}
            </CardTitle>
            <CardDescription>{t('themes.themePresetDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={themePreset === 'default' ? 'default' : 'outline'}
                className="flex-1 h-20 flex-col gap-2"
                onClick={() => setThemePreset('default', true)}
              >
                <Palette className="w-6 h-6" />
                {t('themes.defaultStyle')}
              </Button>
              <Button
                variant={themePreset === 'shadcn' ? 'default' : 'outline'}
                className="flex-1 h-20 flex-col gap-2"
                onClick={() => setThemePreset('shadcn', true)}
              >
                <div className="w-6 h-6 rounded border-2 border-current" />
                {t('themes.shadcnStyle')}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {themePreset === 'shadcn' ? t('themes.shadcnStyleDesc') : t('themes.defaultStyleDesc')}
            </p>
          </CardContent>
        </Card>

        {/* Icon Color */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paintbrush className="w-5 h-5" />
              {t('themes.iconColor')}
            </CardTitle>
            <CardDescription>{t('themes.iconColorDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {iconColorOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={iconColor === option.id ? 'default' : 'outline'}
                  className="flex-1 h-20 flex-col gap-2"
                  onClick={() => {
                    setIconColor(option.id, true);
                  }}
                >
                  <span className="text-2xl">{option.icon}</span>
                  {t(option.name)}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {iconColor === 'colored' ? t('themes.colored') :
               iconColor === 'white' ? t('themes.whiteIcon') :
               t('themes.blackIcon')}
            </p>
          </CardContent>
        </Card>

        {/* Blur Intensity - Only show when glassmorphism is active */}
        {style === 'glassmorphism' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Blend className="w-5 h-5" />
                {t('themes.glassIntensity')}
              </CardTitle>
              <CardDescription>{t('themes.glassIntensityDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('themes.blurIntensity')}</span>
                  <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {blurIntensity}px
                  </span>
                </div>
                <Slider
                  value={[blurIntensity]}
                  onValueChange={(value) => setBlurIntensity(value[0])}
                  min={0}
                  max={24}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('themes.clear')}</span>
                  <span>{t('themes.moderate')}</span>
                  <span>{t('themes.blurry')}</span>
                </div>
              </div>
              
              {/* Quick presets */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBlurIntensity(4)}
                  className={blurIntensity === 4 ? 'border-primary' : ''}
                >
                  {t('themes.slight')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBlurIntensity(12)}
                  className={blurIntensity === 12 ? 'border-primary' : ''}
                >
                  {t('themes.standard')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBlurIntensity(20)}
                  className={blurIntensity === 20 ? 'border-primary' : ''}
                >
                  {t('themes.strong')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Background Settings */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              {t('themes.bgSettings')}
            </CardTitle>
            <CardDescription>{t('themes.bgSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* No Background Option */}
            <div>
              <Label className="text-sm mb-2 block">{t('themes.default')}</Label>
              <button
                onClick={() => handleSelectBackground(null)}
                className={`relative aspect-video w-24 rounded-lg overflow-hidden transition-all hover:scale-105 ${
                  backgroundImage === null ? 'ring-2 ring-primary' : 'ring-1 ring-border'
                }`}
              >
                <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">{t('themes.noBg')}</span>
                </div>
                {backgroundImage === null && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary-foreground drop-shadow" />
                  </div>
                )}
              </button>
            </div>

            {/* ACGN Background Presets */}
            <div>
              <Label className="text-sm mb-2 block">{t('themes.animeBg')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {animeBgPresets.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => {
                      handleSelectBackground(bg.value);
                    }}
                    className={`relative aspect-video rounded-lg overflow-hidden transition-all hover:scale-105 ${
                      backgroundImage === bg.value ? 'ring-2 ring-primary' : 'ring-1 ring-border'
                    }`}
                  >
                    <img
                      src={bg.value}
                      alt={t(bg.name)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {backgroundImage === bg.value && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-primary-foreground drop-shadow" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 px-1 rounded">
                      {t(bg.name)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Preset Backgrounds */}
            <div>
              <Label className="text-sm mb-2 block">{t('themes.imageBg')}</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {imagePresets.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => handleSelectBackground(bg.value)}
                    className={`relative aspect-video rounded-lg overflow-hidden transition-all hover:scale-105 ${
                      backgroundImage === bg.value ? 'ring-2 ring-primary' : 'ring-1 ring-border'
                    }`}
                  >
                    <img
                      src={bg.value}
                      alt={t(bg.name)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {backgroundImage === bg.value && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-primary-foreground drop-shadow" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 px-1 rounded">
                      {t(bg.name)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gradient Preset Backgrounds */}
            <div>
              <Label className="text-sm mb-2 block">{t('themes.gradientBg')}</Label>
              <div className="grid grid-cols-5 gap-3">
                {gradientPresets.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => handleSelectBackground(bg.value)}
                    className={`relative aspect-square rounded-lg overflow-hidden transition-all hover:scale-105 ${
                      backgroundImage === bg.value ? 'ring-2 ring-primary' : 'ring-1 ring-border'
                    }`}
                  >
                    <div 
                      className="w-full h-full"
                      style={{ background: bg.value }}
                    />
                    {backgroundImage === bg.value && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-primary-foreground drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {gradientPresets.map((bg) => (
                  <span
                    key={bg.id}
                    className={`text-xs px-2 py-1 rounded-full ${
                      backgroundImage === bg.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {t(bg.name)}
                  </span>
                ))}
              </div>
            </div>

            {/* Custom Upload */}
            <div className="space-y-3">
              <Label className="text-sm">{t('themes.customBg')}</Label>
               
              {/* File Upload */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {t('themes.uploadImage')}
                </Button>
              </div>

              {/* URL Input */}
              <div className="flex gap-2">
                <Input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder={t('themes.imageLink')}
                  className="flex-1"
                />
                <Button onClick={handleCustomUrl} size="icon" variant="outline">
                  <Link className="w-4 h-4" />
                </Button>
              </div>

              {/* Current Custom Background Preview */}
              {isCustomImage && (
                <div className="relative rounded-lg overflow-hidden aspect-video">
                  {backgroundImage.startsWith('data:') || backgroundImage.startsWith('http') ? (
                    <img
                      src={backgroundImage}
                      alt={t('themes.currentBg')}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: backgroundImage }}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={clearBackground}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <span className="absolute bottom-1 left-1 text-xs bg-background/80 px-2 py-0.5 rounded">
                    {t('themes.customBg')}
                  </span>
                </div>
              )}
            </div>

            {style !== 'glassmorphism' && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/50 pl-2">
                {t('themes.tip')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t('themes.preview')}</CardTitle>
          <CardDescription>{t('themes.previewDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg bg-primary text-primary-foreground">
              {t('themes.primaryColor')}
            </div>
            <div className="p-4 rounded-lg bg-secondary text-secondary-foreground">
              {t('themes.secondaryColor')}
            </div>
            <div className="p-4 rounded-lg bg-accent text-accent-foreground">
              {t('themes.accentColor')}
            </div>
            <div className="p-4 rounded-lg bg-muted text-muted-foreground">
              {t('themes.mutedColor')}
            </div>
            <div className="p-4 rounded-lg bg-card text-card-foreground border">
              {t('themes.cardColor')}
            </div>
            <div className="p-4 rounded-lg bg-destructive text-destructive-foreground">
              {t('themes.destructiveColor')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
