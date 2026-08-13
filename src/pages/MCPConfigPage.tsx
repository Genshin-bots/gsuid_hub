import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Server, Loader2, Plus, Pencil, Trash2, RefreshCw,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  X, HelpCircle, Download, FileJson, Search, Wrench,
  Settings2, ListChecks, Package, Globe, Terminal, Network,
  Tag, ArrowLeftRight, Braces, Key, Shield,
  Eye, EyeOff
} from 'lucide-react';
import { AutoBrandIcon } from '@/components/ui/mcp-icon-lookup';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  mcpConfigApi,
  MCPConfig,
  MCPTransport,
  MCPReloadResponse,
  MCPPreset,
  MCPToolFromServer,
  MCPToolDefinition,
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
import { PinnedPage } from '@/components/layout/PinnedPage';

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
  registerAsAiTools: boolean;
  toolPermissions: Record<string, number>;
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
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

function argsToText(args: string[]): string {
  return args.join('\n');
}

function envToVars(env: Record<string, string>): EnvVar[] {
  return Object.entries(env).map(([key, value]) => ({ key, value }));
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
  labelKey: 'mcpConfig.transportStdio' | 'mcpConfig.transportSse' | 'mcpConfig.transportStreamableHttp';
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
    registerAsAiTools: false,
    toolPermissions: {},
  };
}

// ============================================================================
// Component
// ============================================================================

export default function MCPConfigPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

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
    setVisibleSecrets(prev => {
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
      toast.success(`${t('mcpConfig.oldToolCount')}: ${result.old_tool_count} → ${t('mcpConfig.newToolCount')}: ${result.new_tool_count}`);
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
    return presets.filter(preset => {
      const name = (preset.name || '').toLowerCase();
      const desc = (preset.description || '').toLowerCase();
      const command = (preset.command || '').toLowerCase();
      const url = (preset.url || '').toLowerCase();
      const toolNames = (preset.default_tools || []).map(t => (t.name || '').toLowerCase()).join(' ');
      return name.includes(keyword) || desc.includes(keyword) || command.includes(keyword) || url.includes(keyword) || toolNames.includes(keyword);
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
      registerAsAiTools: false,
      toolPermissions: {},
    });
    // Pre-populate discovered tools from preset defaults
    const presetTools: MCPToolFromServer[] = (preset.default_tools || []).map(dt => ({
      name: dt.name,
      description: dt.description,
    }));
    setDiscoveredTools(presetTools);
    setSelectedToolNames(new Set(presetTools.map(t => t.name)));
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
      setSelectedToolNames(new Set(result.tools.map(t => t.name)));
      toast.success(`${t('mcpConfig.toolsCount', { count: result.count })}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleToggleTool = (toolName: string) => {
    setSelectedToolNames(prev => {
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
      envVars: envToVars(config.env || {}),
      url: config.url || '',
      headerVars: headersToVars(config.headers || {}),
      enabled: config.enabled,
      registerAsAiTools: config.register_as_ai_tools,
      toolPermissions: config.tool_permissions || {},
    });
    setConnectionMethod('manual');
    setSelectedPresetName('');
    // Pre-populate tools from config (preserve parameters and input_schema)
    const existingTools = config.tools ?? [];
    const configTools: MCPToolFromServer[] = existingTools.map(t => ({
      name: t.name,
      description: t.description,
      ...(t.parameters && { parameters: t.parameters }),
      ...(t.input_schema && { input_schema: t.input_schema }),
    }));
    setDiscoveredTools(configTools);
    setSelectedToolNames(new Set(existingTools.map(t => t.name)));
    setFormDialogOpen(true);
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

    try {
      setIsSubmitting(true);
      const args = parseArgsText(formData.argsText);
      const env = varsToEnv(formData.envVars);
      const headers = varsToHeaders(formData.headerVars);

      // Build tools list from selected discovered tools
      // Include parameters and input_schema from discover response
      const tools: MCPToolDefinition[] = discoveredTools
        .filter(dt => selectedToolNames.has(dt.name))
        .map(dt => ({
          name: dt.name,
          description: dt.description,
          ...(dt.parameters && { parameters: dt.parameters }),
          ...(dt.input_schema && { input_schema: dt.input_schema }),
        }));

      if (editingConfig) {
        // Update
        await mcpConfigApi.update(editingConfig.config_id, {
          name: formData.name.trim(),
          transport: formData.transport,
          command: formData.transport === 'stdio' ? formData.command.trim() : '',
          args: formData.transport === 'stdio' ? args : [],
          env: formData.transport === 'stdio' ? env : {},
          url: isHttpMcpTransport(formData.transport) ? formData.url.trim() : '',
          headers: isHttpMcpTransport(formData.transport) ? headers : {},
          enabled: formData.enabled,
          register_as_ai_tools: formData.registerAsAiTools,
          tools,
          tool_permissions: formData.toolPermissions,
        });
        toast.success(t('mcpConfig.updateSuccess'));
      } else {
        // Create
        await mcpConfigApi.create({
          name: formData.name.trim(),
          transport: formData.transport,
          command: formData.transport === 'stdio' ? formData.command.trim() : '',
          args: formData.transport === 'stdio' ? args : [],
          env: formData.transport === 'stdio' ? env : {},
          url: isHttpMcpTransport(formData.transport) ? formData.url.trim() : '',
          headers: isHttpMcpTransport(formData.transport) ? headers : {},
          enabled: formData.enabled,
          register_as_ai_tools: formData.registerAsAiTools,
          tools,
          tool_permissions: formData.toolPermissions,
        });
        toast.success(t('mcpConfig.createSuccess'));
      }

      setFormDialogOpen(false);
      await loadConfigs();
      // Auto reload after create/update
      handleReload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    } finally {
      setIsSubmitting(false);
    }
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
    setFormData(prev => ({
      ...prev,
      envVars: [...prev.envVars, { key: '', value: '' }],
    }));
  };

  const removeEnvVar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      envVars: prev.envVars.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };

  // ============================================================================
  // Header Vars Management (SSE mode)
  // ============================================================================

  const addHeaderVar = () => {
    setFormData(prev => ({
      ...prev,
      headerVars: [...prev.headerVars, { key: '', value: '' }],
    }));
  };

  const removeHeaderVar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      headerVars: prev.headerVars.filter((_, i) => i !== index),
    }));
  };

  const updateHeaderVar = (index: number, field: 'key' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      headerVars: prev.headerVars.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <TooltipProvider>
      <PinnedPage
        className="gap-4 sm:gap-6"
        bodyClassName="space-y-4 sm:space-y-6"
        header={
          /* Header */
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                <Server
                  width={32}
                  height={32}
                  className="text-foreground"
                />
                {t('mcpConfig.title')}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('mcpConfig.description')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
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
                  <p>{t('mcpConfig.reload')} - {t('mcpConfig.description')}</p>
                </TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={handleOpenImportDialog}>
                <FileJson className="h-4 w-4 mr-1" />
                {t('mcpConfig.importJson')}
              </Button>
              <Button size="sm" onClick={openCreateDialog}>
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
                    {t('mcpConfig.oldToolCount')}: {reloadResult.old_tool_count} → {t('mcpConfig.newToolCount')}: {reloadResult.new_tool_count} | {t('mcpConfig.configCount', { count: reloadResult.config_count })}
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
                <p className="text-sm font-medium text-muted-foreground">{t('mcpConfig.noConfigs')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t('mcpConfig.noConfigsDesc')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {configs.map(config => {
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
                  "transition-all duration-300 hover:shadow-md glass-card",
                  !config.enabled && "opacity-60"
                )}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    {/* Expand/Collapse */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 mt-0.5 sm:mt-0"
                      onClick={() => setExpandedConfigId(
                        expandedConfigId === config.config_id ? null : config.config_id
                      )}
                    >
                      {expandedConfigId === config.config_id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Icon - hidden on mobile, shown on sm+ */}
                    <div className={cn(
                      "hidden sm:flex w-10 h-10 rounded-xl items-center justify-center flex-shrink-0 transition-all duration-300",
                      config.enabled ? "bg-primary/10" : "bg-muted"
                    )}>
                      <McpBrandIcon
                        name={config.name}
                        command={config.command}
                        url={config.url}
                        className={cn(
                          "w-5 h-5 transition-colors duration-300",
                          config.enabled ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <p className="font-medium text-sm truncate max-w-full">{config.name}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          <itemMeta.Icon className="h-3 w-3 mr-1" />{itemMeta.short}
                        </Badge>
                        <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs shrink-0">
                          {config.enabled ? t('mcpConfig.enabled') : t('mcpConfig.disabled')}
                        </Badge>
                        {config.register_as_ai_tools && (
                          <Badge variant="outline" className="text-xs shrink-0 bg-blue-500/10 text-blue-600 border-blue-200">
                            AI Tools
                          </Badge>
                        )}
                        {itemTools.length > 0 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <Wrench className="h-3 w-3 mr-1" />
                            {t('mcpConfig.toolsCount', { count: itemTools.length })}
                          </Badge>
                        )}
                      </div>
                      {itemHttp ? (
                        <p className="text-xs text-muted-foreground mt-0.5 break-all">
                          <Globe className="h-3 w-3 inline mr-1" />
                          <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{config.url}</code>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5 break-all">
                          <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{config.command}</code>
                          {itemArgs.length > 0 && (
                            <span className="ml-1">
                              {itemArgs.map((arg, i) => (
                                <span key={i}>
                                  <code className="bg-muted px-1 py-0.5 rounded text-[10px] ml-1">{arg}</code>
                                </span>
                              ))}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.configId')}</p>
                          <p className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded">{config.config_id}</code></p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.transport')}</p>
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.command')}</p>
                              <p className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded">{config.command}</code></p>
                            </div>
                          </div>
                          {itemArgs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.args')}</p>
                              <div className="flex flex-wrap gap-1">
                                {itemArgs.map((arg, i) => (
                                  <Badge key={i} variant="outline" className="text-xs font-mono">{arg}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(itemEnv).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.env')}</p>
                              <div className="space-y-1">
                                {Object.entries(itemEnv).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2 text-xs">
                                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{key}</code>
                                    <span className="text-muted-foreground">=</span>
                                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">***</code>
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
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.url')}</p>
                            <p className="text-sm break-all"><code className="bg-muted px-1.5 py-0.5 rounded">{config.url}</code></p>
                          </div>
                          {config.headers && Object.keys(config.headers).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.headers')}</p>
                              <div className="space-y-1">
                                {Object.entries(config.headers).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2 text-xs">
                                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{key}</code>
                                    <span className="text-muted-foreground">:</span>
                                    <code className="bg-muted px-1.5 py-0.5 rounded font-mono">***</code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Register as AI Tools */}
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('mcpConfig.registerAsAiTools')}:</p>
                        <Badge variant={config.register_as_ai_tools ? "default" : "secondary"} className="text-xs">
                          {config.register_as_ai_tools ? t('common.yes') : t('common.no')}
                        </Badge>
                      </div>

                      {/* Tools List */}
                      {itemTools.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('mcpConfig.tools')}</p>
                          <div className="space-y-2">
                            {itemTools.map((tool, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/50 border border-border/30">
                                <Wrench className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{tool.name}</p>
                                  {tool.description && (
                                    <p className="text-xs text-muted-foreground">{tool.description}</p>
                                  )}
                                  {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Object.entries(tool.parameters).map(([paramName, paramDef]) => (
                                        <Badge key={paramName} variant="outline" className="text-[10px] font-mono">
                                          {paramName}
                                          {paramDef.required && <span className="text-destructive ml-0.5">*</span>}
                                        </Badge>
                                      ))}
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
          <DialogContent className="w-[95vw] max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden p-0 glass-card">
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
                  : t('mcpConfig.description')
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2 px-6 flex-1 min-h-0 overflow-y-auto">
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
                        : t('mcpConfig.selectPresetPlaceholder')
                      }
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
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                    if (v) setFormData(prev => ({ ...prev, transport: v as MCPTransport }));
                  }}
                  variant="outline"
                  className="justify-start flex-wrap"
                >
                  <ToggleGroupItem value="stdio" className="flex items-center gap-1.5 px-3">
                    <Terminal className="h-3.5 w-3.5" />
                    {t('mcpConfig.transportStdio')}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="streamable_http" className="flex items-center gap-1.5 px-3">
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
                      onChange={e => setFormData(prev => ({ ...prev, command: e.target.value }))}
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
                      onChange={e => setFormData(prev => ({ ...prev, argsText: e.target.value }))}
                      rows={3}
                      className="font-mono text-sm"
                    />
                    {!formData.argsText.trim() && (
                      <p className="text-xs text-muted-foreground/60 italic">{t('mcpConfig.noArgs')}</p>
                    )}
                  </div>

                  {/* Environment Variables */}
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
                          <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Input
                              placeholder={t('mcpConfig.envKeyPlaceholder')}
                              value={envVar.key}
                              onChange={e => updateEnvVar(index, 'key', e.target.value)}
                              className="flex-1 font-mono text-sm"
                            />
                            <span className="text-muted-foreground hidden sm:inline">=</span>
                            <div className="relative flex-1">
                              <Input
                                placeholder={t('mcpConfig.envValuePlaceholder')}
                                value={envVar.value}
                                onChange={e => updateEnvVar(index, 'value', e.target.value)}
                                className="flex-1 font-mono text-sm pr-9"
                                type={visibleSecrets.has(`env-${index}`) ? 'text' : 'password'}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full w-9 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                onClick={() => toggleSecretVisibility(`env-${index}`)}
                                aria-label={visibleSecrets.has(`env-${index}`) ? t('common.hide') : t('common.show')}
                                title={visibleSecrets.has(`env-${index}`) ? t('common.hide') : t('common.show')}
                              >
                                {visibleSecrets.has(`env-${index}`) ? (
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
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive self-end sm:self-auto"
                              onClick={() => removeEnvVar(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">{t('mcpConfig.noEnvVars')}</p>
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
                      onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
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
                          <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Input
                              placeholder={t('mcpConfig.headersKeyPlaceholder')}
                              value={headerVar.key}
                              onChange={e => updateHeaderVar(index, 'key', e.target.value)}
                              className="flex-1 font-mono text-sm"
                            />
                            <span className="text-muted-foreground hidden sm:inline">:</span>
                            <div className="relative flex-1">
                              <Input
                                placeholder={t('mcpConfig.headersValuePlaceholder')}
                                value={headerVar.value}
                                onChange={e => updateHeaderVar(index, 'value', e.target.value)}
                                className="flex-1 font-mono text-sm pr-9"
                                type={visibleSecrets.has(`header-${index}`) ? 'text' : 'password'}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full w-9 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                onClick={() => toggleSecretVisibility(`header-${index}`)}
                                aria-label={visibleSecrets.has(`header-${index}`) ? t('common.hide') : t('common.show')}
                                title={visibleSecrets.has(`header-${index}`) ? t('common.hide') : t('common.show')}
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
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive self-end sm:self-auto"
                              onClick={() => removeHeaderVar(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">{t('mcpConfig.noHeaders')}</p>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Discover Tools Button */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleDiscoverTools}
                  disabled={isDiscovering || !formData.name.trim() || (formData.transport === 'stdio' && !formData.command.trim()) || (isHttpMcpTransport(formData.transport) && !formData.url.trim())}
                  className="w-full"
                >
                  {isDiscovering ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {isDiscovering ? t('mcpConfig.discoveringTools') : t('mcpConfig.discoverTools')}
                </Button>

                {/* Discovered Tools */}
                {discoveredTools.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4" />
                      {t('mcpConfig.discoveredTools')}
                    </Label>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {discoveredTools.map((tool, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors",
                            selectedToolNames.has(tool.name)
                              ? "bg-primary/5 border-primary/30"
                              : "bg-muted/30 border-border/30 hover:bg-muted/50"
                          )}
                          onClick={() => handleToggleTool(tool.name)}
                        >
                          <Checkbox
                            checked={selectedToolNames.has(tool.name)}
                            onCheckedChange={() => handleToggleTool(tool.name)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{tool.name}</p>
                            {tool.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Enabled */}
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30">
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
                <div>
                  <p className="text-sm font-medium">{t('mcpConfig.enabled')}</p>
                  <p className="text-xs text-muted-foreground">{t('mcpConfig.enabledHelp')}</p>
                </div>
              </div>

              {/* Register as AI Tools */}
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30">
                <Switch
                  checked={formData.registerAsAiTools}
                  onCheckedChange={checked => setFormData(prev => ({ ...prev, registerAsAiTools: checked }))}
                />
                <div>
                  <p className="text-sm font-medium">{t('mcpConfig.registerAsAiTools')}</p>
                  <p className="text-xs text-muted-foreground">{t('mcpConfig.registerAsAiToolsHelp')}</p>
                </div>
              </div>

              {/* Tool Permissions - only show when registerAsAiTools is true */}
              {formData.registerAsAiTools && (
                <div className="space-y-3 p-3 border border-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('mcpConfig.toolPermissions')}</p>
                      <p className="text-xs text-muted-foreground">{t('mcpConfig.toolPermissionsHelp')}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Add default permission (pm=6, all users) for each selected tool
                        const newPerms = { ...formData.toolPermissions };
                        selectedToolNames.forEach(toolName => {
                          if (newPerms[toolName] === undefined) {
                            newPerms[toolName] = 6;
                          }
                        });
                        setFormData(prev => ({ ...prev, toolPermissions: newPerms }));
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
                      {Array.from(selectedToolNames).map(toolName => {
                        const currentPm = formData.toolPermissions[toolName] ?? 6;
                        return (
                          <div key={toolName} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-muted/30 rounded">
                            <span className="text-sm font-mono flex-1 truncate">{toolName}</span>
                            <Select
                              value={String(currentPm)}
                              onValueChange={(value) => {
                                const newPerms = { ...formData.toolPermissions };
                                newPerms[toolName] = Number(value);
                                setFormData(prev => ({ ...prev, toolPermissions: newPerms }));
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-[180px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PERMISSION_OPTIONS.map(opt => (
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
                                      setFormData(prev => ({ ...prev, toolPermissions: newPerms }));
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
                </div>
              )}
            </div>

            <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t bg-background">
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
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
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
              <DialogDescription>
                {t('mcpConfig.importJsonPlaceholder')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 px-6 flex-1 min-h-0 overflow-y-auto">
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
                onChange={e => setImportJsonText(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t bg-background">
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
              <DialogDescription>
                {t('mcpConfig.selectPresetPlaceholder')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 flex-1 min-h-0 flex flex-col">
              {/* Search Input */}
              {!isLoadingPresets && presets.length > 0 && (
                <div className="relative shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('mcpConfig.presetSearchPlaceholder')}
                    value={presetSearchText}
                    onChange={e => setPresetSearchText(e.target.value)}
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
                  <p className="text-sm text-muted-foreground">{t('mcpConfig.noPresetSearchResult')}</p>
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
                            <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                          )}
                          {presetTransport === 'stdio' && preset.command && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{preset.command}</code>
                              {(preset.args || []).map((arg, j) => (
                                <code key={j} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{arg}</code>
                              ))}
                            </div>
                          )}
                          {isHttpMcpTransport(presetTransport) && preset.url && (
                            <div className="mt-2">
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono break-all">{preset.url}</code>
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
      </PinnedPage>
    </TooltipProvider>
  );
}
