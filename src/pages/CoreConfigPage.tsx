import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfigField, ConfigFieldDefinition, ConfigValue } from '@/components/config/ConfigField';
import { AlertTriangle, CheckCircle, Settings, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { configApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

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

// Convert API config to field definition
const apiConfigToFieldDefinition = (key: string, value: unknown): ConfigFieldDefinition => {
  if (key === 'default_bg') {
    return {
      type: 'image',
      label: '默认背景图',
      value: value as string,
      upload_to: 'data',
      filename: 'bg',
      suffix: 'jpg'
    };
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean', label: key, value };
  }
  if (typeof value === 'number') {
    return { type: 'number', label: key, value, placeholder: '输入数值' };
  }
  if (Array.isArray(value)) {
    return { type: 'tags', label: key, value, placeholder: '请输入/选择标签' };
  }
  if (key === 'log_level') {
    return {
      type: 'select',
      label: '日志级别',
      value: value as string,
      options: ['TRACE', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
    };
  }
  if (key === 'log_output') {
    return {
      type: 'tags',
      label: '日志输出方式',
      value: value as string[],
      placeholder: '选择日志输出方式'
    };
  }
  if (key === 'log_module') {
    return {
      type: 'boolean',
      label: '显示模块日志',
      value: value as boolean
    };
  }
  if (key === 'HOST') return { type: 'text', label: '服务监听地址', value: String(value), placeholder: '输入监听地址' };
  if (key === 'PORT') return { type: 'text', label: '服务端口', value: String(value), placeholder: '输入端口号' };
  if (key === 'ENABLE_HTTP') return { type: 'boolean', label: '启用HTTP服务', value: value as boolean };
  if (key === 'WS_TOKEN') return { type: 'text', label: 'WebSocket Token', value: String(value), placeholder: '输入WebSocket Token' };
  if (key === 'TRUSTED_IPS') return { type: 'tags', label: '受信任IP地址', value: value as string[], placeholder: '输入IP地址' };
  if (key === 'masters') return { type: 'tags', label: '管理员列表', value: value as string[], placeholder: '输入管理员ID' };
  if (key === 'superusers') return { type: 'tags', label: '超级用户列表', value: value as string[], placeholder: '输入超级用户ID' };
  if (key === 'misfire_grace_time') return { type: 'number', label: '任务过期容忍时间(秒)', value: value as number, placeholder: '输入秒数' };
  if (key === 'enable_empty_start') return { type: 'boolean', label: '允许空配置启动', value: value as boolean };
  if (key === 'command_start') return { type: 'tags', label: '命令前缀', value: value as string[], placeholder: '输入命令前缀' };
  
  return { type: 'text', label: key, value: String(value), placeholder: '输入内容' };
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
        const data = await configApi.getCoreConfig() as CoreConfig;
        const fieldConfig: Record<string, ConfigFieldDefinition> = {};
        
        // Process nested log object
        if (data.log && typeof data.log === 'object') {
          fieldConfig['log_level'] = apiConfigToFieldDefinition('log_level', data.log.level);
          fieldConfig['log_output'] = apiConfigToFieldDefinition('log_output', data.log.output);
          fieldConfig['log_module'] = apiConfigToFieldDefinition('log_module', data.log.module);
          delete data.log;
        }
        
        for (const [key, value] of Object.entries(data)) {
          fieldConfig[key] = apiConfigToFieldDefinition(key, value);
        }
        
        setConfig(fieldConfig);
      } catch (error) {
        console.error('Failed to fetch config:', error);
        toast({
          title: t('common.loadFailed'),
          description: t('coreConfig.loadFailed') || 'Unable to load core configuration',
          variant: 'destructive'
        });
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
      toast({ title: t('common.success'), description: t('coreConfig.configSaved') });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: t('coreConfig.saveFailed') || 'Error saving configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('coreConfig.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('coreConfig.description')}</p>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 space-y-6">
          {/* Warning Alert */}
          {showWarning && (
            <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10 relative">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-600 dark:text-orange-400 pr-8">
                {t('coreConfig.warning')}
              </AlertDescription>
              <button 
                onClick={() => setShowWarning(false)}
                className="absolute right-3 top-3 text-orange-500 hover:text-orange-700"
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
    </div>
  );
}
