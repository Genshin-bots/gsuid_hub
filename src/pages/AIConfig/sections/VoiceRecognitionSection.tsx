import { Cpu, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { McpParamMappingEditor } from '@/components/config';

export interface VoiceRecognitionSectionProps {
  t: (key: string) => string;
  aiConfigId: string;
  asrProvider: string;
  asrProviderOptions: string[];
  asrProviderDesc?: string;

  asrMcpToolId: string;
  asrToolInfo: {
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
 * 「语音识别」Section：
 * - 默认走 MCP 工具
 * - 选择 MCP 后展示已选工具 + 参数映射编辑器
 */
export function VoiceRecognitionSection({
  t,
  aiConfigId,
  asrProvider,
  asrProviderOptions,
  asrProviderDesc,
  asrMcpToolId,
  asrToolInfo,
  mcpDetails,
  onChangeProvider,
  onOpenMcpToolDialog,
  onClearMcpTool,
  onDetailValueChange,
  onMcpParamNameChange,
  onAddMcpDetailRow,
  onRemoveMcpDetailRow,
}: VoiceRecognitionSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Cpu className="w-5 h-5 text-primary" />
          {t('aiConfig.voiceRecognition.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {asrProviderDesc || t('aiConfig.voiceRecognition.providerDesc')}
        </p>
      </div>
      <ChipGroup
        options={asrProviderOptions.map((p) => ({
          value: p,
          label: p,
          icon: <Cpu className="w-3.5 h-3.5" />,
        }))}
        value={asrProvider ? [asrProvider] : []}
        onValueChange={(newValue) => onChangeProvider(newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />
      {asrProvider === 'MCP' && (
        <div className="pt-3 border-t border-border/30 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {asrToolInfo ? (
                <>
                  <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded-md bg-primary/10 text-primary">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {asrToolInfo.toolName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 border-primary/20 text-primary bg-primary/5 shrink-0"
                      >
                        {asrToolInfo.serverName}
                      </Badge>
                    </div>
                    {asrToolInfo.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {asrToolInfo.description}
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
              {asrMcpToolId && (
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
                {asrMcpToolId
                  ? t('aiConfig.mcpTool.switchTool')
                  : t('aiConfig.mcpTool.goAssociate')}
              </Button>
            </div>
          </div>
          {asrMcpToolId && (
            <McpParamMappingEditor
              configKey="asr_mcp_tool_id"
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
