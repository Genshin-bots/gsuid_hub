import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { CalendarIcon, Plus, X, Upload, HelpCircle, Bell, CreditCard, Settings, Clock, Cog, MessageSquare, Image, Shield, Database, Zap, Key, Loader2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { assetsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { TagsInput } from './TagsInput';

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
  if (lowerTitle.includes(' ключ') || lowerTitle.includes('api') || lowerTitle.includes('key')) {
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

// #TODO: Replace with actual API types
export type ConfigFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'list'
  | 'tags'
  | 'date'
  | 'time'
  | 'email'
  | 'url'
  | 'image'
  | 'password';

export type ConfigValue = string | number | boolean | string[] | [number, number];

export interface ConfigFieldDefinition {
  type: ConfigFieldType;
  label: string;
  value: ConfigValue;
  options?: string[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  upload_to?: string;
  filename?: string;
  suffix?: string;
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
  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const value = field.value;
  
  // Translate label if it's an i18n key (contains a dot), otherwise use as-is
  const displayLabel = field.label.includes('.') ? t(field.label) : field.label;
  const displayPlaceholder = field.placeholder?.includes('.') ? t(field.placeholder) : field.placeholder;
  const displayDescription = field.description?.includes('.') ? t(field.description) : field.description;

  const handleAddTag = () => {
    if (tagInput.trim() && Array.isArray(value) && value.every(v => typeof v === 'string')) {
      const currentList = value as string[];
      if (!currentList.includes(tagInput.trim())) {
        onChange(fieldKey, [...currentList, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (index: number) => {
    if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
      const currentList = value as string[];
      onChange(fieldKey, currentList.filter((_, i) => i !== index));
    }
  };

  // Check if this is a simple single-line field
  const isSimpleField = ['text', 'number', 'select', 'date', 'email', 'url', 'password'].includes(field.type);
  const isBooleanField = field.type === 'boolean';

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'password':
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'password' ? 'password' : 'text'}
            value={value as string}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            placeholder={displayPlaceholder || `输入${displayLabel}`}
            disabled={field.disabled}
            className="bg-background h-10"
          />
        );

      case 'number':
        const numValue = value as number;
        const increment = () => {
          onChange(fieldKey, (numValue || 0) + 1);
        };
        const decrement = () => {
          onChange(fieldKey, (numValue || 0) - 1);
        };
        return (
          <div className="relative">
            <Input
              type="number"
              value={numValue}
              onChange={(e) => onChange(fieldKey, Number(e.target.value))}
              placeholder={displayPlaceholder}
              disabled={field.disabled}
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

      case 'select':
        // 如果有选项，可输入可选择组合框
        if (field.options && field.options.length > 0) {
          return (
            <InputWithDropdown
              value={value as string}
              onChange={(val) => onChange(fieldKey, val)}
              options={field.options}
              placeholder={displayPlaceholder || '请选择'}
              inputPlaceholder={displayPlaceholder || '请输入或选择'}
              disabled={field.disabled}
            />
          );
        }
        // 没有选项，就只是普通输入框
        return (
          <Input
            value={value as string}
            onChange={(e) => onChange(fieldKey, e.target.value)}
            placeholder={displayPlaceholder || (field.placeholder ? t(field.placeholder) : `输入${displayLabel}`)}
            disabled={field.disabled}
            className="bg-background h-10"
          />
        );

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

      case 'time':
        return (
          <TimePicker
            value={value as string | [number, number]}
            onChange={(val) => onChange(fieldKey, val)}
            disabled={field.disabled}
          />
        );

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

      case 'image':
        const previewUrl = assetsApi.getPreviewUrl(value as string);
        const [showDeleteDialog, setShowDeleteDialog] = useState(false);
        
        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          
          setIsUploading(true);
          try {
            const targetFilename = field.filename && field.suffix ? `${field.filename}.${field.suffix}` : undefined;
            const data = await assetsApi.upload(file, field.upload_to, targetFilename);
            onChange(fieldKey, data.path);
            toast({
              title: "上传成功",
              description: "图片已上传并更新配置",
            });
          } catch (error) {
            toast({
              title: "上传失败",
              description: error instanceof Error ? error.message : "未知错误",
              variant: "destructive",
            });
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
              toast({
                title: "删除成功",
                description: "图片已从服务器删除",
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : '';
              toast({
                title: "删除失败",
                description: errorMsg ? `无法删除图片: ${errorMsg}` : "无法删除图片，请稍后重试",
                variant: "destructive",
              });
            }
          } else {
            onChange(fieldKey, '');
          }
          setShowDeleteDialog(false);
        };

        return (
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={field.disabled || isUploading}
            />
            {value && (
              <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-muted/30">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjIiIHJ5PSIyIi8+PHBhdGggZD0ibTIxIDE1LTUtNS1MNCAyMCIvPjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSIyIi8+PC9zdmc+';
                  }}
                />
                <button
                  onClick={handleDeleteClick}
                  className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  disabled={field.disabled || isUploading}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full h-10 gap-2"
              disabled={field.disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isUploading ? "正在上传..." : "上传图片"}
            </Button>
            {value && (
              <p className="text-[10px] text-muted-foreground break-all line-clamp-1" title={value as string}>
                路径: {value as string}
              </p>
            )}

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
          </div>
        );

      default:
        return (
          <Input 
            value={String(value)} 
            onChange={(e) => onChange(fieldKey, e.target.value)} 
            disabled={field.disabled}
            className="bg-background h-10"
          />
        );
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("flex flex-col items-stretch", className)}>
        {showLabel && (
          <Label className="text-sm font-medium text-muted-foreground mb-2 h-5 flex items-center gap-2">
            {getTitleIcon(displayLabel)}
            {displayLabel}
            {field.required && <span className="text-destructive ml-1">*</span>}
            {displayDescription && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none"
                    onClick={(e) => e.preventDefault()}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>{displayDescription}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </Label>
        )}
        {renderField()}
      </div>
    </TooltipProvider>
  );
}
