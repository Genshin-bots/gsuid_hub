import * as React from 'react';
import { Database } from 'lucide-react';
import { SecretInput } from '@/components/config';
import { Input } from '@/components/ui/input';
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

const DB_EXPECTED_KEYS = [
  'db_type',
  'db_driver',
  'db_custom_url',
  'db_host',
  'db_port',
  'db_user',
  'db_password',
  'db_name',
  'db_pool_size',
  'db_pool_recycle',
  'db_echo',
  'sqlite_cache_size',
  'sqlite_synchronous',
] as const;

const SQLITE_CACHE_OPTIONS = ['-16000', '-64000', '-128000', '-256000'] as const;

const SQLITE_CACHE_LABELS: Record<string, string> = {
  '-16000': '-16000 KiB (16 MB)',
  '-64000': '-64000 KiB (64 MB)',
  '-128000': '-128000 KiB (128 MB)',
  '-256000': '-256000 KiB (256 MB)',
};

function buildMaskedDsn(params: {
  dbType: string;
  driver: string;
  host: string;
  port: string;
  user: string;
  hasPassword: boolean;
  dbName: string;
}): string {
  const proto =
    params.dbType.toLowerCase() === 'mysql'
      ? `mysql+${params.driver || 'aiomysql'}`
      : 'postgresql+asyncpg';
  const auth = params.user ? `${params.user}${params.hasPassword ? ':••••••' : ''}@` : '';
  const defaultPort = params.dbType.toLowerCase() === 'mysql' ? '3306' : '5432';
  const hostPart = `${params.host || '127.0.0.1'}:${params.port || defaultPort}`;
  return `${proto}://${auth}${hostPart}/${params.dbName || 'GsData'}`;
}

export function DatabaseSection({
  groups,
  originalConfigs,
  onUpdateField,
  onResetField,
}: FrameworkSectionSharedProps) {
  const { t } = useLanguage();
  const dbGroup = groups.find((g) => g.role === 'database');

  const engineOptions = React.useMemo(() => {
    const rawOpts = dbGroup?.config.db_type?.options;
    const defaults = ['SQLite', 'MySql', 'PostgreSQL', '自定义'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return defaults;
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [dbGroup?.config.db_type?.options]);

  const syncOptions = React.useMemo(() => {
    const rawOpts = dbGroup?.config.sqlite_synchronous?.options;
    const defaults = ['NORMAL', 'FULL', 'OFF'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return defaults;
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [dbGroup?.config.sqlite_synchronous?.options]);

  const driverOptions = React.useMemo(() => {
    const rawOpts = dbGroup?.config.db_driver?.options;
    const defaults = ['aiomysql', 'asyncmy'];
    if (!Array.isArray(rawOpts) || rawOpts.length === 0) return defaults;
    return rawOpts.map((o) => String(o)).filter(Boolean);
  }, [dbGroup?.config.db_driver?.options]);

  if (!dbGroup) {
    return (
      <EmptyState
        icon={<Database className="h-8 w-8" />}
        title={t('frameworkConfig.noFrameworkConfig')}
      />
    );
  }

  const origDb = originalConfigs[dbGroup.id];
  const cfg = dbGroup.config;

  const dbType = String(cfg.db_type?.value ?? 'SQLite');
  const dbTypeLower = dbType.toLowerCase();
  const isSqlite = dbTypeLower === 'sqlite';
  const isMysql = dbTypeLower === 'mysql';
  const isPostgres = dbTypeLower === 'postgresql' || dbTypeLower === 'postgres';
  const isServerDb = isMysql || isPostgres;
  const isCustom = !isSqlite && !isServerDb;

  const driver = String(cfg.db_driver?.value ?? 'aiomysql');
  const host = String(cfg.db_host?.value ?? '127.0.0.1');
  const port = String(cfg.db_port?.value ?? (isMysql ? '3306' : '5432'));
  const user = String(cfg.db_user?.value ?? '');
  const password = String(cfg.db_password?.value ?? '');
  const dbName = String(cfg.db_name?.value ?? 'GsData');
  const customUrl = String(cfg.db_custom_url?.value ?? '');
  const dbEcho = Boolean(cfg.db_echo?.value);

  const sqliteCacheRaw = cfg.sqlite_cache_size?.value;
  const sqliteCacheNum =
    typeof sqliteCacheRaw === 'number'
      ? sqliteCacheRaw
      : Number.parseInt(String(sqliteCacheRaw ?? -64000), 10) || -64000;
  const sqliteSync = String(cfg.sqlite_synchronous?.value ?? 'NORMAL');

  const expectedModifiedCount = DB_EXPECTED_KEYS.filter((k) =>
    isFieldModified(dbGroup, origDb, k),
  ).length;

  const showPoolSettings =
    !isSqlite ||
    isFieldModified(dbGroup, origDb, 'db_pool_size') ||
    isFieldModified(dbGroup, origDb, 'db_pool_recycle');

  const dsnText = buildMaskedDsn({
    dbType,
    driver,
    host,
    port,
    user,
    hasPassword: Boolean(password),
    dbName,
  });

  const formatEngineLabel = (opt: string) => {
    const displayName = opt === '自定义' ? t('frameworkConfig.database.engineCustom') : opt;
    if (opt.toLowerCase() === 'sqlite') {
      return `${displayName} (${t('frameworkConfig.runtime.venvRecommended')})`;
    }
    return displayName;
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <ProgressiveSectionCard
        icon={<Database className="h-5 w-5" />}
        title={t('frameworkConfig.database.engineCardTitle')}
        help={t('frameworkConfig.database.engineCardHelp')}
        changedCount={expectedModifiedCount}
        headerExtra={
          <code
            className="hidden max-w-xs truncate font-mono text-xs text-muted-foreground md:inline"
            title={
              isSqlite ? 'sqlite+aiosqlite:///data/GsData.db' : isServerDb ? dsnText : customUrl
            }
          >
            {isSqlite ? 'data/GsData.db' : isServerDb ? dsnText : ''}
          </code>
        }
        onResetSection={() => {
          DB_EXPECTED_KEYS.forEach((k) => {
            if (isFieldModified(dbGroup, origDb, k)) {
              onResetField(dbGroup.id, k);
            }
          });
        }}
      >
        <div className={FIELD_GRID_CLASS}>
          {cfg.db_type && (
            <FieldShell
              label={cfg.db_type.title || t('frameworkConfig.database.engineSelectLabel')}
              help={cfg.db_type.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_type')}
              onReset={() => onResetField(dbGroup.id, 'db_type')}
            >
              <Select
                value={dbType}
                onValueChange={(opt) => onUpdateField(dbGroup.id, 'db_type', opt)}
              >
                <SelectTrigger className="h-10 bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {engineOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {formatEngineLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          )}

          {isSqlite && cfg.sqlite_cache_size && (
            <FieldShell
              label={cfg.sqlite_cache_size.title || t('frameworkConfig.database.sqliteCacheLabel')}
              help={cfg.sqlite_cache_size.desc || t('frameworkConfig.database.sqliteCacheHelp')}
              modified={isFieldModified(dbGroup, origDb, 'sqlite_cache_size')}
              onReset={() => onResetField(dbGroup.id, 'sqlite_cache_size')}
            >
              <InputWithDropdown
                value={String(sqliteCacheNum)}
                options={SQLITE_CACHE_OPTIONS}
                showClearValueAction={false}
                className="bg-background/60 font-mono"
                formatLabel={(raw) => SQLITE_CACHE_LABELS[raw] ?? `${raw} KiB`}
                onChange={(raw) => {
                  const parsed = Number.parseInt(raw, 10);
                  if (!Number.isNaN(parsed)) {
                    onUpdateField(dbGroup.id, 'sqlite_cache_size', parsed);
                  }
                }}
              />
            </FieldShell>
          )}

          {isSqlite && cfg.sqlite_synchronous && (
            <FieldShell
              label={cfg.sqlite_synchronous.title || t('frameworkConfig.database.sqliteSyncLabel')}
              help={cfg.sqlite_synchronous.desc || t('frameworkConfig.database.sqliteSyncHelp')}
              modified={isFieldModified(dbGroup, origDb, 'sqlite_synchronous')}
              onReset={() => onResetField(dbGroup.id, 'sqlite_synchronous')}
            >
              <Select
                value={sqliteSync}
                onValueChange={(v) => onUpdateField(dbGroup.id, 'sqlite_synchronous', v)}
              >
                <SelectTrigger className="h-10 bg-background/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {syncOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          )}

          {isServerDb && isMysql && cfg.db_driver && (
            <FieldShell
              label={cfg.db_driver.title || t('frameworkConfig.database.driverLabel')}
              help={cfg.db_driver.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_driver')}
              onReset={() => onResetField(dbGroup.id, 'db_driver')}
            >
              <Select
                value={driver}
                onValueChange={(v) => onUpdateField(dbGroup.id, 'db_driver', v)}
              >
                <SelectTrigger className="h-10 bg-background/60 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {driverOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>
          )}

          {isServerDb && cfg.db_host && (
            <FieldShell
              label={cfg.db_host.title || 'Host'}
              help={cfg.db_host.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_host')}
              onReset={() => onResetField(dbGroup.id, 'db_host')}
            >
              <Input
                value={host}
                onChange={(e) => onUpdateField(dbGroup.id, 'db_host', e.target.value)}
                placeholder="127.0.0.1"
                className="h-10 bg-background/60 font-mono text-sm"
              />
            </FieldShell>
          )}

          {isServerDb && cfg.db_port && (
            <FieldShell
              label={cfg.db_port.title || 'Port'}
              help={cfg.db_port.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_port')}
              onReset={() => onResetField(dbGroup.id, 'db_port')}
            >
              <Input
                value={port}
                onChange={(e) => onUpdateField(dbGroup.id, 'db_port', e.target.value)}
                placeholder={isMysql ? '3306' : '5432'}
                className="h-10 bg-background/60 font-mono text-sm"
              />
            </FieldShell>
          )}

          {isServerDb && cfg.db_name && (
            <FieldShell
              label={cfg.db_name.title || 'Database'}
              help={cfg.db_name.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_name')}
              onReset={() => onResetField(dbGroup.id, 'db_name')}
            >
              <Input
                value={dbName}
                onChange={(e) => onUpdateField(dbGroup.id, 'db_name', e.target.value)}
                placeholder="GsData"
                className="h-10 bg-background/60 font-mono text-sm"
              />
            </FieldShell>
          )}

          {isServerDb && cfg.db_user && (
            <FieldShell
              label={cfg.db_user.title || 'Username'}
              help={cfg.db_user.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_user')}
              onReset={() => onResetField(dbGroup.id, 'db_user')}
            >
              <Input
                value={user}
                onChange={(e) => onUpdateField(dbGroup.id, 'db_user', e.target.value)}
                placeholder={isMysql ? 'root' : 'postgres'}
                className="h-10 bg-background/60 text-sm"
              />
            </FieldShell>
          )}

          {isServerDb && cfg.db_password && (
            <FieldShell
              label={cfg.db_password.title || 'Password'}
              help={cfg.db_password.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_password')}
              onReset={() => onResetField(dbGroup.id, 'db_password')}
            >
              <SecretInput
                value={password}
                onChange={(val) => onUpdateField(dbGroup.id, 'db_password', val)}
                className="bg-background/60"
              />
            </FieldShell>
          )}

          {isCustom && cfg.db_custom_url && (
            <FieldShell
              label={cfg.db_custom_url.title || t('frameworkConfig.database.customUrlLabel')}
              help={cfg.db_custom_url.desc || t('frameworkConfig.database.customUrlHelp')}
              modified={isFieldModified(dbGroup, origDb, 'db_custom_url')}
              onReset={() => onResetField(dbGroup.id, 'db_custom_url')}
            >
              {cfg.db_custom_url.secret ? (
                <SecretInput
                  value={customUrl}
                  onChange={(v) => onUpdateField(dbGroup.id, 'db_custom_url', v)}
                  placeholder="postgresql+asyncpg://user:pass@localhost:5432/dbname"
                  className="bg-background/60 font-mono"
                />
              ) : (
                <Input
                  value={customUrl}
                  onChange={(e) => onUpdateField(dbGroup.id, 'db_custom_url', e.target.value)}
                  placeholder="postgresql+asyncpg://user:pass@localhost:5432/dbname"
                  className="h-10 bg-background/60 font-mono text-sm"
                />
              )}
            </FieldShell>
          )}

          {showPoolSettings && cfg.db_pool_size && (
            <FieldShell
              label={cfg.db_pool_size.title || t('frameworkConfig.database.poolSizeLabel')}
              help={cfg.db_pool_size.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_pool_size')}
              onReset={() => onResetField(dbGroup.id, 'db_pool_size')}
            >
              <NumberInput
                min={1}
                step={1}
                value={(cfg.db_pool_size.value as number | string) ?? 5}
                onValueChange={(next) => onUpdateField(dbGroup.id, 'db_pool_size', next)}
              />
            </FieldShell>
          )}

          {showPoolSettings && cfg.db_pool_recycle && (
            <FieldShell
              label={cfg.db_pool_recycle.title || t('frameworkConfig.database.poolRecycleLabel')}
              help={cfg.db_pool_recycle.desc}
              modified={isFieldModified(dbGroup, origDb, 'db_pool_recycle')}
              onReset={() => onResetField(dbGroup.id, 'db_pool_recycle')}
            >
              <NumberInput
                min={60}
                step={60}
                suffix="s"
                value={(cfg.db_pool_recycle.value as number | string) ?? 1500}
                onValueChange={(next) => onUpdateField(dbGroup.id, 'db_pool_recycle', next)}
              />
            </FieldShell>
          )}
        </div>

        {cfg.db_echo && (
          <div className={cn(SWITCH_GRID_CLASS, 'border-t border-border/40 pt-3.5')}>
            <SwitchTile
              label={cfg.db_echo.title || t('frameworkConfig.database.echoLabel')}
              help={cfg.db_echo.desc || t('frameworkConfig.database.echoHelp')}
              checked={dbEcho}
              onCheckedChange={(v) => onUpdateField(dbGroup.id, 'db_echo', v)}
              modified={isFieldModified(dbGroup, origDb, 'db_echo')}
              onReset={() => onResetField(dbGroup.id, 'db_echo')}
              tone="warning"
            />
          </div>
        )}
      </ProgressiveSectionCard>

      <UnexpectedFieldsCard
        group={dbGroup}
        originalGroup={origDb}
        expectedKeys={DB_EXPECTED_KEYS}
        onUpdateField={onUpdateField}
        onResetField={onResetField}
      />
    </div>
  );
}
