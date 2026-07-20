import * as React from 'react';
import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, Copy, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================================================
// 类型定义
// ============================================================================

export interface InputWithDropdownProps {
  /** 当前值（接受任意类型，内部统一转为字符串以保证健壮性） */
  value: unknown;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 下拉选项列表（接受任意类型元素，内部统一转为字符串） */
  options: ReadonlyArray<unknown>;
  /** 占位文本 */
  placeholder?: string;
  /** 输入框占位文本 */
  inputPlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义容器样式 */
  className?: string;
  /** Popover 宽度，默认 400px */
  popoverWidth?: string;
  /** 是否在弹出层显示当前值复制入口 */
  showCopyValueAction?: boolean;
  /** 复制按钮文案 */
  copyValueLabel?: string;
  /** 已复制按钮文案 */
  copiedValueLabel?: string;
  /** 无内容可复制时的文案 */
  copyEmptyLabel?: string;
  /** 是否在弹出层显示「清空当前值」入口（紧贴复制按钮右侧）。 */
  showClearValueAction?: boolean;
  /** 清空按钮的 tooltip / aria-label 文案 */
  clearValueLabel?: string;
  /**
   * 可选：用于把每个枚举值（如 `incremental`）映射成本地化标签。
   *
   * 仅影响 *显示层*：触发器文案 / 下拉候选项 / 搜索匹配都会使用这个函数
   * 的返回值；保存或回传时依旧是传入的原始 `value`，不会再走这里转换。
   * 不传则按原值渲染，保持向后兼容。
   */
  formatLabel?: (rawValue: string) => string;
}

// ============================================================================
// 组件定义
// ============================================================================

export function InputWithDropdown({
  value,
  onChange,
  options,
  placeholder = '选择或输入',
  inputPlaceholder = '输入或选择',
  disabled = false,
  className,
  popoverWidth = 'w-[400px]',
  showCopyValueAction = true,
  copyValueLabel,
  copiedValueLabel,
  copyEmptyLabel,
  showClearValueAction = true,
  clearValueLabel,
  formatLabel,
}: InputWithDropdownProps) {
  const { t } = useLanguage();
  // 搜索输入值（独立于选中值）
  const [searchValue, setSearchValue] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const resolvedCopyValueLabel = copyValueLabel ?? t('common.copyCurrentValue');
  const resolvedCopiedValueLabel = copiedValueLabel ?? t('common.copiedCurrentValue');
  const resolvedCopyEmptyLabel = copyEmptyLabel ?? t('common.copyEmptyValue');
  const resolvedClearValueLabel = clearValueLabel ?? t('common.clearCurrentValue');

  // 统一将 value 安全转为字符串，避免外部传入 number/boolean/object 等触发 .trim() 崩溃
  const safeValue = useMemo(() => (value == null ? '' : String(value)), [value]);
  // 统一将 options 全部转为字符串数组，避免 number 等元素触发 .toLowerCase() 崩溃
  const safeOptions = useMemo(
    () => (options || []).map((o) => (o == null ? '' : String(o))),
    [options],
  );
  // 把枚举原文渲染成本地化标签；缺失则原样返回
  const renderLabel = useCallback(
    (raw: string) => (formatLabel ? formatLabel(raw) : raw),
    [formatLabel],
  );

  // Popover 打开时重置搜索值
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) {
      setSearchValue('');
      setIsCopied(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // 根据搜索值筛选列表：同时匹配原文与本地化标签，避免输入中文/英文都失效
  const filteredOptions = useMemo(() => {
    if (!searchValue.trim()) return safeOptions;
    const lowerSearch = searchValue.toLowerCase();
    return safeOptions.filter((option) => {
      const rawMatch = option.toLowerCase().includes(lowerSearch);
      if (rawMatch) return true;
      const labelMatch = renderLabel(option).toLowerCase().includes(lowerSearch);
      return labelMatch;
    });
  }, [searchValue, safeOptions, renderLabel]);

  const handleOpenAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    // 延迟聚焦，确保 Popover 已完全渲染
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const copyTextToClipboard = useCallback(async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

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
  }, []);

  const handleCopyValue = useCallback(async () => {
    const text = safeValue.trim();
    if (!text) return;

    await copyTextToClipboard(text);
    setIsCopied(true);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setIsCopied(false), 1500);
  }, [copyTextToClipboard, safeValue]);

  // 清空当前值：直接 onChange('') + 关弹层 + 触发器会自然回到 placeholder
  // 无需与 useEffect on [open] 联动，那里已经会在关闭时清掉搜索/复制态。
  const handleClearValue = useCallback(() => {
    if (!safeValue.trim()) return;
    onChange('');
    setOpen(false);
  }, [onChange, safeValue]);

  const handleCommitInput = useCallback(() => {
    const nextValue = searchValue.trim();
    if (!nextValue) return;

    onChange(nextValue);
    setOpen(false);
  }, [onChange, searchValue]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitInput();
    }
  }, [handleCommitInput]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            'w-full justify-between text-left font-normal h-10 px-3',
            className
          )}
        >
          <span className="truncate">
            {safeValue ? (
              renderLabel(safeValue)
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(popoverWidth, 'p-0')}
        align="start"
        onOpenAutoFocus={handleOpenAutoFocus}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="space-y-2 p-2">
          {(showCopyValueAction || showClearValueAction) && (
            // 按钮组：复制（icon+文字，flex-1 占主）+ 清空（右侧 icon-only X）
            // 复制按钮全宽会让清空只能放到下一行，破坏「同排视觉关联」，
            // 因此这里用 flex 容器把两个独立按钮并排，按钮之间共享 hit area 但互不干扰。
            <div className="flex items-center gap-1">
              {showCopyValueAction && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 flex-1 justify-start gap-2 px-2 text-xs"
                  disabled={!safeValue.trim()}
                  onClick={handleCopyValue}
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="truncate">
                    {safeValue.trim() ? (isCopied ? resolvedCopiedValueLabel : resolvedCopyValueLabel) : resolvedCopyEmptyLabel}
                  </span>
                </Button>
              )}
              {showClearValueAction && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={!safeValue.trim()}
                  onClick={handleClearValue}
                  aria-label={resolvedClearValueLabel}
                  title={resolvedClearValueLabel}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <Input
            ref={inputRef}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={inputPlaceholder}
            className="h-9"
          />
        </div>
        {filteredOptions.length > 0 && (
          <div
            className="max-h-[360px] overflow-y-auto border-t"
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredOptions.map((option) => (
              <div
                key={option}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                  safeValue === option && 'bg-accent'
                )}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {renderLabel(option)}
              </div>
            ))}
          </div>
        )}
        {searchValue.trim() && filteredOptions.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground border-t">
            无匹配选项，按 Enter 使用当前输入
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
