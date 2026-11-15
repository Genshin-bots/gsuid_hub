import { Smile, Sparkles } from 'lucide-react';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { Switch } from '@/components/ui/switch';
import { ConfigField, pluginConfigItemToFieldDef, type ConfigValue } from '@/components/config';
import { ConfigCard, fieldGridClass, SettingRow } from '../shared';
import type { PluginConfigItem } from '@/lib/api';

export interface MemeSettingsSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
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
    <div className={pageStackClass}>
      <ConfigCard
        icon={<Smile className="w-5 h-5 text-primary" />}
        title={t('aiConfig.memeSettings.title')}
        description={t('aiConfig.memeSettings.description')}
      >
        <SettingRow
          icon={<Sparkles className="w-5 h-5 text-primary" strokeWidth={1.5} />}
          title={t('aiConfig.memeSettings.autoCollect')}
          description={t('aiConfig.memeSettings.autoCollectDesc')}
          control={
            <Switch
              checked={(memeConfig.config.meme_auto_collect?.value as boolean) ?? false}
              onCheckedChange={(checked) =>
                onUpdateConfig(memeConfig.id, 'meme_auto_collect', checked)
              }
            />
          }
        />

        <div className={`${fieldGridClass} border-t border-border/40 pt-4`}>
          {(() => {
            const entries = Object.entries(memeConfig.config).filter(
              ([key]) => !EXCLUDED_KEYS.includes(key),
            );
            if (entries.length === 0) {
              return (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <p>{t('plugins.noConfigItems')}</p>
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
      </ConfigCard>
    </div>
  );
}
