import { useState } from 'react';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { PluginConfigItem } from '@/lib/api';
import { ConfigField, ConfigValue } from './ConfigField';
import { pluginConfigItemToFieldDef } from './DynamicConfigPanel';

// gsrepeatgroup 的一项：字段名 -> 值(嵌套组则为值数组)
export type RepeatGroupItem = Record<string, unknown>;

interface RepeatGroupFieldProps {
  fieldKey: string;
  template: Record<string, PluginConfigItem>;
  value: RepeatGroupItem[];
  onChange: (fieldKey: string, value: RepeatGroupItem[]) => void;
  disabled?: boolean;
  /** 分区标题(渲染在头部，新增按钮对齐其右侧) */
  title?: string;
  description?: string;
}

const typeOf = (item: PluginConfigItem) => (item.type || '').toLowerCase();
const isGroupField = (item: PluginConfigItem) => typeOf(item) === 'gsrepeatgroup';
const isBoolField = (item: PluginConfigItem) => typeOf(item) === 'gsbool';
const isTextField = (item: PluginConfigItem) => typeOf(item) === 'gsstr';

function buildDefaultItem(template: Record<string, PluginConfigItem>): RepeatGroupItem {
  const item: RepeatGroupItem = {};
  for (const [key, field] of Object.entries(template)) {
    item[key] = isGroupField(field) ? [] : field.value;
  }
  return item;
}

// 折叠态副标题：首个 URL 字段 + 各嵌套组数量(通用，不写死具体键名)
function summarize(item: RepeatGroupItem, entries: [string, PluginConfigItem][], skip: Set<string>): string {
  const parts: string[] = [];
  for (const [key, tItem] of entries) {
    if (skip.has(key)) continue;
    if (isGroupField(tItem)) {
      const n = Array.isArray(item[key]) ? (item[key] as unknown[]).length : 0;
      parts.push(`${n} ${tItem.title || key}`);
    } else if (key.toLowerCase().includes('url') && typeof item[key] === 'string' && item[key]) {
      parts.push(String(item[key]));
    }
  }
  return parts.join(' · ');
}

export function RepeatGroupField({ fieldKey, template, value, onChange, disabled, title, description }: RepeatGroupFieldProps) {
  const { t } = useLanguage();
  const items = Array.isArray(value) ? value : [];
  const entries = Object.entries(template);

  // 标题取首个文本字段(通用：供应商=name，模型=model_real_name)，enable 提到右侧
  const enableKey = entries.find(([k, f]) => k === 'enable' && isBoolField(f))?.[0];
  const titleKey = entries.find(([k, f]) => k !== enableKey && isTextField(f))?.[0];
  const bodyEntries = entries.filter(([k]) => k !== enableKey);
  const skip = new Set([titleKey, enableKey].filter((k): k is string => !!k));

  // 已存在的项默认收起；仅新增的项自动展开(见 add)
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const update = (i: number, key: string, v: unknown) =>
    onChange(fieldKey, items.map((it, idx) => (idx === i ? { ...it, [key]: v } : it)));
  const add = () => {
    setOpen((prev) => new Set(prev).add(items.length));
    onChange(fieldKey, [...items, buildDefaultItem(template)]);
  };
  const remove = (i: number) => {
    setOpen((prev) => new Set([...prev].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))));
    onChange(fieldKey, items.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <Label className="text-sm font-medium text-foreground">{title}</Label>}
          {description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 h-8 gap-1.5 border-dashed"
          onClick={add}
          disabled={disabled}
        >
          <Plus className="w-4 h-4" />
          {t('common.repeatGroup.add')}
        </Button>
      </div>

      {items.map((item, i) => {
        const isOpen = open.has(i);
        const title =
          titleKey && typeof item[titleKey] === 'string' && item[titleKey]
            ? String(item[titleKey])
            : `${t('common.repeatGroup.item')} ${i + 1}`;
        const subtitle = summarize(item, entries, skip);
        return (
          <div key={i} className="glass-card-flat shadow-sm rounded-[3px] overflow-hidden">
            {/* 顶部主题色细线：卡片的一部分(被 rounded/overflow 裁切贴合) */}
            <div className="h-[5px] bg-primary/60" />
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(i);
                }
              }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
            >
              <ChevronRight className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-90')} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{title}</div>
                {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {enableKey && (
                  <Switch
                    checked={Boolean(item[enableKey])}
                    onCheckedChange={(c) => update(i, enableKey, c)}
                    disabled={disabled}
                  />
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="p-1.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={t('common.repeatGroup.remove')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="px-4 py-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
                {bodyEntries.map(([key, tItem]) => {
                  const raw = item[key];
                  if (isGroupField(tItem) && tItem.template) {
                    return (
                      <div key={key} className="col-span-full pt-1">
                        <RepeatGroupField
                          fieldKey={key}
                          template={tItem.template}
                          value={Array.isArray(raw) ? (raw as RepeatGroupItem[]) : []}
                          onChange={(k, v) => update(i, k, v)}
                          disabled={disabled}
                          title={tItem.title || key}
                          description={tItem.desc}
                        />
                      </div>
                    );
                  }
                  const fieldDef = pluginConfigItemToFieldDef(key, { ...tItem, value: raw });
                  return (
                    <ConfigField
                      key={key}
                      fieldKey={key}
                      field={{ ...fieldDef, disabled }}
                      onChange={(k, v: ConfigValue) => update(i, k, v)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="rounded-[3px] border border-dashed border-border/50 py-4 text-center text-xs text-muted-foreground">
          {t('common.repeatGroup.empty')}
        </div>
      )}
    </div>
  );
}
