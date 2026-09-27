import { describe, expect, it } from 'vitest';
import { BackendUnreachableError, isBackendUnreachable, isUnreachableResponse } from './backendReachability';

/**
 * 这些用例锁的是一条真实踩过的坑：dev 下 Core 没启动时，Vite 代理返回
 * `500 + text/plain + 空 body`，fetch **不会** reject。只判 `TypeError`
 * 会让登录页在后端宕机时照样显示成一个看起来正常的表单。
 */
describe('isUnreachableResponse', () => {
  it('treats the dev proxy 500 with empty body as unreachable', () => {
    // Vite 转发 ECONNREFUSED 时自己造的响应
    expect(
      isUnreachableResponse({ status: 500, bodyIsJson: false, hasBody: false }),
    ).toBe(true);
  });

  it('treats gateway errors as unreachable regardless of body', () => {
    for (const status of [502, 503, 504]) {
      expect(isUnreachableResponse({ status, bodyIsJson: false, hasBody: false })).toBe(true);
    }
  });

  it('keeps the backend 500 JSON envelope as a normal business error', () => {
    // 后端自己回的 5xx 必须照常把 msg/detail 抛给 UI，不能吞成「连不上」
    expect(
      isUnreachableResponse({ status: 500, bodyIsJson: true, hasBody: true }),
    ).toBe(false);
  });

  it('does not treat 4xx as unreachable', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isUnreachableResponse({ status, bodyIsJson: false, hasBody: false })).toBe(false);
    }
  });

  it('does not treat 2xx as unreachable', () => {
    expect(isUnreachableResponse({ status: 200, bodyIsJson: true, hasBody: true })).toBe(false);
  });
});

describe('isBackendUnreachable', () => {
  it('recognises the explicit marker', () => {
    expect(isBackendUnreachable(new BackendUnreachableError('x'))).toBe(true);
  });

  it('recognises a fetch TypeError (production / cross-origin case)', () => {
    expect(isBackendUnreachable(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('recognises Safari and Firefox network-layer messages', () => {
    expect(isBackendUnreachable(new Error('Load failed'))).toBe(true);
    expect(
      isBackendUnreachable(new Error('NetworkError when attempting to fetch resource.')),
    ).toBe(true);
  });

  it('does not swallow ordinary backend business errors', () => {
    expect(isBackendUnreachable(new Error('注册码错误'))).toBe(false);
    expect(isBackendUnreachable(new Error('session expired, please log in again'))).toBe(false);
  });

  it('does not mistake our own HTTP error strings for a network failure', () => {
    // authCrypto 里拼的 'Failed to fetch auth pubkey: HTTP 500' 属于后端有应答
    expect(isBackendUnreachable(new Error('Failed to fetch auth pubkey: HTTP 500'))).toBe(false);
  });
});
