import { describe, expect, it } from 'vitest';

import {
  displayPlaceholderValue,
  groupPersonaFills,
  placeholderFollowsTier,
} from '@/components/persona/placeholderPreview';

const persona = {
  prompt_group: 'ss',
  values: { answer_contract: '已保存', soft: '30', appearance: '' },
  soft_follows: true,
};

describe('displayPlaceholderValue', () => {
  it('uses the open group draft for answer_contract', () => {
    expect(displayPlaceholderValue('answer_contract', persona, 'ss', '草稿')).toBe('草稿');
  });

  it('keeps the saved contract when the persona uses another group', () => {
    expect(displayPlaceholderValue('answer_contract', persona, '默认', '草稿')).toBe('已保存');
  });

  it('reads other tokens from the preview', () => {
    expect(displayPlaceholderValue('soft', persona, 'ss', '草稿')).toBe('30');
    expect(displayPlaceholderValue('appearance', persona, 'ss', undefined)).toBe('');
    expect(displayPlaceholderValue('lines', persona, 'ss', undefined)).toBe('');
  });
});

describe('groupPersonaFills', () => {
  it('merges the same value and notes, and keeps a different note apart', () => {
    expect(
      groupPersonaFills([
        { name: '早柚', value: '契约', notes: '使用「默认」' },
        { name: '凛音', value: '别的', notes: '使用「默认」' },
        { name: '周慕白', value: '契约', notes: '使用「默认」' },
        { name: '阿萨兰', value: '契约', notes: '' },
      ]),
    ).toEqual([
      { names: ['早柚', '周慕白'], value: '契约', notes: '使用「默认」' },
      { names: ['凛音'], value: '别的', notes: '使用「默认」' },
      { names: ['阿萨兰'], value: '契约', notes: '' },
    ]);
  });
});

describe('placeholderFollowsTier', () => {
  it('marks only the suggested length', () => {
    expect(placeholderFollowsTier('soft', persona)).toBe(true);
    expect(placeholderFollowsTier('segment_hint', persona)).toBe(false);
  });
});
