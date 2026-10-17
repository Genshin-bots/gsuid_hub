import { describe, expect, it } from 'vitest';

import {
  activePromptGroupLines,
  DEFAULT_PROMPT_GROUP,
} from '@/components/persona/activePromptGroups';

describe('activePromptGroupLines', () => {
  it('groups enabled personas in list order and skips the rest', () => {
    expect(
      activePromptGroupLines([
        { name: '早柚', enabled: true, promptGroup: '默认' },
        { name: '凛音', enabled: false, promptGroup: 'ss' },
        { name: '周慕白', enabled: true, promptGroup: 'ss' },
        { name: '阿萨兰', enabled: true, promptGroup: '默认' },
      ]),
    ).toEqual([
      { group: '默认', names: ['早柚', '阿萨兰'] },
      { group: 'ss', names: ['周慕白'] },
    ]);
  });

  it('treats a blank prompt group as the default group', () => {
    expect(
      activePromptGroupLines([
        { name: '早柚', enabled: true, promptGroup: '  ' },
        { name: '凛音', enabled: true },
      ]),
    ).toEqual([{ group: DEFAULT_PROMPT_GROUP, names: ['早柚', '凛音'] }]);
  });

  it('returns nothing when no persona is enabled', () => {
    expect(activePromptGroupLines([{ name: '早柚', enabled: false, promptGroup: 'ss' }])).toEqual(
      [],
    );
  });
});
