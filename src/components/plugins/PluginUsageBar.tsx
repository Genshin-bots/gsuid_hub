import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchSharedPluginPrefs,
  getSharedRecentPluginsSnapshot,
  orderPluginsByUsage,
  recordSharedRecentPlugin,
  resolveRecentPluginItems,
  stepGridHighlightIndex,
  subscribeSharedPluginPrefs,
} from '@/lib/pluginPage';

export interface PluginSelectorItem {
  id: string;
  name: string;
  /** 图标文件名。不传时用 name（如数据库页「核心功能」对应 `gsuid_core`）。 */
  iconName?: string;
  /** 可选启用态：传入 false 时在图标右下角显示停用圆点。 */
  enabled?: boolean;
}

export interface PluginGridSelectorProps {
  plugins: PluginSelectorItem[];
  /** 按触发次数从高到低的插件名。未传或为空时保持调用方原顺序。 */
  usageNames?: string[];
  value: string;
  onValueChange: (pluginId: string) => void;
  className?: string;
  align?: 'start' | 'center' | 'end';
  /** 是否注册全局 `Ctrl+K` / `⌘K` 快捷键唤起选择器，默认开启。 */
  enableShortcut?: boolean;
}

const KBD_KEY_CLASS =
  'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border/75 bg-background/70 px-1.5 font-sans text-[11px] font-medium leading-none text-muted-foreground';

function detectMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Popover 网格插件选择器（主题圆角触发按钮 + 搜索 + 后端持久化的最近使用 + 多列大按钮网格 + 2D 键盘导航）。
 * 用于 `/plugins`、`/database`、`/git-update` 等需要切换当前插件的页面。
 */
export function PluginGridSelector({
  plugins,
  usageNames = [],
  value,
  onValueChange,
  className,
  align = 'end',
  enableShortcut = true,
}: PluginGridSelectorProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isMac = useMemo(() => detectMacPlatform(), []);
  const shortcutLabel = isMac ? '⌘ K' : 'Ctrl K';

  const recentNames = useSyncExternalStore(
    subscribeSharedPluginPrefs,
    getSharedRecentPluginsSnapshot,
    getSharedRecentPluginsSnapshot,
  );

  useEffect(() => {
    void fetchSharedPluginPrefs();
  }, []);

  const orderedPlugins = useMemo(
    () => orderPluginsByUsage(plugins, usageNames),
    [plugins, usageNames],
  );

  const selectedPlugin = useMemo(
    () => plugins.find((item) => item.id === value) ?? orderedPlugins[0],
    [plugins, orderedPlugins, value],
  );

  const recentItems = useMemo(
    () => resolveRecentPluginItems(orderedPlugins, recentNames, usageNames, 4),
    [orderedPlugins, recentNames, usageNames],
  );

  const trimmedQuery = query.trim().toLowerCase();

  const filteredPlugins = useMemo(() => {
    if (!trimmedQuery) return orderedPlugins;
    return orderedPlugins.filter(
      (plugin) =>
        plugin.name.toLowerCase().includes(trimmedQuery) ||
        plugin.id.toLowerCase().includes(trimmedQuery) ||
        (plugin.iconName ? plugin.iconName.toLowerCase().includes(trimmedQuery) : false),
    );
  }, [orderedPlugins, trimmedQuery]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setQuery('');
        const activeIdx = orderedPlugins.findIndex((item) => item.id === value);
        const initialIdx = activeIdx >= 0 ? activeIdx : 0;
        setHighlightedIndex(initialIdx);
        void fetchSharedPluginPrefs();
        requestAnimationFrame(() => {
          cellRefs.current[initialIdx]?.scrollIntoView({ block: 'nearest' });
        });
      }
    },
    [orderedPlugins, value],
  );

  useEffect(() => {
    if (!open) return;
    if (trimmedQuery) {
      setHighlightedIndex(0);
    } else {
      const activeIdx = orderedPlugins.findIndex((item) => item.id === value);
      setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);
    }
  }, [trimmedQuery, open, orderedPlugins, value]);

  useEffect(() => {
    if (!enableShortcut || plugins.length === 0) return;

    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (!open && document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return;
      }
      event.preventDefault();
      handleOpenChange(!open);
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [enableShortcut, plugins.length, open, handleOpenChange]);

  const handleSelectPlugin = useCallback(
    (plugin: PluginSelectorItem) => {
      const recordKey = plugin.iconName ?? plugin.name;
      recordSharedRecentPlugin(recordKey, false);
      if (plugin.id !== value) {
        onValueChange(plugin.id);
      }
      setOpen(false);
    },
    [onValueChange, value],
  );

  const activeHighlightIndex =
    filteredPlugins.length === 0
      ? -1
      : Math.min(filteredPlugins.length - 1, Math.max(0, highlightedIndex));

  const handlePanelKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (filteredPlugins.length === 0) return;

      if (
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        query.length > 0 &&
        (event.shiftKey || event.ctrlKey || event.metaKey)
      ) {
        return;
      }

      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Home' ||
        event.key === 'End'
      ) {
        if ((event.key === 'Home' || event.key === 'End') && query.length > 0) {
          return;
        }
        event.preventDefault();
        const cols = typeof window !== 'undefined' && window.innerWidth >= 640 ? 3 : 2;
        const nextIdx = stepGridHighlightIndex(
          activeHighlightIndex,
          filteredPlugins.length,
          cols,
          event.key,
        );
        setHighlightedIndex(nextIdx);
        requestAnimationFrame(() => {
          cellRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
        });
        return;
      }

      if (event.key === 'Enter' && activeHighlightIndex >= 0) {
        const picked = filteredPlugins[activeHighlightIndex];
        if (picked) {
          event.preventDefault();
          handleSelectPlugin(picked);
        }
      }
    },
    [activeHighlightIndex, filteredPlugins, handleSelectPlugin, query.length],
  );

  if (plugins.length === 0) {
    return null;
  }

  const selectedLabel = selectedPlugin?.name ?? t('plugins.selectPlugin');
  const selectedIconKey = selectedPlugin ? (selectedPlugin.iconName ?? selectedPlugin.name) : '';
  const selectedDisabled = selectedPlugin?.enabled === false;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('plugins.pluginSelection')}
          title={
            selectedDisabled ? `${selectedLabel} (${t('plugins.pluginDisabled')})` : selectedLabel
          }
          className={cn(
            tabToolbarControlClass,
            'w-full min-w-0 justify-between gap-2.5 px-3 sm:w-auto sm:max-w-[20rem]',
            open && 'border-primary/50',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedIconKey && (
              <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                <span
                  className={cn(
                    'flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full',
                    selectedDisabled && 'opacity-75 grayscale-[30%]',
                  )}
                >
                  <PluginIcon
                    pluginName={selectedIconKey}
                    variant="avatar"
                    className="h-[22px] w-[22px]"
                  />
                </span>
                {selectedDisabled && (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-zinc-400 dark:bg-zinc-500"
                  />
                )}
              </span>
            )}
            <span className="min-w-0 truncate text-sm font-medium">{selectedLabel}</span>
          </span>

          <span className="flex shrink-0 items-center gap-1.5">
            {enableShortcut && (
              <kbd className="hidden h-5 items-center rounded-sm border border-border/75 bg-muted/65 px-1.5 font-sans text-[11px] font-medium text-muted-foreground sm:inline-flex">
                {shortcutLabel}
              </kbd>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 opacity-70 transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align={align}
        sideOffset={4}
        collisionPadding={12}
        className="glass-float searchable-menu-panel box-border flex w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden bg-transparent p-0 shadow-none"
        style={{ maxHeight: 'var(--radix-popper-available-height)' }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }}
        onWheel={(event) => event.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border/50 px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('plugins.searchPlugin')}
            aria-label={t('plugins.searchPlugin')}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:outline-none focus:ring-0"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label={t('common.clearCurrentValue')}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 p-3.5">
          {!trimmedQuery && recentItems.length > 0 && (
            <div className="flex shrink-0 flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">
                {t('plugins.recentPlugins')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {recentItems.map((item) => {
                  const isCurrent = item.id === value;
                  const iconKey = item.iconName ?? item.name;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.name}
                      onClick={() => handleSelectPlugin(item)}
                      className={cn(
                        'inline-flex h-8 max-w-[156px] min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isCurrent
                          ? 'border-primary/65 bg-primary/12 text-foreground'
                          : 'border-border/70 bg-muted/25 text-foreground/90 hover:border-primary/40 hover:bg-accent/65 hover:text-accent-foreground',
                      )}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                        <PluginIcon pluginName={iconKey} variant="avatar" className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              {trimmedQuery
                ? t('plugins.matchedPluginsCount', { count: filteredPlugins.length })
                : t('plugins.allPluginsCount', { count: orderedPlugins.length })}
            </div>

            {filteredPlugins.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('plugins.noMatchingPlugin')}
              </div>
            ) : (
              /* 不挂 role="listbox"，避免命中全局内陷深色菜单底板，直接以主题圆角大按钮平铺 */
              <div className="grid max-h-[304px] min-h-0 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {filteredPlugins.map((plugin, index) => {
                  const isSelected = plugin.id === value;
                  const isHighlighted = index === activeHighlightIndex;
                  const iconKey = plugin.iconName ?? plugin.name;
                  const isDisabledPlugin = plugin.enabled === false;

                  return (
                    <button
                      ref={(el) => {
                        cellRefs.current[index] = el;
                      }}
                      key={plugin.id}
                      type="button"
                      aria-pressed={isSelected}
                      title={
                        isDisabledPlugin
                          ? `${plugin.name} (${t('plugins.pluginDisabled')})`
                          : plugin.name
                      }
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => handleSelectPlugin(plugin)}
                      className={cn(
                        'group flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-left transition-colors duration-150 outline-none active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'border-primary/70 bg-primary/12 font-semibold text-foreground'
                          : isHighlighted
                            ? 'border-primary/45 bg-accent/70 text-accent-foreground'
                            : 'border-border/65 bg-muted/25 text-foreground/90 hover:border-primary/40 hover:bg-accent/65 hover:text-accent-foreground',
                      )}
                    >
                      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center overflow-hidden rounded-full',
                            isDisabledPlugin && !isSelected && 'opacity-70 grayscale-[30%]',
                          )}
                        >
                          <PluginIcon pluginName={iconKey} variant="avatar" className="h-7 w-7" />
                        </span>
                        {isDisabledPlugin && (
                          <span
                            aria-hidden
                            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-popover bg-zinc-400 dark:bg-zinc-500"
                          />
                        )}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-sm">{plugin.name}</span>

                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-border/50 bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1">
            <kbd className={KBD_KEY_CLASS}>↑</kbd>
            <kbd className={KBD_KEY_CLASS}>↓</kbd>
            <kbd className={KBD_KEY_CLASS}>←</kbd>
            <kbd className={KBD_KEY_CLASS}>→</kbd>
            <span className="ml-0.5">{t('plugins.kbdMove')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className={KBD_KEY_CLASS}>Enter</kbd>
            <span>{t('plugins.kbdSelect')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className={KBD_KEY_CLASS}>Esc</kbd>
            <span>{t('plugins.kbdClose')}</span>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** 保持现有调用方名称兼容，指向 Popover 网格插件选择器。 */
export const PluginUsageBar = PluginGridSelector;
