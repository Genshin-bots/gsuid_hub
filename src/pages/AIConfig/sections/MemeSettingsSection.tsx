import { ChevronRight, Smile, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  ConfigField,
  pluginConfigItemToFieldDef,
  type ConfigValue,
} from '@/components/config';
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

/** 表情包页面独自处理的字段（不放入 3 列 grid 统一渲染） */
const EXCLUDED_KEYS: string[] = ['meme_enable', 'meme_auto_collect'];

/**
 * 「表情包设置」Section。
 *
 * 布局与「高级设置」保持一致：使用 `grid gap-6 sm:grid-cols-2 lg:grid-cols-3` 三列网格
 * + 单个 `<ConfigField>` 逐字段渲染，复用 /plugins 页面的「插件参数配置」视觉。
 *
 * - 总开关：meme_enable
 * - 启用后展示「自动收集」开关 + 其余字段（3 列 grid 渲染）
 *
 * 当 memeConfig 缺失时返回 null（侧边栏会同步隐藏入口）。
 */
export function MemeSettingsSection({
  t,
  memeConfig,
  onUpdateConfig,
}: MemeSettingsSectionProps) {
  if (!memeConfig) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <Smile className="w-5 h-5 text-primary" />
            {t('aiConfig.memeSettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.memeSettings.description')}
          </p>
        </div>
        <Switch
          checked={(memeConfig.config.meme_enable?.value as boolean) ?? false}
          onCheckedChange={(checked) =>
            onUpdateConfig(memeConfig.id, 'meme_enable', checked)
          }
        />
      </div>

      {memeConfig.config.meme_enable?.value ? (
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-border/30 bg-muted/20">
            <ToggleRow
              icon={<Sparkles className="w-5 h-5" strokeWidth={1.5} />}
              iconColorClass="text-primary"
              title={t('aiConfig.memeSettings.autoCollect')}
              description={t('aiConfig.memeSettings.autoCollectDesc')}
              checked={
                (memeConfig.config.meme_auto_collect?.value as boolean) ?? false
              }
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
                  <div
                    key={key}
                    className={isDivider ? 'col-span-full' : undefined}
                  >
                    <ConfigField
                      fieldKey={key}
                      field={fieldDef}
                      onChange={(fieldKey, value) =>
                        onUpdateConfig(memeConfig.id, fieldKey, value)
                      }
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          <ChevronRight className="w-4 h-4" />
          <span>{t('aiConfig.memeSettings.enableMemeDesc')}</span>
        </div>
      )}
    </div>
  );
}
