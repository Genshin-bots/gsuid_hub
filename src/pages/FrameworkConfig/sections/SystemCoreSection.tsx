import * as React from 'react';
import { AlertTriangle, Network, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { ConfigField, SecretInput, TagsInput } from '@/components/config';
import { Badge } from '@/components/ui/badge';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { cn } from '@/lib/utils';
import { isFieldModified } from '../classifyGroups';
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

const SYSTEM_CORE_EXPECTED_KEYS = [
  'HOST',
  'PORT',
  'ENABLE_HTTP',
  'WS_TOKEN',
  'REGISTER_CODE',
  'LANGUAGE',
  'TRUSTED_IPS',
  'web_max_sessions',
  'web_cors_origins',
  'masters',
  'superusers',
  'command_start',
  'framework_aliases',
  'enable_empty_start',
  'misfire_grace_time',
  'log_level',
  'log_output',
  'log_module',
  'default_bg',
] as const;

function toStrArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v)).filter(Boolean);
}

export function SystemCoreSection({
  groups,
  originalConfigs,
  coreOptionsMeta,
  onUpdateField,
  onResetField,
}: FrameworkSectionSharedProps) {
  const { t } = useLanguage();
  const [showRestartHint, setShowRestartHint] = React.useState(true);

  const coreGroup = groups.find((g) => g.role === 'systemCore');
  if (!coreGroup) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title={t('coreFrameworkConfig.loadFailed')}
      />
    );
  }

  const orig = originalConfigs[coreGroup.id];
  const cfg = coreGroup.config;

  const networkKeys = [
    'HOST',
    'PORT',
    'ENABLE_HTTP',
    'WS_TOKEN',
    'REGISTER_CODE',
    'LANGUAGE',
    'TRUSTED_IPS',
    'web_max_sessions',
    'web_cors_origins',
  ];
  const permissionKeys = [
    'masters',
    'superusers',
    'command_start',
    'framework_aliases',
    'enable_empty_start',
  ];
  const lowLevelKeys = [
    'misfire_grace_time',
    'log_level',
    'log_output',
    'log_module',
    'default_bg',
  ];

  const countModified = (keys: string[]) =>
    keys.filter((k) => isFieldModified(coreGroup, orig, k)).length;

  const resetKeys = (keys: string[]) => {
    keys.forEach((k) => {
      if (isFieldModified(coreGroup, orig, k)) {
        onResetField(coreGroup.id, k);
      }
    });
  };

  const langMeta = coreOptionsMeta?.LANGUAGE;
  const langOptions =
    langMeta?.options && langMeta.options.length > 0
      ? langMeta.options
      : cfg.LANGUAGE?.options && cfg.LANGUAGE.options.length > 0
        ? cfg.LANGUAGE.options.map((o) => String(o))
        : ['zh-cn', 'en'];

  const logLevelMeta = coreOptionsMeta?.log_level;
  const logLevelOptions =
    logLevelMeta?.options && logLevelMeta.options.length > 0
      ? logLevelMeta.options
      : ['TRACE', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

  const logOutputMeta = coreOptionsMeta?.log_output;
  const logOutputValues = toStrArray(cfg.log_output?.value);

  const toggleLogOutput = (channel: string) => {
    if (logOutputValues.includes(channel)) {
      onUpdateField(
        coreGroup.id,
        'log_output',
        logOutputValues.filter((item) => item !== channel),
      );
    } else {
      onUpdateField(coreGroup.id, 'log_output', [...logOutputValues, channel]);
    }
  };

  return (
    <div className={pageStackClass}>
      {showRestartHint && (
        <GlassAlert tone="warning" icon={AlertTriangle} className="items-center">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs sm:text-sm">
              {t('coreFrameworkConfig.warning')}
            </p>
            <button
              type="button"
              onClick={() => setShowRestartHint(false)}
              className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
              aria-label={t('common.close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </GlassAlert>
      )}

      <ProgressiveSectionCard
        icon={<Network className="h-5 w-5" />}
        title={t('frameworkConfig.systemCore.networkCardTitle')}
        help={t('frameworkConfig.systemCore.networkCardHelp')}
        changedCount={countModified(networkKeys)}
        onResetSection={() => resetKeys(networkKeys)}
      >
        <div className={FIELD_GRID_CLASS}>
          {cfg.HOST && (
            <FieldShell
              label={cfg.HOST.title || t('coreFrameworkConfig.host')}
              help={cfg.HOST.desc}
              modified={isFieldModified(coreGroup, orig, 'HOST')}
              onReset={() => onResetField(coreGroup.id, 'HOST')}
            >
              <Input
                value={String(cfg.HOST.value ?? '')}
                onChange={(e) => onUpdateField(coreGroup.id, 'HOST', e.target.value)}
                placeholder="127.0.0.1"
                className="h-10 bg-background/60 font-mono text-sm"
              />
            </FieldShell>
          )}

          {cfg.PORT && (
            <FieldShell
              label={cfg.PORT.title || t('coreFrameworkConfig.port')}
              help={cfg.PORT.desc}
              modified={isFieldModified(coreGroup, orig, 'PORT')}
              onReset={() => onResetField(coreGroup.id, 'PORT')}
            >
              <Input
                value={String(cfg.PORT.value ?? '')}
                onChange={(e) => onUpdateField(coreGroup.id, 'PORT', e.target.value)}
                placeholder="8765"
                className="h-10 bg-background/60 font-mono text-sm"
              />
            </FieldShell>
          )}

          {cfg.LANGUAGE && (
            <FieldShell
              label={cfg.LANGUAGE.title || t('coreFrameworkConfig.language')}
              help={cfg.LANGUAGE.desc || t('coreFrameworkConfig.languageDesc')}
              modified={isFieldModified(coreGroup, orig, 'LANGUAGE')}
              onReset={() => onResetField(coreGroup.id, 'LANGUAGE')}
            >
              <Select
                value={String(cfg.LANGUAGE.value ?? langOptions[0] ?? 'zh-cn')}
                onValueChange={(v) => onUpdateField(coreGroup.id, 'LANGUAGE', v)}
              >
                <SelectTrigger className="h-10 bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {langOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {langMeta?.labels?.[opt] ?? opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          )}

          {cfg.web_max_sessions && (
            <FieldShell
              label={cfg.web_max_sessions.title || t('coreFrameworkConfig.webMaxSessions')}
              help={cfg.web_max_sessions.desc || t('coreFrameworkConfig.webMaxSessionsDesc')}
              modified={isFieldModified(coreGroup, orig, 'web_max_sessions')}
              onReset={() => onResetField(coreGroup.id, 'web_max_sessions')}
            >
              <NumberInput
                min={1}
                step={1}
                value={(cfg.web_max_sessions.value as number | string) ?? 1}
                onValueChange={(next) => onUpdateField(coreGroup.id, 'web_max_sessions', next)}
              />
            </FieldShell>
          )}

          {cfg.WS_TOKEN && (
            <FieldShell
              label={cfg.WS_TOKEN.title || t('coreFrameworkConfig.wsToken')}
              help={cfg.WS_TOKEN.desc}
              modified={isFieldModified(coreGroup, orig, 'WS_TOKEN')}
              onReset={() => onResetField(coreGroup.id, 'WS_TOKEN')}
            >
              <SecretInput
                value={String(cfg.WS_TOKEN.value ?? '')}
                onChange={(v) => onUpdateField(coreGroup.id, 'WS_TOKEN', v)}
                className="bg-background/60 font-mono"
              />
            </FieldShell>
          )}

          {cfg.REGISTER_CODE && (
            <FieldShell
              label={cfg.REGISTER_CODE.title || t('coreFrameworkConfig.registerCode')}
              help={cfg.REGISTER_CODE.desc}
              modified={isFieldModified(coreGroup, orig, 'REGISTER_CODE')}
              onReset={() => onResetField(coreGroup.id, 'REGISTER_CODE')}
            >
              <SecretInput
                value={String(cfg.REGISTER_CODE.value ?? '')}
                onChange={(v) => onUpdateField(coreGroup.id, 'REGISTER_CODE', v)}
                className="bg-background/60 font-mono"
              />
            </FieldShell>
          )}

          {cfg.TRUSTED_IPS && (
            <FieldShell
              label={cfg.TRUSTED_IPS.title || t('coreFrameworkConfig.trustedIps')}
              help={cfg.TRUSTED_IPS.desc}
              modified={isFieldModified(coreGroup, orig, 'TRUSTED_IPS')}
              onReset={() => onResetField(coreGroup.id, 'TRUSTED_IPS')}
            >
              <TagsInput
                value={toStrArray(cfg.TRUSTED_IPS.value)}
                onChange={(v) => onUpdateField(coreGroup.id, 'TRUSTED_IPS', v)}
                placeholder={t('coreFrameworkConfig.enterTags')}
              />
            </FieldShell>
          )}

          {cfg.web_cors_origins && (
            <FieldShell
              label={cfg.web_cors_origins.title || t('coreFrameworkConfig.webCorsOrigins')}
              help={cfg.web_cors_origins.desc || t('coreFrameworkConfig.webCorsOriginsDesc')}
              modified={isFieldModified(coreGroup, orig, 'web_cors_origins')}
              onReset={() => onResetField(coreGroup.id, 'web_cors_origins')}
            >
              <TagsInput
                value={toStrArray(cfg.web_cors_origins.value)}
                onChange={(v) => onUpdateField(coreGroup.id, 'web_cors_origins', v)}
                placeholder={t('coreFrameworkConfig.webCorsOriginsPlaceholder')}
              />
            </FieldShell>
          )}
        </div>

        {cfg.ENABLE_HTTP && (
          <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
            <SwitchTile
              label={cfg.ENABLE_HTTP.title || t('coreFrameworkConfig.enableHttp')}
              help={cfg.ENABLE_HTTP.desc}
              checked={Boolean(cfg.ENABLE_HTTP.value)}
              onCheckedChange={(v) => onUpdateField(coreGroup.id, 'ENABLE_HTTP', v)}
              modified={isFieldModified(coreGroup, orig, 'ENABLE_HTTP')}
              onReset={() => onResetField(coreGroup.id, 'ENABLE_HTTP')}
            />
          </div>
        )}
      </ProgressiveSectionCard>

      <ProgressiveSectionCard
        icon={<ShieldCheck className="h-5 w-5" />}
        title={t('frameworkConfig.systemCore.authCardTitle')}
        help={t('frameworkConfig.systemCore.authCardHelp')}
        changedCount={countModified(permissionKeys)}
        onResetSection={() => resetKeys(permissionKeys)}
      >
        <div className={FIELD_GRID_CLASS}>
          {cfg.masters && (
            <FieldShell
              label={cfg.masters.title || t('coreFrameworkConfig.masters')}
              help={cfg.masters.desc || t('coreFrameworkConfig.mastersDesc')}
              badge={
                <Badge variant="outline" className="h-5 shrink-0 px-1.5 font-mono text-[10px]">
                  pm=0
                </Badge>
              }
              modified={isFieldModified(coreGroup, orig, 'masters')}
              onReset={() => onResetField(coreGroup.id, 'masters')}
            >
              <TagsInput
                value={toStrArray(cfg.masters.value)}
                onChange={(v) => onUpdateField(coreGroup.id, 'masters', v)}
                placeholder={t('coreFrameworkConfig.enterTags')}
              />
            </FieldShell>
          )}

          {cfg.superusers && (
            <FieldShell
              label={cfg.superusers.title || t('coreFrameworkConfig.superusers')}
              help={cfg.superusers.desc || t('coreFrameworkConfig.superusersDesc')}
              badge={
                <Badge variant="outline" className="h-5 shrink-0 px-1.5 font-mono text-[10px]">
                  pm=1
                </Badge>
              }
              modified={isFieldModified(coreGroup, orig, 'superusers')}
              onReset={() => onResetField(coreGroup.id, 'superusers')}
            >
              <TagsInput
                value={toStrArray(cfg.superusers.value)}
                onChange={(v) => onUpdateField(coreGroup.id, 'superusers', v)}
                placeholder={t('coreFrameworkConfig.enterTags')}
              />
            </FieldShell>
          )}

          {cfg.command_start && (
            <FieldShell
              label={cfg.command_start.title || t('coreFrameworkConfig.commandPrefix')}
              help={cfg.command_start.desc}
              modified={isFieldModified(coreGroup, orig, 'command_start')}
              onReset={() => onResetField(coreGroup.id, 'command_start')}
            >
              <TagsInput
                value={toStrArray(cfg.command_start.value)}
                onChange={(v) => onUpdateField(coreGroup.id, 'command_start', v)}
                placeholder={t('coreFrameworkConfig.enterTags')}
              />
            </FieldShell>
          )}

          {cfg.framework_aliases && (
            <FieldShell
              label={cfg.framework_aliases.title || t('coreConfig.framework_aliases')}
              help={cfg.framework_aliases.desc}
              modified={isFieldModified(coreGroup, orig, 'framework_aliases')}
              onReset={() => onResetField(coreGroup.id, 'framework_aliases')}
            >
              <TagsInput
                value={toStrArray(cfg.framework_aliases.value)}
                onChange={(v) => onUpdateField(coreGroup.id, 'framework_aliases', v)}
                placeholder={t('coreFrameworkConfig.enterTags')}
              />
            </FieldShell>
          )}
        </div>

        {cfg.enable_empty_start && (
          <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
            <SwitchTile
              label={cfg.enable_empty_start.title || t('coreFrameworkConfig.emptyStart')}
              help={cfg.enable_empty_start.desc}
              checked={Boolean(cfg.enable_empty_start.value)}
              onCheckedChange={(v) => onUpdateField(coreGroup.id, 'enable_empty_start', v)}
              modified={isFieldModified(coreGroup, orig, 'enable_empty_start')}
              onReset={() => onResetField(coreGroup.id, 'enable_empty_start')}
            />
          </div>
        )}
      </ProgressiveSectionCard>

      {lowLevelKeys.some((k) => Boolean(cfg[k])) && (
        <ProgressiveSectionCard
          icon={<SlidersHorizontal className="h-5 w-5" />}
          title={t('frameworkConfig.systemCore.lowLevelCardTitle')}
          help={t('frameworkConfig.systemCore.lowLevelCardHelp')}
          changedCount={countModified(lowLevelKeys)}
          onResetSection={() => resetKeys(lowLevelKeys)}
        >
          <div className={FIELD_GRID_CLASS}>
            {cfg.log_level && (
              <FieldShell
                label={cfg.log_level.title || t('coreFrameworkConfig.logLevel')}
                help={cfg.log_level.desc}
                modified={isFieldModified(coreGroup, orig, 'log_level')}
                onReset={() => onResetField(coreGroup.id, 'log_level')}
              >
                <Select
                  value={String(cfg.log_level.value ?? 'INFO')}
                  onValueChange={(v) => onUpdateField(coreGroup.id, 'log_level', v)}
                >
                  <SelectTrigger className="h-10 bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {logLevelOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {logLevelMeta?.labels?.[opt] ?? opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldShell>
            )}

            {cfg.misfire_grace_time && (
              <FieldShell
                label={cfg.misfire_grace_time.title || t('coreFrameworkConfig.misfireGraceTime')}
                help={cfg.misfire_grace_time.desc}
                modified={isFieldModified(coreGroup, orig, 'misfire_grace_time')}
                onReset={() => onResetField(coreGroup.id, 'misfire_grace_time')}
              >
                <NumberInput
                  min={1}
                  step={5}
                  suffix="s"
                  value={(cfg.misfire_grace_time.value as number | string) ?? 90}
                  onValueChange={(next) => onUpdateField(coreGroup.id, 'misfire_grace_time', next)}
                />
              </FieldShell>
            )}

            {cfg.log_output && (
              <FieldShell
                label={cfg.log_output.title || t('coreFrameworkConfig.logOutput')}
                help={cfg.log_output.desc}
                modified={isFieldModified(coreGroup, orig, 'log_output')}
                onReset={() => onResetField(coreGroup.id, 'log_output')}
              >
                {logOutputMeta?.options && logOutputMeta.options.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {logOutputMeta.options.map((opt) => {
                      const active = logOutputValues.includes(opt);
                      const label = logOutputMeta.labels?.[opt] ?? opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleLogOutput(opt)}
                          title={label}
                          className={cn(
                            'h-10 min-w-0 truncate rounded-lg border px-3 text-xs font-medium transition-colors',
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <TagsInput
                    value={logOutputValues}
                    onChange={(v) => onUpdateField(coreGroup.id, 'log_output', v)}
                    placeholder={t('coreFrameworkConfig.enterTags')}
                  />
                )}
              </FieldShell>
            )}

            {cfg.default_bg && (
              <FieldShell
                label={cfg.default_bg.title || t('coreFrameworkConfig.defaultBg')}
                help={cfg.default_bg.desc}
                modified={isFieldModified(coreGroup, orig, 'default_bg')}
                onReset={() => onResetField(coreGroup.id, 'default_bg')}
              >
                <ConfigField
                  fieldKey="default_bg"
                  showLabel={false}
                  field={{
                    type: 'image',
                    label: 'default_bg',
                    value: String(cfg.default_bg.value ?? ''),
                    upload_to: 'data',
                    filename: 'bg',
                    suffix: 'jpg',
                  }}
                  onChange={(_k, v) => onUpdateField(coreGroup.id, 'default_bg', v)}
                />
              </FieldShell>
            )}
          </div>

          {cfg.log_module && (
            <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
              <SwitchTile
                label={cfg.log_module.title || t('coreFrameworkConfig.showModuleLog')}
                help={cfg.log_module.desc}
                checked={Boolean(cfg.log_module.value)}
                onCheckedChange={(v) => onUpdateField(coreGroup.id, 'log_module', v)}
                modified={isFieldModified(coreGroup, orig, 'log_module')}
                onReset={() => onResetField(coreGroup.id, 'log_module')}
              />
            </div>
          )}
        </ProgressiveSectionCard>
      )}

      <UnexpectedFieldsCard
        group={coreGroup}
        originalGroup={orig}
        expectedKeys={SYSTEM_CORE_EXPECTED_KEYS}
        onUpdateField={onUpdateField}
        onResetField={onResetField}
      />
    </div>
  );
}
