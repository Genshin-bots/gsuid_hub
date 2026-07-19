import { FileText, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ModelBrandIcon,
  ProviderBrandIcon,
} from '@/components/ui/model-brand-icon';
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

/**
 * 配置文件前的「文件 ICON」—— 根据 `model_name` 自动匹配厂商 Logo。
 * 如果匹配不到，回退到 lucide `FileText`（与原行为一致）。
 */
function ConfigFileIcon({
  modelName,
  provider,
  className,
}: {
  modelName: string;
  provider: string;
  className?: string;
}) {
  const matched = modelName?.trim();
  if (!matched) {
    return <FileText className={className} />;
  }
  // 用 modelName 决定厂商；如果匹配不到任何规则，resolveBrandRule 会回退
  // 到 provider 对应的通用图标，而不是 lucide 的 FallbackBrandIcon。
  // 这里如果仍想保底展示一个「文件」造型，就走 FallbackBrandIcon 之外的 FileText。
  return (
    <ModelBrandIcon
      modelName={matched}
      provider={provider}
      size={20}
      className={className}
    />
  );
}

/**
 * 通用「文件占位」—— 用于下拉框未选择项时的展示，避免空白。
 */
function PlaceholderFileIcon({ className }: { className?: string }) {
  return <FileText className={className} />;
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
                <ConfigFileIcon
                  modelName={selectedItem.model_name}
                  provider={selectedItem.provider}
                  className="w-5 h-5"
                />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block">{selectedItem.config_name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] h-4 px-1.5 gap-1", getProviderBadgeClass(selectedItem.provider))}
                  >
                    <ProviderBrandIcon
                      provider={selectedItem.provider}
                      size={10}
                      className="shrink-0"
                    />
                    {getProviderLabel(selectedItem.provider)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate">{selectedItem.model_name}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground flex items-center justify-center flex-shrink-0">
                <PlaceholderFileIcon className="w-5 h-5" />
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
                    <ConfigFileIcon
                      modelName={item.model_name}
                      provider={item.provider}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{item.config_name}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-4 px-1.5 gap-1", getProviderBadgeClass(item.provider))}
                      >
                        <ProviderBrandIcon
                          provider={item.provider}
                          size={10}
                          className="shrink-0"
                        />
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
