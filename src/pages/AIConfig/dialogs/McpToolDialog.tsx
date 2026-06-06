import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Ban, Check, Server, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MCPConfig } from '@/lib/api';
import type { McpServiceType } from '@/components/config';

export interface McpToolInfo {
  value: string;
  label: string;
  description: string;
  serverName: string;
  toolName: string;
}

export interface McpToolDialogProps {
  open: boolean;
  t: (key: string) => string;
  serviceType: McpServiceType;
  mcpConfigs: MCPConfig[];
  mcpToolOptions: McpToolInfo[];
  currentDialogMcpToolId: string;
  selectedMcpToolInfo: McpToolInfo | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (toolId: string) => void;
  onClear: () => void;
}

/**
 * 「MCP 工具选择」Dialog。
 *
 * - 顶部：当前已选工具概览 + 「清除」按钮
 * - 主体：按 MCP 服务分组列出所有工具
 * - 选中态：点击同一项即取消选择（与父组件 handleSelectMcpTool 配合）
 */
export function McpToolDialog({
  open,
  t,
  serviceType,
  mcpConfigs,
  mcpToolOptions,
  currentDialogMcpToolId,
  selectedMcpToolInfo,
  onOpenChange,
  onSelect,
  onClear,
}: McpToolDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            {t('aiConfig.mcpTool.selectTool')}
          </DialogTitle>
          <DialogDescription>
            {serviceType === 'websearch' && t('aiConfig.mcpTool.webSearchMcpTool')}
            {serviceType === 'image_understand' &&
              t('aiConfig.mcpTool.imageUnderstandMcpTool')}
            {serviceType === 'asr' && t('aiConfig.mcpTool.asrMcpTool')}
            {serviceType === 'document_extract' &&
              t('aiConfig.mcpTool.documentExtractMcpTool')}
            {serviceType === 'video_extract' &&
              t('aiConfig.mcpTool.videoExtractMcpTool')}
            {serviceType === 'video_understand' &&
              t('aiConfig.mcpTool.videoUnderstandMcpTool')}
          </DialogDescription>
        </DialogHeader>

        {currentDialogMcpToolId && selectedMcpToolInfo && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 text-primary">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">
                      {selectedMcpToolInfo.toolName}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 border-primary/20 text-primary bg-primary/5"
                    >
                      {selectedMcpToolInfo.serverName}
                    </Badge>
                  </div>
                  {selectedMcpToolInfo.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {selectedMcpToolInfo.description}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive h-7 px-2 shrink-0 gap-1"
                onClick={() => {
                  onClear();
                  onOpenChange(false);
                }}
              >
                <Ban className="h-3 w-3" />
                {t('aiConfig.mcpTool.clearTool')}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1 max-h-[50vh] overflow-y-auto">
          {mcpConfigs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Server className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {t('aiConfig.mcpTool.noMcpConfigs')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('aiConfig.mcpTool.noMcpConfigsDesc')}
              </p>
            </div>
          ) : mcpToolOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Wrench className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {t('aiConfig.mcpTool.noToolAssociated')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('aiConfig.mcpTool.noToolAssociatedDesc')}
              </p>
            </div>
          ) : (
            mcpConfigs.map((config) => {
              const configTools = config.tools;
              if (configTools.length === 0) return null;
              return (
                <div key={config.config_id} className="pb-2">
                  <div className="flex items-center gap-1.5 px-1 py-1.5">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {config.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] h-3.5 px-1 border-border/40 text-muted-foreground"
                    >
                      {configTools.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {configTools.map((tool) => {
                      const toolValue = `${config.config_id} - ${tool.name}`;
                      const isSelected = currentDialogMcpToolId === toolValue;
                      return (
                        <div
                          key={toolValue}
                          className={cn(
                            'p-2.5 rounded-lg border cursor-pointer transition-all',
                            isSelected
                              ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/10'
                              : 'border-border/30 hover:bg-muted/50 hover:border-border/50',
                          )}
                          onClick={() => onSelect(toolValue)}
                        >
                          <div className="flex items-start gap-2">
                            <Wrench
                              className={cn(
                                'h-3.5 w-3.5 shrink-0 mt-0.5',
                                isSelected
                                  ? 'text-primary'
                                  : 'text-muted-foreground',
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    'text-sm truncate',
                                    isSelected
                                      ? 'font-semibold text-primary'
                                      : 'font-medium',
                                  )}
                                >
                                  {tool.name}
                                </span>
                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                )}
                              </div>
                              {tool.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
