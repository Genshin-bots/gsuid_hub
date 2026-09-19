import { describe, expect, it } from 'vitest';
import { resolveDividerSubtitle } from './dividerDisplay';

describe('resolveDividerSubtitle', () => {
  it('renders GsDivider.desc under a distinct data title (SayuStock kronos_divider)', () => {
    expect(
      resolveDividerSubtitle(
        'Kronos AI预测的运行配置；网页控制台修改后立即生效，无需重启',
        'AI模型预测（Kronos）',
        'kronos_divider',
      ),
    ).toBe('Kronos AI预测的运行配置；网页控制台修改后立即生效，无需重启');
  });

  it('hides subtitle when desc duplicates the divider title', () => {
    expect(resolveDividerSubtitle('额外配置', '额外配置', 'AgentBase')).toBeNull();
  });

  it('hides convert-to-plugin fallback that used the field key as desc', () => {
    expect(
      resolveDividerSubtitle('kronos_divider', 'AI模型预测（Kronos）', 'kronos_divider'),
    ).toBeNull();
  });

  it('hides empty desc', () => {
    expect(resolveDividerSubtitle('  ', '标题', 'key')).toBeNull();
  });

  it('still shows desc when there is no title', () => {
    expect(resolveDividerSubtitle('以下为高级配置项', null, '_div')).toBe('以下为高级配置项');
  });
});
