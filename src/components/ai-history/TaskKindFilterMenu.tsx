import { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Cpu, Layers, Search, Wrench, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { TASK_GROUP_ICON } from '@/lib/aiTaskKinds';
import {
  DEFAULT_ALL_FILTER,
  filterTaskSections,
  type TaskFilterModel,
  type TaskFilterOption,
  type TrFn,
} from './taskFilter';

function iconForOption(opt: TaskFilterOption): LucideIcon {
  return opt.isChild ? Wrench : (TASK_GROUP_ICON[opt.group] ?? Cpu);
}

export interface TaskKindFilterMenuProps {
  model: TaskFilterModel;
  value: string;
  onValueChange: (value: string) => void;
  tr: TrFn;
  className?: string;
}

/**
 * /ai-history 任务类型筛选下拉：
 * - 复用 /api/ai_task_models 的分组与能力代理父子层级，同时保留未登记来源兜底；
 * - 默认折叠 0 条日志的空分类，支持通过搜索框直达或底部开关展开全部。
 */
export function TaskKindFilterMenu({
  model,
  value,
  onValueChange,
  tr,
  className,
}: TaskKindFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const showEmptySwitchId = useId();

  const matchedOption = useMemo<TaskFilterOption | null>(() => {
    const found = model.optionByValue.get(value);
    if (found) return found;
    return !value || value === DEFAULT_ALL_FILTER ? model.allOption : null;
  }, [model, value]);

  const selectedOption = useMemo<TaskFilterOption>(() => {
    if (matchedOption) return matchedOption;
    const isTask = value.startsWith('task:');
    const rawId = value.replace(/^(?:task|unmapped|cb):/, '');
    const label = isTask ? tr(`aiConfig.taskModels.kinds.${rawId}.title`, rawId) : rawId;
    return {
      value,
      label,
      group: rawId === 'chat' ? 'conversation' : 'other',
      count: 0,
      keywords: [rawId, label],
    };
  }, [matchedOption, value, tr]);

  const filtered = useMemo(
    () => filterTaskSections(model.sections, value, query, showEmpty),
    [model.sections, value, query, showEmpty],
  );

  const queryTrimmed = query.trim().toLowerCase();
  const showAllRow =
    !queryTrimmed ||
    model.allOption.label.toLowerCase().includes(queryTrimmed) ||
    model.allOption.keywords.some((kw) => kw.toLowerCase().includes(queryTrimmed));

  const TriggerIcon = iconForOption(selectedOption);
  const triggerText = selectedOption.label || tr('aiHistory.filterTaskKind', '任务类型');

  const handleSelect = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery('');
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const firstMatch = filtered.sections[0]?.items[0]?.value;
    if (firstMatch) {
      event.preventDefault();
      handleSelect(firstMatch);
    } else if (showAllRow) {
      event.preventDefault();
      handleSelect(model.allOption.value);
    }
  };

  const showEmptyBar = !queryTrimmed && (filtered.hiddenEmptyCount > 0 || showEmpty);
  const emptyBadgeCount = showEmpty ? model.emptyTotalCount : filtered.hiddenEmptyCount;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={tr('aiHistory.filterTaskKind', '任务类型')}
          className={cn(
            'ui-select-trigger flex h-9 flex-1 min-w-0 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{triggerText}</span>
            {matchedOption && (
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                ({matchedOption.count})
              </span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="glass-float searchable-menu-panel w-[20rem] sm:w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden bg-transparent p-0 shadow-none flex flex-col"
        style={{ maxHeight: 'var(--radix-popper-available-height)' }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => searchInputRef.current?.focus());
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-border/40 px-2.5 py-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={tr('aiHistory.searchTaskPlaceholder', '搜索任务或能力代理…')}
            className="h-7 border-0 bg-transparent pl-7 pr-7 text-xs shadow-none focus-visible:ring-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-80 flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
          {showAllRow && (
            <button
              type="button"
              onClick={() => handleSelect(model.allOption.value)}
              data-active={value === model.allOption.value ? 'true' : undefined}
              className={cn(
                'menu-option flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                value === model.allOption.value
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'hover:bg-accent/60',
              )}
            >
              <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{model.allOption.label}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {model.allOption.count}
              </span>
              <Check
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  value === model.allOption.value ? 'opacity-100 text-primary' : 'opacity-0',
                )}
              />
            </button>
          )}

          {filtered.sections.map((section) => (
            <div key={section.id} className="pt-1 first:pt-0">
              <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isSelected = value === item.value;
                  const ItemIcon = iconForOption(item);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelect(item.value)}
                      data-active={isSelected ? 'true' : undefined}
                      title={item.sublabel ? `${item.label} (${item.sublabel})` : item.label}
                      className={cn(
                        'menu-option flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                        item.isChild && 'pl-3',
                        isSelected
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'hover:bg-accent/60',
                        item.count === 0 && !isSelected && 'text-muted-foreground/80',
                      )}
                    >
                      {item.isChild ? (
                        <span className="ml-1.5 h-3.5 w-2 shrink-0 border-l border-border/70" />
                      ) : (
                        <ItemIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="h-4 shrink-0 px-1 text-[10px] font-normal text-muted-foreground"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        {/* 带来源徽章的代理子项不在行内叠放 code，防单行拥挤（完整 code 见 title） */}
                        {!item.badge && item.sublabel && (
                          <span className="truncate text-[10px] text-muted-foreground/75">
                            {item.sublabel}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {item.count}
                      </span>
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          isSelected ? 'opacity-100 text-primary' : 'opacity-0',
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!showAllRow && !filtered.hasAnyVisible && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {tr('aiHistory.noMatchingTasks', '无匹配的任务类型')}
            </div>
          )}
        </div>

        {showEmptyBar && (
          <div className="flex items-center gap-2 border-t border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
            <Switch
              id={showEmptySwitchId}
              checked={showEmpty}
              onCheckedChange={setShowEmpty}
              className="scale-75 origin-left"
            />
            <label htmlFor={showEmptySwitchId} className="cursor-pointer select-none">
              {tr('aiHistory.showEmptyCategories', '显示空分类')} ({emptyBadgeCount})
            </label>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
