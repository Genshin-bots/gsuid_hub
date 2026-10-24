// 预编译的正则表达式
export const HAS_STRUCTURE_REGEX = /[{[(]/;
export const TRIMMED_EMPTY_REGEX = /^\s*$/;
export const HAS_BASE64_REGEX =
  /(?:base64:\/\/|data:image\/[a-zA-Z0-9.+-]+;base64,)[A-Za-z0-9+/_-]{8,}={0,2}/i;
export const SPLIT_BASE64_REGEX =
  /((?:base64:\/\/|data:image\/[a-zA-Z0-9.+-]+;base64,)[A-Za-z0-9+/_-]{8,}={0,2})/gi;

const PLACEHOLDER_PREFIX = '__GSHUB_B64_';
const PLACEHOLDER_REGEX = /__GSHUB_B64_(\d+)__/g;

/**
 * 全局追踪当前正在打开/悬停的 Base64 预览卡片数量。
 * 当 > 0 时，ConsolePanel 会暂停 autoScroll 强制滚底，防止用户看图或点击复制时列表跳走。
 */
let activePreviewHoverCount = 0;

export function isStructuredDataPreviewOpen(): boolean {
  return activePreviewHoverCount > 0;
}

export function retainStructuredDataPreview(): () => void {
  activePreviewHoverCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activePreviewHoverCount = Math.max(0, activePreviewHoverCount - 1);
  };
}

/**
 * 提取纯 Base64 编码内容（剥离 `base64://` 或 `data:image/...;base64,` 前缀）
 */
export function extractBase64Payload(raw: string): string {
  const lowerPrefix = raw.slice(0, 16).toLowerCase();
  if (lowerPrefix.startsWith('base64://')) {
    return raw.slice('base64://'.length);
  }
  if (lowerPrefix.startsWith('data:image/')) {
    const commaIdx = raw.indexOf(',');
    if (commaIdx !== -1) {
      return raw.slice(commaIdx + 1);
    }
  }
  return raw;
}

/**
 * 轻量解析 Base64 图片元信息（MIME、格式标签、文件大小）：
 * - 仅读取头部少量字符判断魔数，通过下标差值计算字节数
 * - 零大字符串 slice / replace 分配，避免长日志列表中产生数 MB 的 GC 压力
 */
export function parseBase64ImageMeta(raw: string): {
  mime: string;
  format: string;
  sizeText: string;
  isDataUrl: boolean;
} {
  let mime = 'image/png';
  let payloadOffset = 0;
  const lowerPrefix = raw.slice(0, 16).toLowerCase();
  const isDataUrl = lowerPrefix.startsWith('data:image/');

  if (isDataUrl) {
    const commaIdx = raw.indexOf(',');
    if (commaIdx !== -1) {
      const header = raw.slice(5, commaIdx);
      const semiIdx = header.indexOf(';');
      mime = (semiIdx !== -1 ? header.slice(0, semiIdx) : header).toLowerCase();
      payloadOffset = commaIdx + 1;
    }
  } else if (lowerPrefix.startsWith('base64://')) {
    payloadOffset = 'base64://'.length;
    // 仅截取前 16 个字符并归一化后判断图片魔数，避免对数 MB 字符串做全文 replace
    const head = raw
      .slice(payloadOffset, payloadOffset + 16)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    if (head.startsWith('/9j/')) {
      mime = 'image/jpeg';
    } else if (head.startsWith('iVBORw0KGgo')) {
      mime = 'image/png';
    } else if (head.startsWith('R0lGOD')) {
      mime = 'image/gif';
    } else if (head.startsWith('UklGR')) {
      mime = 'image/webp';
    } else if (head.startsWith('Qk')) {
      mime = 'image/bmp';
    } else if (head.startsWith('PHN2Zy') || head.startsWith('PD94bW')) {
      mime = 'image/svg+xml';
    }
  }

  const payloadLength = Math.max(0, raw.length - payloadOffset);
  const paddingCount = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((payloadLength * 3) / 4) - paddingCount);

  let sizeText = `${byteLength} B`;
  if (byteLength >= 1024 * 1024) {
    sizeText = `${(byteLength / (1024 * 1024)).toFixed(2)} MB`;
  } else if (byteLength >= 1024) {
    sizeText = `${(byteLength / 1024).toFixed(1)} KB`;
  }

  const format = (mime.split('/')[1] || 'img').toUpperCase().replace('+XML', '');
  return { mime, format, sizeText, isDataUrl };
}

/**
 * 仅在悬浮卡片展开时按需构造浏览器可渲染的 Data URL：
 * - 标准 data:image/... 直接复用原字符串
 * - base64:// 仅在确实含有 URL-safe 字符（- 或 _）时才做替换
 */
export function buildBase64DataUrl(raw: string, mime: string, isDataUrl: boolean): string {
  if (isDataUrl) {
    return raw;
  }
  const payload = raw.slice('base64://'.length);
  const normalized =
    payload.includes('-') || payload.includes('_')
      ? payload.replace(/-/g, '+').replace(/_/g, '/')
      : payload;
  return `data:${mime};base64,${normalized}`;
}

function restorePlaceholders(value: unknown, tokens: string[]): unknown {
  if (typeof value === 'string') {
    if (!value.includes(PLACEHOLDER_PREFIX)) return value;
    return value.replace(PLACEHOLDER_REGEX, (match, idxStr) => {
      const idx = Number(idxStr);
      return tokens[idx] ?? match;
    });
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = restorePlaceholders(value[i], tokens);
    }
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = restorePlaceholders(record[key], tokens);
    }
    return value;
  }
  return value;
}

/**
 * 判断解析后的对象在 SimpleRenderer 中是否会发生字段/元素/层级截断：
 * - 嵌套深度 > 3
 * - 数组长度 > 5
 * - ClassWrapper 参数数量 > 3
 * - 普通对象键数量 > 4
 * 若会被截断，则退回原文 + TextWithBase64 渲染，避免吞掉日志字段或隐藏内部图片徽标。
 */
export function willSimpleRendererTruncate(obj: unknown, depth = 0): boolean {
  if (depth > 3) {
    return true;
  }

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }

  if (Array.isArray(obj)) {
    if (obj.length > 5) {
      return true;
    }
    return obj.some((item) => willSimpleRendererTruncate(item, depth + 1));
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length === 2 && '__class__' in record && 'args' in record) {
    const args = record.args;
    if (typeof args !== 'object' || args === null) {
      return false;
    }
    const argsRecord = args as Record<string, unknown>;
    const argKeys = Object.keys(argsRecord);
    if (argKeys.length > 3) {
      return true;
    }
    return argKeys.some((key) => willSimpleRendererTruncate(argsRecord[key], depth + 1));
  }

  if (keys.length > 4) {
    return true;
  }
  return keys.some((key) => willSimpleRendererTruncate(record[key], depth + 1));
}

/**
 * 尝试将日志文本解析为结构化对象：
 * 1. 标准 JSON 直接走原生 JSON.parse
 * 2. 非标准格式（Python 对象/单引号字典）先将内部 Base64 替换为短占位符，
 *    避免对大体积 Base64 跑宽松正则以及 Base64 末尾 `=` 干扰 `key=value` 替换；
 *    解析成功后再还原占位符，兼顾结构化高亮与性能。
 * 3. 若解析结果会被 SimpleRenderer 截断，则返回 null 退回原文显示，防止丢失关键字段或图片徽标。
 */
export function tryParseStructuredData(str: string): object | null {
  try {
    const parsed = JSON.parse(str);
    if (parsed !== null && typeof parsed === 'object') {
      return willSimpleRendererTruncate(parsed) ? null : parsed;
    }
    return null;
  } catch {
    // 非标准 JSON，继续尝试 Python / 宽松对象格式清洗
  }

  const base64Tokens: string[] = [];
  const skeleton = HAS_BASE64_REGEX.test(str)
    ? str.replace(SPLIT_BASE64_REGEX, (match) => {
        const idx = base64Tokens.length;
        base64Tokens.push(match);
        return `${PLACEHOLDER_PREFIX}${idx}__`;
      })
    : str;

  // 剥离 Base64 后的骨架若仍超长，跳过宽松正则以防主线程卡顿
  if (skeleton.length > 10000) {
    return null;
  }

  try {
    let cleaned = skeleton;
    const classCallRegex = /(\w+)\(([^()]*)\)/g;
    for (let pass = 0; pass < 4 && classCallRegex.test(cleaned); pass += 1) {
      cleaned = cleaned.replace(classCallRegex, (_, className, args) => {
        const processedArgs = args.replace(/(^|,\s*)([a-zA-Z_]\w*)=/g, '$1"$2": ');
        return `{"__class__":"${className}","args":{${processedArgs}}}`;
      });
    }

    cleaned = cleaned
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false');

    const parsed = JSON.parse(cleaned);
    if (parsed === null || typeof parsed !== 'object' || willSimpleRendererTruncate(parsed)) {
      return null;
    }
    return base64Tokens.length > 0 ? (restorePlaceholders(parsed, base64Tokens) as object) : parsed;
  } catch {
    return null;
  }
}
