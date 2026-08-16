import { SlidersHorizontal } from 'lucide-react';
import {
  ConfigField,
  pluginConfigItemToFieldDef,
  type ConfigFieldType,
  type ConfigValue,
} from '@/components/config';
import type { PluginConfigItem } from '@/lib/api';
import { isKitSlotConfigKey, RUNTIME_EXCLUDED_KEYS } from '../runtimeConfigKeys';

/**
 * 「高级设置」Section。
 *
 * 它渲染 aiConfig.config 中除「已经在其它 section 中处理过的字段」以外的所有字段。
 * 例如：multi_agent_lenth（思考轮数）会从 select 类型升级为带预设选项的下拉框。
 */
export interface AdvancedSettingsSectionProps {
  t: (key: string) => string;
  aiConfig: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

/** 在其它 section 中已独占处理的字段 key 列表 */
const EXCLUDED_KEYS: string[] = [
  'enable',
  'enable_rerank',
  'enable_memory',
  // 网络搜索：WebSearchSection 专属
  'websearch_provider',
  'websearch_lb_strategy',
  'websearch_fallback_order',
  // 网页抓取：WebFetchSection 专属
  'webfetch_provider',
  'webfetch_lb_strategy',
  'webfetch_fallback_order',
  'image_understand_provider',
  'embedding_provider',
  'qdrant_provider',
  // 主备双配置：以下 4 个 key 均由 TaskConfigSection 专属渲染。
  // 保留在 EXCLUDED_KEYS 中是为了不与「任务配置」页面里的下拉框重复展示。
  'high_level_provider_config_name',
  'low_level_provider_config_name',
  'high_level_2nd_provider_config_name',
  'low_level_2nd_provider_config_name',
  'asr_provider',
  'tts_provider',
  'video_understand_provider',
  'document_extract_provider',
  'rerank_provider',
  ...RUNTIME_EXCLUDED_KEYS,
];

export function AdvancedSettingsSection({
  t,
  aiConfig,
  onUpdateConfig,
}: AdvancedSettingsSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          {t('aiConfig.advancedSettings.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.advancedSettings.description')}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(() => {
          const entries = Object.entries(aiConfig.config).filter(
            ([key]) => !EXCLUDED_KEYS.includes(key) && !isKitSlotConfigKey(key),
          );
          if (entries.length === 0) {
            return (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <p>{t('plugins.noConfigItems') || '暂无配置项'}</p>
              </div>
            );
          }
          return entries.map(([key, item]) => {
            let fieldDef = pluginConfigItemToFieldDef(key, item);
            if (key === 'multi_agent_lenth') {
              fieldDef = {
                ...fieldDef,
                label: t('aiConfig.advancedSettings.thinkingRounds') || '思考轮数',
                type: 'select' as ConfigFieldType,
                options: ['9', '12', '20', '30'],
                value: String(fieldDef.value || '12'),
              };
            }
            const isDivider = fieldDef.type === 'divider';
            return (
              <div key={key} className={isDivider ? 'col-span-full' : undefined}>
                <ConfigField
                  fieldKey={key}
                  field={fieldDef}
                  onChange={(fieldKey, value) => {
                    const finalValue =
                      fieldKey === 'multi_agent_lenth' && typeof value === 'string'
                        ? parseInt(value)
                        : value;
                    onUpdateConfig(aiConfig.id, fieldKey, finalValue);
                  }}
                />
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
