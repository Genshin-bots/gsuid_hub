/**
 * 带选项的整数在控件里是字符串。保存前按后端 type 转回数字。
 * 框架配置、插件配置、嵌入配置共用这一处。
 */

export function coerceConfigValueForSave(rawType: string, value: unknown): unknown {
  const kind = rawType.toLowerCase();
  if (kind === 'gsint' && typeof value === 'string') {
    return Number.parseInt(value, 10);
  }
  if (kind === 'gsfloat' && typeof value === 'string') {
    return Number.parseFloat(value);
  }
  return value;
}

export function embeddingConfigPayload(
  fields: Record<string, { type?: string; data?: unknown }>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) {
    payload[key] = coerceConfigValueForSave(field.type ?? '', field.data);
  }
  return payload;
}

export interface PluginConfigSaveInput {
  type?: string;
  rawType?: string;
  value?: unknown;
}

export interface PluginConfigSaveResult {
  skip: boolean;
  value?: unknown;
}

export function convertPluginConfigValueForSave(
  field: PluginConfigSaveInput,
): PluginConfigSaveResult {
  const rawType = (field.rawType ?? '').toLowerCase();

  if (field.type === 'divider' || rawType === 'gsdivider') {
    return { skip: true };
  }
  if (field.type === 'button' || rawType === 'gsbutton') {
    return { skip: true };
  }

  if (rawType === 'gsdict') {
    if (typeof field.value !== 'string') {
      return { skip: false, value: field.value };
    }
    try {
      const parsed: unknown = JSON.parse(field.value);
      return { skip: false, value: parsed };
    } catch {
      return { skip: false, value: field.value };
    }
  }

  if (rawType === 'gslist' && Array.isArray(field.value)) {
    const nums = field.value.map((item) => Number(item)).filter((n) => !Number.isNaN(n));
    return { skip: false, value: nums };
  }

  if (rawType === 'gsint' || rawType === 'gsfloat') {
    return { skip: false, value: coerceConfigValueForSave(rawType, field.value) };
  }

  return { skip: false, value: field.value };
}
