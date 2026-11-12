import * as React from 'react';
import { Clock, Cpu, FileText, Terminal, Zap } from 'lucide-react';
import { DynamicConfigPanel } from '@/components/config';
import { Input } from '@/components/ui/input';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
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

const CORE_EXPECTED_KEYS = [
  'StartVENV',
  'GitMirror',
  'is_use_custom_restart_command',
  'restart_command',
  'AutoUpdateCore',
  'AutoUpdateCoreTime',
  'AutoUpdatePlugins',
  'AutoUpdatePluginsTime',
  'AutoRestartCore',
  'AutoRestartCoreTime',
  'AutoUpdateNotify',
  'AutoReloadPlugins',
  'AutoInstallDep',
  'AutoUpdateDep',
] as const;

const VENV_META: Record<string, { label: string; tagKey?: string }> = {
  auto: { label: 'Auto', tagKey: 'frameworkConfig.runtime.venvRecommended' },
  uv: { label: 'uv', tagKey: 'frameworkConfig.runtime.venvFast' },
  poetry: { label: 'Poetry' },
  pdm: { label: 'PDM' },
  python: { label: 'Python' },
};

const DEFAULT_GIT_MIRRORS = [
  '',
  'https://gitcode.com/gscore-mirror/',
  'https://cnb.cool/gscore-mirror/',
  'https://ghproxy.mihomo.me/',
  'ssh://',
] as const;

function normalizeTimeTuple(raw: unknown): [number, number] {
  if (Array.isArray(raw)) {
    const h = Number.parseInt(String(raw[0] ?? 0), 10);
    const m = Number.parseInt(String(raw[1] ?? 0), 10);
    return [Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m];
  }
  if (typeof raw === 'string' && raw.includes(':')) {
    const [hp, mp] = raw.split(':');
    const h = Number.parseInt(hp || '0', 10);
    const m = Number.parseInt(mp || '0', 10);
    return [Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m];
  }
  return [3, 40];
}

export function RuntimeSection({
  groups,
  originalConfigs,
  changedFieldsByGroup,
  onUpdateField,
  onResetField,
  onResetGroup,
}: FrameworkSectionSharedProps) {
  const { t } = useLanguage();

  const coreGroup = groups.find((g) => g.role === 'core');
  const logGroups = groups.filter((g) => g.role === 'log');

  const venvOptions = React.useMemo(() => {
    const rawOpts = coreGroup?.config.StartVENV?.options;
    const base = ['auto', 'uv', 'poetry', 'pdm', 'python'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return base;
    const merged = [...base];
    rawOpts.forEach((opt) => {
      const s = String(opt);
      if (s && !merged.includes(s)) merged.push(s);
    });
    return merged;
  }, [coreGroup?.config.StartVENV?.options]);

  const gitMirrorOptions = React.useMemo(() => {
    const rawOpts = coreGroup?.config.GitMirror?.options;
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return [...DEFAULT_GIT_MIRRORS];
    return rawOpts.map((o) => String(o ?? ''));
  }, [coreGroup?.config.GitMirror?.options]);

  if (!coreGroup && logGroups.length === 0) {
    return (
      <EmptyState
        icon={<Cpu className="h-8 w-8" />}
        title={t('frameworkConfig.noFrameworkConfig')}
      />
    );
  }

  const origCore = coreGroup ? originalConfigs[coreGroup.id] : undefined;
  const startVenv = String(coreGroup?.config.StartVENV?.value ?? 'auto');
  const customRestart = Boolean(coreGroup?.config.is_use_custom_restart_command?.value);
  const restartCommand = String(coreGroup?.config.restart_command?.value ?? '');

  const autoUpdateCore = Boolean(coreGroup?.config.AutoUpdateCore?.value);
  const autoUpdateCoreTime = normalizeTimeTuple(coreGroup?.config.AutoUpdateCoreTime?.value);
  const autoUpdatePlugins = Boolean(coreGroup?.config.AutoUpdatePlugins?.value);
  const autoUpdatePluginsTime = normalizeTimeTuple(coreGroup?.config.AutoUpdatePluginsTime?.value);
  const autoRestartCore = Boolean(coreGroup?.config.AutoRestartCore?.value);
  const autoRestartCoreTime = normalizeTimeTuple(coreGroup?.config.AutoRestartCoreTime?.value);
  const autoUpdateNotify = Boolean(coreGroup?.config.AutoUpdateNotify?.value);

  const autoReloadPlugins = Boolean(coreGroup?.config.AutoReloadPlugins?.value);
  const autoInstallDep = Boolean(coreGroup?.config.AutoInstallDep?.value);
  const autoUpdateDep = Boolean(coreGroup?.config.AutoUpdateDep?.value);

  const envKeys = ['StartVENV', 'GitMirror', 'is_use_custom_restart_command', 'restart_command'];
  const scheduleKeys = [
    'AutoUpdateCore',
    'AutoUpdateCoreTime',
    'AutoUpdatePlugins',
    'AutoUpdatePluginsTime',
    'AutoRestartCore',
    'AutoRestartCoreTime',
    'AutoUpdateNotify',
  ];
  const pluginKeys = ['AutoReloadPlugins', 'AutoInstallDep', 'AutoUpdateDep'];

  const countModified = (keys: string[]) =>
    coreGroup ? keys.filter((k) => isFieldModified(coreGroup, origCore, k)).length : 0;

  const resetKeys = (keys: string[]) => {
    if (!coreGroup) return;
    keys.forEach((k) => {
      if (isFieldModified(coreGroup, origCore, k)) {
        onResetField(coreGroup.id, k);
      }
    });
  };

  const formatVenvOptionLabel = (opt: string) => {
    const meta = VENV_META[opt];
    if (!meta) return opt;
    return meta.tagKey ? `${meta.label} (${t(meta.tagKey)})` : meta.label;
  };

  const showAutoUpdateNotify =
    Boolean(coreGroup?.config.AutoUpdateNotify) &&
    (autoUpdateCore ||
      autoUpdatePlugins ||
      Boolean(coreGroup && isFieldModified(coreGroup, origCore, 'AutoUpdateNotify')));

  return (
    <div className={pageStackClass}>
      {coreGroup && (
        <>
          <ProgressiveSectionCard
            icon={<Terminal className="h-5 w-5" />}
            title={t('frameworkConfig.runtime.envCardTitle')}
            help={t('frameworkConfig.runtime.envCardHelp')}
            changedCount={countModified(envKeys)}
            onResetSection={() => resetKeys(envKeys)}
          >
            {(coreGroup.config.StartVENV || coreGroup.config.GitMirror) && (
              <div className={FIELD_GRID_CLASS}>
                {coreGroup.config.StartVENV && (
                  <FieldShell
                    label={
                      coreGroup.config.StartVENV.title ||
                      t('frameworkConfig.runtime.venvFieldLabel')
                    }
                    help={
                      coreGroup.config.StartVENV.desc || t('frameworkConfig.runtime.venvFieldHelp')
                    }
                    modified={isFieldModified(coreGroup, origCore, 'StartVENV')}
                    onReset={() => onResetField(coreGroup.id, 'StartVENV')}
                  >
                    <Select
                      value={startVenv}
                      onValueChange={(v) => onUpdateField(coreGroup.id, 'StartVENV', v)}
                    >
                      <SelectTrigger className="h-10 bg-background/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {venvOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {formatVenvOptionLabel(opt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldShell>
                )}

                {coreGroup.config.GitMirror && (
                  <FieldShell
                    label={coreGroup.config.GitMirror.title || 'GitMirror'}
                    help={coreGroup.config.GitMirror.desc}
                    modified={isFieldModified(coreGroup, origCore, 'GitMirror')}
                    onReset={() => onResetField(coreGroup.id, 'GitMirror')}
                  >
                    <InputWithDropdown
                      value={String(coreGroup.config.GitMirror.value ?? '')}
                      onChange={(v) => onUpdateField(coreGroup.id, 'GitMirror', v)}
                      options={gitMirrorOptions}
                      placeholder="https://github.com/ (Direct)"
                      showClearValueAction
                      className="bg-background/60"
                      formatLabel={(raw) =>
                        raw === '' ? t('frameworkConfig.runtime.gitMirrorDirect') : raw
                      }
                    />
                  </FieldShell>
                )}
              </div>
            )}

            {coreGroup.config.is_use_custom_restart_command && (
              <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
                <SwitchTile
                  label={
                    coreGroup.config.is_use_custom_restart_command.title ||
                    t('frameworkConfig.runtime.customRestartLabel')
                  }
                  help={
                    coreGroup.config.is_use_custom_restart_command.desc ||
                    t('frameworkConfig.runtime.customRestartHelp')
                  }
                  checked={customRestart}
                  onCheckedChange={(v) =>
                    onUpdateField(coreGroup.id, 'is_use_custom_restart_command', v)
                  }
                  modified={
                    isFieldModified(coreGroup, origCore, 'is_use_custom_restart_command') ||
                    isFieldModified(coreGroup, origCore, 'restart_command')
                  }
                  onReset={() => {
                    onResetField(coreGroup.id, 'is_use_custom_restart_command');
                    if (coreGroup.config.restart_command) {
                      onResetField(coreGroup.id, 'restart_command');
                    }
                  }}
                  tone="warning"
                >
                  {coreGroup.config.restart_command && (
                    <FieldShell
                      label={
                        coreGroup.config.restart_command.title ||
                        t('frameworkConfig.runtime.restartCmdLabel')
                      }
                      help={coreGroup.config.restart_command.desc}
                    >
                      <Input
                        value={restartCommand}
                        onChange={(e) =>
                          onUpdateField(coreGroup.id, 'restart_command', e.target.value)
                        }
                        placeholder="poetry run python ..."
                        className="h-10 bg-background/60 font-mono text-sm"
                      />
                    </FieldShell>
                  )}
                </SwitchTile>
              </div>
            )}
          </ProgressiveSectionCard>

          <ProgressiveSectionCard
            icon={<Clock className="h-5 w-5" />}
            title={t('frameworkConfig.runtime.scheduleCardTitle')}
            help={t('frameworkConfig.runtime.scheduleCardHelp')}
            changedCount={countModified(scheduleKeys)}
            onResetSection={() => resetKeys(scheduleKeys)}
          >
            <div className={SWITCH_GRID_CLASS}>
              {coreGroup.config.AutoUpdateCore && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoUpdateCore.title ||
                    t('frameworkConfig.runtime.autoUpdateCore')
                  }
                  help={coreGroup.config.AutoUpdateCore.desc}
                  checked={autoUpdateCore}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoUpdateCore', v)}
                  modified={
                    isFieldModified(coreGroup, origCore, 'AutoUpdateCore') ||
                    isFieldModified(coreGroup, origCore, 'AutoUpdateCoreTime')
                  }
                  onReset={() => {
                    onResetField(coreGroup.id, 'AutoUpdateCore');
                    onResetField(coreGroup.id, 'AutoUpdateCoreTime');
                  }}
                >
                  {coreGroup.config.AutoUpdateCoreTime && (
                    <FieldShell
                      label={
                        coreGroup.config.AutoUpdateCoreTime.title ||
                        t('frameworkConfig.runtime.execTime')
                      }
                      help={coreGroup.config.AutoUpdateCoreTime.desc}
                    >
                      <TimePicker
                        value={autoUpdateCoreTime}
                        onChange={(tuple) =>
                          onUpdateField(coreGroup.id, 'AutoUpdateCoreTime', tuple)
                        }
                        className="h-10 w-full justify-start bg-background/60 text-sm"
                      />
                    </FieldShell>
                  )}
                </SwitchTile>
              )}

              {coreGroup.config.AutoUpdatePlugins && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoUpdatePlugins.title ||
                    t('frameworkConfig.runtime.autoUpdatePlugins')
                  }
                  help={coreGroup.config.AutoUpdatePlugins.desc}
                  checked={autoUpdatePlugins}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoUpdatePlugins', v)}
                  modified={
                    isFieldModified(coreGroup, origCore, 'AutoUpdatePlugins') ||
                    isFieldModified(coreGroup, origCore, 'AutoUpdatePluginsTime')
                  }
                  onReset={() => {
                    onResetField(coreGroup.id, 'AutoUpdatePlugins');
                    onResetField(coreGroup.id, 'AutoUpdatePluginsTime');
                  }}
                >
                  {coreGroup.config.AutoUpdatePluginsTime && (
                    <FieldShell
                      label={
                        coreGroup.config.AutoUpdatePluginsTime.title ||
                        t('frameworkConfig.runtime.execTime')
                      }
                      help={coreGroup.config.AutoUpdatePluginsTime.desc}
                    >
                      <TimePicker
                        value={autoUpdatePluginsTime}
                        onChange={(tuple) =>
                          onUpdateField(coreGroup.id, 'AutoUpdatePluginsTime', tuple)
                        }
                        className="h-10 w-full justify-start bg-background/60 text-sm"
                      />
                    </FieldShell>
                  )}
                </SwitchTile>
              )}

              {coreGroup.config.AutoRestartCore && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoRestartCore.title ||
                    t('frameworkConfig.runtime.autoRestartCore')
                  }
                  help={coreGroup.config.AutoRestartCore.desc}
                  checked={autoRestartCore}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoRestartCore', v)}
                  modified={
                    isFieldModified(coreGroup, origCore, 'AutoRestartCore') ||
                    isFieldModified(coreGroup, origCore, 'AutoRestartCoreTime')
                  }
                  onReset={() => {
                    onResetField(coreGroup.id, 'AutoRestartCore');
                    onResetField(coreGroup.id, 'AutoRestartCoreTime');
                  }}
                >
                  {coreGroup.config.AutoRestartCoreTime && (
                    <FieldShell
                      label={
                        coreGroup.config.AutoRestartCoreTime.title ||
                        t('frameworkConfig.runtime.execTime')
                      }
                      help={coreGroup.config.AutoRestartCoreTime.desc}
                    >
                      <TimePicker
                        value={autoRestartCoreTime}
                        onChange={(tuple) =>
                          onUpdateField(coreGroup.id, 'AutoRestartCoreTime', tuple)
                        }
                        className="h-10 w-full justify-start bg-background/60 text-sm"
                      />
                    </FieldShell>
                  )}
                </SwitchTile>
              )}

              {showAutoUpdateNotify && coreGroup.config.AutoUpdateNotify && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoUpdateNotify.title ||
                    t('frameworkConfig.runtime.autoUpdateNotify')
                  }
                  help={coreGroup.config.AutoUpdateNotify.desc}
                  checked={autoUpdateNotify}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoUpdateNotify', v)}
                  modified={isFieldModified(coreGroup, origCore, 'AutoUpdateNotify')}
                  onReset={() => onResetField(coreGroup.id, 'AutoUpdateNotify')}
                />
              )}
            </div>
          </ProgressiveSectionCard>

          <ProgressiveSectionCard
            icon={<Zap className="h-5 w-5" />}
            title={t('frameworkConfig.runtime.pluginCardTitle')}
            help={t('frameworkConfig.runtime.pluginCardHelp')}
            changedCount={countModified(pluginKeys)}
            onResetSection={() => resetKeys(pluginKeys)}
          >
            <div className={SWITCH_GRID_CLASS}>
              {coreGroup.config.AutoReloadPlugins && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoReloadPlugins.title ||
                    t('frameworkConfig.runtime.autoReloadPlugins')
                  }
                  help={coreGroup.config.AutoReloadPlugins.desc}
                  checked={autoReloadPlugins}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoReloadPlugins', v)}
                  modified={isFieldModified(coreGroup, origCore, 'AutoReloadPlugins')}
                  onReset={() => onResetField(coreGroup.id, 'AutoReloadPlugins')}
                />
              )}

              {coreGroup.config.AutoInstallDep && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoInstallDep.title ||
                    t('frameworkConfig.runtime.autoInstallDep')
                  }
                  help={coreGroup.config.AutoInstallDep.desc}
                  checked={autoInstallDep}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoInstallDep', v)}
                  modified={isFieldModified(coreGroup, origCore, 'AutoInstallDep')}
                  onReset={() => onResetField(coreGroup.id, 'AutoInstallDep')}
                />
              )}

              {coreGroup.config.AutoUpdateDep && (
                <SwitchTile
                  label={
                    coreGroup.config.AutoUpdateDep.title ||
                    t('frameworkConfig.runtime.autoUpdateDep')
                  }
                  help={coreGroup.config.AutoUpdateDep.desc}
                  checked={autoUpdateDep}
                  onCheckedChange={(v) => onUpdateField(coreGroup.id, 'AutoUpdateDep', v)}
                  modified={isFieldModified(coreGroup, origCore, 'AutoUpdateDep')}
                  onReset={() => onResetField(coreGroup.id, 'AutoUpdateDep')}
                />
              )}
            </div>
          </ProgressiveSectionCard>

          <UnexpectedFieldsCard
            group={coreGroup}
            originalGroup={origCore}
            expectedKeys={CORE_EXPECTED_KEYS}
            title={t('frameworkConfig.runtime.extraCoreTitle')}
            help={t('frameworkConfig.runtime.extraCoreHelp')}
            onUpdateField={onUpdateField}
            onResetField={onResetField}
          />
        </>
      )}

      {logGroups.map((logGroup) => {
        const editableCount = Object.values(logGroup.config).filter(
          (item) => !isNonEditableField(item),
        ).length;
        if (editableCount === 0) return null;
        const changedCount = changedFieldsByGroup[logGroup.id]?.length ?? 0;

        return (
          <ProgressiveSectionCard
            key={logGroup.id}
            icon={<FileText className="h-5 w-5" />}
            title={t('frameworkConfig.runtime.logCardTitle')}
            help={t('frameworkConfig.runtime.logCardHelp')}
            changedCount={changedCount}
            onResetSection={() => onResetGroup(logGroup.id)}
          >
            <DynamicConfigPanel
              config={logGroup.config}
              configId={logGroup.id}
              onChange={onUpdateField}
            />
          </ProgressiveSectionCard>
        );
      })}
    </div>
  );
}
