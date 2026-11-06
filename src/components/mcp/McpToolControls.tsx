import { useEffect, useState } from 'react';
import { ChevronDown, HelpCircle, Key, Undo2, Wrench } from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import type { MCPToolExposure } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { isSuggestSharedKey, type ToolMeta } from './toolMeta';

interface ToolMetaControlsProps {
  meta: ToolMeta;
  onChange: (meta: ToolMeta) => void;
}

/** 单工具的安全分级控件：私有/公有、写操作、敏感参数、凭据参数（编辑页与市场安装页共用） */
export function McpToolMetaControls({ meta, onChange }: ToolMetaControlsProps) {
  const { t } = useLanguage();
  const m = meta;
  const patch = (p: Partial<ToolMeta>) => onChange({ ...m, ...p });
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 嵌套点击区——仅阻止冒泡触发父卡片勾选
    <div
      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t('mcpConfig.toolExposure')}</span>
        <Select value={m.exposure} onValueChange={(v) => patch({ exposure: v as MCPToolExposure })}>
          <SelectTrigger className="h-7 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">{t('mcpConfig.exposurePrivate')}</SelectItem>
            <SelectItem value="public">{t('mcpConfig.exposurePublic')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={m.mutating}
              onCheckedChange={(c) => patch({ mutating: c === true })}
            />
            {t('mcpConfig.toolMutating')}
          </label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{t('mcpConfig.toolMutatingTip')}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={m.sensitiveArgs}
              onCheckedChange={(c) => patch({ sensitiveArgs: c === true })}
            />
            {t('mcpConfig.toolSensitive')}
          </label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{t('mcpConfig.toolSensitiveTip')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface ToolSelectRowProps {
  name: string;
  description?: string;
  /** 载入时的原始描述（商店/已存配置）；与当前不同则显示还原按钮 */
  originalDescription?: string;
  onRestoreDescription?: () => void;
  checked: boolean;
  onToggle: () => void;
  meta: ToolMeta;
  onMetaChange: (meta: ToolMeta) => void;
}

/** 可选中的工具行：勾选卡片 + 选中后展开安全分级控件 */
export function McpToolSelectRow({
  name,
  description,
  originalDescription,
  onRestoreDescription,
  checked,
  onToggle,
  meta,
  onMetaChange,
}: ToolSelectRowProps) {
  const { t } = useLanguage();
  const descChanged = Boolean(originalDescription) && originalDescription !== description;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 整卡片可点=勾选，内层控件已阻冒泡
    <div
      className={cn(
        'flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
        checked
          ? 'bg-primary/5 border-primary/30'
          : 'bg-muted/30 border-border/30 hover:bg-muted/50',
      )}
      onClick={onToggle}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{name}</p>
          {descChanged && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestoreDescription?.();
                  }}
                >
                  <Undo2 className="h-3 w-3" />
                  {t('mcpConfig.restoreDesc')}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{t('mcpConfig.restoreDescTip')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
        {checked && <McpToolMetaControls meta={meta} onChange={onMetaChange} />}
      </div>
    </div>
  );
}

interface ToolSelectSectionProps {
  tools: { name: string; description?: string }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  toolMeta: Record<string, ToolMeta>;
  onMetaChange: (name: string, meta: ToolMeta) => void;
  /** 未触碰过 meta 的工具用它兜底（有凭据→private 默认） */
  fallbackMeta: ToolMeta;
  /** 载入时的原始描述基线（商店/已存配置）；服务器返回值不同则行内显示还原 */
  originalDescriptions?: Record<string, string>;
  onRestoreDescription?: (name: string) => void;
}

/** 可勾选工具列表：默认展开、无内层滚动；标题行展示已选/私有/公有/写操作统计 */
export function McpToolSelectSection({
  tools,
  selected,
  onToggle,
  toolMeta,
  onMetaChange,
  fallbackMeta,
  originalDescriptions,
  onRestoreDescription,
}: ToolSelectSectionProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  let priv = 0;
  let mut = 0;
  for (const name of selected) {
    const m = toolMeta[name] ?? fallbackMeta;
    if (m.exposure === 'private') priv += 1;
    if (m.mutating) mut += 1;
  }
  const pub = selected.size - priv;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-left text-sm hover:bg-sky-500/15"
        >
          <Wrench className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="flex-1 min-w-0">
            {t('mcpMarket.install.toolsSelectTitle', {
              selected: selected.size,
              count: tools.length,
            })}
            <span className="ml-2 text-xs text-muted-foreground">
              {t('mcpMarket.install.toolsSelectStats', { priv, pub, mut })}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1.5">
          {tools.map((tool) => (
            <McpToolSelectRow
              key={tool.name}
              name={tool.name}
              description={tool.description}
              originalDescription={originalDescriptions?.[tool.name]}
              onRestoreDescription={
                onRestoreDescription ? () => onRestoreDescription(tool.name) : undefined
              }
              checked={selected.has(tool.name)}
              onToggle={() => onToggle(tool.name)}
              meta={toolMeta[tool.name] ?? fallbackMeta}
              onMetaChange={(meta) => onMetaChange(tool.name, meta)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SwitchRowProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  /** inset=true 表示已在外层 p-3 容器内，不再叠加行内 padding */
  inset?: boolean;
}

/** 统一的开关行（启用 / 注册为 AI Tools / 无人任务私有凭据等）：标题 + ?tooltip + 右端开关 */
export function McpSwitchRow({
  checked,
  onCheckedChange,
  label,
  description,
  inset,
}: SwitchRowProps) {
  return (
    <div
      className={cn('flex items-center gap-2 rounded-lg', !inset && 'px-3 py-2 hover:bg-muted/30')}
    >
      <span className="text-sm font-medium">{label}</span>
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      )}
      <Switch className="ml-1" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface EnvBindableControlProps {
  envKey: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** env 行尾部：「可按用户绑定」勾选 + 建议共享徽标 */
export function McpEnvBindableControl({
  envKey,
  checked,
  onCheckedChange,
}: EnvBindableControlProps) {
  const { t } = useLanguage();
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={checked} onCheckedChange={(c) => onCheckedChange(c === true)} />
            {t('mcpConfig.envBindable')}
          </label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{t('mcpConfig.envBindableHelp')}</p>
        </TooltipContent>
      </Tooltip>
      {isSuggestSharedKey(envKey) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="shrink-0 whitespace-normal max-w-full text-[10px]">
              {t('mcpConfig.suggestSharedBadge')}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{t('mcpConfig.suggestSharedTip')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}

interface BindSectionProps {
  bindHelp: string;
  bindUrl: string;
  bindAliasText: string;
  onChange: (patch: { bindHelp?: string; bindUrl?: string; bindAliasText?: string }) => void;
}

/** 凭据绑定区（绑定引导补充 / 别名）：全部为空时默认折叠，无卡片壳 */
export function McpBindSection({ bindHelp, bindUrl, bindAliasText, onChange }: BindSectionProps) {
  const { t } = useLanguage();
  const hasContent = Boolean(bindHelp || bindUrl || bindAliasText);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? hasContent;
  return (
    <Collapsible open={open} onOpenChange={setOpenOverride}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-1.5 py-1 text-left">
          <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            {t('mcpConfig.bindSection')}
            {!hasContent && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t('mcpConfig.bindSectionOptional')}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <div className="space-y-2">
          <Label htmlFor="mcp-bind-url" className="text-xs text-muted-foreground">
            {t('mcpConfig.bindUrlLabel')}
          </Label>
          <Input
            id="mcp-bind-url"
            placeholder={t('mcpConfig.bindUrlPlaceholder')}
            value={bindUrl}
            onChange={(e) => onChange({ bindUrl: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mcp-bind-help" className="text-xs text-muted-foreground">
            {t('mcpConfig.bindHelpLabel')}
          </Label>
          <Input
            id="mcp-bind-help"
            placeholder={t('mcpConfig.bindHelpPlaceholder')}
            value={bindHelp}
            onChange={(e) => onChange({ bindHelp: e.target.value })}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mcp-bind-alias" className="text-xs text-muted-foreground">
            {t('mcpConfig.bindAliasLabel')}
          </Label>
          <Input
            id="mcp-bind-alias"
            placeholder={t('mcpConfig.bindAliasPlaceholder')}
            value={bindAliasText}
            onChange={(e) => onChange({ bindAliasText: e.target.value })}
            className="text-sm"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** 工具发现进行中的状态行：阶段提示 + 已等待秒数（单请求无法出真进度条，给可见的心跳） */
export function McpDiscoveringHint({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {t('mcpConfig.discoveringHint', { elapsed })}
    </p>
  );
}
