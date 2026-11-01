import { describe, expect, it } from 'vitest';
import { displayCommandName, simplifyRegexKeyword } from './regexCommand';

describe('simplifyRegexKeyword', () => {
  it('把正则简化成可读名', () => {
    expect(simplifyRegexKeyword('^(?:[sS]\\d+)?赛季精灵$')).toBe('赛季精灵');
  });

  it('对纯文本命令幂等', () => {
    expect(simplifyRegexKeyword('帮助')).toBe('帮助');
    expect(simplifyRegexKeyword('其他命令')).toBe('其他命令');
  });
});

describe('displayCommandName', () => {
  it('普通文本命令原样返回，不剥字符', () => {
    expect(displayCommandName('帮助')).toBe('帮助');
    expect(displayCommandName('1+1')).toBe('1+1');
    expect(displayCommandName('')).toBe('');
  });

  it('正则命令走简化', () => {
    expect(displayCommandName('^(?:[sS]\\d+)?赛季精灵$')).toBe('赛季精灵');
    expect(displayCommandName('^(?P<kind>查询)\\w+$')).toBe('查询');
  });
});
