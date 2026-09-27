import { useMemo } from 'react';
import { Package, Pin, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckListField,
  type CheckListGroup,
  type CheckListItem,
} from '@/components/config/CheckListField';
import type { PersonaToolCatalog } from '@/lib/api';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** 档位预设：绝大多数人格属于其中之一，其余才进细配。 */
export type ToolPreset = 'all' | 'lean' | 'chat';

const PRESETS: { key: ToolPreset; label: string; desc: string }[] = [
  { key: 'all', label: 'presetAll', desc: 'presetAllDesc' },
  { key: 'lean', label: 'presetLean', desc: 'presetLeanDesc' },
  { key: 'chat', label: 'presetChat', desc: 'presetChatDesc' },
];

/**
 * 右边清单的操作语义随档位变，标题也要跟着变，否则「全量」模式下写「启用工具」、
 * 用户勾一下却是在排除，认知对不上。自定义混合态没有主语义，回落通用标题。
 */
const TOOL_SCOPE_LABELS: Record<ToolPreset | 'custom', string> = {
  all: 'personaConfig.enabledToolsTitleExclude',
  lean: 'personaConfig.enabledToolsTitleAdd',
  chat: 'personaConfig.enabledToolsTitleEnable',
  custom: 'personaConfig.enabledTools',
};

interface PersonaToolScopeEditorProps {
  catalog: PersonaToolCatalog | null;
  /** 启用工具（按插件） */
  enabledPlugins: string[];
  onEnabledPluginsChange: (value: string[]) => void;
  /** 显式工具白名单：默认常驻工具已预填，按需增删 */
  toolNames: string[];
  onToolNamesChange: (value: string[]) => void;
  t: TFn;
}

export function PersonaToolScopeEditor({
  catalog,
  enabledPlugins,
  onEnabledPluginsChange,
  toolNames,
  onToolNamesChange,
  t,
}: PersonaToolScopeEditorProps) {
  const pluginNames = useMemo(() => (catalog?.plugins ?? []).map((p) => p.name), [catalog]);
  const totalTools = useMemo(
    () => Object.values(catalog?.tools ?? {}).reduce((sum, list) => sum + list.length, 0),
    [catalog],
  );

  const pluginItems = useMemo<CheckListItem[]>(
    () =>
      (catalog?.plugins ?? []).map((plugin) => ({
        value: plugin.name,
        label: plugin.name,
        icon: <PluginIcon pluginName={plugin.name} className="h-4 w-4" />,
        meta: t('personaConfig.listUnitTools', { count: plugin.tool_count }),
        searchText: plugin.name.toLowerCase(),
      })),
    [catalog, t],
  );

  const toolGroups = useMemo<CheckListGroup[]>(() => {
    const byPlugin = catalog?.tools ?? {};
    return Object.entries(byPlugin)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([plugin, tools]) => ({
        key: plugin,
        label: plugin,
        count: tools.length,
        items: tools.map<CheckListItem>((tool) => {
          const brief =
            tool.description.split('\n')[0]?.slice(0, 160) || tool.description.slice(0, 160);
          return {
            value: tool.name,
            label: tool.name,
            description: brief,
            // 检索面含能力族：预拼一次，避免每次过滤重复拼串
            searchText: `${tool.name}\n${brief}\n${tool.capability_domain}`.toLowerCase(),
            tone: tool.always_mounted ? ('always' as const) : ('default' as const),
            meta: tool.category,
          };
        }),
      }));
  }, [catalog]);

  /** 全量扁平表：每次渲染新建会击穿子组件 useMemo，这里显式缓存。 */
  const allToolItems = useMemo(() => toolGroups.flatMap((g) => g.items), [toolGroups]);

  const pluginFilterOptions = useMemo(
    () =>
      (catalog?.plugins ?? []).map((p) => ({
        value: p.name,
        label: p.name,
        icon: <PluginIcon pluginName={p.name} className="h-4 w-4" />,
      })),
    [catalog],
  );

  // exclude 模式：勾选 = 排除；换算回「启用」数组交给上层
  const excludedPlugins = useMemo(
    () => pluginNames.filter((name) => !enabledPlugins.includes(name)),
    [pluginNames, enabledPlugins],
  );
  const setExcludedPlugins = (next: string[]) =>
    onEnabledPluginsChange(pluginNames.filter((name) => !next.includes(name)));

  const enabledToolCount = useMemo(() => {
    const enabled = new Set(enabledPlugins);
    let n = 0;
    for (const [plugin, tools] of Object.entries(catalog?.tools ?? {})) {
      if (enabled.has(plugin)) n += tools.length;
    }
    return n;
  }, [catalog, enabledPlugins]);

  const currentPreset = useMemo<ToolPreset | null>(() => {
    if (excludedPlugins.length === 0) return 'all';
    if (enabledPlugins.length === 0) return 'chat';
    if (enabledPlugins.length === 1 && enabledPlugins[0] === 'core') return 'lean';
    return null;
  }, [enabledPlugins, excludedPlugins]);

  const applyPreset = (preset: ToolPreset) => {
    if (preset === 'all') onEnabledPluginsChange([...pluginNames]);
    else if (preset === 'chat') onEnabledPluginsChange([]);
    else onEnabledPluginsChange(pluginNames.includes('core') ? ['core'] : []);
  };

  return (
    <div className="space-y-8">
      {/*
        档位与「启用工具」必须并排：档位改的就是右边的插件收录范围，
        分成两块上下放，用户看不出改档位会影响谁。
        三枚档位横排成一行，说明收进悬停 tooltip——窄列里堆副标题只会挤成一团。
      */}
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          <LabelWithHelp
            icon={<Wrench className="h-4 w-4" />}
            label={t('personaConfig.toolPresetTitle')}
            description={t('personaConfig.toolPresetHint')}
            className="text-base font-medium"
          />
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => (
                <Tooltip key={preset.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => applyPreset(preset.key)}
                      disabled={pluginNames.length === 0}
                      className={cn(
                        // 高度对齐右边「启用工具」触发器（Button 默认 h-10），长语言折行也靠 flex 居中
                        'flex h-10 items-center justify-center rounded-lg border px-2 text-sm leading-tight transition-colors hover:bg-accent/40 disabled:opacity-50',
                        currentPreset === preset.key
                          ? 'border-primary/60 bg-primary/10 font-medium text-primary'
                          : 'border-border/60 text-muted-foreground',
                      )}
                    >
                      {t(`personaConfig.${preset.label}`)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left">
                    {t(`personaConfig.${preset.desc}`)}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          {currentPreset === null && pluginNames.length > 0 && (
            <p className="text-xs text-muted-foreground">{t('personaConfig.presetCustomHint')}</p>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <CheckListField
            mode="exclude"
            label={t(TOOL_SCOPE_LABELS[currentPreset ?? 'custom'])}
            icon={<Package className="h-4 w-4" />}
            value={excludedPlugins}
            items={pluginItems}
            onChange={setExcludedPlugins}
            searchPlaceholder={t('personaConfig.enabledToolsSearchPlaceholder')}
            emptyText={t('personaConfig.listNoMatch')}
            alwaysLabel={undefined}
            help={t('personaConfig.enabledToolsHint')}
            t={t}
            summary={
              excludedPlugins.length === 0
                ? t('personaConfig.enabledToolsSummaryAll', { count: totalTools })
                : t('personaConfig.enabledToolsSummarySome', {
                    count: enabledToolCount,
                    excluded: excludedPlugins.length,
                  })
            }
          />
        </div>
      </div>

      {/* 显式工具白名单：默认常驻工具已预填，其余按需钉住 */}
      <CheckListField
        mode="add"
        label={t('personaConfig.toolNames')}
        icon={<Pin className="h-4 w-4" />}
        value={toolNames}
        items={allToolItems}
        groups={toolGroups}
        onChange={onToolNamesChange}
        filter={{
          options: pluginFilterOptions,
          allLabel: t('personaConfig.toolNamesAllPlugins'),
        }}
        searchPlaceholder={t('personaConfig.toolNamesSearchPlaceholder')}
        emptyText={t('personaConfig.listNoMatch')}
        alwaysLabel={t('personaConfig.toolNamesAlwaysMountedBadge')}
        help={t('personaConfig.toolNamesHint')}
        popoverWidth="min-w-[480px]"
        t={t}
        summary={
          toolNames.length === 0
            ? undefined
            : t('personaConfig.listSummaryUnit', {
                selected: toolNames.length,
                total: totalTools,
              })
        }
      />
    </div>
  );
}
