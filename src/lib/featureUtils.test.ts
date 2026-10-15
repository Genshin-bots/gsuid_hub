import { describe, expect, it } from 'vitest';
import {
  aggregatePerformanceByDate,
  aggregatePerformanceByHour,
  perfHourTotals,
  toPerfHourSeries,
  asPercent,
  botConnectionSummary,
  buildBatchPushImagePlaceholder,
  buildBatchPushImageTag,
  collectCommandKeysFromTriggerRows,
  collectImageFilesFromDataTransfer,
  expandBatchPushBody,
  formatCompactMetric,
  getCommandColor,
  hashCommandName,
  latestDateWithMetric,
  sparkHeadline,
  unwrapSettledRows,
  stripExceptionGroupGutters,
  composeLogTimestamp,
  formatLogTimestamp,
  normalizeBatchPushBodyImages,
  pruneBatchPushImageAssets,
  countToolDiagnostics,
  dateRangeLastDays,
  diagnoseTool,
  downloadJsonFilename,
  extractHistoryTokenSeries,
  filterToolsByDiagnostic,
  formatLocalDate,
  GROUP_PROFILE_STATE_SCOPE,
  insertTextAt,
  isEmptyToolDescription,
  isGroupProfileScope,
  isImageFile,
  memoryIngestHealth,
  multimodalHealthLevel,
  normalizeGroupProfile,
  oocHitLabel,
  sessionIdleBucket,
  summarizeTriggerReplay,
  validateMemorySearchInput,
  validateSnapshotImport,
} from './featureUtils';

describe('tool diagnostics', () => {
  it('flags empty descriptions', () => {
    expect(isEmptyToolDescription('')).toBe(true);
    expect(isEmptyToolDescription('  ')).toBe(true);
    expect(isEmptyToolDescription(null)).toBe(true);
    expect(isEmptyToolDescription('search knowledge')).toBe(false);
  });

  it('diagnoses levels', () => {
    expect(diagnoseTool({ name: 'a', description: '' }).level).toBe('error');
    expect(diagnoseTool({ name: 'find_tools', description: 'x', category: 'meta' }).level).toBe(
      'warn',
    );
    expect(diagnoseTool({ name: 'ok', description: 'doc' }).level).toBe('ok');
  });

  it('counts diagnostics', () => {
    const c = countToolDiagnostics([
      { name: 'a', description: '' },
      { name: 'b', description: 'ok' },
      { name: 'c', description: 'm', category: 'meta' },
    ]);
    expect(c).toEqual({ total: 3, emptyDescription: 1, meta: 1, ok: 1 });
  });

  it('filters by diagnostic mode', () => {
    const tools = [
      { name: 'a', description: '' },
      { name: 'b', description: 'ok' },
    ];
    expect(filterToolsByDiagnostic(tools, 'empty_description')).toHaveLength(1);
    expect(filterToolsByDiagnostic(tools, 'issues')).toHaveLength(1);
    expect(filterToolsByDiagnostic(tools, 'all')).toHaveLength(2);
  });
});

describe('memory search validation', () => {
  it('requires query and group', () => {
    expect(validateMemorySearchInput({ query: '', groupId: 'g' }).ok).toBe(false);
    expect(validateMemorySearchInput({ query: 'hi', groupId: '' }).ok).toBe(false);
    expect(validateMemorySearchInput({ query: 'hi', groupId: 'g', topK: 10 }).ok).toBe(true);
    expect(validateMemorySearchInput({ query: 'hi', groupId: 'g', topK: 0 }).ok).toBe(false);
  });
});

describe('dates and stats', () => {
  it('formats local date', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('builds last-N-days range inclusive', () => {
    const now = new Date(2026, 6, 23);
    const r = dateRangeLastDays(7, now);
    expect(r.end).toBe('2026-07-23');
    expect(r.start).toBe('2026-07-17');
  });

  it('memory ingest health', () => {
    expect(memoryIngestHealth(null).label).toBe('empty');
    expect(memoryIngestHealth({ observations: 10, ingestions: 9, ingestion_errors: 0 }).label).toBe(
      'healthy',
    );
    expect(memoryIngestHealth({ observations: 10, ingestions: 2, ingestion_errors: 0 }).label).toBe(
      'degraded',
    );
    expect(memoryIngestHealth({ observations: 5, ingestions: 5, ingestion_errors: 1 }).label).toBe(
      'degraded',
    );
  });

  it('extracts history token series', () => {
    const series = extractHistoryTokenSeries([
      {
        date: '2026-07-01',
        data: { token_usage: { total_input_tokens: 1, total_output_tokens: 2 } },
      },
      { date: '2026-07-02', data: {} },
    ]);
    expect(series[0]).toMatchObject({
      date: '2026-07-01',
      input: 1,
      output: 2,
      total: 3,
      userTurns: 0,
    });
    expect(series[1].total).toBe(0);
  });

  it('aggregates performance by date', () => {
    const rows = aggregatePerformanceByDate([
      { date: '2026-07-01', request_count: 2, ttft_avg_ms: 100, tps_avg: 10 },
      { date: '2026-07-01', request_count: 3, ttft_avg_ms: 200, tps_avg: 20 },
      { date: '2026-07-02', request_count: 1, ttft_avg_ms: 50, tps_avg: 5 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].requests).toBe(5);
    expect(rows[0].ttftAvg).toBe(150);
  });
});

describe('performance hour profile', () => {
  const rows = [
    { hour: 9, provider: 'openai', model: 'gpt', request_count: 4, ttft_avg_ms: 100, tps_avg: 10 },
    { hour: 9, provider: 'openai', model: 'gpt', request_count: 6, ttft_avg_ms: 200, tps_avg: 20 },
    {
      hour: 9,
      provider: 'anthropic',
      model: 'haiku',
      request_count: 2,
      ttft_avg_ms: 50,
      tps_avg: 5,
    },
    { hour: 10, provider: 'openai', model: 'gpt', request_count: 1, ttft_avg_ms: 80, tps_avg: 8 },
  ];

  it('merges the same hour across days into one point', () => {
    const series = aggregatePerformanceByHour(rows);
    expect(series.map((p) => p.hour)).toEqual([9, 10]);
    expect(series[0].models).toHaveLength(2);
  });

  it('sums requests per model but averages ttft/tps', () => {
    const series = aggregatePerformanceByHour(rows);
    const gpt = series[0].models.find((m) => m.model === 'gpt')!;
    expect(gpt.request_count).toBe(10);
    expect(gpt.ttft_avg_ms).toBe(150);
    expect(gpt.tps_avg).toBe(15);
  });

  it('summarises the whole profile for the chart headers', () => {
    const totals = perfHourTotals(aggregatePerformanceByHour(rows));
    expect(totals.requests).toBe(13);
    expect(totals.models).toBe(2);
    /* 均值是对「聚合后的小时点」求的：9 点那两个 gpt 行先折成 150，再和 haiku 的 50、
       10 点的 80 一起除以 3。拿原始行直接除以 4 会把「同小时跨天」当成两份权重。 */
    expect(totals.ttft).toBeCloseTo((150 + 50 + 80) / 3);
    expect(totals.tps).toBeCloseTo((15 + 5 + 8) / 3);
  });

  it('returns empty totals for an empty profile', () => {
    expect(perfHourTotals([])).toEqual({ requests: 0, ttft: 0, tps: 0, models: 0 });
  });

  it('flattens the nested single-day payload into the same shape', () => {
    const series = toPerfHourSeries([
      {
        hour: 0,
        providers: [
          { provider: 'openai', model: 'gpt', request_count: 3, ttft_avg_ms: 90, tps_avg: 9 },
        ],
      },
    ]);
    expect(series[0].models[0].request_count).toBe(3);
  });
});

describe('group profile', () => {
  it('recognizes reserved scope', () => {
    expect(isGroupProfileScope(GROUP_PROFILE_STATE_SCOPE)).toBe(true);
    expect(isGroupProfileScope('group:1')).toBe(false);
  });

  it('normalizes raw profile', () => {
    const p = normalizeGroupProfile(
      {
        tag_counts: { game: 3 },
        term_mappings: { 大班: '妮可' },
        member_alias_ids: { 老板: ['1', '2'] },
        last_updated: '2026-07-01',
      },
      'group:9',
    );
    expect(p.term_mappings.大班).toBe('妮可');
    expect(p.member_alias_ids.老板).toEqual(['1', '2']);
    expect(normalizeGroupProfile(null, 'group:x').scope_key).toBe('group:x');
  });
});

describe('ops diagnostics helpers', () => {
  it('summarizes trigger replay', () => {
    const s = summarizeTriggerReplay({
      outcome: 'blocked',
      steps: [
        { step: 'enable_ai', pass: true },
        { step: 'blacklist', pass: false },
      ],
    });
    expect(s.failedStep).toBe('blacklist');
    expect(s.passedSteps).toBe(1);
    expect(s.labelKey).toBe('blocked');
  });

  it('multimodal health levels', () => {
    expect(multimodalHealthLevel(0.1, true)).toBe('ok');
    expect(multimodalHealthLevel(0.6, true)).toBe('warn');
    expect(multimodalHealthLevel(0.9, true)).toBe('critical');
    expect(multimodalHealthLevel(0, false)).toBe('warn');
    expect(multimodalHealthLevel(0.2, false)).toBe('critical');
  });

  it('bot connection summary', () => {
    const s = botConnectionSummary([{ connected: true }, { connected: false }]);
    expect(s).toEqual({ total: 2, connected: 1, offline: 1, allOnline: false });
  });

  it('validates snapshot import', () => {
    expect(validateSnapshotImport(null).ok).toBe(false);
    expect(validateSnapshotImport({ version: 1, ai_config: {} }).ok).toBe(true);
    expect(validateSnapshotImport({ foo: 1 }).ok).toBe(false);
  });

  it('download filename + ooc label + idle bucket', () => {
    expect(downloadJsonFilename('snap', new Date(2026, 6, 24))).toBe('snap-20260724.json');
    expect(oocHitLabel(null)).toBe('clean');
    expect(oocHitLabel({ category: 'ai_selfref', matched: ['AI自指'] })).toContain('ai_selfref');
    expect(sessionIdleBucket(10, 1800)).toBe('active');
    expect(sessionIdleBucket(2000, 1800)).toBe('idle');
    expect(sessionIdleBucket(null)).toBe('unknown');
  });
});

describe('batch push image helpers', () => {
  it('detects image files', () => {
    expect(isImageFile(new File([], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isImageFile(new File([], 'a.txt', { type: 'text/plain' }))).toBe(false);
    expect(isImageFile(null)).toBe(false);
  });

  it('builds img tag for backend BatchPush', () => {
    const tag = buildBatchPushImageTag('data:image/png;base64,AAA', 120.6, 80.2);
    expect(tag).toBe('<img src="data:image/png;base64,AAA" width="121" height="80" />');
    // bare base64 gets data URL prefix so split(",")[-1] still works
    expect(buildBatchPushImageTag('AAA', 1, 1)).toContain('data:image/png;base64,AAA');
  });

  it('keeps editor placeholders free of base64', () => {
    const ph = buildBatchPushImagePlaceholder('bp_x1', 800, 600);
    expect(ph).toBe('<img data-bp-id="bp_x1" width="800" height="600" alt="image" />');
    expect(ph).not.toContain('base64');
    expect(ph.length).toBeLessThan(80);
  });

  it('expands placeholders for submit', () => {
    const assets = {
      bp_a: { dataUrl: 'data:image/png;base64,AAA', width: 10, height: 20 },
    };
    const body = '<p>hi</p>\n<img data-bp-id="bp_a" width="10" height="20" alt="image" />\n';
    expect(expandBatchPushBody(body, assets)).toContain(
      '<img src="data:image/png;base64,AAA" width="10" height="20" />',
    );
    expect(expandBatchPushBody(body, assets)).not.toContain('data-bp-id');
  });

  it('normalizes pasted data-URL imgs into placeholders', () => {
    const raw = '<p>x</p><img src="data:image/png;base64,AAAA" width="100" height="50" />';
    const { text, assets, extracted } = normalizeBatchPushBodyImages(raw);
    expect(extracted).toBe(1);
    expect(text).not.toContain('base64');
    expect(text).toMatch(/data-bp-id="/);
    const id = /data-bp-id="([^"]+)"/.exec(text)?.[1] ?? '';
    expect(assets[id]?.dataUrl).toBe('data:image/png;base64,AAAA');
    expect(expandBatchPushBody(text, assets)).toContain('data:image/png;base64,AAAA');
  });

  it('prunes unused image assets', () => {
    const assets = {
      keep: { dataUrl: 'data:image/png;base64,A', width: 1, height: 1 },
      drop: { dataUrl: 'data:image/png;base64,B', width: 1, height: 1 },
    };
    const text = '<img data-bp-id="keep" width="1" height="1" alt="image" />';
    expect(pruneBatchPushImageAssets(text, assets)).toEqual({ keep: assets.keep });
  });

  it('inserts at selection', () => {
    expect(insertTextAt('hello', 'X', 2, 2)).toEqual({ next: 'heXllo', caret: 3 });
    expect(insertTextAt('hello', 'X', 1, 4)).toEqual({ next: 'hXo', caret: 2 });
  });

  it('collects images from DataTransfer-like files list', () => {
    const img = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    const txt = new File([new Uint8Array([1])], 'a.txt', { type: 'text/plain' });
    const dt = {
      files: {
        length: 2,
        item: (i: number) => (i === 0 ? img : txt),
      },
      items: null,
    } as unknown as DataTransfer;
    expect(collectImageFilesFromDataTransfer(dt)).toEqual([img]);
    expect(collectImageFilesFromDataTransfer(null)).toEqual([]);
  });
});

describe('dashboard command colors', () => {
  it('returns stable non-gray colors for arbitrary command names', () => {
    const a = getCommandColor('genshin_uid_查询');
    const b = getCommandColor('genshin_uid_查询');
    const c = getCommandColor('help');
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9a-f]{6}$/i);
    expect(a.toLowerCase()).not.toBe('#6b7280');
    // different names usually differ (not guaranteed if hash collides; help vs 查询 are far apart)
    expect(hashCommandName('genshin_uid_查询')).not.toBe(hashCommandName('help'));
    expect(typeof c).toBe('string');
  });

  it('keeps legacy override for known mock names', () => {
    expect(getCommandColor('全天候')).toBe('#3b82f6');
    expect(getCommandColor('mr')).toBe('#8b5cf6');
  });

  it('collects command keys from trigger rows', () => {
    const rows = [
      { group: 'A', help: 1, start: 2 },
      { group: 'B', help: 0, ping: 3 },
    ];
    expect(collectCommandKeysFromTriggerRows(rows)).toEqual(['help', 'ping', 'start']);
  });

  it('formats compact metrics for calendar cells', () => {
    expect(formatCompactMetric(42)).toBe('42');
    expect(formatCompactMetric(1200)).toBe('1.2k');
    expect(formatCompactMetric(3_000_000)).toBe('3M');
    expect(formatCompactMetric(0)).toBe('0');
  });

  it('picks latest date with positive metric', () => {
    expect(latestDateWithMetric({ '2026-01-01': 0, '2026-01-03': 10, '2026-01-02': 5 })).toBe(
      '2026-01-03',
    );
    expect(latestDateWithMetric({ a: 0 })).toBeNull();
  });
});

describe('asPercent', () => {
  it('appends the unit the backend stripped off', () => {
    expect(asPercent('20.78')).toBe('20.78%');
    expect(asPercent('47.71')).toBe('47.71%');
    expect(asPercent(0)).toBe('0%');
  });

  it('does not double the unit or decorate an empty value', () => {
    expect(asPercent('20.78%')).toBe('20.78%');
    expect(asPercent('')).toBe('0%');
  });
});

describe('sparkHeadline', () => {
  it('shows today value', () => {
    expect(sparkHeadline(['10-13', '10-14'], [1200, 183], '10-14')).toBe('183');
  });

  it('falls back to last non-zero day when today is 0 (old backend excluded today)', () => {
    expect(sparkHeadline(['10-12', '10-13', '10-14'], [900, 1200, 0], '10-14')).toBe('1,200');
  });

  it('keeps a real 0 when the last day is not today', () => {
    expect(sparkHeadline(['10-12', '10-13'], [900, 0], '10-14')).toBe('0');
  });

  it('skips trailing zeros when picking the fallback day', () => {
    expect(sparkHeadline(['10-12', '10-13', '10-14'], [900, 0, 0], '10-14')).toBe('900');
  });

  it('reports 0 when the whole series is empty', () => {
    expect(sparkHeadline(['10-13', '10-14'], [0, 0], '10-14')).toBe('0');
  });

  it('handles an empty series without throwing', () => {
    expect(sparkHeadline([], [], '10-14')).toBe('0');
  });
});

describe('stripExceptionGroupGutters', () => {
  it('removes ExceptionGroup pipe gutters and keeps traceback text', () => {
    const raw = [
      '  |   File "stdio.py", line 158, in stdout_reader',
      '  |     await read_stream_writer.send(exc)',
      '  | anyio.BrokenResourceError',
      '    +------------------------------------',
    ].join('\n');
    const cleaned = stripExceptionGroupGutters(raw);
    expect(cleaned).not.toContain('|');
    expect(cleaned).toContain('File "stdio.py", line 158, in stdout_reader');
    expect(cleaned).toContain('await read_stream_writer.send(exc)');
    expect(cleaned).toContain('+------------------------------------');
  });

  it('leaves ordinary traceback lines unchanged', () => {
    const raw = 'Traceback (most recent call last):\n  File "a.py", line 1, in <module>';
    expect(stripExceptionGroupGutters(raw)).toBe(raw);
  });
});

describe('composeLogTimestamp', () => {
  it('prefixes MM-DD time with the log file year', () => {
    expect(composeLogTimestamp('09-13 00:00:09', '2026-09-13')).toBe('2026-09-13 00:00:09');
  });

  it('does not double-prefix when year is already present', () => {
    expect(composeLogTimestamp('2026-09-13 00:00:09', '2026-09-13')).toBe('2026-09-13 00:00:09');
  });

  it('formatLogTimestamp does not fall back to year 2001', () => {
    const text = formatLogTimestamp('09-13 00:00:09', '2026-09-13', 'en-US');
    expect(text).toContain('2026');
    expect(text).not.toContain('2001');
  });
});

// ── Dashboard 三接口并发降级（issue #282）───────────────────────────
describe('unwrapSettledRows', () => {
  it('returns rows when the request fulfilled', () => {
    const rows = [{ group: 'g1' }];
    expect(unwrapSettledRows({ status: 'fulfilled', value: rows })).toEqual(rows);
  });

  it('degrades a rejected request to empty rows and reports the reason', () => {
    const errors: unknown[] = [];
    const result = unwrapSettledRows(
      { status: 'rejected', reason: new Error('db down') },
      (reason) => errors.push(reason),
    );
    expect(result).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('keeps sibling data when only one of the concurrent requests fails', async () => {
    const errs: unknown[] = [];
    const settled = await Promise.allSettled([
      Promise.resolve([{ command: 'test' }]),
      Promise.reject(new Error('timeout')),
      Promise.resolve([{ user: 'u1' }]),
    ]);
    const [commands, groups, users] = settled.map((s) =>
      unwrapSettledRows(s as PromiseSettledResult<Record<string, unknown>[]>, (e) => errs.push(e)),
    );
    expect(commands).toEqual([{ command: 'test' }]);
    expect(groups).toEqual([]);
    expect(users).toEqual([{ user: 'u1' }]);
    expect(errs).toHaveLength(1);
  });

  it('tolerates a fulfilled undefined payload', () => {
    const result = unwrapSettledRows({
      status: 'fulfilled',
      value: undefined as unknown as Record<string, unknown>[],
    });
    expect(result).toEqual([]);
  });

  it('works without an onError callback', () => {
    expect(unwrapSettledRows({ status: 'rejected', reason: 'x' })).toEqual([]);
  });
});
