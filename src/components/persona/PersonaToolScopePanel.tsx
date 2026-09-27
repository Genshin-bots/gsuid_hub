import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pin, PinOff, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { personaApi, type PersonaConfig, type PersonaListItem } from '@/lib/api';
import { specToEnabledPlugins, enabledPluginsToSpec } from '@/lib/personaToolScope';

type TFn = (key: string) => string;

interface PersonaToolScopePanelProps {
  /** 工具所属插件；core / 空 = 框架自身，不受启用开关影响 */
  plugin: string;
  toolName: string;
  t: TFn;
}

/**
 * 在「工具详情」里就地处置某个工具的可用性：按人格禁用其插件 / 取消常驻。
 *
 * 之所以放在工具页而不是只放人格页：人是在这里发现「这个工具老是抢戏」的，
 * 在问题发生的地方解决，比去配置页翻 471 行列表省事。
 */
export function PersonaToolScopePanel({ plugin, toolName, t }: PersonaToolScopePanelProps) {
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [configs, setConfigs] = useState<Record<string, PersonaConfig>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // 框架自身工具恒定在场，没有可开关的东西
  const isNeutral = plugin === 'core' || plugin === '' || plugin === 'gsuid_core';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cfgs] = await Promise.all([
        personaApi.getPersonaList(),
        personaApi.getAllPersonaConfigs().catch(() => ({}) as Record<string, PersonaConfig>),
      ]);
      setPersonas(list);
      setConfigs(cfgs);
    } catch {
      toast.error(t('personaConfig.scopeLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const allPlugins = useCallback(
    async () => {
      const catalog = await personaApi.getToolCatalog();
      return catalog.plugins.map((p) => p.name);
    },
    [],
  );

  const setPluginEnabled = async (name: string, cfg: PersonaConfig, enabled: boolean) => {
    setBusy(name);
    try {
      const known = await allPlugins();
      const currently = specToEnabledPlugins(cfg.enabled_tools, known);
      const next = enabled
        ? Array.from(new Set([...currently, plugin]))
        : currently.filter((p) => p !== plugin);
      await personaApi.updatePersonaConfig(name, {
        enabled_tools: enabledPluginsToSpec(next, known),
      });
      setConfigs((prev) => ({ ...prev, [name]: { ...cfg, enabled_tools: enabledPluginsToSpec(next, known) } }));
      toast.success(t('personaConfig.scopeSaved'));
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setBusy(null);
    }
  };

  const setPinned = async (name: string, cfg: PersonaConfig, pinned: boolean) => {
    setBusy(name);
    try {
      const names = new Set(cfg.tool_names ?? []);
      if (pinned) names.add(toolName);
      else names.delete(toolName);
      await personaApi.updatePersonaConfig(name, { tool_names: Array.from(names) });
      setConfigs((prev) => ({ ...prev, [name]: { ...cfg, tool_names: Array.from(names) } }));
      toast.success(t('personaConfig.scopeSaved'));
    } catch (e) {
      toast.error(getError(e, t));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('personaConfig.scopePanelHint')}</p>
      {personas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('personaConfig.scopeNoPersona')}</p>
      ) : (
        <div className="space-y-1.5">
          {personas.map((p) => {
            const cfg = configs[p.name] ?? ({} as PersonaConfig);
            const pinned = (cfg.tool_names ?? []).includes(toolName);
            return (
              <div
                key={p.name}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>

                <Button
                  type="button"
                  size="sm"
                  variant={pinned ? 'default' : 'ghost'}
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={busy === p.name}
                  onClick={() => setPinned(p.name, cfg, !pinned)}
                >
                  {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  {pinned ? t('personaConfig.scopeUnpin') : t('personaConfig.scopePin')}
                </Button>

                {isNeutral ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {t('personaConfig.scopeAlwaysOn')}
                  </Badge>
                ) : (
                  <PluginToggleButton
                    personaName={p.name}
                    config={cfg}
                    plugin={plugin}
                    busy={busy === p.name}
                    t={t}
                    onToggle={(on) => setPluginEnabled(p.name, cfg, on)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PluginToggleButton({
  personaName,
  config,
  plugin,
  busy,
  t,
  onToggle,
}: {
  personaName: string;
  config: PersonaConfig;
  plugin: string;
  busy: boolean;
  t: TFn;
  onToggle: (enabled: boolean) => void;
}) {
  // enabled_tools 缺省 = 全开；这里只判「是否显式排除」
  const spec = config.enabled_tools;
  const denied = (spec ?? []).some((x) => x === `!${plugin}`);
  const whitelistOnly = (spec ?? []).length > 0 && !(spec ?? []).includes('*') && !(spec ?? []).includes('all');
  const enabled = whitelistOnly ? !denied : true;

  return (
    <Button
      type="button"
      size="sm"
      variant={enabled ? 'ghost' : 'destructive'}
      className="h-7 shrink-0 px-2 text-xs"
      disabled={busy}
      onClick={() => onToggle(!enabled)}
      title={t('personaConfig.scopePluginToggleTitle')}
    >
      {enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
      <span className={cn('truncate')}>{enabled ? t('personaConfig.scopeEnabled') : t('personaConfig.scopeDisabled')}</span>
      {!enabled && <Check className="h-3 w-3" />}
    </Button>
  );
}

function getError(e: unknown, t: TFn): string {
  if (e instanceof Error && e.message) return e.message;
  return t('personaConfig.scopeSaveFailed');
}
