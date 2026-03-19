import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { User, Lock, Camera, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('common.error'),
        description: t('settings.avatarInvalidType'),
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('common.error'),
        description: t('settings.avatarTooLarge'),
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const result = await authApi.uploadAvatar(file);
      // Refresh user data
      await refreshUser();
      toast({
        title: t('common.success'),
        description: t('settings.avatarUpdated'),
      });
      // Force refresh to get new avatar
      window.location.reload();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('settings.avatarUpdateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateName = async () => {
    if (!name.trim()) {
      toast({
        title: t('common.error'),
        description: t('settings.nameEmpty'),
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingName(true);
    try {
      await authApi.updateName(name);
      // Refresh user data
      await refreshUser();
      toast({
        title: t('common.success'),
        description: t('settings.nameUpdated'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('settings.nameUpdateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.passwordEmpty'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('settings.passwordTooShort'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('login.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authApi.updatePassword(oldPassword, newPassword);
      toast({
        title: t('common.success'),
        description: t('settings.passwordUpdated'),
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('settings.passwordUpdateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('settings.description')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avatar & Name Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              {t('settings.profileInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <Avatar
                  className="w-24 h-24 ring-4 ring-primary/20 cursor-pointer transition-all group-hover:ring-primary/40"
                  onClick={handleAvatarClick}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-primary/20 text-primary text-2xl font-medium">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </Avatar>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <p className="text-sm text-muted-foreground">{t('settings.avatarHint')}</p>
            </div>

            <Separator />

            {/* Name */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('login.name')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('login.namePlaceholder')}
                />
              </div>
              <Button
                onClick={handleUpdateName}
                disabled={isUpdatingName || name === user?.name}
                className="w-full gap-2"
              >
                {isUpdatingName ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {t('common.save')}
              </Button>
            </div>

            <Separator />

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>{t('login.email')}</Label>
              <div className="px-3 py-2 rounded-md bg-muted/50 text-muted-foreground">
                {user?.email}
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.emailReadOnly')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="w-5 h-5 text-primary" />
              {t('settings.changePassword')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">{t('settings.oldPassword')}</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t('settings.oldPasswordPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('login.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('login.confirmPasswordPlaceholder')}
              />
            </div>
            <Button
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword || !oldPassword || !newPassword || !confirmPassword}
              className="w-full gap-2 mt-4"
            >
              {isUpdatingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {t('settings.updatePassword')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
