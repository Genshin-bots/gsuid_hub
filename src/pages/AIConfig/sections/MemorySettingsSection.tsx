import { Brain, ChevronRight, MemoryStick } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { ConfigField, pluginConfigItemToFieldDef, type ConfigValue } from '@/components/config';
import { LabelWithHelp } from '../shared';
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
 * - 其余配置项：复用 pluginConfigItemToFieldDef + ConfigField，一行三个
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
    <div className="space-y-3 md:space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <MemoryStick className="w-5 h-5 text-primary" />
            {t('aiConfig.memorySettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.memorySettings.description')}
          </p>
        </div>
        <Switch checked={isMemoryEnabled} onCheckedChange={onToggleMemory} />
      </div>

      {!isMemoryEnabled ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg glass-card transition-all">
          <ChevronRight className="w-4 h-4" />
          <span>{t('aiConfig.memorySettings.disabledDesc')}</span>
        </div>
      ) : memoryConfig ? (
        <div className="space-y-3 md:space-y-4">
          {/* 记忆模式（记忆路径）- 保留原有 ChipGroup 多选样式 */}
          <div className="space-y-2">
            <LabelWithHelp
              icon={<Brain className="w-4 h-4 text-muted-foreground" />}
              label={t('aiConfig.memorySettings.memoryMode')}
              description={memoryConfig.config.memory_mode?.desc}
            />
            <ChipGroup
              options={(memoryConfig.config.memory_mode?.options || ['被动感知', '主动会话']).map(
                (p: string) => ({
                  value: p,
                  label: p,
                  icon: <Brain className="w-3.5 h-3.5" />,
                }),
              )}
              value={(memoryConfig.config.memory_mode?.value as string[]) || []}
              onValueChange={(newValue) => onUpdateConfig(memoryConfig.id, 'memory_mode', newValue)}
              // 记忆路径支持全部关闭或按需开启任意子集（设计允许空数组）
              allowEmpty
            />
          </div>

          {/* 其余配置项 - 一行三个，与高级设置一致 */}
          {otherEntries.length > 0 && (
            <div className="grid grid-cols-2 items-start gap-3 pt-2 md:gap-6 lg:grid-cols-3">
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
        <div className="text-sm text-muted-foreground p-4 rounded-lg glass-card glass-alert border border-border/30">
          {t('aiConfig.memorySettings.noConfig')}
        </div>
      )}
    </div>
  );
}
