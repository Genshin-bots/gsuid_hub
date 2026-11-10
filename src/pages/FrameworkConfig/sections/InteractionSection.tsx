import * as React from 'react';
import { MessageSquare, MousePointerClick } from 'lucide-react';
import { TagsInput } from '@/components/config';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { isFieldModified } from '../classifyGroups';
import { PlatformBrandIcon } from '../shared/PlatformBrandIcon';
import {
  EmptyState,
  FIELD_GRID_CLASS,
  FieldShell,
  ProgressiveSectionCard,
  SWITCH_GRID_CLASS,
  SwitchTile,
  UnexpectedFieldsCard,
} from '../shared/ProgressivePrimitives';
import type { FrameworkSectionSharedProps } from '../types';

const MISC_EXPECTED_KEYS = [
  'HelpMode',
  'AtSenderPos',
  'SameUserEventCD',
  'BlackList',
  'ShieldQQBot',
  'EnableForwardMessage',
  'CommandSemaphore',
] as const;

const CACHE_EXPECTED_KEYS = ['CacheHours'] as const;

const BUTTON_MD_EXPECTED_KEYS = [
  'SendMDPlatform',
  'SendButtonsPlatform',
  'SendTemplatePlatform',
  'ButtonRow',
  'TryTemplateForQQ',
  'ForceSendMD',
  'UseCRLFReplaceLFForMD',
  'SplitMDAndButtons',
] as const;

const DEFAULT_CD_OPTIONS = ['0', '1', '2', '3', '5', '10', '15', '30'] as const;
const DEFAULT_CACHE_HOUR_OPTIONS = ['0', '1', '6', '12', '24', '72', '168', '720', '8760'] as const;

const DEFAULT_FORWARD_OPTIONS = [
  '允许',
  '禁止(不发送任何消息)',
  '合并为一条消息',
  '全部拆成单独消息',
  '1',
  '2',
  '3',
  '4',
  '5',
] as const;

const DEFAULT_MD_PLATFORMS = [
  'villa',
  'kaiheila',
  'dodo',
  'discord',
  'telegram',
  'qqgroup',
  'qqguild',
  'web',
] as const;

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v)).filter(Boolean);
}

interface PlatformToggleGridProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  gridClassName?: string;
}

function PlatformToggleGrid({
  options,
  value,
  onChange,
  gridClassName = 'grid-cols-2 gap-2 sm:grid-cols-4',
}: PlatformToggleGridProps) {
  const selectedSet = new Set(value);

  const toggle = (platform: string) => {
    if (selectedSet.has(platform)) {
      onChange(value.filter((item) => item !== platform));
    } else {
      onChange([...value, platform]);
    }
  };

  return (
    <div className={cn('grid', gridClassName)}>
      {options.map((platform) => {
        const active = selectedSet.has(platform);
        return (
          <button
            key={platform}
            type="button"
            onClick={() => toggle(platform)}
            title={platform}
            className={cn(
              'inline-flex h-9 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            <PlatformBrandIcon platform={platform} size={15} className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{platform}</span>
          </button>
        );
      })}
    </div>
  );
}

export function InteractionSection({
  groups,
  originalConfigs,
  onUpdateField,
  onResetField,
}: FrameworkSectionSharedProps) {
  const { t } = useLanguage();

  const miscGroup = groups.find((g) => g.role === 'misc');
  const cacheGroup = groups.find((g) => g.role === 'messageCache');
  const buttonMdGroup = groups.find((g) => g.role === 'buttonMd');

  const forwardOptions = React.useMemo(() => {
    const rawOpts = miscGroup?.config.EnableForwardMessage?.options;
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return [...DEFAULT_FORWARD_OPTIONS];
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [miscGroup?.config.EnableForwardMessage?.options]);

  const atPosOptions = React.useMemo(() => {
    const rawOpts = miscGroup?.config.AtSenderPos?.options;
    const defaults = ['消息最前', '消息最后'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return defaults;
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [miscGroup?.config.AtSenderPos?.options]);

  const helpModeOptions = React.useMemo(() => {
    const rawOpts = miscGroup?.config.HelpMode?.options;
    const defaults = ['light', 'dark'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return defaults;
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [miscGroup?.config.HelpMode?.options]);

  const cdOptions = React.useMemo(() => {
    const rawOpts = miscGroup?.config.SameUserEventCD?.options;
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return [...DEFAULT_CD_OPTIONS];
    return rawOpts.map((o) => String(o));
  }, [miscGroup?.config.SameUserEventCD?.options]);

  const cacheHourOptions = React.useMemo(() => {
    const rawOpts = cacheGroup?.config.CacheHours?.options;
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return [...DEFAULT_CACHE_HOUR_OPTIONS];
    return rawOpts.map((o) => String(o));
  }, [cacheGroup?.config.CacheHours?.options]);

  if (!miscGroup && !cacheGroup && !buttonMdGroup) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-8 w-8" />}
        title={t('frameworkConfig.noFrameworkConfig')}
      />
    );
  }

  const origMisc = miscGroup ? originalConfigs[miscGroup.id] : undefined;
  const origCache = cacheGroup ? originalConfigs[cacheGroup.id] : undefined;
  const origBtn = buttonMdGroup ? originalConfigs[buttonMdGroup.id] : undefined;

  const helpMode = String(miscGroup?.config.HelpMode?.value ?? 'dark');
  const atSenderPos = String(miscGroup?.config.AtSenderPos?.value ?? atPosOptions[0] ?? '消息最前');
  const cdRaw = miscGroup?.config.SameUserEventCD?.value;
  const cdSeconds =
    typeof cdRaw === 'number' ? cdRaw : Number.parseInt(String(cdRaw ?? 0), 10) || 0;
  const blackList = toStringArray(miscGroup?.config.BlackList?.value);
  const shieldQqBots = toStringArray(miscGroup?.config.ShieldQQBot?.value);
  const shieldQqBotOptions = Array.isArray(miscGroup?.config.ShieldQQBot?.options)
    ? miscGroup.config.ShieldQQBot.options.map((o) => String(o)).filter(Boolean)
    : undefined;
  const forwardMode = String(miscGroup?.config.EnableForwardMessage?.value ?? '允许');

  const cacheHoursRaw = cacheGroup?.config.CacheHours?.value;
  const cacheHours =
    typeof cacheHoursRaw === 'number'
      ? cacheHoursRaw
      : Number.parseInt(String(cacheHoursRaw ?? 0), 10) || 0;

  const mdPlatforms = toStringArray(buttonMdGroup?.config.SendMDPlatform?.value);
  const btnPlatforms = toStringArray(buttonMdGroup?.config.SendButtonsPlatform?.value);
  const tplPlatforms = toStringArray(buttonMdGroup?.config.SendTemplatePlatform?.value);
  const buttonRowRaw = buttonMdGroup?.config.ButtonRow?.value;
  const buttonRow =
    typeof buttonRowRaw === 'number'
      ? buttonRowRaw
      : Number.parseInt(String(buttonRowRaw ?? 2), 10) || 2;

  const tryTemplateForQQ = Boolean(buttonMdGroup?.config.TryTemplateForQQ?.value);
  const forceSendMD = Boolean(buttonMdGroup?.config.ForceSendMD?.value);
  const useCrlf = Boolean(buttonMdGroup?.config.UseCRLFReplaceLFForMD?.value);
  const splitMdAndBtn = Boolean(buttonMdGroup?.config.SplitMDAndButtons?.value);

  const formatForwardOptionLabel = (opt: string) => {
    if (/^\d+$/.test(opt)) {
      return t('frameworkConfig.interaction.forwardThresholdLabel', { count: opt });
    }
    return opt;
  };

  const formatHelpModeLabel = (opt: string) => {
    if (opt === 'light') return t('frameworkConfig.interaction.helpLight');
    if (opt === 'dark') return t('frameworkConfig.interaction.helpDark');
    return opt;
  };

  const getPlatformListForField = (fieldKey: string, selected: string[]): string[] => {
    const rawOpts = buttonMdGroup?.config[fieldKey]?.options;
    const pool =
      Array.isArray(rawOpts) && rawOpts.length > 0
        ? rawOpts.map((o) => String(o)).filter(Boolean)
        : [...DEFAULT_MD_PLATFORMS];
    selected.forEach((s) => {
      if (!pool.includes(s)) pool.push(s);
    });
    return pool;
  };

  const miscModifiedCount =
    (miscGroup
      ? MISC_EXPECTED_KEYS.filter((k) => isFieldModified(miscGroup, origMisc, k)).length
      : 0) +
    (cacheGroup
      ? CACHE_EXPECTED_KEYS.filter((k) => isFieldModified(cacheGroup, origCache, k)).length
      : 0);

  const btnModifiedCount = buttonMdGroup
    ? BUTTON_MD_EXPECTED_KEYS.filter((k) => isFieldModified(buttonMdGroup, origBtn, k)).length
    : 0;

  const showButtonRow =
    Boolean(buttonMdGroup?.config.ButtonRow) &&
    (btnPlatforms.length > 0 ||
      tryTemplateForQQ ||
      Boolean(buttonMdGroup && isFieldModified(buttonMdGroup, origBtn, 'ButtonRow')));

  const showMdSubSwitches =
    mdPlatforms.length > 0 ||
    forceSendMD ||
    Boolean(buttonMdGroup && isFieldModified(buttonMdGroup, origBtn, 'UseCRLFReplaceLFForMD')) ||
    Boolean(buttonMdGroup && isFieldModified(buttonMdGroup, origBtn, 'SplitMDAndButtons'));

  const hasRichMediaSwitches = Boolean(
    buttonMdGroup &&
      (buttonMdGroup.config.TryTemplateForQQ ||
        buttonMdGroup.config.ForceSendMD ||
        (showMdSubSwitches && buttonMdGroup.config.UseCRLFReplaceLFForMD) ||
        (showMdSubSwitches && buttonMdGroup.config.SplitMDAndButtons)),
  );

  const mdPlatformPool = getPlatformListForField('SendMDPlatform', mdPlatforms);
  const btnPlatformPool = getPlatformListForField('SendButtonsPlatform', btnPlatforms);
  const tplPlatformPool = getPlatformListForField('SendTemplatePlatform', tplPlatforms);

  return (
    <div className="space-y-3 md:space-y-4">
      {(miscGroup || cacheGroup) && (
        <>
          <ProgressiveSectionCard
            icon={<MessageSquare className="h-5 w-5" />}
            title={t('frameworkConfig.interaction.miscCardTitle')}
            help={t('frameworkConfig.interaction.miscCardHelp')}
            changedCount={miscModifiedCount}
            onResetSection={() => {
              if (miscGroup) {
                MISC_EXPECTED_KEYS.forEach((k) => {
                  if (isFieldModified(miscGroup, origMisc, k)) {
                    onResetField(miscGroup.id, k);
                  }
                });
              }
              if (cacheGroup) {
                CACHE_EXPECTED_KEYS.forEach((k) => {
                  if (isFieldModified(cacheGroup, origCache, k)) {
                    onResetField(cacheGroup.id, k);
                  }
                });
              }
            }}
          >
            <div className={FIELD_GRID_CLASS}>
              {miscGroup?.config.AtSenderPos && (
                <FieldShell
                  label={
                    miscGroup.config.AtSenderPos.title ||
                    t('frameworkConfig.interaction.atPosLabel')
                  }
                  help={miscGroup.config.AtSenderPos.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'AtSenderPos')}
                  onReset={() => onResetField(miscGroup.id, 'AtSenderPos')}
                >
                  <Select
                    value={atSenderPos}
                    onValueChange={(v) => onUpdateField(miscGroup.id, 'AtSenderPos', v)}
                  >
                    <SelectTrigger className="h-10 bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {atPosOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}

              {miscGroup?.config.HelpMode && (
                <FieldShell
                  label={
                    miscGroup.config.HelpMode.title ||
                    t('frameworkConfig.interaction.helpModeLabel')
                  }
                  help={miscGroup.config.HelpMode.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'HelpMode')}
                  onReset={() => onResetField(miscGroup.id, 'HelpMode')}
                >
                  <Select
                    value={helpMode}
                    onValueChange={(v) => onUpdateField(miscGroup.id, 'HelpMode', v)}
                  >
                    <SelectTrigger className="h-10 bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {helpModeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {formatHelpModeLabel(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}

              {miscGroup?.config.EnableForwardMessage && (
                <FieldShell
                  label={
                    miscGroup.config.EnableForwardMessage.title ||
                    t('frameworkConfig.interaction.forwardLabel')
                  }
                  help={miscGroup.config.EnableForwardMessage.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'EnableForwardMessage')}
                  onReset={() => onResetField(miscGroup.id, 'EnableForwardMessage')}
                >
                  <Select
                    value={forwardMode}
                    onValueChange={(v) => onUpdateField(miscGroup.id, 'EnableForwardMessage', v)}
                  >
                    <SelectTrigger className="h-10 bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {forwardOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {formatForwardOptionLabel(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}

              {miscGroup?.config.CommandSemaphore && (
                <FieldShell
                  label={miscGroup.config.CommandSemaphore.title || 'CommandSemaphore'}
                  help={miscGroup.config.CommandSemaphore.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'CommandSemaphore')}
                  onReset={() => onResetField(miscGroup.id, 'CommandSemaphore')}
                >
                  <NumberInput
                    min={1}
                    max={500}
                    step={1}
                    value={(miscGroup.config.CommandSemaphore.value as number | string) ?? 25}
                    onValueChange={(next) => onUpdateField(miscGroup.id, 'CommandSemaphore', next)}
                  />
                </FieldShell>
              )}

              {miscGroup?.config.SameUserEventCD && (
                <FieldShell
                  label={
                    miscGroup.config.SameUserEventCD.title ||
                    t('frameworkConfig.interaction.cooldownLabel')
                  }
                  help={miscGroup.config.SameUserEventCD.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'SameUserEventCD')}
                  onReset={() => onResetField(miscGroup.id, 'SameUserEventCD')}
                >
                  <InputWithDropdown
                    value={String(cdSeconds)}
                    options={cdOptions}
                    showClearValueAction={false}
                    className="bg-background/60"
                    formatLabel={(raw) =>
                      raw === '0'
                        ? `0 (${t('frameworkConfig.interaction.cooldownOff')})`
                        : `${raw} s`
                    }
                    onChange={(raw) => {
                      const parsed = Number.parseInt(raw, 10);
                      if (!Number.isNaN(parsed) && parsed >= 0) {
                        onUpdateField(miscGroup.id, 'SameUserEventCD', parsed);
                      }
                    }}
                  />
                </FieldShell>
              )}

              {cacheGroup?.config.CacheHours && (
                <FieldShell
                  label={cacheGroup.config.CacheHours.title || 'CacheHours'}
                  help={cacheGroup.config.CacheHours.desc}
                  modified={isFieldModified(cacheGroup, origCache, 'CacheHours')}
                  onReset={() => onResetField(cacheGroup.id, 'CacheHours')}
                >
                  <InputWithDropdown
                    value={String(cacheHours)}
                    options={cacheHourOptions}
                    showClearValueAction={false}
                    className="bg-background/60"
                    formatLabel={(raw) =>
                      raw === '0'
                        ? `0 (${t('frameworkConfig.progressive.statusDisabled')})`
                        : `${raw} h`
                    }
                    onChange={(raw) => {
                      const parsed = Number.parseInt(raw, 10);
                      if (!Number.isNaN(parsed) && parsed >= 0) {
                        onUpdateField(cacheGroup.id, 'CacheHours', parsed);
                      }
                    }}
                  />
                </FieldShell>
              )}

              {miscGroup?.config.BlackList && (
                <FieldShell
                  label={
                    miscGroup.config.BlackList.title ||
                    t('frameworkConfig.interaction.blacklistLabel')
                  }
                  help={miscGroup.config.BlackList.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'BlackList')}
                  onReset={() => onResetField(miscGroup.id, 'BlackList')}
                >
                  <TagsInput
                    value={blackList}
                    onChange={(next) => onUpdateField(miscGroup.id, 'BlackList', next)}
                    placeholder={t('frameworkConfig.interaction.blacklistPlaceholder')}
                  />
                </FieldShell>
              )}

              {miscGroup?.config.ShieldQQBot && (
                <FieldShell
                  label={miscGroup.config.ShieldQQBot.title || 'ShieldQQBot'}
                  help={miscGroup.config.ShieldQQBot.desc}
                  modified={isFieldModified(miscGroup, origMisc, 'ShieldQQBot')}
                  onReset={() => onResetField(miscGroup.id, 'ShieldQQBot')}
                >
                  <TagsInput
                    value={shieldQqBots}
                    options={shieldQqBotOptions}
                    onChange={(next) => onUpdateField(miscGroup.id, 'ShieldQQBot', next)}
                  />
                </FieldShell>
              )}
            </div>
          </ProgressiveSectionCard>

          {miscGroup && (
            <UnexpectedFieldsCard
              group={miscGroup}
              originalGroup={origMisc}
              expectedKeys={MISC_EXPECTED_KEYS}
              onUpdateField={onUpdateField}
              onResetField={onResetField}
            />
          )}

          {cacheGroup && (
            <UnexpectedFieldsCard
              group={cacheGroup}
              originalGroup={origCache}
              expectedKeys={CACHE_EXPECTED_KEYS}
              onUpdateField={onUpdateField}
              onResetField={onResetField}
            />
          )}
        </>
      )}

      {buttonMdGroup && (
        <>
          <ProgressiveSectionCard
            icon={<MousePointerClick className="h-5 w-5" />}
            title={t('frameworkConfig.interaction.richMediaCardTitle')}
            help={t('frameworkConfig.interaction.richMediaCardHelp')}
            changedCount={btnModifiedCount}
            onResetSection={() => {
              BUTTON_MD_EXPECTED_KEYS.forEach((k) => {
                if (isFieldModified(buttonMdGroup, origBtn, k)) {
                  onResetField(buttonMdGroup.id, k);
                }
              });
            }}
          >
            {(buttonMdGroup.config.SendMDPlatform || buttonMdGroup.config.SendButtonsPlatform) && (
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-8">
                {buttonMdGroup.config.SendMDPlatform && (
                  <FieldShell
                    label={
                      buttonMdGroup.config.SendMDPlatform.title ||
                      t('frameworkConfig.interaction.mdPlatformLabel')
                    }
                    help={buttonMdGroup.config.SendMDPlatform.desc}
                    badge={
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateField(buttonMdGroup.id, 'SendMDPlatform', mdPlatformPool)
                          }
                          className="text-[11px] text-primary hover:underline"
                        >
                          {t('frameworkConfig.progressive.selectAll')}
                        </button>
                        {mdPlatforms.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onUpdateField(buttonMdGroup.id, 'SendMDPlatform', [])}
                            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {t('frameworkConfig.progressive.clearAll')}
                          </button>
                        )}
                      </div>
                    }
                    modified={isFieldModified(buttonMdGroup, origBtn, 'SendMDPlatform')}
                    onReset={() => onResetField(buttonMdGroup.id, 'SendMDPlatform')}
                  >
                    <PlatformToggleGrid
                      options={mdPlatformPool}
                      value={mdPlatforms}
                      onChange={(next) => onUpdateField(buttonMdGroup.id, 'SendMDPlatform', next)}
                    />
                  </FieldShell>
                )}

                {buttonMdGroup.config.SendButtonsPlatform && (
                  <FieldShell
                    label={
                      buttonMdGroup.config.SendButtonsPlatform.title ||
                      t('frameworkConfig.interaction.btnPlatformLabel')
                    }
                    help={buttonMdGroup.config.SendButtonsPlatform.desc}
                    badge={
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateField(buttonMdGroup.id, 'SendButtonsPlatform', btnPlatformPool)
                          }
                          className="text-[11px] text-primary hover:underline"
                        >
                          {t('frameworkConfig.progressive.selectAll')}
                        </button>
                        {btnPlatforms.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateField(buttonMdGroup.id, 'SendButtonsPlatform', [])
                            }
                            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {t('frameworkConfig.progressive.clearAll')}
                          </button>
                        )}
                      </div>
                    }
                    modified={isFieldModified(buttonMdGroup, origBtn, 'SendButtonsPlatform')}
                    onReset={() => onResetField(buttonMdGroup.id, 'SendButtonsPlatform')}
                  >
                    <PlatformToggleGrid
                      options={btnPlatformPool}
                      value={btnPlatforms}
                      onChange={(next) =>
                        onUpdateField(buttonMdGroup.id, 'SendButtonsPlatform', next)
                      }
                    />
                  </FieldShell>
                )}
              </div>
            )}

            {showButtonRow && buttonMdGroup.config.ButtonRow && (
              <div className={cn(FIELD_GRID_CLASS, 'border-t border-border/40 pt-4')}>
                <FieldShell
                  label={
                    buttonMdGroup.config.ButtonRow.title ||
                    t('frameworkConfig.interaction.buttonRowLabel')
                  }
                  help={buttonMdGroup.config.ButtonRow.desc}
                  modified={isFieldModified(buttonMdGroup, origBtn, 'ButtonRow')}
                  onReset={() => onResetField(buttonMdGroup.id, 'ButtonRow')}
                >
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((num) => {
                      const active = buttonRow === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => onUpdateField(buttonMdGroup.id, 'ButtonRow', num)}
                          className={cn(
                            'h-10 min-w-0 truncate rounded-lg border px-1 text-[11px] font-medium transition-colors sm:text-xs',
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                          )}
                        >
                          {t('frameworkConfig.interaction.buttonPerRow', { count: num })}
                        </button>
                      );
                    })}
                  </div>
                </FieldShell>
              </div>
            )}

            {hasRichMediaSwitches && (
              <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-4')}>
                {buttonMdGroup.config.TryTemplateForQQ && (
                  <SwitchTile
                    label={buttonMdGroup.config.TryTemplateForQQ.title || 'TryTemplateForQQ'}
                    help={buttonMdGroup.config.TryTemplateForQQ.desc}
                    checked={tryTemplateForQQ}
                    onCheckedChange={(v) => onUpdateField(buttonMdGroup.id, 'TryTemplateForQQ', v)}
                    modified={
                      isFieldModified(buttonMdGroup, origBtn, 'TryTemplateForQQ') ||
                      isFieldModified(buttonMdGroup, origBtn, 'SendTemplatePlatform')
                    }
                    onReset={() => {
                      onResetField(buttonMdGroup.id, 'TryTemplateForQQ');
                      if (buttonMdGroup.config.SendTemplatePlatform) {
                        onResetField(buttonMdGroup.id, 'SendTemplatePlatform');
                      }
                    }}
                  >
                    {buttonMdGroup.config.SendTemplatePlatform && (
                      <FieldShell
                        label={
                          buttonMdGroup.config.SendTemplatePlatform.title ||
                          t('frameworkConfig.interaction.tplPlatformLabel')
                        }
                        help={buttonMdGroup.config.SendTemplatePlatform.desc}
                      >
                        <PlatformToggleGrid
                          options={tplPlatformPool}
                          value={tplPlatforms}
                          onChange={(next) =>
                            onUpdateField(buttonMdGroup.id, 'SendTemplatePlatform', next)
                          }
                          gridClassName="grid-cols-3 gap-1.5"
                        />
                      </FieldShell>
                    )}
                  </SwitchTile>
                )}

                {buttonMdGroup.config.ForceSendMD && (
                  <SwitchTile
                    label={buttonMdGroup.config.ForceSendMD.title || 'ForceSendMD'}
                    help={buttonMdGroup.config.ForceSendMD.desc}
                    checked={forceSendMD}
                    onCheckedChange={(v) => onUpdateField(buttonMdGroup.id, 'ForceSendMD', v)}
                    modified={isFieldModified(buttonMdGroup, origBtn, 'ForceSendMD')}
                    onReset={() => onResetField(buttonMdGroup.id, 'ForceSendMD')}
                    tone="warning"
                  />
                )}

                {showMdSubSwitches && buttonMdGroup.config.UseCRLFReplaceLFForMD && (
                  <SwitchTile
                    label={
                      buttonMdGroup.config.UseCRLFReplaceLFForMD.title || 'UseCRLFReplaceLFForMD'
                    }
                    help={buttonMdGroup.config.UseCRLFReplaceLFForMD.desc}
                    checked={useCrlf}
                    onCheckedChange={(v) =>
                      onUpdateField(buttonMdGroup.id, 'UseCRLFReplaceLFForMD', v)
                    }
                    modified={isFieldModified(buttonMdGroup, origBtn, 'UseCRLFReplaceLFForMD')}
                    onReset={() => onResetField(buttonMdGroup.id, 'UseCRLFReplaceLFForMD')}
                  />
                )}

                {showMdSubSwitches && buttonMdGroup.config.SplitMDAndButtons && (
                  <SwitchTile
                    label={buttonMdGroup.config.SplitMDAndButtons.title || 'SplitMDAndButtons'}
                    help={buttonMdGroup.config.SplitMDAndButtons.desc}
                    checked={splitMdAndBtn}
                    onCheckedChange={(v) => onUpdateField(buttonMdGroup.id, 'SplitMDAndButtons', v)}
                    modified={isFieldModified(buttonMdGroup, origBtn, 'SplitMDAndButtons')}
                    onReset={() => onResetField(buttonMdGroup.id, 'SplitMDAndButtons')}
                  />
                )}
              </div>
            )}
          </ProgressiveSectionCard>

          <UnexpectedFieldsCard
            group={buttonMdGroup}
            originalGroup={origBtn}
            expectedKeys={BUTTON_MD_EXPECTED_KEYS}
            onUpdateField={onUpdateField}
            onResetField={onResetField}
          />
        </>
      )}
    </div>
  );
}
