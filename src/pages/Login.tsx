import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, LogIn, Eye, EyeOff, UserPlus, Settings, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCustomApiHost, setCustomApiHost, authApi } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  // 检查是否已存在管理员账号
  const [hasAdmin, setHasAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
    
  // Custom API Host settings
  const [showSettings, setShowSettings] = useState(false);
  const [customHost, setCustomHost] = useState('');
    
  const { login, register } = useAuth();
  const { style, backgroundImage, blurIntensity } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const navigate = useNavigate();

  // Load theme config and custom host on mount
  useEffect(() => {
    // Theme config is automatically loaded by ThemeProvider
    // Load saved custom API host
    setCustomHost(getCustomApiHost());
    
    // 检查是否已存在管理员账号
    const checkAdminExists = async () => {
      try {
        const data = await authApi.checkAdminExists();
        console.log('checkAdminExists data:', data);
        // 后端返回 { status: 0, msg: "查询成功", data: { is_admin_exist: true } }
        // api.get 会自动解析，返回的 data 就是 { is_admin_exist: true }
        setHasAdmin(!!data.is_admin_exist);
      } catch (error) {
        console.error('Failed to check admin exists:', error);
        // 如果请求失败，默认允许显示注册按钮
        setHasAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };
    checkAdminExists();
  }, []);
  
  // Handle saving custom host
  const handleSaveHost = () => {
    // Add http:// prefix if no protocol is specified
    let host = customHost.trim();
    if (host && !host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'http://' + host;
    }
    setCustomApiHost(host);
    setShowSettings(false);
  };
  
  // Handle clearing custom host
  const handleClearHost = () => {
    setCustomApiHost('');
    setCustomHost('');
    setShowSettings(false);
  };

  const isGradient = backgroundImage?.startsWith('linear-gradient');
  const isImage = backgroundImage && !isGradient;
  const isGlassmorphism = style === 'glassmorphism';
  const isSolid = style === 'solid';
  const hasBackground = isGlassmorphism && backgroundImage;
  const hasDefaultGlass = isGlassmorphism && !backgroundImage;
  const hasSolidBackground = isSolid && (backgroundImage || !isGlassmorphism);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    let result;
    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setError(t('login.passwordMismatch'));
        setIsLoading(false);
        return;
      }
      result = await register(name, email, password, registerCode, true);
    } else {
      result = await login(email, password);
    }
    
    if (result.success) {
      navigate('/home');
    } else {
      setError(result.error || (isRegisterMode ? t('login.registerFailed') : t('login.loginFailed')));
    }
    
    setIsLoading(false);
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-4",
      isGlassmorphism ? "relative" : "bg-gradient-to-br from-background via-background to-muted/30"
    )}>
      {/* Background Layer */}
      {hasBackground && (
        <div className="fixed inset-0 z-0">
          {isGradient ? (
            <div 
              className="w-full h-full"
              style={{ background: backgroundImage }}
            />
          ) : (
            <div 
              className="w-full h-full bg-cover bg-center bg-no-repeat bg-fixed"
              style={{ backgroundImage: `url("${backgroundImage}")` }}
            />
          )}
          <div 
            className="absolute inset-0 bg-background/20"
            style={{ 
              backdropFilter: `blur(${Math.max(2, blurIntensity / 4)}px)`,
              WebkitBackdropFilter: `blur(${Math.max(2, blurIntensity / 4)}px)`
            }}
          />
        </div>
      )}
      
      {/* Default Glassmorphism Background */}
      {hasDefaultGlass && (
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      )}

      {/* Solid Style Background */}
      {isSolid && (
        <div className="fixed inset-0 z-0">
          {backgroundImage ? (
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat bg-fixed"
              style={{ backgroundImage: `url("${backgroundImage}")` }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-background via-background to-secondary/30" />
          )}
        </div>
      )}
      
      <Card className={cn(
        "w-full max-w-md relative z-10",
        isGlassmorphism ? "glass-card border-border/50 shadow-2xl" : "border-border/50 shadow-2xl"
      )}>
        {/* Settings Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-20"
          onClick={() => setShowSettings(true)}
          title={t('login.settingsApiHost')}
        >
          <Settings className="h-5 w-5" />
        </Button>

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-14 z-20 gap-1.5 px-2"
              title={t('common.selectLanguage')}
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium">
                {language === 'zh-CN' ? '中' : 'EN'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn(
                  "cursor-pointer",
                  language === lang.code && "bg-accent"
                )}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isRegisterMode ? t('login.registerTitle') : t('login.title')}
          </CardTitle>
          <CardDescription>
            {isRegisterMode ? t('login.registerDescription') : t('login.loginDescription')}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {isRegisterMode && (
              <div className="space-y-2">
                <Label htmlFor="name">{t('login.name')}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={isGlassmorphism ? "glass-input" : ""}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={isGlassmorphism ? "glass-input" : ""}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={cn(
                    isGlassmorphism ? "glass-input pr-10" : "pr-10",
                    "w-full"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {isRegisterMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('login.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={isGlassmorphism ? "glass-input" : ""}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="registerCode">{t('login.registerCode')}</Label>
                  <Input
                    id="registerCode"
                    type="text"
                    placeholder={t('login.registerCodePlaceholder')}
                    value={registerCode}
                    onChange={(e) => setRegisterCode(e.target.value)}
                    required
                    className={isGlassmorphism ? "glass-input" : ""}
                  />
                </div>
                
              </>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isRegisterMode ? t('login.registering') : t('login.loggingIn')}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  {isRegisterMode ? t('login.registerButton') : t('login.loginButton')}
                </>
              )}
            </Button>

            {/* Toggle Register/Login - only show if no admin exists */}
            {!hasAdmin && !isCheckingAdmin && (
              <Button
                type="button"
                variant="ghost"
                className="w-full mt-2"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError('');
                  setConfirmPassword('');
                }}
              >
                {isRegisterMode ? (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('login.alreadyHaveAccount')}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('login.noAccount')}
                  </>
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      
      {/* Settings Dialog for Custom API Host */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('login.settingsTitle')}</DialogTitle>
            <DialogDescription>
              {t('login.settingsDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customHost">{t('login.customHost')}</Label>
              <Input
                id="customHost"
                placeholder={t('login.customHostPlaceholder')}
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
              />
            </div>
            {customHost && (
              <div className="text-sm text-muted-foreground">
                {t('login.willUse')} <span className="font-mono text-foreground">
                  {customHost.startsWith('http://') || customHost.startsWith('https://')
                    ? customHost
                    : `http://${customHost}`}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleClearHost}
              disabled={!customHost}
            >
              {t('common.clear')}
            </Button>
            <Button type="button" onClick={handleSaveHost}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
