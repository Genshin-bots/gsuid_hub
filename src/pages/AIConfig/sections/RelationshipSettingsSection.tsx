import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { ConfigField, pluginConfigItemToFieldDef, type ConfigValue } from '@/components/config';
import { Button } from '@/components/ui/button';
import { ConfigCard, fieldGridClass } from '../shared';
import type { PluginConfigItem } from '@/lib/api';
import { RELATIONSHIP_CONFIG_KEYS } from '../runtimeConfigKeys';

export interface RelationshipSettingsSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  aiConfig: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

export function RelationshipSettingsSection({
  t,
  aiConfig,
  onUpdateConfig,
}: RelationshipSettingsSectionProps) {
  const entries = RELATIONSHIP_CONFIG_KEYS.flatMap((key) => {
    const item = aiConfig.config[key];
    return item ? ([[key, item]] as [string, PluginConfigItem][]) : [];
  });

  return (
    <ConfigCard
      icon={<Heart className="w-5 h-5 text-primary" />}
      title={t('aiConfig.relationshipSettings.title')}
      description={t('aiConfig.relationshipSettings.description')}
      actions={
        <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" asChild>
          <Link to="/ai-artifacts?tab=relationship">
            {t('aiConfig.relationshipSettings.openRuntime')}
          </Link>
        </Button>
      }
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aiConfig.relationshipSettings.empty')}</p>
      ) : (
        <div className={fieldGridClass}>
          {entries.map(([key, item]) => (
            <ConfigField
              key={key}
              fieldKey={key}
              field={pluginConfigItemToFieldDef(key, item)}
              onChange={(fieldKey, value) => onUpdateConfig(aiConfig.id, fieldKey, value)}
            />
          ))}
        </div>
      )}
    </ConfigCard>
  );
}
