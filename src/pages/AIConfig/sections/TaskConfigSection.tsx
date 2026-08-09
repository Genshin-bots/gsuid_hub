import {
  AlertTriangle,
  ListChecks,
  Plus,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfigSelectDropdown } from '@/components/config';
import { HeadingWithHelp, LabelWithHelp } from '../shared';
import { cn } from '@/lib/utils';
import type { AllConfigItem } from '@/lib/api';

export interface TaskConfigSectionProps {
  t: (key: string) => string;
  isGlass: boolean;
  allConfigsList: AllConfigItem[];
  highLevelConfig: string;
  lowLevelConfig: string;
  /**
   * 「高级任务 - 备用配置」。可选：后端老版本未下发此字段时为 `undefined`。
   * 命名上与 `lowLevel2ndConfig` 对称，二者都属于「主备双配置」。
   * 主配置用于正常请求；备用配置由后端策略在主配置失败 / 限流时切换。
   */
  highLevel2ndConfig: string;
  /**
   * 「低级任务 - 备用配置」。语义同上。
   */
  lowLevel2ndConfig: string;
  isHighLevelConfigValid: boolean;
  isLowLevelConfigValid: boolean;
  /**
   * 备用配置在 `allConfigsList` 中仍能找到对应项即视为合法。
   * 单独检查是为了让用户能区分「主配置缺失」「备用配置缺失」。
   */
  isHighLevel2ndConfigValid: boolean;
  isLowLevel2ndConfigValid: boolean;
  onSetHighLevelConfig: (fullName: string) => void;
  onSetLowLevelConfig: (fullName: string) => void;
  onSetHighLevel2ndConfig: (fullName: string) => void;
  onSetLowLevel2ndConfig: (fullName: string) => void;
  onOpenManageDialog: () => void;
}

/**
 * 任务配置 Section。
 * 负责展示：
 * 1. 「当前没有配置文件」的红色空状态 + 入口按钮
 * 2. 高级任务（含主 + 备用）
 * 3. 低级任务（含主 + 备用）
 *
 * 主备双配置语义：主配置用于正常请求；备用配置由后端策略在主配置
 * 失败 / 限流时切换，避免单点故障导致的全部请求失败。
 *
 * ⚠️ 重要：4 个值都通过框架配置 `updateConfigValue` 落库，由
 * `AIConfigPage.executeSave` 统一保存（不要走 provider_config
 * task_config 接口，因为该接口只接受 high/low，不支持 2nd 后缀）。
 */
export function TaskConfigSection({
  t,
  isGlass,
  allConfigsList,
  highLevelConfig,
  lowLevelConfig,
  highLevel2ndConfig,
  lowLevel2ndConfig,
  isHighLevelConfigValid,
  isLowLevelConfigValid,
  isHighLevel2ndConfigValid,
  isLowLevel2ndConfigValid,
  onSetHighLevelConfig,
  onSetLowLevelConfig,
  onSetHighLevel2ndConfig,
  onSetLowLevel2ndConfig,
  onOpenManageDialog,
}: TaskConfigSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <HeadingWithHelp
          icon={<ListChecks className="w-5 h-5 text-primary" />}
          title={t('aiConfig.taskConfig.title')}
          subtitle={t('aiConfig.taskConfig.description')}
          className="mb-0 min-w-0"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 whitespace-nowrap text-xs shrink-0"
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
          {/* 高级任务：主 + 备用 */}
          <div className="space-y-3">
            <LabelWithHelp
              icon={<Sparkles className="w-4 h-4 text-primary" />}
              label={t('aiConfig.providerConfig.highLevelTask')}
              description={t('aiConfig.providerConfig.highLevelTaskDesc')}
            />
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
            <div className="pt-1 pl-1 space-y-2 border-l-2 border-primary/20 ml-1">
              <LabelWithHelp
                icon={
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                }
                label={t('aiConfig.providerConfig.highLevelTask2nd')}
                description={t('aiConfig.providerConfig.highLevelTask2ndDesc')}
                className="text-xs font-medium text-muted-foreground"
              />
              <ConfigSelectDropdown
                items={allConfigsList}
                selectedName={highLevel2ndConfig}
                onSelect={onSetHighLevel2ndConfig}
              />
              {!isHighLevel2ndConfigValid && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t('aiConfig.taskConfig.notSelectedWarning')}
                </p>
              )}
            </div>
          </div>
          <Separator className="bg-border/30" />
          {/* 低级任务：主 + 备用 */}
          <div className="space-y-3">
            <LabelWithHelp
              icon={<Zap className="w-4 h-4 text-primary" />}
              label={t('aiConfig.providerConfig.lowLevelTask')}
              description={t('aiConfig.providerConfig.lowLevelTaskDesc')}
            />
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
            <div className="pt-1 pl-1 space-y-2 border-l-2 border-primary/20 ml-1">
              <LabelWithHelp
                icon={<Zap className="w-3.5 h-3.5 text-muted-foreground" />}
                label={t('aiConfig.providerConfig.lowLevelTask2nd')}
                description={t('aiConfig.providerConfig.lowLevelTask2ndDesc')}
                className="text-xs font-medium text-muted-foreground"
              />
              <ConfigSelectDropdown
                items={allConfigsList}
                selectedName={lowLevel2ndConfig}
                onSelect={onSetLowLevel2ndConfig}
              />
              {!isLowLevel2ndConfigValid && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t('aiConfig.taskConfig.notSelectedWarning')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}