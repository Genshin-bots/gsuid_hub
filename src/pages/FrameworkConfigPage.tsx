import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Cog,
  Cpu,
  Database,
  Filter,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TabButtonGroup,
  type TabButtonOption,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
  tabToolbarIconButtonClass,
} from '@/components/ui/TabButtonGroup';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { searchFrameworkFields } from './FrameworkConfig/classifyGroups';
import { DatabaseSection } from './FrameworkConfig/sections/DatabaseSection';
import { GlobalSearchResults } from './FrameworkConfig/sections/GlobalSearchResults';
import { IdentitySection } from './FrameworkConfig/sections/IdentitySection';
import { InteractionSection } from './FrameworkConfig/sections/InteractionSection';
import { MediaSection } from './FrameworkConfig/sections/MediaSection';
import { RuntimeSection } from './FrameworkConfig/sections/RuntimeSection';
import { SystemCoreSection } from './FrameworkConfig/sections/SystemCoreSection';
import { EmptyState } from './FrameworkConfig/shared/ProgressivePrimitives';
import { DOMAIN_ORDER, type DomainId } from './FrameworkConfig/types';
import { useCoreFrameworkConfigs } from './FrameworkConfig/useCoreFrameworkConfigs';

const DOMAIN_ICONS: Record<DomainId, React.ReactNode> = {
  core: <Cog className="h-4 w-4" />,
  runtime: <Cpu className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  media: <ImageIcon className="h-4 w-4" />,
  interaction: <MessageSquare className="h-4 w-4" />,
  identity: <Sparkles className="h-4 w-4" />,
};

function isValidDomainId(val: string | null): val is DomainId {
  return Boolean(val && (DOMAIN_ORDER as readonly string[]).includes(val));
}

export default function FrameworkConfigPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    isLoading,
    isRefreshing,
    isSaving,
    loadError,
    failedGroupNames,
    coreOptionsMeta,
    originalConfigs,
    groupsList,
    groupsByDomain,
    dirtySummary,
    updateField,
    batchUpdateFields,
    resetField,
    resetGroup,
    resetAll,
    refresh,
    saveChanged,
  } = useCoreFrameworkConfigs(isAdmin);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [onlyChanged, setOnlyChanged] = React.useState(false);

  // 所有改动已撤销或已保存后，若无搜索词则自动退出「仅看改动」空过滤态
  React.useEffect(() => {
    if (onlyChanged && !dirtySummary.isDirty && !searchQuery.trim()) {
      setOnlyChanged(false);
    }
  }, [dirtySummary.isDirty, onlyChanged, searchQuery]);

  const populatedDomains = React.useMemo(
    () => DOMAIN_ORDER.filter((d) => groupsByDomain[d].length > 0),
    [groupsByDomain],
  );

  const paramTab = searchParams.get('tab');
  const activeDomain: DomainId = React.useMemo(() => {
    if (isValidDomainId(paramTab) && groupsByDomain[paramTab].length > 0) {
      return paramTab;
    }
    return populatedDomains[0] ?? (isAdmin ? 'core' : 'runtime');
  }, [groupsByDomain, isAdmin, paramTab, populatedDomains]);

  const handleDomainChange = React.useCallback(
    (next: string) => {
      if (!isValidDomainId(next)) return;
      if (searchQuery.trim() || onlyChanged) {
        setSearchQuery('');
        setOnlyChanged(false);
      }
      setSearchParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.set('tab', next);
          return updated;
        },
        { replace: true },
      );
    },
    [onlyChanged, searchQuery, setSearchParams],
  );

  const getDomainLabel = React.useCallback(
    (domain: DomainId) => t(`frameworkConfig.domains.${domain}`),
    [t],
  );

  const isFiltering = Boolean(searchQuery.trim()) || onlyChanged;

  const searchHits = React.useMemo(
    () =>
      isFiltering
        ? searchFrameworkFields(groupsList, originalConfigs, searchQuery, onlyChanged)
        : [],
    [groupsList, isFiltering, onlyChanged, originalConfigs, searchQuery],
  );

  const domainTabOptions: TabButtonOption[] = React.useMemo(() => {
    const fallbackDomains = DOMAIN_ORDER.filter((d) => d !== 'core' || isAdmin);
    const visibleDomains = populatedDomains.length > 0 ? populatedDomains : fallbackDomains;
    return visibleDomains.map((domain) => {
      const changed = dirtySummary.domainChangedCounts[domain];
      return {
        value: domain,
        label: getDomainLabel(domain),
        icon: DOMAIN_ICONS[domain],
        badge:
          changed > 0 ? (
            <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-current/15 px-1 text-[10px] font-semibold tabular-nums">
              {changed}
            </span>
          ) : undefined,
      };
    });
  }, [dirtySummary.domainChangedCounts, getDomainLabel, isAdmin, populatedDomains]);

  const pageHeader = (
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
        <Sliders className="h-8 w-8 shrink-0 text-primary" />
        <span className="min-w-0 truncate">{t('frameworkConfig.title')}</span>
      </h1>
      <p className="mt-1 text-muted-foreground">{t('frameworkConfig.description')}</p>
    </div>
  );

  if (isLoading) {
    return (
      <PinnedPage header={pageHeader}>
        <Card className="glass-card space-y-4 p-5">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <Skeleton key={idx} className="h-10 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
        </Card>
        <Card className="glass-card space-y-3 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </Card>
      </PinnedPage>
    );
  }

  if (loadError) {
    return (
      <PinnedPage header={pageHeader}>
        <GlassAlert tone="danger" icon={AlertTriangle} className="sm:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium sm:text-sm">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              className="h-9 shrink-0 gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('common.refresh')}
            </Button>
          </div>
        </GlassAlert>
      </PinnedPage>
    );
  }

  if (groupsList.length === 0) {
    return (
      <PinnedPage header={pageHeader}>
        <Card className="glass-card p-6">
          <EmptyState
            icon={<Sliders className="h-8 w-8" />}
            title={t('frameworkConfig.noFrameworkConfig')}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('common.refresh')}
              </Button>
            }
          />
        </Card>
      </PinnedPage>
    );
  }

  const sharedSectionProps = {
    groups: groupsByDomain[activeDomain],
    originalConfigs,
    changedFieldsByGroup: dirtySummary.changedFieldsByGroup,
    coreOptionsMeta,
    onUpdateField: updateField,
    onBatchUpdateFields: batchUpdateFields,
    onResetField: resetField,
    onResetGroup: resetGroup,
  };

  const renderDomainSection = () => {
    switch (activeDomain) {
      case 'core':
        return <SystemCoreSection {...sharedSectionProps} />;
      case 'runtime':
        return <RuntimeSection {...sharedSectionProps} />;
      case 'database':
        return <DatabaseSection {...sharedSectionProps} />;
      case 'media':
        return <MediaSection {...sharedSectionProps} />;
      case 'interaction':
        return <InteractionSection {...sharedSectionProps} />;
      case 'identity':
        return <IdentitySection {...sharedSectionProps} />;
    }
  };

  return (
    <PinnedPage
      header={pageHeader}
      toolbar={
        /* 顶栏统一 h-10：左分区 Tab，右全局搜索 + 过滤已改 + 刷新 / 重置 / 保存 */
        <div className="flex min-w-0 flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className={cn(tabToolbarGroupWrapClass, 'max-w-full')}>
            <TabButtonGroup
              options={domainTabOptions}
              value={isFiltering ? '' : activeDomain}
              onValueChange={handleDomainChange}
              className="shrink-0"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:w-56 md:w-64 xl:w-56 xl:min-w-[9rem] xl:flex-initial xl:shrink 2xl:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('frameworkConfig.search.placeholder')}
                className={cn(tabToolbarControlClass, 'w-full bg-background/60 pl-9 pr-8')}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={t('frameworkConfig.search.clearFilter')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {(dirtySummary.isDirty || onlyChanged) && (
                <Button
                  type="button"
                  variant={onlyChanged ? 'default' : 'outline'}
                  onClick={() => setOnlyChanged((prev) => !prev)}
                  className={cn(
                    tabToolbarControlClass,
                    'gap-1.5 whitespace-nowrap px-3 text-xs sm:text-sm',
                    onlyChanged && 'button-solid',
                  )}
                >
                  <Filter className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('frameworkConfig.search.onlyModified')}</span>
                </Button>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void refresh()}
                    disabled={isRefreshing || isSaving}
                    className={cn(tabToolbarIconButtonClass, 'shrink-0')}
                    aria-label={t('common.refresh')}
                  >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('common.refresh')}</TooltipContent>
              </Tooltip>

              {dirtySummary.isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetAll}
                  disabled={isSaving}
                  className={cn(
                    tabToolbarControlClass,
                    'flex-1 gap-1.5 whitespace-nowrap px-3 sm:flex-none',
                  )}
                >
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  <span>{t('frameworkConfig.progressive.resetAll')}</span>
                </Button>
              )}

              <Button
                type="button"
                onClick={() => void saveChanged()}
                disabled={!dirtySummary.isDirty || isSaving}
                className={cn(
                  tabToolbarControlClass,
                  'button-solid flex-1 gap-2 whitespace-nowrap px-4 sm:flex-none',
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {dirtySummary.isDirty
                    ? t('frameworkConfig.progressive.saveWithCount', {
                        count: dirtySummary.totalChangedFields,
                      })
                    : t('common.save')}
                </span>
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {failedGroupNames.length > 0 && (
        <GlassAlert tone="warning" icon={AlertTriangle}>
          <p className="truncate text-xs sm:text-sm">
            {t('frameworkConfig.progressive.partialLoadWarning', {
              names: failedGroupNames.join(', '),
            })}
          </p>
        </GlassAlert>
      )}

      {isFiltering ? (
        <GlobalSearchResults
          hits={searchHits}
          searchQuery={searchQuery}
          onlyChanged={onlyChanged}
          getDomainLabel={getDomainLabel}
          onJumpToDomain={handleDomainChange}
          onClearFilter={() => {
            setSearchQuery('');
            setOnlyChanged(false);
          }}
          onUpdateField={updateField}
          onResetField={resetField}
        />
      ) : (
        renderDomainSection()
      )}
    </PinnedPage>
  );
}
