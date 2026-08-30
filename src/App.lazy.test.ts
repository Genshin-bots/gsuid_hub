import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(path.resolve(__dirname, './App.tsx'), 'utf8');

describe('App route splitting', () => {
  it('keeps Login eager and lazy-loads every other page', () => {
    expect(src).toMatch(/import Login from ['"]@\/pages\/Login['"]/);
    expect(src).not.toMatch(/import \w+ from ['"]@\/pages\/(?!Login['"])/);
  });

  it('lazy-loads AppLayout so the login bundle skips the shell', () => {
    expect(src).toMatch(/lazy\(\(\) =>\s*import\(['"]@\/components\/layout\/AppLayout['"]\)/);
  });

  it('lazy-loads heavy pages instead of static imports', () => {
    for (const page of [
      'HomePage',
      'Dashboard',
      'AIMemoryPage',
      'AIStatisticsPage',
      'LiveChatPage',
    ]) {
      expect(src).toMatch(new RegExp(`lazy\\(\\(\\) => import\\(['"]@/pages/${page}['"]\\)\\)`));
    }
  });
});
