import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TruncatedText } from '@/components/ui/truncated-text';
import { Separator } from '@/components/ui/separator';
import {
  Server,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  X,
  HelpCircle,
  Download,
  FileJson,
  Search,
  Wrench,
  Settings2,
  Package,
  Globe,
  Terminal,
  Network,
  Tag,
  ArrowLeftRight,
  Braces,
  Key,
  Shield,
  Eye,
  EyeOff,
  Store,
  Sparkles,
} from 'lucide-react';
import { AutoBrandIcon } from '@/components/ui/mcp-icon-lookup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  mcpConfigApi,
  mcpMarketApi,
  MCPConfig,
  MCPTransport,
  MCPReloadResponse,
  MCPPreset,
  MCPToolFromServer,
  MCPToolDefinition,
  MCPBindCandidate,
  MCPBindingItem,
  getApiErrorMessage,
} from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { headerActionRowClass, PinnedPage } from '@/components/layout/PinnedPage';
import {
  McpBindSection,
  McpDiscoveringHint,
  McpEnvBindableControl,
  McpSwitchRow,
  McpToolSelectSection,
} from '@/components/mcp/McpToolControls';
import { defaultToolMeta, type ToolMeta } from '@/components/mcp/toolMeta';

// ============================================================================
// MCP Server -> Brand Icon (auto-resolver wrapper)
// ============================================================================

/**
 * MCP 预设 / 配置 共用的品牌图标组件（占位）。
 *
 * 当前实现永远渲染 lucide 的 `<Server />` 占位——`/mcp-config` 不再展示
 * 具体厂商的品牌图标，避免把整库的 brand icon 拉进 bundle。
 *
 * `hints` 仍保留以匹配调用方签名：`name`、`command`、`url` 都会传过去，
 * 但 `AutoBrandIcon` 内部已经把品牌匹配停用，所以这些字段没有渲染作用。
 *
 * 想恢复品牌图标 → `git revert` 一下 `src/components/ui/mcp-icon-lookup.tsx`
 * 即可（旧实现 + 自动匹配都还在 git log 里）。
 */
interface McpBrandIconProps {
  /** 服务器 / 预设名称（必传，主要匹配源） */
  name: string;
  /** stdio 命令（可选，用于匹配包名） */
  command?: string;
  /** 远程 URL（可选，用于匹配域名） */
  url?: string;
  className?: string;
}

function McpBrandIcon({ name, command, url, className }: McpBrandIconProps) {
  // /mcp-config 决定不再展示具体厂商 brand icon，统一由 AutoBrandIcon
  // 渲染 lucide 的 <Server /> 占位。这里只需要把提示文本透传过去即可。
  void name;
  void command;
  void url;
  return (
    <AutoBrandIcon
      hints={[name, command, url]}
      className={cn('inline-block shrink-0', className)}
    />
  );
}

// ============================================================================
// Types
// ============================================================================

interface EnvVar {
  key: string;
  value: string;
  /** 可按用户绑定（fail-closed 默认 true）：勾选=逐人凭据，取消=共享装机值 */
  bindable: boolean;
}

interface HeaderVar {
  key: string;
  value: string;
}

interface FormData {
  name: string;
  transport: MCPTransport;
  command: string;
  argsText: string;
  envVars: EnvVar[];
  url: string;
  headerVars: HeaderVar[];
  enabled: boolean;
  toolPermissions: Record<string, number>;
  bindHelp: string;
  bindUrl: string;
  bindAliasText: string;
  allowAutonomousPrivate: boolean;
}

// pm value type: 0-6, higher value = lower permission, 6 = all users (default)
const PERMISSION_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 0, labelKey: 'mcpConfig.roleMaster' },
  { value: 1, labelKey: 'mcpConfig.roleSuperuser' },
  { value: 2, labelKey: 'mcpConfig.roleGroupOwner' },
  { value: 3, labelKey: 'mcpConfig.roleGroupAdmin' },
  { value: 4, labelKey: 'mcpConfig.roleChannelAdmin' },
  { value: 5, labelKey: 'mcpConfig.roleSubChannelAdmin' },
  { value: 6, labelKey: 'mcpConfig.roleAll' },
];

type ConnectionMethod = 'manual' | 'preset';

// ============================================================================
// Helper Functions
// ============================================================================

function parseArgsText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function argsToText(args: string[]): string {
  return args.join('\n');
}

function envToVars(env: Record<string, string>, userEnvKeys?: string[]): EnvVar[] {
  return Object.entries(env).map(([key, value]) => ({
    key,
    value,
    bindable: userEnvKeys === undefined || userEnvKeys.includes(key),
  }));
}

function varsToEnv(vars: EnvVar[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const v of vars) {
    if (v.key.trim()) {
      env[v.key.trim()] = v.value;
    }
  }
  return env;
}

function headersToVars(headers: Record<string, string>): HeaderVar[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

function varsToHeaders(vars: HeaderVar[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const v of vars) {
    if (v.key.trim()) {
      headers[v.key.trim()] = v.value;
    }
  }
  return headers;
}

function normalizeMcpTransport(raw?: string, url?: string): MCPTransport {
  const t = (raw || '').trim().toLowerCase().replace(/-/g, '_');
  if (t === 'stdio' || t === 'sse' || t === 'streamable_http') return t;
  if (t === 'http' || t === 'streamablehttp') return 'streamable_http';
  if (url) {
    try {
      const pathname = new URL(url).pathname.replace(/\/+$/, '');
      if (pathname === '/sse' || pathname.endsWith('/sse')) return 'sse';
    } catch {
      const path = url.split('?')[0].replace(/\/+$/, '');
      if (path.endsWith('/sse')) return 'sse';
    }
    if (url.startsWith('http')) return 'streamable_http';
  }
  return 'stdio';
}

function isHttpMcpTransport(transport: MCPTransport): boolean {
  return transport === 'sse' || transport === 'streamable_http';
}

function transportMeta(transport: MCPTransport): {
  Icon: typeof Globe;
  labelKey:
    | 'mcpConfig.transportStdio'
    | 'mcpConfig.transportSse'
    | 'mcpConfig.transportStreamableHttp';
  short: string;
} {
  if (transport === 'streamable_http') {
    return { Icon: Network, labelKey: 'mcpConfig.transportStreamableHttp', short: 'HTTP' };
  }
  if (transport === 'sse') {
    return { Icon: Globe, labelKey: 'mcpConfig.transportSse', short: 'SSE' };
  }
  return { Icon: Terminal, labelKey: 'mcpConfig.transportStdio', short: 'stdio' };
}

function getEmptyFormData(): FormData {
  return {
    name: '',
    transport: 'stdio',
    command: '',
    argsText: '',
    envVars: [],
    url: '',
    headerVars: [],
    enabled: true,
    toolPermissions: {},
    bindHelp: '',
    bindUrl: '',
    bindAliasText: '',
    allowAutonomousPrivate: false,
  };
}

// ============================================================================
// Component
// ============================================================================

/** 有市场 logo 时用后端代理图；拉取失败回退品牌占位图标。 */
function McpServerIcon({ config, className }: { config: MCPConfig; className?: string }) {
  const [failed, setFailed] = useState(false);
  const logo = config.market_meta?.logo_url;
  if (logo && !failed) {
    return (
      <img
        src={mcpMarketApi.logoUrl(logo)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('object-contain', className)}
      />
    );
  }
  return (
    <McpBrandIcon
      name={config.name}
      command={config.command}
      url={config.url}
      className={className}
    />
  );
}

export default function MCPConfigPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isGlass = style !== 'solid';

  // State
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadResult, setReloadResult] = useState<MCPReloadResponse | null>(null);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MCPConfig | null>(null);
  const [formData, setFormData] = useState<FormData>(getEmptyFormData());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Connection method
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('manual');

  // Presets
  const [presets, setPresets] = useState<MCPPreset[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState<string>('');
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  // Tool discovery
  const [discoveredTools, setDiscoveredTools] = useState<MCPToolFromServer[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedToolNames, setSelectedToolNames] = useState<Set<string>>(new Set());
  // 载入时的工具描述基线（商店/已存配置），用于「发现工具」覆盖后的逐行还原
  const [originalToolDescs, setOriginalToolDescs] = useState<Record<string, string>>({});

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<MCPConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Expanded config details
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);

  // JSON import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Visibility toggles for env/header value inputs (key: `env-${index}` / `header-${index}`)
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Preset dialog
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetSearchText, setPresetSearchText] = useState('');

  // 生成/采纳介绍进行中的 config_id
  const [profileBusy, setProfileBusy] = useState<string | null>(null);

  // 工具安全分级（exposure/mutating/sensitive/credential_params）按工具名存
  const [toolMeta, setToolMeta] = useState<Record<string, ToolMeta>>({});
  // 工具权限折叠：null=按是否有规则自动判定
  const [permOpenOverride, setPermOpenOverride] = useState<boolean | null>(null);
  // public_ack 确认弹窗：首次 private→public 拨档前的强制确认
  const [publicAckOpen, setPublicAckOpen] = useState(false);
  const pendingSubmitRef = useRef<(() => Promise<void>) | null>(null);

  // 凭据绑定管理弹窗
  const [bindingsConfig, setBindingsConfig] = useState<MCPConfig | null>(null);
  const [bindings, setBindings] = useState<MCPBindingItem[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [bindCandidates, setBindCandidates] = useState<MCPBindCandidate[] | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [bindInstalling, setBindInstalling] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<MCPBindingItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await mcpConfigApi.getList();
      setConfigs(data.configs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadPresets = useCallback(async () => {
    try {
      setIsLoadingPresets(true);
      const data = await mcpConfigApi.getPresets();
      // Backend returns presets as an object (dict), convert to array
      const presetsArray = Object.values(data.presets);
      setPresets(presetsArray);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('mcpConfig.loadPresetsFailed'));
    } finally {
      setIsLoadingPresets(false);
    }
  }, [t]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // ============================================================================
  // Reload
  // ============================================================================

  const handleReload = async () => {
    try {
      setIsReloading(true);
      const result = await mcpConfigApi.reload();
      setReloadResult(result);
      toast.success(
        `${t('mcpConfig.oldToolCount')}: ${result.old_tool_count} → ${t('mcpConfig.newToolCount')}: ${result.new_tool_count}`,
      );
      await loadConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setIsReloading(false);
    }
  };

  // ============================================================================
  // Preset Selection
  // ============================================================================

  const handleOpenPresetDialog = () => {
    setPresetSearchText('');
    loadPresets();
    setPresetDialogOpen(true);
  };

  const filteredPresets = useMemo(() => {
    if (!presetSearchText.trim()) return presets;
    const keyword = presetSearchText.trim().toLowerCase();
    return presets.filter((preset) => {
      const name = (preset.name || '').toLowerCase();
      const desc = (preset.description || '').toLowerCase();
      const command = (preset.command || '').toLowerCase();
      const url = (preset.url || '').toLowerCase();
      const toolNames = (preset.default_tools || [])
        .map((t) => (t.name || '').toLowerCase())
        .join(' ');
      return (
        name.includes(keyword) ||
        desc.includes(keyword) ||
        command.includes(keyword) ||
        url.includes(keyword) ||
        toolNames.includes(keyword)
      );
    });
  }, [presets, presetSearchText]);

  const handleSelectPreset = (preset: MCPPreset) => {
    setConnectionMethod('preset');
    setSelectedPresetName(preset.name);
    const transport = normalizeMcpTransport(preset.transport, preset.url);
    setFormData({
      name: preset.name,
      transport,
      command: preset.command || '',
      argsText: argsToText(preset.args || []),
      envVars: envToVars(preset.env_template || preset.env || {}),
      url: preset.url || '',
      headerVars: headersToVars(preset.headers || {}),
      enabled: true,
      toolPermissions: {},
      bindHelp: '',
      bindUrl: '',
      bindAliasText: '',
      allowAutonomousPrivate: false,
    });
    // Pre-populate discovered tools from preset defaults
    const presetTools: MCPToolFromServer[] = (preset.default_tools || []).map((dt) => ({
      name: dt.name,
      description: dt.description,
    }));
    setDiscoveredTools(presetTools);
    setSelectedToolNames(new Set(presetTools.map((t) => t.name)));
    setToolMeta({});
    setOriginalToolDescs(
      Object.fromEntries(
        presetTools.filter((t) => t.description).map((t) => [t.name, t.description as string]),
      ),
    );
    setPresetDialogOpen(false);
    setFormDialogOpen(true);
  };

  // ============================================================================
  // Tool Discovery
  // ============================================================================

  const handleDiscoverTools = async () => {
    try {
      setIsDiscovering(true);
      setDiscoveredTools([]);
      setSelectedToolNames(new Set());

      let result;
      if (editingConfig) {
        // Discover from existing config
        result = await mcpConfigApi.discoverTools(editingConfig.config_id);
      } else {
        // Discover from temporary config
        const args = parseArgsText(formData.argsText);
        const env = varsToEnv(formData.envVars);
        const headers = varsToHeaders(formData.headerVars);
        result = await mcpConfigApi.discoverToolsFromConfig({
          name: formData.name.trim(),
          transport: formData.transport,
          command: formData.transport === 'stdio' ? formData.command.trim() : undefined,
          args: formData.transport === 'stdio' ? args : undefined,
          env: formData.transport === 'stdio' ? env : undefined,
          url: isHttpMcpTransport(formData.transport) ? formData.url.trim() : undefined,
          headers: isHttpMcpTransport(formData.transport) ? headers : undefined,
        });
      }

      setDiscoveredTools(result.tools);
      setSelectedToolNames(new Set(result.tools.map((t) => t.name)));
      if (result.count > 0) {
        toast.success(`${t('mcpConfig.toolsCount', { count: result.count })}`);
      } else {
        toast.warning(t('mcpConfig.discoverEmpty'));
      }
    } catch (error) {
      toast.error(
        error instanceof DOMException && error.name === 'TimeoutError'
          ? t('mcpConfig.discoverTimeout')
          : getApiErrorMessage(error, t('mcpConfig.discoverFailed')),
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleRestoreToolDesc = (toolName: string) => {
    const orig = originalToolDescs[toolName];
    if (!orig) return;
    setDiscoveredTools((prev) =>
      prev.map((dt) => (dt.name === toolName ? { ...dt, description: orig } : dt)),
    );
  };

  const handleToggleTool = (toolName: string) => {
    setSelectedToolNames((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  // ============================================================================
  // Create / Edit
  // ============================================================================

  const openCreateDialog = () => {
    setEditingConfig(null);
    setFormData(getEmptyFormData());
    setConnectionMethod('manual');
    setSelectedPresetName('');
    setDiscoveredTools([]);
    setSelectedToolNames(new Set());
    setToolMeta({});
    setOriginalToolDescs({});
    setFormDialogOpen(true);
  };

  const openEditDialog = (config: MCPConfig) => {
    setEditingConfig(config);
    const transport = normalizeMcpTransport(config.transport, config.url);
    setFormData({
      name: config.name,
      transport,
      command: config.command || '',
      argsText: argsToText(config.args || []),
      envVars: envToVars(config.env || {}, config.user_env_keys),
      url: config.url || '',
      headerVars: headersToVars(config.headers || {}),
      enabled: config.enabled,
      toolPermissions: config.tool_permissions || {},
      bindHelp: config.bind_help || '',
      bindUrl: config.bind_url || '',
      bindAliasText: (config.bind_alias || []).join(','),
      allowAutonomousPrivate: config.allow_autonomous_private ?? false,
    });
    setConnectionMethod('manual');
    setSelectedPresetName('');
    // Pre-populate tools from config (preserve parameters and input_schema)
    const existingTools = config.tools ?? [];
    const configTools: MCPToolFromServer[] = existingTools.map((t) => ({
      name: t.name,
      description: t.description,
      ...(t.parameters && { parameters: t.parameters }),
      ...(t.input_schema && { input_schema: t.input_schema }),
    }));
    setDiscoveredTools(configTools);
    setSelectedToolNames(new Set(existingTools.map((t) => t.name)));
    const meta: Record<string, ToolMeta> = {};
    for (const td of existingTools) {
      meta[td.name] = {
        exposure: td.exposure === 'public' ? 'public' : 'private',
        mutating: td.mutating ?? false,
        sensitiveArgs: td.sensitive_args ?? false,
        credParamsText: (td.credential_params ?? []).join(','),
      };
    }
    setToolMeta(meta);
    setOriginalToolDescs(
      Object.fromEntries(
        existingTools.filter((t) => t.description).map((t) => [t.name, t.description as string]),
      ),
    );
    setFormDialogOpen(true);
  };

  const doSubmit = async (publicAck: boolean) => {
    const args = parseArgsText(formData.argsText);
    const env = varsToEnv(formData.envVars);
    const headers = varsToHeaders(formData.headerVars);
    const userEnvKeys = formData.envVars
      .filter((v) => v.key.trim() && v.bindable)
      .map((v) => v.key.trim());

    // Build tools list from selected discovered tools
    // Include parameters and input_schema from discover response
    const tools: MCPToolDefinition[] = discoveredTools
      .filter((dt) => selectedToolNames.has(dt.name))
      .map((dt) => {
        const meta = toolMeta[dt.name] ?? defaultToolMeta(userEnvKeys.length > 0);
        return {
          name: dt.name,
          description: dt.description,
          ...(dt.parameters && { parameters: dt.parameters }),
          ...(dt.input_schema && { input_schema: dt.input_schema }),
          exposure: meta.exposure,
          mutating: meta.mutating,
          sensitive_args: meta.sensitiveArgs,
          credential_params: meta.credParamsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      });

    try {
      setIsSubmitting(true);
      const credBindFields = {
        user_env_keys: userEnvKeys,
        allow_autonomous_private: formData.allowAutonomousPrivate,
        bind_help: formData.bindHelp.trim(),
        bind_url: formData.bindUrl.trim(),
        bind_alias: formData.bindAliasText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (editingConfig) {
        await mcpConfigApi.update(editingConfig.config_id, {
          name: formData.name.trim(),
          transport: formData.transport,
          command: formData.transport === 'stdio' ? formData.command.trim() : '',
          args: formData.transport === 'stdio' ? args : [],
          env,
          url: isHttpMcpTransport(formData.transport) ? formData.url.trim() : '',
          headers: isHttpMcpTransport(formData.transport) ? headers : {},
          enabled: formData.enabled,
          register_as_ai_tools: true,
          tools,
          tool_permissions: formData.toolPermissions,
          ...credBindFields,
          ...(publicAck ? { public_ack: true } : {}),
        });
        toast.success(t('mcpConfig.updateSuccess'));
      } else {
        await mcpConfigApi.create({
          name: formData.name.trim(),
          transport: formData.transport,
          command: formData.transport === 'stdio' ? formData.command.trim() : '',
          args: formData.transport === 'stdio' ? args : [],
          env,
          url: isHttpMcpTransport(formData.transport) ? formData.url.trim() : '',
          headers: isHttpMcpTransport(formData.transport) ? headers : {},
          enabled: formData.enabled,
          register_as_ai_tools: true,
          tools,
          tool_permissions: formData.toolPermissions,
          ...credBindFields,
        });
        toast.success(t('mcpConfig.createSuccess'));
      }

      setFormDialogOpen(false);
      await loadConfigs();
      handleReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(t('mcpConfig.configName') + ' ' + t('common.required'));
      return;
    }

    // Validate based on transport type
    if (formData.transport === 'stdio' && !formData.command.trim()) {
      toast.error(t('mcpConfig.commandRequired'));
      return;
    }
    if (isHttpMcpTransport(formData.transport) && !formData.url.trim()) {
      toast.error(t('mcpConfig.urlRequired'));
      return;
    }

    // 首次 private→public 拨档强制确认（与后端 public_ack 校验一致）
    if (editingConfig && !editingConfig.public_ack) {
      const oldExposure = new Map(
        (editingConfig.tools ?? []).map((t) => [t.name, t.exposure ?? 'private']),
      );
      const goingPublic = discoveredTools.some(
        (dt) =>
          selectedToolNames.has(dt.name) &&
          toolMeta[dt.name]?.exposure === 'public' &&
          oldExposure.get(dt.name) !== 'public',
      );
      if (goingPublic) {
        pendingSubmitRef.current = () => doSubmit(true);
        setPublicAckOpen(true);
        return;
      }
    }
    await doSubmit(false);
  };

  // ============================================================================
  // Delete
  // ============================================================================

  const openDeleteDialog = (config: MCPConfig) => {
    setDeletingConfig(config);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;

    try {
      setIsDeleting(true);
      await mcpConfigApi.delete(deletingConfig.config_id);
      toast.success(t('mcpConfig.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
      await loadConfigs();
      // Auto reload after delete
      handleReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================================
  // Toggle
  // ============================================================================

  const handleToggle = async (config: MCPConfig) => {
    try {
      await mcpConfigApi.toggle(config.config_id);
      toast.success(t('mcpConfig.toggleSuccess'));
      await loadConfigs();
      // Auto reload after toggle
      handleReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    }
  };

  // ============================================================================
  // 生成 / 采纳中文介绍
  // ============================================================================

  const handleGenerateProfile = async (config: MCPConfig) => {
    try {
      setProfileBusy(config.config_id);
      await mcpConfigApi.generateProfile(config.config_id);
      toast.success(t('mcpConfig.generateProfileScheduled'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setProfileBusy(null);
    }
  };

  const handleAdoptProfile = async (config: MCPConfig) => {
    try {
      setProfileBusy(config.config_id);
      await mcpConfigApi.adoptProfile(config.config_id);
      toast.success(t('mcpConfig.adoptProfileSuccess'));
      await loadConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setProfileBusy(null);
    }
  };

  // ============================================================================
  // JSON Import
  // ============================================================================

  const handleOpenImportDialog = () => {
    setImportJsonText('');
    setImportDialogOpen(true);
  };

  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      toast.error(t('mcpConfig.invalidJsonFormat'));
      return;
    }

    // Validate JSON
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.mcpServers) {
        toast.error(t('mcpConfig.unsupportedJsonFormat'));
        return;
      }
    } catch {
      toast.error(t('mcpConfig.invalidJsonFormat'));
      return;
    }

    try {
      setIsImporting(true);
      const result = await mcpConfigApi.importConfig({ json_config: importJsonText });
      toast.success(`${result.name}: ${result.tool_names.join(', ')}`);
      setImportDialogOpen(false);
      setImportJsonText('');
      await loadConfigs();
      handleReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setIsImporting(false);
    }
  };

  // ============================================================================
  // Env Vars Management
  // ============================================================================

  const addEnvVar = () => {
    setFormData((prev) => ({
      ...prev,
      envVars: [...prev.envVars, { key: '', value: '', bindable: true }],
    }));
  };

  const toggleEnvBindable = (index: number, bindable: boolean) => {
    setFormData((prev) => ({
      ...prev,
      envVars: prev.envVars.map((v, i) => (i === index ? { ...v, bindable } : v)),
    }));
  };

  // ============================================================================
  // 凭据绑定管理
  // ============================================================================

  const openBindingsDialog = async (config: MCPConfig) => {
    setBindingsConfig(config);
    setBindings([]);
    setBindCandidates(null);
    setSelectedPairs(new Set());
    setBindingsLoading(true);
    try {
      const res = await mcpConfigApi.getBindings(config.config_id);
      setBindings(res.bindings ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpConfig.bindingsLoadFailed')));
    } finally {
      setBindingsLoading(false);
    }
  };

  const loadBindCandidates = async () => {
    try {
      const res = await mcpConfigApi.getBindCandidates();
      setBindCandidates(res.candidates ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpConfig.installBindFailed')));
    }
  };

  const togglePair = (key: string) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleInstallBinds = async () => {
    if (!bindingsConfig || selectedPairs.size === 0 || !bindCandidates) return;
    const pairs = bindCandidates
      .filter((c) => selectedPairs.has(`${c.bot_id}|${c.user_id}`))
      .map((c) => ({ bot_id: c.bot_id, user_id: c.user_id }));
    try {
      setBindInstalling(true);
      const res = await mcpConfigApi.adminBind(bindingsConfig.config_id, pairs);
      toast.success(t('mcpConfig.installBindSuccess', { count: res.bound_count }));
      const fresh = await mcpConfigApi.getBindings(bindingsConfig.config_id);
      setBindings(fresh.bindings ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpConfig.installBindFailed')));
    } finally {
      setBindInstalling(false);
    }
  };

  const handleRevoke = async () => {
    if (!bindingsConfig || !revokeTarget) return;
    try {
      setRevoking(true);
      await mcpConfigApi.revokeBinding(
        bindingsConfig.config_id,
        revokeTarget.bot_id,
        revokeTarget.user_id,
      );
      toast.success(t('mcpConfig.revokeSuccess'));
      setRevokeTarget(null);
      setBindings((prev) =>
        prev.filter(
          (b) => !(b.bot_id === revokeTarget.bot_id && b.user_id === revokeTarget.user_id),
        ),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpConfig.revokeFailed')));
    } finally {
      setRevoking(false);
    }
  };

  const removeEnvVar = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      envVars: prev.envVars.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  };

  // ============================================================================
  // Header Vars Management (SSE mode)
  // ============================================================================

  const addHeaderVar = () => {
    setFormData((prev) => ({
      ...prev,
      headerVars: [...prev.headerVars, { key: '', value: '' }],
    }));
  };

  const removeHeaderVar = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      headerVars: prev.headerVars.filter((_, i) => i !== index),
    }));
  };

  const updateHeaderVar = (index: number, field: 'key' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      headerVars: prev.headerVars.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    }));
  };

  // ============================================================================
  // Render
  // ============================================================================

  const permHasRules = Object.keys(formData.toolPermissions).length > 0;
  const permSectionOpen = permOpenOverride ?? permHasRules;

  return (
    <TooltipProvider>
      <PinnedPage
        className="gap-3 sm:gap-3 md:gap-6"
        bodyClassName="space-y-3 sm:space-y-3 md:space-y-6"
        header={
          /* Header */
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                <Server width={32} height={32} className="text-foreground" />
                {t('mcpConfig.title')}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {t('mcpConfig.description')}
              </p>
            </div>
            <div className={headerActionRowClass}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className={tabToolbarControlClass}
                    onClick={handleReload}
                    disabled={isReloading}
                  >
                    {isReloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1">{t('mcpConfig.reload')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {t('mcpConfig.reload')} - {t('mcpConfig.description')}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                className={tabToolbarControlClass}
                onClick={() => navigate('/mcp-market')}
              >
                <Store className="h-4 w-4 mr-1" />
                {t('mcpConfig.market')}
              </Button>
              <Button
                variant="outline"
                className={tabToolbarControlClass}
                onClick={handleOpenImportDialog}
              >
                <FileJson className="h-4 w-4 mr-1" />
                {t('mcpConfig.importJson')}
              </Button>
              <Button className={tabToolbarControlClass} onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1" />
                {t('mcpConfig.addConfig')}
              </Button>
            </div>
          </div>
        }
      >
        {/* Reload Result */}
        {reloadResult && (
          <Card className="glass-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('mcpConfig.reloadSuccess')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('mcpConfig.oldToolCount')}: {reloadResult.old_tool_count} →{' '}
                    {t('mcpConfig.newToolCount')}: {reloadResult.new_tool_count} |{' '}
                    {t('mcpConfig.configCount', { count: reloadResult.config_count })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setReloadResult(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Config List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : configs.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Server className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('mcpConfig.noConfigs')}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t('mcpConfig.noConfigsDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {configs.map((config) => {
              const itemTransport = normalizeMcpTransport(config.transport, config.url);
              const itemHttp = isHttpMcpTransport(itemTransport);
              const itemTools = config.tools ?? [];
              const itemArgs = config.args ?? [];
              const itemEnv = config.env ?? {};
              const itemMeta = transportMeta(itemTransport);
              return (
                <Card
                  key={config.config_id}
                  className={cn(
                    'transition-all duration-300 hover:shadow-md glass-card',
                    !config.enabled && 'opacity-60',
                  )}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-3 md:gap-4">
                      {/* Expand/Collapse */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 mt-0.5 sm:mt-0"
                        onClick={() =>
                          setExpandedConfigId(
                            expandedConfigId === config.config_id ? null : config.config_id,
                          )
                        }
                      >
                        {expandedConfigId === config.config_id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Icon - hidden on mobile, shown on sm+；无底盒，图标直接占满 */}
                      <McpServerIcon
                        config={config}
                        className={cn(
                          'hidden sm:block w-8 h-8 shrink-0 transition-colors duration-300',
                          config.enabled ? 'text-primary' : 'text-muted-foreground',
                        )}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:flex-nowrap sm:items-center sm:gap-2">
                          <p className="min-w-0 max-w-full truncate font-medium text-sm">
                            {config.name}
                          </p>
                          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:contents">
                            <Badge variant="outline" className="text-xs shrink-0">
                              <itemMeta.Icon className="h-3 w-3 mr-1" />
                              {itemMeta.short}
                            </Badge>
                            <Badge
                              variant={config.enabled ? 'default' : 'secondary'}
                              className="text-xs shrink-0"
                            >
                              {config.enabled ? t('mcpConfig.enabled') : t('mcpConfig.disabled')}
                            </Badge>
                            {config.register_as_ai_tools && (
                              <Badge
                                variant="outline"
                                className="text-xs shrink-0 bg-blue-500/10 text-blue-600 border-blue-200"
                              >
                                AI Tools
                              </Badge>
                            )}
                            {config.market_meta?.qualified_name && (
                              <Badge
                                variant="outline"
                                className="text-xs shrink-0 bg-amber-500/10 text-amber-600 border-amber-200"
                              >
                                <Store className="h-3 w-3 mr-1" />
                                {config.market_meta.chinese_name || t('mcpConfig.market')}
                              </Badge>
                            )}
                            {itemTools.length > 0 && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                <Wrench className="h-3 w-3 mr-1" />
                                {t('mcpConfig.toolsCount', { count: itemTools.length })}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {itemHttp ? (
                          <Badge variant="outline" className="mt-0.5 max-w-full font-normal">
                            <Globe className="h-3 w-3 mr-1 shrink-0" />
                            <TruncatedText
                              text={config.url ?? ''}
                              className="font-mono text-[10px]"
                            />
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-0.5 max-w-full font-normal">
                            <TruncatedText
                              text={
                                itemArgs.length > 0 ? itemArgs.join(' ') : (config.command ?? '')
                              }
                              className="font-mono text-[10px]"
                            />
                          </Badge>
                        )}
                      </div>

                      {/* 操作区：行右端。窄屏 items-start 时与折叠钮同排对齐，sm+ 行内垂直居中 */}
                      <div className="mt-0.5 flex shrink-0 items-center gap-1 sm:mt-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch
                                checked={config.enabled}
                                onCheckedChange={() => handleToggle(config)}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.toggleEnabled')}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openBindingsDialog(config)}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.bindings')}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(config)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.editConfig')}</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(config)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.deleteConfig')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedConfigId === config.config_id && (
                      <div className="mt-4 ml-4 sm:ml-12 p-3 sm:p-4 rounded-xl border bg-muted/30 border-border/40 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              {t('mcpConfig.configId')}
                            </p>
                            <p className="text-sm">
                              <code className="bg-muted px-1.5 py-0.5 rounded">
                                {config.config_id}
                              </code>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              {t('mcpConfig.transport')}
                            </p>
                            <p className="text-sm">
                              <Badge variant="outline" className="text-xs">
                                <itemMeta.Icon className="h-3 w-3 mr-1" />
                                {t(itemMeta.labelKey)}
                              </Badge>
                            </p>
                          </div>
                        </div>

                        {/* stdio mode details */}
                        {!itemHttp && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  {t('mcpConfig.command')}
                                </p>
                                <p className="text-sm">
                                  <code className="bg-muted px-1.5 py-0.5 rounded">
                                    {config.command}
                                  </code>
                                </p>
                              </div>
                            </div>
                            {config.runtime_check && (
                              <div
                                className={cn(
                                  'flex items-start gap-2 rounded-lg border p-3 text-xs',
                                  config.runtime_check.available
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                    : 'border-destructive/30 bg-destructive/10 text-destructive',
                                )}
                              >
                                {config.runtime_check.available ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                ) : (
                                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {config.runtime_check.available
                                      ? t('mcpConfig.runtimeOk', {
                                          command: config.runtime_check.command,
                                        })
                                      : t('mcpConfig.runtimeMissing', {
                                          command:
                                            config.runtime_check.command ||
                                            config.command ||
                                            'stdio',
                                        })}
                                  </p>
                                  {config.runtime_check.available &&
                                    config.runtime_check.resolved && (
                                      <p
                                        className="mt-0.5 truncate font-mono opacity-80"
                                        title={config.runtime_check.resolved}
                                      >
                                        {config.runtime_check.resolved}
                                      </p>
                                    )}
                                  {!config.runtime_check.available && (
                                    <p className="mt-1 opacity-90">{t('mcpConfig.runtimeFix')}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            {itemArgs.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  {t('mcpConfig.args')}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {itemArgs.map((arg, i) => (
                                    <Badge key={i} variant="outline" className="text-xs font-mono">
                                      {arg}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Object.keys(itemEnv).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  {t('mcpConfig.env')}
                                </p>
                                <div className="space-y-1">
                                  {Object.entries(itemEnv).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2 text-xs">
                                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                        {key}
                                      </code>
                                      <span className="text-muted-foreground">=</span>
                                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                        ***
                                      </code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* remote HTTP details */}
                        {itemHttp && (
                          <>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                {t('mcpConfig.url')}
                              </p>
                              <p className="text-sm break-all">
                                <code className="bg-muted px-1.5 py-0.5 rounded">{config.url}</code>
                              </p>
                            </div>
                            {config.headers && Object.keys(config.headers).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                  {t('mcpConfig.headers')}
                                </p>
                                <div className="space-y-1">
                                  {Object.entries(config.headers).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2 text-xs">
                                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                        {key}
                                      </code>
                                      <span className="text-muted-foreground">:</span>
                                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                        ***
                                      </code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Register as AI Tools */}
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {t('mcpConfig.registerAsAiTools')}:
                          </p>
                          <Badge
                            variant={config.register_as_ai_tools ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {config.register_as_ai_tools ? t('common.yes') : t('common.no')}
                          </Badge>
                        </div>

                        {/* 用户描述 / AI 生成介绍 */}
                        {config.description && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                              {t('mcpConfig.descriptionLabel')}
                            </p>
                            <p className="text-sm">{config.description}</p>
                          </div>
                        )}
                        {config.generated_profile && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                              <p className="text-xs font-semibold">
                                {t('mcpConfig.generatedProfile')}
                              </p>
                              {config.generated_profile.model && (
                                <Badge variant="outline" className="text-[10px]">
                                  {config.generated_profile.model}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{config.generated_profile.description}</p>
                            {config.generated_profile.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {config.generated_profile.keywords.map((kw) => (
                                  <Badge key={kw} variant="secondary" className="text-[10px]">
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={profileBusy === config.config_id}
                                onClick={() => handleAdoptProfile(config)}
                              >
                                {profileBusy === config.config_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                ) : null}
                                {t('mcpConfig.adoptProfile')}
                              </Button>
                            </div>
                          </div>
                        )}
                        {config.register_as_ai_tools && (
                          <div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              disabled={profileBusy === config.config_id}
                              onClick={() => handleGenerateProfile(config)}
                            >
                              {profileBusy === config.config_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 mr-1" />
                              )}
                              {config.generated_profile
                                ? t('mcpConfig.regenerateProfile')
                                : t('mcpConfig.generateProfile')}
                            </Button>
                          </div>
                        )}

                        {/* Tools List */}
                        {itemTools.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              {t('mcpConfig.tools')}
                            </p>
                            <div className="space-y-2">
                              {itemTools.map((tool, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 p-2 rounded-lg bg-background/50 border border-border/30"
                                >
                                  <Wrench className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{tool.name}</p>
                                    {tool.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {tool.description}
                                      </p>
                                    )}
                                    {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {Object.entries(tool.parameters).map(
                                          ([paramName, paramDef]) => (
                                            <Badge
                                              key={paramName}
                                              variant="outline"
                                              className="text-[10px] font-mono"
                                            >
                                              {paramName}
                                              {paramDef.required && (
                                                <span className="text-destructive ml-0.5">*</span>
                                              )}
                                            </Badge>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[560px] lg:max-w-[1180px] max-h-[85vh] flex flex-col overflow-hidden p-0 glass-card">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                {(() => {
                  // 编辑现有配置：用 editingConfig；新建且选了预设：用 formData；
                  // 新建且未填名：兜底到 MCP 官方 logo。
                  const headerName = editingConfig?.name ?? formData.name;
                  const headerCommand = editingConfig?.command ?? formData.command;
                  const headerUrl = editingConfig?.url ?? formData.url;
                  if (!headerName?.trim()) {
                    return <McpBrandIcon name="mcp" className="w-5 h-5" />;
                  }
                  return (
                    <McpBrandIcon
                      name={headerName}
                      command={headerCommand}
                      url={headerUrl}
                      className="w-5 h-5"
                    />
                  );
                })()}
                {editingConfig ? t('mcpConfig.editConfig') : t('mcpConfig.addConfig')}
              </DialogTitle>
              <DialogDescription>
                {editingConfig
                  ? `${t('mcpConfig.editConfig')} - ${editingConfig.name}`
                  : t('mcpConfig.description')}
              </DialogDescription>
            </DialogHeader>

            {/* 双栏独立滚动：移动端单列长滚，sm+ 左右各自滚动 */}
            <div className="flex-1 min-h-0 px-6 py-2 overflow-y-auto lg:overflow-visible lg:flex lg:gap-5">
              {/* 左栏：连接与凭据 */}
              <div className="space-y-3 md:space-y-4 lg:w-1/2 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                {/* Connection Method (only for create) */}
                {!editingConfig && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                      {t('mcpConfig.connectionMethod')}
                    </Label>
                    <ToggleGroup
                      type="single"
                      value={connectionMethod}
                      onValueChange={(v) => {
                        if (v) setConnectionMethod(v as ConnectionMethod);
                      }}
                      variant="outline"
                      className="justify-start"
                    >
                      <ToggleGroupItem value="manual" className="flex items-center gap-1.5 px-4">
                        <Pencil className="h-3.5 w-3.5" />
                        {t('mcpConfig.manualFill')}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="preset" className="flex items-center gap-1.5 px-4">
                        <Package className="h-3.5 w-3.5" />
                        {t('mcpConfig.selectPreset')}
                      </ToggleGroupItem>
                    </ToggleGroup>

                    {connectionMethod === 'preset' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenPresetDialog}
                        className="w-full"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        {selectedPresetName
                          ? `${t('mcpConfig.selectPreset')}: ${selectedPresetName}`
                          : t('mcpConfig.selectPresetPlaceholder')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Name */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="mcp-name">{t('mcpConfig.configName')} *</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('mcpConfig.nameHelp')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="mcp-name"
                    placeholder={t('mcpConfig.configNamePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* Transport Type */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label>{t('mcpConfig.transport')}</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('mcpConfig.transportHelp')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={formData.transport}
                    onValueChange={(v) => {
                      if (v) setFormData((prev) => ({ ...prev, transport: v as MCPTransport }));
                    }}
                    variant="outline"
                    className="justify-start flex-wrap"
                  >
                    <ToggleGroupItem value="stdio" className="flex items-center gap-1.5 px-3">
                      <Terminal className="h-3.5 w-3.5" />
                      {t('mcpConfig.transportStdio')}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="streamable_http"
                      className="flex items-center gap-1.5 px-3"
                    >
                      <Network className="h-3.5 w-3.5" />
                      {t('mcpConfig.transportStreamableHttp')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="sse" className="flex items-center gap-1.5 px-3">
                      <Globe className="h-3.5 w-3.5" />
                      {t('mcpConfig.transportSse')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* stdio mode fields */}
                {formData.transport === 'stdio' && (
                  <>
                    {/* Command */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="mcp-command">{t('mcpConfig.command')} *</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.commandHelp')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="mcp-command"
                        placeholder={t('mcpConfig.commandPlaceholder')}
                        value={formData.command}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, command: e.target.value }))
                        }
                      />
                    </div>

                    {/* Args */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Braces className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="mcp-args">{t('mcpConfig.args')}</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.argsHelp')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Textarea
                        id="mcp-args"
                        placeholder={t('mcpConfig.argsPlaceholder')}
                        value={formData.argsText}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, argsText: e.target.value }))
                        }
                        rows={3}
                        className="font-mono text-sm"
                      />
                      {!formData.argsText.trim() && (
                        <p className="text-xs text-muted-foreground/60 italic">
                          {t('mcpConfig.noArgs')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* remote HTTP fields (sse / streamable_http) */}
                {isHttpMcpTransport(formData.transport) && (
                  <>
                    {/* URL */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="mcp-url">{t('mcpConfig.url')} *</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.urlHelp')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="mcp-url"
                        placeholder={t('mcpConfig.urlPlaceholder')}
                        value={formData.url}
                        onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* HTTP Headers */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label>{t('mcpConfig.headers')}</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('mcpConfig.headersHelp')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addHeaderVar}
                          className="h-7 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t('mcpConfig.addHeader')}
                        </Button>
                      </div>
                      {formData.headerVars.length > 0 ? (
                        <div className="space-y-2">
                          {formData.headerVars.map((headerVar, index) => (
                            <div
                              key={index}
                              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                            >
                              <Input
                                placeholder={t('mcpConfig.headersKeyPlaceholder')}
                                value={headerVar.key}
                                onChange={(e) => updateHeaderVar(index, 'key', e.target.value)}
                                className="flex-1 font-mono text-sm"
                              />
                              <span className="text-muted-foreground hidden sm:inline">:</span>
                              <div className="relative flex-1">
                                <Input
                                  placeholder={t('mcpConfig.headersValuePlaceholder')}
                                  value={headerVar.value}
                                  onChange={(e) => updateHeaderVar(index, 'value', e.target.value)}
                                  className="flex-1 font-mono text-sm pr-9"
                                  type={visibleSecrets.has(`header-${index}`) ? 'text' : 'password'}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-full w-9 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                  onClick={() => toggleSecretVisibility(`header-${index}`)}
                                  aria-label={
                                    visibleSecrets.has(`header-${index}`)
                                      ? t('common.hide')
                                      : t('common.show')
                                  }
                                  title={
                                    visibleSecrets.has(`header-${index}`)
                                      ? t('common.hide')
                                      : t('common.show')
                                  }
                                >
                                  {visibleSecrets.has(`header-${index}`) ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive self-start sm:self-auto"
                                onClick={() => removeHeaderVar(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 italic">
                          {t('mcpConfig.noHeaders')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Environment Variables（stdio 必填；http 服务有凭据 env 时也显示） */}
                {(formData.transport === 'stdio' || formData.envVars.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label>{t('mcpConfig.env')}</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('mcpConfig.envHelp')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addEnvVar}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('mcpConfig.addEnvVar')}
                      </Button>
                    </div>
                    {formData.envVars.length > 0 ? (
                      <div className="space-y-2">
                        {formData.envVars.map((envVar, index) => (
                          <div
                            key={index}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                          >
                            <Input
                              placeholder={t('mcpConfig.envKeyPlaceholder')}
                              value={envVar.key}
                              onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                              className="flex-1 font-mono text-sm"
                            />
                            <span className="text-muted-foreground hidden sm:inline">=</span>
                            <div className="relative flex-1">
                              <Input
                                placeholder={t('mcpConfig.envValuePlaceholder')}
                                value={envVar.value}
                                onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                                className="flex-1 font-mono text-sm pr-9"
                                type={visibleSecrets.has(`env-${index}`) ? 'text' : 'password'}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full w-9 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                onClick={() => toggleSecretVisibility(`env-${index}`)}
                                aria-label={
                                  visibleSecrets.has(`env-${index}`)
                                    ? t('common.hide')
                                    : t('common.show')
                                }
                                title={
                                  visibleSecrets.has(`env-${index}`)
                                    ? t('common.hide')
                                    : t('common.show')
                                }
                              >
                                {visibleSecrets.has(`env-${index}`) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <McpEnvBindableControl
                              envKey={envVar.key}
                              checked={envVar.bindable}
                              onCheckedChange={(c) => toggleEnvBindable(index, c)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive self-start sm:self-auto"
                              onClick={() => removeEnvVar(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">
                        {t('mcpConfig.noEnvVars')}
                      </p>
                    )}
                  </div>
                )}
                {/* 凭据绑定（无凭据时折叠展示，别名字段与 env 无关） */}
                <div>
                  <McpBindSection
                    bindHelp={formData.bindHelp}
                    bindUrl={formData.bindUrl}
                    bindAliasText={formData.bindAliasText}
                    onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                  />
                </div>

                {/* Tool Permissions */}
                <Collapsible open={permSectionOpen} onOpenChange={setPermOpenOverride}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 py-1 text-left"
                    >
                      <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 flex items-center gap-1.5 text-sm font-medium">
                        {t('mcpConfig.toolPermissions')}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span onClick={(e) => e.stopPropagation()}>
                              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground cursor-help" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{t('mcpConfig.toolPermissionsHelp')}</p>
                          </TooltipContent>
                        </Tooltip>
                        {!permHasRules && (
                          <span className="text-xs font-normal text-muted-foreground">
                            {t('mcpConfig.bindSectionOptional')}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                          permSectionOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          // Add default permission (pm=6, all users) for each selected tool
                          const newPerms = { ...formData.toolPermissions };
                          selectedToolNames.forEach((toolName) => {
                            if (newPerms[toolName] === undefined) {
                              newPerms[toolName] = 6;
                            }
                          });
                          setFormData((prev) => ({ ...prev, toolPermissions: newPerms }));
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('mcpConfig.addPermissionRule')}
                      </Button>
                    </div>

                    {Object.keys(formData.toolPermissions).length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        <p>{t('mcpConfig.noPermissionRules')}</p>
                        <p className="text-xs">{t('mcpConfig.noPermissionRulesDesc')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {Array.from(selectedToolNames).map((toolName) => {
                          const currentPm = formData.toolPermissions[toolName] ?? 6;
                          return (
                            <div
                              key={toolName}
                              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-muted/30 rounded"
                            >
                              <span className="text-sm font-mono flex-1 truncate">{toolName}</span>
                              <Select
                                value={String(currentPm)}
                                onValueChange={(value) => {
                                  const newPerms = { ...formData.toolPermissions };
                                  newPerms[toolName] = Number(value);
                                  setFormData((prev) => ({ ...prev, toolPermissions: newPerms }));
                                }}
                              >
                                <SelectTrigger className="w-full sm:w-[180px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PERMISSION_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={String(opt.value)}>
                                      {t(opt.labelKey)} (pm={opt.value})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        const newPerms = { ...formData.toolPermissions };
                                        delete newPerms[toolName];
                                        setFormData((prev) => ({
                                          ...prev,
                                          toolPermissions: newPerms,
                                        }));
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t('mcpConfig.removePermissionRule')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* 右栏：工具与权限 */}
              <div className="mt-3 space-y-3 lg:mt-0 lg:w-1/2 lg:min-h-0 lg:overflow-y-auto lg:px-1 md:space-y-4">
                {/* Discover Tools Button */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={handleDiscoverTools}
                    disabled={
                      isDiscovering ||
                      !formData.name.trim() ||
                      (formData.transport === 'stdio' && !formData.command.trim()) ||
                      (isHttpMcpTransport(formData.transport) && !formData.url.trim())
                    }
                    className="w-full"
                  >
                    {isDiscovering ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    {isDiscovering ? t('mcpConfig.discoveringTools') : t('mcpConfig.discoverTools')}
                  </Button>
                  <McpDiscoveringHint active={isDiscovering} />

                  {/* Enabled + 无人任务私有凭据 */}
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                    <McpSwitchRow
                      checked={formData.enabled}
                      onCheckedChange={(c) => setFormData((prev) => ({ ...prev, enabled: c }))}
                      label={t('mcpConfig.enabled')}
                      description={t('mcpConfig.enabledHelp')}
                    />
                    <McpSwitchRow
                      checked={formData.allowAutonomousPrivate}
                      onCheckedChange={(c) =>
                        setFormData((prev) => ({ ...prev, allowAutonomousPrivate: c }))
                      }
                      label={t('mcpConfig.allowAutonomousPrivateShort')}
                      description={t('mcpConfig.allowAutonomousPrivateHelp')}
                    />
                  </div>

                  {/* Discovered Tools */}
                  {discoveredTools.length > 0 && (
                    <McpToolSelectSection
                      tools={discoveredTools.map((tool) => ({
                        name: tool.name,
                        description: tool.description,
                      }))}
                      selected={selectedToolNames}
                      onToggle={handleToggleTool}
                      toolMeta={toolMeta}
                      onMetaChange={(name, meta) =>
                        setToolMeta((prev) => ({ ...prev, [name]: meta }))
                      }
                      fallbackMeta={defaultToolMeta(formData.envVars.some((v) => v.bindable))}
                      originalDescriptions={originalToolDescs}
                      onRestoreDescription={handleRestoreToolDesc}
                    />
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t">
              <Button variant="outline" onClick={() => setFormDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || (!editingConfig && discoveredTools.length === 0)}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {editingConfig ? t('common.save') : t('common.confirm')}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!editingConfig && discoveredTools.length === 0 && (
                  <TooltipContent>
                    <p>{t('mcpConfig.discoverBeforeSubmit')}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="w-[95vw] max-w-lg glass-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t('mcpConfig.confirmDeleteTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('mcpConfig.confirmDelete', { name: deletingConfig?.name || '' })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* JSON Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden p-0 glass-card">
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                {t('mcpConfig.importJson')}
              </DialogTitle>
              <DialogDescription>{t('mcpConfig.importJsonPlaceholder')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 md:space-y-4 py-2 px-6 flex-1 min-h-0 overflow-y-auto">
              <Textarea
                placeholder={`{
  "mcpServers": {
    "MiniMax": {
      "command": "uvx",
      "args": ["minimax-coding-plan-mcp"],
      "env": {
        "MINIMAX_API_KEY": "your_key"
      }
    },
    "ExampleHTTP": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer your_access_secret"
      }
    }
  }
}`}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleImportJson} disabled={isImporting}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {t('mcpConfig.importConfig')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preset Selection Dialog */}
        <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[560px] max-h-[70vh] flex flex-col overflow-hidden glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                {t('mcpConfig.presetList')}
              </DialogTitle>
              <DialogDescription>{t('mcpConfig.selectPresetPlaceholder')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 flex-1 min-h-0 flex flex-col">
              {/* Search Input */}
              {!isLoadingPresets && presets.length > 0 && (
                <div className="relative shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('mcpConfig.presetSearchPlaceholder')}
                    value={presetSearchText}
                    onChange={(e) => setPresetSearchText(e.target.value)}
                    className="pl-8"
                  />
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {isLoadingPresets ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : presets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">{t('mcpConfig.noConfigs')}</p>
                  </div>
                ) : filteredPresets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('mcpConfig.noPresetSearchResult')}
                    </p>
                  </div>
                ) : (
                  filteredPresets.map((preset, i) => {
                    const presetTransport = normalizeMcpTransport(preset.transport, preset.url);
                    const presetMeta = transportMeta(presetTransport);
                    return (
                      <div
                        key={i}
                        className="p-4 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectPreset(preset)}
                      >
                        <div className="flex items-start gap-3">
                          {/* 预设品牌图标（按 name / command / url 智能识别） */}
                          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary/10 items-center justify-center flex-shrink-0 text-primary">
                            <McpBrandIcon
                              name={preset.name}
                              command={preset.command}
                              url={preset.url}
                              className="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm">{preset.name}</p>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                <presetMeta.Icon className="h-2.5 w-2.5 mr-0.5" />
                                {presetMeta.short}
                              </Badge>
                            </div>
                            {preset.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {preset.description}
                              </p>
                            )}
                            {presetTransport === 'stdio' && preset.command && (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {preset.command}
                                </code>
                                {(preset.args || []).map((arg, j) => (
                                  <code
                                    key={j}
                                    className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"
                                  >
                                    {arg}
                                  </code>
                                ))}
                              </div>
                            )}
                            {isHttpMcpTransport(presetTransport) && preset.url && (
                              <div className="mt-2">
                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono break-all">
                                  {preset.url}
                                </code>
                              </div>
                            )}
                            {(preset.default_tools || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {preset.default_tools!.map((tool, j) => (
                                  <Badge key={j} variant="outline" className="text-[10px]">
                                    <Wrench className="h-2.5 w-2.5 mr-0.5" />
                                    {tool.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 凭据绑定管理弹窗 */}
        <Dialog
          open={bindingsConfig !== null}
          onOpenChange={(open) => !open && setBindingsConfig(null)}
        >
          <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t('mcpConfig.bindingsTitle', { name: bindingsConfig?.name ?? '' })}
              </DialogTitle>
              <DialogDescription>{t('mcpConfig.bindingsHint')}</DialogDescription>
            </DialogHeader>

            {bindingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bindings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('mcpConfig.bindingsEmpty')}
              </p>
            ) : (
              <div className="space-y-2">
                {bindings.map((b) => (
                  <div
                    key={`${b.bot_id}|${b.user_id}`}
                    className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium">
                        {b.user_id}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          @{b.bot_id}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className="whitespace-normal max-w-full text-[10px]"
                        >
                          {b.bound_via === 'admin_install'
                            ? t('mcpConfig.viaAdmin')
                            : t('mcpConfig.viaChat')}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="whitespace-normal max-w-full text-[10px]"
                        >
                          {b.status}
                        </Badge>
                        <span>
                          {b.bound_at ? new Date(b.bound_at * 1000).toLocaleDateString() : '-'}
                        </span>
                      </div>
                      {Object.keys(b.masked_creds || {}).length > 0 && (
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {Object.entries(b.masked_creds)
                            .map(([k, v]) => `${k}=${v}`)
                            .join('  ')}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setRevokeTarget(b)}
                    >
                      {t('mcpConfig.revoke')}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* 为主人安装绑定 */}
            <div className="mt-2 rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('mcpConfig.bindToMasters')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('mcpConfig.bindToMastersDesc')}
                  </p>
                </div>
                {bindCandidates === null && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={loadBindCandidates}
                  >
                    {t('mcpConfig.bindToMasters')}
                  </Button>
                )}
              </div>
              {bindCandidates !== null &&
                (bindCandidates.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t('mcpConfig.candidatesEmpty')}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {bindCandidates.map((c) => {
                      const key = `${c.bot_id}|${c.user_id}`;
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border/40 px-2.5 py-2 text-sm hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={selectedPairs.has(key)}
                            onCheckedChange={() => togglePair(key)}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {c.user_name || c.user_id}
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {c.user_id}@{c.bot_id}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    <Button
                      size="sm"
                      className="mt-1"
                      disabled={selectedPairs.size === 0 || bindInstalling}
                      onClick={handleInstallBinds}
                    >
                      {bindInstalling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('mcpConfig.installBind', { count: selectedPairs.size })}
                    </Button>
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* 吊销确认 */}
        <AlertDialog
          open={revokeTarget !== null}
          onOpenChange={(open) => !open && setRevokeTarget(null)}
        >
          <AlertDialogContent className="w-[95vw] max-w-lg glass-card">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('mcpConfig.revokeConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('mcpConfig.revokeConfirmDesc', {
                  bot: revokeTarget?.bot_id ?? '',
                  user: revokeTarget?.user_id ?? '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('mcpConfig.revokeConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 首次 private→public 风险确认 */}
        <AlertDialog open={publicAckOpen} onOpenChange={setPublicAckOpen}>
          <AlertDialogContent className="w-[95vw] max-w-lg glass-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t('mcpConfig.publicAckTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>{t('mcpConfig.publicAckDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => (pendingSubmitRef.current = null)}>
                {t('mcpConfig.publicAckCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const fn = pendingSubmitRef.current;
                  pendingSubmitRef.current = null;
                  setPublicAckOpen(false);
                  void fn?.();
                }}
              >
                {t('mcpConfig.publicAckConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PinnedPage>
    </TooltipProvider>
  );
}
