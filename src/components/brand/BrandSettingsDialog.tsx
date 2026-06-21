import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Loader2, Upload, RotateCcw, Image as ImageIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useBrand } from '@/contexts/BrandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface BrandSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_ICON_SIZE = 2 * 1024 * 1024; // 2MB

export function BrandSettingsDialog({ open, onOpenChange }: BrandSettingsDialogProps) {
  const { t } = useLanguage();
  const {
    title,
    subtitle,
    iconUrl,
    iconSource,
    default: defaultBrand,
    refresh,
    updateInfo,
    uploadIcon,
    deleteIcon,
  } = useBrand();

  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [isSavingText, setIsSavingText] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 同步外部 title/subtitle 到本地草稿（仅在 dialog 打开时刷新）
  useEffect(() => {
    if (open) {
      setDraftTitle(title);
      setDraftSubtitle(subtitle);
      setError(null);
    }
  }, [open, title, subtitle]);

  const titleChanged = draftTitle !== title;
  const subtitleChanged = draftSubtitle !== subtitle;
  const hasTextChange = titleChanged || subtitleChanged;
  const titleTooLong = draftTitle.length > 64;
  const subtitleTooLong = draftSubtitle.length > 128;

  const handleSaveText = async () => {
    if (titleTooLong || subtitleTooLong) return;
    if (!hasTextChange) return;

    setError(null);
    setIsSavingText(true);
    try {
      await updateInfo({ title: draftTitle, subtitle: draftSubtitle });
      toast.success(t('brand.textUpdated'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('brand.textUpdateFailed');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSavingText(false);
    }
  };

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前端先做基础校验，错误信息更友好
    if (!file.type.startsWith('image/png') && !file.name.toLowerCase().endsWith('.png')) {
      toast.error(t('brand.iconInvalidType'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_ICON_SIZE) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(2);
      toast.error(t('brand.iconTooLarge', { size: sizeMb }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size === 0) {
      toast.error(t('brand.iconEmpty'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setIsUploadingIcon(true);
    try {
      await uploadIcon(file);
      toast.success(t('brand.iconUploaded'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('brand.iconUploadFailed');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetIcon = async () => {
    setShowResetConfirm(false);
    setError(null);
    setIsResetting(true);
    try {
      await deleteIcon();
      toast.success(t('brand.iconReset'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('brand.iconResetFailed');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsResetting(false);
    }
  };

  const handleRestoreAll = async () => {
    setError(null);
    setIsSavingText(true);
    try {
      // 先回退文字到默认值
      await updateInfo({ title: defaultBrand.title, subtitle: defaultBrand.subtitle });
      // 再回退 ICON
      await deleteIcon();
      // 重新拉一次以保证 context 与后端一致
      await refresh();
      toast.success(t('brand.allRestored'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('brand.restoreFailed');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSavingText(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {t('brand.title')}
            </DialogTitle>
            <DialogDescription>{t('brand.description')}</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6 py-2">
            {/* ICON 预览 + 上传 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('brand.icon')}</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden border border-border shrink-0">
                  <img
                    src={iconUrl}
                    alt="brand"
                    className="w-16 h-16 object-contain"
                    key={iconUrl}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {iconSource === 'user' ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('brand.iconCustomized')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {t('brand.iconDefault')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('brand.iconHint')}</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={handleIconChange}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleIconClick}
                  disabled={isUploadingIcon || isResetting}
                  className="gap-1.5"
                >
                  {isUploadingIcon ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {t('brand.uploadIcon')}
                </Button>
                {iconSource === 'user' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isUploadingIcon || isResetting}
                    className="gap-1.5"
                  >
                    {isResetting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    {t('brand.resetIcon')}
                  </Button>
                )}
              </div>
            </div>

            {/* 标题 / 副标题 */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brand-title">{t('brand.titleLabel')}</Label>
                  <span
                    className={cn(
                      'text-xs',
                      titleTooLong ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {draftTitle.length}/64
                  </span>
                </div>
                <Input
                  id="brand-title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  maxLength={80}
                  placeholder={defaultBrand.title}
                  disabled={isSavingText}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brand-subtitle">{t('brand.subtitleLabel')}</Label>
                  <span
                    className={cn(
                      'text-xs',
                      subtitleTooLong ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {draftSubtitle.length}/128
                  </span>
                </div>
                <Input
                  id="brand-subtitle"
                  value={draftSubtitle}
                  onChange={(e) => setDraftSubtitle(e.target.value)}
                  maxLength={160}
                  placeholder={defaultBrand.subtitle}
                  disabled={isSavingText}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestoreAll}
              disabled={isSavingText || isUploadingIcon || isResetting}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              {t('brand.restoreDefaults')}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSaveText}
                disabled={
                  !hasTextChange ||
                  titleTooLong ||
                  subtitleTooLong ||
                  isSavingText ||
                  isUploadingIcon ||
                  isResetting
                }
              >
                {isSavingText && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('brand.resetIconConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('brand.resetIconConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetIcon}>
              {t('brand.resetIcon')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}