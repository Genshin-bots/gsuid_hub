/** GsDivider.desc → 标题下小字。与标题或字段 key 重复时不显示（key 是 convert 的空 desc 兜底）。 */
export function resolveDividerSubtitle(
  description: string,
  title: string | null,
  fieldKey: string,
): string | null {
  const text = description.trim();
  if (!text || text === title || text === fieldKey) return null;
  return text;
}
