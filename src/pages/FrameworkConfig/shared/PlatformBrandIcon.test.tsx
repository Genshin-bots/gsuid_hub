import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlatformBrandIcon } from './PlatformBrandIcon';
import { FIELD_GRID_CLASS } from './ProgressivePrimitives';

describe('FrameworkConfig layout & PlatformBrandIcon', () => {
  it('enforces desktop 3-column grid without full-row desktop span stretching', () => {
    expect(FIELD_GRID_CLASS).toContain('lg:grid-cols-3');
    expect(FIELD_GRID_CLASS).not.toContain('md:col-span-2');
    expect(FIELD_GRID_CLASS).not.toContain('lg:col-span-');
  });

  it('renders bare inline SVG glyphs without background wrapper boxes for all GsCore platforms', () => {
    const platforms = [
      'onebot',
      'onebot_v12',
      'red',
      'qqguild',
      'qqgroup',
      'telegram',
      'discord',
      'kook',
      'kaiheila',
      'dodo',
      'feishu',
      'ntchat',
      'villa',
      'console',
      'web',
      'unknown_adapter',
    ];

    for (const platform of platforms) {
      const html = renderToStaticMarkup(<PlatformBrandIcon platform={platform} size={16} />);
      expect(html.startsWith('<svg')).toBe(true);
      expect(html.endsWith('</svg>')).toBe(true);
    }
  });
});
