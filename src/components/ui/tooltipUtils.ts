export const INTERACTIVE_TRIGGER_SELECTOR =
  'button, a[href], input, select, textarea, label, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="tab"], [contenteditable="true"]';

export interface ElementLike {
  matches(selector: string): boolean;
  querySelector(selector: string): unknown;
}

function isElementLike(target: unknown): target is ElementLike {
  return (
    typeof target === 'object' &&
    target !== null &&
    typeof (target as ElementLike).matches === 'function' &&
    typeof (target as ElementLike).querySelector === 'function'
  );
}

/**
 * 判断某个 TooltipTrigger 被点击/轻触时是否应当切换提示框状态。
 *
 * - `openOnClick === true`：明确开启（如 `?` 帮助按钮）
 * - `openOnClick === false`：明确关闭（仅悬停/键盘聚焦）
 * - `openOnClick === undefined`：对纯信息展示元素（如裸 `<HelpCircle>` / `<Info>` /
 *   无交互子节点的 `<span>` / `<Badge>`）自动开启，避免干扰 `<Button>` / `<Switch>` / `<a>` 等交互控件。
 */
export function shouldToggleTooltipOnClick(
  openOnClick: boolean | undefined,
  target: unknown,
  hasChildOnClick: boolean,
): boolean {
  if (openOnClick === true) return true;
  if (openOnClick === false) return false;
  if (hasChildOnClick) return false;
  if (!isElementLike(target)) return false;
  if (target.matches(INTERACTIVE_TRIGGER_SELECTOR)) return false;
  if (target.querySelector(INTERACTIVE_TRIGGER_SELECTOR) !== null) return false;
  return true;
}

/**
 * 计算点击/轻触触发器后的目标状态。
 *
 * 指针点击时，Radix 的 `onPointerDown` 与 `DismissableLayer` 会在 `click` 之前把已打开的
 * Tooltip 先关闭；因此必须以 `pointerdown` 当刻记录的 `wasOpenOnPointerDown` 为准，
 * 避免“点已展开的问号反而立刻重新打开”。
 * 无前置 `pointerdown`（如键盘 Enter/Space 或程序化 `.click()`）时以当前 `currentOpen` 为准。
 */
export function resolveClickToggleAction(params: {
  hadPointerDown: boolean;
  wasOpenOnPointerDown: boolean;
  currentOpen: boolean;
}): 'open' | 'close' {
  const wasOpen = params.hadPointerDown ? params.wasOpenOnPointerDown : params.currentOpen;
  return wasOpen ? 'close' : 'open';
}

const INTERACTIVE_HTML_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea', 'label']);
const INTERACTIVE_ROLES = new Set(['button', 'switch', 'checkbox', 'radio', 'menuitem', 'tab']);
const INTERACTIVE_COMPONENT_NAMES = new Set([
  'Button',
  'Switch',
  'Checkbox',
  'Input',
  'Textarea',
  'Label',
  'SelectTrigger',
]);

/**
 * 渲染期轻量判断是否给触发器挂 `data-tooltip-tap`（用于移动端 iOS Safari 派发 click 及关闭灰块高亮）。
 * 真正的点击拦截以运行期 DOM 判定 `shouldToggleTooltipOnClick` 为准。
 */
export function isLikelyNonInteractiveTriggerElement(
  elementType: unknown,
  elementProps: Record<string, unknown> | undefined,
): boolean {
  if (typeof elementType === 'string') {
    if (INTERACTIVE_HTML_TAGS.has(elementType)) return false;
  } else if (
    elementType &&
    (typeof elementType === 'function' || typeof elementType === 'object')
  ) {
    const named = elementType as { displayName?: string; name?: string };
    const name = named.displayName ?? named.name;
    if (name && INTERACTIVE_COMPONENT_NAMES.has(name)) return false;
  }
  if (elementProps) {
    if (typeof elementProps.href === 'string') return false;
    if (typeof elementProps.role === 'string' && INTERACTIVE_ROLES.has(elementProps.role)) {
      return false;
    }
  }
  return true;
}
