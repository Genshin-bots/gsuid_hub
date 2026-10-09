import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AppWindow,
  ArrowUpRight,
  Bot,
  Boxes,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  GitBranch,
  Github,
  GitCommit,
  HardDrive,
  LayoutDashboard,
  Monitor,
  Plug,
  Radio,
  RefreshCw,
  Server,
  Terminal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, versionApi } from '@/lib/api';
import type { VersionInfo, ActiveBotsInfo } from '@/lib/api';
import { SidebarHoverIcon, hoverIconGroupClass } from '@/components/layout/SidebarHoverIcon';

const frontendVersion = PACKAGE_VERSION || '0.3.1';

function getGreetingKey(hour: number) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 24) return 'night';
  return 'lateNight';
}

/* 欢迎语里的 "GsCore" 加粗高亮。三语言文案各只出现一次，用切片避免 key */
function highlightGsCore(text: string) {
  const at = text.indexOf('GsCore');
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-bold text-foreground">GsCore</strong>
      {text.slice(at + 'GsCore'.length)}
    </>
  );
}

/* 问候语拆两段：时段问候弱化成灰色小字，用户名用主题色突出。
 * greetingWithName 是「问候 + 分隔符 + 用户名」，用户名一定在句尾，
 * 所以从问候词长度切分，避免用户名与问候文案重名时切错 */
function highlightGreeting(text: string, greeting: string, name: string) {
  const tail = text.slice(greeting.length);
  const at = tail.lastIndexOf(name);
  const cut = at < 0 ? tail.length : at;
  return (
    <>
      <span className="text-2xl font-bold text-muted-foreground sm:text-3xl">
        {text.slice(0, greeting.length + cut)}
      </span>
      <span className="text-[2.125rem] font-black text-primary sm:text-[2.75rem]">
        {tail.slice(cut)}
      </span>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
 * 状态条：刻意不给卡片。它是仪表读数而不是内容块，
 * 加框就会和下方 Bot 主体抢重量、变成又一张等权重卡片。
 * ──────────────────────────────────────────────────────────── */
function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; icon: ElementType; tone?: 'live' | 'idle' }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col gap-0.5 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <it.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{it.label}</span>
          </dt>
          <dd
            className={cn(
              'truncate text-lg font-bold leading-tight tracking-tight',
              it.tone === 'live' && 'text-primary',
              it.tone === 'idle' && 'text-muted-foreground',
            )}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ────────────────────────────────────────────────────────────
 * Bot 卡片：页面的视觉主体。
 * 在线态只用主题色（primary）而非硬编码绿——用户换主题色时
 * 卡片能自动跟随，不会出现「红色主题里躺着一排绿卡」的撞色。
 * ──────────────────────────────────────────────────────────── */
function BotCard({
  name,
  botId,
  connected,
  connectedLabel,
  disconnectedLabel,
}: {
  name: string;
  botId: string;
  connected: boolean;
  connectedLabel: string;
  disconnectedLabel: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3.5 rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5',
        connected
          ? 'border-primary/25 bg-primary/[0.05] hover:border-primary/45'
          : 'border-border/60 hover:border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold',
            connected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
          aria-hidden
        >
          {String(name || '?')
            .trim()
            .charAt(0)
            .toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-snug text-foreground" title={name}>
            {name}
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={botId}>
            {botId || '-'}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        <span
          className={cn(
            'relative flex h-2 w-2 shrink-0',
            connected ? 'text-primary' : 'text-muted-foreground/50',
          )}
          aria-hidden
        >
          {connected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
        <span
          className={cn(
            'text-xs font-medium',
            connected ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {connected ? connectedLabel : disconnectedLabel}
        </span>
      </div>
    </div>
  );
}

/* 导航行：紧凑单行。primary 着色强调，secondary 中性。 */
function NavRow({
  label,
  description,
  href,
  icon,
  primary,
}: {
  label: string;
  description: string;
  href: string;
  icon: ElementType;
  primary?: boolean;
}) {
  return (
    <Link
      to={href}
      className={cn(
        hoverIconGroupClass,
        'group/nav flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200',
        'hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        primary && 'bg-primary/[0.07]',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg transition-colors',
          primary
            ? 'h-9 w-9 bg-primary/15 text-primary'
            : 'h-8 w-8 bg-muted/60 text-muted-foreground group-hover/nav:text-primary',
        )}
      >
        <SidebarHoverIcon icon={icon} className={primary ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-snug text-foreground">
          {label}
        </span>
        <span className="block truncate text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover/nav:-translate-y-0.5 group-hover/nav:translate-x-0.5 group-hover/nav:text-primary"
        aria-hidden
      />
    </Link>
  );
}

/* 规格行：发丝线分隔的「标签 / 值」，可悬停但不可点击 */
const specRowClass = cn(
  'group/spec flex min-w-0 items-start justify-between gap-4 rounded-lg px-2 py-1.5',
  'transition-all duration-200 ease-out hover:translate-x-0.5 hover:bg-primary/[0.07]',
);

function SpecRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className={specRowClass}>
      <dt className="shrink-0 text-sm text-muted-foreground transition-colors group-hover/spec:text-foreground/80">
        {label}
      </dt>
      <dd
        className="min-w-0 flex-1 truncate text-right text-sm font-medium text-foreground"
        title={String(value || '-')}
      >
        {value || '-'}
      </dd>
    </div>
  );
}

function SpecStack({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className={specRowClass}>
      <dt className="shrink-0 text-sm text-muted-foreground transition-colors group-hover/spec:text-foreground/80">
        {label}
      </dt>
      <dd
        className="min-w-0 flex-1 break-all text-right text-sm font-medium leading-relaxed text-foreground"
        title={String(value || '-')}
      >
        {value || '-'}
      </dd>
    </div>
  );
}

/* 区块标题：图标 + 标题，用于卡片左上角 */
function CardHead({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5 sm:px-6 sm:pt-6">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <CardTitle className="truncate text-lg">{title}</CardTitle>
    </div>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();

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
      setError(getApiErrorMessage(err, t('home.loadVersionFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  /* 导航按「日常高频 / 低频管理」分层 */
  const primaryNav = [
    {
      label: t('home.goToDashboard'),
      description: t('home.goToDashboardDesc'),
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: t('home.goToConsole'),
      description: t('home.goToConsoleDesc'),
      href: '/console',
      icon: Terminal,
    },
  ];
  const secondaryNav = [
    ...(isAdmin
      ? [
          {
            label: t('home.goToPlugins'),
            description: t('home.goToPluginsDesc'),
            href: '/plugins',
            icon: Plug,
          },
          {
            label: t('home.goToFrameworkConfig'),
            description: t('home.goToFrameworkConfigDesc'),
            href: '/framework-config',
            icon: Cpu,
          },
          {
            label: t('home.goToDatabase'),
            description: t('home.goToDatabaseDesc'),
            href: '/database',
            icon: Database,
          },
        ]
      : []),
    {
      label: t('home.goToGitUpdate'),
      description: t('home.goToGitUpdateDesc'),
      href: '/git-update',
      icon: GitBranch,
    },
  ];

  const projectLinks = [
    { label: t('home.frontendProject'), href: 'https://github.com/Genshin-bots/gsuid_hub' },
    { label: t('home.backendProject'), href: 'https://github.com/Genshin-bots/gsuid_core/' },
  ];

  const connectedBotCount = botsInfo?.bots.filter((bot) => bot.connected).length ?? 0;
  const botTotal = botsInfo?.count ?? 0;
  const dependencies = Object.entries(versionInfo?.dependencies || {});
  const osLabel =
    `${versionInfo?.platform.system || '-'} ${versionInfo?.platform.release || ''}`.trim();

  const statItems = [
    { label: t('home.backendVersion'), value: `v${versionInfo?.version || '-'}`, icon: Server },
    {
      label: t('home.frontendVersion'),
      value: `v${frontendVersion}`,
      icon: AppWindow,
    },
    { label: t('home.os'), value: osLabel, icon: Monitor },
    { label: t('home.pythonVersion'), value: versionInfo?.python.version || '-', icon: Code2 },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
      {/* ── 身份带 ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="tracking-tight">
            {highlightGreeting(
              t('home.greetingWithName', { greeting, name: displayName }),
              greeting,
              displayName,
            )}
          </h1>
          <p className="mt-1 text-muted-foreground">{highlightGsCore(t('home.welcomeMessage'))}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge
            className="max-w-full gap-1.5 whitespace-normal border-border/60 px-3 py-1 text-muted-foreground"
            variant="outline"
          >
            <GitCommit className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-mono">{versionInfo?.commit || '-'}</span>
          </Badge>
        </div>
      </header>

      {/* ── Bot 主体：整页视觉重心。状态条在其上方，卡片化呈现 ── */}
      <section className="glass-card relative rounded-3xl">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          aria-hidden="true"
        >
          <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <Bot className="h-5 w-5 shrink-0 text-primary" />
                {t('home.activeBots')}
              </CardTitle>
              {!isLoading && !error && (
                <Badge
                  className={cn(
                    'shrink-0 gap-1.5 px-2.5 py-0.5 text-xs',
                    connectedBotCount > 0
                      ? 'border-primary/25 bg-primary/10 text-primary'
                      : 'border-muted-foreground/25 bg-muted/30 text-muted-foreground',
                  )}
                  variant="outline"
                >
                  {connectedBotCount > 0 && <Radio className="h-3 w-3 animate-pulse" aria-hidden />}
                  {connectedBotCount}/{botTotal}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadHomeData}
              className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} aria-hidden />
              {t('home.retry')}
            </Button>
          </div>

          {/* 状态条：发丝线分隔，无框 */}
          <div className="mt-4 border-t border-border/40">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-x-4 pt-2 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-start gap-2 py-4">
                <div className="text-sm font-semibold text-destructive">
                  {t('home.loadVersionFailed')}
                </div>
                <div className="break-all text-xs text-muted-foreground">{error}</div>
              </div>
            ) : (
              <div className="pt-1">
                <StatStrip items={statItems} />
              </div>
            )}
          </div>

          {/* Bot 列表。0 个时用紧凑单行提示，不留大片空白箱 */}
          {isLoading ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : error ? null : botsInfo?.bots.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {botsInfo.bots.map((bot) => (
                <BotCard
                  key={bot.ws_bot_id}
                  name={bot.name}
                  botId={bot.bot_id}
                  connected={bot.connected}
                  connectedLabel={t('home.connected')}
                  disconnectedLabel={t('home.disconnected')}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-border/50 px-4 py-3.5">
              <Bot className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
              <span className="text-sm text-muted-foreground">{t('home.noActiveBots')}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── 导航 + 运行环境：并排两张卡，卡片数从 5 降到 3 ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-card relative flex flex-col rounded-3xl">
          <CardHead icon={LayoutDashboard} title={t('home.quickNav')} />
          <CardContent className="flex flex-1 flex-col gap-1 px-3 pb-4 pt-3 sm:px-4">
            {primaryNav.map((item) => (
              <NavRow key={item.href} {...item} primary />
            ))}
            <Separator className="my-1.5" />
            {secondaryNav.map((item) => (
              <NavRow key={item.href} {...item} />
            ))}
          </CardContent>
        </section>

        <section className="glass-card relative flex flex-col rounded-3xl">
          <CardHead icon={HardDrive} title={t('home.systemInfo')} />
          <CardContent className="flex-1 px-5 pb-4 pt-2 sm:px-6">
            <dl className="divide-y divide-border/40">
              <SpecRow label={t('home.os')} value={osLabel} />
              <SpecRow label={t('home.architecture')} value={versionInfo?.platform.machine} />
              <SpecRow label={t('home.pythonImpl')} value={versionInfo?.python.implementation} />
              <SpecRow label={t('home.compiler')} value={versionInfo?.python.compiler} />
              <SpecStack label={t('home.processor')} value={versionInfo?.platform.processor} />
              <SpecStack label={t('home.executable')} value={versionInfo?.executable} />
              <SpecRow label={t('home.pid')} value={versionInfo?.pid} />
            </dl>

            <div className="mt-3 flex items-center gap-2 border-t border-border/40 pt-4">
              <Boxes className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t('home.dependencies')}
              </span>
            </div>
            {isLoading ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-4" />
                ))}
              </div>
            ) : dependencies.length > 0 ? (
              <dl className="mt-1 grid gap-x-6 sm:grid-cols-2">
                {dependencies.map(([name, version]) => (
                  <div key={name} className="flex items-baseline justify-between gap-3 py-1">
                    <dt
                      className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                      title={name}
                    >
                      {name}
                    </dt>
                    <dd className="shrink-0 font-mono text-xs font-semibold text-foreground">
                      {version}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 py-1 text-xs text-muted-foreground">{t('home.noDependencies')}</p>
            )}
          </CardContent>
        </section>
      </div>

      {/* ── 项目地址 ── */}
      <footer className="grid gap-3 sm:grid-cols-2">
        {projectLinks.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="glass-card group flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3 transition-all hover:-translate-y-0.5 hover:!border-primary/35"
          >
            <Github className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
              <div className="truncate font-mono text-xs text-muted-foreground" title={item.href}>
                {item.href}
              </div>
            </div>
            <ExternalLink
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden
            />
          </a>
        ))}
      </footer>
    </div>
  );
}
