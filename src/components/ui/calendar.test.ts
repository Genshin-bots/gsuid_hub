import { describe, expect, it } from 'vitest';
import { enUS } from 'date-fns/locale/en-US';
import { ja } from 'date-fns/locale/ja';
import { zhCN } from 'date-fns/locale/zh-CN';
import { formatCalendarCaption, getCalendarLocale } from '@/lib/calendarLocale';

describe('calendar i18n helpers', () => {
  const sample = new Date(2026, 10, 13);

  it('maps supported UI languages to date-fns locales', () => {
    expect(getCalendarLocale('zh-CN')).toBe(zhCN);
    expect(getCalendarLocale('en-US')).toBe(enUS);
    expect(getCalendarLocale('ja-JP')).toBe(ja);
    expect(getCalendarLocale(undefined)).toBe(zhCN);
  });

  it('formats month caption according to active language', () => {
    expect(formatCalendarCaption(sample, 'zh-CN')).toBe('2026年11月');
    expect(formatCalendarCaption(sample, 'ja-JP')).toBe('2026年11月');
    expect(formatCalendarCaption(sample, 'en-US')).toBe('November 2026');
  });
});
