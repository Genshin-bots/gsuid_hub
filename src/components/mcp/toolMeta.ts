import type { MCPToolExposure } from '@/lib/api';

export interface ToolMeta {
  exposure: MCPToolExposure;
  mutating: boolean;
  sensitiveArgs: boolean;
  credParamsText: string;
}

export function defaultToolMeta(hasCredentials: boolean): ToolMeta {
  return {
    exposure: hasCredentials ? 'private' : 'public',
    mutating: false,
    sensitiveArgs: false,
    credParamsText: '',
  };
}

// 与后端 suggest_shared_env_keys 同名同规则：名像配置值且非密钥词 → 「建议共享」徽标
const SECRET_NAME_RE = /key|token|secret|password|credential|auth|access/i;
const SHARED_HINT_RE = /host|url|endpoint|mode|region|domain|base|prefix|suffix|dir|path/i;

export function isSuggestSharedKey(key: string): boolean {
  return !SECRET_NAME_RE.test(key) && SHARED_HINT_RE.test(key);
}
