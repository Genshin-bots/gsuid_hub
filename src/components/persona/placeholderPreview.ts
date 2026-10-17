import type { PersonaPlaceholderPreview } from '@/lib/api';

/** 打开的组里，作答契约用未保存的草稿。其余标签用服务端算好的发送值。 */
export function displayPlaceholderValue(
  token: string,
  persona: Pick<PersonaPlaceholderPreview, 'prompt_group' | 'values'>,
  groupName: string,
  answerContractDraft: string | undefined,
): string {
  if (
    token === 'answer_contract' &&
    persona.prompt_group === groupName &&
    answerContractDraft !== undefined
  ) {
    return answerContractDraft;
  }
  return persona.values[token] ?? '';
}

export type PersonaFill = {
  name: string;
  value: string;
  notes: string;
};

export type GroupedPersonaFill = {
  names: string[];
  value: string;
  notes: string;
};

/** 填入值和备注都相同的人格合成一项。顺序跟第一次出现一样。 */
export function groupPersonaFills(lines: readonly PersonaFill[]): GroupedPersonaFill[] {
  const order: string[] = [];
  const groups = new Map<string, GroupedPersonaFill>();
  for (const line of lines) {
    const key = `${line.value}\0${line.notes}`;
    const found = groups.get(key);
    if (found) {
      found.names.push(line.name);
      continue;
    }
    groups.set(key, { names: [line.name], value: line.value, notes: line.notes });
    order.push(key);
  }
  const result: GroupedPersonaFill[] = [];
  for (const key of order) {
    const group = groups.get(key);
    if (group) result.push(group);
  }
  return result;
}

export function placeholderFollowsTier(
  token: string,
  persona: Pick<PersonaPlaceholderPreview, 'soft_follows' | 'hard_follows'>,
): boolean {
  if (token === 'soft') return persona.soft_follows;
  if (token === 'hard') return persona.hard_follows;
  return false;
}
