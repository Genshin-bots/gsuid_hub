import { useState, useEffect } from 'react';
import { HardDrive, Download, Trash2, Play, Archive, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ConfigField,
  type ConfigFieldDefinition,
  type ConfigValue,
  type ConfigFieldType,
} from '@/components/config';
import { FileTreeSelector } from '@/components/backup/FileTreeSelector';
import { backupApi, type BackupFile, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PinnedPage } from '@/components/layout/PinnedPage';

// Define types for backend response
interface BackupConfigItem {
  type: string;
  title?: string;
  desc?: string;
  data: unknown;
  options?: string[];
}

function isConfigItem(value: unknown): value is BackupConfigItem {
  return value != null && typeof value === 'object';
}

function fieldOptions(value: BackupConfigItem): string[] | undefined {
  if (!Array.isArray(value.options) || value.options.length === 0) return undefined;
  return value.options.map((o) => (o == null ? '' : String(o)));
}

// Convert backend config to frontend ConfigFieldDefinition
const convertToConfig = (
  backendConfig: Record<string, BackupConfigItem>,
  t?: (key: string) => string,
): Record<string, ConfigFieldDefinition> => {
  const config: Record<string, ConfigFieldDefinition> = {};
  if (!backendConfig || typeof backendConfig !== 'object') return config;
  for (const [key, value] of Object.entries(backendConfig)) {
    if (!isConfigItem(value)) continue;
    let type: ConfigFieldType = 'text';
    const rawType = value.type || '';
    const options = fieldOptions(value);

    switch (rawType) {
      case 'GsBoolConfig':
        type = 'boolean';
        break;
      case 'GsIntConfig':
        type = 'number';
        break;
      case 'GsListConfig':
        type = 'tags';
        break;
      case 'GsListStrConfig':
        type = options ? 'multiselect' : 'tags';
        break;
      case 'GsTimeRConfig':
        type = 'time';
        break;
      case 'GsStrConfig':
        type = options ? 'select' : 'text';
        break;
      case 'GsDictConfig':
        type = 'text';
        break;
      case 'GsImageConfig':
        type = 'image';
        break;
      default:
        type = 'text';
    }

    config[key] = {
      value: value.data as ConfigValue,
      type,
      label: value.title || key,
      placeholder: value.desc || (t ? t('backup.enterValue') : '请输入内容'),
      options,
      description: value.desc || key,
      required: false,
      disabled: false,
    };
  }
  return config;
};

function defaultWebdavField(
  type: 'text' | 'password',
  label: string,
  placeholder: string,
  description: string,
): ConfigFieldDefinition {
  return {
    type,
    label,
    value: '',
    placeholder,
    description,
    required: false,
    disabled: false,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function BackupPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('settings');
  const [config, setConfig] = useState<Record<string, ConfigFieldDefinition>>({});
  const [selectedPaths, setSelectedPaths] = useState<string[]>([
    'data',
    'data/config',
    'data/config/settings.json',
    'data/config/users.json',
    'data/logs',
    'data/db',
    'data/db/main.sqlite',
  ]);
  // Extend BackupFile with frontend-specific fields
  interface BackupFileWithMeta extends BackupFile {
    id: number;
    filename: string;
    createdAt: Date;
    status: 'completed' | 'in_progress' | 'failed';
  }

  const [backupList, setBackupList] = useState<BackupFileWithMeta[]>([]);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackupFileWithMeta | null>(null);

  // Fetch backup files and config from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filesResult, configResult] = await Promise.allSettled([
          backupApi.getFiles(),
          backupApi.getConfig(),
        ]);

        if (filesResult.status === 'fulfilled') {
          const fileList = Array.isArray(filesResult.value) ? filesResult.value : [];
          setBackupList(
            fileList.map((file: BackupFile, index: number) => ({
              ...file,
              id: index + 1,
              filename: file.fileName,
              createdAt: new Date(file.created),
              status: 'completed' as const,
            })),
          );
        } else {
          console.warn('Failed to fetch backup files:', filesResult.reason);
          toast.error(getApiErrorMessage(filesResult.reason, t('backup.loadFailed')));
        }

        if (configResult.status === 'fulfilled') {
          const backendConfig = configResult.value;
          if (backendConfig.backup_dir?.data && Array.isArray(backendConfig.backup_dir.data)) {
            setSelectedPaths(backendConfig.backup_dir.data);
          }
          setConfig(convertToConfig(backendConfig, t));
          setOriginalConfig(backendConfig);
        } else {
          console.warn('Failed to fetch backup config:', configResult.reason);
          toast.error(getApiErrorMessage(configResult.reason, t('backup.loadFailed')));
        }
      } catch (error) {
        console.warn('Failed to fetch backup data:', error);
        toast.error(getApiErrorMessage(error, t('backup.loadFailed')));
      }
    };
    fetchData();
  }, []);

  const handleTreeSelection = (paths: string[]) => {
    setSelectedPaths(paths);
    const configDirty = Object.keys(config).some(
      (key) => JSON.stringify(config[key]?.value) !== JSON.stringify(originalConfig[key]?.data),
    );
    const treeDirty =
      JSON.stringify(paths) !== JSON.stringify(originalConfig.backup_dir?.data ?? []);
    setHasChanges(configDirty || treeDirty);
  };

  const handleConfigChange = (key: string, value: ConfigValue) => {
    setConfig((prev) => {
      const newConfig = {
        ...prev,
        [key]: { ...prev[key], value },
      };

      // Check if any config has changed from original
      const changes = Object.keys(newConfig).map((key) => {
        return JSON.stringify(newConfig[key]?.value) !== JSON.stringify(originalConfig[key]?.data);
      });

      // Also check if selected paths changed
      changes.push(
        JSON.stringify(selectedPaths) !== JSON.stringify(originalConfig.backup_dir?.data),
      );

      // Also check if WebDAV config changed
      if (originalConfig.webdav_url) {
        changes.push(
          JSON.stringify(newConfig.webdav_url?.value) !==
            JSON.stringify(originalConfig.webdav_url?.data),
        );
      }
      if (originalConfig.webdav_username) {
        changes.push(
          JSON.stringify(newConfig.webdav_username?.value) !==
            JSON.stringify(originalConfig.webdav_username?.data),
        );
      }
      if (originalConfig.webdav_password) {
        changes.push(
          JSON.stringify(newConfig.webdav_password?.value) !==
            JSON.stringify(originalConfig.webdav_password?.data),
        );
      }

      setHasChanges(changes.some((change) => change));
      return newConfig;
    });
  };

  const handleSaveSettings = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const configData: Record<string, any> = {};
      Object.entries(config).forEach(([key, field]) => {
        configData[key] = field.value;
      });
      configData.backup_dir = selectedPaths;

      // 确保 WebDAV 配置也被保存
      if (config.webdav_url?.value) configData.webdav_url = config.webdav_url.value;
      if (config.webdav_username?.value) configData.webdav_username = config.webdav_username.value;
      if (config.webdav_password?.value) configData.webdav_password = config.webdav_password.value;

      await backupApi.setConfig(configData);

      // Update original config after successful save
      const updatedOriginal = { ...originalConfig };
      Object.keys(config).forEach((key) => {
        if (updatedOriginal[key]) {
          updatedOriginal[key].data = config[key].value;
        }
      });
      if (updatedOriginal.backup_dir) {
        updatedOriginal.backup_dir.data = selectedPaths;
      } else {
        updatedOriginal.backup_dir = { type: 'GsListStrConfig', data: selectedPaths };
      }

      // Update WebDAV config in original
      if (config.webdav_url) {
        updatedOriginal.webdav_url = {
          ...updatedOriginal.webdav_url,
          data: config.webdav_url.value,
        };
      }
      if (config.webdav_username) {
        updatedOriginal.webdav_username = {
          ...updatedOriginal.webdav_username,
          data: config.webdav_username.value,
        };
      }
      if (config.webdav_password) {
        updatedOriginal.webdav_password = {
          ...updatedOriginal.webdav_password,
          data: config.webdav_password.value,
        };
      }

      setOriginalConfig(updatedOriginal);

      setHasChanges(false);
      toast.success(t('backup.saveSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      await backupApi.createBackup();
      // Refresh backup list
      const files = await backupApi.getFiles();
      const fileList = Array.isArray(files) ? files : [];
      const formattedFiles = fileList.map((file: BackupFile, index: number) => ({
        ...file,
        id: index + 1,
        filename: file.fileName,
        createdAt: new Date(file.created),
        status: 'completed' as const,
      }));
      setBackupList(formattedFiles);
      toast.success(t('backup.backupSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.backupFailed')));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDeleteBackup = async (file: BackupFileWithMeta) => {
    try {
      await backupApi.deleteFile(file.fileName);
      setBackupList((prev) => prev.filter((b) => b.fileName !== file.fileName));
      toast.success(t('backup.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.deleteFailed')));
    }
    setDeleteTarget(null);
  };

  const handleDownload = async (backup: BackupFileWithMeta) => {
    try {
      // Use authenticated download via API (window.open doesn't send auth headers)
      const blob = await backupApi.downloadFile(backup.fileName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Download failed:', error);
      toast.error(getApiErrorMessage(error, t('backup.downloadFailed')));
    }
  };

  const handleDeleteClick = (backup: BackupFileWithMeta) => {
    setDeleteTarget(backup);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    handleDeleteBackup(deleteTarget);
  };

  const showWebDAVConfig = Array.isArray(config.backup_method?.value)
    ? (config.backup_method.value as string[]).includes('web_dav')
    : String(config.backup_method?.value || '').includes('web_dav');

  const webdavUrlField =
    config.webdav_url ??
    defaultWebdavField(
      'text',
      'WebDAV URL',
      t('backup.webdavServerPlaceholder'),
      t('backup.webdavServer'),
    );
  const webdavUsernameField =
    config.webdav_username ??
    defaultWebdavField(
      'text',
      t('backup.webdavUsername'),
      t('backup.webdavUsernamePlaceholder'),
      t('backup.webdavUsername'),
    );
  const webdavPasswordField =
    config.webdav_password ??
    defaultWebdavField(
      'password',
      t('backup.webdavPassword'),
      t('backup.webdavPasswordPlaceholder'),
      t('backup.webdavPassword'),
    );

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <HardDrive className="w-8 h-8 shrink-0" />
              {t('backup.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">
              {t('backup.description')}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 self-end sm:self-auto">
            <Button
              onClick={handleSaveSettings}
              disabled={!hasChanges || isSaving}
              className="whitespace-nowrap"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? t('backup.saving') : t('backup.saveSettings')}
            </Button>
            <Button onClick={handleBackupNow} disabled={isBackingUp} className="whitespace-nowrap">
              <Play className="w-4 h-4 mr-2" />
              {isBackingUp ? t('backup.backingUp') : t('backup.backupNow')}
            </Button>
          </div>
        </div>
      }
      toolbar={
        <TabButtonGroup
          options={[
            {
              value: 'settings',
              label: t('backup.backupSettings'),
              icon: <Archive className="w-4 h-4" />,
            },
            {
              value: 'downloads',
              label: t('backup.backupDownload'),
              icon: <Download className="w-4 h-4" />,
            },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        />
      }
    >
      <div className="space-y-4">
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t('backup.basicSettings')}</CardTitle>
                <CardDescription>{t('backup.backupMethod')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  {Object.entries(config)
                    .filter(([key]) => {
                      // 排除 backup_dir，在备份内容中单独处理
                      // 排除 WebDAV 配置，在下方单独展示
                      return (
                        key !== 'backup_dir' &&
                        key !== 'webdav_url' &&
                        key !== 'webdav_username' &&
                        key !== 'webdav_password'
                      );
                    })
                    .map(([key, field]) => (
                      <ConfigField
                        key={key}
                        fieldKey={key}
                        field={field}
                        onChange={handleConfigChange}
                      />
                    ))}
                </div>

                {/* 单独的 WebDAV 配置区块 */}
                {showWebDAVConfig && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="text-sm font-medium mb-4">{t('backup.webdavConfig')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                      <ConfigField
                        fieldKey="webdav_url"
                        field={webdavUrlField}
                        onChange={handleConfigChange}
                      />
                      <ConfigField
                        fieldKey="webdav_username"
                        field={webdavUsernameField}
                        onChange={handleConfigChange}
                      />
                      <ConfigField
                        fieldKey="webdav_password"
                        field={webdavPasswordField}
                        onChange={handleConfigChange}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t('backup.backupContent')}</CardTitle>
                <CardDescription>
                  {t('backup.selectBackupItems', { count: selectedPaths.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileTreeSelector
                  selectedPaths={selectedPaths}
                  onSelectionChange={handleTreeSelection}
                  className="max-h-[600px] overflow-auto"
                />
                <p className="text-sm text-muted-foreground mt-3">
                  {t('backup.selectBackupItems', { count: selectedPaths.length })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'downloads' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t('backup.backupHistory')}</CardTitle>
              <CardDescription>{t('backup.backupDownload')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('backup.filename')}</TableHead>
                    <TableHead>{t('backup.size')}</TableHead>
                    <TableHead>{t('backup.createTime')}</TableHead>
                    <TableHead>{t('backup.status')}</TableHead>
                    <TableHead className="text-right">{t('scheduler.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupList.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-medium">{backup.filename}</TableCell>
                      <TableCell>{formatBytes(backup.size)}</TableCell>
                      <TableCell>
                        {format(backup.createdAt, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            backup.status === 'completed'
                              ? 'default'
                              : backup.status === 'in_progress'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {backup.status === 'completed'
                            ? t('backup.completed')
                            : backup.status === 'in_progress'
                              ? t('backup.inProgress')
                              : t('backup.failed')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(backup)}
                            disabled={backup.status !== 'completed'}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(backup)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {backupList.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('backup.noBackupRecords')}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backup.confirmDeleteMessage', { filename: deleteTarget?.filename })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('backup.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('backup.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinnedPage>
  );
}
