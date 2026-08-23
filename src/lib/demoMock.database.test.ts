import { describe, expect, it } from 'vitest';
import { generateTableData } from './demoMock';

describe('generateTableData search pagination', () => {
  it('returns later pages of the same filtered set instead of an empty page', () => {
    const search = '1';
    const perPage = 10;
    const page1 = generateTableData(
      'Subscribe',
      new URLSearchParams({ page: '1', per_page: String(perPage), search }),
    );
    const page2 = generateTableData(
      'Subscribe',
      new URLSearchParams({ page: '2', per_page: String(perPage), search }),
    );

    expect(page1.total).toBeGreaterThan(perPage);
    expect(page1.total).toBe(page2.total);
    expect(page1.items.length).toBe(perPage);
    expect(page2.items.length).toBeGreaterThan(0);

    const page1Ids = new Set(page1.items.map((row) => row.id));
    for (const row of page2.items) {
      expect(page1Ids.has(row.id)).toBe(false);
      expect(
        Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(search)),
      ).toBe(true);
    }
  });

  it('applies column filters before slicing pages', () => {
    const page1 = generateTableData(
      'Subscribe',
      new URLSearchParams({
        page: '1',
        per_page: '5',
        filter_columns: 'task_name',
        filter_values: '签到',
      }),
    );
    const page2 = generateTableData(
      'Subscribe',
      new URLSearchParams({
        page: '2',
        per_page: '5',
        filter_columns: 'task_name',
        filter_values: '签到',
      }),
    );

    expect(page1.total).toBeGreaterThan(5);
    expect(page2.items.length).toBeGreaterThan(0);
    for (const row of [...page1.items, ...page2.items]) {
      expect(String(row.task_name)).toContain('签到');
    }
  });
});
