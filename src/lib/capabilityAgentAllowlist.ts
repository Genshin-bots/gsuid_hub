/** 人格 config.capability_agents：默认全开，只存排除项，插件新增代理自动纳入。 */

export function parseCapabilityAgentSpec(raw: string[] | undefined | null): {
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
export function specToEnabledIds(spec: string[] | undefined | null, allIds: string[]): string[] {
  if (spec == null) return [...allIds];
  if (spec.length === 0) return [];
  const { star, allow, deny } = parseCapabilityAgentSpec(spec);
  if (star) return allIds.filter((id) => !deny.has(id));
  return allIds.filter((id) => allow.has(id) && !deny.has(id));
}

/** 始终写成 `["*"]` 或 `["*", "!id"]`，新代理默认选中。 */
export function enabledIdsToSpec(enabled: string[], allIds: string[]): string[] {
  if (allIds.length === 0) return ['*'];
  if (enabled.length === 0) return [];
  const enabledSet = new Set(enabled);
  const denied = allIds.filter((id) => !enabledSet.has(id));
  if (denied.length === 0) return ['*'];
  return ['*', ...denied.map((id) => `!${id}`)];
}

export function isDelegableCapabilityAgent(item: { node_id: string; source: string }): boolean {
  return item.source !== 'persona' && item.node_id !== 'capability_evaluator';
}
