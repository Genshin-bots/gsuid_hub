import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
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

/**
 * 标签芯片。量尺行与可见行必须引用同一份，否则量出来的宽度对不上真实渲染宽度。
 * rounded-lg = var(--radius)，随主题圆角强度变化。
 * h-7：与 h-10 外壳内 6px 留白配套——h-6 芯片在框里上下各空 8px，整块显得空高。
 */
const TAG_CHIP =
  'flex items-center rounded-lg border gap-1 h-7 text-xs px-2.5 font-semibold shrink-0';

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
    ? listValue.filter((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    : listValue;

  // 判断输入是否在已添加列表中
  const isInAddedList =
    searchQuery.trim() && listValue.some((tag) => tag.toLowerCase() === searchQuery.toLowerCase());

  // 判断输入是否为新的自定义标签
  const canAddCustom = searchQuery.trim() && !listValue.includes(searchQuery.trim());

  // 过滤选项（排除已选中的，支持搜索）
  const filteredOptions =
    options?.filter(
      (opt) =>
        !listValue.includes(opt) &&
        (!searchQuery || opt.toLowerCase().includes(searchQuery.toLowerCase())),
    ) || [];

  // 可见胶囊数按真实像素算，不用固定常量估。
  // 胶囊宽度随文案长度变（群号 10 位 vs 昵称 2 字），常量估窄会多塞标签；标签轨再 flex-shrink-0 撑破容器，
  // 行级 overflow-hidden 就把尾部「更多」裁掉 —— 窄屏下永远点不到（P-28）。
  // 量尺行离屏渲染全部标签量真实宽度；尾部（+N 与「更多」）永不收缩，让位的是标签轨自己。
  const TAG_GAP = 8;
  const railRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ rail: 0, tailExtra: 0, badge: 0, widths: [] as number[] });

  // avail = 胶囊可用总宽 = rail 现宽 + 徽标在尾部的占位（tail - 更多按钮）。
  // rail 是 flex-1 让位后的剩余，徽标渲染时 rail 已被扣掉它——必须以「rail + 徽标占位」
  // 为不变量来算 fits，否则徽标被扣两次、平白少放一颗胶囊。
  const measure = useCallback(() => {
    const rail = railRef.current;
    const tail = tailRef.current;
    const more = moreBtnRef.current;
    const gauge = gaugeRef.current;
    const badge = badgeRef.current;
    const chips = gauge?.firstElementChild;
    if (!rail || !tail || !more || !chips || !badge) return;
    const widths = Array.from(chips.children, (el) => Math.round(el.getBoundingClientRect().width));
    const next = {
      rail: rail.clientWidth,
      tailExtra: Math.round(
        tail.getBoundingClientRect().width - more.getBoundingClientRect().width,
      ),
      badge: Math.round(badge.getBoundingClientRect().width),
      widths,
    };
    setMetrics((prev) => {
      const same =
        prev.rail === next.rail &&
        prev.tailExtra === next.tailExtra &&
        prev.badge === next.badge &&
        prev.widths.length === widths.length &&
        prev.widths.every((w, i) => w === widths[i]);
      return same ? prev : next;
    });
  }, []);

  // 无依赖：每次渲染后同步一次几何。相同值原样返回 prev，React 会跳过重渲染，不会自激。
  useLayoutEffect(measure);

  // 收起侧边栏 / 窗口缩放 / 父级网格变宽这类不改 React 树的尺寸变化，靠 RO 补量尺，
  // 否则 rail 变了而 metrics 还是旧值，胶囊数不跟着长。
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(rail);
    return () => observer.disconnect();
  }, [measure]);

  const fitCount = (total: number): number => {
    let used = 0;
    let n = 0;
    for (let i = 0; i < listValue.length; i++) {
      const w = metrics.widths[i];
      if (!w) break;
      const need = (i > 0 ? TAG_GAP : 0) + w;
      if (used + need > total) break;
      used += need;
      n++;
    }
    return n;
  };
  // 先试「不出徽标」；放不下才按徽标占位重算（徽标已渲染就用真实占位，没渲染按 +9999 量尺
  // 兜底，免得和「徽标出没出现」互为因果来回换 k）。只放得下部分胶囊时，最后一个必定完整。
  // 徽标占位大到一颗都挤不下时，宁可完整放出不带徽标的胶囊，也不让行里只剩 +N。
  const avail = metrics.rail + metrics.tailExtra;
  const reserve = metrics.tailExtra > 0 ? metrics.tailExtra : metrics.badge + 6;
  const withoutBadge = fitCount(avail);
  let visibleCount: number;
  let showBadge = false;
  if (withoutBadge >= listValue.length) {
    visibleCount = listValue.length;
  } else {
    const withBadge = fitCount(avail - reserve);
    if (withBadge > 0) {
      visibleCount = withBadge;
      showBadge = true;
    } else {
      visibleCount = Math.max(withoutBadge, Math.min(1, listValue.length));
    }
  }
  const visibleTags = listValue.slice(0, visibleCount);
  const hiddenCount = listValue.length - visibleCount;

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
    <div
      data-disabled={disabled || undefined}
      className={cn(
        // 与 Select/Input 共用同一套主题字段外观：背景、模糊、描边、圆角都由 .ui-input 驱动
        'ui-input relative h-10 w-full overflow-hidden',
        disabled && 'opacity-60',
      )}
    >
      {/* 量尺行：离屏渲染全部标签量真实宽度，不占布局也不可见。
          「+9999」徽标是预留宽度用的量尺，实际徽标比它窄 */}
      <div
        ref={gaugeRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 w-max flex items-center gap-2"
      >
        <div className="flex items-center gap-2">
          {listValue.map((item) => (
            <div key={item} className={cn(TAG_CHIP, 'text-secondary-foreground')}>
              <span className="truncate max-w-[80px]">{truncateToWidth(item, 10)}</span>
              <X className="w-3 h-3 shrink-0" />
            </div>
          ))}
        </div>
        <div
          ref={badgeRef}
          className={cn(TAG_CHIP, 'border-transparent bg-primary/20 text-primary')}
        >
          +9999
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 h-full">
        {/* 标签轨：可收缩 + 自裁。放不下就让位，绝不把尾部顶出可视区 */}
        <div ref={railRef} className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {visibleTags.map((item, index) => (
            <div
              key={item}
              className={cn(
                TAG_CHIP,
                // 保底那颗胶囊允许收缩截断（轨道比它窄时显示半个词也比只有 +N 强）；
                // 正常情况下按量尺放宽、不会触发收缩
                'min-w-0 shrink text-secondary-foreground backdrop-blur-sm transition-colors',
                disabled
                  ? 'bg-muted/40 border-dashed opacity-60'
                  : 'border-transparent bg-secondary/30 hover:bg-secondary/50',
              )}
            >
              <span className="truncate max-w-[80px]">{truncateToWidth(item, 10)}</span>
              <button
                onClick={() => handleRemoveTag(index)}
                className="hover:text-destructive shrink-0 disabled:pointer-events-none disabled:opacity-40"
                disabled={disabled}
                title={t('tagsInput.delete')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* 尾部：+N 与「更多」永不收缩，窄屏也始终完整可点 */}
        <div ref={tailRef} className="flex items-center gap-1.5 shrink-0">
          {showBadge && hiddenCount > 0 && (
            <div
              className={cn(
                TAG_CHIP,
                disabled
                  ? 'border-dashed border-border/60 bg-muted/40 text-secondary-foreground opacity-60'
                  : 'border-transparent bg-primary/20 text-primary',
              )}
            >
              +{hiddenCount}
            </div>
          )}
          {/* 更多按钮 - 点击打开下拉框；窄屏收成 + 图标，给胶囊腾宽度 */}
          <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <Button
                ref={moreBtnRef}
                type="button"
                variant="ghost"
                size="sm"
                title={t('tagsInput.more')}
                className={cn(
                  // size="sm" 给的是 h-9 / rounded-md / 16px 图标，这里要和标签芯片同高，圆角跟主题
                  'h-7 rounded-lg px-2.5 gap-1 text-xs font-semibold [&_svg]:size-3',
                  disabled
                    ? 'bg-muted/40 text-secondary-foreground hover:bg-muted/40'
                    : 'bg-primary/20 text-primary hover:bg-primary/30',
                )}
                disabled={disabled}
              >
                <Plus className="w-3 h-3" />
                <span className="hidden md:inline">{t('tagsInput.more')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 p-0 flex flex-col overflow-hidden"
              style={{ maxHeight: 'var(--radix-popper-available-height)' }}
              side="bottom"
              align="start"
              sideOffset={4}
              collisionPadding={8}
            >
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
                      'flex-1 bg-transparent border-0 outline-none text-sm pl-2',
                      searchQuery ? 'text-foreground' : 'placeholder:text-muted-foreground',
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
                      : t('tagsInput.noTags')}
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
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 hover:bg-accent rounded"
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
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 hover:bg-accent rounded hover:text-destructive"
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
                    <span className="text-sm font-medium text-muted-foreground">
                      {t('tagsInput.optionalTags')}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredOptions.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2 text-center">
                        {searchQuery
                          ? t('tagsInput.noOptionMatch')
                          : t('tagsInput.allOptionsAdded')}
                      </div>
                    ) : (
                      filteredOptions.map((opt) => (
                        <div
                          key={opt}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                          onMouseDown={(e) => {
                            // 阻止焦点离开搜索框，否则 Popover 会当成点到外面而收起
                            e.preventDefault();
                          }}
                          onClick={() => handleAddTag(opt)}
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
