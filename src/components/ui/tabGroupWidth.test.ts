import { describe, expect, it } from 'vitest';
import { needsFullWidthWrapper, pickWidthTokens } from './tabGroupWidth';

describe('pickWidthTokens', () => {
  it('keeps responsive width classes so the wrapper can switch breakpoints', () => {
    expect(pickWidthTokens('w-full sm:w-max')).toEqual(['w-full', 'sm:w-max']);
  });

  it('ignores layout classes that are not widths', () => {
    expect(pickWidthTokens('shrink-0 grid-cols-3 gap-2')).toEqual([]);
  });

  it('returns empty for missing className', () => {
    expect(pickWidthTokens(undefined)).toEqual([]);
    expect(pickWidthTokens('')).toEqual([]);
  });
});

describe('needsFullWidthWrapper', () => {
  it('is full width when the caller asks for w-full or grid', () => {
    expect(needsFullWidthWrapper('w-full sm:w-max')).toBe(true);
    expect(needsFullWidthWrapper('grid sm:inline-flex')).toBe(true);
  });

  it('is not full width for a plain auto-sized group', () => {
    expect(needsFullWidthWrapper('shrink-0')).toBe(false);
    expect(needsFullWidthWrapper(undefined)).toBe(false);
  });
});
