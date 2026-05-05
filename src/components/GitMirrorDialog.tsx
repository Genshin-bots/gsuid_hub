import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch,
  Globe,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Link,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  gitMirrorApi,
  GitMirrorInfo,
  GitMirrorOption,
  GitPluginInfo,
} from '@/lib/api';

// Radix UI Select 不允许空字符串作为 value，使用此常量作为默认值的占位符
const DEFAULT_MIRROR_VALUE = '__github_default__';
// SSH 协议的特殊值
const SSH_MIRROR_VALUE = '__ssh__';
// SSH 前缀（用于传递给后端）
const SSH_MIRROR_PREFIX = 'ssh://git@ssh.github.com:443/';

// ============================================================================
// 类型定义
// ============================================================================

interface GitMirrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// 工具函数
// ============================================================================

/** 检测是否为 SSH URL */
function isSshUrl(url: string): boolean {
  return url.startsWith('ssh://') || url.startsWith('git@');
}

/** 根据 mirror 字段和 remote_url 获取镜像状态的 Badge 颜色和图标 */
export function getMirrorBadge(mirror: string, remoteUrl: string, t: (key: string) => string) {
  // 优先检测 SSH URL（无论后端返回什么 mirror 值，只要 URL 是 SSH 格式就显示 SSH）
  if (remoteUrl && isSshUrl(remoteUrl)) {
    return {
      label: 'SSH',
      className: 'bg-green-600/20 text-green-600 border-green-600/30',
      icon: <GitBranch className="w-3 h-3" />,
    };
  }
  switch (mirror) {
    case 'gitcode':
      return {
        label: t('gitMirror.gitcode'),
        className: 'bg-green-600/20 text-green-600 border-green-600/30',
        icon: <Server className="w-3 h-3" />,
      };
    case 'cnb':
      return {
        label: t('gitMirror.cnb'),
        className: 'bg-green-600/20 text-green-600 border-green-600/30',
        icon: <Server className="w-3 h-3" />,
      };
    case 'ghproxy':
      return {
        label: t('gitMirror.ghproxy'),
        className: 'bg-blue-600/20 text-blue-600 border-blue-600/30',
        icon: <Link className="w-3 h-3" />,
      };
    case 'github':
      return {
        label: t('gitMirror.github'),
        className: 'bg-primary/10 text-primary border-primary/20',
        icon: <Globe className="w-3 h-3" />,
      };
    default:
      return {
        label: t('gitMirror.unknown'),
        className: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
        icon: <XCircle className="w-3 h-3" />,
      };
  }
}

/** 根据 available_mirrors 的 type 获取镜像源类型的翻译 */
function getMirrorTypeLabel(type: string, t: (key: string) => string) {
  switch (type) {
    case 'mirror':
      return t('gitMirror.mirrorTypeMirror');
    case 'proxy':
      return t('gitMirror.mirrorTypeProxy');
    default:
      return t('gitMirror.mirrorTypeDefault');
  }
}

/** 获取镜像源选项的图标 */
function getMirrorOptionIcon(type: string) {
  switch (type) {
    case 'mirror':
      return <Server className="w-4 h-4" />;
    case 'proxy':
      return <Link className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

// ============================================================================
// 组件定义
// ============================================================================

export default function GitMirrorDialog({ open, onOpenChange }: GitMirrorDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [mirrorInfo, setMirrorInfo] = useState<GitMirrorInfo | null>(null);
  const [selectedMirror, setSelectedMirror] = useState<string>(DEFAULT_MIRROR_VALUE);
  const [applyAllLoading, setApplyAllLoading] = useState(false);
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);
  const [pluginLoading, setPluginLoading] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [switchDialogPlugin, setSwitchDialogPlugin] = useState<string | null>(null);
  const [switchDialogMirror, setSwitchDialogMirror] = useState<string>(DEFAULT_MIRROR_VALUE);

  // 将后端的空字符串值转换为 Select 可用的占位符值
  const toSelectValue = (value: string) => value || DEFAULT_MIRROR_VALUE;
  // 将 Select 的占位符值转换回后端需要的值
  const toMirrorValue = (value: string) => {
    if (value === DEFAULT_MIRROR_VALUE) return '';
    if (value === SSH_MIRROR_VALUE) return SSH_MIRROR_PREFIX;
    return value;
  };

  // 获取镜像信息
  const fetchMirrorInfo = useCallback(async () => {
    try {
      setLoading(true);
      const data = await gitMirrorApi.getInfo();
      setMirrorInfo(data);
      // 设置当前镜像源为选中值（空字符串映射为占位符）
      setSelectedMirror(toSelectValue(data.current_mirror));
    } catch (error) {
      console.error('Failed to fetch git mirror info:', error);
      toast({
        title: t('common.error'),
        description: t('gitMirror.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (open) {
      fetchMirrorInfo();
    }
  }, [open, fetchMirrorInfo]);

  // 批量应用到所有插件
  const handleApplyAll = async () => {
    try {
      setApplyAllLoading(true);
      const result = await gitMirrorApi.setAll(toMirrorValue(selectedMirror));
      toast({
        title: t('common.success'),
        description: t('gitMirror.applyToAllSuccess', {
          success: result.summary.success_count,
          fail: result.summary.fail_count,
        }),
      });
      // 刷新数据
      await fetchMirrorInfo();
    } catch (error) {
      console.error('Failed to apply mirror to all plugins:', error);
      toast({
        title: t('common.error'),
        description: t('gitMirror.applyToAllFailed'),
        variant: 'destructive',
      });
    } finally {
      setApplyAllLoading(false);
      setShowConfirmDialog(false);
    }
  };

  // 仅保存配置（不影响已安装插件）
  const handleSaveConfig = async () => {
    try {
      setSaveConfigLoading(true);
      await gitMirrorApi.saveConfig(toMirrorValue(selectedMirror));
      toast({
        title: t('common.success'),
        description: t('gitMirror.saveConfigSuccess'),
      });
    } catch (error) {
      console.error('Failed to save mirror config:', error);
      toast({
        title: t('common.error'),
        description: t('gitMirror.saveConfigFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaveConfigLoading(false);
    }
  };

  // 切换单个插件的镜像源
  const handleSwitchPlugin = async (pluginName: string, mirrorPrefix: string) => {
    try {
      setPluginLoading(pluginName);
      await gitMirrorApi.setPlugin(pluginName, toMirrorValue(mirrorPrefix));
      toast({
        title: t('common.success'),
        description: t('gitMirror.setPluginSuccess', { name: pluginName }),
      });
      // 刷新数据
      await fetchMirrorInfo();
    } catch (error) {
      console.error(`Failed to switch mirror for plugin ${pluginName}:`, error);
      toast({
        title: t('common.error'),
        description: t('gitMirror.setPluginFailed', { name: pluginName }),
        variant: 'destructive',
      });
    } finally {
      setPluginLoading(null);
      setSwitchDialogPlugin(null);
    }
  };

  // 获取当前选中镜像源的显示名称
  const getSelectedMirrorLabel = () => {
    if (!mirrorInfo) return '';
    const realValue = toMirrorValue(selectedMirror);
    const found = mirrorInfo.available_mirrors.find(m => m.value === realValue);
    return found ? found.label : realValue || t('gitMirror.defaultMirror');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("w-[95vw] max-w-4xl max-h-[85vh] flex flex-col", "glass-card")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <GitBranch className="w-5 h-5" />
              {t('gitMirror.title')}
            </DialogTitle>
            <DialogDescription>
              {t('gitMirror.description')}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : mirrorInfo ? (
            <div className="flex flex-col gap-4 overflow-hidden flex-1">
              {/* 镜像源选择区域 */}
              <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-lg glass-card">
                <div className="flex-1 w-full">
                  <Select value={selectedMirror} onValueChange={setSelectedMirror}>
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder={t('gitMirror.selectMirror')} />
                    </SelectTrigger>
                    <SelectContent>
                      {mirrorInfo.available_mirrors.map((mirror) => (
                        <SelectItem key={mirror.value || DEFAULT_MIRROR_VALUE} value={toSelectValue(mirror.value)}>
                          <div className="flex items-center gap-2">
                            {getMirrorOptionIcon(mirror.type)}
                            <span>{mirror.label}</span>
                            <Badge variant="outline" className="text-xs ml-1">
                              {getMirrorTypeLabel(mirror.type, t)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value={SSH_MIRROR_VALUE}>
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4" />
                          <span>{t('gitMirror.ssh')}</span>
                          <Badge variant="outline" className="text-xs ml-1">
                            {t('gitMirror.sshMirror')}
                          </Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={handleSaveConfig}
                    disabled={saveConfigLoading}
                    className="gap-2"
                    title={t('gitMirror.saveConfigHint')}
                  >
                    {saveConfigLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {t('gitMirror.saveConfig')}
                  </Button>
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={applyAllLoading}
                    className="gap-2"
                  >
                    {applyAllLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {t('gitMirror.applyToAll')}
                  </Button>
                </div>
              </div>

              {/* 插件列表 - 移动端卡片布局，桌面端表格布局 */}
              <div className="flex-1 overflow-hidden rounded-lg glass-card">
                <div className="overflow-auto max-h-[400px]">
                  {mirrorInfo.plugins.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('gitMirror.noPlugins')}
                    </div>
                  ) : (
                    <>
                      {/* 桌面端表格 */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                              <TableHead className="w-[120px]">{t('gitMirror.pluginName')}</TableHead>
                              <TableHead>{t('gitMirror.remoteUrl')}</TableHead>
                              <TableHead className="w-[90px]">{t('gitMirror.mirrorStatus')}</TableHead>
                              <TableHead className="w-[90px] text-right">{t('gitMirror.actions')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mirrorInfo.plugins.map((plugin) => {
                              const badge = getMirrorBadge(plugin.mirror, plugin.remote_url, t);
                              const isCore = plugin.name === 'gsuid_core';
                              const isLoading = pluginLoading === plugin.name;
                              return (
                                <TableRow key={plugin.name} className={!plugin.is_git_repo ? 'opacity-50' : ''}>
                                  <TableCell className="font-medium">
                                    {isCore ? (
                                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{t('gitMirror.core')}</Badge>
                                    ) : (
                                      <span className="truncate">{plugin.name}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {plugin.is_git_repo && plugin.remote_url ? (
                                      <div className="flex items-center gap-1.5">
                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[300px] truncate block">{plugin.remote_url}</code>
                                        {plugin.remote_url.startsWith('http') && (
                                          <a href={plugin.remote_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">{t('gitMirror.notGitRepo')}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={`text-xs ${badge.className}`}>
                                      <span className="flex items-center gap-1">{badge.icon}{badge.label}</span>
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {plugin.is_git_repo ? (
                                      <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={isLoading} onClick={() => { setSwitchDialogPlugin(plugin.name); setSwitchDialogMirror(selectedMirror); }}>
                                        {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
                                        {t('gitMirror.switch')}
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* 移动端卡片列表 */}
                      <div className="md:hidden space-y-2 p-2">
                        {mirrorInfo.plugins.map((plugin) => {
                          const badge = getMirrorBadge(plugin.mirror, plugin.remote_url, t);
                          const isCore = plugin.name === 'gsuid_core';
                          const isLoading = pluginLoading === plugin.name;
                          return (
                            <div key={plugin.name} className={cn("rounded-lg p-3 space-y-2 glass-card", !plugin.is_git_repo && "opacity-50")}>
                              {/* 第一行：名称 + 镜像状态 + 操作按钮 */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {isCore ? (
                                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0">{t('gitMirror.core')}</Badge>
                                  ) : (
                                    <span className="font-medium text-sm truncate">{plugin.name}</span>
                                  )}
                                  <Badge variant="outline" className={`text-xs shrink-0 ${badge.className}`}>
                                    <span className="flex items-center gap-1">{badge.icon}{badge.label}</span>
                                  </Badge>
                                </div>
                                {plugin.is_git_repo ? (
                                  <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" disabled={isLoading} onClick={() => { setSwitchDialogPlugin(plugin.name); setSwitchDialogMirror(selectedMirror); }}>
                                    {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <GitBranch className="w-3 h-3" />}
                                    {t('gitMirror.switch')}
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground text-xs shrink-0">-</span>
                                )}
                              </div>
                              {/* 第二行：Remote URL */}
                              {plugin.is_git_repo && plugin.remote_url ? (
                                <div className="flex items-center gap-1.5">
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block flex-1">{plugin.remote_url}</code>
                                  {plugin.remote_url.startsWith('http') && (
                                    <a href={plugin.remote_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">{t('gitMirror.notGitRepo')}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 批量应用确认对话框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gitMirror.applyToAllConfirm', {
                mirror: getSelectedMirrorLabel(),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyAll}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 单个插件切换对话框 */}
      <Dialog
        open={switchDialogPlugin !== null}
        onOpenChange={(open) => {
          if (!open) setSwitchDialogPlugin(null);
        }}
      >
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              {t('gitMirror.switchMirror')}
            </DialogTitle>
            <DialogDescription>
              {switchDialogPlugin}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('gitMirror.selectMirror')}</label>
              <Select value={switchDialogMirror} onValueChange={setSwitchDialogMirror}>
                <SelectTrigger>
                  <SelectValue placeholder={t('gitMirror.selectMirror')} />
                </SelectTrigger>
                <SelectContent>
                  {mirrorInfo?.available_mirrors.map((mirror) => (
                    <SelectItem key={mirror.value || DEFAULT_MIRROR_VALUE} value={toSelectValue(mirror.value)}>
                      <div className="flex items-center gap-2">
                        {getMirrorOptionIcon(mirror.type)}
                        <span>{mirror.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value={SSH_MIRROR_VALUE}>
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      <span>{t('gitMirror.ssh')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSwitchDialogPlugin(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (switchDialogPlugin) {
                    handleSwitchPlugin(switchDialogPlugin, switchDialogMirror);
                  }
                }}
                disabled={pluginLoading !== null}
              >
                {pluginLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
