import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, McpParamMappingEditor, type ConfigValue } from '@/components/config';
import type { PluginConfigItem } from '@/lib/api';
import {
  Search,
  Wrench,
  GitBranch,
  Shuffle,
  Ban,
  ListOrdered,
  Settings2,
  Layers,
} from 'lucide-react';
import {
  Tavily,
  Exa,
  JinaAi,
  McpModelContextProtocol,
  Minimax,
} from '@thesvg/react';
import { cn } from '@/lib/utils';
import {
  filterOutPrimaryProvider,
  HeadingWithHelp,
  LabelWithHelp,
  sameProviderId,
} from '../shared';

/**
 * 网络搜索提供方 -> 品牌图标（@thesvg/react 官方彩版）。
 */
function getSearchProviderIcon(provider: string) {
  const key = provider.trim().toLowerCase();
  if (key === 'tavily') return <Tavily width={14} height={14} variant="default" />;
  if (key === 'exa') return <Exa width={14} height={14} variant="default" />;
  if (key === 'jina') return <JinaAi width={14} height={14} variant="default" />;
  if (key === 'mcp' || key === 'modelcontextprotocol' || key === 'model_context_protocol') {
    return <McpModelContextProtocol width={14} height={14} variant="default" />;
  }
  if (key === 'minimax') return <Minimax width={14} height={14} variant="default" />;
  return <Search className="w-3.5 h-3.5" />;
}

/** 多源策略 value（与后端 websearch_lb_strategy 一致） */
export type WebSearchLbStrategy = 'none' | 'error_switch' | 'auto_balance';

export interface WebSearchSectionProps {
  t: (key: string) => string;

  websearchProvider: string;
  websearchProviderOptions: string[];

  /** 多源策略 */
  websearchLbStrategy: string;
  websearchLbStrategyOptions?: string[];
  /** 备用源顺序（多选有序） */
  websearchFallbackOrder: string[];
  websearchFallbackOptions?: string[];

  tavilyConfig?: { id: string; config: Record<string, PluginConfigItem> };
  exaConfig?: { id: string; config: Record<string, PluginConfigItem> };
  jinaConfig?: { id: string; config: Record<string, PluginConfigItem> };
  miniMaxConfig?: { id: string; config: Record<string, PluginConfigItem> };

  websearchMcpToolId: string;
  websearchToolInfo: {
    toolName: string;
    serverName: string;
    description: string;
  } | null;
  mcpDetails: Record<string, string | number | boolean | null>;

  onChangeProvider: (provider: string) => void;
  onChangeLbStrategy: (strategy: string) => void;
  onChangeFallbackOrder: (order: string[]) => void;
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
  onOpenMcpToolDialog: () => void;
  onClearMcpTool: () => void;
  onDetailValueChange: (mcpParamName: string, value: string | number | boolean | null) => void;
  onMcpParamNameChange: (oldName: string, newName: string) => void;
  onAddMcpDetailRow: () => void;
  onRemoveMcpDetailRow: (mcpParamName: string) => void;
}

const STRATEGY_ICONS: Record<string, ReactNode> = {
  none: <Ban className="w-3.5 h-3.5" />,
  error_switch: <GitBranch className="w-3.5 h-3.5" />,
  auto_balance: <Shuffle className="w-3.5 h-3.5" />,
};

/** 主用 / 备用 配置区块外壳 */
function ConfigBlock({
  role,
  title,
  icon,
  roleLabel,
  children,
  className,
}: {
  role: 'primary' | 'fallback';
  title: string;
  icon?: ReactNode;
  roleLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const isPrimary = role === 'primary';
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3',
        isPrimary
          ? 'border-primary/30 bg-primary/5'
          : 'border-dashed border-border/60 bg-muted/20',
        className,
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
 * 「网络搜索服务」配置。
 * 主用源 + 多源策略 + 主用/备用分区配置。
 */
export function WebSearchSection({
  t,
  websearchProvider,
  websearchProviderOptions,
  websearchLbStrategy,
  websearchLbStrategyOptions = ['none', 'error_switch', 'auto_balance'],
  websearchFallbackOrder,
  websearchFallbackOptions,
  tavilyConfig,
  exaConfig,
  jinaConfig,
  miniMaxConfig,
  websearchMcpToolId,
  websearchToolInfo,
  mcpDetails,
  onChangeProvider,
  onChangeLbStrategy,
  onChangeFallbackOrder,
  onUpdateConfig,
  onOpenMcpToolDialog,
  onClearMcpTool,
  onDetailValueChange,
  onMcpParamNameChange,
  onAddMcpDetailRow,
  onRemoveMcpDetailRow,
}: WebSearchSectionProps) {
  const strategyLabels: Record<string, string> = {
    none: t('aiConfig.serviceProvider.lbStrategyNone'),
    error_switch: t('aiConfig.serviceProvider.lbStrategyErrorSwitch'),
    auto_balance: t('aiConfig.serviceProvider.lbStrategyAutoBalance'),
  };

  // 展示全部候选（含主用）；主用禁用且不以「已选」展示
  const fallbackOpts =
    websearchFallbackOptions && websearchFallbackOptions.length > 0
      ? websearchFallbackOptions
      : websearchProviderOptions;

  const showFallbackUi =
    websearchLbStrategy === 'error_switch' || websearchLbStrategy === 'auto_balance';

  /** 下方配置块 / Chip 已选展示：不含当前主用（大小写不敏感） */
  const effectiveFallbacks = filterOutPrimaryProvider(
    websearchFallbackOrder,
    websearchProvider,
  );

  /** Chip 展示用 value：主用不显示为已选；成员资格需用户显式勾选，切主用不自动恢复 */
  const fallbackChipValue = effectiveFallbacks;

  const renderProviderPanel = (provider: string) => {
    const key = provider.trim().toLowerCase();

    if (key === 'tavily') {
      if (!tavilyConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={tavilyConfig.config}
          configId={tavilyConfig.id}
          onChange={onUpdateConfig}
          layout={[['api_key'], ['max_results', 'search_depth']]}
        />
      );
    }
    if (key === 'exa') {
      if (!exaConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={exaConfig.config}
          configId={exaConfig.id}
          onChange={onUpdateConfig}
          layout={[['api_key'], ['max_results', 'search_type']]}
        />
      );
    }
    if (key === 'jina') {
      if (!jinaConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
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
            ['max_results', 'timeout'],
            ['search_base_url', 'reader_base_url'],
          ]}
        />
      );
    }
    if (key === 'minimax') {
      if (!miniMaxConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={miniMaxConfig.config}
          configId={miniMaxConfig.id}
          onChange={onUpdateConfig}
          layout={[['api_key'], ['api_host', 'resource_mode']]}
        />
      );
    }
    if (key === 'mcp' || key === 'modelcontextprotocol' || key === 'model_context_protocol') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {websearchToolInfo ? (
                <>
                  <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded-md bg-primary/10 text-primary">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {websearchToolInfo.toolName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 border-primary/20 text-primary bg-primary/5 shrink-0"
                      >
                        {websearchToolInfo.serverName}
                      </Badge>
                    </div>
                    {websearchToolInfo.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {websearchToolInfo.description}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('aiConfig.mcpTool.noToolAssociated')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {websearchMcpToolId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                  onClick={onClearMcpTool}
                >
                  {t('common.cancel')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={onOpenMcpToolDialog}
              >
                {websearchMcpToolId
                  ? t('aiConfig.mcpTool.switchTool')
                  : t('aiConfig.mcpTool.goAssociate')}
              </Button>
            </div>
          </div>
          {websearchMcpToolId && (
            <McpParamMappingEditor
              configKey="websearch_mcp_tool_id"
              details={mcpDetails}
              onDetailValueChange={onDetailValueChange}
              onMcpParamNameChange={onMcpParamNameChange}
              onAddRow={onAddMcpDetailRow}
              onRemoveRow={onRemoveMcpDetailRow}
            />
          )}
        </div>
      );
    }
    return (
      <p className="text-xs text-muted-foreground">
        {t('aiConfig.serviceProvider.configNotAvailable')}
      </p>
    );
  };

  return (
    <div className="space-y-5">
      <HeadingWithHelp
        icon={<Search className="w-5 h-5 text-primary" />}
        title={t('aiConfig.serviceProvider.webSearchService')}
        description={t('aiConfig.serviceProvider.webSearchServiceDesc')}
      />

      <div className="space-y-2">
        <LabelWithHelp
          icon={<Layers className="w-3.5 h-3.5 text-muted-foreground" />}
          label={t('aiConfig.serviceProvider.primaryProvider')}
          description={t('aiConfig.serviceProvider.primaryProviderDesc')}
          className="text-xs font-medium text-muted-foreground"
        />
        <ChipGroup
          options={websearchProviderOptions.map((p) => ({
            value: p,
            label: p,
            icon: getSearchProviderIcon(p),
          }))}
          value={[websearchProvider]}
          onValueChange={(newValue) => onChangeProvider(newValue[0] || '')}
          selectMode="single"
          showRadioIndicator
        />
      </div>

      <div className="space-y-2 pt-1 border-t border-border/30">
        <LabelWithHelp
          icon={<GitBranch className="w-3.5 h-3.5 text-muted-foreground" />}
          label={t('aiConfig.serviceProvider.lbStrategy')}
          description={t('aiConfig.serviceProvider.lbStrategyDesc')}
          className="text-xs font-medium text-muted-foreground"
        />
        <ChipGroup
          options={websearchLbStrategyOptions.map((s) => ({
            value: s,
            label: strategyLabels[s] || s,
            icon: STRATEGY_ICONS[s] ?? <GitBranch className="w-3.5 h-3.5" />,
          }))}
          value={[websearchLbStrategy || 'error_switch']}
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
            label={t('aiConfig.serviceProvider.fallbackOrder')}
            description={t('aiConfig.serviceProvider.fallbackOrderDesc')}
            className="text-xs font-medium text-muted-foreground"
          />
          <ChipGroup
            options={fallbackOpts.map((p) => {
              const isPrimary = sameProviderId(p, websearchProvider);
              return {
                value: p,
                label: isPrimary
                  ? `${p} (${t('aiConfig.serviceProvider.rolePrimary')})`
                  : p,
                icon: getSearchProviderIcon(p),
                // 主用：可见、禁用、不可勾选；不参与已选 / 不写入 fallback 字段
                disabled: isPrimary,
              };
            })}
            value={fallbackChipValue}
            onValueChange={(visibleSelected) => {
              // 绝不把当前主用写入 fallback_order（切换主用时由父级静默剔除）
              onChangeFallbackOrder(
                filterOutPrimaryProvider(visibleSelected, websearchProvider),
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
          label={t('aiConfig.serviceProvider.primaryConfigSection')}
          description={t('aiConfig.serviceProvider.primaryConfigSectionDesc')}
          className="text-xs font-medium text-muted-foreground"
        />
        <ConfigBlock
          role="primary"
          title={websearchProvider}
          icon={getSearchProviderIcon(websearchProvider)}
          roleLabel={t('aiConfig.serviceProvider.rolePrimary')}
        >
          {renderProviderPanel(websearchProvider)}
        </ConfigBlock>
      </div>

      {/* 备用源配置（与主用分区） */}
      {showFallbackUi && effectiveFallbacks.length > 0 && (
        <div className="space-y-3">
          <LabelWithHelp
            icon={<Layers className="w-3.5 h-3.5 text-muted-foreground" />}
            label={t('aiConfig.serviceProvider.fallbackConfigSection')}
            description={t('aiConfig.serviceProvider.fallbackConfigSectionDesc')}
            className="text-xs font-medium text-muted-foreground"
          />
          {effectiveFallbacks.map((p) => (
            <ConfigBlock
              key={p}
              role="fallback"
              title={p}
              icon={getSearchProviderIcon(p)}
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
