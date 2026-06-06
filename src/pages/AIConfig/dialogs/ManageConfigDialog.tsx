import { FileText, Plus, Settings, Trash2, X } from 'lucide-react';
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
import { EmptyState } from '../shared/EmptyState';
import { cn } from '@/lib/utils';
import { Server } from 'lucide-react';
import type { AllConfigItem } from '@/lib/api';

export interface ManageConfigDialogProps {
  open: boolean;
  t: (key: string) => string;
  allConfigsList: AllConfigItem[];
  highLevelConfig: string;
  lowLevelConfig: string;
  onOpenChange: (open: boolean) => void;
  onOpenCreate: () => void;
  onOpenEdit: (configName: string, provider: string) => void;
  onOpenDelete: (configName: string, provider: string) => void;
}

/**
 * 「管理配置文件」Dialog。
 * 展示当前所有 provider config，支持：
 * - 点击「编辑」跳到 EditConfigDialog
 * - 点击「删除」跳到 DeleteConfigDialog
 * - 点击「新建」跳到 CreateConfigDialog
 */
export function ManageConfigDialog({
  open,
  t,
  allConfigsList,
  highLevelConfig,
  lowLevelConfig,
  onOpenChange,
  onOpenCreate,
  onOpenEdit,
  onOpenDelete,
}: ManageConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('aiConfig.manageConfig')}
          </DialogTitle>
          <DialogDescription>{t('aiConfig.manageConfigDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
          {allConfigsList.length === 0 ? (
            <EmptyState
              icon={<Server className="w-8 h-8 text-muted-foreground/50" />}
              title={t('aiConfig.openaiConfig.noConfig')}
              description={t('aiConfig.taskConfig.emptyHint')}
            />
          ) : (
            allConfigsList.map((configItem) => {
              const usedByHigh = configItem.name === highLevelConfig;
              const usedByLow = configItem.name === lowLevelConfig;
              return (
                <div
                  key={`manage-${configItem.name}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border/50 bg-card/50"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {configItem.config_name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-4 px-1.5',
                            configItem.provider === 'openai'
                              ? 'border-primary/40 text-primary bg-primary/10'
                              : 'border-orange-500/40 text-orange-600 bg-orange-500/10',
                          )}
                        >
                          {configItem.provider === 'openai'
                            ? 'OpenAI'
                            : configItem.provider === 'anthropic'
                              ? 'Anthropic'
                              : configItem.provider}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {configItem.model_name}
                        </span>
                        {usedByHigh && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {t('aiConfig.providerConfig.highLevel')}
                          </Badge>
                        )}
                        {usedByLow && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {t('aiConfig.providerConfig.lowLevel')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onOpenEdit(configItem.config_name, configItem.provider)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onOpenDelete(configItem.config_name, configItem.provider)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onOpenCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('aiConfig.openaiConfig.createNew')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-3.5 h-3.5" />
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
