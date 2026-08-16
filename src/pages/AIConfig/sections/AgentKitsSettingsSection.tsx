import { Link } from 'react-router-dom';
import { AlertTriangle, Puzzle } from 'lucide-react';
import {
  ConfigField,
  pluginConfigItemToFieldDef,
  type ConfigValue,
} from '@/components/config';
import { Button } from '@/components/ui/button';
import type { PluginConfigItem } from '@/lib/api';
import { AGENT_KITS_CONFIG_KEYS, isKitSlotConfigKey } from '../runtimeConfigKeys';

export interface AgentKitsSettingsSectionProps {
  t: (key: string) => string;
  aiConfig: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

function isSealedSlotOff(key: string, item: PluginConfigItem): boolean {
  const value = String(item.value ?? '').trim().toLowerCase();
  if (value !== 'off') return false;
  const blob = `${item.title ?? ''} ${item.desc ?? ''} ${key}`.toLowerCase();
  return blob.includes('密封') || blob.includes('sealed');
}

export function AgentKitsSettingsSection({
  t,
  aiConfig,
  onUpdateConfig,
}: AgentKitsSettingsSectionProps) {
  const topEntries = AGENT_KITS_CONFIG_KEYS.flatMap((key) => {
    const item = aiConfig.config[key];
    return item ? ([[key, item]] as [string, PluginConfigItem][]) : [];
  });
  const slotEntries = Object.entries(aiConfig.config).filter(([key]) =>
    isKitSlotConfigKey(key),
  );
  const sealedOff = slotEntries.filter(([key, item]) => isSealedSlotOff(key, item));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Puzzle className="w-5 h-5 text-primary" />
          {t('aiConfig.agentKitsSettings.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.agentKitsSettings.description')}
        </p>
        <Button variant="outline" size="sm" className="mt-3 h-9" asChild>
          <Link to="/ai-runtime?tab=slots">
            {t('aiConfig.agentKitsSettings.openRuntime')}
          </Link>
        </Button>
      </div>

      {topEntries.length === 0 && slotEntries.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          {t('aiConfig.agentKitsSettings.empty')}
        </div>
      ) : (
        <>
          {topEntries.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {topEntries.map(([key, item]) => (
                <div
                  key={key}
                  className={
                    key === 'allow_replace_sealed'
                      ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-3'
                      : undefined
                  }
                >
                  <ConfigField
                    fieldKey={key}
                    field={pluginConfigItemToFieldDef(key, item)}
                    onChange={(fieldKey, value) =>
                      onUpdateConfig(aiConfig.id, fieldKey, value)
                    }
                  />
                  {key === 'allow_replace_sealed' && (
                    <p className="mt-2 text-xs text-destructive">
                      {t('aiConfig.agentKitsSettings.allowReplaceSealedWarn')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {sealedOff.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-medium">
                  {t('aiConfig.agentKitsSettings.sealedOff')}
                </span>
              </div>
            </div>
          )}

          {slotEntries.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('aiConfig.agentKitsSettings.slotsTitle')}
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {slotEntries.map(([key, item]) => (
                  <div
                    key={key}
                    className={
                      isSealedSlotOff(key, item)
                        ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-3'
                        : undefined
                    }
                  >
                    <ConfigField
                      fieldKey={key}
                      field={pluginConfigItemToFieldDef(key, item)}
                      onChange={(fieldKey, value) =>
                        onUpdateConfig(aiConfig.id, fieldKey, value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
