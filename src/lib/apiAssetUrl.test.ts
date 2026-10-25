import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { logsApi, resolveApiAssetUrl, setCustomApiHost } from './api';

const mem = new Map<string, string>();

beforeAll(() => {
  const store: Storage = {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (key: string) => (mem.has(key) ? mem.get(key)! : null),
    key: (index: number) => Array.from(mem.keys())[index] ?? null,
    removeItem: (key: string) => {
      mem.delete(key);
    },
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
});

describe('resolveApiAssetUrl', () => {
  afterEach(() => {
    setCustomApiHost('');
  });

  it('prefixes a root-relative /api path with the custom host', () => {
    setCustomApiHost('http://192.168.101.12:8765/');
    expect(resolveApiAssetUrl('/api/auth/avatar/444835641_at_qq.com.png')).toBe(
      'http://192.168.101.12:8765/api/auth/avatar/444835641_at_qq.com.png',
    );
  });

  it('leaves the path relative when no custom host is set', () => {
    expect(resolveApiAssetUrl('/api/auth/avatar/a.png')).toBe('/api/auth/avatar/a.png');
  });

  it('does not rewrite absolute or non-api urls', () => {
    setCustomApiHost('http://192.168.101.12:8765');
    expect(resolveApiAssetUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(resolveApiAssetUrl('/ICON.png')).toBe('/ICON.png');
  });
});

describe('logsApi.getStreamUrl', () => {
  afterEach(() => {
    setCustomApiHost('');
  });

  it('prefixes stream url with custom host when configured', () => {
    setCustomApiHost('http://192.168.101.12:8765');
    expect(logsApi.getStreamUrl('test-token')).toBe(
      'http://192.168.101.12:8765/api/logs/stream?token=test-token&level=all',
    );
  });

  it('uses relative path when no custom host is set', () => {
    setCustomApiHost('');
    expect(logsApi.getStreamUrl('test-token', 'info', '123')).toBe(
      '/api/logs/stream?token=test-token&level=info&last_event_id=123',
    );
  });
});
