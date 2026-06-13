/**
 * GsCoreAiMcpServerSection
 *
 * AIConfigPage 内部的「作为 MCP 服务」section。
 * 从 /api/framework-config/GsCore%20AI%20MCP%20Server配置 读取 GsCore AI MCP Server 配置，
 * 使用 DynamicConfigPanel 渲染 enable_mcp_server / mcp_server_transport /
 * mcp_server_port / mcp_server_api_key 等配置项。
 *
 * 该 section 不依赖于 AI 是否启用——MCP Server 自身就是「GsCore 对外的能力暴露」，
 * 即使 AI 未启用，作为 MCP Server 的开关仍可独立配置。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DynamicConfigPanel } from '@/components/config';
import type { ConfigValue } from '@/components/config';
import { frameworkConfigApi, type PluginConfigItem } from '@/lib/api';
import {
  Server, Save, Loader2, AlertTriangle, ShieldCheck, Key, Plug,
  Globe, Terminal, RefreshCw, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MCP_SERVER_CONFIG_ENCODED = 'GsCore%20AI%20MCP%20Server%E9%85%8D%E7%BD%AE';
const MCP_SERVER_CONFIG_FULL_NAME = 'GsCore AI MCP Server配置';

interface RawServerConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

export interface GsCoreAiMcpServerSectionProps {
  t: (key: string) => string;
  /** 玻璃拟态样式开关，用于卡片样式 */
  isGlass?: boolean;
}

export function GsCoreAiMcpServerSection({
  t,
  isGlass = false,
}: GsCoreAiMcpServerSectionProps) {
  const [rawConfig, setRawConfig] = useState<RawServerConfig | null>(null);
  const [editedConfig, setEditedConfig] = useState<Record<string, PluginConfigItem>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ---------------- 数据获取 ----------------
  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfig(MCP_SERVER_CONFIG_ENCODED);
      setRawConfig(data);
      setEditedConfig(JSON.parse(JSON.stringify(data.config || {})));
    } catch (error) {
      console.error('Failed to fetch GsCore AI MCP Server config:', error);
      toast.error(t('gsCoreAiMcpServer.loadFailed'));
      setRawConfig(null);
      setEditedConfig({});
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ---------------- 派生 ----------------
  const isDirty = useMemo(() => {
    if (!rawConfig) return false;
    return JSON.stringify(editedConfig) !== JSON.stringify(rawConfig.config);
  }, [editedConfig, rawConfig]);

  // 状态卡 / 提示横幅使用 rawConfig（保存后的服务端真实状态），
  // 这样在勾选「启用 MCP Server」后未点击保存前，卡片依然显示「已停用」，
  // 点击保存、且服务端实际生效后才显示「已启用」。
  const savedEnableMcpServer = Boolean(
    (rawConfig?.config.enable_mcp_server?.value as boolean | undefined) ?? false,
  );
  const savedTransport = String(
    rawConfig?.config.mcp_server_transport?.value ?? 'sse',
  );
  const savedPort = Number(
    rawConfig?.config.mcp_server_port?.value ?? 8766,
  );
  const savedApiKey = String(
    rawConfig?.config.mcp_server_api_key?.value ?? '',
  );

  // ---------------- 事件 ----------------
  const handleFieldChange = useCallback(
    (_configId: string, fieldKey: string, value: ConfigValue) => {
      setEditedConfig(prev => {
        const item = prev[fieldKey];
        if (!item) return prev;
        return {
          ...prev,
          [fieldKey]: { ...item, value },
        };
      });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!rawConfig) return;
    try {
      setIsSaving(true);

      // 仅推送有变化的字段
      const payload: Record<string, unknown> = {};
      Object.entries(editedConfig).forEach(([key, item]) => {
        const original = rawConfig.config[key];
        if (!original) {
          payload[key] = item.value;
          return;
        }
        if (JSON.stringify(item.value) !== JSON.stringify(original.value)) {
          payload[key] = item.value;
        }
      });

      if (Object.keys(payload).length === 0) {
        toast.info(t('gsCoreAiMcpServer.noChanges'));
        return;
      }

      await frameworkConfigApi.updateFrameworkConfig(
        rawConfig.full_name || MCP_SERVER_CONFIG_FULL_NAME,
        payload,
      );

      setRawConfig(prev =>
        prev
          ? { ...prev, config: JSON.parse(JSON.stringify(editedConfig)) }
          : prev,
      );
      toast.success(t('gsCoreAiMcpServer.saveSuccess'));
    } catch (error) {
      console.error('Failed to save GsCore AI MCP Server config:', error);
      toast.error(t('gsCoreAiMcpServer.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [editedConfig, rawConfig, t]);

  // ---------------- 渲染 ----------------
  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Server className="w-5 h-5 text-muted-foreground" />
          {t('gsCoreAiMcpServer.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('gsCoreAiMcpServer.description')}
        </p>
      </div>

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          icon={<Activity className="w-5 h-5" />}
          label={t('gsCoreAiMcpServer.status.enable')}
          value={
            <Badge
              variant={savedEnableMcpServer ? 'default' : 'secondary'}
              className={cn(
                'text-sm',
                savedEnableMcpServer && 'bg-green-500/15 text-green-700 dark:text-green-400',
              )}
            >
              {savedEnableMcpServer
                ? t('gsCoreAiMcpServer.status.enabled')
                : t('gsCoreAiMcpServer.status.disabled')}
            </Badge>
          }
          glassClassName={isGlass ? 'glass-card' : ''}
        />
        <StatusCard
          icon={savedTransport === 'stdio' ? <Terminal className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
          label={t('gsCoreAiMcpServer.status.transport')}
          value={
            <span className="text-sm font-mono">
              {savedTransport === 'stdio' ? 'stdio' : `SSE :${savedPort}`}
            </span>
          }
          glassClassName={isGlass ? 'glass-card' : ''}
        />
        <StatusCard
          icon={<ShieldCheck className="w-5 h-5" />}
          label={t('gsCoreAiMcpServer.status.auth')}
          value={
            <Badge
              variant={savedApiKey ? 'default' : 'secondary'}
              className={cn(
                'text-sm',
                savedApiKey && 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
              )}
            >
              {savedApiKey
                ? t('gsCoreAiMcpServer.status.authEnabled')
                : t('gsCoreAiMcpServer.status.authDisabled')}
            </Badge>
          }
          glassClassName={isGlass ? 'glass-card' : ''}
        />
        <StatusCard
          icon={<Plug className="w-5 h-5" />}
          label={t('gsCoreAiMcpServer.status.endpoints')}
          value={
            <span className="text-sm font-mono break-all">
              {savedTransport === 'stdio'
                ? 'stdin / stdout'
                : `http(s)://<host>:${savedPort}/...`}
            </span>
          }
          glassClassName={isGlass ? 'glass-card' : ''}
        />
      </div>

      {/* 提示横幅：仅在服务端已实际启用时显示 */}
      {savedEnableMcpServer && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border p-4 text-sm',
            isGlass
              ? 'glass-card border-blue-500/30'
              : 'border-blue-500/40 bg-blue-500/5',
          )}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {t('gsCoreAiMcpServer.banner.activeTitle')}
            </p>
            <p className="text-muted-foreground">
              {t('gsCoreAiMcpServer.banner.activeDesc')}
            </p>
          </div>
        </div>
      )}

      {/* 配置面板 */}
      <Card className={cn(isGlass ? 'glass-card' : '')}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                {t('gsCoreAiMcpServer.configCard.title')}
              </CardTitle>
              <CardDescription>
                {t('gsCoreAiMcpServer.configCard.description')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConfig}
                disabled={isLoading || isSaving}
                className="gap-1"
              >
                <RefreshCw
                  className={cn('w-4 h-4', isLoading && 'animate-spin')}
                />
                {t('gsCoreAiMcpServer.actions.refresh')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!rawConfig || !isDirty || isSaving}
                className="gap-1"
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !rawConfig || Object.keys(editedConfig).length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Server className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>{t('gsCoreAiMcpServer.empty')}</p>
            </div>
          ) : (
            <DynamicConfigPanel
              config={editedConfig}
              configId={rawConfig.id}
              onChange={handleFieldChange}
            />
          )}
        </CardContent>
      </Card>

      {/* API Key 提示 */}
      <Card className={cn(isGlass ? 'glass-card' : '')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            {t('gsCoreAiMcpServer.apiKeyCard.title')}
          </CardTitle>
          <CardDescription>
            {t('gsCoreAiMcpServer.apiKeyCard.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted/60 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
{savedApiKey
  ? `Authorization: Bearer ${savedApiKey}`
  : t('gsCoreAiMcpServer.apiKeyCard.empty')}
          </pre>
        </CardContent>
      </Card>

      <Separator className="opacity-30" />
      <p className="text-xs text-muted-foreground">
        {t('gsCoreAiMcpServer.footnote')}
      </p>
    </div>
  );
}

// =====================================================================
// 小组件：状态卡片
// =====================================================================
interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  glassClassName?: string;
}

function StatusCard({ icon, label, value, glassClassName }: StatusCardProps) {
  return (
    <Card className={cn(glassClassName)}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-base font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}
