/** 人格 config.enabled_tools：默认全开，只存排除项，插件新增工具自动纳入。 */

export function parseEnabledToolsSpec(raw: string[] | undefined | null): {
  star: boolean;
  allow: Set<string>;
  deny: Set<string>;
} {
  const items = (raw ?? []).map((x) => x.trim()).filter(Boolean);
  const allow = new Set<string>();
  const deny = new Set<string>();
  let star = false;
  for (const it of items) {
    if (it === '*' || it === 'all') {
      star = true;
      continue;
    }
    if (it.startsWith('!') && it.length > 1) {
      deny.add(it.slice(1));
      continue;
    }
    allow.add(it);
  }
  return { star, allow, deny };
}

/** 缺省 / `*` → 全选；空列表 → 全不选；否则按 *+deny 或白名单。 */
export function specToEnabledPlugins(
  spec: string[] | undefined | null,
  allPlugins: string[],
): string[] {
  if (spec == null) return [...allPlugins];
  if (spec.length === 0) return [];
  const { star, allow, deny } = parseEnabledToolsSpec(spec);
  if (star) return allPlugins.filter((p) => !deny.has(p));
  return allPlugins.filter((p) => allow.has(p) && !deny.has(p));
}

/** 始终写成 `["*"]` 或 `["*", "!plugin"]`，新插件默认选中。 */
export function enabledPluginsToSpec(enabled: string[], allPlugins: string[]): string[] {
  if (allPlugins.length === 0) return ['*'];
  if (enabled.length === 0) return [];
  const enabledSet = new Set(enabled);
  const denied = allPlugins.filter((p) => !enabledSet.has(p));
  if (denied.length === 0) return ['*'];
  return ['*', ...denied.map((p) => `!${p}`)];
}
