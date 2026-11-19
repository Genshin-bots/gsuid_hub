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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassAlert } from '@/components/ui/glass-alert';
import { DynamicConfigPanel } from '@/components/config';
import type { ConfigValue } from '@/components/config';
import { frameworkConfigApi, type PluginConfigItem } from '@/lib/api';
import {
  Server,
  Save,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Key,
  Plug,
  Globe,
  Terminal,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { pageGapClass, pageStackClass } from '@/components/layout/PinnedPage';
import { cn } from '@/lib/utils';
import { ConfigCard } from '../shared';

const MCP_SERVER_CONFIG_ENCODED = 'GsCore%20AI%20MCP%20Server%E9%85%8D%E7%BD%AE';
const MCP_SERVER_CONFIG_FULL_NAME = 'GsCore AI MCP Server配置';

interface RawServerConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

export interface GsCoreAiMcpServerSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function GsCoreAiMcpServerSection({ t }: GsCoreAiMcpServerSectionProps) {
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
  const savedTransport = String(rawConfig?.config.mcp_server_transport?.value ?? 'sse');
  const savedPort = Number(rawConfig?.config.mcp_server_port?.value ?? 8766);
  const savedApiKey = String(rawConfig?.config.mcp_server_api_key?.value ?? '');

  // ---------------- 事件 ----------------
  const handleFieldChange = useCallback(
    (_configId: string, fieldKey: string, value: ConfigValue) => {
      setEditedConfig((prev) => {
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

      setRawConfig((prev) =>
        prev ? { ...prev, config: JSON.parse(JSON.stringify(editedConfig)) } : prev,
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
    <div className={pageStackClass}>
      {/* 状态总览 */}
      <ConfigCard>
        <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-4 lg:divide-x lg:divide-border/40">
          <StatusTile
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
          />
          <StatusTile
            icon={
              savedTransport === 'stdio' ? (
                <Terminal className="w-5 h-5" />
              ) : (
                <Globe className="w-5 h-5" />
              )
            }
            label={t('gsCoreAiMcpServer.status.transport')}
            value={
              <span className="text-sm font-mono">
                {savedTransport === 'stdio' ? 'stdio' : `SSE :${savedPort}`}
              </span>
            }
          />
          <StatusTile
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
          />
          <StatusTile
            icon={<Plug className="w-5 h-5" />}
            label={t('gsCoreAiMcpServer.status.endpoints')}
            value={
              <span className="text-sm font-mono break-all">
                {savedTransport === 'stdio'
                  ? 'stdin / stdout'
                  : `http(s)://<host>:${savedPort}/...`}
              </span>
            }
          />
        </div>

        {/* 提示横幅：仅在服务端已实际启用时显示 */}
        {savedEnableMcpServer && (
          <GlassAlert tone="info" icon={AlertTriangle}>
            <p className="font-semibold">{t('gsCoreAiMcpServer.banner.activeTitle')}</p>
            <p className="mt-1 text-muted-foreground">{t('gsCoreAiMcpServer.banner.activeDesc')}</p>
          </GlassAlert>
        )}
      </ConfigCard>

      {/* 配置面板 + API Key：xl 双列（均非长面板） */}
      <div className={cn('grid items-start xl:grid-cols-2', pageGapClass)}>
        <ConfigCard
          icon={<Server className="w-5 h-5 text-primary" />}
          title={t('gsCoreAiMcpServer.configCard.title')}
          description={t('gsCoreAiMcpServer.configCard.description')}
          className="min-w-0"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConfig}
                disabled={isLoading || isSaving}
                className="gap-1"
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                {t('gsCoreAiMcpServer.actions.refresh')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!rawConfig || !isDirty || isSaving}
                className="button-solid gap-1"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {t('common.save')}
              </Button>
            </>
          }
        >
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
              columns={2}
            />
          )}
        </ConfigCard>

        {/* API Key 提示 */}
        <ConfigCard
          icon={<Key className="w-5 h-5 text-primary" />}
          title={t('gsCoreAiMcpServer.apiKeyCard.title')}
          description={t('gsCoreAiMcpServer.apiKeyCard.description')}
          className="min-w-0"
        >
          {savedApiKey ? (
            // 不加 overflow-x-auto：.layout-page-inner 下的全局规则会给它套
            // 工具栏阴影负 margin，把 muted 块拖出卡片内边距。
            <pre className="rounded-md bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap break-all">
              {`Authorization: Bearer ${savedApiKey}`}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('gsCoreAiMcpServer.apiKeyCard.empty')}
            </p>
          )}
        </ConfigCard>
      </div>

      <p className="text-xs text-muted-foreground">{t('gsCoreAiMcpServer.footnote')}</p>
    </div>
  );
}

// =====================================================================
// 小组件：状态条内的一格（分隔线列表，非嵌套面板）
// =====================================================================
interface StatusTileProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function StatusTile({ icon, label, value }: StatusTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-sm font-medium min-w-0">{value}</div>
    </div>
  );
}
