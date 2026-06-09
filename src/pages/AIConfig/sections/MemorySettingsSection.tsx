import { Brain, ChevronRight, HelpCircle, MemoryStick } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import {
  ConfigField,
  pluginConfigItemToFieldDef,
  type ConfigValue,
} from '@/components/config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
 * - 记忆模式（记忆路径）：保留原有 ChipGroup 多选样式
 * - 其余配置项：复用 pluginConfigItemToFieldDef + ConfigField 三列网格布局
 */
export function MemorySettingsSection({
  t,
  aiConfigId,
  isMemoryEnabled,
  memoryConfig,
  onUpdateConfig,
  onToggleMemory,
}: MemorySettingsSectionProps) {
  // 获取除 memory_mode（记忆路径）以外的所有配置项
  const otherEntries = memoryConfig
    ? Object.entries(memoryConfig.config).filter(([key]) => key !== 'memory_mode')
    : [];

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
          {/* 记忆模式（记忆路径）- 保留原有 ChipGroup 多选样式 */}
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

          {/* 其余配置项 - 复用三列网格布局，与高级设置/插件参数配置一致 */}
          {otherEntries.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {otherEntries.map(([key, item]) => {
                const fieldDef = pluginConfigItemToFieldDef(key, item);
                const isDivider = fieldDef.type === 'divider';
                return (
                  <div key={key} className={isDivider ? 'col-span-full' : undefined}>
                    <ConfigField
                      fieldKey={key}
                      field={fieldDef}
                      onChange={(fieldKey, value) =>
                        onUpdateConfig(memoryConfig.id, fieldKey, value)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          {t('aiConfig.memorySettings.noConfig')}
        </div>
      )}
    </div>
  );
}
