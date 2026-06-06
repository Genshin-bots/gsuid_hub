import { AlertTriangle, Eye, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { McpParamMappingEditor } from '@/components/config';
import { cn } from '@/lib/utils';

export interface ImageUnderstandSectionProps {
  t: (key: string) => string;
  isGlass: boolean;

  /** 提供方当前值与候选 */
  imageUnderstandProvider: string;
  imageUnderstandProviderOptions: string[];
  /** 任务模型是否缺少图片能力（决定是否显示警告） */
  taskModelLacksImage: boolean;
  /** 描述（来自 schema） */
  providerDesc?: string;

  /** MCP 工具信息 */
  imageUnderstandMcpToolId: string;
  imageUnderstandToolInfo: {
    toolName: string;
    serverName: string;
    description: string;
  } | null;
  mcpDetails: Record<string, string | number | boolean | null>;

  onChangeProvider: (provider: string) => void;
  onOpenMcpToolDialog: () => void;
  onClearMcpTool: () => void;
  onDetailValueChange: (mcpParamName: string, value: string | number | boolean | null) => void;
  onMcpParamNameChange: (oldName: string, newName: string) => void;
  onAddMcpDetailRow: () => void;
  onRemoveMcpDetailRow: (mcpParamName: string) => void;
}

/**
 * 「图片理解」Section：
 * - 默认走 MCP 工具
 * - 若高/低级任务模型都缺少 image 能力且未设置 image_understand_provider，提示警告
 */
export function ImageUnderstandSection({
  t,
  isGlass,
  imageUnderstandProvider,
  imageUnderstandProviderOptions,
  taskModelLacksImage,
  providerDesc,
  imageUnderstandMcpToolId,
  imageUnderstandToolInfo,
  mcpDetails,
  onChangeProvider,
  onOpenMcpToolDialog,
  onClearMcpTool,
  onDetailValueChange,
  onMcpParamNameChange,
  onAddMcpDetailRow,
  onRemoveMcpDetailRow,
}: ImageUnderstandSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Eye className="w-5 h-5 text-primary" />
          {t('aiConfig.imageUnderstand.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {providerDesc || t('aiConfig.imageUnderstand.providerDesc')}
        </p>
      </div>

      {taskModelLacksImage && !imageUnderstandProvider && (
        <div
          className={cn(
            'rounded-lg p-3 flex items-start gap-2',
            isGlass
              ? 'border border-red-500/50 bg-red-500/10'
              : 'border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950',
          )}
        >
          <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">
            {t('aiConfig.imageUnderstand.modelNoImageWarning')}
          </p>
        </div>
      )}

      <ChipGroup
        options={imageUnderstandProviderOptions.map((p) => ({
          value: p,
          label: p,
          icon: <Eye className="w-3.5 h-3.5" />,
        }))}
        value={imageUnderstandProvider ? [imageUnderstandProvider] : []}
        onValueChange={(newValue) => onChangeProvider(newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />

      {imageUnderstandProvider === 'MCP' && (
        <div className="pt-3 border-t border-border/30 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {imageUnderstandToolInfo ? (
                <>
                  <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded-md bg-primary/10 text-primary">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {imageUnderstandToolInfo.toolName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 border-primary/20 text-primary bg-primary/5 shrink-0"
                      >
                        {imageUnderstandToolInfo.serverName}
                      </Badge>
                    </div>
                    {imageUnderstandToolInfo.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {imageUnderstandToolInfo.description}
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
              {imageUnderstandMcpToolId && (
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
                {imageUnderstandMcpToolId
                  ? t('aiConfig.mcpTool.switchTool')
                  : t('aiConfig.mcpTool.goAssociate')}
              </Button>
            </div>
          </div>
          {imageUnderstandMcpToolId && (
            <McpParamMappingEditor
              configKey="image_understand_mcp_tool_id"
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
