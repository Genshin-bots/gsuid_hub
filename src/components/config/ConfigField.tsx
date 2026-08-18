import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MarkdownTooltip } from './MarkdownTooltip';
import { TimePicker } from '@/components/ui/time-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from '@/components/ui/separator';
import {
  CalendarIcon, X, Upload, HelpCircle, Bell, CreditCard, Settings,
  Clock, Cog, MessageSquare, Image, Shield, Database, Zap, Key, Loader2,
  ChevronDown, Eye, FileText, Files, Palette, AlertCircle, Minus,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { assetsApi, PluginConfigItem } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { TagsInput } from './TagsInput';
import { SecretInput } from './SecretInput';

// 根据 title 关键词匹配图标
const getTitleIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('推送') || lowerTitle.includes('通知') || lowerTitle.includes('消息')) {
    return <Bell className="w-4 h-4" />;
  }
  if (lowerTitle.includes('支付') || lowerTitle.includes('付费') || lowerTitle.includes('购买')) {
    return <CreditCard className="w-4 h-4" />;
  }
  if (lowerTitle.includes('模式')) {
    return <Settings className="w-4 h-4" />;
  }
  if (lowerTitle.includes('定时') || lowerTitle.includes('时间') || lowerTitle.includes('调度')) {
    return <Clock className="w-4 h-4" />;
  }
  if (lowerTitle.includes('安全') || lowerTitle.includes('验证') || lowerTitle.includes('权限')) {
    return <Shield className="w-4 h-4" />;
  }
  if (lowerTitle.includes('数据库') || lowerTitle.includes('存储')) {
    return <Database className="w-4 h-4" />;
  }
  if (lowerTitle.includes('图片') || lowerTitle.includes('图像')) {
    return <Image className="w-4 h-4" />;
  }
  if (lowerTitle.includes('ключ') || lowerTitle.includes('api') || lowerTitle.includes('key')) {
    return <Key className="w-4 h-4" />;
  }
  if (lowerTitle.includes('消息') || lowerTitle.includes('回复')) {
    return <MessageSquare className="w-4 h-4" />;
  }
  if (lowerTitle.includes('性能') || lowerTitle.includes('优化')) {
    return <Zap className="w-4 h-4" />;
  }
  
  // 默认图标
  return <Cog className="w-4 h-4" />;
};

// 判断字段是否应被视为 secret（启发式检测）
function isSecretField(field: ConfigFieldDefinition): boolean {
  return !!field.secret;
}

// #TODO: Replace with actual API types
export type ConfigFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'strictselect'
  | 'multiselect'
  | 'list'
  | 'tags'
  | 'date'
  | 'time'
  | 'email'
  | 'url'
  | 'image'
  | 'password'
  | 'divider'
  | 'color'
  | 'fileupload'
  | 'filesupload'
  | 'timerange'
  | 'repeatgroup';

export type ConfigValue = string | number | boolean | string[] | [number, number] | [[number, number], [number, number]] | null;

export interface ConfigFieldDefinition {
  type: ConfigFieldType;
  label: string;
  value: ConfigValue;
  options?: string[];
  // strictselect 专用：把枚举原值映射成展示标签（如 zh-cn -> 简体中文），保存仍用原值
  optionLabels?: Record<string, string>;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  upload_to?: string;
  filename?: string;
  suffix?: string;
  // 新增字段
  secret?: boolean;
  regex?: string;
  min_value?: number;
  max_value?: number;
  rawType?: string; // 原始后端类型标识，用于保存时的类型转换
  // gsrepeatgroup 专用：子字段描述(供 RepeatGroupField 渲染)
  template?: Record<string, PluginConfigItem>;
}

interface ConfigFieldProps {
  fieldKey: string;
  field: ConfigFieldDefinition;
  onChange: (key: string, value: ConfigValue) => void;
  showLabel?: boolean;
  className?: string;
}

export function ConfigField({
  fieldKey,
  field,
  onChange,
  showLabel = true,
  className
}: ConfigFieldProps) {
  const { t } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const value = field.value;
  
  // 是否为密钥字段（仅由后端 secret 属性决定）
  const isSecret = isSecretField(field);

  // regex 校验状态
  const [regexError, setRegexError] = useState<string | null>(null);
  
  // 图片删除确认对话框状态
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 防御性转为字符串，避免后端返回非 string 类型时 .includes('.') 崩溃
  const labelText = field.label == null ? '' : String(field.label);
  const placeholderText = field.placeholder == null ? '' : String(field.placeholder);
  const descriptionText = field.description == null ? '' : String(field.description);

  // Translate label if it's an i18n key (contains a dot), otherwise use as-is
  const displayLabel = labelText.includes('.') ? t(labelText) : labelText;
  const displayPlaceholder = placeholderText ? (placeholderText.includes('.') ? t(placeholderText) : placeholderText) : placeholderText;
  const displayDescription = descriptionText ? (descriptionText.includes('.') ? t(descriptionText) : descriptionText) : descriptionText;

  // regex 校验
  const validateRegex = (val: string) => {
    if (!field.regex) {
      setRegexError(null);
      return true;
    }
    try {
      const re = new RegExp(field.regex);
      if (!re.test(val)) {
        setRegexError(`输入不符合格式要求`);
        return false;
      }
      setRegexError(null);
      return true;
    } catch {
      setRegexError(null);
      return true;
    }
  };

  useEffect(() => {
    if (field.regex && typeof value === 'string') {
      validateRegex(value);
    } else {
      setRegexError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.regex, value]);

  const isDividerField = field.type === 'divider';

  // ============================================================
  // 密码/secret 输入框（带眼睛切换；不用 type=password，避免浏览器自动填充）
  // ============================================================
  const renderSecretInput = () => {
    return (
      <SecretInput
        value={String(value ?? '')}
        onChange={(val) => {
          onChange(fieldKey, val);
          if (field.regex) validateRegex(val);
        }}
        placeholder={displayPlaceholder || `输入${displayLabel}`}
        disabled={field.disabled}
        className={cn(regexError && "border-destructive focus-visible:ring-destructive")}
      />
    );
  };

  // ============================================================
  // 主渲染
  // ============================================================
  const renderField = () => {
    // Divider 类型
    if (field.type === 'divider') {
      // 分割线标题：优先用后端提供的 value；value 为空(如 "")时回退到 title(label)，
      // 两者都为空才渲染纯分割线
      const dividerTitle =
        typeof value === 'string' && value ? value : displayLabel || null;
      if (dividerTitle) {
        // 带标题的分割线：标题样式突出
        return (
          <div className="flex items-center gap-3 w-full pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary rounded-full" />
              <h4 className="text-base font-bold text-foreground whitespace-nowrap tracking-wide">
                {dividerTitle}
              </h4>
            </div>
            <Separator className="flex-1" />
          </div>
        );
      }
      // 无标题的纯分割线
      return (
        <div className="flex items-center w-full py-2">
          <Separator className="flex-1" />
        </div>
      );
    }

    switch (field.type) {
      // ----------------------------------------------------------
      // 文本类：text / email / url / password
      // ----------------------------------------------------------
      case 'text':
      case 'email':
      case 'url':
      case 'password':
        if (isSecret || field.type === 'password') {
          return renderSecretInput();
        }
        return (
          <div className="relative">
            <Input
              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
              value={value as string}
              onChange={(e) => {
                onChange(fieldKey, e.target.value);
                if (field.regex) validateRegex(e.target.value);
              }}
              placeholder={displayPlaceholder || `输入${displayLabel}`}
              disabled={field.disabled}
              className={cn(
                "bg-background h-10",
                regexError && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {regexError && (
              <div className="absolute -bottom-5 left-0 flex items-center gap-1 text-destructive text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>{regexError}</span>
              </div>
            )}
          </div>
        );

      // ----------------------------------------------------------
      // 数字
      // ----------------------------------------------------------
      case 'number': {
        const numValue = value as number;
        const increment = () => {
          const next = (numValue || 0) + 1;
          if (field.max_value !== undefined && next > field.max_value) return;
          onChange(fieldKey, next);
        };
        const decrement = () => {
          const next = (numValue || 0) - 1;
          if (field.min_value !== undefined && next < field.min_value) return;
          onChange(fieldKey, next);
        };
        return (
          <div className="relative">
            <Input
              type="number"
              value={numValue}
              step="any"
              onChange={(e) => {
                let val = Number(e.target.value);
                if (field.min_value !== undefined && val < field.min_value) val = field.min_value;
                if (field.max_value !== undefined && val > field.max_value) val = field.max_value;
                onChange(fieldKey, val);
              }}
              placeholder={displayPlaceholder}
              disabled={field.disabled}
              min={field.min_value}
              max={field.max_value}
              className="bg-background h-10 pr-10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <div className="absolute right-0 top-0 h-full w-8 flex flex-col">
              <button
                onClick={increment}
                disabled={field.disabled}
                className="flex-1 flex items-center justify-center hover:bg-accent rounded-tr-md border-b border-border/50 text-muted-foreground opacity-60 hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3 w-3 rotate-180 -mt-0.5" />
              </button>
              <button
                onClick={decrement}
                disabled={field.disabled}
                className="flex-1 flex items-center justify-center hover:bg-accent rounded-br-md text-muted-foreground opacity-60 hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3 w-3 -mt-0.5" />
              </button>
            </div>
          </div>
        );
      }

      // ----------------------------------------------------------
      // 布尔开关
      // ----------------------------------------------------------
      case 'boolean':
        return (
          <div className="h-10 flex items-center">
            <Switch
              checked={value as boolean}
              onCheckedChange={(checked) => onChange(fieldKey, checked)}
              disabled={field.disabled}
            />
          </div>
        );

      // ----------------------------------------------------------
      // 下拉选择
      // ----------------------------------------------------------
      case 'select':
        if (field.options && field.options.length > 0) {
          return (
            <InputWithDropdown
              value={String(value ?? '')}
              onChange={(val) => onChange(fieldKey, val)}
              options={field.options}
              placeholder={displayPlaceholder || '请选择'}
              inputPlaceholder={displayPlaceholder || '请输入或选择'}
              disabled={field.disabled}
            />
          );
        }
        return (
          <Input
            value={String(value ?? '')}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            placeholder={displayPlaceholder || `输入${displayLabel}`}
            disabled={field.disabled}
            className="bg-background h-10"
          />
        );

      // ----------------------------------------------------------
      // 严格下拉：只能选 options 中的值，不允许自由输入
      // ----------------------------------------------------------
      case 'strictselect':
        return (
          <Select
            value={String(value ?? '')}
            onValueChange={(val) => onChange(fieldKey, val)}
            disabled={field.disabled}
          >
            <SelectTrigger className="bg-background h-10">
              <SelectValue placeholder={displayPlaceholder || t('common.pleaseSelect')} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {field.optionLabels?.[option] ?? option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      // ----------------------------------------------------------
      // 多选标签
      // ----------------------------------------------------------
      case 'multiselect':
        return (
          <TagsInput
            value={Array.isArray(value) && value.every(v => typeof v === 'string') ? value as string[] : []}
            onChange={(newValue) => onChange(fieldKey, newValue)}
            placeholder={displayPlaceholder || '输入并回车添加...'}
            disabled={field.disabled}
            options={field.options}
          />
        );

      // ----------------------------------------------------------
      // 日期选择器
      // ----------------------------------------------------------
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-full justify-start text-left bg-background h-10",
                  !value && "text-muted-foreground"
                )}
                disabled={field.disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value as string), 'PPP', { locale: zhCN }) : '选择日期'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={value ? new Date(value as string) : undefined}
                onSelect={(date) =>
                  onChange(fieldKey, date?.toISOString().split('T')[0] || '')
                }
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        );

      // ----------------------------------------------------------
      // 时间选择器（单个时间点）
      // ----------------------------------------------------------
      case 'time':
        return (
          <TimePicker
            value={value as string | [number, number]}
            onChange={(val) => onChange(fieldKey, val)}
            disabled={field.disabled}
          />
        );

      // ----------------------------------------------------------
      // 时间范围选择器（两个 TimePicker 组合）
      // ----------------------------------------------------------
      case 'timerange': {
        const timeRange = (Array.isArray(value) && value.length === 2) 
          ? value as [[number, number], [number, number]]
          : [[0, 0], [23, 59]] as [[number, number], [number, number]];
        
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TimePicker
                value={timeRange[0]}
                onChange={(val) => onChange(fieldKey, [val, timeRange[1]])}
                disabled={field.disabled}
              />
            </div>
            <span className="text-muted-foreground text-sm shrink-0 px-1">至</span>
            <div className="flex-1">
              <TimePicker
                value={timeRange[1]}
                onChange={(val) => onChange(fieldKey, [timeRange[0], val])}
                disabled={field.disabled}
              />
            </div>
          </div>
        );
      }

      // ----------------------------------------------------------
      // 标签输入
      // ----------------------------------------------------------
      case 'list':
      case 'tags':
        return (
          <TagsInput
            value={Array.isArray(value) && value.every(v => typeof v === 'string') ? value as string[] : []}
            onChange={(newValue) => onChange(fieldKey, newValue)}
            placeholder={displayPlaceholder}
            disabled={field.disabled}
          />
        );

      // ----------------------------------------------------------
      // 颜色选择器（主题化 Popover）
      // ----------------------------------------------------------
      case 'color': {
        const hexValue = (typeof value === 'string' && value) ? value : '#000000';
        const displayColor = hexValue.length >= 7 ? hexValue.substring(0, 7) : hexValue;

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left bg-background h-10 gap-2"
                disabled={field.disabled}
              >
                <div
                  className="w-5 h-5 rounded border border-border/50 shrink-0"
                  style={{ backgroundColor: displayColor }}
                />
                <span className="font-mono text-sm">{hexValue}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border border-border/50 shadow-inner"
                  style={{ backgroundColor: displayColor }}
                />
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">HEX 颜色值</Label>
                  <Input
                    type="text"
                    value={hexValue}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith('#')) val = '#' + val;
                      onChange(fieldKey, val);
                    }}
                    placeholder="#RRGGBB"
                    disabled={field.disabled}
                    className="bg-background h-9 font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">拾色器</Label>
                <input
                  type="color"
                  value={displayColor}
                  onChange={(e) => onChange(fieldKey, e.target.value)}
                  disabled={field.disabled}
                  className="w-full h-10 rounded-md border border-border cursor-pointer bg-transparent p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
                />
              </div>
            </PopoverContent>
          </Popover>
        );
      }

      // ----------------------------------------------------------
      // 文件上传（紧凑单行布局，与其他 input 框高度一致）
      // ----------------------------------------------------------
      case 'fileupload':
      case 'filesupload': {
        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          
          setIsUploading(true);
          try {
            if (field.type === 'filesupload') {
              const paths: string[] = [];
              for (let i = 0; i < files.length; i++) {
                const data = await assetsApi.upload(files[i], value as string || field.upload_to);
                paths.push(data.path);
              }
              onChange(fieldKey, paths.length > 0 ? (value as string || field.upload_to) : '');
              toast.success(`${files.length} 个文件已上传`);
            } else {
              const targetFilename = field.filename && field.suffix ? `${field.filename}.${field.suffix}` : undefined;
              const data = await assetsApi.upload(files[0], field.upload_to, targetFilename);
              onChange(fieldKey, data.path);
              toast.success("文件已上传并更新配置");
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "上传失败");
          } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };

        const isMultiple = field.type === 'filesupload';
        const acceptSuffix = field.suffix ? `.${field.suffix}` : undefined;

        return (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept={acceptSuffix}
              multiple={isMultiple}
              onChange={handleFileChange}
              disabled={field.disabled || isUploading}
            />
            <Button
              variant="outline"
              className="w-full h-10 gap-2 justify-start text-left font-normal"
              disabled={field.disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : isMultiple ? (
                <Files className="w-4 h-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("truncate flex-1", !value && "text-muted-foreground")}>
                {isUploading ? "正在上传..." : value ? String(value) : (isMultiple ? "上传文件（批量）" : "上传文件")}
              </span>
              {value && !isUploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); onChange(fieldKey, ''); }}
                  className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors shrink-0"
                  disabled={field.disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {!isUploading && <Upload className="w-4 h-4 shrink-0 text-muted-foreground" />}
            </Button>
          </>
        );
      }

      // ----------------------------------------------------------
      // 图片上传
      // ----------------------------------------------------------
      // 图片上传（紧凑单行布局）
      // ----------------------------------------------------------
      case 'image': {
        const previewUrl = assetsApi.getPreviewUrl(value as string);
        
        const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          
          setIsUploading(true);
          try {
            const targetFilename = field.filename && field.suffix ? `${field.filename}.${field.suffix}` : undefined;
            const data = await assetsApi.upload(file, field.upload_to, targetFilename);
            onChange(fieldKey, data.path);
            toast.success("图片已上传并更新配置");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "未知错误");
          } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        };

        const handleDeleteClick = () => {
          setShowDeleteDialog(true);
        };

        const handleConfirmDelete = async () => {
          if (value) {
            try {
              await assetsApi.delete(value as string);
              onChange(fieldKey, '');
              toast.success("图片已从服务器删除");
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : '';
              toast.error(errorMsg ? `无法删除图片: ${errorMsg}` : "无法删除图片，请稍后重试");
            }
          } else {
            onChange(fieldKey, '');
          }
          setShowDeleteDialog(false);
        };

        return (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageFileChange}
              disabled={field.disabled || isUploading}
            />
            <Button
              variant="outline"
              className="w-full h-10 gap-2 justify-start text-left font-normal"
              disabled={field.disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : value ? (
                <div className="w-6 h-6 rounded border border-border/50 overflow-hidden shrink-0 bg-muted/30">
                  <img
                    src={previewUrl}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjIiIHJ5PSIyIi8+PHBhdGggZD0ibTIxIDE1LTUtNS02IDYiLz48Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iMiIvPjwvc3ZnPg==';
                    }}
                  />
                </div>
              ) : (
                <Image className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("truncate flex-1", !value && "text-muted-foreground")}>
                {isUploading ? "正在上传..." : value ? String(value) : "上传图片"}
              </span>
              {value && !isUploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
                  className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors shrink-0"
                  disabled={field.disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {!isUploading && <Upload className="w-4 h-4 shrink-0 text-muted-foreground" />}
            </Button>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除图片</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除这张图片吗？删除后图片会从服务器上永久移除，无法恢复。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        );
      }

      // ----------------------------------------------------------
      // 默认兜底
      // ----------------------------------------------------------
      default:
        return (
          <Input 
            value={String(value ?? '')} 
            onChange={(e) => onChange(fieldKey, e.target.value)} 
            disabled={field.disabled}
            className="bg-background h-10"
          />
        );
    }
  };

  // Divider 类型：不需要 Label，直接渲染
  if (isDividerField) {
    return (
      <div className={cn("col-span-full", className)}>
        {renderField()}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("flex flex-col", className)}>
        {showLabel && (
          <Label className="text-sm font-medium text-muted-foreground mb-2 h-5 flex items-center gap-2 shrink-0">
            {getTitleIcon(displayLabel)}
            {displayLabel}
            {field.required && <span className="text-destructive ml-1">*</span>}
            {isSecret && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/5 whitespace-nowrap">
                <Eye className="w-2.5 h-2.5" />
                密钥
              </span>
            )}
            {displayDescription && (
              <MarkdownTooltip content={displayDescription} side="top" className="max-w-xs" />
            )}
          </Label>
        )}
        {renderField()}
      </div>
    </TooltipProvider>
  );
}
