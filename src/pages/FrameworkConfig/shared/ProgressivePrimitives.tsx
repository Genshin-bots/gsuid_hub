import * as React from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DynamicConfigPanel, type ConfigValue } from '@/components/config';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { isFieldModified, isNonEditableField } from '../classifyGroups';
import type { RawFrameworkGroup } from '../types';

/**
 * 统一的三列输入控件网格（仅放等高 w-full 表单控件，绝不混入裸开关）：
 * - 桌面端（≥1024px）严格一行 3 项（每项固定 1/3 卡片宽）
 * - 平板端（768px–1023px）一行 2 项
 * - 窄屏端（<768px）一行 2 项，奇数末项自动铺满整行不留半行空白
 */
export const FIELD_GRID_CLASS =
  'grid grid-cols-2 items-start gap-x-3 gap-y-3 sm:gap-x-6 md:gap-y-4 lg:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1';

/**
 * 统一的三列渐进式开关网格（专用于 SwitchTile，与上方三列输入网格列轨严格对齐）：
 * - 桌面端（≥1024px）一行 3 项（每项左标签、右开关，开启后在下方缩进展开子项）
 * - 平板端（768px–1023px）一行 2 项
 * - 窄屏端（<768px）一行 1 项，保证开关文案完整可读
 */
export const SWITCH_GRID_CLASS =
  'grid grid-cols-1 items-start gap-x-6 gap-y-3.5 md:grid-cols-2 lg:grid-cols-3';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex items-center justify-center text-muted-foreground/50">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground/75">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldResetAction({
  modified,
  onReset,
}: {
  modified: boolean;
  onReset?: () => void;
}) {
  const { t } = useLanguage();
  if (!modified) return null;

  return (
    <span className="inline-flex h-4 shrink-0 items-center gap-1">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
        title={t('frameworkConfig.progressive.modifiedBadge')}
      />
      {onReset && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              aria-label={t('frameworkConfig.progressive.resetField')}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('frameworkConfig.progressive.resetField')}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export interface ProgressiveSectionCardProps {
  icon?: React.ReactNode;
  title: string;
  help?: string;
  changedCount?: number;
  onResetSection?: () => void;
  masterSwitch?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    collapsedHint?: string;
  };
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ProgressiveSectionCard({
  icon,
  title,
  help,
  changedCount = 0,
  onResetSection,
  masterSwitch,
  headerExtra,
  children,
  className,
}: ProgressiveSectionCardProps) {
  const { t } = useLanguage();
  const isBodyVisible = masterSwitch ? masterSwitch.checked : true;

  return (
    <Card className={cn('glass-card p-4 sm:p-5', className)}>
      <div className="flex min-h-6 min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="flex shrink-0 items-center text-primary">{icon}</span>}
          <div className="flex min-w-0 items-center gap-2">
            {help ? (
              <div className="min-w-0 [&>div]:min-w-0">
                <LabelWithHelp
                  label={title}
                  description={help}
                  className="min-w-0 truncate text-base font-semibold text-foreground"
                />
              </div>
            ) : (
              <h2
                className="min-w-0 truncate text-base font-semibold text-foreground"
                title={title}
              >
                {title}
              </h2>
            )}
            {changedCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 shrink-0 border border-primary/30 bg-primary/10 px-1.5 text-[11px] font-medium text-foreground"
              >
                {t('frameworkConfig.progressive.modifiedCount', { count: changedCount })}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          {changedCount > 0 && onResetSection && (
            <button
              type="button"
              onClick={onResetSection}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {t('frameworkConfig.progressive.resetSection')}
              </span>
            </button>
          )}
          {masterSwitch && (
            <Switch
              checked={masterSwitch.checked}
              onCheckedChange={masterSwitch.onCheckedChange}
              disabled={masterSwitch.disabled}
            />
          )}
        </div>
      </div>

      {masterSwitch && !masterSwitch.checked && masterSwitch.collapsedHint && (
        <p
          className="mt-1.5 truncate text-xs text-muted-foreground"
          title={masterSwitch.collapsedHint}
        >
          {masterSwitch.collapsedHint}
        </p>
      )}

      {isBodyVisible && (
        <div
          className={cn(
            'mt-4 space-y-3 md:space-y-4',
            masterSwitch && 'border-t border-border/40 pt-4 animate-in fade-in duration-150',
          )}
        >
          {children}
        </div>
      )}
    </Card>
  );
}

export interface FieldShellProps {
  label: string;
  help?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  modified?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function FieldShell({
  label,
  help,
  icon,
  badge,
  modified = false,
  onReset,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <div className="flex min-h-5 min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {icon && <span className="flex shrink-0 items-center text-muted-foreground">{icon}</span>}
          {help ? (
            <div className="min-w-0 [&>div]:min-w-0">
              <LabelWithHelp
                label={label}
                description={help}
                className="min-w-0 truncate text-xs font-medium text-muted-foreground"
              />
            </div>
          ) : (
            <span
              className="min-w-0 truncate text-xs font-medium text-muted-foreground"
              title={label}
            >
              {label}
            </span>
          )}
          {badge}
        </div>
        <FieldResetAction modified={modified} onReset={onReset} />
      </div>
      {children}
    </div>
  );
}

export interface SwitchTileProps {
  icon?: React.ReactNode;
  label: string;
  help?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  modified?: boolean;
  onReset?: () => void;
  badge?: React.ReactNode;
  tone?: 'default' | 'warning';
  /** 开启态时在开关行下方缩进浮现的关联配置（带左侧主色竖线指引） */
  children?: React.ReactNode;
  className?: string;
}

/**
 * 状态驱动的渐进式开关项：
 * - 顶行左对齐标签、右对齐 Switch（与所在列左右边缘严格齐平）
 * - 开启后在下方带左侧导引线就地展开关联子项（如「开启自定义背景」→ 显示「自定义背景」上传器）
 */
export function SwitchTile({
  icon,
  label,
  help,
  checked,
  onCheckedChange,
  disabled,
  modified = false,
  onReset,
  badge,
  tone = 'default',
  children,
  className,
}: SwitchTileProps) {
  const isWarnOn = tone === 'warning' && checked;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex min-h-6 min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span
              className={cn(
                'flex shrink-0 items-center',
                isWarnOn
                  ? 'text-amber-600 dark:text-amber-400'
                  : checked
                    ? 'text-primary'
                    : 'text-muted-foreground',
              )}
            >
              {icon}
            </span>
          )}
          {help ? (
            <div className="min-w-0 [&>div]:min-w-0">
              <LabelWithHelp
                label={label}
                description={help}
                className={cn(
                  'min-w-0 truncate text-sm font-medium',
                  isWarnOn ? 'text-amber-700 dark:text-amber-300' : 'text-foreground',
                )}
              />
            </div>
          ) : (
            <span
              className={cn(
                'min-w-0 truncate text-sm font-medium',
                isWarnOn ? 'text-amber-700 dark:text-amber-300' : 'text-foreground',
              )}
              title={label}
            >
              {label}
            </span>
          )}
          {badge}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <FieldResetAction modified={modified} onReset={onReset} />
          <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
      </div>

      {checked && children && (
        <div className="mt-2.5 border-l-2 border-primary/25 pl-3.5 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

export interface UnexpectedFieldsCardProps {
  group: RawFrameworkGroup;
  originalGroup?: RawFrameworkGroup;
  expectedKeys: readonly string[];
  title?: string;
  help?: string;
  onUpdateField: (groupId: string, fieldKey: string, value: ConfigValue | unknown) => void;
  onResetField: (groupId: string, fieldKey: string) => void;
}

export function UnexpectedFieldsCard({
  group,
  originalGroup,
  expectedKeys,
  title,
  help,
  onUpdateField,
  onResetField,
}: UnexpectedFieldsCardProps) {
  const { t } = useLanguage();
  const expectedSet = React.useMemo(() => new Set(expectedKeys), [expectedKeys]);

  const unexpectedKeys = React.useMemo(
    () => Object.keys(group.config).filter((key) => !expectedSet.has(key)),
    [group.config, expectedSet],
  );

  const editableUnexpectedCount = React.useMemo(
    () => unexpectedKeys.filter((key) => !isNonEditableField(group.config[key])).length,
    [group.config, unexpectedKeys],
  );

  const changedUnexpectedKeys = React.useMemo(
    () => unexpectedKeys.filter((key) => isFieldModified(group, originalGroup, key)),
    [group, originalGroup, unexpectedKeys],
  );

  if (editableUnexpectedCount === 0) return null;

  return (
    <ProgressiveSectionCard
      icon={<SlidersHorizontal className="h-5 w-5" />}
      title={title ?? t('frameworkConfig.progressive.moreFieldsTitle', { name: group.name })}
      help={help ?? t('frameworkConfig.progressive.moreFieldsHelp')}
      changedCount={changedUnexpectedKeys.length}
      onResetSection={() => {
        changedUnexpectedKeys.forEach((key) => {
          onResetField(group.id, key);
        });
      }}
    >
      <DynamicConfigPanel
        config={group.config}
        configId={group.id}
        excludeKeys={[...expectedKeys]}
        onChange={onUpdateField}
      />
    </ProgressiveSectionCard>
  );
}
