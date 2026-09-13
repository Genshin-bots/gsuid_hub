import { describe, expect, it } from 'vitest';
import { generateBackupFileTree } from './demoMock';

describe('generateBackupFileTree pagination', () => {
  it('returns at most 100 children and keeps the rest behind omitted_count', () => {
    const page1 = generateBackupFileTree(
      new URLSearchParams({ path: 'plugin-res', sort: 'size', offset: '0', limit: '100' }),
    );
    expect(page1.children.length).toBe(100);
    expect(page1.child_total).toBe(120);
    expect(page1.truncated).toBe(true);
    expect(page1.omitted_count).toBe(20);

    const page2 = generateBackupFileTree(
      new URLSearchParams({ path: 'plugin-res', sort: 'size', offset: '100', limit: '100' }),
    );
    expect(page2.children.length).toBe(20);
    expect(page2.truncated).toBe(false);
    const ids = new Set(page1.children.map((c) => c.path));
    for (const row of page2.children) {
      expect(ids.has(row.path)).toBe(false);
    }
  });

  it('sorts root directories by file count when asked', () => {
    const byCount = generateBackupFileTree(new URLSearchParams({ sort: 'count' }));
    expect(byCount.children[0].name).toBe('plugin-res');
    expect(byCount.children[0].file_count).toBeGreaterThan(byCount.children[1].file_count);
  });
});
