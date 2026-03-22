import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Database, Settings, Loader2, Save, ChevronDown, ChevronUp, Server, Lock, Network, HardDrive } from 'lucide-react';
import { frameworkConfigApi, PluginConfigItem, FrameworkConfigListItem, FrameworkConfigDetail } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// Database type options
const DB_TYPES = ['SQLite', 'MySql', 'PostgreSQL', '自定义'] as const;
type DBType = typeof DB_TYPES[number];

// MySQL driver options
const DB_DRIVERS = ['aiomysql', 'asyncmy'] as const;

// Convert API config to local config type
interface DatabaseConfig {
  db_type: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_driver?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_custom_url?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_host?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_port?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_user?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_password?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_name?: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  db_pool_size?: {
    value: number;
    default: number;
    options: number[];
    title: string;
    desc: string;
  };
  db_echo?: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  db_pool_recycle?: {
    value: number;
    default: number;
    options: number[];
    title: string;
    desc: string;
  };
}

interface LocalDatabaseConfig {
  id: string;
  name: string;
  full_name: string;
  config: DatabaseConfig;
}

export default function DatabaseConfigPage() {
  const { t } = useLanguage();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalDatabaseConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [databaseConfigName, setDatabaseConfigName] = useState<string>('');

  // Get the GsCore database config
  const databaseConfig = useMemo(() => {
    return configs.find(c =>
      c.name === 'GsCore数据库配置' ||
      c.full_name === 'GsCore数据库配置' ||
      c.id === 'GsCore数据库配置' ||
      c.full_name === databaseConfigName
    );
  }, [configs, databaseConfigName]);

  // Current db_type value
  const currentDbType = databaseConfig?.config?.db_type?.value as DBType || 'SQLite';

  // Fetch config list from API (轻量级接口)
  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      // Filter only database config
      const dbConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('database') ||
               fullNameLower.includes('database') ||
               nameLower.includes('数据库');
      });
      
      if (dbConfigList.length > 0) {
        setConfigList(dbConfigList);
        setDatabaseConfigName(dbConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch database config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('databaseConfig.loadFailed') || 'Unable to load database configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch config detail from API
  const fetchConfigDetail = async (configName: string) => {
    try {
      setIsLoadingDetail(true);
      const data = await frameworkConfigApi.getFrameworkConfig(configName);
      
      // Convert the raw config to the expected format
      const convertedConfig: LocalDatabaseConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        config: {
          db_type: {
            value: (data.config.db_type?.value || 'SQLite') as string,
            default: (data.config.db_type?.default || 'SQLite') as string,
            options: (data.config.db_type?.options || ['SQLite', 'MySql', 'PostgreSQL', '自定义']) as string[],
            title: data.config.db_type?.title || '数据库类型',
            desc: data.config.db_type?.desc || '选择数据库类型'
          },
          db_driver: data.config.db_driver ? {
            value: data.config.db_driver.value as string,
            default: data.config.db_driver.default as string,
            options: (data.config.db_driver.options || ['aiomysql', 'asyncmy']) as string[],
            title: data.config.db_driver.title || 'MySQL驱动',
            desc: data.config.db_driver.desc || '选择MySQL驱动'
          } : undefined,
          db_custom_url: data.config.db_custom_url ? {
            value: data.config.db_custom_url.value as string,
            default: data.config.db_custom_url.default as string,
            options: (data.config.db_custom_url.options || []) as string[],
            title: data.config.db_custom_url.title || '自定义连接URL',
            desc: data.config.db_custom_url.desc || '自定义数据库连接URL'
          } : undefined,
          db_host: data.config.db_host ? {
            value: data.config.db_host.value as string,
            default: data.config.db_host.default as string,
            options: (data.config.db_host.options || []) as string[],
            title: data.config.db_host.title || '主机地址',
            desc: data.config.db_host.desc || '数据库主机地址'
          } : undefined,
          db_port: data.config.db_port ? {
            value: data.config.db_port.value as string,
            default: data.config.db_port.default as string,
            options: (data.config.db_port.options || []) as string[],
            title: data.config.db_port.title || '端口',
            desc: data.config.db_port.desc || '数据库端口'
          } : undefined,
          db_user: data.config.db_user ? {
            value: data.config.db_user.value as string,
            default: data.config.db_user.default as string,
            options: (data.config.db_user.options || []) as string[],
            title: data.config.db_user.title || '用户名',
            desc: data.config.db_user.desc || '数据库用户名'
          } : undefined,
          db_password: data.config.db_password ? {
            value: data.config.db_password.value as string,
            default: data.config.db_password.default as string,
            options: (data.config.db_password.options || []) as string[],
            title: data.config.db_password.title || '密码',
            desc: data.config.db_password.desc || '数据库密码'
          } : undefined,
          db_name: data.config.db_name ? {
            value: data.config.db_name.value as string,
            default: data.config.db_name.default as string,
            options: (data.config.db_name.options || []) as string[],
            title: data.config.db_name.title || '数据库名',
            desc: data.config.db_name.desc || '数据库名称'
          } : undefined,
          db_pool_size: data.config.db_pool_size ? {
            value: data.config.db_pool_size.value as number,
            default: data.config.db_pool_size.default as number,
            options: (data.config.db_pool_size.options || [1, 3, 5, 10, 20]) as number[],
            title: data.config.db_pool_size.title || '连接池大小',
            desc: data.config.db_pool_size.desc || '数据库连接池大小'
          } : undefined,
          db_echo: data.config.db_echo ? {
            value: data.config.db_echo.value as boolean,
            default: data.config.db_echo.default as boolean,
            title: data.config.db_echo.title || 'SQL日志',
            desc: data.config.db_echo.desc || '是否显示SQL执行日志'
          } : undefined,
          db_pool_recycle: data.config.db_pool_recycle ? {
            value: data.config.db_pool_recycle.value as number,
            default: data.config.db_pool_recycle.default as number,
            options: (data.config.db_pool_recycle.options || [3600, 7200, 14400]) as number[],
            title: data.config.db_pool_recycle.title || '连接回收时间',
            desc: data.config.db_pool_recycle.desc || '连接回收时间（秒）'
          } : undefined
        }
      };
      
      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig)));
    } catch (error) {
      console.error('Failed to fetch database config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('databaseConfig.loadFailed') || 'Unable to load database configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchConfigList();
  }, []);

  // Fetch detail when config name is determined
  useEffect(() => {
    if (databaseConfigName) {
      fetchConfigDetail(databaseConfigName);
    }
  }, [databaseConfigName]);

  useEffect(() => {
    fetchConfigList();
  }, []);

  // Update original state when config changes
  useEffect(() => {
    if (databaseConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(databaseConfig.config)));
    }
  }, [databaseConfig]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean) => {
    if (!databaseConfig) return;
    
    setConfigs(prev => prev.map(c => {
      if (c.id !== databaseConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof DatabaseConfig], value }
        }
      };
    }));
    setIsDirty(true);
  }, [databaseConfig]);

  const handleSaveConfig = async () => {
    if (!databaseConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};
      
      Object.entries(databaseConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });
      
      await frameworkConfigApi.updateFrameworkConfig(databaseConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(databaseConfig.config)));
      toast({ title: t('common.success'), description: t('databaseConfig.configSaved') });
    } catch (error) {
      toast({ 
        title: t('common.saveFailed'), 
        description: t('databaseConfig.saveFailed') || 'Failed to update database configuration', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check if config has changes
  const isConfigDirty = useMemo(() => {
    if (!databaseConfig) return false;
    return JSON.stringify(databaseConfig.config) !== JSON.stringify(originalConfig);
  }, [databaseConfig, originalConfig]);

  // Section collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    connection: true,
    pool: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!databaseConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('databaseConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dbConfig = databaseConfig.config;

  return (
    <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
      {/* Database Type Selection - Always Visible */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            {t('databaseConfig.databaseType')}
          </CardTitle>
          <CardDescription>{t('databaseConfig.databaseTypeDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DB_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleChange('db_type', type)}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-left",
                  currentDbType === type
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {type === 'SQLite' && <HardDrive className="w-5 h-5" />}
                  {type === 'MySql' && <Server className="w-5 h-5" />}
                  {type === 'PostgreSQL' && <Database className="w-5 h-5" />}
                  {type === '自定义' && <Settings className="w-5 h-5" />}
                  <span className="font-medium">{type}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {type === 'SQLite' && t('databaseConfig.sqliteDesc')}
                  {type === 'MySql' && t('databaseConfig.mysqlDesc')}
                  {type === 'PostgreSQL' && t('databaseConfig.postgresqlDesc')}
                  {type === '自定义' && t('databaseConfig.customDesc')}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SQLite Configuration */}
      {currentDbType === 'SQLite' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              {t('databaseConfig.sqliteSettings')}
            </CardTitle>
            <CardDescription>{t('databaseConfig.sqliteSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">{t('databaseConfig.sqliteDefault')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('databaseConfig.sqliteDefaultPath')}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                {t('databaseConfig.recommended')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MySQL Configuration */}
      {currentDbType === 'MySql' && (
        <>
          {/* MySQL Driver */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {t('databaseConfig.mysqlDriver')}
              </CardTitle>
              <CardDescription>{t('databaseConfig.mysqlDriverDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={dbConfig.db_driver?.value as string || 'aiomysql'}
                onValueChange={(value) => handleChange('db_driver', value)}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DB_DRIVERS.map((driver) => (
                    <SelectItem key={driver} value={driver}>
                      {driver}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Connection Settings */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('connection')}
              >
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  {t('databaseConfig.connectionSettings')}
                </div>
                {expandedSections.connection ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </CardTitle>
              <CardDescription>{t('databaseConfig.connectionSettingsDesc')}</CardDescription>
            </CardHeader>
            {expandedSections.connection && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db_host">{t('databaseConfig.host')}</Label>
                    <Input
                      id="db_host"
                      value={dbConfig.db_host?.value as string || ''}
                      onChange={(e) => handleChange('db_host', e.target.value)}
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db_port">{t('databaseConfig.port')}</Label>
                    <Input
                      id="db_port"
                      value={dbConfig.db_port?.value as string || ''}
                      onChange={(e) => handleChange('db_port', e.target.value)}
                      placeholder="3306"
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db_user">{t('databaseConfig.username')}</Label>
                    <Input
                      id="db_user"
                      value={dbConfig.db_user?.value as string || ''}
                      onChange={(e) => handleChange('db_user', e.target.value)}
                      placeholder="root"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db_password">{t('databaseConfig.password')}</Label>
                    <Input
                      id="db_password"
                      type="password"
                      value={dbConfig.db_password?.value as string || ''}
                      onChange={(e) => handleChange('db_password', e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="db_name">{t('databaseConfig.databaseName')}</Label>
                  <Input
                    id="db_name"
                    value={dbConfig.db_name?.value as string || ''}
                    onChange={(e) => handleChange('db_name', e.target.value)}
                    placeholder="GsData"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Pool Settings */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('pool')}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('databaseConfig.poolSettings')}
                </div>
                {expandedSections.pool ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </CardTitle>
              <CardDescription>{t('databaseConfig.poolSettingsDesc')}</CardDescription>
            </CardHeader>
            {expandedSections.pool && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db_pool_size">{t('databaseConfig.poolSize')}</Label>
                    <Select
                      value={String(dbConfig.db_pool_size?.value || 5)}
                      onValueChange={(value) => handleChange('db_pool_size', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 30, 40, 50].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db_pool_recycle">{t('databaseConfig.poolRecycle')}</Label>
                    <Select
                      value={String(dbConfig.db_pool_recycle?.value || 3600)}
                      onValueChange={(value) => handleChange('db_pool_recycle', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 1500, label: '25 分钟' },
                          { value: 3600, label: '1 小时' },
                          { value: 7200, label: '2 小时' },
                          { value: 14400, label: '4 小时' },
                          { value: 28800, label: '8 小时' }
                        ].map((item) => (
                          <SelectItem key={item.value} value={String(item.value)}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('databaseConfig.debugMode')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('databaseConfig.debugModeDesc')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={dbConfig.db_echo?.value as boolean || false}
                    onCheckedChange={(checked) => handleChange('db_echo', checked)}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* PostgreSQL Configuration */}
      {currentDbType === 'PostgreSQL' && (
        <>
          {/* Connection Settings for PostgreSQL */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                {t('databaseConfig.connectionSettings')}
              </CardTitle>
              <CardDescription>{t('databaseConfig.connectionSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="db_host">{t('databaseConfig.host')}</Label>
                  <Input
                    id="db_host"
                    value={dbConfig.db_host?.value as string || ''}
                    onChange={(e) => handleChange('db_host', e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="db_port">{t('databaseConfig.port')}</Label>
                  <Input
                    id="db_port"
                    value={dbConfig.db_port?.value as string || ''}
                    onChange={(e) => handleChange('db_port', e.target.value)}
                    placeholder="5432"
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="db_user">{t('databaseConfig.username')}</Label>
                  <Input
                    id="db_user"
                    value={dbConfig.db_user?.value as string || ''}
                    onChange={(e) => handleChange('db_user', e.target.value)}
                    placeholder="postgres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="db_password">{t('databaseConfig.password')}</Label>
                  <Input
                    id="db_password"
                    type="password"
                    value={dbConfig.db_password?.value as string || ''}
                    onChange={(e) => handleChange('db_password', e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="db_name">{t('databaseConfig.databaseName')}</Label>
                <Input
                  id="db_name"
                  value={dbConfig.db_name?.value as string || ''}
                  onChange={(e) => handleChange('db_name', e.target.value)}
                  placeholder="GsData"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pool Settings for PostgreSQL */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('pool')}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('databaseConfig.poolSettings')}
                </div>
                {expandedSections.pool ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </CardTitle>
              <CardDescription>{t('databaseConfig.poolSettingsDesc')}</CardDescription>
            </CardHeader>
            {expandedSections.pool && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="db_pool_size">{t('databaseConfig.poolSize')}</Label>
                    <Select
                      value={String(dbConfig.db_pool_size?.value || 5)}
                      onValueChange={(value) => handleChange('db_pool_size', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 30, 40, 50].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db_pool_recycle">{t('databaseConfig.poolRecycle')}</Label>
                    <Select
                      value={String(dbConfig.db_pool_recycle?.value || 3600)}
                      onValueChange={(value) => handleChange('db_pool_recycle', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 1500, label: '25 分钟' },
                          { value: 3600, label: '1 小时' },
                          { value: 7200, label: '2 小时' },
                          { value: 14400, label: '4 小时' },
                          { value: 28800, label: '8 小时' }
                        ].map((item) => (
                          <SelectItem key={item.value} value={String(item.value)}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('databaseConfig.debugMode')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('databaseConfig.debugModeDesc')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={dbConfig.db_echo?.value as boolean || false}
                    onCheckedChange={(checked) => handleChange('db_echo', checked)}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* Custom URL Configuration */}
      {currentDbType === '自定义' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('databaseConfig.customUrl')}
            </CardTitle>
            <CardDescription>{t('databaseConfig.customUrlDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="db_custom_url">{t('databaseConfig.connectionUrl')}</Label>
              <Input
                id="db_custom_url"
                value={dbConfig.db_custom_url?.value as string || ''}
                onChange={(e) => handleChange('db_custom_url', e.target.value)}
                placeholder="sqlite+aiosqlite:///path/to/database.db"
              />
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {t('databaseConfig.customUrlExample')}
              </p>
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
