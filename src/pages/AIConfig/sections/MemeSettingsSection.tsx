import { ChevronRight, Smile, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DynamicConfigPanel, type ConfigValue } from '@/components/config';
import { ToggleRow } from '../shared/ToggleRow';
import type { PluginConfigItem } from '@/lib/api';

export interface MemeSettingsSectionProps {
  t: (key: string) => string;
  memeConfig?: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

/**
 * 「表情包设置」Section：
 * - 总开关：meme_enable
 * - 启用后展示 DynamicConfigPanel 与自动收集 ToggleRow
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
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
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
          <DynamicConfigPanel
            config={memeConfig.config}
            configId={memeConfig.id}
            onChange={onUpdateConfig}
            excludeKeys={['meme_enable', 'meme_auto_collect']}
            layout={[
              ['meme_max_file_kb', 'meme_daily_collect_limit'],
              ['meme_min_width', 'meme_min_height'],
              ['meme_vlm_semaphore', 'meme_tag_interval_sec'],
              ['meme_nsfw_threshold', 'meme_send_cooldown_sec'],
              ['meme_recent_exclude_count'],
            ]}
          />
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
