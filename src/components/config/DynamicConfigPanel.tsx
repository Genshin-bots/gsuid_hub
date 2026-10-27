import { Key, HelpCircle, SlidersHorizontal, Search, Globe, Cog } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfigField, ConfigValue, ConfigFieldType, ConfigFieldDefinition } from './ConfigField';
import { RepeatGroupField, RepeatGroupItem } from './RepeatGroupField';
import { PluginConfigItem } from '@/lib/api';

// ============================================================================
// 类型映射：后端 type → ConfigField type
// ============================================================================

/** 字段名或标题里带 key / 密钥的，独占一行，不进三列。 */
function isSecretKeyField(fieldKey: string, item: PluginConfigItem): boolean {
  const title = item.title == null ? '' : String(item.title);
  return /key/i.test(fieldKey) || /key/i.test(title) || title.includes('密钥');
}

// 归一化选项：所有元素转为字符串
function normalizeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) => (o == null ? '' : String(o)));
}

// 返回归一化后的 item（不修改原对象），避免下游 .trim()/.toLowerCase() 崩溃
function normalizeItem(item: PluginConfigItem): PluginConfigItem {
  return {
    ...item,
    options: normalizeOptions(item.options),
  };
}

function mapBackendTypeToFieldType(item: PluginConfigItem): string {
  const rawType = (item.type || '').toLowerCase();

  // 精确匹配（优先）
  if (rawType === 'gsrepeatgroup') return 'repeatgroup';
  if (rawType === 'gsbutton') return 'button';
  if (rawType === 'gsdivider') return 'divider';
  if (rawType === 'gscolor') return 'color';
  if (rawType === 'gsfileupload') return 'fileupload';
  if (rawType === 'gsfilesupload') return 'filesupload';
  if (rawType === 'gstimerange') return 'timerange';
  if (rawType === 'gsdate') return 'date';
  if (rawType === 'gstimer') return 'time';
  if (rawType === 'gstime') return 'time'; // 已废弃
  if (rawType === 'gsbool') return 'boolean';
  if (rawType === 'gsint') {
    // gsint: 有 options 时用下拉选择
    if (item.options && item.options.length > 0) return 'select';
    return 'number';
  }
  if (rawType === 'gsfloat') return 'number';
  if (rawType === 'gsliststr') return item.options ? 'multiselect' : 'tags';
  if (rawType === 'gslist') return 'tags';
  if (rawType === 'gsdict') return 'text';
  if (rawType === 'gsimage') return 'image';
  if (rawType === 'gsstr') return item.options ? 'select' : 'text';

  // 兜底：模糊匹配
  if (rawType.includes('bool')) return 'boolean';
  if (rawType.includes('int') || rawType.includes('float')) return 'number';
  if (rawType.includes('list') || rawType.includes('array')) {
    return item.options ? 'multiselect' : 'tags';
  }
  if (rawType.includes('time') || rawType.includes('date')) return 'date';
  if (rawType.includes('str') || rawType.includes('string')) {
    return item.options ? 'select' : 'text';
  }
  if (rawType.includes('dict') || rawType.includes('object')) return 'text';
  if (rawType.includes('image')) return 'image';

  // fallback: 有 options 的默认 select
  if (item.options && item.options.length > 0) return 'select';
  return 'text';
}

// 根据字段 key 匹配图标
function getFieldIcon(fieldKey: string) {
  const lower = fieldKey.toLowerCase();
  if (lower.includes('api_key') || lower.includes('apikey') || lower.includes('key')) {
    return <Key className="w-3 h-3" />;
  }
  if (lower.includes('max') || lower.includes('count') || lower.includes('num')) {
    return <SlidersHorizontal className="w-3 h-3" />;
  }
  if (lower.includes('search') || lower.includes('type')) {
    return <Search className="w-3 h-3" />;
  }
  if (lower.includes('host') || lower.includes('url') || lower.includes('base')) {
    return <Globe className="w-3 h-3" />;
  }
  return <Cog className="w-3 h-3" />;
}

// 将后端返回的 item.value 转为适合对应 fieldType 的值
function coerceValue(fieldType: string, rawType: string, rawValue: unknown): ConfigValue {
  // gsdict: 字典序列化为 JSON 字符串
  if (rawType === 'gsdict') {
    if (typeof rawValue === 'string') return rawValue;
    if (rawValue && typeof rawValue === 'object') {
      try {
        return JSON.stringify(rawValue, null, 2);
      } catch {
        return '';
      }
    }
    return rawValue == null ? '' : String(rawValue);
  }

  // gslist: 整数列表转为字符串列表
  if (rawType === 'gslist') {
    if (Array.isArray(rawValue)) return rawValue.map((v) => (v == null ? '' : String(v)));
    return [];
  }

  if (fieldType === 'tags') {
    if (Array.isArray(rawValue)) return rawValue.map((v) => (v == null ? '' : String(v)));
    return [];
  }
  if (fieldType === 'number') {
    if (typeof rawValue === 'number') return rawValue;
    if (typeof rawValue === 'string' && rawValue.trim() !== '' && !isNaN(Number(rawValue))) {
      return Number(rawValue);
    }
    return 0;
  }
    if (fieldType === 'boolean') return Boolean(rawValue);
    if (fieldType === 'button') {
      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        return rawValue as ConfigValue;
      }
      return { phase: 'idle', progress: 0, message: '', fields: {} };
    }
    return rawValue == null ? '' : String(rawValue);
}

export function pluginConfigItemToFieldDef(
  fieldKey: string,
  item: PluginConfigItem,
): ConfigFieldDefinition {
  const fieldType = mapBackendTypeToFieldType(item);
  const rawType = (item.type || '').toLowerCase();

  // options 统一为字符串数组
  const options: string[] | undefined =
    fieldType === 'select' || fieldType === 'multiselect'
      ? normalizeOptions(item.options)
      : undefined;

  const value = coerceValue(fieldType, rawType, item.value);

  return {
    type: fieldType as ConfigFieldType,
    label: item.title == null ? fieldKey : String(item.title),
    value,
    options,
    placeholder: '',
    description: item.desc == null ? '' : String(item.desc),
    secret: item.secret,
    regex: item.regex,
    min_value: item.min_value,
    max_value: item.max_value,
    upload_to: item.upload_to,
    filename: item.filename,
    suffix: item.suffix,
    rawType: item.type,
    endpoint: item.endpoint,
    buttonLabel: item.label,
    level: item.level,
    confirmText: item.confirm,
    statusFields: item.status_fields,
    showProgress: item.show_progress,
    pollMs: item.poll_ms,
  };
}

// ============================================================================
// 组件定义
// ============================================================================

interface DynamicConfigPanelProps {
  /** 后端返回的配置字段映射 */
  config: Record<string, PluginConfigItem>;
  /** 配置 ID，用于 updateConfigValue */
  configId: string;
  /** 值变更回调 */
  onChange: (configId: string, fieldKey: string, value: ConfigValue) => void;
  /** 可选：需要排除的字段 key 列表 */
  excludeKeys?: string[];
}

export function DynamicConfigPanel({
  config,
  configId,
  onChange,
  excludeKeys = [],
}: DynamicConfigPanelProps) {
  const allFields = Object.entries(config).filter(([key]) => !excludeKeys.includes(key));

  const renderField = (fieldKey: string, item: PluginConfigItem) => {
    const fieldType = mapBackendTypeToFieldType(item);
    const rawType = (item.type || '').toLowerCase();
    const icon = getFieldIcon(fieldKey);
    const safeTitle = item.title == null ? fieldKey : String(item.title);
    const safeDesc = item.desc == null ? '' : String(item.desc);

    if (fieldType === 'button') {
      const value = coerceValue(fieldType, rawType, item.value);
      return (
        <ConfigField
          key={fieldKey}
          fieldKey={fieldKey}
          field={{
            type: 'button',
            label: safeTitle,
            value,
            description: safeDesc,
            endpoint: item.endpoint,
            buttonLabel: item.label,
            level: item.level,
            confirmText: item.confirm,
            statusFields: item.status_fields,
            showProgress: item.show_progress,
            pollMs: item.poll_ms,
          }}
          onChange={(k, v) => onChange(configId, k, v)}
        />
      );
    }

    // divider 类型直接渲染，不需要 Label
    if (fieldType === 'divider') {
      const dividerValue = typeof item.value === 'string' && item.value ? item.value : null;
      return (
        <ConfigField
          key={fieldKey}
          fieldKey={fieldKey}
          field={{
            type: 'divider',
            label: safeTitle,
            value: dividerValue,
            description: safeDesc,
          }}
          onChange={(k, v) => onChange(configId, k, v)}
        />
      );
    }

    // gsrepeatgroup: 用 RepeatGroupField 渲染可增删的配置组列表
    if (fieldType === 'repeatgroup') {
      const groupValue = Array.isArray(item.value) ? (item.value as RepeatGroupItem[]) : [];
      return (
        <RepeatGroupField
          key={fieldKey}
          fieldKey={fieldKey}
          template={item.template || {}}
          value={groupValue}
          onChange={(k, v) => onChange(configId, k, v as unknown as ConfigValue)}
          title={safeTitle}
          description={safeDesc}
        />
      );
    }

    // 构建 options（select / multiselect 类型需要字符串数组）
    const options: string[] | undefined =
      fieldType === 'select' || fieldType === 'multiselect'
        ? normalizeOptions(item.options)
        : undefined;

    const value = coerceValue(fieldType, rawType, item.value);

    return (
      <div key={fieldKey} className="space-y-2">
        {/* 标题永远单行：过长用省略号截断，绝不折行（折行会把同排控件顶歪） */}
        <Label className="text-xs text-muted-foreground flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 items-center">{icon}</span>
          <span className="min-w-0 truncate" title={safeTitle}>
            {safeTitle}
          </span>
          {item.desc && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none"
                    onClick={(e) => e.preventDefault()}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>{safeDesc}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Label>
        <ConfigField
          fieldKey={fieldKey}
          field={{
            type: fieldType as any,
            label: fieldKey,
            value,
            options,
            placeholder: '',
            description: safeDesc,
            // 透传新字段
            secret: item.secret,
            regex: item.regex,
            min_value: item.min_value,
            max_value: item.max_value,
            upload_to: item.upload_to,
            filename: item.filename,
            suffix: item.suffix,
            rawType: item.type,
          }}
          showLabel={false}
          onChange={(k, v) => onChange(configId, k, v)}
        />
      </div>
    );
  };

  const blocks: React.ReactNode[] = [];
  let rowBuffer: { key: string; item: PluginConfigItem }[] = [];
  const flushRow = () => {
    if (rowBuffer.length === 0) return;
    const rowKey = rowBuffer.map((field) => field.key).join('-');
    blocks.push(
      // 窄屏两列（PC 三列）。items-start：同一行里开关行比输入行矮，
      // 默认 stretch 会把矮的那格拉到行高，行底多出一截空白，行间距看着忽大忽小。
      <div
        key={`row-${rowKey}`}
        className="grid grid-cols-2 items-start gap-x-3 gap-y-3 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3"
      >
        {rowBuffer.map(({ key, item }) => renderField(key, item))}
      </div>,
    );
    rowBuffer = [];
  };

  for (const [key, item] of allFields) {
    const fieldType = mapBackendTypeToFieldType(item);
    const solo =
      isSecretKeyField(key, item) ||
      fieldType === 'divider' ||
      fieldType === 'repeatgroup' ||
      fieldType === 'button';
    if (solo) {
      flushRow();
      blocks.push(renderField(key, item));
      continue;
    }
    rowBuffer.push({ key, item });
  }
  flushRow();

  return <div className="space-y-4">{blocks}</div>;
}
