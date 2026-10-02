import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, LogIn, Eye, EyeOff, UserPlus, Settings, ChevronDown, HelpCircle, WifiOff, RefreshCw } from 'lucide-react';
import { LanguageFlag } from '@/components/ui/language-flag';
import { cn } from '@/lib/utils';
import { getCustomApiHost, setCustomApiHost, authApi } from '@/lib/api';
import { isBackendUnreachable } from '@/lib/backendReachability';

/** 后端连通性：探测中 / 可达 / 不可达 */
type BackendState = 'checking' | 'online' | 'offline';


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

  // 后端连通性。与 isCheckingAdmin 分开：后端不可达时无法得知是否已有管理员，
  // 此时不能把 hasAdmin 当成 false，否则会误显示「去注册」。
  const [backendState, setBackendState] = useState<BackendState>('checking');
  // 探测用的时间戳，确保 setCustomApiHost 后能重新探测
  const [probeNonce, setProbeNonce] = useState(0);

  // Custom API Host settings
  const [showSettings, setShowSettings] = useState(false);
  const [customHost, setCustomHost] = useState('');

  const { login, register } = useAuth();
  const { style, backgroundImage, blurIntensity } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const { iconUrl: brandIconUrl, title: brandTitle } = useBrand();
  const navigate = useNavigate();

  // 探测后端可达性 + 是否已存在管理员账号
  useEffect(() => {
    let alive = true;
    setIsCheckingAdmin(true);
    setBackendState('checking');

    const checkAdminExists = async () => {
      try {
        const data = await authApi.checkAdminExists();
        if (!alive) return;
        setHasAdmin(!!data.is_admin_exist);
        setBackendState('online');
      } catch (error) {
        if (!alive) return;
        // 网络层失败 = 后端不可达；后端有应答但报错 = 视为可达，只是查不到
        if (isBackendUnreachable(error)) {
          setBackendState('offline');
        } else {
          console.error('Failed to check admin exists:', error);
          setBackendState('online');
          setHasAdmin(false);
        }
      } finally {
        if (alive) setIsCheckingAdmin(false);
      }
    };
    checkAdminExists();

    return () => {
      alive = false;
    };
  }, [probeNonce]);

  // Load saved custom host on mount
  useEffect(() => {
    // Theme config is automatically loaded by ThemeProvider
    setCustomHost(getCustomApiHost());
  }, []);

  // 后端不可达时自动重试探测：用户在设置里填好地址点「保存」即触发，
  // 也顺带覆盖「后端稍后才启动」的场景。
  const retryProbe = useCallback(() => setProbeNonce((n) => n + 1), []);
  
  // Handle saving custom host
  const handleSaveHost = () => {
    // Add http:// prefix if no protocol is specified
    let host = customHost.trim();
    if (host && !host.startsWith('http://') && !host.startsWith('https://')) {
      host = 'http://' + host;
    }
    setCustomApiHost(host);
    setShowSettings(false);
    setError('');
    // 地址变了，必须重新探测连通性与管理员状态
    retryProbe();
  };

  // Handle clearing custom host
  const handleClearHost = () => {
    setCustomApiHost('');
    setCustomHost('');
    setShowSettings(false);
    setError('');
    retryProbe();
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
      // 提交时才发现连不上（例如后端刚好挂了），切到离线态展示连接提示
      if (result.unreachable) {
        setBackendState('offline');
        setError('');
      } else {
        setError(result.error || (isRegisterMode ? t('login.registerFailed') : t('login.loginFailed')));
      }
    }

    setIsLoading(false);
  };

  const isOffline = backendState === 'offline';

  return (
    <div className={cn(
      // my-auto（而非 items-center）+ overflow-y-auto：注册模式表单高于窄屏时
      // 顶部（连同绝对定位在上方的语言工具条）仍然够得着，不会被裁掉
      "min-h-screen flex justify-center overflow-y-auto p-4",
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
      
      {/* 仅卡片参与垂直居中；工具栏绝对定位在卡片上方，避免把卡片挤离正中 */}
      <div className="my-auto w-full max-w-md relative z-10">
        {/* 与下方登录卡片共用 glass-card / bg-card 材质，形成呼应 */}
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-3",
            "inline-flex items-center h-9 rounded-full",
            isGlassmorphism
              ? "glass-card border-border/50 shadow-2xl"
              : "bg-card border border-border/50 shadow-2xl"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-full items-center gap-1.5 rounded-l-full px-4 text-sm font-medium text-card-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:bg-foreground/[0.06]"
                title={t('common.selectLanguage')}
              >
                {(() => {
                  const currentLanguage = availableLanguages.find((lang) => lang.code === language);
                  return currentLanguage ? <LanguageFlag code={currentLanguage.flagCode} /> : null;
                })()}
                <span className="text-xs font-medium">
                  {availableLanguages.find((lang) => lang.code === language)?.shortName ?? language}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {availableLanguages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={cn(
                    "cursor-pointer gap-2",
                    language === lang.code && "bg-accent"
                  )}
                >
                  <LanguageFlag code={lang.flagCode} />
                  <span>{lang.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px shrink-0 bg-border/50" aria-hidden />

          <button
            type="button"
            className="inline-flex h-full w-9 items-center justify-center rounded-r-full text-card-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:bg-foreground/[0.06]"
            onClick={() => setShowSettings(true)}
            title={t('login.settingsApiHost')}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <Card className={cn(
          "w-full",
          isGlassmorphism ? "glass-card border-border/50 shadow-2xl" : "border-border/50 shadow-2xl"
        )}>
        <CardHeader className="text-center space-y-2">
          <img
            src={brandIconUrl}
            alt={brandTitle}
            width={96}
            height={96}
            fetchPriority="high"
            className="mx-auto w-24 h-24 object-contain mb-4"
            key={brandIconUrl}
          />
          <CardTitle className="text-2xl font-bold">
            {isRegisterMode ? t('login.registerTitle') : t('login.title')}
          </CardTitle>
          <CardDescription>
            {isRegisterMode ? t('login.registerDescription') : t('login.loginDescription')}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 后端不可达：先讲清原因与修复路径，别让用户对着一个注定失败的表单反复试 */}
            {isOffline && (
              <Alert variant="destructive">
                <WifiOff />
                <AlertTitle>{t('login.offlineTitle')}</AlertTitle>
                <AlertDescription>
                  <p>{t('login.offlineDescription')}</p>
                  <p className="mt-2 font-mono text-xs opacity-90">
                    {getCustomApiHost() || window.location.origin}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={retryProbe}
                      disabled={isCheckingAdmin}
                    >
                      <RefreshCw
                        className={cn('mr-1.5 h-3.5 w-3.5', isCheckingAdmin && 'animate-spin')}
                      />
                      {isCheckingAdmin ? t('login.offlineChecking') : t('login.offlineRetry')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSettings(true)}
                    >
                      <Settings className="mr-1.5 h-3.5 w-3.5" />
                      {t('login.offlineChangeHost')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {error && !isOffline && (
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
                  disabled={isOffline}
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
                disabled={isOffline}
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
                  disabled={isOffline}
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
                    disabled={isOffline}
                    className={isGlassmorphism ? "glass-input" : ""}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="registerCode">{t('login.registerCode')}</Label>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href="https://docs.sayu-bot.com/Started/WebConsole.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>{t('login.registerCodeTooltip')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="registerCode"
                    type="text"
                    placeholder={t('login.registerCodePlaceholder')}
                    value={registerCode}
                    onChange={(e) => setRegisterCode(e.target.value)}
                    required
                    disabled={isOffline}
                    className={isGlassmorphism ? "glass-input" : ""}
                  />
                </div>
                
              </>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading || isOffline}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isRegisterMode ? t('login.registering') : t('login.loggingIn')}
                </>
              ) : isOffline ? (
                <>
                  <WifiOff className="mr-2 h-4 w-4" />
                  {t('login.offlineRetry')}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  {isRegisterMode ? t('login.registerButton') : t('login.loginButton')}
                </>
              )}
            </Button>

            {/* Toggle Register/Login - 后端可达且确认没有管理员时才提供注册入口 */}
            {!hasAdmin && !isCheckingAdmin && !isOffline && (
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
      </div>
      
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
