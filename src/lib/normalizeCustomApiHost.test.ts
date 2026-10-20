import { describe, expect, it } from 'vitest';
import { normalizeCustomApiHost, isIPv4Address, isIPv6Address } from './api';

describe('isIPv4Address', () => {
  it('correctly identifies valid IPv4 addresses', () => {
    expect(isIPv4Address('192.168.1.100')).toBe(true);
    expect(isIPv4Address('127.0.0.1')).toBe(true);
    expect(isIPv4Address('10.0.0.1')).toBe(true);
    expect(isIPv4Address('0.0.0.0')).toBe(true);
    expect(isIPv4Address('255.255.255.255')).toBe(true);
  });

  it('rejects invalid or non-IPv4 hosts', () => {
    expect(isIPv4Address('example.com')).toBe(false);
    expect(isIPv4Address('localhost')).toBe(false);
    expect(isIPv4Address('256.0.0.1')).toBe(false);
    expect(isIPv4Address('192.168.1')).toBe(false);
    expect(isIPv4Address('192.168.1.1.1')).toBe(false);
    expect(isIPv4Address('::1')).toBe(false);
  });
});

describe('isIPv6Address', () => {
  it('correctly identifies valid IPv6 addresses', () => {
    expect(isIPv6Address('::1')).toBe(true);
    expect(isIPv6Address('[::1]')).toBe(true);
    expect(isIPv6Address('fe80::1')).toBe(true);
    expect(isIPv6Address('[fe80::1]')).toBe(true);
  });

  it('rejects non-IPv6 hosts', () => {
    expect(isIPv6Address('192.168.1.1')).toBe(false);
    expect(isIPv6Address('localhost')).toBe(false);
    expect(isIPv6Address('example.com')).toBe(false);
  });
});

describe('normalizeCustomApiHost', () => {
  describe('bare IPv4 without port', () => {
    it('defaults to appending port :8765 and http:// protocol', () => {
      expect(normalizeCustomApiHost('192.168.1.100')).toBe('http://192.168.1.100:8765');
      expect(normalizeCustomApiHost('127.0.0.1')).toBe('http://127.0.0.1:8765');
      expect(normalizeCustomApiHost('10.0.0.1')).toBe('http://10.0.0.1:8765');
    });

    it('preserves existing protocol and appends port :8765', () => {
      expect(normalizeCustomApiHost('http://192.168.1.100')).toBe('http://192.168.1.100:8765');
      expect(normalizeCustomApiHost('https://192.168.1.100')).toBe('https://192.168.1.100:8765');
      expect(normalizeCustomApiHost('http://192.168.1.100/')).toBe('http://192.168.1.100:8765');
      expect(normalizeCustomApiHost('192.168.1.100/app')).toBe('http://192.168.1.100:8765/app');
    });
  });

  describe('IPv4 with port already specified', () => {
    it('does not duplicate port 8765', () => {
      expect(normalizeCustomApiHost('192.168.1.100:8765')).toBe('http://192.168.1.100:8765');
      expect(normalizeCustomApiHost('http://192.168.1.100:8765')).toBe('http://192.168.1.100:8765');
      expect(normalizeCustomApiHost('https://192.168.1.100:8765')).toBe(
        'https://192.168.1.100:8765',
      );
      expect(normalizeCustomApiHost('http://192.168.1.100:8765/')).toBe(
        'http://192.168.1.100:8765',
      );
    });

    it('preserves other ports and does not append 8765', () => {
      expect(normalizeCustomApiHost('192.168.1.100:8080')).toBe('http://192.168.1.100:8080');
      expect(normalizeCustomApiHost('http://192.168.1.100:9000')).toBe('http://192.168.1.100:9000');
      expect(normalizeCustomApiHost('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    });
  });

  describe('IPv6 addresses', () => {
    it('defaults to port 8765 for bare IPv6 without port', () => {
      expect(normalizeCustomApiHost('::1')).toBe('http://[::1]:8765');
      expect(normalizeCustomApiHost('[::1]')).toBe('http://[::1]:8765');
      expect(normalizeCustomApiHost('http://[::1]')).toBe('http://[::1]:8765');
      expect(normalizeCustomApiHost('https://[::1]')).toBe('https://[::1]:8765');
    });

    it('preserves specified port on IPv6', () => {
      expect(normalizeCustomApiHost('[::1]:8765')).toBe('http://[::1]:8765');
      expect(normalizeCustomApiHost('http://[::1]:8765')).toBe('http://[::1]:8765');
      expect(normalizeCustomApiHost('[::1]:9000')).toBe('http://[::1]:9000');
      expect(normalizeCustomApiHost('http://[::1]:9000')).toBe('http://[::1]:9000');
    });
  });

  describe('normal web address (not bare IP)', () => {
    it('does not append port for normal web addresses without port', () => {
      expect(normalizeCustomApiHost('localhost')).toBe('http://localhost');
      expect(normalizeCustomApiHost('http://localhost')).toBe('http://localhost');
      expect(normalizeCustomApiHost('example.com')).toBe('http://example.com');
      expect(normalizeCustomApiHost('http://example.com')).toBe('http://example.com');
      expect(normalizeCustomApiHost('https://console.sayu.bot')).toBe('https://console.sayu.bot');
      expect(normalizeCustomApiHost('http://example.com/app')).toBe('http://example.com/app');
    });

    it('preserves existing port on normal web addresses', () => {
      expect(normalizeCustomApiHost('localhost:8765')).toBe('http://localhost:8765');
      expect(normalizeCustomApiHost('http://localhost:8765')).toBe('http://localhost:8765');
      expect(normalizeCustomApiHost('localhost:8080')).toBe('http://localhost:8080');
      expect(normalizeCustomApiHost('example.com:8080')).toBe('http://example.com:8080');
      expect(normalizeCustomApiHost('https://example.com:8443')).toBe('https://example.com:8443');
    });
  });

  describe('empty and edge inputs', () => {
    it('returns empty string for empty or whitespace-only inputs', () => {
      expect(normalizeCustomApiHost('')).toBe('');
      expect(normalizeCustomApiHost('   ')).toBe('');
    });
  });
});
