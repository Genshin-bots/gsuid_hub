import { FileText, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { McpParamMappingEditor } from '@/components/config';

export interface DocumentExtractSectionProps {
  t: (key: string) => string;
  aiConfigId: string;
  documentExtractProvider: string;
  documentExtractProviderOptions: string[];
  documentExtractProviderDesc?: string;

  documentExtractMcpToolId: string;
  documentExtractToolInfo: {
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
 * 「文档提取」Section：与语音识别结构完全对称。
 * 默认走 MCP 工具，可选地显示已选工具和参数映射。
 */
export function DocumentExtractSection({
  t,
  aiConfigId,
  documentExtractProvider,
  documentExtractProviderOptions,
  documentExtractProviderDesc,
  documentExtractMcpToolId,
  documentExtractToolInfo,
  mcpDetails,
  onChangeProvider,
  onOpenMcpToolDialog,
  onClearMcpTool,
  onDetailValueChange,
  onMcpParamNameChange,
  onAddMcpDetailRow,
  onRemoveMcpDetailRow,
}: DocumentExtractSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-primary" />
          {t('aiConfig.documentExtract.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {documentExtractProviderDesc || t('aiConfig.documentExtract.providerDesc')}
        </p>
      </div>
      <ChipGroup
        options={documentExtractProviderOptions.map((p) => ({
          value: p,
          label: p,
          icon: <FileText className="w-3.5 h-3.5" />,
        }))}
        value={documentExtractProvider ? [documentExtractProvider] : []}
        onValueChange={(newValue) => onChangeProvider(newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />
      {documentExtractProvider === 'MCP' && (
        <div className="pt-3 border-t border-border/30 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {documentExtractToolInfo ? (
                <>
                  <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded-md bg-primary/10 text-primary">
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {documentExtractToolInfo.toolName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1 border-primary/20 text-primary bg-primary/5 shrink-0"
                      >
                        {documentExtractToolInfo.serverName}
                      </Badge>
                    </div>
                    {documentExtractToolInfo.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {documentExtractToolInfo.description}
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
              {documentExtractMcpToolId && (
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
                {documentExtractMcpToolId
                  ? t('aiConfig.mcpTool.switchTool')
                  : t('aiConfig.mcpTool.goAssociate')}
              </Button>
            </div>
          </div>
          {documentExtractMcpToolId && (
            <McpParamMappingEditor
              configKey="document_extract_mcp_tool_id"
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
