import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfigField, ConfigFieldDefinition, ConfigFieldType, ConfigValue } from '@/components/config/ConfigField';
import { AlertTriangle, CheckCircle, Settings, X } from 'lucide-react';
import { toast } from 'sonner';
import { configApi, CoreConfigOptionMeta } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { PinnedPage } from '@/components/layout/PinnedPage';

// Define types for core config
interface CoreConfig {
  HOST: string;
  PORT: string;
  ENABLE_HTTP: boolean;
  WS_TOKEN: string;
  TRUSTED_IPS: string[];
  masters: string[];
  superusers: string[];
  misfire_grace_time: number;
  log: {
    level: string;
    output: string[];
    module: boolean;
  };
  enable_empty_start: boolean;
  command_start: string[];
  [key: string]: unknown;
}

// i18n key mapping for config fields
const fieldLabelKeys: Record<string, string> = {
  default_bg: 'coreFrameworkConfig.defaultBg',
  log_level: 'coreFrameworkConfig.logLevel',
  log_output: 'coreFrameworkConfig.logOutput',
  log_module: 'coreFrameworkConfig.showModuleLog',
  HOST: 'coreFrameworkConfig.host',
  PORT: 'coreFrameworkConfig.port',
  ENABLE_HTTP: 'coreFrameworkConfig.enableHttp',
  WS_TOKEN: 'coreFrameworkConfig.wsToken',
  REGISTER_CODE: 'coreFrameworkConfig.registerCode',
  LANGUAGE: 'coreFrameworkConfig.language',
  TRUSTED_IPS: 'coreFrameworkConfig.trustedIps',
  masters: 'coreFrameworkConfig.masters',
  superusers: 'coreFrameworkConfig.superusers',
  misfire_grace_time: 'coreFrameworkConfig.misfireGraceTime',
  enable_empty_start: 'coreFrameworkConfig.emptyStart',
  command_start: 'coreFrameworkConfig.commandPrefix',
  web_max_sessions: 'coreFrameworkConfig.webMaxSessions'
};

// 字段的描述文案 key（仅 UI 说明，静态、不随可选值增减而变）
const fieldDescKeys: Record<string, string> = {
  LANGUAGE: 'coreFrameworkConfig.languageDesc',
  web_max_sessions: 'coreFrameworkConfig.webMaxSessionsDesc',
};

// Convert API config to field definition
const apiConfigToFieldDefinition = (
  key: string,
  value: unknown,
  optionsMeta?: Record<string, CoreConfigOptionMeta>
): ConfigFieldDefinition => {
  const labelKey = fieldLabelKeys[key] || `coreConfig.${key}`;

  // 后端下发的枚举元数据优先：按后端声明的控件类型 + 可选值 + 标签渲染。
  // 这样新增语言 / 日志级别等只需改后端声明，前端无需重新构建即可适配。
  const meta = optionsMeta?.[key];
  if (meta && Array.isArray(meta.options) && meta.options.length > 0) {
    const metaType = (meta.type as ConfigFieldType) || 'strictselect';
    return {
      type: metaType,
      label: labelKey,
      // multiselect 的值是数组，不能被 String() 压扁
      value: metaType === 'multiselect'
        ? (Array.isArray(value) ? (value as string[]) : [])
        : String(value ?? meta.options[0]),
      options: meta.options,
      optionLabels: meta.labels,
      description: fieldDescKeys[key],
    };
  }

  if (key === 'default_bg') {
    return {
      type: 'image',
      label: labelKey,
      value: value as string,
      upload_to: 'data',
      filename: 'bg',
      suffix: 'jpg'
    };
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean', label: labelKey, value };
  }
  if (typeof value === 'number') {
    return { type: 'number', label: labelKey, value, placeholder: 'coreFrameworkConfig.enterValue', description: fieldDescKeys[key] };
  }
  if (Array.isArray(value)) {
    return { type: 'tags', label: labelKey, value, placeholder: 'coreFrameworkConfig.enterTags' };
  }
  if (key === 'log_level') {
    return {
      type: 'select',
      label: labelKey,
      value: value as string,
      options: ['TRACE', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
    };
  }
  if (key === 'log_output') {
    return {
      type: 'tags',
      label: labelKey,
      value: value as string[],
      placeholder: 'coreFrameworkConfig.enterTags'
    };
  }
  if (key === 'log_module') {
    return {
      type: 'boolean',
      label: labelKey,
      value: value as boolean
    };
  }
  if (key === 'HOST') return { type: 'text', label: labelKey, value: String(value), placeholder: 'coreFrameworkConfig.enterValue' };
  if (key === 'PORT') return { type: 'text', label: labelKey, value: String(value), placeholder: 'coreFrameworkConfig.enterValue' };
  if (key === 'ENABLE_HTTP') return { type: 'boolean', label: labelKey, value: value as boolean };
  if (key === 'WS_TOKEN') {
    return {
      type: 'password',
      label: labelKey,
      value: String(value),
      placeholder: 'coreFrameworkConfig.enterValue',
      secret: true,
    };
  }
  if (key === 'REGISTER_CODE') {
    return {
      type: 'password',
      label: labelKey,
      value: String(value),
      placeholder: 'coreFrameworkConfig.enterValue',
      secret: true,
    };
  }
  if (key === 'TRUSTED_IPS') return { type: 'tags', label: labelKey, value: value as string[], placeholder: 'coreFrameworkConfig.enterTags' };
  if (key === 'masters') {
    return {
      type: 'tags',
      label: labelKey,
      value: value as string[],
      placeholder: 'coreFrameworkConfig.enterTags',
      description: 'coreFrameworkConfig.mastersDesc'
    };
  }
  if (key === 'superusers') {
    return {
      type: 'tags',
      label: labelKey,
      value: value as string[],
      placeholder: 'coreFrameworkConfig.enterTags',
      description: 'coreFrameworkConfig.superusersDesc'
    };
  }
  if (key === 'misfire_grace_time') return { type: 'number', label: labelKey, value: value as number, placeholder: 'coreFrameworkConfig.enterValue' };
  if (key === 'enable_empty_start') return { type: 'boolean', label: labelKey, value: value as boolean };
  if (key === 'command_start') return { type: 'tags', label: labelKey, value: value as string[], placeholder: 'coreFrameworkConfig.enterTags' };
   
  return { type: 'text', label: labelKey, value: String(value), placeholder: 'coreConfig.content' };
};

export default function CoreConfigPage() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<Record<string, ConfigFieldDefinition>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch config from API on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // 并行拉取配置值与枚举元数据；元数据接口不可用（旧后端）时降级为空，字段回落文本框
        const [data, optionsMeta] = await Promise.all([
          configApi.getCoreConfig() as Promise<CoreConfig>,
          configApi.getCoreConfigOptions().catch(() => ({} as Record<string, CoreConfigOptionMeta>)),
        ]);
        const fieldConfig: Record<string, ConfigFieldDefinition> = {};

        // Process nested log object
        if (data.log && typeof data.log === 'object') {
          fieldConfig['log_level'] = apiConfigToFieldDefinition('log_level', data.log.level, optionsMeta);
          fieldConfig['log_output'] = apiConfigToFieldDefinition('log_output', data.log.output, optionsMeta);
          fieldConfig['log_module'] = apiConfigToFieldDefinition('log_module', data.log.module, optionsMeta);
          delete data.log;
        }

        for (const [key, value] of Object.entries(data)) {
          fieldConfig[key] = apiConfigToFieldDefinition(key, value, optionsMeta);
        }

        setConfig(fieldConfig);
      } catch (error) {
        console.error('Failed to fetch config:', error);
        toast.error(t('coreConfig.loadFailed') || 'Unable to load core configuration');
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = useCallback((key: string, value: ConfigValue) => {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert config to plain object for API
      const configData: Record<string, unknown> = {};
      const logConfig: Record<string, unknown> = {};
      
      for (const [key, field] of Object.entries(config)) {
        if (key.startsWith('log_')) {
          const logKey = key.replace('log_', '');
          logConfig[logKey] = field.value;
        } else {
          configData[key] = field.value;
        }
      }
      
      // Merge log config
      if (Object.keys(logConfig).length > 0) {
        configData.log = logConfig;
      }
      
      await configApi.setCoreConfig(configData);
      toast.success(t('coreConfig.configSaved'));
      setHasChanges(false);
    } catch (error) {
      toast.error(t('coreConfig.saveFailed') || 'Error saving configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PinnedPage
      header={
        <div className="min-w-0 overflow-visible">
          <h1 className="break-words text-3xl font-bold leading-tight flex items-center gap-3">
            <Settings className="w-8 h-8 shrink-0" />
            <span className="min-w-0 break-words">{t('coreConfig.title')}</span>
          </h1>
          <p className="break-words text-muted-foreground mt-1">{t('coreConfig.description')}</p>
        </div>
      }
    >
      <Card className="glass-card">
        {/* 无 CardHeader 时需显式 pt-6，否则默认 pt-0 会把顶部提醒贴在卡片顶边 */}
        <CardContent className="space-y-6 pt-6">
          {/* Warning Alert */}
          {showWarning && (
            <Alert
              variant="destructive"
              className="relative flex items-center gap-3 border-orange-500/50 bg-orange-500/10 [&>svg]:static [&>svg]:left-auto [&>svg]:top-auto [&>svg]:translate-y-0 [&>svg+div]:translate-y-0 [&>svg~*]:pl-0"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
              <AlertDescription className="flex-1 pr-6 text-orange-600 dark:text-orange-400">
                {t('coreFrameworkConfig.warning')}
              </AlertDescription>
              <button
                type="button"
                onClick={() => setShowWarning(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-700"
              >
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}

          {/* Config Grid - 3 columns with consistent alignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            {Object.entries(config).map(([key, field]) => (
              <ConfigField
                key={key}
                fieldKey={key}
                field={field}
                onChange={handleChange}
              />
            ))}
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-center pt-6 border-t border-border">
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || isSaving}
              className="gap-2 min-w-[160px] h-11"
              size="lg"
            >
              <CheckCircle className="w-4 h-4" />
              {t('common.confirmModify')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PinnedPage>
  );
}
