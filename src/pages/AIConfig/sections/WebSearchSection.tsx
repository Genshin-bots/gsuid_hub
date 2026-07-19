import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, McpParamMappingEditor, type ConfigValue } from '@/components/config';
import type { PluginConfigItem } from '@/lib/api';
import { Search, Wrench } from 'lucide-react';
import {
  Tavily,
  Exa,
  McpModelContextProtocol,
  Minimax,
} from '@thesvg/react';

/**
 * 网络搜索提供方 -> 品牌图标 的映射表。
 *
 * 与 ModelBrandIcon 的设计思路一致：
 * 1. 已知 provider 关键字映射到 @thesvg/react 的官方 Logo；
 * 2. 命中不到时回退到 lucide `Search`（保持旧行为）。
 *
 * icon className 由 ChipGroup 控制为 `w-3.5 h-3.5`，所有图标
 * 走 `mono` variant 以保证 currentColor 主题适配。
 */
function getSearchProviderIcon(provider: string) {
  const key = provider.trim().toLowerCase();
  if (key === 'tavily') return <Tavily width={14} height={14} variant="mono" />;
  if (key === 'exa') return <Exa width={14} height={14} variant="mono" />;
  if (key === 'mcp' || key === 'modelcontextprotocol' || key === 'model_context_protocol') {
    return <McpModelContextProtocol width={14} height={14} variant="mono" />;
  }
  if (key === 'MiniMax') return <Minimax width={14} height={14} variant="light" />;
  // 兜底
  return <Search className="w-3.5 h-3.5" />;
}

export interface WebSearchSectionProps {
  t: (key: string) => string;

  /** AI 配置 ID（用于回写 websearch_provider 字段） */
  aiConfigId: string;

  /** 搜索提供方当前值 */
  websearchProvider: string;
  /** 提供方候选值（来自后端 options 字段） */
  websearchProviderOptions: string[];

  /** 各提供方子配置（任一可能为 undefined） */
  tavilyConfig?: { id: string; config: Record<string, PluginConfigItem> };
  exaConfig?: { id: string; config: Record<string, PluginConfigItem> };
  miniMaxConfig?: { id: string; config: Record<string, PluginConfigItem> };

  /** MCP 工具相关 */
  websearchMcpToolId: string;
  websearchToolInfo: {
    toolName: string;
    serverName: string;
    description: string;
  } | null;
  mcpDetails: Record<string, string | number | boolean | null>;

  onChangeProvider: (provider: string) => void;
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
  onOpenMcpToolDialog: () => void;
  onClearMcpTool: () => void;
  onDetailValueChange: (mcpParamName: string, value: string | number | boolean | null) => void;
  onMcpParamNameChange: (oldName: string, newName: string) => void;
  onAddMcpDetailRow: () => void;
  onRemoveMcpDetailRow: (mcpParamName: string) => void;
}

/**
 * 「网络搜索服务」配置。
 * 提供方：Tavily / Exa / MiniMax / MCP 四选一。
 */
export function WebSearchSection({
  t,
  aiConfigId,
  websearchProvider,
  websearchProviderOptions,
  tavilyConfig,
  exaConfig,
  miniMaxConfig,
  websearchMcpToolId,
  websearchToolInfo,
  mcpDetails,
  onChangeProvider,
  onUpdateConfig,
  onOpenMcpToolDialog,
  onClearMcpTool,
  onDetailValueChange,
  onMcpParamNameChange,
  onAddMcpDetailRow,
  onRemoveMcpDetailRow,
}: WebSearchSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Search className="w-5 h-5 text-primary" />
          {t('aiConfig.serviceProvider.webSearchService')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.searchImage.description')}
        </p>
      </div>

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

      {websearchProvider === 'Tavily' && tavilyConfig && (
        <div className="pt-3 border-t border-border/30">
          <DynamicConfigPanel
            config={tavilyConfig.config}
            configId={tavilyConfig.id}
            onChange={onUpdateConfig}
            layout={[['api_key'], ['max_results', 'search_depth']]}
          />
        </div>
      )}

      {websearchProvider === 'Exa' && exaConfig && (
        <div className="pt-3 border-t border-border/30">
          <DynamicConfigPanel
            config={exaConfig.config}
            configId={exaConfig.id}
            onChange={onUpdateConfig}
            layout={[['api_key'], ['max_results', 'search_type']]}
          />
        </div>
      )}

      {websearchProvider === 'MiniMax' && miniMaxConfig && (
        <div className="pt-3 border-t border-border/30">
          <DynamicConfigPanel
            config={miniMaxConfig.config}
            configId={miniMaxConfig.id}
            onChange={onUpdateConfig}
            layout={[['api_key'], ['api_host', 'resource_mode']]}
          />
        </div>
      )}

      {websearchProvider === 'MCP' && (
        <div className="pt-3 border-t border-border/30 space-y-3">
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
          {/* 参数映射配置 */}
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
      )}
    </div>
  );
}
