import { Smile, Sparkles } from 'lucide-react';
import { ConfigField, pluginConfigItemToFieldDef, type ConfigValue } from '@/components/config';
import { ToggleRow } from '../shared';
import type { PluginConfigItem } from '@/lib/api';

export interface MemeSettingsSectionProps {
  t: (key: string) => string;
  memeConfig?: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

/** 自动采集单独一行，其余字段一行三个。 */
const EXCLUDED_KEYS: string[] = ['meme_auto_collect'];

/**
 * 「表情包设置」Section。
 * 是否允许回复里发表情，在每个人格的配置里。
 */
export function MemeSettingsSection({ t, memeConfig, onUpdateConfig }: MemeSettingsSectionProps) {
  if (!memeConfig) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <Smile className="w-5 h-5 text-primary" />
            {t('aiConfig.memeSettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('aiConfig.memeSettings.description')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-3 rounded-lg glass-card transition-all">
          <ToggleRow
            icon={<Sparkles className="w-5 h-5" strokeWidth={1.5} />}
            iconColorClass="text-primary"
            title={t('aiConfig.memeSettings.autoCollect')}
            description={t('aiConfig.memeSettings.autoCollectDesc')}
            checked={(memeConfig.config.meme_auto_collect?.value as boolean) ?? false}
            onCheckedChange={(checked) =>
              onUpdateConfig(memeConfig.id, 'meme_auto_collect', checked)
            }
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(() => {
            const entries = Object.entries(memeConfig.config).filter(
              ([key]) => !EXCLUDED_KEYS.includes(key),
            );
            if (entries.length === 0) {
              return (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <p>{t('plugins.noConfigItems') || '暂无配置项'}</p>
                </div>
              );
            }
            return entries.map(([key, item]) => {
              const fieldDef = pluginConfigItemToFieldDef(key, item);
              const isDivider = fieldDef.type === 'divider';
              return (
                <div key={key} className={isDivider ? 'col-span-full' : undefined}>
                  <ConfigField
                    fieldKey={key}
                    field={fieldDef}
                    onChange={(fieldKey, value) => onUpdateConfig(memeConfig.id, fieldKey, value)}
                  />
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
