import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Plus, Copy, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface TagsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  options?: string[];
}

export const TagsInput: React.FC<TagsInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  options,
}: TagsInputProps) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverInputRef = useRef<HTMLInputElement>(null);

  const listValue = Array.isArray(value) ? value : [];

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !listValue.includes(trimmed)) {
      onChange([...listValue, trimmed]);
    }
    setSearchQuery('');
  };

  const handleRemoveTag = (index: number) => {
    onChange(listValue.filter((_, i) => i !== index));
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (HTTP on public network)
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) {
          throw new Error('execCommand copy failed');
        }
      }
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 截断文本到指定宽度（中文字符宽度为1，其他字符宽度为0.5）
  const truncateToWidth = (text: string, maxWidth: number = 12): string => {
    const chineseRegex = /[\u4e00-\u9fa5]/g;
    const chineseCount = (text.match(chineseRegex) || []).length;
    const otherCount = text.length - chineseCount;
    const totalWidth = chineseCount + otherCount * 0.5;
    
    if (totalWidth <= maxWidth) return text;
    
    let result = '';
    let currentWidth = 0;
    for (const char of text) {
      const charWidth = chineseRegex.test(char) ? 1 : 0.5;
      if (currentWidth + charWidth > maxWidth) break;
      result += char;
      currentWidth += charWidth;
    }
    return result + '...';
  };

  // 过滤已添加的标签（支持搜索）
  const filteredAddedTags = searchQuery
    ? listValue.filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    : listValue;

  // 判断输入是否在已添加列表中
  const isInAddedList = searchQuery.trim() && listValue.some(
    tag => tag.toLowerCase() === searchQuery.toLowerCase()
  );

  // 判断输入是否为新的自定义标签
  const canAddCustom = searchQuery.trim() && !listValue.includes(searchQuery.trim());

  // 过滤选项（排除已选中的，支持搜索）
  const filteredOptions = options?.filter(opt =>
    !listValue.includes(opt) &&
    (!searchQuery || opt.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  // 动态计算能显示的标签数量
  const TAG_WIDTH = 80;
  const INPUT_WIDTH = 120;
  const PADDING = 24;
  const GAP = 8;
  const CONTAINER_MIN_WIDTH = 200;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(CONTAINER_MIN_WIDTH);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const EXTRA_WIDTH = 50;
  const BUFFER = 10;
  const availableWidth = containerWidth - INPUT_WIDTH - PADDING - EXTRA_WIDTH - BUFFER;
  const maxVisibleTags = Math.max(0, Math.floor(availableWidth / (TAG_WIDTH + GAP)));
  const visibleTags = listValue.slice(0, maxVisibleTags > 0 ? maxVisibleTags : 0);
  const hiddenCount = Math.max(0, listValue.length - maxVisibleTags);

  // 打开 Popover 时聚焦到输入框
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTimeout(() => popoverInputRef.current?.focus(), 0);
    } else {
      setSearchQuery('');
    }
  };

  return (
    <div ref={containerRef} className="border rounded-md bg-background/30 backdrop-blur-sm h-10 w-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-full overflow-hidden">
        {/* 已添加的标签列表 - 固定宽度，超出显示 +N */}
        <div className="flex items-center gap-2 overflow-hidden flex-shrink-0">
          {visibleTags.map((item, index) => (
            <div
              key={index}
              className="flex items-center rounded-full border border-transparent bg-secondary/30 text-secondary-foreground hover:bg-secondary/50 backdrop-blur-sm gap-1 h-6 text-xs px-2.5 py-0.5 font-semibold transition-colors shrink-0"
            >
              <span className="truncate max-w-[80px]">
                {truncateToWidth(item, 10)}
              </span>
              <button
                onClick={() => handleRemoveTag(index)}
                className="hover:text-destructive shrink-0 flex-shrink-0"
                disabled={disabled}
                title="删除"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="flex items-center rounded-full border border-transparent bg-primary/20 text-primary gap-1 h-6 text-xs px-2.5 py-0.5 font-semibold shrink-0">
              +{hiddenCount}
            </div>
          )}
        </div>

        {/* 更多按钮 - 点击打开下拉框 */}
        <div className="flex items-center gap-1 flex-1 min-w-[50px] shrink-0">
          <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs bg-primary/20 text-primary hover:bg-primary/30"
                disabled={disabled}
              >
                <Plus className="w-3 h-3 mr-1" />
                {t('tagsInput.more')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              {/* 搜索/输入框 */}
              <div className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    ref={popoverInputRef}
                    type="text"
                    placeholder={
                      canAddCustom
                        ? `"${searchQuery}" - ${t('tagsInput.enterToAdd')}`
                        : isInAddedList
                          ? t('tagsInput.alreadyAdded')
                          : t('tagsInput.searchAdded')
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        e.preventDefault();
                        if (canAddCustom) {
                          handleAddTag(searchQuery);
                          setIsOpen(false);
                        }
                      }
                    }}
                    className={cn(
                      "flex-1 bg-transparent border-0 outline-none text-sm pl-2",
                      searchQuery ? "text-foreground" : "placeholder:text-muted-foreground"
                    )}
                  />
                </div>
              </div>

              {/* 已添加的标签列表 */}
              <div className="p-3 border-b">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  {t('tagsInput.addedTags')} ({filteredAddedTags.length}/{listValue.length})
                </div>
                {filteredAddedTags.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    {searchQuery
                      ? isInAddedList
                        ? `"${searchQuery}" ${t('tagsInput.alreadyAddedTop')}`
                        : t('tagsInput.noMatch')
                      : t('tagsInput.noTags')
                    }
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredAddedTags.map((item, index) => {
                      const originalIndex = listValue.indexOf(item);
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent group"
                        >
                          <span className="flex-1 truncate text-sm">{item}</span>
                          <button
                            onClick={() => handleCopy(item, originalIndex)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
                            title={t('tagsInput.copy')}
                          >
                            {copiedIndex === originalIndex ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveTag(originalIndex)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded hover:text-destructive"
                            title={t('tagsInput.delete')}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 可选标签列表 */}
              {options && options.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{t('tagsInput.optionalTags')}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredOptions.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2 text-center">
                        {searchQuery ? t('tagsInput.noOptionMatch') : t('tagsInput.allOptionsAdded')}
                      </div>
                    ) : (
                      filteredOptions.map((opt) => (
                        <div
                          key={opt}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => {
                            handleAddTag(opt);
                            setIsOpen(false);
                          }}
                        >
                          <span className="flex-1 truncate text-sm">{opt}</span>
                          <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};
