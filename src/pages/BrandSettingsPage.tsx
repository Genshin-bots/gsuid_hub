/**
 * /brand-settings — 品牌信息编辑页
 *
 * 来源：docs/skills/gshub-development/README.md §3.1「完全空缺」第 1 项
 * 后端对应：brand_api.py (5 endpoints) + assets_api.py
 *
 * 设计：
 * - 标题卡 + 三部分（标题输入、副标题输入、ICON 上传/重置）
 * - "效果预览" 卡片：模拟登录页顶部 brand 区，让用户直观看生效样式
 * - 错误提示统一用 getApiErrorMessage 回显后端 msg/detail（[§01 §1.5](../docs/skills/gshub-development/references/01-architecture-and-conventions.md)）
 */
import { useEffect, useRef, useState } from 'react';
import { ImageIcon, RotateCcw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  brandApi,
  getApiErrorMessage,
  type BrandInfo,
} from '@/lib/api';

export default function BrandSettingsPage() {
  const { t } = useLanguage();
  const { mode } = useTheme();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [info, setInfo] = useState<BrandInfo | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconSource, setIconSource] = useState<'user' | 'default'>('default');
  const [iconVersion, setIconVersion] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await brandApi.getBrand();
      setInfo(data.data);
      setTitle(data.data.title);
      setSubtitle(data.data.subtitle);
      setIconSource(data.data.icon_source);
      if (data.data.icon_url) setIconUrl(data.data.icon_url);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('brandSettings.savedFail')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async () => {
    setSaving(true);
    try {
      const updated = await brandApi.updateBrand({ title, subtitle });
      setInfo((prev) =>
        prev
          ? { ...prev, title: updated.title, subtitle: updated.subtitle }
          : prev,
      );
      toast.success(t('brandSettings.savedSuccess'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('brandSettings.savedFail')));
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onUpload = async (file: File) => {
    try {
      const res = await brandApi.uploadIcon(file);
      setIconUrl(res.icon_url);
      setIconSource(res.icon_source);
      setIconVersion(Date.now());
      toast.success(t('brandSettings.uploadSuccess'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('brandSettings.uploadFail')));
    }
  };

  const onReset = async () => {
    if (!window.confirm(t('brandSettings.resetConfirm'))) return;
    try {
      await brandApi.deleteIcon();
      setIconSource('default');
      setIconVersion(Date.now());
      toast.success(t('brandSettings.deleted'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('brandSettings.savedFail')));
    }
  };

  return (
    <PinnedPage
      className="gap-6"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ImageIcon className="w-8 h-8 shrink-0" />
              {t('brandSettings.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('brandSettings.description')}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              variant="outline"
              className="h-9"
              onClick={onReset}
              disabled={loading || iconSource === 'default'}
            >
              <RotateCcw className="w-4 h-4" />
              {t('brandSettings.resetToDefault')}
            </Button>
            <Button className="h-9" onClick={onSubmit} disabled={saving || loading}>
              <Save className="w-4 h-4" />
              {saving ? '…' : t('brandSettings.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左：表单 */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {t('brandSettings.sectionTitle')}
            </CardTitle>
            <CardDescription>
              {t('brandSettings.sectionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="brand-title">{t('brandSettings.titleLabel')}</Label>
              <Input
                id="brand-title"
                className="h-9"
                value={title}
                placeholder={t('brandSettings.titlePlaceholder') ?? ''}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand-subtitle">
                {t('brandSettings.subtitleLabel')}
              </Label>
              <Input
                id="brand-subtitle"
                className="h-9"
                value={subtitle}
                placeholder={t('brandSettings.subtitlePlaceholder') ?? ''}
                onChange={(e) => setSubtitle(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('brandSettings.iconLabel')}</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-border/40 bg-muted flex items-center justify-center">
                  {iconUrl ? (
                    <img
                      src={
                        iconSource === 'user'
                          ? `${iconUrl}${iconUrl.includes('?') ? '&' : '?'}t=${iconVersion}`
                          : iconUrl
                      }
                      alt="brand"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {iconSource === 'user'
                      ? t('brandSettings.iconSourceUser')
                      : t('brandSettings.iconSourceDefault')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={onPickFile}
                    >
                      <Upload className="w-4 h-4" />
                      {t('brandSettings.uploadNew')}
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 全局错误提示 */}
            {info === null && !loading ? (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(
                  new Error(t('brandSettings.globalErrorFallback')),
                  t('brandSettings.savedFail'),
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* 右：效果预览 */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t('brandSettings.previewTitle')}</CardTitle>
            <CardDescription>
              {t('brandSettings.previewSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3 border border-border/40"
              data-style={mode === 'dark' ? 'glassmorphism' : 'glassmorphism'}
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center">
                {iconUrl ? (
                  <img
                    src={
                      iconSource === 'user'
                        ? `${iconUrl}${iconUrl.includes('?') ? '&' : '?'}t=${iconVersion}`
                        : iconUrl
                    }
                    alt="brand-preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xl font-bold truncate max-w-[220px]">
                  {title || info?.default.title || '…'}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                  {subtitle || info?.default.subtitle || '…'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PinnedPage>
  );
}
