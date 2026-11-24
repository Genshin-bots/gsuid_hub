import { describe, expect, it } from 'vitest';
import type { PersonaResetItemPreview } from '@/lib/api';
import {
  cancelPendingGlobal,
  confirmPendingGlobal,
  estimateBackup,
  humanizeSeconds,
  initialResetSelection,
  jobOverallPercent,
  jobStepFraction,
  toggleResetItem,
} from '@/lib/personaReset';

function item(partial: Partial<PersonaResetItemPreview> & Pick<PersonaResetItemPreview, 'key'>) {
  return {
    group: 'persona',
    default_checked: true,
    count: 1,
    unit: 'rows',
    backup_supported: true,
    backup_seconds: 0,
    backup_bytes: 0,
    ...partial,
  } satisfies PersonaResetItemPreview;
}

const ITEMS: PersonaResetItemPreview[] = [
  item({ key: 'journal', backup_seconds: 1.2, backup_bytes: 1000 }),
  item({ key: 'session_history', backup_supported: false, backup_seconds: 99, backup_bytes: 99 }),
  item({ key: 'scheduled_tasks', default_checked: false, backup_seconds: 5, backup_bytes: 5 }),
  item({ key: 'global_group', group: 'global', default_checked: false, backup_seconds: 10.1 }),
  item({ key: 'global_user', group: 'global', default_checked: false, backup_seconds: 3 }),
];

describe('reset selection with shared global confirmation', () => {
  it('holds the first global pick until confirmed, then lets the second through', () => {
    let s = initialResetSelection(ITEMS);
    expect(s.checked).toEqual(['journal', 'session_history']);

    s = toggleResetItem(s, ITEMS, 'global_group', true);
    expect(s.pendingGlobal).toBe('global_group');
    expect(s.checked).not.toContain('global_group');

    s = confirmPendingGlobal(s);
    expect(s.checked).toContain('global_group');

    s = toggleResetItem(s, ITEMS, 'global_user', true);
    expect(s.pendingGlobal).toBeNull();
    expect(s.checked).toContain('global_user');
  });

  it('rolls back on cancel and asks again after every global item is unchecked', () => {
    let s = toggleResetItem(initialResetSelection(ITEMS), ITEMS, 'global_user', true);
    s = cancelPendingGlobal(s);
    expect(s.checked).not.toContain('global_user');
    expect(s.globalConfirmed).toBe(false);

    s = confirmPendingGlobal(toggleResetItem(s, ITEMS, 'global_user', true));
    s = toggleResetItem(s, ITEMS, 'global_user', false);
    s = toggleResetItem(s, ITEMS, 'global_group', true);
    expect(s.pendingGlobal).toBe('global_group');
  });

  it('never asks for persona-only items', () => {
    const s = toggleResetItem(initialResetSelection(ITEMS), ITEMS, 'scheduled_tasks', true);
    expect(s.pendingGlobal).toBeNull();
    expect(s.checked).toContain('scheduled_tasks');
  });
});

describe('backup estimate', () => {
  it('sums only checked items that support backup', () => {
    const est = estimateBackup(ITEMS, ['journal', 'session_history', 'global_group']);
    expect(est.seconds).toBeCloseTo(11.3);
    expect(est.bytes).toBe(1000);
    expect(est.unsupported).toEqual(['session_history']);
    expect(humanizeSeconds(est.seconds)).toEqual({ unit: 'seconds', value: 12 });
  });

  it('humanizes durations by rounding up into the largest unit', () => {
    expect(humanizeSeconds(0)).toEqual({ unit: 'lessThanSecond', value: 1 });
    expect(humanizeSeconds(58.2)).toEqual({ unit: 'seconds', value: 59 });
    expect(humanizeSeconds(59.2)).toEqual({ unit: 'minutes', value: 1 });
    expect(humanizeSeconds(150)).toEqual({ unit: 'minutes', value: 3 });
    expect(humanizeSeconds(5400)).toEqual({ unit: 'hours', value: 1.5 });
  });
});

describe('job progress', () => {
  it('treats running steps without a total as indeterminate', () => {
    expect(jobStepFraction({ key: 'prepare', status: 'running', done: 0, total: 0 })).toBeNull();
    expect(jobStepFraction({ key: 'vectors', status: 'running', done: 30, total: 120 })).toBe(0.25);
  });

  it('averages non-skipped steps', () => {
    const percent = jobOverallPercent({
      status: 'running',
      steps: [
        { key: 'prepare', status: 'done', done: 0, total: 0 },
        { key: 'backup', status: 'skipped', done: 0, total: 0 },
        { key: 'memory', status: 'running', done: 1, total: 2 },
        { key: 'finish', status: 'pending', done: 0, total: 0 },
      ],
    });
    expect(percent).toBe(50);
  });
});
