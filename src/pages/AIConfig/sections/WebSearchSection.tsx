import { useState, type ReactNode } from 'react';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, McpParamMappingEditor, type ConfigValue } from '@/components/config';
import type { PluginConfigItem } from '@/lib/api';
import {
  Search,
  Images,
  Wrench,
  GitBranch,
  Shuffle,
  Ban,
  ListOrdered,
  Settings2,
  Layers,
} from 'lucide-react';
import { Tavily, Exa, JinaAi, McpModelContextProtocol, Minimax, Deepseek } from '@thesvg/react';
import { cn } from '@/lib/utils';
import anysearchIcon from '@/assets/search-providers/anysearch.ico';
import firecrawlIcon from '@/assets/search-providers/firecrawl.ico';
import so360Icon from '@/assets/search-providers/360.ico';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { pageStackClass } from '@/components/layout/PinnedPage';
import {
  ConfigCard,
  ConfigGroup,
  ConfigGroupList,
  filterOutPrimaryProvider,
  sameProviderId,
  SettingRow,
} from '../shared';

function FaviconIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={14}
      height={14}
      className="h-3.5 w-3.5 shrink-0 rounded-[2px] object-contain"
      draggable={false}
    />
  );
}

/**
 * 网络搜索提供方 -> 品牌图标。
 * Tavily / Exa / Jina / MCP / MiniMax 走 @thesvg/react；
 * AnySearch / Firecrawl / 360 用官方 favicon。
 */
function getSearchProviderIcon(provider: string) {
  const key = provider.trim().toLowerCase();
  if (key === 'tavily') return <Tavily width={14} height={14} variant="default" />;
  if (key === 'exa') return <Exa width={14} height={14} variant="default" />;
  if (key === 'jina') return <JinaAi width={14} height={14} variant="default" />;
  if (key === 'deepseek') return <Deepseek width={14} height={14} variant="default" />;
  if (key === 'anysearch') {
    return <FaviconIcon src={anysearchIcon} alt="AnySearch" />;
  }
  if (key === 'firecrawl') {
    return <FaviconIcon src={firecrawlIcon} alt="Firecrawl" />;
  }
  if (key === '360' || key === 'so') {
    return <FaviconIcon src={so360Icon} alt="360" />;
  }
  if (key === 'mcp' || key === 'modelcontextprotocol' || key === 'model_context_protocol') {
    return <McpModelContextProtocol width={14} height={14} variant="default" />;
  }
  if (key === 'minimax') return <Minimax width={14} height={14} variant="default" />;
  return <Search className="w-3.5 h-3.5" />;
}

function getImageSourceIcon(source: string) {
  const key = source.trim().toLowerCase();
  if (key === 'tavily') return <Tavily width={14} height={14} variant="default" />;
  if (key === 'firecrawl') return <FaviconIcon src={firecrawlIcon} alt="Firecrawl" />;
  if (key === '360' || key === 'so') return <FaviconIcon src={so360Icon} alt="360" />;
  if (key === '插件图库' || key.includes('plugin') || key.includes('gallery')) {
    return (
      <PluginIcon
        pluginName="core_command"
        className="w-3.5 h-3.5 rounded-[2px]"
        fallbackClassName="w-3.5 h-3.5 text-muted-foreground"
      />
    );
  }
  return <Search className="w-3.5 h-3.5" />;
}

/** 多源策略 value（与后端 websearch_lb_strategy 一致） */
export type WebSearchLbStrategy = 'none' | 'error_switch' | 'auto_balance';

export interface WebSearchSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;

  websearchProvider: string;
  websearchProviderOptions: string[];

  /** 多源策略 */
  websearchLbStrategy: string;
  websearchLbStrategyOptions?: string[];
  /** 备用源顺序（多选有序） */
  websearchFallbackOrder: string[];
  websearchFallbackOptions?: string[];

  /** 出图配图来源。后端未下发该字段时不传，区块不渲染。 */
  renderImageSources?: string[];
  renderImageSourceOptions?: string[];
  /** 允许嵌入配图。后端未下发时不传。 */
  renderEmbedImages?: boolean;

  tavilyConfig?: { id: string; config: Record<string, PluginConfigItem> };
  exaConfig?: { id: string; config: Record<string, PluginConfigItem> };
  anysearchConfig?: { id: string; config: Record<string, PluginConfigItem> };
  firecrawlConfig?: { id: string; config: Record<string, PluginConfigItem> };
  jinaConfig?: { id: string; config: Record<string, PluginConfigItem> };
  deepseekConfig?: { id: string; config: Record<string, PluginConfigItem> };
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
  onChangeRenderImageSources?: (order: string[]) => void;
  onChangeRenderEmbedImages?: (enabled: boolean) => void;
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
  renderImageSources,
  renderImageSourceOptions,
  renderEmbedImages,
  onChangeRenderImageSources,
  onChangeRenderEmbedImages,
  tavilyConfig,
  exaConfig,
  anysearchConfig,
  firecrawlConfig,
  jinaConfig,
  deepseekConfig,
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
  const effectiveFallbacks = filterOutPrimaryProvider(websearchFallbackOrder, websearchProvider);

  /** Chip 展示用 value：主用不显示为已选；成员资格需用户显式勾选，切主用不自动恢复 */
  const fallbackChipValue = effectiveFallbacks;

  // 源配置卡片内的 provider 切换器：主用在首位，备用按顺序
  const panelProviders = showFallbackUi
    ? [websearchProvider, ...effectiveFallbacks]
    : [websearchProvider];
  const [selectedProvider, setSelectedProvider] = useState(websearchProvider);
  // 选中项失效（换主用 / 被移出备用顺序）时回落到主用
  const activePanelProvider = panelProviders.some((p) => sameProviderId(p, selectedProvider))
    ? selectedProvider
    : websearchProvider;

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
          // 旧 exa_config 可能仍带 search_type。Core 不读它，面板也不渲染。
          excludeKeys={['search_type']}
        />
      );
    }
    if (key === 'anysearch') {
      if (!anysearchConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={anysearchConfig.config}
          configId={anysearchConfig.id}
          onChange={onUpdateConfig}
        />
      );
    }
    if (key === 'firecrawl') {
      if (!firecrawlConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={firecrawlConfig.config}
          configId={firecrawlConfig.id}
          onChange={onUpdateConfig}
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
        />
      );
    }
    if (key === 'deepseek') {
      if (!deepseekConfig) {
        return (
          <p className="text-xs text-muted-foreground">
            {t('aiConfig.serviceProvider.configNotAvailable')}
          </p>
        );
      }
      return (
        <DynamicConfigPanel
          config={deepseekConfig.config}
          configId={deepseekConfig.id}
          onChange={onUpdateConfig}
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
        />
      );
    }
    if (key === 'mcp' || key === 'modelcontextprotocol' || key === 'model_context_protocol') {
      return (
        <div className="space-y-3">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {websearchToolInfo ? (
                <>
                  <Wrench className="w-3.5 h-3.5 shrink-0 text-primary" />
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
    <div className={pageStackClass}>
      {/* 搜索源：主用 / 多源策略 / 备用顺序 */}
      <ConfigCard
        icon={<Search className="w-5 h-5 text-primary" />}
        title={t('aiConfig.serviceProvider.webSearchService')}
        description={t('aiConfig.serviceProvider.webSearchServiceDesc')}
      >
        <ConfigGroupList>
          <ConfigGroup
            layout="inline"
            icon={<Layers className="w-4 h-4 text-muted-foreground" />}
            label={t('aiConfig.serviceProvider.primaryProvider')}
            description={t('aiConfig.serviceProvider.primaryProviderDesc')}
          >
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
          </ConfigGroup>

          <ConfigGroup
            layout="inline"
            icon={<GitBranch className="w-4 h-4 text-muted-foreground" />}
            label={t('aiConfig.serviceProvider.lbStrategy')}
            description={t('aiConfig.serviceProvider.lbStrategyDesc')}
          >
            <TabButtonGroup
              size="sm"
              value={websearchLbStrategy || 'error_switch'}
              onValueChange={(v) => onChangeLbStrategy(v || 'error_switch')}
              options={websearchLbStrategyOptions.map((s) => ({
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
              label={t('aiConfig.serviceProvider.fallbackOrder')}
              description={t('aiConfig.serviceProvider.fallbackOrderDesc')}
            >
              <ChipGroup
                options={fallbackOpts.map((p) => {
                  const isPrimary = sameProviderId(p, websearchProvider);
                  return {
                    value: p,
                    label: isPrimary ? `${p} (${t('aiConfig.serviceProvider.rolePrimary')})` : p,
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
            </ConfigGroup>
          )}
        </ConfigGroupList>
      </ConfigCard>

      {/* 源配置：主用 + 备用，TabButtonGroup 切换当前编辑的 provider */}
      <ConfigCard
        icon={<Settings2 className="w-5 h-5 text-primary" />}
        title={t('aiConfig.serviceProvider.sourceConfig')}
        description={t('aiConfig.serviceProvider.sourceConfigDesc')}
      >
        {panelProviders.length > 1 ? (
          <TabButtonGroup
            size="sm"
            value={activePanelProvider}
            onValueChange={setSelectedProvider}
            options={panelProviders.map((p, i) => ({
              value: p,
              label: p,
              icon: getSearchProviderIcon(p),
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
            {getSearchProviderIcon(websearchProvider)}
            <span className="text-sm font-medium">{websearchProvider}</span>
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

      {/* 卡片出图配图设置 */}
      {(onChangeRenderEmbedImages !== undefined ||
        (onChangeRenderImageSources &&
          renderImageSourceOptions &&
          renderImageSourceOptions.length > 0)) && (
        <ConfigCard
          icon={<Images className="w-5 h-5 text-primary" />}
          title={t('aiConfig.serviceProvider.renderCardSection')}
          description={t('aiConfig.serviceProvider.renderCardSectionDesc')}
        >
          <div
            className={cn(
              'space-y-4 transition-all duration-200',
              renderEmbedImages === false && 'opacity-80',
            )}
          >
            {/* 允许嵌入配图 主控开关行 */}
            {onChangeRenderEmbedImages !== undefined && (
              <SettingRow
                icon={
                  <Images
                    className={cn(
                      'w-4 h-4',
                      renderEmbedImages !== false ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                }
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    {t('aiConfig.serviceProvider.renderEmbedImages')}
                    <Badge
                      variant={renderEmbedImages !== false ? 'default' : 'secondary'}
                      className={cn(
                        'text-[10px] h-4.5 px-1.5 font-normal',
                        renderEmbedImages !== false &&
                          'bg-primary/15 text-primary hover:bg-primary/20 border-primary/20',
                      )}
                    >
                      {renderEmbedImages !== false ? t('common.enabled') : t('common.disabled')}
                    </Badge>
                  </span>
                }
                description={t('aiConfig.serviceProvider.renderEmbedImagesDesc')}
                control={
                  <Switch
                    checked={renderEmbedImages !== false}
                    onCheckedChange={onChangeRenderEmbedImages}
                    aria-label={t('aiConfig.serviceProvider.renderEmbedImages')}
                  />
                }
              />
            )}

            {/* 出图配图来源 优先级排序选择 */}
            {onChangeRenderImageSources &&
              renderImageSourceOptions &&
              renderImageSourceOptions.length > 0 &&
              (renderEmbedImages !== false ? (
                <ConfigGroup
                  layout="inline"
                  icon={<ListOrdered className="w-4 h-4 text-muted-foreground" />}
                  label={t('aiConfig.serviceProvider.renderImageSources')}
                  description={t('aiConfig.serviceProvider.renderImageSourcesDesc')}
                  className={cn(
                    onChangeRenderEmbedImages !== undefined && 'pt-4 border-t border-border/40',
                  )}
                >
                  <ChipGroup
                    options={renderImageSourceOptions.map((source) => ({
                      value: source,
                      label: source,
                      icon: getImageSourceIcon(source),
                    }))}
                    value={renderImageSources ?? []}
                    onValueChange={onChangeRenderImageSources}
                    selectMode="multiple"
                    allowEmpty
                    showOrderIndex
                  />
                </ConfigGroup>
              ) : (
                <div className="pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/80 py-0.5">
                    <Ban className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                    <span>{t('aiConfig.serviceProvider.renderEmbedImagesDisabledHint')}</span>
                  </div>
                </div>
              ))}
          </div>
        </ConfigCard>
      )}
    </div>
  );
}
