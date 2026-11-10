import type { CoreConfig, CoreConfigOptionMeta, PluginConfigItem } from '@/lib/api';
import { type RawFrameworkGroup, SYSTEM_CORE_GROUP_ID } from './types';

export const CORE_FIELD_LABEL_KEYS: Record<string, string> = {
  default_bg: 'coreFrameworkConfig.defaultBg',
  log_level: 'coreFrameworkConfig.logLevel',
  log_output: 'coreFrameworkConfig.logOutput',
  log_module: 'coreFrameworkConfig.showModuleLog',
  HOST: 'coreFrameworkConfig.host',
  PORT: 'coreFrameworkConfig.port',
  ENABLE_HTTP: 'coreFrameworkConfig.enableHttp',
  WS_TOKEN: 'coreFrameworkConfig.wsToken',
  REGISTER_CODE: 'coreFrameworkConfig.registerCode',
  LANGUAGE: 'coreFrameworkConfig.language',
  TRUSTED_IPS: 'coreFrameworkConfig.trustedIps',
  masters: 'coreFrameworkConfig.masters',
  superusers: 'coreFrameworkConfig.superusers',
  misfire_grace_time: 'coreFrameworkConfig.misfireGraceTime',
  enable_empty_start: 'coreFrameworkConfig.emptyStart',
  command_start: 'coreFrameworkConfig.commandPrefix',
  framework_aliases: 'coreConfig.framework_aliases',
  web_max_sessions: 'coreFrameworkConfig.webMaxSessions',
  web_cors_origins: 'coreFrameworkConfig.webCorsOrigins',
};

export const CORE_FIELD_DESC_KEYS: Record<string, string> = {
  masters: 'coreFrameworkConfig.mastersDesc',
  superusers: 'coreFrameworkConfig.superusersDesc',
  LANGUAGE: 'coreFrameworkConfig.languageDesc',
  web_max_sessions: 'coreFrameworkConfig.webMaxSessionsDesc',
  web_cors_origins: 'coreFrameworkConfig.webCorsOriginsDesc',
};

const SECRET_CORE_KEYS = new Set(['WS_TOKEN', 'REGISTER_CODE']);

function inferPluginConfigItem(
  key: string,
  rawValue: unknown,
  optionsMeta: Record<string, CoreConfigOptionMeta> | undefined,
  translate: (k: string) => string,
): PluginConfigItem {
  const labelKey = CORE_FIELD_LABEL_KEYS[key];
  const resolvedTitle = labelKey ? translate(labelKey) : key;
  const title = resolvedTitle === labelKey ? key : resolvedTitle;

  const descKey = CORE_FIELD_DESC_KEYS[key];
  const resolvedDesc = descKey ? translate(descKey) : '';
  const desc = resolvedDesc === descKey ? '' : resolvedDesc;

  const meta = optionsMeta?.[key];
  if (meta && Array.isArray(meta.options) && meta.options.length > 0) {
    const isMulti = meta.type === 'multiselect';
    const val = isMulti
      ? Array.isArray(rawValue)
        ? rawValue.map((v) => String(v))
        : []
      : String(rawValue ?? meta.options[0]);
    return {
      type: isMulti ? 'GsListStr' : 'GsStr',
      title,
      desc,
      value: val,
      default: val,
      options: meta.options,
    };
  }

  if (key === 'default_bg') {
    const val = String(rawValue ?? '');
    return {
      type: 'GsImage',
      title,
      desc,
      value: val,
      default: val,
      upload_to: 'data',
      filename: 'bg',
      suffix: 'jpg',
    };
  }

  if (key === 'log_level') {
    const val = String(rawValue ?? 'INFO');
    return {
      type: 'GsStr',
      title,
      desc,
      value: val,
      default: val,
      options: ['TRACE', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    };
  }

  if (
    typeof rawValue === 'boolean' ||
    key === 'ENABLE_HTTP' ||
    key === 'enable_empty_start' ||
    key === 'log_module'
  ) {
    const val = Boolean(rawValue);
    return {
      type: 'GsBool',
      title,
      desc,
      value: val,
      default: val,
    };
  }

  if (typeof rawValue === 'number' || key === 'misfire_grace_time' || key === 'web_max_sessions') {
    const num =
      typeof rawValue === 'number' ? rawValue : Number.parseInt(String(rawValue ?? 0), 10) || 0;
    return {
      type: 'GsInt',
      title,
      desc,
      value: num,
      default: num,
    };
  }

  if (
    Array.isArray(rawValue) ||
    key === 'TRUSTED_IPS' ||
    key === 'masters' ||
    key === 'superusers' ||
    key === 'command_start' ||
    key === 'web_cors_origins' ||
    key === 'log_output'
  ) {
    const arr = Array.isArray(rawValue) ? rawValue.map((v) => String(v)) : [];
    return {
      type: 'GsListStr',
      title,
      desc,
      value: arr,
      default: arr,
    };
  }

  const strVal = String(rawValue ?? '');
  return {
    type: 'GsStr',
    title,
    desc,
    value: strVal,
    default: strVal,
    secret: SECRET_CORE_KEYS.has(key),
  };
}

/**
 * 将 `/api/core/config` 扁平化为统一的 `RawFrameworkGroup`，使全局脏检查、撤销与跨分区搜索无缝复用。
 */
export function coreConfigToFrameworkGroup(
  rawData: CoreConfig,
  optionsMeta: Record<string, CoreConfigOptionMeta> | undefined,
  translate: (k: string) => string,
): RawFrameworkGroup {
  const config: Record<string, PluginConfigItem> = {};
  const clone = { ...rawData };

  if (clone.log && typeof clone.log === 'object' && !Array.isArray(clone.log)) {
    const logObj = clone.log as Record<string, unknown>;
    if ('level' in logObj) {
      config.log_level = inferPluginConfigItem('log_level', logObj.level, optionsMeta, translate);
    }
    if ('output' in logObj) {
      config.log_output = inferPluginConfigItem(
        'log_output',
        logObj.output,
        optionsMeta,
        translate,
      );
    }
    if ('module' in logObj) {
      config.log_module = inferPluginConfigItem(
        'log_module',
        logObj.module,
        optionsMeta,
        translate,
      );
    }
    delete clone.log;
  }

  for (const [key, val] of Object.entries(clone)) {
    config[key] = inferPluginConfigItem(key, val, optionsMeta, translate);
  }

  const groupName = translate('coreFrameworkConfig.title');
  return {
    id: SYSTEM_CORE_GROUP_ID,
    name: groupName === 'coreFrameworkConfig.title' ? '核心配置' : groupName,
    full_name: SYSTEM_CORE_GROUP_ID,
    role: 'systemCore',
    domain: 'core',
    config,
  };
}

/**
 * 将 `SYSTEM_CORE_GROUP_ID` 还原为 `/api/core/config` 所需的嵌套 JSON（把 `log_*` 归并回 `log` 对象）。
 */
export function buildSystemCoreSavePayload(
  group: RawFrameworkGroup,
  originalGroup?: RawFrameworkGroup,
): CoreConfig {
  const payload: CoreConfig = {};
  const logPayload: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(group.config)) {
    let val = item.value;
    if ((item.type || '').toLowerCase() === 'gsint') {
      const parsed = typeof val === 'number' ? val : Number.parseInt(String(val ?? ''), 10);
      if (Number.isNaN(parsed)) {
        const origVal = originalGroup?.config[key]?.value;
        val = typeof origVal === 'number' && !Number.isNaN(origVal) ? origVal : 0;
      } else {
        val = parsed;
      }
    }

    if (key.startsWith('log_')) {
      logPayload[key.slice(4)] = val;
    } else {
      payload[key] = val;
    }
  }

  if (Object.keys(logPayload).length > 0) {
    payload.log = logPayload;
  }

  return payload;
}
