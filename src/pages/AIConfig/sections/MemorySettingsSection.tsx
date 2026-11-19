import { Brain, MemoryStick } from 'lucide-react';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { ConfigField, pluginConfigItemToFieldDef, type ConfigValue } from '@/components/config';
import { ConfigCard, ConfigGroup, fieldGridClass, SettingRow } from '../shared';
import type { PluginConfigItem } from '@/lib/api';

export interface MemorySettingsSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
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
    <div className={pageStackClass}>
      <ConfigCard>
        <SettingRow
          className="py-0"
          icon={<MemoryStick className="w-5 h-5 text-primary" />}
          title={t('aiConfig.memorySettings.enableMemory')}
          description={
            isMemoryEnabled
              ? t('aiConfig.memorySettings.enabledDesc')
              : t('aiConfig.memorySettings.disabledDesc')
          }
          control={<Switch checked={isMemoryEnabled} onCheckedChange={onToggleMemory} />}
        />

        {isMemoryEnabled &&
          (memoryConfig ? (
            <div className="border-t border-border/40 pt-4 space-y-4">
              {/* 记忆模式（记忆路径）- 保留原有 ChipGroup 多选样式 */}
              <ConfigGroup
                layout="inline"
                icon={<Brain className="w-4 h-4 text-muted-foreground" />}
                label={t('aiConfig.memorySettings.memoryMode')}
                description={memoryConfig.config.memory_mode?.desc}
              >
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
                  // 记忆路径支持全部关闭或按需开启任意子集（设计允许空数组）
                  allowEmpty
                />
              </ConfigGroup>

              {/* 其余配置项 - 一行三个，与高级设置一致 */}
              {otherEntries.length > 0 && (
                <div className={cn(fieldGridClass, 'border-t border-border/40 pt-4')}>
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
            <p className="border-t border-border/40 pt-4 text-sm text-muted-foreground">
              {t('aiConfig.memorySettings.noConfig')}
            </p>
          ))}
      </ConfigCard>
    </div>
  );
}
