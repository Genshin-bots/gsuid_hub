import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginSrc = readFileSync(path.resolve(__dirname, './Login.tsx'), 'utf8');
const fontsSrc = readFileSync(path.resolve(__dirname, '../fonts.css'), 'utf8');
const indexCss = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

describe('login email input does not use Chrome type=email font fallback (P-37)', () => {
  it('uses type=text + inputMode=email instead of type=email', () => {
    expect(loginSrc).not.toMatch(/type=["']email["']/);
    expect(loginSrc).toMatch(/inputMode=["']email["']/);
    expect(loginSrc).toMatch(/type=["']text["']/);
  });

  it('restricts Twemoji to emoji unicode-range so ASCII is not a COLR candidate', () => {
    expect(fontsSrc).toMatch(/font-family:\s*'Twemoji Mozilla'/);
    expect(fontsSrc).toMatch(/unicode-range:/);
    expect(fontsSrc).toMatch(/U\+1F000-1FAFF/);
  });

  it('keeps form controls on MiSans without Twemoji in @layer base', () => {
    expect(indexCss).toMatch(
      /input,\s*\n\s*textarea,\s*\n\s*select \{\s*\n\s*font-family: 'MiSans VF', sans-serif;/,
    );
  });
});
