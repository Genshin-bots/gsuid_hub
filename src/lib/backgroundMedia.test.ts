import { describe, expect, it } from 'vitest';
import { isVideoBackgroundUrl } from './backgroundMedia';

describe('isVideoBackgroundUrl', () => {
  it('detects video extensions, query/hash suffixes and data urls', () => {
    const urls = [
      'https://cdn.example.com/bg.mp4',
      'https://cdn.example.com/bg.webm',
      'https://cdn.example.com/bg.MP4',
      'https://cdn.example.com/bg.mov',
      'https://cdn.example.com/bg.m4v',
      'https://cdn.example.com/bg.ogv',
      'https://cdn.example.com/bg.mp4?token=abc',
      'https://cdn.example.com/bg.webm#t=3',
      'data:video/mp4;base64,AAAA',
    ];
    for (const u of urls) {
      expect(isVideoBackgroundUrl(u)).toBe(true);
    }
  });

  it('rejects images, gradients and empty values', () => {
    const urls = [
      null,
      undefined,
      '',
      'https://cdn.example.com/bg.jpg',
      'https://cdn.example.com/bg.png?fmt=mp4',
      'https://cdn.example.com/bg.mp4/extra',
      'linear-gradient(135deg, #000 0%, #fff 100%)',
      'data:image/gif;base64,AAAA',
    ];
    for (const u of urls) {
      expect(isVideoBackgroundUrl(u)).toBe(false);
    }
  });
});
