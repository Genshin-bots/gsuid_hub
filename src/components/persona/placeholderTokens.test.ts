import { describe, expect, it } from 'vitest';

import {
  columnCountOf,
  filterPlaceholderNames,
  mentionQueryAt,
  moveGridIndex,
} from './placeholderTokens';

describe('mentionQueryAt', () => {
  it('opens on @ or / after Chinese text', () => {
    expect(mentionQueryAt('不超过/')).toEqual({ trigger: '/', query: '', start: 3 });
    expect(mentionQueryAt('不超过/建议')).toEqual({ trigger: '/', query: '建议', start: 3 });
    expect(mentionQueryAt('你好@主人')).toEqual({ trigger: '@', query: '主人', start: 2 });
    expect(mentionQueryAt('尾＠')).toEqual({ trigger: '@', query: '', start: 1 });
    expect(mentionQueryAt('不超过／硬')).toEqual({ trigger: '/', query: '硬', start: 3 });
  });

  it('keeps a trigger that follows a space', () => {
    expect(mentionQueryAt('a /soft')).toEqual({ trigger: '/', query: 'soft', start: 2 });
  });

  it('ignores slashes inside a URL', () => {
    expect(mentionQueryAt('http://')).toBeNull();
    expect(mentionQueryAt('http://x')).toBeNull();
    expect(mentionQueryAt('见 https://a')).toBeNull();
  });

  it('closes once the query leaves the token', () => {
    expect(mentionQueryAt('a /soft more')).toBeNull();
    expect(mentionQueryAt('/soft.')).toBeNull();
    expect(mentionQueryAt('')).toBeNull();
  });
});

describe('filterPlaceholderNames', () => {
  const names = ['soft', 'hard', 'segment_hint', 'answer_contract'];

  it('offers only this field when the query is empty', () => {
    expect(filterPlaceholderNames(names, '')).toEqual(names);
    expect(filterPlaceholderNames(['soft', 'hard'], '主人')).toEqual([]);
  });

  it('matches the Chinese label or the token name', () => {
    expect(filterPlaceholderNames(names, '建议')).toEqual(['soft']);
    expect(filterPlaceholderNames(names, 'HARD')).toEqual(['hard']);
    expect(filterPlaceholderNames(names, '契约')).toEqual(['answer_contract']);
  });
});

describe('moveGridIndex', () => {
  it('moves one step sideways and one row vertically', () => {
    expect(moveGridIndex(0, 6, 3, 'ArrowRight')).toBe(1);
    expect(moveGridIndex(0, 6, 3, 'ArrowLeft')).toBe(0);
    expect(moveGridIndex(1, 6, 3, 'ArrowDown')).toBe(4);
    expect(moveGridIndex(4, 6, 3, 'ArrowUp')).toBe(1);
    expect(moveGridIndex(3, 6, 3, 'ArrowDown')).toBe(5);
    expect(moveGridIndex(5, 6, 3, 'ArrowRight')).toBe(5);
  });

  it('counts the first row from item tops', () => {
    expect(columnCountOf([10, 10, 10, 40, 40])).toBe(3);
    expect(columnCountOf([])).toBe(1);
  });
});
