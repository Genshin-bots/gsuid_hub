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
  Settings2, ListChecks, Package
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  mcpConfigApi,
  MCPConfig,
  MCPReloadResponse,
  MCPPreset,
  MCPToolFromServer,
  MCPToolDefinition,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ============================================================================
// Types
// ============================================================================

interface EnvVar {
  key: string;
  value: string;
}

interface FormData {
  name: string;
  command: string;
  argsText: string;
  envVars: EnvVar[];
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

function getEmptyFormData(): FormData {
  return {
    name: '',
    command: '',
    argsText: '',
    envVars: [],
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

  // Preset dialog
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await mcpConfigApi.getList();
      setConfigs(data.configs);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const loadPresets = useCallback(async () => {
    try {
      setIsLoadingPresets(true);
      const data = await mcpConfigApi.getPresets();
      setPresets(data.presets);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('mcpConfig.loadPresetsFailed'),
        variant: 'destructive',
      });
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
      toast({
        title: t('mcpConfig.reloadSuccess'),
        description: `${t('mcpConfig.oldToolCount')}: ${result.old_tool_count} → ${t('mcpConfig.newToolCount')}: ${result.new_tool_count}`,
      });
      await loadConfigs();
    } catch (error) {
      toast({
        title: t('mcpConfig.reloadFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
    } finally {
      setIsReloading(false);
    }
  };

  // ============================================================================
  // Preset Selection
  // ============================================================================

  const handleOpenPresetDialog = () => {
    loadPresets();
    setPresetDialogOpen(true);
  };

  const handleSelectPreset = (preset: MCPPreset) => {
    setConnectionMethod('preset');
    setSelectedPresetName(preset.name);
    setFormData({
      name: preset.name,
      command: preset.command,
      argsText: argsToText(preset.args),
      envVars: envToVars(preset.env_template),
      enabled: true,
      registerAsAiTools: false,
      toolPermissions: {},
    });
    // Pre-populate discovered tools from preset defaults
    const presetTools: MCPToolFromServer[] = preset.default_tools.map(dt => ({
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
        result = await mcpConfigApi.discoverToolsFromConfig({
          name: formData.name.trim(),
          command: formData.command.trim(),
          args,
          env,
        });
      }

      setDiscoveredTools(result.tools);
      setSelectedToolNames(new Set(result.tools.map(t => t.name)));
      toast({
        title: t('mcpConfig.discoverSuccess'),
        description: `${t('mcpConfig.toolsCount', { count: result.count })}`,
      });
    } catch (error) {
      toast({
        title: t('mcpConfig.discoverFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
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
    setFormData({
      name: config.name,
      command: config.command,
      argsText: argsToText(config.args),
      envVars: envToVars(config.env),
      enabled: config.enabled,
      registerAsAiTools: config.register_as_ai_tools,
      toolPermissions: config.tool_permissions || {},
    });
    setConnectionMethod('manual');
    setSelectedPresetName('');
    // Pre-populate tools from config
    const configTools: MCPToolFromServer[] = config.tools.map(t => ({
      name: t.name,
      description: t.description,
    }));
    setDiscoveredTools(configTools);
    setSelectedToolNames(new Set(config.tools.map(t => t.name)));
    setFormDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t('common.error'),
        description: t('mcpConfig.configName') + ' ' + t('common.required'),
        variant: 'destructive',
      });
      return;
    }
    if (!formData.command.trim()) {
      toast({
        title: t('common.error'),
        description: t('mcpConfig.command') + ' ' + t('common.required'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const args = parseArgsText(formData.argsText);
      const env = varsToEnv(formData.envVars);

      // Build tools list from selected discovered tools
      const tools: MCPToolDefinition[] = discoveredTools
        .filter(dt => selectedToolNames.has(dt.name))
        .map(dt => ({
          name: dt.name,
          description: dt.description,
        }));

      if (editingConfig) {
        // Update
        await mcpConfigApi.update(editingConfig.config_id, {
          name: formData.name.trim(),
          command: formData.command.trim(),
          args,
          env,
          enabled: formData.enabled,
          register_as_ai_tools: formData.registerAsAiTools,
          tools,
          tool_permissions: formData.toolPermissions,
        });
        toast({ title: t('mcpConfig.updateSuccess') });
      } else {
        // Create
        await mcpConfigApi.create({
          name: formData.name.trim(),
          command: formData.command.trim(),
          args,
          env,
          enabled: formData.enabled,
          register_as_ai_tools: formData.registerAsAiTools,
          tools,
          tool_permissions: formData.toolPermissions,
        });
        toast({ title: t('mcpConfig.createSuccess') });
      }

      setFormDialogOpen(false);
      await loadConfigs();
      // Auto reload after create/update
      handleReload();
    } catch (error) {
      toast({
        title: editingConfig ? t('mcpConfig.updateFailed') : t('mcpConfig.createFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
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
      toast({ title: t('mcpConfig.deleteSuccess') });
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
      await loadConfigs();
      // Auto reload after delete
      handleReload();
    } catch (error) {
      toast({
        title: t('mcpConfig.deleteFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
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
      toast({ title: t('mcpConfig.toggleSuccess') });
      await loadConfigs();
      // Auto reload after toggle
      handleReload();
    } catch (error) {
      toast({
        title: t('mcpConfig.toggleFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
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
      toast({
        title: t('common.error'),
        description: t('mcpConfig.invalidJsonFormat'),
        variant: 'destructive',
      });
      return;
    }

    // Validate JSON
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.mcpServers) {
        toast({
          title: t('common.error'),
          description: t('mcpConfig.unsupportedJsonFormat'),
          variant: 'destructive',
        });
        return;
      }
    } catch {
      toast({
        title: t('common.error'),
        description: t('mcpConfig.invalidJsonFormat'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsImporting(true);
      const result = await mcpConfigApi.importConfig({ json_config: importJsonText });
      toast({
        title: t('mcpConfig.importSuccess'),
        description: `${result.name}: ${result.tool_names.join(', ')}`,
      });
      setImportDialogOpen(false);
      setImportJsonText('');
      await loadConfigs();
      handleReload();
    } catch (error) {
      toast({
        title: t('mcpConfig.importFailed'),
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
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
  // Render
  // ============================================================================

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <Server className="w-6 h-6 sm:w-8 sm:h-8" />
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
            {configs.map(config => (
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
                      <Server className={cn(
                        "w-5 h-5 transition-colors duration-300",
                        config.enabled ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <p className="font-medium text-sm truncate max-w-full">{config.name}</p>
                        <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs shrink-0">
                          {config.enabled ? t('mcpConfig.enabled') : t('mcpConfig.disabled')}
                        </Badge>
                        {config.register_as_ai_tools && (
                          <Badge variant="outline" className="text-xs shrink-0 bg-blue-500/10 text-blue-600 border-blue-200">
                            AI Tools
                          </Badge>
                        )}
                        {config.tools.length > 0 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <Wrench className="h-3 w-3 mr-1" />
                            {t('mcpConfig.toolsCount', { count: config.tools.length })}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 break-all">
                        <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{config.command}</code>
                        {config.args.length > 0 && (
                          <span className="ml-1">
                            {config.args.map((arg, i) => (
                              <span key={i}>
                                <code className="bg-muted px-1 py-0.5 rounded text-[10px] ml-1">{arg}</code>
                              </span>
                            ))}
                          </span>
                        )}
                      </p>
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
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.command')}</p>
                          <p className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded">{config.command}</code></p>
                        </div>
                      </div>
                      {config.args.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.args')}</p>
                          <div className="flex flex-wrap gap-1">
                            {config.args.map((arg, i) => (
                              <Badge key={i} variant="outline" className="text-xs font-mono">{arg}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.keys(config.env).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('mcpConfig.env')}</p>
                          <div className="space-y-1">
                            {Object.entries(config.env).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{key}</code>
                                <span className="text-muted-foreground">=</span>
                                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">***</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Register as AI Tools */}
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('mcpConfig.registerAsAiTools')}:</p>
                        <Badge variant={config.register_as_ai_tools ? "default" : "secondary"} className="text-xs">
                          {config.register_as_ai_tools ? t('common.yes') : t('common.no')}
                        </Badge>
                      </div>

                      {/* Tools List */}
                      {config.tools.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('mcpConfig.tools')}</p>
                          <div className="space-y-2">
                            {config.tools.map((tool, i) => (
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
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[600px] max-h-[85vh] overflow-y-auto glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                {editingConfig ? t('mcpConfig.editConfig') : t('mcpConfig.addConfig')}
              </DialogTitle>
              <DialogDescription>
                {editingConfig
                  ? `${t('mcpConfig.editConfig')} - ${editingConfig.name}`
                  : t('mcpConfig.description')
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Connection Method (only for create) */}
              {!editingConfig && (
                <div className="space-y-2">
                  <Label>{t('mcpConfig.connectionMethod')}</Label>
                  <RadioGroup
                    value={connectionMethod}
                    onValueChange={(v) => setConnectionMethod(v as ConnectionMethod)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="method-manual" />
                      <Label htmlFor="method-manual" className="font-normal cursor-pointer">{t('mcpConfig.manualFill')}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="preset" id="method-preset" />
                      <Label htmlFor="method-preset" className="font-normal cursor-pointer">{t('mcpConfig.selectPreset')}</Label>
                    </div>
                  </RadioGroup>

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
                <div className="flex items-center gap-1">
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

              {/* Command */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
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
                <div className="flex items-center gap-1">
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
              </div>

              {/* Environment Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
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
                {formData.envVars.length > 0 && (
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
                        <Input
                          placeholder={t('mcpConfig.envValuePlaceholder')}
                          value={envVar.value}
                          onChange={e => updateEnvVar(index, 'value', e.target.value)}
                          className="flex-1 font-mono text-sm"
                          type="password"
                        />
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
                )}
              </div>

              <Separator />

              {/* Discover Tools Button */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={handleDiscoverTools}
                  disabled={isDiscovering || !formData.name.trim() || !formData.command.trim()}
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
                    <Label className="flex items-center gap-1">
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                {editingConfig ? t('common.save') : t('common.confirm')}
              </Button>
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
          <DialogContent className="w-[95vw] max-w-[560px] glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                {t('mcpConfig.importJson')}
              </DialogTitle>
              <DialogDescription>
                {t('mcpConfig.importJsonPlaceholder')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <Textarea
                placeholder={`{
  "mcpServers": {
    "MiniMax": {
      "command": "uvx",
      "args": ["minimax-coding-plan-mcp"],
      "env": {
        "MINIMAX_API_KEY": "your_key"
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

            <DialogFooter>
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
          <DialogContent className="w-[95vw] max-w-[560px] max-h-[70vh] glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                {t('mcpConfig.presetList')}
              </DialogTitle>
              <DialogDescription>
                {t('mcpConfig.selectPresetPlaceholder')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : presets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Package className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('mcpConfig.noConfigs')}</p>
                </div>
              ) : (
                presets.map((preset, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{preset.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{preset.command}</code>
                          {preset.args.map((arg, j) => (
                            <code key={j} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{arg}</code>
                          ))}
                        </div>
                        {preset.default_tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {preset.default_tools.map((tool, j) => (
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
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
