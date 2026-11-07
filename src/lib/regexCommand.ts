/**
 * 正则命令关键字的显示名简化。
 *
 * 插件配置页和数据看板共用这一份实现：两处都在展示「命令名」，
 * 各写一份必然漂移（一处出「赛季精灵」，另一处还露 `^(?:[sS]\d+)?`）。
 *
 * 算法：
 * 1. 剥离字符类 [...]、转义序列（\d \w \uXXXX 等）、量词（{1,15} + *）
 * 2. 逐层简化最内层分组，多选项取可读性最高的（CJK 权重更高）
 * 3. 剥离剩余元字符，提取可读文本，截断至 20 字符
 *
 * 对本身就是可读文本的命令（「帮助」「其他命令」）是幂等的。
 */

const _regexSimplifyCache = new Map<string, string>();

/** 用 O(n) 扫描剥离字符类 [...]，避免灾难性回溯 */
function stripCharClass(s: string): string {
  let out = '',
    i = 0;
  while (i < s.length) {
    if (s[i] === '[' && (i === 0 || s[i - 1] !== '\\')) {
      i++; // skip '['
      while (i < s.length && !(s[i] === ']' && s[i - 1] !== '\\')) i++;
      i++; // skip ']'
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

/** 用 O(n) 扫描剥离常见正则元字符和转义序列 */
function stripEscapeMeta(s: string): string {
  let out = '',
    i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const c = s[i + 1];
      if ('dwWsSbDBntrfv'.includes(c)) {
        i += 2;
        continue;
      }
      if (c === 'u' && i + 5 < s.length && /^[\da-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) {
        i += 6;
        continue;
      }
      if (c === 'U' && i + 9 < s.length && /^[\da-fA-F]{8}$/.test(s.slice(i + 2, i + 10))) {
        i += 10;
        continue;
      }
      if (c === 'x' && i + 3 < s.length && /^[\da-fA-F]{2}$/.test(s.slice(i + 2, i + 4))) {
        i += 4;
        continue;
      }
      if (c === '{') {
        let j = i + 2;
        while (j < s.length && s[j] !== '}') j++;
        i = j + 1;
        continue;
      }
      out += s[i];
      i++;
    } else if (s[i] === '{') {
      i++;
      while (i < s.length && s[i] !== '}') i++;
      i++;
    } else if ('*+^$'.includes(s[i])) {
      i++;
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

/** 计算字符串中可读字符(CJK×10 + 字母数字×1)的权重 */
function countReadableScore(s: string): number {
  let cjk = 0,
    alpha = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fa5) cjk++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)) alpha++;
  }
  return cjk * 10 + alpha;
}

/**
 * 简化正则命令关键字用于显示（非递归版）。
 *
 * 示例：
 *   "^(?P<kind>删除全部)(?P<char>[\u4e00-...]{1,15})(?P<type>面板|面包|bg)图$"
 *   → "删除全部面板图"
 *   "^(?:[sS]\d+)?赛季精灵$"
 *   → "赛季精灵"
 */
export function simplifyRegexKeyword(keyword: string): string {
  if (!keyword) return keyword;
  const cached = _regexSimplifyCache.get(keyword);
  if (cached !== undefined) return cached;

  // Step 1: O(n) 扫描剥离字符类和转义序列
  let s = stripEscapeMeta(stripCharClass(keyword));

  // Step 2: 剥离分组前缀
  s = s.replace(/\?P<[^>]+>/g, '');
  s = s.replace(/\?[=:!]/g, '');
  s = s.replace(/\?<[=!]/g, '');

  // Step 3: 迭代简化最内层分组 — 从内到外逐层处理
  // 每次只匹配不含嵌套括号的最内层 (...)，选择 | 多选项中可读性最高的
  let prev = '';
  let maxIter = 10;
  while (prev !== s && maxIter-- > 0) {
    prev = s;
    s = s.replace(/\(([^()]*)\)/g, (_match: string, content: string) => {
      const alts = content.split('|');
      if (alts.length > 1) {
        let best = alts[0];
        let bestScore = countReadableScore(best);
        for (const alt of alts) {
          const score = countReadableScore(alt);
          if (score > bestScore) {
            best = alt;
            bestScore = score;
          }
        }
        return best;
      }
      return content;
    });
  }

  // Step 4: 剥离剩余元字符，反转义
  s = s.replace(/[()|*+?]/g, '');
  s = s.replace(/\\(.)/g, '$1');
  s = s.trim();

  // Step 5: 提取可读文本序列，截断
  const readable = s.match(/[\u4e00-\u9fa5]+|[a-zA-Z]{2,}|[a-zA-Z0-9]+/g) || [];
  const result = readable.join('').slice(0, 20) || s.slice(0, 20) || keyword.slice(0, 20);

  _regexSimplifyCache.set(keyword, result);
  return result;
}

/**
 * 看起来就是正则的特征：锚点、字符类、转义类、分组前缀。
 * 普通文本命令（「帮助」「1+1」）不该命中，否则会被剥掉 `+` 之类的字符。
 */
const REGEX_HINTS = /[\^$]|\\[dDwWsSbB]|\(\?[:P=<]|\[[^\]]*\]/;

/**
 * 命令名的展示形式。
 *
 * 插件配置页能拿到 `trigger.type`，直接按 `type === 'regex'` 判断；
 * 看板的数据只有关键字字符串，用同一套语义的启发式兜底：像正则才简化，
 * 普通文本原样返回。两处展示的是同一批命令，结果必须一致。
 */
export function displayCommandName(keyword: string): string {
  if (!keyword || !REGEX_HINTS.test(keyword)) return keyword;
  return simplifyRegexKeyword(keyword);
}
