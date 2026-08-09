import type { ReactNode } from 'react';
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
import { JinaAi } from '@thesvg/react';
import { Badge } from '@/components/ui/badge';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, type ConfigValue } from '@/components/config';
import type { PluginConfigItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  filterOutPrimaryProvider,
  HeadingWithHelp,
  LabelWithHelp,
  sameProviderId,
} from '../shared';

export interface WebFetchSectionProps {
  t: (key: string) => string;

  /** 主用抓取提供方：Jina | local */
  webfetchProvider: string;
  webfetchProviderOptions?: string[];

  /** 多源策略 */
  webfetchLbStrategy: string;
  webfetchLbStrategyOptions?: string[];
  webfetchFallbackOrder: string[];
  webfetchFallbackOptions?: string[];

  /** WebFetch 本机直连配置 */
  webFetchConfig?: { id: string; config: Record<string, PluginConfigItem> };
  /** Jina Reader（r.jina.ai）配置，API Key 可选 */
  jinaConfig?: { id: string; config: Record<string, PluginConfigItem> };

  onChangeProvider: (provider: string) => void;
  onChangeLbStrategy: (strategy: string) => void;
  onChangeFallbackOrder: (order: string[]) => void;
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

function getFetchProviderIcon(provider: string) {
  const key = provider.trim().toLowerCase();
  if (key === 'jina') return <JinaAi width={14} height={14} variant="default" />;
  return <HardDrive className="w-3.5 h-3.5" />;
}

const STRATEGY_ICONS: Record<string, ReactNode> = {
  none: <Ban className="w-3.5 h-3.5" />,
  error_switch: <GitBranch className="w-3.5 h-3.5" />,
  auto_balance: <Shuffle className="w-3.5 h-3.5" />,
};

function ConfigBlock({
  role,
  title,
  icon,
  roleLabel,
  children,
}: {
  role: 'primary' | 'fallback';
  title: string;
  icon?: ReactNode;
  roleLabel: string;
  children: ReactNode;
}) {
  const isPrimary = role === 'primary';
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3',
        isPrimary
          ? 'border-primary/30 bg-primary/5'
          : 'border-dashed border-border/60 bg-muted/20',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge
          variant={isPrimary ? 'default' : 'outline'}
          className={cn(
            'shrink-0 text-[10px] h-5 px-1.5',
            !isPrimary && 'text-muted-foreground',
          )}
        >
          {roleLabel}
        </Badge>
        {icon}
        <span className="text-sm font-medium truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * 「网页抓取服务」配置：主用源 + 多源策略 + 主用/备用分区配置。
 */
export function WebFetchSection({
  t,
  webfetchProvider,
  webfetchProviderOptions = ['Jina', 'local'],
  webfetchLbStrategy,
  webfetchLbStrategyOptions = ['none', 'error_switch', 'auto_balance'],
  webfetchFallbackOrder,
  webfetchFallbackOptions,
  webFetchConfig,
  jinaConfig,
  onChangeProvider,
  onChangeLbStrategy,
  onChangeFallbackOrder,
  onUpdateConfig,
}: WebFetchSectionProps) {
  const providerLabels: Record<string, string> = {
    local: t('aiConfig.webFetch.providerLocal'),
    Jina: t('aiConfig.webFetch.providerJina'),
  };

  const strategyLabels: Record<string, string> = {
    none: t('aiConfig.serviceProvider.lbStrategyNone'),
    error_switch: t('aiConfig.serviceProvider.lbStrategyErrorSwitch'),
    auto_balance: t('aiConfig.serviceProvider.lbStrategyAutoBalance'),
  };

  const primary = webfetchProvider || 'Jina';
  const isJina = primary.trim().toLowerCase() === 'jina';

  // 展示全部候选（含主用）；主用禁用且不以「已选」展示
  const fallbackOpts =
    webfetchFallbackOptions && webfetchFallbackOptions.length > 0
      ? webfetchFallbackOptions
      : webfetchProviderOptions;

  const showFallbackUi =
    webfetchLbStrategy === 'error_switch' || webfetchLbStrategy === 'auto_balance';

  /** 下方配置块 / Chip 已选展示：不含当前主用（大小写不敏感） */
  const effectiveFallbacks = filterOutPrimaryProvider(
    webfetchFallbackOrder,
    primary,
  );

  const fallbackChipValue = effectiveFallbacks;

  const providerLabel = (p: string) => {
    if (providerLabels[p]) return providerLabels[p];
    const k = p.trim().toLowerCase();
    if (k === 'jina') return providerLabels.Jina || p;
    if (k === 'local') return providerLabels.local || p;
    return p;
  };

  const renderProviderPanel = (provider: string) => {
    const key = provider.trim().toLowerCase();
    if (key === 'jina') {
      if (!jinaConfig) {
        return (
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.webFetch.jinaConfigNotLoaded')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={jinaConfig.config}
          configId={jinaConfig.id}
          onChange={onUpdateConfig}
          layout={[
            ['api_key'],
            ['timeout', 'reader_base_url'],
          ]}
        />
      );
    }
    // local
    if (!webFetchConfig) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.webFetch.configNotLoaded')}
        </p>
      );
    }
    return (
      <DynamicConfigPanel
        config={webFetchConfig.config}
        configId={webFetchConfig.id}
        onChange={onUpdateConfig}
        layout={[
          ['proxy', 'trust_env'],
          ['timeout', 'max_download_mb'],
          ['user_agent'],
          ['accept_language', 'max_content_length'],
        ]}
      />
    );
  };

  return (
    <div className="space-y-5">
      <HeadingWithHelp
        icon={<Globe className="w-5 h-5 text-primary" />}
        title={t('aiConfig.webFetch.title')}
        description={t('aiConfig.webFetch.description')}
      />

      <div className="space-y-2">
        <LabelWithHelp
          icon={<Layers className="w-3.5 h-3.5 text-muted-foreground" />}
          label={t('aiConfig.webFetch.primaryProvider')}
          description={
            isJina
              ? t('aiConfig.webFetch.jinaHint')
              : t('aiConfig.webFetch.localHint')
          }
          className="text-xs font-medium text-muted-foreground"
        />
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
      </div>

      <div className="space-y-2 pt-1 border-t border-border/30">
        <LabelWithHelp
          icon={<GitBranch className="w-3.5 h-3.5 text-muted-foreground" />}
          label={t('aiConfig.webFetch.lbStrategy')}
          description={t('aiConfig.webFetch.lbStrategyDesc')}
          className="text-xs font-medium text-muted-foreground"
        />
        <ChipGroup
          options={webfetchLbStrategyOptions.map((s) => ({
            value: s,
            label: strategyLabels[s] || s,
            icon: STRATEGY_ICONS[s] ?? <GitBranch className="w-3.5 h-3.5" />,
          }))}
          value={[webfetchLbStrategy || 'error_switch']}
          onValueChange={(newValue) =>
            onChangeLbStrategy(newValue[0] || 'error_switch')
          }
          selectMode="single"
          showRadioIndicator
        />
      </div>

      {showFallbackUi && (
        <div className="space-y-2">
          <LabelWithHelp
            icon={<ListOrdered className="w-3.5 h-3.5 text-muted-foreground" />}
            label={t('aiConfig.webFetch.fallbackOrder')}
            description={t('aiConfig.webFetch.fallbackOrderDesc')}
            className="text-xs font-medium text-muted-foreground"
          />
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
              onChangeFallbackOrder(
                filterOutPrimaryProvider(visibleSelected, primary),
              );
            }}
            selectMode="multiple"
            allowEmpty
            showOrderIndex
          />
        </div>
      )}

      {/* 主用源配置 */}
      <div className="space-y-2 pt-1 border-t border-border/30">
        <LabelWithHelp
          icon={<Settings2 className="w-3.5 h-3.5 text-muted-foreground" />}
          label={t('aiConfig.webFetch.primaryConfigSection')}
          description={t('aiConfig.webFetch.primaryConfigSectionDesc')}
          className="text-xs font-medium text-muted-foreground"
        />
        <ConfigBlock
          role="primary"
          title={providerLabel(primary)}
          icon={getFetchProviderIcon(primary)}
          roleLabel={t('aiConfig.serviceProvider.rolePrimary')}
        >
          {renderProviderPanel(primary)}
        </ConfigBlock>
      </div>

      {/* 备用源配置 */}
      {showFallbackUi && effectiveFallbacks.length > 0 && (
        <div className="space-y-3">
          <LabelWithHelp
            icon={<Layers className="w-3.5 h-3.5 text-muted-foreground" />}
            label={t('aiConfig.webFetch.fallbackConfigSection')}
            description={t('aiConfig.webFetch.fallbackConfigSectionDesc')}
            className="text-xs font-medium text-muted-foreground"
          />
          {effectiveFallbacks.map((p) => (
            <ConfigBlock
              key={p}
              role="fallback"
              title={providerLabel(p)}
              icon={getFetchProviderIcon(p)}
              roleLabel={t('aiConfig.serviceProvider.roleFallback')}
            >
              {renderProviderPanel(p)}
            </ConfigBlock>
          ))}
        </div>
      )}
    </div>
  );
}
