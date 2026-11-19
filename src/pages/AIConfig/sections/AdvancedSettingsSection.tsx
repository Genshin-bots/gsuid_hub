import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import {
  ConfigField,
  pluginConfigItemToFieldDef,
  type ConfigFieldType,
  type ConfigValue,
} from '@/components/config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { ConfigCard, fieldGridClass } from '../shared';
import type { PluginConfigItem } from '@/lib/api';
import {
  ADVANCED_PRIMARY_GROUPS,
  EXPERT_TUNING_GROUPS,
  type AdvancedSettingGroup,
} from '../runtimeConfigKeys';

/**
 * 「高级设置」Section。
 *
 * 采用两段式白名单渲染：
 * - 上方主卡片展示普通部署者常用的 14 项配置（按场景分 4 组）
 * - 下方默认折叠的「专家调参」卡片展示开发 / 调试 / 运维用的 16 项配置
 */
export interface AdvancedSettingsSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  aiConfig: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

export function AdvancedSettingsSection({
  t,
  aiConfig,
  onUpdateConfig,
}: AdvancedSettingsSectionProps) {
  const [expertOpen, setExpertOpen] = useState(false);

  const renderField = (key: string, item: PluginConfigItem) => {
    let fieldDef = pluginConfigItemToFieldDef(key, item);
    if (key === 'multi_agent_lenth') {
      fieldDef = {
        ...fieldDef,
        label: t('aiConfig.advancedSettings.thinkingRounds'),
        type: 'select' as ConfigFieldType,
        options: ['9', '12', '20', '30'],
        value: String(fieldDef.value || '12'),
      };
    }
    return (
      <div key={key}>
        <ConfigField
          fieldKey={key}
          field={fieldDef}
          onChange={(fieldKey, value) => {
            const finalValue =
              fieldKey === 'multi_agent_lenth' && typeof value === 'string'
                ? parseInt(value, 10)
                : value;
            onUpdateConfig(aiConfig.id, fieldKey, finalValue);
          }}
        />
      </div>
    );
  };

  const resolveGroups = (groups: readonly AdvancedSettingGroup[]) =>
    groups
      .map((group) => ({
        ...group,
        entries: group.keys.flatMap((key) => {
          const item = aiConfig.config[key];
          return item ? ([[key, item]] as [string, PluginConfigItem][]) : [];
        }),
      }))
      .filter((group) => group.entries.length > 0);

  const primaryGroups = resolveGroups(ADVANCED_PRIMARY_GROUPS);
  const expertGroups = resolveGroups(EXPERT_TUNING_GROUPS);
  const expertCount = expertGroups.reduce((sum, g) => sum + g.entries.length, 0);
  const hasFavorSwitch = Boolean(aiConfig.config.favor_engine_enable);

  return (
    <div className={pageStackClass}>
      <ConfigCard>
        {primaryGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>{t('plugins.noConfigItems')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {primaryGroups.map((group, idx) => (
              <div
                key={group.id}
                className={idx > 0 ? 'border-t border-border/40 pt-5 space-y-3' : 'space-y-3'}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                    {t(group.labelKey)}
                  </h3>
                  {group.id === 'personaSafety' && hasFavorSwitch && (
                    <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
                      <Link to="/ai-artifacts?tab=relationship">
                        {t('aiConfig.relationshipSettings.openRuntime')}
                      </Link>
                    </Button>
                  )}
                </div>
                <div className={fieldGridClass}>
                  {group.entries.map(([key, item]) => renderField(key, item))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ConfigCard>

      {expertGroups.length > 0 && (
        <ConfigCard
          icon={<Wrench className="w-5 h-5 text-primary" />}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {t('aiConfig.advancedSettings.expertTitle')}
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                {t('aiConfig.advancedSettings.expertBadge', { count: expertCount })}
              </Badge>
            </span>
          }
          description={t('aiConfig.advancedSettings.expertDescription')}
          collapsible={{ open: expertOpen, onOpenChange: setExpertOpen }}
        >
          <div className="space-y-6 border-t border-border/40 pt-4">
            {expertGroups.map((group, idx) => (
              <div
                key={group.id}
                className={idx > 0 ? 'border-t border-border/40 pt-5 space-y-3' : 'space-y-3'}
              >
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {t(group.labelKey)}
                </h3>
                <div className={fieldGridClass}>
                  {group.entries.map(([key, item]) => renderField(key, item))}
                </div>
              </div>
            ))}
          </div>
        </ConfigCard>
      )}
    </div>
  );
}
