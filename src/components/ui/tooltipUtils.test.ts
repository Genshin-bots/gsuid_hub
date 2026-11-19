import { describe, expect, it } from 'vitest';
import {
  INTERACTIVE_TRIGGER_SELECTOR,
  isLikelyNonInteractiveTriggerElement,
  resolveClickToggleAction,
  shouldToggleTooltipOnClick,
  type ElementLike,
} from './tooltipUtils';

function fakeElement(opts: { matches?: boolean; hasInteractiveChild?: boolean } = {}): ElementLike {
  return {
    matches: (selector: string) =>
      selector === INTERACTIVE_TRIGGER_SELECTOR && Boolean(opts.matches),
    querySelector: (selector: string) =>
      selector === INTERACTIVE_TRIGGER_SELECTOR && opts.hasInteractiveChild ? {} : null,
  };
}

describe('shouldToggleTooltipOnClick', () => {
  it('openOnClick=true 时强制允许点击切换（如 ? 帮助按钮）', () => {
    const buttonEl = fakeElement({ matches: true });
    expect(shouldToggleTooltipOnClick(true, buttonEl, true)).toBe(true);
    expect(shouldToggleTooltipOnClick(true, null, false)).toBe(true);
  });

  it('openOnClick=false 时强制关闭点击切换', () => {
    const svgEl = fakeElement({ matches: false, hasInteractiveChild: false });
    expect(shouldToggleTooltipOnClick(false, svgEl, false)).toBe(false);
  });

  it('未显式指定时对非交互元素自动开启（裸 HelpCircle / Info / 纯 span / Badge）', () => {
    const svgEl = fakeElement({ matches: false, hasInteractiveChild: false });
    expect(shouldToggleTooltipOnClick(undefined, svgEl, false)).toBe(true);
  });

  it('未显式指定时不拦截按钮/链接/表单或自带 onClick 的交互元素', () => {
    const buttonEl = fakeElement({ matches: true });
    const switchWrapper = fakeElement({ matches: false, hasInteractiveChild: true });
    const clickableSpan = fakeElement({ matches: false, hasInteractiveChild: false });

    expect(shouldToggleTooltipOnClick(undefined, buttonEl, false)).toBe(false);
    expect(shouldToggleTooltipOnClick(undefined, switchWrapper, false)).toBe(false);
    expect(shouldToggleTooltipOnClick(undefined, clickableSpan, true)).toBe(false);
    expect(shouldToggleTooltipOnClick(undefined, null, false)).toBe(false);
  });
});

describe('resolveClickToggleAction', () => {
  it('指针轻触关闭态的触发器 -> open', () => {
    expect(
      resolveClickToggleAction({
        hadPointerDown: true,
        wasOpenOnPointerDown: false,
        currentOpen: false,
      }),
    ).toBe('open');
  });

  it('指针轻触已展开的触发器（Radix 在 pointerdown 已先关掉 currentOpen）-> close 而非重开', () => {
    expect(
      resolveClickToggleAction({
        hadPointerDown: true,
        wasOpenOnPointerDown: true,
        currentOpen: false,
      }),
    ).toBe('close');
  });

  it('键盘激活或程序化 click（无前置 pointerdown）按当前 open 状态取反', () => {
    expect(
      resolveClickToggleAction({
        hadPointerDown: false,
        wasOpenOnPointerDown: true,
        currentOpen: false,
      }),
    ).toBe('open');
    expect(
      resolveClickToggleAction({
        hadPointerDown: false,
        wasOpenOnPointerDown: false,
        currentOpen: true,
      }),
    ).toBe('close');
  });
});

describe('isLikelyNonInteractiveTriggerElement', () => {
  it('识别普通信息展示元素为非交互触发器', () => {
    const HelpCircle = { displayName: 'HelpCircle' };
    expect(isLikelyNonInteractiveTriggerElement(HelpCircle, {})).toBe(true);
    expect(isLikelyNonInteractiveTriggerElement('span', {})).toBe(true);
    expect(isLikelyNonInteractiveTriggerElement('div', {})).toBe(true);
  });

  it('排除原生交互标签、带 href/交互 role 以及按钮/开关组件', () => {
    expect(isLikelyNonInteractiveTriggerElement('button', {})).toBe(false);
    expect(isLikelyNonInteractiveTriggerElement('a', { href: 'https://example.com' })).toBe(false);
    expect(isLikelyNonInteractiveTriggerElement('span', { role: 'button' })).toBe(false);
    expect(isLikelyNonInteractiveTriggerElement({ displayName: 'Button' }, {})).toBe(false);
    expect(isLikelyNonInteractiveTriggerElement({ displayName: 'Switch' }, {})).toBe(false);
  });
});
