import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

function loadLocale(locale: string): Record<string, unknown> {
  const raw = readFileSync(join(dir, 'locales', locale, 'aiMeme.json'), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('aiMeme locales alignment', () => {
  const zh = loadLocale('zh-CN');
  const en = loadLocale('en-US');
  const ja = loadLocale('ja-JP');

  it('keeps all keys aligned across zh-CN, en-US, and ja-JP', () => {
    const zhKeys = flattenKeys(zh);
    expect(flattenKeys(en)).toEqual(zhKeys);
    expect(flattenKeys(ja)).toEqual(zhKeys);
  });

  it('includes semantic sheet and batch keys with non-empty copy', () => {
    const required = [
      'detail.name',
      'detail.ocrText',
      'detail.usageHint',
      'detail.packs',
      'detail.enabled',
      'card.enabled',
      'card.disabled',
      'card.edit',
      'batchRetagIncomplete',
      'batchEnable',
      'batchDisable',
      'batchAddPack',
      'batchRetagSelected',
    ];
    for (const localeObj of [zh, en, ja]) {
      for (const path of required) {
        const value = path
          .split('.')
          .reduce<unknown>(
            (acc, part) =>
              acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
            localeObj,
          );
        expect(typeof value, path).toBe('string');
        expect((value as string).length, path).toBeGreaterThan(0);
      }
    }
  });
});
