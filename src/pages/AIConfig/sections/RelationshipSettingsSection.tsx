import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { ConfigField, pluginConfigItemToFieldDef, type ConfigValue } from '@/components/config';
import { Button } from '@/components/ui/button';
import type { PluginConfigItem } from '@/lib/api';
import { RELATIONSHIP_CONFIG_KEYS } from '../runtimeConfigKeys';

export interface RelationshipSettingsSectionProps {
  t: (key: string) => string;
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Heart className="h-5 w-5 text-muted-foreground" />
            {t('aiConfig.relationshipSettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.relationshipSettings.description')}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 shrink-0" asChild>
          <Link to="/ai-runtime?tab=relationship">
            {t('aiConfig.relationshipSettings.openRuntime')}
          </Link>
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 rounded-lg glass-card glass-alert border border-border/30">
          {t('aiConfig.relationshipSettings.empty')}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
