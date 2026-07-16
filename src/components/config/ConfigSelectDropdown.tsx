import { FileText, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState } from 'react';

export interface ConfigSelectItem {
  name: string;        // provider++name 格式，唯一标识
  provider: string;
  config_name: string; // 纯配置名，用于显示
  model_name: string;
}

interface ConfigSelectDropdownProps {
  items: ConfigSelectItem[];
  selectedName: string;
  onSelect: (name: string) => void;
  placeholder?: string;
  className?: string;
}

function getProviderLabel(provider: string): string {
  switch (provider) {
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic';
    case 'gemini': return 'Gemini';
    default: return provider;
  }
}

function getProviderBadgeClass(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'border-primary/40 text-primary bg-primary/10';
    case 'anthropic':
      return 'border-orange-500/40 text-orange-600 bg-orange-500/10';
    case 'gemini':
      return 'border-blue-500/40 text-blue-600 bg-blue-500/10';
    default:
      return 'border-border/60 text-muted-foreground bg-muted/30';
  }
}

export function ConfigSelectDropdown({
  items,
  selectedName,
  onSelect,
  placeholder = '选择配置…',
  className,
}: ConfigSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item) => item.name === selectedName);

  const handleSelect = (name: string) => {
    onSelect(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          tabIndex={0}
          className={cn(
            "flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 cursor-pointer",
            "border-primary/30 bg-primary/5",
            className,
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(!open);
            }
          }}
        >
          {selectedItem ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="text-primary flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block">{selectedItem.config_name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] h-4 px-1.5", getProviderBadgeClass(selectedItem.provider))}
                  >
                    {getProviderLabel(selectedItem.provider)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate">{selectedItem.model_name}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            </div>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-1"
        align="start"
        sideOffset={4}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="max-h-64 overflow-y-auto">
          <div className="space-y-0.5">
            {items.map((item) => {
              const isSelected = item.name === selectedName;
              return (
                <div
                  key={item.name}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer",
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => handleSelect(item.name)}
                >
                  <div className={cn(
                    "flex items-center justify-center flex-shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{item.config_name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-4 px-1.5", getProviderBadgeClass(item.provider))}
                      >
                        {getProviderLabel(item.provider)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">{item.model_name}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
