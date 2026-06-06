import { Brain, CheckCircle, ChevronRight, HelpCircle, MemoryStick, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, type ConfigValue } from '@/components/config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToggleRow } from '../shared/ToggleRow';
import type { PluginConfigItem } from '@/lib/api';

export interface MemorySettingsSectionProps {
  t: (key: string) => string;
  aiConfigId: string;
  isMemoryEnabled: boolean;
  memoryConfig?: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
  onToggleMemory: (checked: boolean) => void;
}

/**
 * 「记忆设置」Section：
 * - 总开关：是否启用记忆（写入 aiConfig.enable_memory）
 * - 记忆模式：被动感知 / 主动会话（多选）
 * - 通过 DynamicConfigPanel 渲染其余字段，并附带 System-2 / Eval-Mode 两个 ToggleRow
 */
export function MemorySettingsSection({
  t,
  aiConfigId,
  isMemoryEnabled,
  memoryConfig,
  onUpdateConfig,
  onToggleMemory,
}: MemorySettingsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <MemoryStick className="w-5 h-5 text-primary" />
            {t('aiConfig.memorySettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.memorySettings.description')}
          </p>
        </div>
        <Switch
          checked={isMemoryEnabled}
          onCheckedChange={onToggleMemory}
        />
      </div>

      {!isMemoryEnabled ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          <ChevronRight className="w-4 h-4" />
          <span>{t('aiConfig.memorySettings.disabledDesc')}</span>
        </div>
      ) : memoryConfig ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">
                {t('aiConfig.memorySettings.memoryMode')}
              </Label>
              {memoryConfig.config.memory_mode?.desc && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none"
                        onClick={(e) => e.preventDefault()}
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{memoryConfig.config.memory_mode.desc}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <ChipGroup
              options={(
                memoryConfig.config.memory_mode?.options || ['被动感知', '主动会话']
              ).map((p: string) => ({
                value: p,
                label: p,
                icon: <Brain className="w-3.5 h-3.5" />,
              }))}
              value={(memoryConfig.config.memory_mode?.value as string[]) || []}
              onValueChange={(newValue) =>
                onUpdateConfig(memoryConfig.id, 'memory_mode', newValue)
              }
            />
          </div>

          <div className="pt-2">
            <DynamicConfigPanel
              config={memoryConfig.config}
              configId={memoryConfig.id}
              onChange={onUpdateConfig}
              excludeKeys={['memory_mode', 'enable_system2', 'eval_mode']}
              layout={[['memory_session', 'retrieval_top_k']]}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-border/20">
            <ToggleRow
              icon={<CheckCircle className="w-5 h-5" strokeWidth={1.5} />}
              iconColorClass="text-primary"
              title={t('aiConfig.memorySettings.enableSystem2')}
              description={
                t('aiConfig.memorySettings.enableSystem2Desc') ||
                '提高检索精度但增加延迟'
              }
              checked={
                (memoryConfig.config.enable_system2?.value as boolean) ?? true
              }
              onCheckedChange={(checked) =>
                onUpdateConfig(memoryConfig.id, 'enable_system2', checked)
              }
            />
            <ToggleRow
              icon={<Sparkles className="w-5 h-5" strokeWidth={1.5} />}
              iconColorClass="text-primary"
              title={t('aiConfig.memorySettings.evalMode')}
              description={
                t('aiConfig.memorySettings.evalModeDesc') ||
                '启用后无法使用 System-2 和 Rerank'
              }
              checked={
                (memoryConfig.config.eval_mode?.value as boolean) ?? false
              }
              onCheckedChange={(checked) =>
                onUpdateConfig(memoryConfig.id, 'eval_mode', checked)
              }
            />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          {t('aiConfig.memorySettings.noConfig')}
        </div>
      )}
    </div>
  );
}
