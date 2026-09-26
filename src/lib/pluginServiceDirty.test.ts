import { describe, expect, it } from 'vitest';
import { isPluginServiceDirty, isSvListDirty } from '@/lib/pluginServiceDirty';
import type { ServiceConfig, SvItem } from '@/lib/api';

const base: ServiceConfig = {
  enabled: true,
  pm: 6,
  priority: 1,
  area: 'ALL',
  black_list: [],
  white_list: [],
  prefix: ['/'],
  force_prefix: [],
  disable_force_prefix: false,
  allow_empty_prefix: false,
};

describe('plugin service dirty', () => {
  it('stays clean when the only difference is an extra enabled field or blank prefix', () => {
    const edited = { ...base, enabled: false, prefix: ['/', ''] };
    expect(isPluginServiceDirty(edited, base, true, true)).toBe(false);
  });

  it('turns on after a permission or plugin switch change', () => {
    expect(isPluginServiceDirty({ ...base, pm: 1 }, base, true, true)).toBe(true);
    expect(isPluginServiceDirty(base, base, false, true)).toBe(true);
  });

  it('treats an empty priority as unchanged when the form shows 0', () => {
    expect(isPluginServiceDirty({ ...base, priority: Number.NaN }, { ...base, priority: 0 }, true, true)).toBe(
      false,
    );
  });

  it('tracks sv list edits separately from plugin service fields', () => {
    const sv = { name: '签到', enabled: true, pm: 6, priority: 0, area: 'ALL' } as SvItem;
    expect(isSvListDirty([sv], [sv])).toBe(false);
    expect(isSvListDirty([{ ...sv, enabled: false }], [sv])).toBe(true);
    expect(isPluginServiceDirty(base, base, true, true)).toBe(false);
  });
});
