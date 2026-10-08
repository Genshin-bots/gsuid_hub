import { useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';

export interface SearchableMenuItem {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  keywords?: string[];
}

interface SearchableMenuContentProps {
  items: SearchableMenuItem[];
  value?: string;
  onSelect: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}

/** 搜索 + 选项列表。打开后输入框自动聚焦。 */
export function SearchableMenuContent({
  items,
  value,
  onSelect,
  searchPlaceholder,
  emptyText,
}: SearchableMenuContentProps) {
  const { t } = useLanguage();

  return (
    <Command
      data-searchable-menu=""
      className="w-full min-w-0 [&_[cmdk-input-wrapper]]:h-8 [&_[cmdk-input-wrapper]]:gap-2 [&_[cmdk-input-wrapper]]:px-2.5 [&_[cmdk-input-wrapper]]:py-0 [&_[cmdk-input-wrapper]_svg]:mr-0"
    >
      <CommandInput
        placeholder={searchPlaceholder ?? t('common.search')}
        className="h-8 min-w-0 flex-1 px-2 py-0"
      />
      <CommandList className="max-h-72">
        <CommandEmpty>{emptyText ?? t('common.noMatches')}</CommandEmpty>
        <CommandGroup>
          {items.map((item) => {
            const selected = item.value === value;
            return (
              <CommandItem
                key={item.value}
                value={item.value}
                keywords={[item.label, ...(item.keywords ?? [])]}
                disabled={item.disabled}
                onSelect={() => onSelect(item.value)}
                className="min-w-0 cursor-pointer gap-2"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&>img]:h-4 [&>img]:w-4 [&>svg]:h-4 [&>svg]:w-4">
                  {item.icon ?? null}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0 text-primary',
                    selected ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function focusMenuSearch(panel: HTMLElement | null) {
  requestAnimationFrame(() => panel?.querySelector('input')?.focus());
}

interface SearchableMenuProps {
  items: SearchableMenuItem[];
  value?: string;
  onValueChange: (value: string) => void;
  /** outline：与页头线框按钮同色。field：与工具栏 Select 同色。 */
  appearance?: 'outline' | 'field';
  placeholder?: string;
  placeholderIcon?: ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  align?: 'start' | 'center' | 'end';
  /** trigger：菜单与按钮同宽。content：至少 16rem，按文案略撑开。 */
  width?: 'trigger' | 'content';
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  /** 自定义触发器（如分段按钮的 ▾）。不传则按 appearance 画按钮。 */
  trigger?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export function SearchableMenu({
  items,
  value,
  onValueChange,
  appearance = 'outline',
  placeholder,
  placeholderIcon,
  searchPlaceholder,
  emptyText,
  align = 'end',
  width = 'trigger',
  disabled,
  className,
  contentClassName,
  trigger: triggerNode,
  onOpenChange,
}: SearchableMenuProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = items.find((item) => item.value === value);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const trigger =
    appearance === 'field' ? (
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon ?? placeholderIcon}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        className={cn(
          'h-10 w-full min-w-0 justify-between gap-2 px-3 sm:w-[16rem]',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {selected?.icon ?? placeholderIcon}
          </span>
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild disabled={disabled}>
        {triggerNode ?? trigger}
      </PopoverTrigger>
      <PopoverContent
        ref={panelRef}
        align={align}
        className={cn(
          'box-border overflow-hidden p-0',
          width === 'content' && 'w-max min-w-[16rem] max-w-[24rem]',
          contentClassName,
        )}
        style={
          width === 'trigger' ? { width: 'var(--radix-popover-trigger-width)' } : undefined
        }
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusMenuSearch(panelRef.current);
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        <SearchableMenuContent
          items={items}
          value={value}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          onSelect={(next) => {
            onValueChange(next);
            setOpenState(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
