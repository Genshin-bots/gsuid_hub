import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enFramework from './locales/en-US/frameworkConfig.json';
import jaFramework from './locales/ja-JP/frameworkConfig.json';
import zhFramework from './locales/zh-CN/frameworkConfig.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenKeys(v as Record<string, unknown>, path));
    } else {
      out[path] = String(v);
    }
  }
  return out;
}

function extractPlaceholders(text: string): string[] {
  return Array.from(text.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

describe('frameworkConfig three-locale parity & reference integrity', () => {
  const zhFlat = flattenKeys(zhFramework);
  const enFlat = flattenKeys(enFramework);
  const jaFlat = flattenKeys(jaFramework);

  it('keeps identical leaf keys across zh-CN, en-US, and ja-JP', () => {
    const zhKeys = Object.keys(zhFlat).sort();
    expect(Object.keys(enFlat).sort()).toEqual(zhKeys);
    expect(Object.keys(jaFlat).sort()).toEqual(zhKeys);
  });

  it('keeps identical interpolation placeholders across all three locales', () => {
    for (const [key, zhVal] of Object.entries(zhFlat)) {
      const expectedVars = extractPlaceholders(zhVal);
      expect(extractPlaceholders(enFlat[key]), `en-US placeholder mismatch at ${key}`).toEqual(
        expectedVars,
      );
      expect(extractPlaceholders(jaFlat[key]), `ja-JP placeholder mismatch at ${key}`).toEqual(
        expectedVars,
      );
    }
  });

  it('resolves every static t("frameworkConfig.*") call in FrameworkConfig sources', () => {
    const files = [
      join(process.cwd(), 'src/pages/FrameworkConfigPage.tsx'),
      ...collectTsFiles(join(process.cwd(), 'src/pages/FrameworkConfig')),
    ];

    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(/\bt\(\s*['"]frameworkConfig\.([a-zA-Z0-9_.]+)['"]/g)) {
        const subKey = match[1];
        if (!(subKey in zhFlat)) {
          missing.push(`${file}: frameworkConfig.${subKey}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
