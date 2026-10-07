import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface RuntimeCopy {
  relationship: Record<string, string>;
}

const dir = dirname(fileURLToPath(import.meta.url));

function load(locale: string): RuntimeCopy {
  const raw = readFileSync(join(dir, 'locales', locale, 'aiRuntime.json'), 'utf8');
  return JSON.parse(raw) as RuntimeCopy;
}

const ROSTER_KEYS = [
  'rosterTitle',
  'rosterDesc',
  'rosterCount',
  'rosterEmpty',
  'rosterForbidden',
  'rosterMissing',
  'rosterKeyword',
  'rosterKeywordPlaceholder',
  'rosterBotPlaceholder',
  'rosterSearch',
  'colUser',
  'colZone',
  'colLine',
  'master',
  'viewRow',
];

describe('aiRuntime relationship copy', () => {
  const zh = load('zh-CN');
  const en = load('en-US');
  const ja = load('ja-JP');

  it('keeps relationship keys aligned in zh-CN, en-US, and ja-JP', () => {
    const keys = Object.keys(zh.relationship).sort();
    expect(Object.keys(en.relationship).sort()).toEqual(keys);
    expect(Object.keys(ja.relationship).sort()).toEqual(keys);
  });

  it('names the roster in all three locales', () => {
    expect(zh.relationship.rosterTitle).toBe('全部角色');
    for (const pack of [zh, en, ja]) {
      for (const key of ROSTER_KEYS) {
        expect(pack.relationship[key], key).toEqual(expect.any(String));
        expect(pack.relationship[key].length).toBeGreaterThan(0);
      }
    }
  });
});
