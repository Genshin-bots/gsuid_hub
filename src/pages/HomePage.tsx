import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Bot,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  GitBranch,
  GitCommit,
  Github,
  LayoutDashboard,
  Loader2,
  Monitor,
  Plug,
  RefreshCw,
  Server,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { versionApi, VersionInfo, ActiveBotsInfo } from '@/lib/api';
import {
  SidebarHoverIcon,
  hoverIconGroupClass,
} from '@/components/layout/SidebarHoverIcon';

const frontendVersion = PACKAGE_VERSION || '0.1.2';

// Build HomePage card classes that follow the global theme:
// - `glass-card` (theme system: opacity + blur intensity, dark/light)
// - `backdrop-blur-2xl` is provided by `glass-card` in glassmorphism mode and removed in solid mode
const buildGlassCardClass = (extra = '') =>
  /* 勿在 glass-card 上写 overflow-hidden：会裁切圆角阴影 */
  `glass-card relative ${extra}`.trim();

const buildSubtlePanelClass = (extra = '') =>
  `glass-card-flat min-w-0 rounded-2xl p-3.5 transition-colors hover:!bg-white/15 dark:hover:!bg-white/[0.07] ${extra}`.trim();
const titleIconClass = 'h-5 w-5 shrink-0 text-primary';

function getGreetingKey(hour: number) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 24) return 'night';
  return 'lateNight';
}

function InfoItem({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value?: string | number | null;
  icon?: ElementType;
  className?: string;
}) {
  return (
    <div className={cn(buildSubtlePanelClass(), className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-foreground" title={String(value || '-')}>{value || '-'}</div>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { style, blurIntensity, cardOpacity } = useTheme();

  // HomePage cards follow the global theme system (opacity + blur intensity).
  // `glass-card` CSS class handles opacity via --card-opacity and applies backdrop-filter
  // in glassmorphism mode (and removes it in solid mode). The inline style ensures
  // the dynamic --blur-intensity from theme settings is honored.
  const glassCardClass = buildGlassCardClass();

  // Inline style for the main hero section that has its own custom background layers.
  const heroStyle = {
    ['--card-opacity' as string]: style === 'solid' ? 1 : (cardOpacity / 100).toString(),
    ['--blur-intensity' as string]: `${blurIntensity}px`,
  } as React.CSSProperties;
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [botsInfo, setBotsInfo] = useState<ActiveBotsInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const key = getGreetingKey(new Date().getHours());
    return t(`home.greeting.${key}`);
  }, [t]);

  const displayName = user?.name?.trim() || 'User';
  const isAdmin = user?.role === 'admin';

  const loadHomeData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [versionData, botsData] = await Promise.all([
        versionApi.getVersion(),
        versionApi.getBots(),
      ]);
      setVersionInfo(versionData);
      setBotsInfo(botsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('home.loadVersionFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const quickNavItems = [
    ...(isAdmin
      ? [
          { label: t('home.goToPlugins'), description: t('home.goToPluginsDesc'), href: '/plugins', icon: Plug },
          { label: t('home.goToFrameworkConfig'), description: t('home.goToFrameworkConfigDesc'), href: '/framework-config', icon: Cpu },
          { label: t('home.goToDatabase'), description: t('home.goToDatabaseDesc'), href: '/database', icon: Database },
        ]
      : []),
    { label: t('home.goToGitUpdate'), description: t('home.goToGitUpdateDesc'), href: '/git-update', icon: GitBranch },
    { label: t('home.goToDashboard'), description: t('home.goToDashboardDesc'), href: '/dashboard', icon: LayoutDashboard },
    { label: t('home.goToConsole'), description: t('home.goToConsoleDesc'), href: '/console', icon: Terminal },
  ];

  const projectLinks = [
    { label: t('home.frontendProject'), href: 'https://github.com/Genshin-bots/gsuid_hub' },
    { label: t('home.backendProject'), href: 'https://github.com/Genshin-bots/gsuid_core/' },
  ];

  const connectedBotCount = botsInfo?.bots.filter((bot) => bot.connected).length ?? 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
      <section className={cn(glassCardClass, 'rounded-3xl p-5 sm:p-7 lg:p-8')} style={heroStyle}>
        {/* 装饰层单独裁剪，不写在 glass-card 宿主上，避免裁阴影 / 破坏 absolute */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_34%),linear-gradient(135deg,hsl(var(--background)/0.18),transparent)]" />
        </div>
        <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-xl">
              <Sparkles className="h-4 w-4" />
              <span>GsCore Hub</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t('home.greetingWithName', { greeting, name: displayName })}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t('home.welcomeMessage').split('GsCore').map((part, index, parts) => (
                <span key={index}>
                  {part}
                  {index < parts.length - 1 && <strong className="font-bold text-foreground">GsCore</strong>}
                </span>
              ))}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className="gap-1.5 rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/15" variant="outline">
                <Code2 className="h-3.5 w-3.5" />
                {t('home.frontendVersion')} v{frontendVersion}
              </Badge>
              <Badge className="gap-1.5 rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/15" variant="outline">
                <Server className="h-3.5 w-3.5" />
                {t('home.backendVersion')} v{versionInfo?.version || '-'}
              </Badge>
              <Badge className="gap-1.5 rounded-full border-border/50 bg-background/20 px-3 py-1 text-sm text-muted-foreground backdrop-blur-xl" variant="outline">
                <GitCommit className="h-3.5 w-3.5" />
                {t('home.commitHash')} {versionInfo?.commit || '-'}
              </Badge>
            </div>
          </div>

          <div className={cn('glass-card-flat rounded-3xl p-4 sm:p-5')} style={heroStyle}>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-40 bg-white/15" />
                <Skeleton className="h-10 w-full bg-white/15" />
                <Skeleton className="h-10 w-full bg-white/15" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t('home.loadingVersion')}
                </div>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <div className="text-sm font-medium text-destructive">{t('home.loadVersionFailed')}</div>
                <div className="break-all text-xs text-muted-foreground">{error}</div>
                <Button size="sm" onClick={loadHomeData} className="gap-2 rounded-xl">
                  <RefreshCw className="h-4 w-4" />
                  {t('home.retry')}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={Server} label={t('home.backendVersion')} value={`v${versionInfo?.version || '-'}`} />
                <InfoItem icon={Code2} label={t('home.pythonVersion')} value={versionInfo?.python.version} />
                <InfoItem icon={Monitor} label={t('home.os')} value={`${versionInfo?.platform.system || '-'} ${versionInfo?.platform.release || ''}`} />
                <InfoItem icon={Activity} label={t('home.pid')} value={versionInfo?.pid} />
              </div>
            )}
          </div>
        </div>
      </section>

      <Card className={cn(glassCardClass, 'rounded-3xl')}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Bot className={titleIconClass} />
            {t('home.quickNav')}
          </CardTitle>
        </CardHeader>
        <CardContent className="glass-card-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickNavItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                hoverIconGroupClass,
                'glass-card-flat relative flex min-h-24 items-center gap-3 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 hover:!border-primary/55 hover:!bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 dark:hover:!bg-primary/10',
                'border border-border/70',
              )}
            >
              <SidebarHoverIcon
                icon={item.icon}
                className="h-5 w-5 shrink-0 self-center text-primary"
              />
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 self-center">
                <span className="block text-sm font-semibold leading-snug text-foreground">{item.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{item.description}</span>
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className={cn(glassCardClass, 'rounded-3xl')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Monitor className={titleIconClass} />
              {t('home.systemInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <InfoItem label={t('home.os')} value={`${versionInfo?.platform.system || '-'} ${versionInfo?.platform.release || ''}`} />
            <InfoItem label={t('home.architecture')} value={versionInfo?.platform.machine} />
            <InfoItem className="sm:col-span-2" label={t('home.processor')} value={versionInfo?.platform.processor} />
            <InfoItem className="sm:col-span-2" label={t('home.executable')} value={versionInfo?.executable} />
          </CardContent>
        </Card>

        <Card className={cn(glassCardClass, 'rounded-3xl')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Activity className={titleIconClass} />
              {t('home.runtimeInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <InfoItem label={t('home.pythonVersion')} value={versionInfo?.python.version} />
            <InfoItem label={t('home.pythonImpl')} value={versionInfo?.python.implementation} />
            <InfoItem label={t('home.compiler')} value={versionInfo?.python.compiler} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className={cn(glassCardClass, 'rounded-3xl')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Database className={titleIconClass} />
              {t('home.dependencies')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
            {Object.entries(versionInfo?.dependencies || {}).map(([name, version]) => (
              <InfoItem key={name} label={name} value={version} />
            ))}
            {!versionInfo?.dependencies && <InfoItem label={t('common.status')} value="-" />}
          </CardContent>
        </Card>

        <Card className={cn(glassCardClass, 'rounded-3xl')}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Bot className={titleIconClass} />
                {t('home.activeBots')}
              </CardTitle>
              <Badge className="shrink-0 gap-1.5 rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/15" variant="outline">
                {botsInfo?.count ?? 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label={t('home.botCount')} value={botsInfo?.count ?? 0} />
              <InfoItem label={t('home.connectedBots')} value={connectedBotCount} />
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 rounded-2xl bg-white/15" />
                <Skeleton className="h-12 rounded-2xl bg-white/15" />
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {t('home.loadBotsFailed')}
              </div>
            ) : botsInfo?.bots.length ? (
              <div className="space-y-2">
                {botsInfo.bots.map((bot) => (
                  <div key={bot.ws_bot_id} className={cn('glass-card-flat flex items-center justify-between gap-3 rounded-2xl p-3')}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground" title={bot.name}>{bot.name}</div>
                      <div className="truncate text-xs text-muted-foreground" title={bot.bot_id}>{bot.bot_id || '-'}</div>
                    </div>
                    <Badge className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs',
                      bot.connected
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-muted-foreground/25 bg-muted/30 text-muted-foreground'
                    )} variant="outline">
                      {bot.connected ? t('home.connected') : t('home.disconnected')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn('glass-card-flat rounded-2xl p-4 text-center text-sm text-muted-foreground')}>
                {t('home.noActiveBots')}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className={cn(glassCardClass, 'rounded-3xl')}>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {projectLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className={cn('glass-card-flat group flex min-w-0 items-center gap-3 rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:!border-primary/25 hover:!bg-primary/10 dark:hover:!bg-primary/10')}
            >
              <Github className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground">{item.label}</div>
                <div className="truncate text-xs text-muted-foreground" title={item.href}>{item.href}</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
