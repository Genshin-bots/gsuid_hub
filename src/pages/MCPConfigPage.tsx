import { useState, useEffect, useCallback } from 'react';
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
  X, HelpCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { mcpConfigApi, MCPConfig, MCPReloadResponse } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
}

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

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<MCPConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Expanded config details
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);

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
  // Create / Edit
  // ============================================================================

  const openCreateDialog = () => {
    setEditingConfig(null);
    setFormData(getEmptyFormData());
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
    });
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

      if (editingConfig) {
        // Update
        await mcpConfigApi.update(editingConfig.config_id, {
          name: formData.name.trim(),
          command: formData.command.trim(),
          args,
          env,
          enabled: formData.enabled,
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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Server className="w-8 h-8" />
              {t('mcpConfig.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('mcpConfig.description')}</p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              {t('mcpConfig.addConfig')}
            </Button>
          </div>
        </div>

        {/* Reload Result */}
        {reloadResult && (
          <Card className={cn(
            "transition-all duration-300",
            isGlass && "glass-card"
          )}>
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
          <Card className={cn(
            "transition-all duration-300",
            isGlass && "glass-card"
          )}>
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
                  "transition-all duration-300 hover:shadow-md",
                  isGlass && "glass-card",
                  !config.enabled && "opacity-60"
                )}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    {/* Expand/Collapse */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
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

                    {/* Icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300",
                      config.enabled ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Server className={cn(
                        "w-5 h-5 transition-colors duration-300",
                        config.enabled ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{config.name}</p>
                        <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs shrink-0">
                          {config.enabled ? t('mcpConfig.enabled') : t('mcpConfig.disabled')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
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
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={() => handleToggle(config)}
                          />
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
                    <div className="mt-4 ml-12 p-4 rounded-xl border bg-muted/30 border-border/40 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
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
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
          <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
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
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder={t('mcpConfig.envKeyPlaceholder')}
                          value={envVar.key}
                          onChange={e => updateEnvVar(index, 'key', e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                        <span className="text-muted-foreground">=</span>
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
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeEnvVar(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
          <AlertDialogContent>
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
      </div>
    </TooltipProvider>
  );
}
