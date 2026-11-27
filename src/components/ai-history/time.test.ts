import { describe, expect, it } from 'vitest';
import {
  buildSessionTimeTooltip,
  formatSessionShortTime,
  formatSessionTimestamp,
  getSessionActivityTimeStr,
  getSessionActivityTimestamp,
} from './time';

describe('ai-history time helpers', () => {
  it('prefers updated_at_str and falls back to created_at_str for card display', () => {
    expect(
      getSessionActivityTimeStr({
        created_at_str: '2026-11-25 09:34:00',
        updated_at_str: '2026-11-26 18:05:12',
      }),
    ).toBe('2026-11-26 18:05:12');
    expect(
      formatSessionShortTime({
        created_at_str: '2026-11-25 09:34:00',
        updated_at_str: '2026-11-26 18:05:12',
      }),
    ).toBe('11-26 18:05');

    expect(
      formatSessionShortTime({
        created_at_str: '2026-11-25 09:34:00',
        updated_at_str: null,
      }),
    ).toBe('11-25 09:34');

    expect(
      formatSessionShortTime({
        created_at_str: null,
        updated_at_str: null,
      }),
    ).toBe('');
  });

  it('picks the freshest updated_at across card and detail, falling back to created_at', () => {
    expect(
      getSessionActivityTimestamp(
        { created_at: 100, updated_at: 200 },
        { created_at: 150, updated_at: 350 },
      ),
    ).toBe(350);
    expect(
      getSessionActivityTimestamp(
        { created_at: 100, updated_at: 400 },
        { created_at: 150, updated_at: 350 },
      ),
    ).toBe(400);
    expect(getSessionActivityTimestamp({ created_at: 100, updated_at: 0 }, null)).toBe(100);
    expect(formatSessionTimestamp(0)).toBe('');
  });

  it('builds tooltip with both updated and created times when distinct', () => {
    const labels = { createdAt: '创建时间', updatedAt: '最后更新' };
    expect(buildSessionTimeTooltip('2026-11-25 09:34:00', '2026-11-26 18:05:12', labels)).toBe(
      '最后更新: 2026-11-26 18:05:12\n创建时间: 2026-11-25 09:34:00',
    );
    expect(buildSessionTimeTooltip('2026-11-26 18:05:12', '2026-11-26 18:05:12', labels)).toBe(
      '最后更新: 2026-11-26 18:05:12',
    );
    expect(buildSessionTimeTooltip('2026-11-25 09:34:00', null, labels)).toBe(
      '创建时间: 2026-11-25 09:34:00',
    );
    expect(buildSessionTimeTooltip(null, null, labels)).toBe('');
  });
});
