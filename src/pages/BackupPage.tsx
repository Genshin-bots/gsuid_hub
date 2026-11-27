import { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Download,
  Trash2,
  Play,
  Archive,
  Save,
  Lightbulb,
  RotateCcw,
  FileUp,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TabButtonGroup, tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { TruncatedText } from '@/components/ui/truncated-text';
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
import { readZipDirectory } from '@/lib/zipCentralDirectory';
import {
  type BackupSourceKind,
  classifyBackupSource,
  diffSelection,
  sortBackupFilesNewestFirst,
} from '@/lib/backupFileTree';
import {
  backupApi,
  systemApi,
  type BackupFile,
  type BackupHintEntry,
  type RestoreMode,
  type RestorePreview,
  type RestoreResult,
  getApiErrorMessage,
} from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { headerActionRowClass, pageStackClass, PinnedPage } from '@/components/layout/PinnedPage';

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

interface BackupFileWithMeta extends BackupFile {
  id: number;
  filename: string;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed';
  source: BackupSourceKind;
}

const BACKUP_SOURCE_BADGE: Record<
  Exclude<BackupSourceKind, 'unknown'>,
  {
    labelKey: string;
    variant: 'outline' | 'secondary';
    className?: string;
  }
> = {
  manual: {
    labelKey: 'backup.sourceManual',
    variant: 'outline',
    className:
      'theme-chip theme-chip-tint text-blue-600 dark:text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  auto: {
    labelKey: 'backup.sourceAuto',
    variant: 'secondary',
  },
  pre_restore: {
    labelKey: 'backup.sourcePreRestore',
    variant: 'outline',
    className:
      'theme-chip theme-chip-tint text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  uploaded: {
    labelKey: 'backup.sourceUploaded',
    variant: 'outline',
    className:
      'theme-chip theme-chip-tint text-violet-600 dark:text-violet-400 border-violet-500/40 bg-violet-500/10',
  },
};

function toBackupList(files: unknown): BackupFileWithMeta[] {
  const fileList = Array.isArray(files) ? (files as BackupFile[]) : [];
  return sortBackupFilesNewestFirst(fileList).map((file, index) => ({
    ...file,
    id: index + 1,
    filename: file.fileName,
    createdAt: new Date(file.created),
    status: 'completed' as const,
    source: classifyBackupSource(file.fileName),
  }));
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
  const [backupList, setBackupList] = useState<BackupFileWithMeta[]>([]);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackupFileWithMeta | null>(null);
  const [hints, setHints] = useState<BackupHintEntry[] | null | undefined>(undefined);
  const [restoreDialog, setRestoreDialog] = useState<{
    preview: RestorePreview;
    /** null = 本地文件，确认后先走分块上传 */
    fileId: string | null;
    mode: RestoreMode;
  } | null>(null);
  const [pendingLocalFile, setPendingLocalFile] = useState<File | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    name: string;
    sent: number;
    total: number;
  } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [restoreDone, setRestoreDone] = useState<RestoreResult | null>(null);

  // Fetch backup files and config from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filesResult, configResult, hintsResult] = await Promise.allSettled([
          backupApi.getFiles(),
          backupApi.getConfig(),
          backupApi.getHints(),
        ]);

        if (filesResult.status === 'fulfilled') {
          setBackupList(toBackupList(filesResult.value));
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

        // 旧版 Core 没有 /api/backup/hints，整块建议区直接隐藏
        if (hintsResult.status === 'fulfilled') {
          setHints(Array.isArray(hintsResult.value) ? hintsResult.value : []);
        } else {
          console.warn('Backup hints unavailable:', hintsResult.reason);
          setHints(null);
        }
      } catch (error) {
        console.warn('Failed to fetch backup data:', error);
        setHints(null);
        toast.error(getApiErrorMessage(error, t('backup.loadFailed')));
      }
    };
    fetchData();
  }, []);

  const isPathCovered = (path: string) =>
    selectedPaths.some((s) => s === path || path.startsWith(`${s}/`));

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
        if (key === 'backup_hint_applied') return;
        configData[key] = field.value;
      });
      // 增量提交勾选变化，避免整表覆盖其他端口的改动
      const originalDir = Array.isArray(originalConfig.backup_dir?.data)
        ? (originalConfig.backup_dir.data as string[])
        : [];
      const { added, removed } = diffSelection(originalDir, selectedPaths);
      configData.backup_dir_added = added;
      configData.backup_dir_removed = removed;

      // 确保 WebDAV 配置也被保存
      if (config.webdav_url?.value) configData.webdav_url = config.webdav_url.value;
      if (config.webdav_username?.value) configData.webdav_username = config.webdav_username.value;
      if (config.webdav_password?.value) configData.webdav_password = config.webdav_password.value;

      let res = await backupApi.setConfig(configData);
      let finalDir = res?.backup_dir;
      if (!finalDir) {
        // 老 core 不识别增量字段，回退整表提交
        delete configData.backup_dir_added;
        delete configData.backup_dir_removed;
        configData.backup_dir = selectedPaths;
        res = await backupApi.setConfig(configData);
        finalDir = res?.backup_dir ?? selectedPaths;
      }
      setSelectedPaths(finalDir);

      // Update original config after successful save
      const updatedOriginal = { ...originalConfig };
      Object.keys(config).forEach((key) => {
        if (updatedOriginal[key]) {
          updatedOriginal[key].data = config[key].value;
        }
      });
      if (updatedOriginal.backup_dir) {
        updatedOriginal.backup_dir.data = finalDir;
      } else {
        updatedOriginal.backup_dir = { type: 'GsListStrConfig', data: finalDir };
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
      setBackupList(toBackupList(files));
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

  const refreshBackupFiles = async () => {
    const files = await backupApi.getFiles();
    setBackupList(toBackupList(files));
  };

  const openRestorePreview = async (fileId: string) => {
    try {
      const preview = await backupApi.previewRestore(fileId);
      setRestoreDialog({ preview, fileId, mode: 'overwrite' });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.restorePreviewFailed')));
    }
  };

  const handlePickLocalZip = async (file: File) => {
    try {
      const dir = await readZipDirectory(file);
      const entries = dir.entries.map((e) => ({
        path: e.path,
        size: e.size,
        is_dir: e.is_dir,
        is_symlink: e.is_symlink,
        encrypted: e.encrypted,
      }));
      const preview = await backupApi.previewRestoreEntries(entries, dir.manifest);
      setPendingLocalFile(file);
      setRestoreDialog({ preview, fileId: null, mode: 'overwrite' });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.zipParseFailed')));
    }
  };

  const uploadLocalZip = async (file: File): Promise<string | null> => {
    const abort = new AbortController();
    uploadAbortRef.current = abort;
    setUploadProgress({ name: file.name, sent: 0, total: file.size });
    try {
      const init = await backupApi.initUpload(file.name, file.size);
      let offset = 0;
      while (offset < file.size) {
        const blob = file.slice(offset, offset + init.chunk_size);
        let done = false;
        for (let attempt = 0; attempt < 3 && !done; attempt += 1) {
          try {
            const res = await backupApi.uploadChunk(init.upload_id, offset, blob, abort.signal);
            offset = res.received;
            done = true;
          } catch (error) {
            if (abort.signal.aborted) return null;
            if (attempt === 2) throw error;
          }
        }
        setUploadProgress({ name: file.name, sent: offset, total: file.size });
      }
      const completed = await backupApi.completeUpload(init.upload_id);
      return completed.file_id;
    } finally {
      setUploadProgress(null);
      uploadAbortRef.current = null;
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreDialog) return;
    setRestoreBusy(true);
    try {
      let fileId = restoreDialog.fileId;
      let digest = restoreDialog.preview.digest;
      if (fileId === null) {
        if (!pendingLocalFile) return;
        const uploadedId = await uploadLocalZip(pendingLocalFile);
        if (uploadedId === null) return;
        // 上传完拿服务器预检：本地目录解析可能与服务端不一致
        const serverPreview = await backupApi.previewRestore(uploadedId);
        if (serverPreview.digest !== digest) {
          setRestoreDialog({
            preview: serverPreview,
            fileId: uploadedId,
            mode: restoreDialog.mode,
          });
          toast.warning(t('backup.restoreConflictChanged'));
          return;
        }
        fileId = uploadedId;
        digest = serverPreview.digest;
      }
      const result = await backupApi.applyRestore(fileId, restoreDialog.mode, digest);
      setRestoreDone(result);
      setRestoreDialog(null);
      setPendingLocalFile(null);
      void refreshBackupFiles();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.restoreFailed')));
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleRestartCore = async () => {
    try {
      await systemApi.restartCore();
      toast.success(t('backup.restartRequested'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('backup.restartFailed')));
    }
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

  const hasUncheckedUserData = (hints ?? []).some(
    (h) => h.kind === 'user_data' && !isPathCovered(h.path),
  );

  return (
    <PinnedPage
      header={
        <div className="min-w-0 sm:overflow-x-auto">
          <h1 className="sm:whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <HardDrive className="w-8 h-8 shrink-0" />
            {t('backup.title')}
          </h1>
          <p className="sm:whitespace-nowrap text-muted-foreground mt-1">
            {t('backup.description')}
          </p>
        </div>
      }
      toolbar={
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          <div className={headerActionRowClass}>
            <Button
              onClick={handleSaveSettings}
              disabled={!hasChanges || isSaving}
              className={cn(tabToolbarControlClass, 'button-solid whitespace-nowrap')}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? t('backup.saving') : t('backup.saveSettings')}
            </Button>
            <Button
              onClick={handleBackupNow}
              disabled={isBackingUp}
              className={cn(tabToolbarControlClass, 'whitespace-nowrap')}
            >
              <Play className="w-4 h-4 mr-2" />
              {isBackingUp ? t('backup.backingUp') : t('backup.backupNow')}
            </Button>
          </div>
        </div>
      }
    >
      <div className={pageStackClass}>
        {activeTab === 'settings' && (
          <div className={pageStackClass}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t('backup.basicSettings')}</CardTitle>
                <CardDescription>{t('backup.backupMethod')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  {Object.entries(config)
                    .filter(([key]) => {
                      // 排除 backup_dir，在备份内容中单独处理
                      // 排除 WebDAV 配置，在下方单独展示
                      // 排除 backup_hint_applied，建议应用的内部状态不展示
                      return (
                        key !== 'backup_dir' &&
                        key !== 'backup_hint_applied' &&
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
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
                {hasUncheckedUserData && (
                  <p className="text-xs text-amber-600 mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                    {t('backup.hintUserDataWarning')}
                  </p>
                )}
                <FileTreeSelector
                  selectedPaths={selectedPaths}
                  onSelectionChange={handleTreeSelection}
                  hints={hints}
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
                    <TableRow key={backup.fileName}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 min-w-0">
                          <TruncatedText text={backup.filename} className="max-w-[36ch]" />
                          {backup.source !== 'unknown' && (
                            <Badge
                              variant={BACKUP_SOURCE_BADGE[backup.source].variant}
                              className={cn(
                                'shrink-0',
                                BACKUP_SOURCE_BADGE[backup.source].className,
                              )}
                            >
                              {t(BACKUP_SOURCE_BADGE[backup.source].labelKey)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatBytes(backup.size)}</TableCell>
                      <TableCell>
                        {Number.isNaN(backup.createdAt.getTime())
                          ? '—'
                          : format(backup.createdAt, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
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
                            onClick={() => openRestorePreview(backup.fileName)}
                            disabled={backup.status !== 'completed'}
                            title={t('backup.restoreAction')}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
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

              <div className="mt-6 pt-6 border-t space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileUp className="w-4 h-4" />
                  {t('backup.restoreFromFile')}
                </h4>
                <label
                  className="block rounded-lg border border-dashed border-border/60 p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handlePickLocalZip(file);
                  }}
                >
                  <p className="text-sm text-muted-foreground">{t('backup.restoreDropHint')}</p>
                  <span className="mt-3 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium">
                    {t('backup.restoreChooseFile')}
                  </span>
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handlePickLocalZip(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                {uploadProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="min-w-0 truncate">{uploadProgress.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {Math.round((uploadProgress.sent / uploadProgress.total) * 100)}%
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => uploadAbortRef.current?.abort()}
                      >
                        {t('backup.cancel')}
                      </Button>
                    </div>
                    <Progress value={(uploadProgress.sent / uploadProgress.total) * 100} />
                  </div>
                )}
              </div>
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

      <AlertDialog
        open={!!restoreDialog}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreDialog(null);
            setPendingLocalFile(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.restoreDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreDialog?.preview.manifest
                ? t('backup.restoreManifestSummary', {
                    fileId: restoreDialog.preview.manifest.file_id,
                    version: restoreDialog.preview.manifest.core_version,
                    files: restoreDialog.preview.manifest.file_count,
                    size: formatBytes(restoreDialog.preview.manifest.total_bytes),
                  })
                : t('backup.restoreNoManifest')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restoreDialog && (
            <div className="space-y-3 text-sm">
              {restoreDialog.preview.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-600">
                  {w}
                </p>
              ))}
              {restoreDialog.preview.manifest && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>{restoreDialog.preview.manifest.created_at}</p>
                  <p className="truncate">
                    {restoreDialog.preview.manifest.roots.join(', ') || '—'}
                  </p>
                </div>
              )}
              {(restoreDialog.preview.rejected_count > 0 ||
                restoreDialog.preview.type_conflict_count > 0 ||
                !restoreDialog.preview.enough_space) && (
                <div className="rounded-md border border-destructive/40 p-3 space-y-1.5">
                  <p className="text-sm font-medium text-destructive">
                    {t('backup.restoreBlockedTitle')}
                  </p>
                  {!restoreDialog.preview.enough_space && (
                    <p className="text-xs">
                      {t('backup.restoreNoSpace', {
                        need: formatBytes(restoreDialog.preview.total_bytes),
                        free: formatBytes(restoreDialog.preview.free_bytes),
                      })}
                    </p>
                  )}
                  {restoreDialog.preview.rejected.map((r) => (
                    <p key={r.path} className="text-xs font-mono truncate">
                      {r.path} — {r.reason}
                    </p>
                  ))}
                  {restoreDialog.preview.type_conflicts.map((p) => (
                    <p key={p} className="text-xs font-mono truncate">
                      {p} — {t('backup.restoreTypeConflict')}
                    </p>
                  ))}
                  {(restoreDialog.preview.rejected_count > restoreDialog.preview.rejected.length ||
                    restoreDialog.preview.type_conflict_count >
                      restoreDialog.preview.type_conflicts.length) && (
                    <p className="text-xs text-muted-foreground">
                      {t('backup.restoreMoreBlocked', {
                        count:
                          restoreDialog.preview.rejected_count +
                          restoreDialog.preview.type_conflict_count -
                          restoreDialog.preview.rejected.length -
                          restoreDialog.preview.type_conflicts.length,
                      })}
                    </p>
                  )}
                </div>
              )}
              {restoreDialog.preview.conflict_count === 0 ? (
                <p className="text-sm text-muted-foreground">{t('backup.restoreNoConflicts')}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-600">
                    {t('backup.restoreConflictWarning', {
                      count: restoreDialog.preview.conflict_count,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {restoreDialog.preview.conflict_roots.map((r) => (
                      <Badge key={r.root} variant="outline">
                        {r.root} × {r.count}
                      </Badge>
                    ))}
                  </div>
                  <ul className="max-h-40 overflow-y-auto space-y-0.5 rounded-md border border-border/40 p-2">
                    {restoreDialog.preview.conflicts.slice(0, 200).map((c) => (
                      <li key={c.path} className="text-xs font-mono truncate">
                        {c.path}
                        <span className="text-muted-foreground">
                          {' '}
                          {formatBytes(c.local_size)} → {formatBytes(c.backup_size)}
                        </span>
                      </li>
                    ))}
                    {restoreDialog.preview.conflicts.length > 200 && (
                      <li className="text-xs text-muted-foreground">
                        {t('backup.restoreMoreConflicts', {
                          count: restoreDialog.preview.conflict_count,
                        })}
                      </li>
                    )}
                  </ul>
                  <RadioGroup
                    value={restoreDialog.mode}
                    onValueChange={(v) =>
                      setRestoreDialog((prev) =>
                        prev ? { ...prev, mode: v as RestoreMode } : prev,
                      )
                    }
                    className="space-y-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="overwrite" id="mode-overwrite" />
                      <Label htmlFor="mode-overwrite" className="font-normal">
                        {t('backup.restoreModeOverwrite')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="skip" id="mode-skip" />
                      <Label htmlFor="mode-skip" className="font-normal">
                        {t('backup.restoreModeSkip')}
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">{t('backup.restorePreSaveNote')}</p>
                </div>
              )}
              {restoreDialog.preview.pending_db && (
                <p className="text-xs text-amber-600">{t('backup.restorePendingDb')}</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreBusy}>{t('backup.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!restoreDialog?.preview.can_restore || restoreBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRestore();
              }}
            >
              {restoreBusy ? t('backup.restoring') : t('backup.restoreConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreDone} onOpenChange={(open) => !open && setRestoreDone(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backup.restoreDoneTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreDone &&
                t('backup.restoreResultSummary', {
                  written: restoreDone.written,
                  overwritten: restoreDone.overwritten,
                  skipped: restoreDone.skipped,
                })}
              {restoreDone?.pending_db ? ` ${t('backup.restorePendingDb')}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('backup.cancel')}</AlertDialogCancel>
            {restoreDone && (restoreDone.pending_db || restoreDone.overwritten > 0) && (
              <AlertDialogAction onClick={() => void handleRestartCore()}>
                {t('backup.restartNow')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinnedPage>
  );
}
