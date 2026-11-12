import { describe, expect, it } from 'vitest';
import enLogs from '@/i18n/locales/en-US/logs.json';
import jaLogs from '@/i18n/locales/ja-JP/logs.json';
import zhLogs from '@/i18n/locales/zh-CN/logs.json';
import { LOGS_VIEW_ORDER, parseLogsTab } from './traceUtils';

describe('parseLogsTab', () => {
  it('defaults to traces when tab param is missing or unknown', () => {
    expect(parseLogsTab(null)).toBe('traces');
    expect(parseLogsTab(undefined)).toBe('traces');
    expect(parseLogsTab('')).toBe('traces');
    expect(parseLogsTab('unknown')).toBe('traces');
    expect(parseLogsTab('traces')).toBe('traces');
  });

  it('resolves all four views and legacy aliases', () => {
    expect(parseLogsTab('errors')).toBe('errors');
    expect(parseLogsTab('error-reports')).toBe('errors');
    expect(parseLogsTab('runtime')).toBe('runtime');
    expect(parseLogsTab('logs')).toBe('runtime');
    expect(parseLogsTab('history')).toBe('runtime');
    expect(parseLogsTab('http-traces')).toBe('http-traces');
    expect(parseLogsTab('httpTraces')).toBe('http-traces');
  });

  it('orders tabs as traces, errors, runtime, http-traces', () => {
    expect(LOGS_VIEW_ORDER).toEqual(['traces', 'errors', 'runtime', 'http-traces']);
  });
});

describe('logs locale keys', () => {
  it('keeps matching leaf keys across zh-CN, en-US, and ja-JP', () => {
    const zhKeys = Object.keys(zhLogs).sort();
    expect(Object.keys(enLogs).sort()).toEqual(zhKeys);
    expect(Object.keys(jaLogs).sort()).toEqual(zhKeys);
  });

  it('uses the expected zh-CN labels for all four tabs', () => {
    expect(zhLogs.viewTraces).toBe('命令追踪');
    expect(zhLogs.viewErrorReports).toBe('错误报告');
    expect(zhLogs.viewRuntime).toBe('历史日志');
    expect(zhLogs.viewHttpTraces).toBe('HTTP追踪');
  });
});
