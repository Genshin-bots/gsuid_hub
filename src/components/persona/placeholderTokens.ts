const LABELS: Record<string, string> = {
  appearance: '外貌',
  soft: '建议字数',
  segment_hint: '分段说明',
  answer_contract: '作答契约',
  masters: '主人列表',
  master_title: '主人称呼',
  date: '日期',
  lines: '代理名单',
  char_name: '人格名',
  render_clause: '出图短句',
  current_time: '当前时间',
  history_context: '群记录',
  group_summary_section: '群摘要',
  proactive_merge_section: '刚完成的事',
  masters_section: '在场主人',
  recent_speak_section: '近期开口',
  staleness_section: '话题冷热',
  mood: '情绪',
  speaker_desc: '说话人',
};

const HINTS: Record<string, string> = {
  appearance: '发送前填入这份人格的外貌。没有外貌文件时，这一段不出现。',
  soft: '发送前填入建议字数。在人格编辑页修改。等于模板默认时，跟随说话强度。',
  segment_hint:
    '发送前填入说话强度这一档的分段说明。没有单独的文本项。要换说法，删掉标签后自己写。',
  answer_contract: '发送前填入同一组的「作答契约」全文。改那一段即可。',
  masters: '发送前填入核心配置里的主人 ID。',
  master_title: '发送前填入这份人格对主人的称呼。在人格设置里改。',
  date: '发送前填入当天日期，只到日。程序填写，不能手改。',
  lines: '发送前填入当前人格允许委派的能力代理。名单由委派设置决定。',
  char_name: '发送前填入当前人格的名字。',
  render_clause: '人格允许出图时填入「多项数据出图；」，否则为空。',
  current_time: '发送前填入这次巡检的当前时间。程序填写，不能手改。',
  history_context: '发送前填入群里最近的聊天记录。程序填写，不能手改。',
  group_summary_section: '发送前填入群摘要。没有摘要时为空。程序填写，不能手改。',
  proactive_merge_section: '发送前填入刚完成、可以顺口提起的事。程序填写，不能手改。',
  masters_section: '发送前填入此刻在场的主人。程序填写，不能手改。',
  recent_speak_section: '发送前填入近一小时已经主动说过几次。程序填写，不能手改。',
  staleness_section: '发送前填入话题冷了多久。刚说过时为空。程序填写，不能手改。',
  mood: '发送前填入巡检决定的情绪词。程序填写，不能手改。',
  speaker_desc: '发送前填入这条消息的说话人。程序填写，不能手改。',
};

const PALETTE = [
  'border-rose-500/40 bg-rose-500/20 text-rose-800 dark:text-rose-100',
  'border-pink-500/40 bg-pink-500/20 text-pink-800 dark:text-pink-100',
  'border-red-500/40 bg-red-500/20 text-red-800 dark:text-red-100',
  'border-orange-500/40 bg-orange-500/20 text-orange-900 dark:text-orange-100',
  'border-amber-500/40 bg-amber-500/25 text-amber-950 dark:text-amber-100',
  'border-violet-500/40 bg-violet-500/20 text-violet-800 dark:text-violet-100',
  'border-sky-500/40 bg-sky-500/20 text-sky-900 dark:text-sky-100',
  'border-emerald-500/40 bg-emerald-500/20 text-emerald-900 dark:text-emerald-100',
];

export const BADGE_CLASS =
  'mx-0.5 inline-flex h-6 shrink-0 select-none items-center rounded-full border px-2 align-middle text-xs font-medium leading-none';

export const SHARED_PLACEHOLDER_TOKENS = ['masters', 'date'] as const;

export const PERSONA_PLACEHOLDER_TOKENS = [
  'appearance',
  'soft',
  'segment_hint',
  'answer_contract',
  'master_title',
  'lines',
  'char_name',
  'render_clause',
] as const;

const RESOLVABLE_PLACEHOLDERS = new Set<string>([
  ...SHARED_PLACEHOLDER_TOKENS,
  ...PERSONA_PLACEHOLDER_TOKENS,
]);

export function isResolvablePlaceholder(name: string): boolean {
  return RESOLVABLE_PLACEHOLDERS.has(name);
}

export function placeholderLabel(name: string): string {
  return LABELS[name] ?? name;
}

export function placeholderHint(name: string): string {
  return HINTS[name] ?? `发送前换成「${placeholderLabel(name)}」。`;
}

export function placeholderClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

export function filterPlaceholderNames(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...names];
  return names.filter((name) => {
    const label = placeholderLabel(name).toLowerCase();
    return name.toLowerCase().includes(q) || label.includes(q);
  });
}

export type MentionHit = {
  trigger: '@' | '/';
  query: string;
  start: number;
};

function asTrigger(ch: string): '@' | '/' | null {
  if (ch === '@' || ch === '＠') return '@';
  if (ch === '/' || ch === '／') return '/';
  return null;
}

export function mentionQueryAt(beforeCaret: string): MentionHit | null {
  let index = beforeCaret.length - 1;
  while (index >= 0 && !/\s/.test(beforeCaret.charAt(index))) index -= 1;
  const wordStart = index + 1;
  const word = beforeCaret.slice(wordStart);
  let at = -1;
  for (let cursor = word.length - 1; cursor >= 0; cursor -= 1) {
    if (asTrigger(word.charAt(cursor))) {
      at = cursor;
      break;
    }
  }
  if (at < 0) return null;
  const trigger = asTrigger(word.charAt(at));
  if (!trigger) return null;
  // `http://` 里的斜杠不是召唤。中文句子里单独的 `/` 仍要打开。
  if (trigger === '/' && at > 0) {
    const prev = word.charAt(at - 1);
    if (prev === '/' || prev === '／' || prev === ':') return null;
  }
  const query = word.slice(at + 1);
  if (!/^[\p{L}\p{N}_]*$/u.test(query)) return null;
  return { trigger, query, start: wordStart + at };
}

export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export function moveGridIndex(index: number, count: number, columns: number, key: GridKey): number {
  if (count <= 0) return 0;
  const cols = Math.max(1, columns);
  const current = Math.min(Math.max(index, 0), count - 1);
  if (key === 'ArrowLeft') return Math.max(0, current - 1);
  if (key === 'ArrowRight') return Math.min(count - 1, current + 1);
  if (key === 'ArrowUp') return Math.max(0, current - cols);
  return Math.min(count - 1, current + cols);
}

export function columnCountOf(tops: readonly number[]): number {
  if (tops.length === 0) return 1;
  const first = tops[0] ?? 0;
  let count = 0;
  for (const top of tops) {
    if (Math.abs(top - first) > 2) break;
    count += 1;
  }
  return Math.max(1, count);
}
