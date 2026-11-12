import * as React from 'react';
import { Bot, ChevronRight, Puzzle, ShieldAlert, Sparkles } from 'lucide-react';
import {
  ConfigField,
  DynamicConfigPanel,
  pluginConfigItemToFieldDef,
  SecretInput,
  TagsInput,
} from '@/components/config';
import { Input } from '@/components/ui/input';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { NumberInput } from '@/components/ui/number-input';
import { useLanguage } from '@/contexts/LanguageContext';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { cn } from '@/lib/utils';
import { isFieldModified, isNonEditableField } from '../classifyGroups';
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

const STATE_EXPECTED_KEYS = [
  'CustomName',
  'CustomNameAlias',
  'CustomSubtitle',
  'CustomTheme',
  'StatusCacheTTL',
  'CustomBg',
  'CustomBgPath',
  'CustomIcon',
  'CustomIconPath',
] as const;

const VERIFICATION_EXPECTED_KEYS = ['_pass_API', 'CaptchaPass', 'MysPass'] as const;

const DEFAULT_THEME_PRESETS = ['#5E4FA9', '#38A1F3', '#FFC107', '#4CAF50', '#F44336'] as const;

function toStrArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v)).filter(Boolean);
}

export function IdentitySection({
  groups,
  originalConfigs,
  changedFieldsByGroup,
  onUpdateField,
  onResetField,
  onResetGroup,
}: FrameworkSectionSharedProps) {
  const { t } = useLanguage();
  const [showDeprecatedVerify, setShowDeprecatedVerify] = React.useState(false);

  const stateGroup = groups.find((g) => g.role === 'state');
  const verificationGroup = groups.find((g) => g.role === 'verification');
  const extensionGroups = groups.filter((g) => g.role === 'extension');

  const themePresets = React.useMemo(() => {
    const rawOpts = stateGroup?.config.CustomTheme?.options;
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return [...DEFAULT_THEME_PRESETS];
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [stateGroup?.config.CustomTheme?.options]);

  if (!stateGroup && !verificationGroup && extensionGroups.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title={t('frameworkConfig.noFrameworkConfig')}
      />
    );
  }

  const origState = stateGroup ? originalConfigs[stateGroup.id] : undefined;
  const origVerify = verificationGroup ? originalConfigs[verificationGroup.id] : undefined;

  const stateExpectedModifiedCount = stateGroup
    ? STATE_EXPECTED_KEYS.filter((k) => isFieldModified(stateGroup, origState, k)).length
    : 0;

  const captchaPass = Boolean(verificationGroup?.config.CaptchaPass?.value);
  const mysPass = Boolean(verificationGroup?.config.MysPass?.value);
  const verifyExpectedModifiedCount = verificationGroup
    ? VERIFICATION_EXPECTED_KEYS.filter((k) => isFieldModified(verificationGroup, origVerify, k))
        .length
    : 0;

  const hasLegacyVerifyFields = Boolean(
    verificationGroup?.config.CaptchaPass || verificationGroup?.config.MysPass,
  );
  const shouldShowDeprecated =
    showDeprecatedVerify ||
    captchaPass ||
    mysPass ||
    Boolean(verificationGroup && isFieldModified(verificationGroup, origVerify, 'CaptchaPass')) ||
    Boolean(verificationGroup && isFieldModified(verificationGroup, origVerify, 'MysPass'));

  const currentThemeHex = String(stateGroup?.config.CustomTheme?.value ?? '#5E4FA9');
  const aliasOptions = Array.isArray(stateGroup?.config.CustomNameAlias?.options)
    ? stateGroup.config.CustomNameAlias.options.map((o) => String(o)).filter(Boolean)
    : undefined;

  return (
    <div className={pageStackClass}>
      {stateGroup && (
        <>
          <ProgressiveSectionCard
            icon={<Bot className="h-5 w-5" />}
            title={t('frameworkConfig.identity.profileCardTitle')}
            help={t('frameworkConfig.identity.profileCardHelp')}
            changedCount={stateExpectedModifiedCount}
            onResetSection={() => {
              STATE_EXPECTED_KEYS.forEach((k) => {
                if (isFieldModified(stateGroup, origState, k)) {
                  onResetField(stateGroup.id, k);
                }
              });
            }}
          >
            <div className={FIELD_GRID_CLASS}>
              {stateGroup.config.CustomName && (
                <FieldShell
                  label={stateGroup.config.CustomName.title || 'CustomName'}
                  help={stateGroup.config.CustomName.desc}
                  modified={isFieldModified(stateGroup, origState, 'CustomName')}
                  onReset={() => onResetField(stateGroup.id, 'CustomName')}
                >
                  {Array.isArray(stateGroup.config.CustomName.options) &&
                  stateGroup.config.CustomName.options.length > 0 ? (
                    <InputWithDropdown
                      value={String(stateGroup.config.CustomName.value ?? '')}
                      onChange={(v) => onUpdateField(stateGroup.id, 'CustomName', v)}
                      options={stateGroup.config.CustomName.options}
                      className="bg-background/60"
                    />
                  ) : (
                    <Input
                      value={String(stateGroup.config.CustomName.value ?? '')}
                      onChange={(e) => onUpdateField(stateGroup.id, 'CustomName', e.target.value)}
                      className="h-10 bg-background/60 text-sm"
                    />
                  )}
                </FieldShell>
              )}

              {stateGroup.config.CustomSubtitle && (
                <FieldShell
                  label={stateGroup.config.CustomSubtitle.title || 'CustomSubtitle'}
                  help={stateGroup.config.CustomSubtitle.desc}
                  modified={isFieldModified(stateGroup, origState, 'CustomSubtitle')}
                  onReset={() => onResetField(stateGroup.id, 'CustomSubtitle')}
                >
                  {Array.isArray(stateGroup.config.CustomSubtitle.options) &&
                  stateGroup.config.CustomSubtitle.options.length > 0 ? (
                    <InputWithDropdown
                      value={String(stateGroup.config.CustomSubtitle.value ?? '')}
                      onChange={(v) => onUpdateField(stateGroup.id, 'CustomSubtitle', v)}
                      options={stateGroup.config.CustomSubtitle.options}
                      className="bg-background/60"
                    />
                  ) : (
                    <Input
                      value={String(stateGroup.config.CustomSubtitle.value ?? '')}
                      onChange={(e) =>
                        onUpdateField(stateGroup.id, 'CustomSubtitle', e.target.value)
                      }
                      className="h-10 bg-background/60 text-sm"
                    />
                  )}
                </FieldShell>
              )}

              {stateGroup.config.CustomNameAlias && (
                <FieldShell
                  label={stateGroup.config.CustomNameAlias.title || 'CustomNameAlias'}
                  help={stateGroup.config.CustomNameAlias.desc}
                  modified={isFieldModified(stateGroup, origState, 'CustomNameAlias')}
                  onReset={() => onResetField(stateGroup.id, 'CustomNameAlias')}
                >
                  <TagsInput
                    value={toStrArray(stateGroup.config.CustomNameAlias.value)}
                    options={aliasOptions}
                    onChange={(v) => onUpdateField(stateGroup.id, 'CustomNameAlias', v)}
                  />
                </FieldShell>
              )}

              {stateGroup.config.CustomTheme && (
                <FieldShell
                  label={stateGroup.config.CustomTheme.title || 'CustomTheme'}
                  help={stateGroup.config.CustomTheme.desc}
                  modified={isFieldModified(stateGroup, origState, 'CustomTheme')}
                  onReset={() => onResetField(stateGroup.id, 'CustomTheme')}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="hidden shrink-0 items-center gap-1 sm:flex">
                      {themePresets.slice(0, 5).map((hex) => {
                        const active = currentThemeHex.toLowerCase() === hex.toLowerCase();
                        return (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => onUpdateField(stateGroup.id, 'CustomTheme', hex)}
                            title={hex}
                            style={{ backgroundColor: hex }}
                            className={cn(
                              'h-5 w-5 shrink-0 rounded-full border transition-transform',
                              active
                                ? 'scale-110 border-foreground ring-2 ring-primary/40'
                                : 'border-border/60 opacity-80 hover:opacity-100',
                            )}
                          />
                        );
                      })}
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <span
                        style={{ backgroundColor: currentThemeHex || '#5E4FA9' }}
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-border/60 sm:hidden"
                      />
                      <Input
                        value={String(stateGroup.config.CustomTheme.value ?? '')}
                        onChange={(e) =>
                          onUpdateField(stateGroup.id, 'CustomTheme', e.target.value)
                        }
                        placeholder="#5E4FA9"
                        className="h-10 min-w-0 bg-background/60 pl-7 font-mono text-sm sm:pl-3"
                      />
                    </div>
                  </div>
                </FieldShell>
              )}

              {stateGroup.config.StatusCacheTTL && (
                <FieldShell
                  label={stateGroup.config.StatusCacheTTL.title || 'StatusCacheTTL'}
                  help={stateGroup.config.StatusCacheTTL.desc}
                  modified={isFieldModified(stateGroup, origState, 'StatusCacheTTL')}
                  onReset={() => onResetField(stateGroup.id, 'StatusCacheTTL')}
                >
                  <NumberInput
                    min={0}
                    step={10}
                    suffix="s"
                    value={(stateGroup.config.StatusCacheTTL.value as number | string) ?? 60}
                    onValueChange={(next) => onUpdateField(stateGroup.id, 'StatusCacheTTL', next)}
                  />
                </FieldShell>
              )}
            </div>

            {(stateGroup.config.CustomBg || stateGroup.config.CustomIcon) && (
              <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-4')}>
                {stateGroup.config.CustomBg && (
                  <SwitchTile
                    label={stateGroup.config.CustomBg.title || 'CustomBg'}
                    help={stateGroup.config.CustomBg.desc}
                    checked={Boolean(stateGroup.config.CustomBg.value)}
                    onCheckedChange={(v) => onUpdateField(stateGroup.id, 'CustomBg', v)}
                    modified={
                      isFieldModified(stateGroup, origState, 'CustomBg') ||
                      isFieldModified(stateGroup, origState, 'CustomBgPath')
                    }
                    onReset={() => {
                      onResetField(stateGroup.id, 'CustomBg');
                      if (stateGroup.config.CustomBgPath) {
                        onResetField(stateGroup.id, 'CustomBgPath');
                      }
                    }}
                  >
                    {stateGroup.config.CustomBgPath && (
                      <FieldShell
                        label={stateGroup.config.CustomBgPath.title || 'CustomBgPath'}
                        help={stateGroup.config.CustomBgPath.desc}
                      >
                        <ConfigField
                          fieldKey="CustomBgPath"
                          showLabel={false}
                          className="w-full min-w-0"
                          field={pluginConfigItemToFieldDef(
                            'CustomBgPath',
                            stateGroup.config.CustomBgPath,
                          )}
                          onChange={(_k, v) => onUpdateField(stateGroup.id, 'CustomBgPath', v)}
                        />
                      </FieldShell>
                    )}
                  </SwitchTile>
                )}

                {stateGroup.config.CustomIcon && (
                  <SwitchTile
                    label={stateGroup.config.CustomIcon.title || 'CustomIcon'}
                    help={stateGroup.config.CustomIcon.desc}
                    checked={Boolean(stateGroup.config.CustomIcon.value)}
                    onCheckedChange={(v) => onUpdateField(stateGroup.id, 'CustomIcon', v)}
                    modified={
                      isFieldModified(stateGroup, origState, 'CustomIcon') ||
                      isFieldModified(stateGroup, origState, 'CustomIconPath')
                    }
                    onReset={() => {
                      onResetField(stateGroup.id, 'CustomIcon');
                      if (stateGroup.config.CustomIconPath) {
                        onResetField(stateGroup.id, 'CustomIconPath');
                      }
                    }}
                  >
                    {stateGroup.config.CustomIconPath && (
                      <FieldShell
                        label={stateGroup.config.CustomIconPath.title || 'CustomIconPath'}
                        help={stateGroup.config.CustomIconPath.desc}
                      >
                        <ConfigField
                          fieldKey="CustomIconPath"
                          showLabel={false}
                          className="w-full min-w-0"
                          field={pluginConfigItemToFieldDef(
                            'CustomIconPath',
                            stateGroup.config.CustomIconPath,
                          )}
                          onChange={(_k, v) => onUpdateField(stateGroup.id, 'CustomIconPath', v)}
                        />
                      </FieldShell>
                    )}
                  </SwitchTile>
                )}
              </div>
            )}
          </ProgressiveSectionCard>

          <UnexpectedFieldsCard
            group={stateGroup}
            originalGroup={origState}
            expectedKeys={STATE_EXPECTED_KEYS}
            onUpdateField={onUpdateField}
            onResetField={onResetField}
          />
        </>
      )}

      {verificationGroup && (
        <>
          <ProgressiveSectionCard
            icon={<ShieldAlert className="h-5 w-5" />}
            title={t('frameworkConfig.identity.verifyCardTitle')}
            help={t('frameworkConfig.identity.verifyCardHelp')}
            changedCount={verifyExpectedModifiedCount}
            onResetSection={() => {
              VERIFICATION_EXPECTED_KEYS.forEach((k) => {
                if (isFieldModified(verificationGroup, origVerify, k)) {
                  onResetField(verificationGroup.id, k);
                }
              });
            }}
          >
            {verificationGroup.config._pass_API && (
              <div className={FIELD_GRID_CLASS}>
                <FieldShell
                  label={verificationGroup.config._pass_API.title || 'Pass API Endpoint'}
                  help={
                    verificationGroup.config._pass_API.desc ||
                    t('frameworkConfig.identity.verifyRiskNotice')
                  }
                  modified={isFieldModified(verificationGroup, origVerify, '_pass_API')}
                  onReset={() => onResetField(verificationGroup.id, '_pass_API')}
                >
                  <SecretInput
                    value={String(verificationGroup.config._pass_API.value ?? '')}
                    onChange={(v) => onUpdateField(verificationGroup.id, '_pass_API', v)}
                    placeholder="https://..."
                    className="bg-background/60 font-mono"
                  />
                </FieldShell>
              </div>
            )}

            {shouldShowDeprecated && hasLegacyVerifyFields && (
              <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
                {verificationGroup.config.CaptchaPass && (
                  <SwitchTile
                    label={verificationGroup.config.CaptchaPass.title || 'CaptchaPass'}
                    help={verificationGroup.config.CaptchaPass.desc}
                    checked={captchaPass}
                    onCheckedChange={(v) => onUpdateField(verificationGroup.id, 'CaptchaPass', v)}
                    modified={isFieldModified(verificationGroup, origVerify, 'CaptchaPass')}
                    onReset={() => onResetField(verificationGroup.id, 'CaptchaPass')}
                    tone="warning"
                  />
                )}

                {verificationGroup.config.MysPass && (
                  <SwitchTile
                    label={verificationGroup.config.MysPass.title || 'MysPass'}
                    help={verificationGroup.config.MysPass.desc}
                    checked={mysPass}
                    onCheckedChange={(v) => onUpdateField(verificationGroup.id, 'MysPass', v)}
                    modified={isFieldModified(verificationGroup, origVerify, 'MysPass')}
                    onReset={() => onResetField(verificationGroup.id, 'MysPass')}
                    tone="warning"
                  />
                )}
              </div>
            )}

            {hasLegacyVerifyFields && !shouldShowDeprecated && (
              <div className="border-t border-border/40 pt-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeprecatedVerify(true)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>{t('frameworkConfig.identity.deprecatedVerifyTitle')}</span>
                </button>
              </div>
            )}
          </ProgressiveSectionCard>

          <UnexpectedFieldsCard
            group={verificationGroup}
            originalGroup={origVerify}
            expectedKeys={VERIFICATION_EXPECTED_KEYS}
            onUpdateField={onUpdateField}
            onResetField={onResetField}
          />
        </>
      )}

      {extensionGroups.map((extGroup) => {
        const editableCount = Object.values(extGroup.config).filter(
          (item) => !isNonEditableField(item),
        ).length;
        if (editableCount === 0) return null;
        return (
          <ProgressiveSectionCard
            key={extGroup.id}
            icon={<Puzzle className="h-5 w-5" />}
            title={extGroup.name}
            changedCount={changedFieldsByGroup[extGroup.id]?.length ?? 0}
            onResetSection={() => onResetGroup(extGroup.id)}
          >
            <DynamicConfigPanel
              config={extGroup.config}
              configId={extGroup.id}
              onChange={onUpdateField}
            />
          </ProgressiveSectionCard>
        );
      })}
    </div>
  );
}
