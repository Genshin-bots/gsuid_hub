import { describe, expect, it } from 'vitest';
import {
  enabledPluginsToSpec,
  parseEnabledToolsSpec,
  specToEnabledPlugins,
} from './personaToolScope';

describe('personaToolScope', () => {
  const all = ['Bar', 'Foo', 'GenshinUID'];

  it('missing spec selects all', () => {
    expect(specToEnabledPlugins(undefined, all)).toEqual(all);
  });

  it('empty spec selects none', () => {
    expect(specToEnabledPlugins([], all)).toEqual([]);
  });

  it('star plus deny drops only denied plugins', () => {
    expect(specToEnabledPlugins(['*', '!Foo'], all)).toEqual(['Bar', 'GenshinUID']);
  });

  it('whitelist only keeps listed plugins', () => {
    expect(specToEnabledPlugins(['Foo'], all)).toEqual(['Foo']);
  });

  it('saves all-checked as star so new plugins stay enabled', () => {
    expect(enabledPluginsToSpec(all, all)).toEqual(['*']);
  });

  it('saves partial as star plus denials', () => {
    expect(enabledPluginsToSpec(['Bar', 'GenshinUID'], all)).toEqual(['*', '!Foo']);
  });

  it('saves none as empty list', () => {
    expect(enabledPluginsToSpec([], all)).toEqual([]);
  });

  it('falls back to star when no plugin is known yet', () => {
    expect(enabledPluginsToSpec(['Foo'], [])).toEqual(['*']);
  });

  it('parses star and deny', () => {
    const spec = parseEnabledToolsSpec(['*', '!Foo']);
    expect(spec.star).toBe(true);
    expect([...spec.deny]).toEqual(['Foo']);
  });
});
