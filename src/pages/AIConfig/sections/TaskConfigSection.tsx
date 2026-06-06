import {
  AlertTriangle,
  ListChecks,
  Plus,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ConfigSelectDropdown } from '@/components/config';
import { cn } from '@/lib/utils';
import type { AllConfigItem } from '@/lib/api';

export interface TaskConfigSectionProps {
  t: (key: string) => string;
  isGlass: boolean;
  allConfigsList: AllConfigItem[];
  highLevelConfig: string;
  lowLevelConfig: string;
  isHighLevelConfigValid: boolean;
  isLowLevelConfigValid: boolean;
  onSetHighLevelConfig: (fullName: string) => void;
  onSetLowLevelConfig: (fullName: string) => void;
  onOpenManageDialog: () => void;
}

/**
 * 任务配置 Section。
 * 负责展示：
 * 1. 「当前没有配置文件」的红色空状态 + 入口按钮
 * 2. 高级任务配置（high_level_config）
 * 3. 低级任务配置（low_level_config）
 */
export function TaskConfigSection({
  t,
  isGlass,
  allConfigsList,
  highLevelConfig,
  lowLevelConfig,
  isHighLevelConfigValid,
  isLowLevelConfigValid,
  onSetHighLevelConfig,
  onSetLowLevelConfig,
  onOpenManageDialog,
}: TaskConfigSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <ListChecks className="w-5 h-5 text-primary" />
            {t('aiConfig.taskConfig.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.taskConfig.description')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 whitespace-nowrap text-xs"
          onClick={onOpenManageDialog}
        >
          <Settings className="w-3.5 h-3.5" />
          {t('aiConfig.manageConfig')}
        </Button>
      </div>

      {allConfigsList.length === 0 ? (
        <div
          className={cn(
            'rounded-xl p-4',
            isGlass
              ? 'border border-red-500/50 bg-red-500/10 dark:bg-red-950/50 dark:border-red-800/60'
              : 'border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950',
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {t('aiConfig.providerConfig.noConfigFileTitle')}
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                {t('aiConfig.taskConfig.emptyHint')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 gap-1.5 text-xs"
                onClick={onOpenManageDialog}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('aiConfig.openaiConfig.createNew')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 高级任务 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t('aiConfig.providerConfig.highLevelTask')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('aiConfig.providerConfig.highLevelTaskDesc')}
            </p>
            <ConfigSelectDropdown
              items={allConfigsList}
              selectedName={highLevelConfig}
              onSelect={onSetHighLevelConfig}
            />
            {!isHighLevelConfigValid && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t('aiConfig.taskConfig.notSelectedWarning')}
              </p>
            )}
          </div>
          <Separator className="bg-border/30" />
          {/* 低级任务 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">
                {t('aiConfig.providerConfig.lowLevelTask')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('aiConfig.providerConfig.lowLevelTaskDesc')}
            </p>
            <ConfigSelectDropdown
              items={allConfigsList}
              selectedName={lowLevelConfig}
              onSelect={onSetLowLevelConfig}
            />
            {!isLowLevelConfigValid && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t('aiConfig.taskConfig.notSelectedWarning')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
