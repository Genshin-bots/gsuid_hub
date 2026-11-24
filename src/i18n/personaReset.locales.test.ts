import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enReset from './locales/en-US/personaReset.json';
import jaReset from './locales/ja-JP/personaReset.json';
import zhReset from './locales/zh-CN/personaReset.json';

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

function placeholders(text: string): string[] {
  return Array.from(text.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
}

describe('personaReset three-locale parity', () => {
  const zh = flattenKeys(zhReset);
  const en = flattenKeys(enReset);
  const ja = flattenKeys(jaReset);

  it('keeps identical leaf keys and placeholders', () => {
    const keys = Object.keys(zh).sort();
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(ja).sort()).toEqual(keys);
    for (const [key, value] of Object.entries(zh)) {
      expect(placeholders(en[key]), `en-US ${key}`).toEqual(placeholders(value));
      expect(placeholders(ja[key]), `ja-JP ${key}`).toEqual(placeholders(value));
    }
  });

  it('resolves every static t("personaReset.*") call in persona components', () => {
    const dir = join(process.cwd(), 'src/components/persona');
    const missing: string[] = [];
    for (const name of readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
      const src = readFileSync(join(dir, name), 'utf8');
      for (const match of src.matchAll(/\bt\(\s*'personaReset\.([a-zA-Z0-9_.]+)'/g)) {
        if (!(match[1] in zh)) missing.push(`${name}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
