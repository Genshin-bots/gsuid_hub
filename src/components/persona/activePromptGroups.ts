/** 与后端默认组同名。配置里没写、或只写了空白时，发送用这一组。 */
export const DEFAULT_PROMPT_GROUP = '默认';

export type ActivePromptGroupInput = {
  name: string;
  enabled: boolean;
  promptGroup?: string;
};

export type ActivePromptGroupLine = {
  group: string;
  names: string[];
};

/** 已激活人格按出现顺序归到各自的系统提示词组。未激活的不计入。 */
export function activePromptGroupLines(
  rows: readonly ActivePromptGroupInput[],
): ActivePromptGroupLine[] {
  const order: string[] = [];
  const names = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.enabled) continue;
    const group = row.promptGroup?.trim() || DEFAULT_PROMPT_GROUP;
    const bucket = names.get(group);
    if (bucket) {
      bucket.push(row.name);
    } else {
      names.set(group, [row.name]);
      order.push(group);
    }
  }
  return order.map((group) => ({ group, names: names.get(group) ?? [] }));
}
