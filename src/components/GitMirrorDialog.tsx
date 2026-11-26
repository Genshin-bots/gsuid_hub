import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GitBranch,
  Globe,
  Link,
  Radar,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PluginIcon } from '@/components/ui/plugin-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  type GitMirrorInfo,
  type GitMirrorOption,
  type GitMirrorSetAllResponse,
  type GitPluginInfo,
  type MirrorProbeResult,
  getApiErrorMessage,
  gitMirrorApi,
} from '@/lib/api';
import {
  type CustomMirrorErrorReason,
  type MirrorBadgeTone,
  buildPluginMirrorOptions,
  CUSTOM_MIRROR_VALUE,
  CUSTOM_PROXY_VALUE,
  canPluginUseCustomMirror,
  canPluginUseCustomProxy,
  DEFAULT_MIRROR_VALUE,
  getMirrorBadgeMeta,
  getSourceBadgeInfo,
  isHttpUrl,
  isPluginSwitchable,
  resolveInitialMirrorSelection,
  resolveMirrorSubmitPayload,
  resolvePluginInitialMirrorSelection,
  SOURCE_BADGE_CLASSES,
  SSH_MIRROR_VALUE,
} from '@/lib/pluginSource';
import { cn } from '@/lib/utils';

// ============================================================================
// 类型定义与样式映射
// ============================================================================

interface GitMirrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const MIRROR_TONE_CLASSES: Record<MirrorBadgeTone, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  green: 'bg-green-600/20 text-green-600 border-green-600/30',
  blue: 'bg-blue-600/20 text-blue-600 border-blue-600/30',
  violet: 'bg-violet-600/20 text-violet-600 border-violet-600/30',
  slate: 'bg-muted/80 text-muted-foreground border-border',
  amber: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
};

// ============================================================================
// 工具函数
// ============================================================================

/** 根据 mirror 字段、remote_url 与 upstream_host 获取镜像状态的 Badge 颜色和图标 */
export function getMirrorBadge(
  mirror: string,
  remoteUrl: string,
  t: (key: string) => string,
  upstreamHost?: string,
) {
  const meta = getMirrorBadgeMeta(mirror, remoteUrl, upstreamHost, t);
  const icon =
    meta.iconKind === 'ssh' ? (
      <GitBranch className="w-3 h-3 shrink-0" />
    ) : meta.iconKind === 'server' ? (
      <Server className="w-3 h-3 shrink-0" />
    ) : meta.iconKind === 'link' ? (
      <Link className="w-3 h-3 shrink-0" />
    ) : meta.iconKind === 'globe' ? (
      <Globe className="w-3 h-3 shrink-0" />
    ) : (
      <XCircle className="w-3 h-3 shrink-0" />
    );
  return {
    label: meta.label,
    className: MIRROR_TONE_CLASSES[meta.tone],
    icon,
  };
}

function getMirrorTypeLabel(type: string, t: (key: string) => string) {
  switch (type) {
    case 'mirror':
      return t('gitMirror.mirrorTypeMirror');
    case 'proxy':
      return t('gitMirror.mirrorTypeProxy');
    case 'ssh':
      return t('gitMirror.mirrorTypeSsh');
    default:
      return t('gitMirror.mirrorTypeDefault');
  }
}

function getMirrorOptionIcon(type: string) {
  switch (type) {
    case 'mirror':
      return <Server className="w-4 h-4 shrink-0" />;
    case 'proxy':
      return <Link className="w-4 h-4 shrink-0" />;
    case 'ssh':
      return <GitBranch className="w-4 h-4 shrink-0" />;
    default:
      return <Globe className="w-4 h-4 shrink-0" />;
  }
}

function customUrlErrorText(reason: CustomMirrorErrorReason, t: (key: string) => string): string {
  switch (reason) {
    case 'empty':
      return t('gitMirror.customUrlEmpty');
    case 'invalid_scheme':
      return t('gitMirror.customUrlInvalidScheme');
    case 'credentials':
      return t('gitMirror.customUrlCredentials');
    case 'loopback':
      return t('gitMirror.customUrlLoopback');
    default:
      return t('gitMirror.customUrlInvalid');
  }
}

function probeChannelLabel(channel: string, t: (key: string) => string): string {
  switch (channel) {
    case 'cnb':
      return t('gitMirror.cnb');
    case 'gitcode':
      return t('gitMirror.gitcode');
    case 'ghproxy':
      return t('gitMirror.ghproxy');
    case 'ssh':
      return t('gitMirror.ssh');
    case 'github':
      return t('gitMirror.github');
    case 'custom_proxy':
      return t('gitMirror.customProxyShort');
    case 'custom_mirror':
      return t('gitMirror.customMirrorShort');
    default:
      return channel;
  }
}

function ProbeCapsule({ probe, t }: { probe: MirrorProbeResult; t: (key: string) => string }) {
  const name = probeChannelLabel(probe.channel, t);
  if (probe.state === 'available') {
    return (
      <Badge
        variant="outline"
        title={probe.detail || `${name}: ${t('gitMirror.probeAvailable')}`}
        className="text-[11px] px-1.5 py-0 h-5 shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      >
        {name} ✓
      </Badge>
    );
  }
  if (probe.state === 'not_synced') {
    return (
      <Badge
        variant="outline"
        title={probe.detail || `${name}: ${t('gitMirror.probeNotSynced')}`}
        className="text-[11px] px-1.5 py-0 h-5 shrink-0 bg-muted text-muted-foreground border-border"
      >
        {name} ✕
      </Badge>
    );
  }
  if (probe.state === 'unreachable') {
    return (
      <Badge
        variant="outline"
        title={probe.detail || `${name}: ${t('gitMirror.probeUnreachable')}`}
        className="text-[11px] px-1.5 py-0 h-5 shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
      >
        {name} !
      </Badge>
    );
  }
  return null;
}

function PluginNameWithIcon({
  plugin,
  isCore,
  coreLabel,
  t,
  className,
}: {
  plugin: GitPluginInfo;
  isCore: boolean;
  coreLabel: string;
  t: (key: string) => string;
  className?: string;
}) {
  const sourceBadge = getSourceBadgeInfo(
    plugin.source_kind,
    plugin.upstream_host,
    t,
    plugin.upstream_url,
  );
  return (
    <div className={cn('flex items-center gap-1.5 min-w-0', className)}>
      <PluginIcon pluginName={plugin.name} className="w-4 h-4 shrink-0" />
      {isCore ? (
        <Badge className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0">
          {coreLabel}
        </Badge>
      ) : (
        <span className="truncate" title={plugin.name}>
          {plugin.name}
        </span>
      )}
      {sourceBadge && (
        <Badge
          variant="outline"
          title={sourceBadge.title}
          className={cn(
            'text-[11px] px-1.5 py-0 h-5 shrink-0 font-normal',
            SOURCE_BADGE_CLASSES[sourceBadge.tone],
          )}
        >
          {sourceBadge.label}
        </Badge>
      )}
    </div>
  );
}

// ============================================================================
// 组件定义
// ============================================================================

export default function GitMirrorDialog({ open, onOpenChange, onChanged }: GitMirrorDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [mirrorInfo, setMirrorInfo] = useState<GitMirrorInfo | null>(null);
  const [selectedMirror, setSelectedMirror] = useState<string>(DEFAULT_MIRROR_VALUE);
  const [customMirrorUrl, setCustomMirrorUrl] = useState<string>('');
  const [applyAllLoading, setApplyAllLoading] = useState(false);
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);
  const [probeLoading, setProbeLoading] = useState(false);
  const [pluginLoading, setPluginLoading] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [lastBatchResult, setLastBatchResult] = useState<GitMirrorSetAllResponse | null>(null);
  const [batchDetailsOpen, setBatchDetailsOpen] = useState(false);

  // 单插件切换弹窗状态
  const [switchDialogPlugin, setSwitchDialogPlugin] = useState<GitPluginInfo | null>(null);
  const [switchDialogMirror, setSwitchDialogMirror] = useState<string>(DEFAULT_MIRROR_VALUE);
  const [switchDialogCustomUrl, setSwitchDialogCustomUrl] = useState<string>('');
  const fetchSeqRef = useRef(0);

  // 兼容旧版 Core（可能未在 available_mirrors 里返回 ssh://），且绝不重复渲染 SSH 项
  const effectiveMirrors = useMemo<GitMirrorOption[]>(() => {
    const raw = mirrorInfo?.available_mirrors ?? [];
    const seen = new Set<string>();
    const list: GitMirrorOption[] = [];
    for (const item of raw) {
      const key = item.value.trim().replace(/\/+$/, '').toLowerCase() || DEFAULT_MIRROR_VALUE;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(item);
    }
    if (!list.some((item) => item.value.trim().toLowerCase() === SSH_MIRROR_VALUE)) {
      list.push({
        label: t('gitMirror.sshMirror'),
        value: SSH_MIRROR_VALUE,
        type: 'ssh',
        channel: 'ssh',
      });
    }
    return list;
  }, [mirrorInfo?.available_mirrors, t]);

  const singlePluginOptions = useMemo(
    () => buildPluginMirrorOptions(switchDialogPlugin, effectiveMirrors),
    [switchDialogPlugin, effectiveMirrors],
  );

  // 获取镜像信息（按请求序号防竞态，避免慢请求覆盖最新刷新结果）
  const fetchMirrorInfo = useCallback(
    async (options?: { fresh?: boolean; probe?: boolean; preserveSelection?: boolean }) => {
      const seq = ++fetchSeqRef.current;
      try {
        setLoading(true);
        const data = await gitMirrorApi.getInfo({
          fresh: options?.fresh,
          probe: options?.probe,
        });
        if (seq !== fetchSeqRef.current) return;
        setMirrorInfo(data);
        if (!options?.preserveSelection) {
          const initial = resolveInitialMirrorSelection(
            data.current_mirror,
            data.current_mirror_mode,
            data.available_mirrors,
          );
          setSelectedMirror(initial.selectValue);
          setCustomMirrorUrl(initial.customUrl);
        }
      } catch (error) {
        if (seq !== fetchSeqRef.current) return;
        console.error('Failed to fetch git mirror info:', error);
        toast.error(getApiErrorMessage(error, t('gitMirror.loadFailed')));
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    if (open) {
      setLastBatchResult(null);
      setBatchDetailsOpen(false);
      fetchMirrorInfo();
    }
  }, [open, fetchMirrorInfo]);

  const isCustomSelected =
    selectedMirror === CUSTOM_PROXY_VALUE || selectedMirror === CUSTOM_MIRROR_VALUE;
  const isSwitchCustomSelected =
    switchDialogMirror === CUSTOM_PROXY_VALUE || switchDialogMirror === CUSTOM_MIRROR_VALUE;
  const canSwitchUseCustomMirror = canPluginUseCustomMirror(switchDialogPlugin);
  const canSwitchUseCustomProxy = canPluginUseCustomProxy(switchDialogPlugin);

  // 主动探测所有插件各可用镜像源
  const handleProbeAll = async () => {
    try {
      setProbeLoading(true);
      const res = await gitMirrorApi.probe({ force: true });
      setMirrorInfo((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plugins: prev.plugins.map((p) => {
            const matched = res.probes[p.name];
            return matched ? { ...p, mirror_probes: matched } : p;
          }),
        };
      });
      toast.success(t('gitMirror.probeSuccess'));
    } catch (error) {
      console.error('Failed to probe git mirrors:', error);
      toast.error(getApiErrorMessage(error, t('gitMirror.probeFailed')));
    } finally {
      setProbeLoading(false);
    }
  };

  // 打开批量应用确认框前先校验自定义 URL
  const handleOpenApplyConfirm = () => {
    const payload = resolveMirrorSubmitPayload(selectedMirror, customMirrorUrl);
    if ('reason' in payload) {
      toast.error(customUrlErrorText(payload.reason, t));
      return;
    }
    setShowConfirmDialog(true);
  };

  // 批量应用到所有插件
  const handleApplyAll = async () => {
    const payload = resolveMirrorSubmitPayload(selectedMirror, customMirrorUrl);
    if ('reason' in payload) {
      toast.error(customUrlErrorText(payload.reason, t));
      setShowConfirmDialog(false);
      return;
    }
    try {
      setApplyAllLoading(true);
      const result = await gitMirrorApi.setAll(payload.mirrorPrefix, payload.mirrorType);
      setLastBatchResult(result);
      const skippedCount = result.summary.skipped_count;
      const summaryText =
        skippedCount !== undefined
          ? t('gitMirror.applyToAllSummary', {
              success: result.summary.success_count,
              skipped: skippedCount,
              fail: result.summary.fail_count,
            })
          : t('gitMirror.applyToAllSuccess', {
              success: result.summary.success_count,
              fail: result.summary.fail_count,
            });
      if (result.summary.fail_count > 0 && result.summary.success_count === 0) {
        toast.error(summaryText);
      } else if (result.summary.fail_count > 0) {
        toast.warning(summaryText);
      } else {
        toast.success(summaryText);
      }
      if (result.summary.fail_count > 0 || (skippedCount ?? 0) > 0) {
        setBatchDetailsOpen(true);
      }
      await fetchMirrorInfo({
        fresh: true,
        preserveSelection: result.summary.config_updated === false,
      });
      onChanged?.();
    } catch (error) {
      console.error('Failed to apply mirror to all plugins:', error);
      toast.error(getApiErrorMessage(error, t('gitMirror.applyToAllFailed')));
    } finally {
      setApplyAllLoading(false);
      setShowConfirmDialog(false);
    }
  };

  // 仅保存配置（不影响已安装插件）
  const handleSaveConfig = async () => {
    const payload = resolveMirrorSubmitPayload(selectedMirror, customMirrorUrl);
    if ('reason' in payload) {
      toast.error(customUrlErrorText(payload.reason, t));
      return;
    }
    try {
      setSaveConfigLoading(true);
      const saved = await gitMirrorApi.saveConfig(
        payload.mirrorPrefix,
        payload.mirrorType,
        mirrorInfo?.current_mirror_mode !== undefined ? payload.configMode : undefined,
      );
      setMirrorInfo((prev) =>
        prev
          ? {
              ...prev,
              current_mirror: saved.current_mirror,
              current_mirror_mode: saved.current_mirror_mode,
            }
          : prev,
      );
      toast.success(t('gitMirror.saveConfigSuccess'));
      onChanged?.();
    } catch (error) {
      console.error('Failed to save mirror config:', error);
      toast.error(getApiErrorMessage(error, t('gitMirror.saveConfigFailed')));
    } finally {
      setSaveConfigLoading(false);
    }
  };

  // 打开单插件切换弹窗：以该插件自身当前 remote/mirror 初始化，避免误用全局项覆盖 origin
  const openSwitchDialog = (plugin: GitPluginInfo) => {
    setSwitchDialogPlugin(plugin);
    const initial = resolvePluginInitialMirrorSelection(plugin, effectiveMirrors);
    setSwitchDialogMirror(initial.selectValue);
    setSwitchDialogCustomUrl(initial.customUrl);
  };

  // 切换单个插件的镜像源
  const handleSwitchPlugin = async () => {
    if (!switchDialogPlugin) return;
    const payload = resolveMirrorSubmitPayload(switchDialogMirror, switchDialogCustomUrl);
    if ('reason' in payload) {
      toast.error(customUrlErrorText(payload.reason, t));
      return;
    }
    const pluginName = switchDialogPlugin.name;
    try {
      setPluginLoading(pluginName);
      const res = await gitMirrorApi.setPlugin(
        pluginName,
        payload.mirrorPrefix,
        payload.mirrorType,
      );
      toast.success(res.message || t('gitMirror.setPluginSuccess', { name: pluginName }));
      setSwitchDialogPlugin(null);
      await fetchMirrorInfo({ fresh: true });
      onChanged?.();
    } catch (error) {
      console.error(`Failed to switch mirror for plugin ${pluginName}:`, error);
      toast.error(getApiErrorMessage(error, t('gitMirror.setPluginFailed', { name: pluginName })));
    } finally {
      setPluginLoading(null);
    }
  };

  // 获取当前选中镜像源的显示名称
  const getSelectedMirrorLabel = () => {
    if (selectedMirror === CUSTOM_PROXY_VALUE) {
      return `${t('gitMirror.customProxy')} (${customMirrorUrl.trim()})`;
    }
    if (selectedMirror === CUSTOM_MIRROR_VALUE) {
      return `${t('gitMirror.customMirror')} (${customMirrorUrl.trim()})`;
    }
    const realValue = selectedMirror === DEFAULT_MIRROR_VALUE ? '' : selectedMirror;
    const found = effectiveMirrors.find((m) => m.value === realValue);
    return found ? found.label : realValue || t('gitMirror.defaultMirror');
  };

  const renderBatchStatusBadge = (status: string | undefined, success: boolean) => {
    const resolved = status || (success ? 'switched' : 'failed');
    switch (resolved) {
      case 'switched':
        return (
          <Badge
            variant="outline"
            className="text-xs shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
          >
            {t('gitMirror.statusSwitched')}
          </Badge>
        );
      case 'unchanged':
        return (
          <Badge variant="outline" className="text-xs shrink-0">
            {t('gitMirror.statusUnchanged')}
          </Badge>
        );
      case 'skipped':
        return (
          <Badge
            variant="outline"
            className="text-xs shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/30"
          >
            {t('gitMirror.statusSkipped')}
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="text-xs shrink-0">
            {t('gitMirror.statusFailed')}
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn('w-[95vw] max-w-5xl max-h-[85vh] flex flex-col', 'glass-card')}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <GitBranch className="w-5 h-5" />
              {t('gitMirror.title')}
            </DialogTitle>
            <DialogDescription>{t('gitMirror.description')}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : mirrorInfo ? (
            <div className="flex flex-col gap-3 overflow-hidden flex-1">
              {/* 镜像源选择与工具栏 */}
              <div className="flex flex-col gap-3 p-4 rounded-lg glass-card">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={selectedMirror}
                      onValueChange={setSelectedMirror}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger className="w-full h-10">
                        <SelectValue placeholder={t('gitMirror.selectMirror')} />
                      </SelectTrigger>
                      <SelectContent>
                        {effectiveMirrors.map((mirror) => (
                          <SelectItem
                            key={mirror.value || DEFAULT_MIRROR_VALUE}
                            value={mirror.value || DEFAULT_MIRROR_VALUE}
                          >
                            <div className="flex items-center gap-2">
                              {getMirrorOptionIcon(mirror.type)}
                              <span>{mirror.label}</span>
                              <Badge variant="outline" className="text-xs ml-1">
                                {getMirrorTypeLabel(mirror.type, t)}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_PROXY_VALUE}>
                          <div className="flex items-center gap-2">
                            <Link className="w-4 h-4 shrink-0" />
                            <span>{t('gitMirror.customProxy')}</span>
                            <Badge variant="outline" className="text-xs ml-1">
                              {t('gitMirror.mirrorTypeProxy')}
                            </Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value={CUSTOM_MIRROR_VALUE}>
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 shrink-0" />
                            <span>{t('gitMirror.customMirror')}</span>
                            <Badge variant="outline" className="text-xs ml-1">
                              {t('gitMirror.mirrorTypeMirror')}
                            </Badge>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchMirrorInfo({ fresh: true, preserveSelection: true })}
                      disabled={loading || probeLoading}
                      className="h-10 w-10 shrink-0"
                      title={t('gitMirror.refresh')}
                    >
                      <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleProbeAll}
                          disabled={probeLoading || loading}
                          className="h-10 gap-1.5"
                        >
                          <Radar className={cn('w-4 h-4', probeLoading && 'animate-spin')} />
                          <span>
                            {probeLoading ? t('gitMirror.probing') : t('gitMirror.probeAll')}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSaveConfig}
                          disabled={saveConfigLoading}
                          className="h-10 gap-1.5"
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
                          onClick={handleOpenApplyConfirm}
                          disabled={applyAllLoading}
                          className="h-10 gap-1.5"
                        >
                          {applyAllLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {t('gitMirror.applyToAll')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* 自定义反代 / 自定义扁平镜像前缀输入框 */}
                {isCustomSelected && (
                  <div className="space-y-1.5">
                    <Input
                      value={customMirrorUrl}
                      onChange={(e) => setCustomMirrorUrl(e.target.value)}
                      disabled={!isAdmin}
                      readOnly={!isAdmin}
                      placeholder={
                        selectedMirror === CUSTOM_PROXY_VALUE
                          ? t('gitMirror.customProxyPlaceholder')
                          : t('gitMirror.customMirrorPlaceholder')
                      }
                      className="h-9 font-mono text-sm"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-xs text-muted-foreground">
                      {selectedMirror === CUSTOM_PROXY_VALUE
                        ? t('gitMirror.customProxyHint')
                        : t('gitMirror.customMirrorHint')}
                    </p>
                  </div>
                )}
              </div>

              {/* 最近一次批量切换明细（可折叠） */}
              {lastBatchResult && (
                <Collapsible
                  open={batchDetailsOpen}
                  onOpenChange={setBatchDetailsOpen}
                  className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-xs font-medium text-foreground"
                    >
                      <span className="truncate">
                        {t('gitMirror.batchResultTitle')} —{' '}
                        {t('gitMirror.applyToAllSummary', {
                          success: lastBatchResult.summary.success_count,
                          skipped: lastBatchResult.summary.skipped_count ?? 0,
                          fail: lastBatchResult.summary.fail_count,
                        })}
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform',
                          batchDetailsOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 border-t border-border/40 pt-2">
                      {lastBatchResult.results.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {renderBatchStatusBadge(item.status, item.success)}
                            <span className="font-medium shrink-0">{item.name}</span>
                            <span className="text-muted-foreground truncate" title={item.message}>
                              {item.message}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* 插件列表 - 移动端卡片布局，桌面端表格布局 */}
              <div className="flex-1 rounded-lg glass-card min-h-0">
                {/* 滚动裁切放内层并继承圆角，表格四角才不会戳出卡片 */}
                <div className="overflow-auto max-h-[400px] rounded-[inherit]">
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
                              <TableHead className="w-[220px]">
                                {t('gitMirror.pluginName')}
                              </TableHead>
                              <TableHead>{t('gitMirror.remoteUrl')}</TableHead>
                              <TableHead className="w-[120px]">
                                {t('gitMirror.mirrorStatus')}
                              </TableHead>
                              <TableHead className="w-[90px] text-right">
                                {t('gitMirror.actions')}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mirrorInfo.plugins.map((plugin) => {
                              const badge = getMirrorBadge(
                                plugin.mirror,
                                plugin.remote_url,
                                t,
                                plugin.upstream_host,
                              );
                              const isCore = plugin.name === 'gsuid_core';
                              const isLoading = pluginLoading === plugin.name;
                              const switchable = isPluginSwitchable(plugin);
                              const probes = plugin.mirror_probes ?? [];
                              return (
                                <TableRow
                                  key={plugin.name}
                                  className={!plugin.is_git_repo ? 'opacity-50' : ''}
                                >
                                  <TableCell className="font-medium max-w-[240px]">
                                    <PluginNameWithIcon
                                      plugin={plugin}
                                      isCore={isCore}
                                      coreLabel={t('gitMirror.core')}
                                      t={t}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {plugin.is_git_repo && plugin.remote_url ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <code
                                            className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[320px] truncate block"
                                            title={plugin.upstream_url || plugin.remote_url}
                                          >
                                            {plugin.remote_url}
                                          </code>
                                          {isHttpUrl(plugin.remote_url) && (
                                            <a
                                              href={plugin.remote_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-muted-foreground hover:text-foreground shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                          )}
                                        </div>
                                        {probes.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1">
                                            {probes.map((probe) => (
                                              <ProbeCapsule
                                                key={`${plugin.name}-${probe.channel}-${probe.target_url}`}
                                                probe={probe}
                                                t={t}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">
                                        {t('gitMirror.notGitRepo')}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs max-w-[140px] ${badge.className}`}
                                      title={badge.label}
                                    >
                                      <span className="flex items-center gap-1 min-w-0">
                                        {badge.icon}
                                        <span className="truncate">{badge.label}</span>
                                      </span>
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isAdmin && plugin.is_git_repo ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 text-xs"
                                        disabled={isLoading || !switchable}
                                        title={
                                          !switchable
                                            ? t('gitMirror.nativeSwitchDisabled')
                                            : undefined
                                        }
                                        onClick={() => openSwitchDialog(plugin)}
                                      >
                                        {isLoading ? (
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <GitBranch className="w-3 h-3" />
                                        )}
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
                          const badge = getMirrorBadge(
                            plugin.mirror,
                            plugin.remote_url,
                            t,
                            plugin.upstream_host,
                          );
                          const isCore = plugin.name === 'gsuid_core';
                          const isLoading = pluginLoading === plugin.name;
                          const switchable = isPluginSwitchable(plugin);
                          const probes = plugin.mirror_probes ?? [];
                          return (
                            <div
                              key={plugin.name}
                              className={cn(
                                'rounded-lg p-3 space-y-2 glass-card',
                                !plugin.is_git_repo && 'opacity-50',
                              )}
                            >
                              {/* 第一行：名称 + 镜像状态 + 操作按钮 */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <PluginNameWithIcon
                                    plugin={plugin}
                                    isCore={isCore}
                                    coreLabel={t('gitMirror.core')}
                                    t={t}
                                    className="font-medium text-sm"
                                  />
                                  <Badge
                                    variant="outline"
                                    className={`text-xs shrink-0 ${badge.className}`}
                                  >
                                    <span className="flex items-center gap-1">
                                      {badge.icon}
                                      {badge.label}
                                    </span>
                                  </Badge>
                                </div>
                                {isAdmin && plugin.is_git_repo ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-xs shrink-0"
                                    disabled={isLoading || !switchable}
                                    title={
                                      !switchable ? t('gitMirror.nativeSwitchDisabled') : undefined
                                    }
                                    onClick={() => openSwitchDialog(plugin)}
                                  >
                                    {isLoading ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <GitBranch className="w-3 h-3" />
                                    )}
                                    {t('gitMirror.switch')}
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground text-xs shrink-0">-</span>
                                )}
                              </div>
                              {/* 第二行：Remote URL */}
                              {plugin.is_git_repo && plugin.remote_url ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block flex-1">
                                      {plugin.remote_url}
                                    </code>
                                    {isHttpUrl(plugin.remote_url) && (
                                      <a
                                        href={plugin.remote_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                  {probes.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {probes.map((probe) => (
                                        <ProbeCapsule
                                          key={`${plugin.name}-m-${probe.channel}-${probe.target_url}`}
                                          probe={probe}
                                          t={t}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  {t('gitMirror.notGitRepo')}
                                </span>
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
            <AlertDialogAction onClick={handleApplyAll}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 单个插件切换对话框 */}
      <Dialog
        open={switchDialogPlugin !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSwitchDialogPlugin(null);
        }}
      >
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              {t('gitMirror.switchMirror')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-2 min-w-0">
                {switchDialogPlugin ? (
                  <PluginIcon pluginName={switchDialogPlugin.name} className="w-4 h-4 shrink-0" />
                ) : null}
                <span className="truncate">{switchDialogPlugin?.name}</span>
                {switchDialogPlugin &&
                  (() => {
                    const sb = getSourceBadgeInfo(
                      switchDialogPlugin.source_kind,
                      switchDialogPlugin.upstream_host,
                      t,
                      switchDialogPlugin.upstream_url,
                    );
                    if (!sb) return null;
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px] px-1.5 py-0 h-5 shrink-0',
                          SOURCE_BADGE_CLASSES[sb.tone],
                        )}
                      >
                        {sb.label}
                      </Badge>
                    );
                  })()}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {switchDialogPlugin?.source_kind === 'fork' && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('gitMirror.forkMirrorBlocked')}</span>
              </div>
            )}
            {switchDialogPlugin?.source_kind === 'third_party' && (
              <div className="flex items-start gap-2 rounded-md border border-violet-500/30 bg-violet-500/10 p-2.5 text-xs text-violet-700 dark:text-violet-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('gitMirror.thirdPartyMirrorBlocked')}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('gitMirror.selectMirror')}</label>
              <Select value={switchDialogMirror} onValueChange={setSwitchDialogMirror}>
                <SelectTrigger>
                  <SelectValue placeholder={t('gitMirror.selectMirror')} />
                </SelectTrigger>
                <SelectContent>
                  {singlePluginOptions.map((item) => (
                    <SelectItem
                      key={item.selectValue}
                      value={item.selectValue}
                      disabled={item.disabled}
                    >
                      <div className="flex items-center gap-2">
                        {getMirrorOptionIcon(item.option.type)}
                        <span>{item.option.label}</span>
                        {item.probeState === 'available' && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
                        )}
                        {item.probeState === 'not_synced' && (
                          <span className="text-xs text-muted-foreground">
                            ({t('gitMirror.probeNotSynced')})
                          </span>
                        )}
                        {item.probeState === 'unreachable' && (
                          <span
                            className="text-xs text-amber-600 dark:text-amber-400"
                            title={t('gitMirror.probeRetryHint')}
                          >
                            ({t('gitMirror.probeUnreachable')})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_PROXY_VALUE} disabled={!canSwitchUseCustomProxy}>
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 shrink-0" />
                      <span>{t('gitMirror.customProxy')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value={CUSTOM_MIRROR_VALUE} disabled={!canSwitchUseCustomMirror}>
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 shrink-0" />
                      <span>{t('gitMirror.customMirror')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSwitchCustomSelected && (
              <div className="space-y-1.5">
                <Input
                  value={switchDialogCustomUrl}
                  onChange={(e) => setSwitchDialogCustomUrl(e.target.value)}
                  placeholder={
                    switchDialogMirror === CUSTOM_PROXY_VALUE
                      ? t('gitMirror.customProxyPlaceholder')
                      : t('gitMirror.customMirrorPlaceholder')
                  }
                  className="h-9 font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  {switchDialogMirror === CUSTOM_PROXY_VALUE
                    ? t('gitMirror.customProxyHint')
                    : t('gitMirror.customMirrorHint')}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSwitchDialogPlugin(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSwitchPlugin} disabled={pluginLoading !== null}>
                {pluginLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
