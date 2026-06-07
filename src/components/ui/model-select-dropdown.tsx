import * as React from 'react';
import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, Copy, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================================================
// 类型定义
// ============================================================================

type TabType = 'preset' | 'discovered';

export interface ModelSelectDropdownProps {
  /** 当前值 */
  value: unknown;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 后端预设模型列表 */
  presetOptions: ReadonlyArray<unknown>;
  /** 自动发现的模型列表 */
  discoveredModels: ReadonlyArray<unknown>;
  /** 是否正在获取模型列表 */
  isFetching?: boolean;
  /** 占位文本 */
  placeholder?: string;
  /** 输入框占位文本 */
  inputPlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义容器样式 */
  className?: string;
}

// ============================================================================
// 组件定义
// ============================================================================

export function ModelSelectDropdown({
  value,
  onChange,
  presetOptions,
  discoveredModels,
  isFetching = false,
  placeholder = '选择或输入',
  inputPlaceholder = '输入或选择',
  disabled = false,
  className,
}: ModelSelectDropdownProps) {
  const { t } = useLanguage();

  // 搜索输入值（独立于选中值）
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('preset');
  const [isCopied, setIsCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // 统一将 value 安全转为字符串
  const safeValue = useMemo(() => (value == null ? '' : String(value)), [value]);

  // 统一将选项转为字符串数组
  const safePresetOptions = useMemo(
    () => (presetOptions || []).map((o) => (o == null ? '' : String(o))).filter(Boolean),
    [presetOptions],
  );
  const safeDiscoveredModels = useMemo(
    () => (discoveredModels || []).map((o) => (o == null ? '' : String(o))).filter(Boolean),
    [discoveredModels],
  );

  // Popover 打开时重置搜索值；关闭时重置复制状态
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setSearchValue('');
    } else {
      setIsCopied(false);
    }
  }, [open]);

  // 根据搜索值分别筛选两个列表（互不影响）
  const lowerSearch = useMemo(
    () => searchValue.trim().toLowerCase(),
    [searchValue],
  );

  const presetFiltered = useMemo(() => {
    if (!lowerSearch) return safePresetOptions;
    return safePresetOptions.filter((o) => o.toLowerCase().includes(lowerSearch));
  }, [lowerSearch, safePresetOptions]);

  const discoveredFiltered = useMemo(() => {
    if (!lowerSearch) return safeDiscoveredModels;
    return safeDiscoveredModels.filter((o) => o.toLowerCase().includes(lowerSearch));
  }, [lowerSearch, safeDiscoveredModels]);

  // Popover 打开时自动聚焦输入框
  const handleOpenAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
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

  // 提交输入（按 Enter）
  const handleCommitInput = useCallback(() => {
    const nextValue = searchValue.trim();
    if (!nextValue) return;
    onChange(nextValue);
    setOpen(false);
  }, [onChange, searchValue]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommitInput();
      }
    },
    [handleCommitInput],
  );

  const tPreset = t('aiConfig.openaiConfig.presetList');
  const tDiscovered = t('aiConfig.openaiConfig.discoveredModels');
  const tNoDiscovered = t('aiConfig.openaiConfig.noDiscoveredModels');
  const tFetching = t('aiConfig.openaiConfig.fetchingModels');

  // 内联渲染一个选项列表（用于两个 Tab 共用，避免代码重复）
  const renderOption = useCallback(
    (option: string) => (
      <div
        key={option}
        className={cn(
          'px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors',
          safeValue === option && 'bg-accent',
        )}
        onClick={() => {
          onChange(option);
          setOpen(false);
        }}
      >
        {option}
      </div>
    ),
    [safeValue, onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            'w-full justify-between text-left font-normal h-10 px-3',
            className,
          )}
        >
          <span className="truncate">
            {safeValue || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        side="top"
        align="start"
        avoidCollisions={false}
        onOpenAutoFocus={handleOpenAutoFocus}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="space-y-2 p-2 shrink-0">
          {/* Tab 切换按钮 */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant={activeTab === 'preset' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'flex-1 text-xs h-8 transition-colors',
                activeTab === 'preset'
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('preset')}
            >
              {tPreset}
            </Button>
            <Button
              type="button"
              variant={activeTab === 'discovered' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'flex-1 text-xs h-8 transition-colors gap-1',
                activeTab === 'discovered'
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab('discovered')}
            >
              {tDiscovered}
              {isFetching && (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              )}
            </Button>
          </div>

          {/* 复制当前值 */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 px-2 text-xs"
            disabled={!safeValue.trim()}
            onClick={handleCopyValue}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="truncate">
              {safeValue.trim()
                ? (isCopied ? t('common.copiedCurrentValue') : t('common.copyCurrentValue'))
                : t('common.copyEmptyValue')}
            </span>
          </Button>

          <Input
            ref={inputRef}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={inputPlaceholder}
            className="h-9"
          />
        </div>

        {/*
          选项列表 —— 核心修复：
          外层容器固定高度 h-[220px]，内部两个列表层都 h-full。
          通过 hidden 切换显示哪个层，但 PopoverContent 的总高度
          永远等于顶部固定区 + 220px，Radix 不会再因内容变化而重算方向。
        */}
        <div className="h-[220px] border-t">
          {/* 预设列表层 —— 始终存在于 DOM，hidden 时只是不可见 */}
          <div
            className={cn(
              'h-full overflow-y-auto',
              activeTab !== 'preset' && 'hidden',
            )}
            onWheel={(e) => e.stopPropagation()}
          >
            {presetFiltered.length > 0 ? (
              presetFiltered.map(renderOption)
            ) : lowerSearch ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                无匹配选项，按 Enter 使用当前输入
              </div>
            ) : null}
          </div>

          {/* 模型发现层 —— 始终存在于 DOM，hidden 时只是不可见 */}
          <div
            className={cn(
              'h-full overflow-y-auto',
              activeTab !== 'discovered' && 'hidden',
            )}
            onWheel={(e) => e.stopPropagation()}
          >
            {isFetching && safeDiscoveredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mb-2" />
                {tFetching}
              </div>
            ) : safeDiscoveredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground">
                {tNoDiscovered}
              </div>
            ) : discoveredFiltered.length > 0 ? (
              discoveredFiltered.map(renderOption)
            ) : lowerSearch ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                无匹配选项，按 Enter 使用当前输入
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
