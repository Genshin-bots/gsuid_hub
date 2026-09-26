import { describe, expect, it } from 'vitest';
import {
  enabledIdsToSpec,
  parseCapabilityAgentSpec,
  specToEnabledIds,
} from './capabilityAgentAllowlist';

describe('capabilityAgentAllowlist', () => {
  const all = ['research_agent', 'render_agent', 'code_agent'];

  it('missing spec selects all', () => {
    expect(specToEnabledIds(undefined, all)).toEqual(all);
  });

  it('empty spec selects none', () => {
    expect(specToEnabledIds([], all)).toEqual([]);
  });

  it('star plus deny drops only denied ids', () => {
    expect(specToEnabledIds(['*', '!render_agent'], all)).toEqual(['research_agent', 'code_agent']);
  });

  it('whitelist only keeps listed ids', () => {
    expect(specToEnabledIds(['research_agent'], all)).toEqual(['research_agent']);
  });

  it('saves all-checked as star so new plugins stay enabled', () => {
    expect(enabledIdsToSpec(all, all)).toEqual(['*']);
  });

  it('saves partial as star plus denials', () => {
    expect(enabledIdsToSpec(['research_agent', 'code_agent'], all)).toEqual(['*', '!render_agent']);
  });

  it('saves none as empty list', () => {
    expect(enabledIdsToSpec([], all)).toEqual([]);
  });

  it('parses star and deny', () => {
    const spec = parseCapabilityAgentSpec(['*', '!render_agent']);
    expect(spec.star).toBe(true);
    expect([...spec.deny]).toEqual(['render_agent']);
  });
});
