import { describe, expect, it } from 'vitest';
import enAutonomy from '@/i18n/locales/en-US/aiAutonomy.json';
import jaAutonomy from '@/i18n/locales/ja-JP/aiAutonomy.json';
import zhAutonomy from '@/i18n/locales/zh-CN/aiAutonomy.json';
import { parseAutonomyTarget } from './AutonomyPanel';

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

describe('parseAutonomyTarget', () => {
  it('distinguishes private, group, prefixed session keys, and empty targets', () => {
    expect(
      parseAutonomyTarget({ target_session_key: 'private:100000001', target_user_id: '100000001' }),
    ).toEqual({ kind: 'private', targetId: '100000001', userId: '100000001' });

    expect(
      parseAutonomyTarget({ target_session_key: 'direct:100000002', target_user_id: '' }),
    ).toEqual({ kind: 'private', targetId: '100000002', userId: '100000002' });

    expect(
      parseAutonomyTarget({ target_session_key: 'demo:group:114514', target_user_id: '100000001' }),
    ).toEqual({ kind: 'group', targetId: '114514', userId: '100000001' });

    expect(parseAutonomyTarget({ target_session_key: '', target_user_id: '100000003' })).toEqual({
      kind: 'private',
      targetId: '100000003',
      userId: '100000003',
    });

    expect(parseAutonomyTarget({ target_session_key: '', target_user_id: '' })).toEqual({
      kind: 'none',
      targetId: '',
      userId: '',
    });
  });
});

describe('aiAutonomy three-locale parity', () => {
  const zh = flattenKeys(zhAutonomy);
  const en = flattenKeys(enAutonomy);
  const ja = flattenKeys(jaAutonomy);

  it('keeps identical leaf keys and placeholders across locales', () => {
    const keys = Object.keys(zh).sort();
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(ja).sort()).toEqual(keys);
    for (const [key, value] of Object.entries(zh)) {
      expect(placeholders(en[key]), `en-US ${key}`).toEqual(placeholders(value));
      expect(placeholders(ja[key]), `ja-JP ${key}`).toEqual(placeholders(value));
    }
  });
});
