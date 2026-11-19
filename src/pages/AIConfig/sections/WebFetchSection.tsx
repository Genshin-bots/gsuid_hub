import { useState, type ReactNode } from 'react';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  Ban,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  ListOrdered,
  Settings2,
  Shuffle,
} from 'lucide-react';
import { JinaAi, Deepseek, Exa } from '@thesvg/react';
import { Badge } from '@/components/ui/badge';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, type ConfigValue } from '@/components/config';
import anysearchIcon from '@/assets/search-providers/anysearch.ico';
import keenableIcon from '@/assets/search-providers/keenable.ico';
import { pageStackClass } from '@/components/layout/PinnedPage';
import type { LocalFrameworkConfig } from '../types';
import {
  ConfigCard,
  ConfigGroup,
  ConfigGroupList,
  FaviconIcon,
  filterOutPrimaryProvider,
  getExcludedKeysForProvider,
  resolveProviderFrameworkConfig,
  sameProviderId,
} from '../shared';

export interface WebFetchSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;

  /** 主用抓取提供方：Jina | DeepSeek | Exa | AnySearch | local | 任意新增源 */
  webfetchProvider: string;
  webfetchProviderOptions?: string[];
  providerDesc?: string;

  /** 多源策略 */
  webfetchLbStrategy: string;
  webfetchLbStrategyOptions?: string[];
  webfetchFallbackOrder: string[];
  webfetchFallbackOptions?: string[];

  /** 后端下发的全部 AI 框架配置（按 id 索引），按 provider 名动态解析对应配置卡 */
  frameworkConfigs: Record<string, LocalFrameworkConfig>;

  onChangeProvider: (provider: string) => void;
  onChangeLbStrategy: (strategy: string) => void;
  onChangeFallbackOrder: (order: string[]) => void;
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

function getFetchProviderIcon(provider: string) {
  const key = provider.trim().toLowerCase();
  if (key === 'jina') return <JinaAi width={14} height={14} variant="default" />;
  if (key === 'deepseek') return <Deepseek width={14} height={14} variant="default" />;
  if (key === 'exa') return <Exa width={14} height={14} variant="default" />;
  if (key === 'anysearch') return <FaviconIcon src={anysearchIcon} alt="AnySearch" />;
  if (key === 'keenable') return <FaviconIcon src={keenableIcon} alt="Keenable" />;
  if (key === 'local') return <HardDrive className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

const STRATEGY_ICONS: Record<string, ReactNode> = {
  none: <Ban className="w-3.5 h-3.5" />,
  error_switch: <GitBranch className="w-3.5 h-3.5" />,
  auto_balance: <Shuffle className="w-3.5 h-3.5" />,
};

/**
 * 「网页抓取服务」配置：主用源 + 多源策略 + 主用/备用分区配置。
 */
export function WebFetchSection({
  t,
  webfetchProvider,
  webfetchProviderOptions = ['Jina', 'DeepSeek', 'Exa', 'AnySearch', 'local'],
  providerDesc,
  webfetchLbStrategy,
  webfetchLbStrategyOptions = ['none', 'error_switch', 'auto_balance'],
  webfetchFallbackOrder,
  webfetchFallbackOptions,
  frameworkConfigs,
  onChangeProvider,
  onChangeLbStrategy,
  onChangeFallbackOrder,
  onUpdateConfig,
}: WebFetchSectionProps) {
  const providerLabels: Record<string, string> = {
    local: t('aiConfig.webFetch.providerLocal'),
    Jina: t('aiConfig.webFetch.providerJina'),
    DeepSeek: t('aiConfig.webFetch.providerDeepSeek'),
    Exa: t('aiConfig.webFetch.providerExa'),
    AnySearch: t('aiConfig.webFetch.providerAnySearch'),
  };

  const providerHints: Record<string, string> = {
    local: t('aiConfig.webFetch.localHint'),
    jina: t('aiConfig.webFetch.jinaHint'),
    deepseek: t('aiConfig.webFetch.deepseekHint'),
    exa: t('aiConfig.webFetch.exaHint'),
    anysearch: t('aiConfig.webFetch.anysearchHint'),
  };

  const strategyLabels: Record<string, string> = {
    none: t('aiConfig.serviceProvider.lbStrategyNone'),
    error_switch: t('aiConfig.serviceProvider.lbStrategyErrorSwitch'),
    auto_balance: t('aiConfig.serviceProvider.lbStrategyAutoBalance'),
  };

  const primary = webfetchProvider || 'Jina';

  // 展示全部候选（含主用）；主用禁用且不以「已选」展示
  const fallbackOpts =
    webfetchFallbackOptions && webfetchFallbackOptions.length > 0
      ? webfetchFallbackOptions
      : webfetchProviderOptions;

  const showFallbackUi =
    webfetchLbStrategy === 'error_switch' || webfetchLbStrategy === 'auto_balance';

  /** 下方配置块 / Chip 已选展示：不含当前主用（大小写不敏感） */
  const effectiveFallbacks = filterOutPrimaryProvider(webfetchFallbackOrder, primary);

  const fallbackChipValue = effectiveFallbacks;

  // 源配置卡片内的 provider 切换器：主用在首位，备用按顺序
  const panelProviders = showFallbackUi ? [primary, ...effectiveFallbacks] : [primary];
  const [selectedProvider, setSelectedProvider] = useState(primary);
  // 选中项失效（换主用 / 被移出备用顺序）时回落到主用
  const activePanelProvider = panelProviders.some((p) => sameProviderId(p, selectedProvider))
    ? selectedProvider
    : primary;

  const providerLabel = (p: string) => {
    if (providerLabels[p]) return providerLabels[p];
    const k = p.trim().toLowerCase();
    if (k === 'jina') return providerLabels.Jina || p;
    if (k === 'deepseek') return providerLabels.DeepSeek || p;
    if (k === 'exa') return providerLabels.Exa || p;
    if (k === 'anysearch') return providerLabels.AnySearch || p;
    if (k === 'local') return providerLabels.local || p;
    return p;
  };

  const notLoadedHintKey: Record<string, string> = {
    jina: 'aiConfig.webFetch.jinaConfigNotLoaded',
    deepseek: 'aiConfig.webFetch.deepseekConfigNotLoaded',
    exa: 'aiConfig.webFetch.exaConfigNotLoaded',
    anysearch: 'aiConfig.webFetch.anysearchConfigNotLoaded',
    local: 'aiConfig.webFetch.configNotLoaded',
  };

  const renderProviderPanel = (provider: string) => {
    const matched = resolveProviderFrameworkConfig(frameworkConfigs, provider, 'fetch');
    if (!matched) {
      const key = provider.trim().toLowerCase();
      return (
        <p className="text-sm text-muted-foreground">
          {t(notLoadedHintKey[key] ?? 'aiConfig.serviceProvider.configNotAvailable')}
        </p>
      );
    }
    return (
      <DynamicConfigPanel
        config={matched.config}
        configId={matched.id}
        onChange={onUpdateConfig}
        excludeKeys={getExcludedKeysForProvider(provider)}
      />
    );
  };

  return (
    <div className={pageStackClass}>
      {/* 抓取源：主用 / 多源策略 / 备用顺序 */}
      <ConfigCard>
        <ConfigGroupList>
          <ConfigGroup
            layout="inline"
            icon={<Layers className="w-4 h-4 text-muted-foreground" />}
            label={t('aiConfig.webFetch.primaryProvider')}
            description={
              providerHints[primary.trim().toLowerCase()] ??
              providerDesc ??
              t('aiConfig.webFetch.description')
            }
          >
            <ChipGroup
              options={webfetchProviderOptions.map((p) => ({
                value: p,
                label: providerLabel(p),
                icon: getFetchProviderIcon(p),
              }))}
              value={[primary]}
              onValueChange={(v) => onChangeProvider(v[0] || 'Jina')}
              selectMode="single"
              showRadioIndicator
            />
          </ConfigGroup>

          <ConfigGroup
            layout="inline"
            icon={<GitBranch className="w-4 h-4 text-muted-foreground" />}
            label={t('aiConfig.webFetch.lbStrategy')}
            description={t('aiConfig.webFetch.lbStrategyDesc')}
          >
            <TabButtonGroup
              size="sm"
              value={webfetchLbStrategy || 'error_switch'}
              onValueChange={(v) => onChangeLbStrategy(v || 'error_switch')}
              options={webfetchLbStrategyOptions.map((s) => ({
                value: s,
                label: strategyLabels[s] || s,
                icon: STRATEGY_ICONS[s] ?? <GitBranch className="w-3.5 h-3.5" />,
              }))}
            />
          </ConfigGroup>

          {showFallbackUi && (
            <ConfigGroup
              layout="inline"
              icon={<ListOrdered className="w-4 h-4 text-muted-foreground" />}
              label={t('aiConfig.webFetch.fallbackOrder')}
              description={t('aiConfig.webFetch.fallbackOrderDesc')}
            >
              <ChipGroup
                options={fallbackOpts.map((p) => {
                  const isPrimary = sameProviderId(p, primary);
                  const base = providerLabel(p);
                  return {
                    value: p,
                    label: isPrimary
                      ? `${base} (${t('aiConfig.serviceProvider.rolePrimary')})`
                      : base,
                    icon: getFetchProviderIcon(p),
                    disabled: isPrimary,
                  };
                })}
                value={fallbackChipValue}
                onValueChange={(visibleSelected) => {
                  // 绝不把当前主用写入 fallback_order
                  onChangeFallbackOrder(filterOutPrimaryProvider(visibleSelected, primary));
                }}
                selectMode="multiple"
                allowEmpty
                showOrderIndex
              />
            </ConfigGroup>
          )}
        </ConfigGroupList>
      </ConfigCard>

      {/* 源配置：主用 + 备用，TabButtonGroup 切换当前编辑的 provider */}
      <ConfigCard
        icon={<Settings2 className="w-5 h-5 text-primary" />}
        title={t('aiConfig.webFetch.sourceConfig')}
        description={t('aiConfig.webFetch.sourceConfigDesc')}
      >
        {panelProviders.length > 1 ? (
          <TabButtonGroup
            size="sm"
            value={activePanelProvider}
            onValueChange={setSelectedProvider}
            options={panelProviders.map((p, i) => ({
              value: p,
              label: providerLabel(p),
              icon: getFetchProviderIcon(p),
              badge:
                i === 0 ? (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] border-primary/30 text-primary"
                  >
                    {t('aiConfig.serviceProvider.rolePrimary')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    {i}
                  </Badge>
                ),
            }))}
          />
        ) : (
          <div className="flex items-center gap-2">
            {getFetchProviderIcon(primary)}
            <span className="text-sm font-medium">{providerLabel(primary)}</span>
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] border-primary/30 text-primary"
            >
              {t('aiConfig.serviceProvider.rolePrimary')}
            </Badge>
          </div>
        )}
        <div className="border-t border-border/40 pt-4">
          {renderProviderPanel(activePanelProvider)}
        </div>
      </ConfigCard>
    </div>
  );
}
