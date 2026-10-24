import type { ReactNode } from 'react';
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
import {
  filterOutPrimaryProvider,
  HeadingWithHelp,
  LabelWithHelp,
  sameProviderId,
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
  t: (key: string) => string;

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

/** 主用 / 备用 配置区块外壳 */
function ConfigBlock({
  blockRole,
  title,
  icon,
  roleLabel,
  children,
  className,
}: {
  blockRole: 'primary' | 'fallback';
  title: string;
  icon?: ReactNode;
  roleLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const isPrimary = blockRole === 'primary';
  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3 glass-card transition-all',
        isPrimary ? 'border-primary/40' : 'border-dashed border-border/60',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge
          variant={isPrimary ? 'default' : 'outline'}
          className={cn('shrink-0 text-[10px] h-5 px-1.5', !isPrimary && 'text-muted-foreground')}
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
          onValueChange={(newValue) => onChangeLbStrategy(newValue[0] || 'error_switch')}
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
                label: isPrimary ? `${p} (${t('aiConfig.serviceProvider.rolePrimary')})` : p,
                icon: getSearchProviderIcon(p),
                // 主用：可见、禁用、不可勾选；不参与已选 / 不写入 fallback 字段
                disabled: isPrimary,
              };
            })}
            value={fallbackChipValue}
            onValueChange={(visibleSelected) => {
              // 绝不把当前主用写入 fallback_order（切换主用时由父级静默剔除）
              onChangeFallbackOrder(filterOutPrimaryProvider(visibleSelected, websearchProvider));
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
          blockRole="primary"
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
              blockRole="fallback"
              title={p}
              icon={getSearchProviderIcon(p)}
              roleLabel={t('aiConfig.serviceProvider.roleFallback')}
            >
              {renderProviderPanel(p)}
            </ConfigBlock>
          ))}
        </div>
      )}

      {/* 卡片出图配图设置 */}
      {(onChangeRenderEmbedImages !== undefined ||
        (onChangeRenderImageSources &&
          renderImageSourceOptions &&
          renderImageSourceOptions.length > 0)) && (
        <div className="space-y-2 pt-1 border-t border-border/30">
          <LabelWithHelp
            icon={<Images className="w-3.5 h-3.5 text-muted-foreground" />}
            label={t('aiConfig.serviceProvider.renderCardSection')}
            description={t('aiConfig.serviceProvider.renderCardSectionDesc')}
            className="text-xs font-medium text-muted-foreground"
          />
          <div
            className={cn(
              'rounded-lg border p-4 space-y-3.5 transition-all duration-200 glass-card',
              renderEmbedImages !== false ? 'border-border/60' : 'border-border/40 opacity-80',
            )}
          >
            {/* 允许嵌入配图 主控开关行 */}
            {onChangeRenderEmbedImages !== undefined && (
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5 transition-colors',
                      renderEmbedImages !== false
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Images className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {t('aiConfig.serviceProvider.renderEmbedImages')}
                      </span>
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
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('aiConfig.serviceProvider.renderEmbedImagesDesc')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={renderEmbedImages !== false}
                  onCheckedChange={onChangeRenderEmbedImages}
                  aria-label={t('aiConfig.serviceProvider.renderEmbedImages')}
                  className="shrink-0 mt-0.5"
                />
              </div>
            )}

            {/* 出图配图来源 优先级排序选择 */}
            {onChangeRenderImageSources &&
              renderImageSourceOptions &&
              renderImageSourceOptions.length > 0 &&
              (renderEmbedImages !== false ? (
                <div
                  className={cn(
                    'space-y-2',
                    onChangeRenderEmbedImages !== undefined && 'pt-3 border-t border-border/30',
                  )}
                >
                  <LabelWithHelp
                    icon={<ListOrdered className="w-3.5 h-3.5 text-muted-foreground" />}
                    label={t('aiConfig.serviceProvider.renderImageSources')}
                    description={t('aiConfig.serviceProvider.renderImageSourcesDesc')}
                    className="text-xs font-medium text-muted-foreground"
                  />
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
                </div>
              ) : (
                <div className="pt-3 border-t border-border/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/80 py-0.5">
                    <Ban className="w-3.5 h-3.5 shrink-0 text-muted-foreground/60" />
                    <span>{t('aiConfig.serviceProvider.renderEmbedImagesDisabledHint')}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
