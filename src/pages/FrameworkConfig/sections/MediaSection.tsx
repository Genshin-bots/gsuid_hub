import * as React from 'react';
import {
  AlertTriangle,
  CloudUpload,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Send,
  Sparkles,
  Webhook,
} from 'lucide-react';
import { DynamicConfigPanel, SecretInput } from '@/components/config';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { isFieldModified, isNonEditableField } from '../classifyGroups';
import { PlatformBrandIcon } from '../shared/PlatformBrandIcon';
import {
  EmptyState,
  FIELD_GRID_CLASS,
  FieldResetAction,
  FieldShell,
  ProgressiveSectionCard,
  SWITCH_GRID_CLASS,
  SwitchTile,
  UnexpectedFieldsCard,
} from '../shared/ProgressivePrimitives';
import type { FrameworkSectionSharedProps } from '../types';

const UPLOAD_EXPECTED_KEYS = [
  'EnablePicSrv',
  'PicUploader',
  'AutoDelete',
  'smms_token',
  's3_endpoint',
  's3_access_key',
  's3_secret_key',
  's3_bucket',
  's3_region',
  'custom_url',
  'custom_header',
  'PicSrv',
  'EnableCleanPicSrv',
  'ScheduledCleanPicSrv',
] as const;

const DEFAULT_SEND_MODES = ['base64', 'link_local', 'link_remote', 'link'] as const;

const UPLOADER_ICONS: Record<string, React.ReactNode> = {
  smms: <CloudUpload className="h-4 w-4 shrink-0 text-sky-500" />,
  s3: <Layers className="h-4 w-4 shrink-0 text-amber-500" />,
  local: <HardDrive className="h-4 w-4 shrink-0 text-emerald-500" />,
  custom: <Webhook className="h-4 w-4 shrink-0 text-violet-500" />,
};

export function MediaSection({
  groups,
  originalConfigs,
  changedFieldsByGroup,
  onUpdateField,
  onBatchUpdateFields,
  onResetField,
  onResetGroup,
}: FrameworkSectionSharedProps) {
  const { t } = useLanguage();

  const uploadGroup = groups.find((g) => g.role === 'imageUpload');
  const sendGroup = groups.find((g) => g.role === 'imageSend');
  const genGroups = groups.filter((g) => g.role === 'imageGen');

  const uploaderOptions = React.useMemo(() => {
    const rawOpts = uploadGroup?.config.PicUploader?.options;
    const defaults = ['smms', 's3', 'local', 'custom'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return defaults;
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [uploadGroup?.config.PicUploader?.options]);

  const sendEntries = React.useMemo(() => {
    if (!sendGroup) return [];
    return Object.entries(sendGroup.config).filter(([, item]) => !isNonEditableField(item));
  }, [sendGroup]);

  if (!uploadGroup && !sendGroup && genGroups.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="h-8 w-8" />}
        title={t('frameworkConfig.noFrameworkConfig')}
      />
    );
  }

  const origUpload = uploadGroup ? originalConfigs[uploadGroup.id] : undefined;
  const origSend = sendGroup ? originalConfigs[sendGroup.id] : undefined;

  const enablePicSrv = Boolean(uploadGroup?.config.EnablePicSrv?.value);
  const picUploader = String(uploadGroup?.config.PicUploader?.value ?? 'local');
  const autoDelete = Boolean(uploadGroup?.config.AutoDelete?.value);
  const enableCleanPicSrv = Boolean(uploadGroup?.config.EnableCleanPicSrv?.value);

  const remoteDependentPlatforms = sendEntries
    .filter(([, item]) => {
      const v = String(item.value ?? '');
      return v === 'link_remote' || v === 'link';
    })
    .map(([k, item]) => item.title || k);

  const hasPicSrvConflict =
    Boolean(uploadGroup) && !enablePicSrv && remoteDependentPlatforms.length > 0;

  const getModeShortLabel = (mode: string) => {
    switch (mode) {
      case 'base64':
        return 'Base64';
      case 'link_local':
        return t('frameworkConfig.media.modeLocalShort');
      case 'link_remote':
        return t('frameworkConfig.media.modeRemoteShort');
      case 'link':
        return t('frameworkConfig.media.modeAutoLinkShort');
      default:
        return mode;
    }
  };

  const getUploaderLabel = (key: string) => {
    switch (key) {
      case 'smms':
        return 'SM.MS';
      case 's3':
        return 'S3 / R2 / OSS';
      case 'local':
        return t('frameworkConfig.media.uploaderLocal');
      case 'custom':
        return t('frameworkConfig.media.uploaderCustom');
      default:
        return key.toUpperCase();
    }
  };

  const uploadExpectedModifiedCount = uploadGroup
    ? UPLOAD_EXPECTED_KEYS.filter((k) => isFieldModified(uploadGroup, origUpload, k)).length
    : 0;

  const applyBatchSendMode = (mode: string) => {
    if (!sendGroup) return;
    const patch: Record<string, unknown> = {};
    sendEntries.forEach(([key, item]) => {
      const opts =
        Array.isArray(item.options) && item.options.length > 0
          ? item.options.map((o) => String(o))
          : [...DEFAULT_SEND_MODES];
      if (opts.includes(mode)) {
        patch[key] = mode;
      }
    });
    onBatchUpdateFields(sendGroup.id, patch);
  };

  const hasUploadSwitches = Boolean(
    uploadGroup &&
      ((picUploader === 'local' && uploadGroup.config.EnableCleanPicSrv) ||
        uploadGroup.config.AutoDelete),
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {hasPicSrvConflict && uploadGroup && (
        <GlassAlert tone="warning" icon={AlertTriangle}>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold sm:text-sm">
                {t('frameworkConfig.media.conflictTitle')}
              </p>
              <p
                className="mt-0.5 truncate text-xs opacity-90"
                title={remoteDependentPlatforms.join(', ')}
              >
                {t('frameworkConfig.media.conflictDesc', {
                  platforms: remoteDependentPlatforms.slice(0, 4).join(' / '),
                  count: remoteDependentPlatforms.length,
                })}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onUpdateField(uploadGroup.id, 'EnablePicSrv', true)}
              className="button-solid h-9 shrink-0 self-start whitespace-nowrap text-xs sm:self-auto"
            >
              {t('frameworkConfig.media.enablePicSrvNow')}
            </Button>
          </div>
        </GlassAlert>
      )}

      {uploadGroup && (
        <>
          <ProgressiveSectionCard
            icon={<CloudUpload className="h-5 w-5" />}
            title={t('frameworkConfig.media.uploadCardTitle')}
            help={t('frameworkConfig.media.uploadCardHelp')}
            changedCount={uploadExpectedModifiedCount}
            onResetSection={() => {
              UPLOAD_EXPECTED_KEYS.forEach((k) => {
                if (isFieldModified(uploadGroup, origUpload, k)) {
                  onResetField(uploadGroup.id, k);
                }
              });
            }}
            masterSwitch={
              uploadGroup.config.EnablePicSrv
                ? {
                    checked: enablePicSrv,
                    onCheckedChange: (v) => onUpdateField(uploadGroup.id, 'EnablePicSrv', v),
                    collapsedHint: t('frameworkConfig.media.picSrvCollapsedHint'),
                  }
                : undefined
            }
          >
            <div className={FIELD_GRID_CLASS}>
              {uploadGroup.config.PicUploader && (
                <FieldShell
                  label={
                    uploadGroup.config.PicUploader.title ||
                    t('frameworkConfig.media.uploaderSelectLabel')
                  }
                  help={uploadGroup.config.PicUploader.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 'PicUploader')}
                  onReset={() => onResetField(uploadGroup.id, 'PicUploader')}
                >
                  <Select
                    value={picUploader}
                    onValueChange={(opt) => onUpdateField(uploadGroup.id, 'PicUploader', opt)}
                  >
                    <SelectTrigger className="h-10 bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {uploaderOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          <span className="inline-flex items-center gap-2">
                            {UPLOADER_ICONS[opt] ?? (
                              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span>{getUploaderLabel(opt)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}

              {picUploader === 'smms' && uploadGroup.config.smms_token && (
                <FieldShell
                  label={uploadGroup.config.smms_token.title || 'SM.MS API Token'}
                  help={uploadGroup.config.smms_token.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 'smms_token')}
                  onReset={() => onResetField(uploadGroup.id, 'smms_token')}
                >
                  <SecretInput
                    value={String(uploadGroup.config.smms_token.value ?? '')}
                    onChange={(v) => onUpdateField(uploadGroup.id, 'smms_token', v)}
                    placeholder="SM.MS Secret Token"
                    className="bg-background/60"
                  />
                </FieldShell>
              )}

              {picUploader === 's3' && uploadGroup.config.s3_endpoint && (
                <FieldShell
                  label={uploadGroup.config.s3_endpoint.title || 'S3 Endpoint'}
                  help={uploadGroup.config.s3_endpoint.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 's3_endpoint')}
                  onReset={() => onResetField(uploadGroup.id, 's3_endpoint')}
                >
                  <Input
                    value={String(uploadGroup.config.s3_endpoint.value ?? '')}
                    onChange={(e) => onUpdateField(uploadGroup.id, 's3_endpoint', e.target.value)}
                    placeholder="https://s3.amazonaws.com"
                    className="h-10 bg-background/60 font-mono text-sm"
                  />
                </FieldShell>
              )}

              {picUploader === 's3' && uploadGroup.config.s3_bucket && (
                <FieldShell
                  label={uploadGroup.config.s3_bucket.title || 'Bucket'}
                  help={uploadGroup.config.s3_bucket.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 's3_bucket')}
                  onReset={() => onResetField(uploadGroup.id, 's3_bucket')}
                >
                  <Input
                    value={String(uploadGroup.config.s3_bucket.value ?? '')}
                    onChange={(e) => onUpdateField(uploadGroup.id, 's3_bucket', e.target.value)}
                    placeholder="gscore-images"
                    className="h-10 bg-background/60 font-mono text-sm"
                  />
                </FieldShell>
              )}

              {picUploader === 's3' && uploadGroup.config.s3_region && (
                <FieldShell
                  label={uploadGroup.config.s3_region.title || 'Region'}
                  help={uploadGroup.config.s3_region.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 's3_region')}
                  onReset={() => onResetField(uploadGroup.id, 's3_region')}
                >
                  <Input
                    value={String(uploadGroup.config.s3_region.value ?? '')}
                    onChange={(e) => onUpdateField(uploadGroup.id, 's3_region', e.target.value)}
                    placeholder="auto / us-east-1"
                    className="h-10 bg-background/60 font-mono text-sm"
                  />
                </FieldShell>
              )}

              {picUploader === 's3' && uploadGroup.config.s3_access_key && (
                <FieldShell
                  label={uploadGroup.config.s3_access_key.title || 'Access Key'}
                  help={uploadGroup.config.s3_access_key.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 's3_access_key')}
                  onReset={() => onResetField(uploadGroup.id, 's3_access_key')}
                >
                  <SecretInput
                    value={String(uploadGroup.config.s3_access_key.value ?? '')}
                    onChange={(v) => onUpdateField(uploadGroup.id, 's3_access_key', v)}
                    className="bg-background/60"
                  />
                </FieldShell>
              )}

              {picUploader === 's3' && uploadGroup.config.s3_secret_key && (
                <FieldShell
                  label={uploadGroup.config.s3_secret_key.title || 'Secret Key'}
                  help={uploadGroup.config.s3_secret_key.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 's3_secret_key')}
                  onReset={() => onResetField(uploadGroup.id, 's3_secret_key')}
                >
                  <SecretInput
                    value={String(uploadGroup.config.s3_secret_key.value ?? '')}
                    onChange={(v) => onUpdateField(uploadGroup.id, 's3_secret_key', v)}
                    className="bg-background/60"
                  />
                </FieldShell>
              )}

              {picUploader === 'local' && uploadGroup.config.PicSrv && (
                <FieldShell
                  label={
                    uploadGroup.config.PicSrv.title ||
                    t('frameworkConfig.media.localPicSrvUrlLabel')
                  }
                  help={uploadGroup.config.PicSrv.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 'PicSrv')}
                  onReset={() => onResetField(uploadGroup.id, 'PicSrv')}
                >
                  <Input
                    value={String(uploadGroup.config.PicSrv.value ?? '')}
                    onChange={(e) => onUpdateField(uploadGroup.id, 'PicSrv', e.target.value)}
                    placeholder="http://127.0.0.1:8765"
                    className="h-10 bg-background/60 font-mono text-sm"
                  />
                </FieldShell>
              )}

              {picUploader === 'custom' && uploadGroup.config.custom_url && (
                <FieldShell
                  label={uploadGroup.config.custom_url.title || 'Custom Upload URL'}
                  help={uploadGroup.config.custom_url.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 'custom_url')}
                  onReset={() => onResetField(uploadGroup.id, 'custom_url')}
                >
                  <Input
                    value={String(uploadGroup.config.custom_url.value ?? '')}
                    onChange={(e) => onUpdateField(uploadGroup.id, 'custom_url', e.target.value)}
                    placeholder="https://img.example.com/api/upload"
                    className="h-10 bg-background/60 font-mono text-sm"
                  />
                </FieldShell>
              )}

              {picUploader === 'custom' && uploadGroup.config.custom_header && (
                <FieldShell
                  label={uploadGroup.config.custom_header.title || 'Custom Headers (JSON)'}
                  help={uploadGroup.config.custom_header.desc}
                  modified={isFieldModified(uploadGroup, origUpload, 'custom_header')}
                  onReset={() => onResetField(uploadGroup.id, 'custom_header')}
                >
                  <SecretInput
                    value={
                      typeof uploadGroup.config.custom_header.value === 'object' &&
                      uploadGroup.config.custom_header.value !== null
                        ? JSON.stringify(uploadGroup.config.custom_header.value)
                        : String(uploadGroup.config.custom_header.value ?? '')
                    }
                    onChange={(v) => onUpdateField(uploadGroup.id, 'custom_header', v)}
                    placeholder='{"Authorization": "Bearer ..."}'
                    className="bg-background/60 font-mono"
                  />
                </FieldShell>
              )}
            </div>

            {hasUploadSwitches && (
              <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
                {picUploader === 'local' && uploadGroup.config.EnableCleanPicSrv && (
                  <SwitchTile
                    label={
                      uploadGroup.config.EnableCleanPicSrv.title ||
                      t('frameworkConfig.media.enableCleanLabel')
                    }
                    help={uploadGroup.config.EnableCleanPicSrv.desc}
                    checked={enableCleanPicSrv}
                    onCheckedChange={(v) => onUpdateField(uploadGroup.id, 'EnableCleanPicSrv', v)}
                    modified={
                      isFieldModified(uploadGroup, origUpload, 'EnableCleanPicSrv') ||
                      isFieldModified(uploadGroup, origUpload, 'ScheduledCleanPicSrv')
                    }
                    onReset={() => {
                      onResetField(uploadGroup.id, 'EnableCleanPicSrv');
                      onResetField(uploadGroup.id, 'ScheduledCleanPicSrv');
                    }}
                  >
                    {uploadGroup.config.ScheduledCleanPicSrv && (
                      <FieldShell
                        label={
                          uploadGroup.config.ScheduledCleanPicSrv.title ||
                          t('frameworkConfig.media.cleanSecondsLabel')
                        }
                        help={uploadGroup.config.ScheduledCleanPicSrv.desc}
                      >
                        <NumberInput
                          min={10}
                          step={10}
                          suffix="s"
                          value={String(uploadGroup.config.ScheduledCleanPicSrv.value ?? '180')}
                          onValueChange={(next) =>
                            onUpdateField(uploadGroup.id, 'ScheduledCleanPicSrv', String(next))
                          }
                        />
                      </FieldShell>
                    )}
                  </SwitchTile>
                )}

                {uploadGroup.config.AutoDelete && (
                  <SwitchTile
                    label={
                      uploadGroup.config.AutoDelete.title ||
                      t('frameworkConfig.media.autoDeleteLabel')
                    }
                    help={uploadGroup.config.AutoDelete.desc}
                    checked={autoDelete}
                    onCheckedChange={(v) => onUpdateField(uploadGroup.id, 'AutoDelete', v)}
                    modified={isFieldModified(uploadGroup, origUpload, 'AutoDelete')}
                    onReset={() => onResetField(uploadGroup.id, 'AutoDelete')}
                  />
                )}
              </div>
            )}
          </ProgressiveSectionCard>

          <UnexpectedFieldsCard
            group={uploadGroup}
            originalGroup={origUpload}
            expectedKeys={UPLOAD_EXPECTED_KEYS}
            onUpdateField={onUpdateField}
            onResetField={onResetField}
          />
        </>
      )}

      {sendGroup && sendEntries.length > 0 && (
        <ProgressiveSectionCard
          icon={<Send className="h-5 w-5" />}
          title={t('frameworkConfig.media.sendMatrixTitle')}
          help={t('frameworkConfig.media.sendMatrixHelp')}
          changedCount={changedFieldsByGroup[sendGroup.id]?.length ?? 0}
          onResetSection={() => onResetGroup(sendGroup.id)}
        >
          <div className="flex flex-col gap-2 border-b border-border/40 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate text-xs text-muted-foreground">
              {t('frameworkConfig.media.batchApplyLabel')}
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
              {DEFAULT_SEND_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyBatchSendMode(mode)}
                  className="h-8 px-2.5 text-xs"
                >
                  {getModeShortLabel(mode)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
            {sendEntries.map(([platformKey, item]) => {
              const currentMode = String(item.value ?? 'base64');
              const modes =
                Array.isArray(item.options) && item.options.length > 0
                  ? item.options.map((o) => String(o))
                  : [...DEFAULT_SEND_MODES];
              const modified = isFieldModified(sendGroup, origSend, platformKey);
              const displayTitle = item.title || platformKey;

              return (
                <div
                  key={platformKey}
                  className="flex flex-col gap-2 border-b border-border/40 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlatformBrandIcon
                        platform={platformKey}
                        size={16}
                        className="h-4 w-4 shrink-0"
                      />
                      <span
                        className="min-w-0 truncate text-sm font-medium text-foreground"
                        title={displayTitle}
                      >
                        {displayTitle}
                      </span>
                      <code className="hidden shrink-0 font-mono text-[11px] text-muted-foreground xl:inline">
                        {platformKey}
                      </code>
                    </div>
                    <FieldResetAction
                      modified={modified}
                      onReset={() => onResetField(sendGroup.id, platformKey)}
                    />
                  </div>

                  <div className="grid shrink-0 grid-cols-4 gap-0.5 rounded-lg border border-border/60 p-0.5">
                    {modes.map((mode) => {
                      const active = currentMode === mode;
                      const label = getModeShortLabel(mode);
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onUpdateField(sendGroup.id, platformKey, mode)}
                          title={label}
                          className={cn(
                            'min-w-0 truncate rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ProgressiveSectionCard>
      )}

      {genGroups.map((genGroup) => {
        const editableCount = Object.values(genGroup.config).filter(
          (item) => !isNonEditableField(item),
        ).length;
        if (editableCount === 0) return null;
        return (
          <ProgressiveSectionCard
            key={genGroup.id}
            icon={<Sparkles className="h-5 w-5" />}
            title={t('frameworkConfig.media.imageGenCardTitle')}
            help={t('frameworkConfig.media.imageGenCardHelp')}
            changedCount={changedFieldsByGroup[genGroup.id]?.length ?? 0}
            onResetSection={() => onResetGroup(genGroup.id)}
          >
            <DynamicConfigPanel
              config={genGroup.config}
              configId={genGroup.id}
              onChange={onUpdateField}
            />
          </ProgressiveSectionCard>
        );
      })}
    </div>
  );
}
