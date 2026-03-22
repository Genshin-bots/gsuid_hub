import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Palette, Image, Type, Save } from 'lucide-react';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType } from '@/components/config';
import { frameworkConfigApi, PluginConfigItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Convert API config to local config type
const convertToConfig = (config: Record<string, PluginConfigItem>): Record<string, ConfigFieldDefinition> => {
  const result: Record<string, ConfigFieldDefinition> = {};
  for (const [key, value] of Object.entries(config)) {
    const configItem = value as PluginConfigItem;
    let type: ConfigFieldType = 'text';
    const rawType = configItem.type?.toLowerCase() || '';
    
    if (rawType.includes('bool')) {
      type = 'boolean';
    } else if (rawType.includes('int')) {
      type = 'number';
    } else if (rawType.includes('list') || rawType.includes('array')) {
      type = configItem.options ? 'multiselect' : 'tags';
    } else if (rawType.includes('str') || rawType.includes('string')) {
      type = configItem.options ? 'select' : 'text';
    } else if (rawType.includes('image')) {
      type = 'image';
    }
    
    result[key] = {
      value: configItem.value as ConfigValue,
      default: configItem.default,
      type,
      label: configItem.title || key,
      placeholder: configItem.desc || '请输入内容',
      options: configItem.options,
      description: configItem.desc || key,
      required: false,
      disabled: false,
      rawType: configItem.type,
      upload_to: configItem.upload_to,
      filename: configItem.filename,
      suffix: configItem.suffix,
    } as unknown as ConfigFieldDefinition & { default: unknown; rawType: string };
  }
  return result;
};

export default function StateConfigPage() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<Record<string, ConfigFieldDefinition>>({});
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [configName, setConfigName] = useState<string>('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const data = await frameworkConfigApi.getFrameworkConfig('GsCore状态配置');
        setConfigName(data.full_name);
        const converted = convertToConfig(data.config);
        setConfig(converted);
        setOriginalConfig(JSON.parse(JSON.stringify(converted)));
      } catch (error) {
        console.error('Failed to fetch state config:', error);
        toast({
          title: t('common.loadFailed'),
          description: '无法加载状态配置',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleConfigChange = (key: string, value: ConfigValue) => {
    setConfig(prev => {
      const newConfig = {
        ...prev,
        [key]: { ...prev[key], value }
      };
      setIsDirty(JSON.stringify(newConfig) !== JSON.stringify(originalConfig));
      return newConfig;
    });
  };

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};
      Object.entries(config).forEach(([key, field]: [string, any]) => {
        configToSave[key] = field.value;
      });
      await frameworkConfigApi.updateFrameworkConfig(configName, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(config)));
      setIsDirty(false);
      toast({ title: t('common.success'), description: '状态配置已保存' });
    } catch (error) {
      toast({ title: t('common.saveFailed'), description: '保存状态配置失败', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group configs by type for better UX
  const boolConfigs = Object.entries(config).filter(([_, field]) => field.type === 'boolean');
  const imageConfigs = Object.entries(config).filter(([_, field]) => field.type === 'image');
  const selectConfigs = Object.entries(config).filter(([_, field]) => field.type === 'select');

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
      {/* 开关配置 */}
      {boolConfigs.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boolConfigs.map(([key, field]) => (
                <div key={key} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-base font-medium">{field.label}</Label>
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  </div>
                  <Switch
                    checked={field.value as boolean}
                    onCheckedChange={(checked) => handleConfigChange(key, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 图片配置 */}
      {imageConfigs.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Image className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">图片设置</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imageConfigs.map(([key, field]) => (
                <ConfigField
                  key={key}
                  fieldKey={key}
                  field={field}
                  onChange={handleConfigChange}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 下拉选择配置 */}
      {selectConfigs.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Type className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">文本设置</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectConfigs.map(([key, field]) => (
                <ConfigField
                  key={key}
                  fieldKey={key}
                  field={field}
                  onChange={handleConfigChange}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveConfig}
          disabled={!isDirty || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}