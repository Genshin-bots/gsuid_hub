import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './utils';

class FakeElement {
  value = '';
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  focused = false;
  selected = false;
  selectionRange: [number, number] | null = null;

  constructor(
    public readonly tagName: string,
    private readonly dialogAncestor: FakeElement | null = null,
  ) {}

  setAttribute(name: string, val: string) {
    this.attributes.set(name, val);
  }

  appendChild(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement) {
    this.children = this.children.filter((c) => c !== child);
    child.parent = null;
    return child;
  }

  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }

  setSelectionRange(start: number, end: number) {
    this.selectionRange = [start, end];
  }

  closest(_selector: string) {
    return this.dialogAncestor;
  }
}

describe('copyTextToClipboard', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'HTMLElement', {
      value: originalHTMLElement,
      configurable: true,
    });
  });

  function setupDom(options: {
    isSecureContext: boolean;
    writeText?: (text: string) => Promise<void>;
    execResult?: boolean;
    insideDialog?: boolean;
  }) {
    const body = new FakeElement('BODY');
    const dialog = options.insideDialog ? new FakeElement('DIV') : null;
    const activeButton = new FakeElement('BUTTON', dialog);
    const createdTextareas: FakeElement[] = [];

    Object.defineProperty(globalThis, 'HTMLElement', {
      value: FakeElement,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { isSecureContext: options.isSecureContext },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: options.writeText ? { clipboard: { writeText: options.writeText } } : {},
      configurable: true,
    });

    const execCommand = vi.fn(() => options.execResult ?? true);
    Object.defineProperty(globalThis, 'document', {
      value: {
        body,
        activeElement: activeButton,
        createElement: (tag: string) => {
          const el = new FakeElement(tag.toUpperCase());
          if (tag === 'textarea') createdTextareas.push(el);
          return el;
        },
        execCommand,
      },
      configurable: true,
    });

    return { body, dialog, activeButton, createdTextareas, execCommand };
  }

  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeText = vi.fn(async () => {});
    const { execCommand } = setupDom({ isSecureContext: true, writeText });

    await copyTextToClipboard('B5B2-2E81');

    expect(writeText).toHaveBeenCalledWith('B5B2-2E81');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to execCommand in non-secure HTTP contexts (non-localhost)', async () => {
    const { body, activeButton, createdTextareas, execCommand } = setupDom({
      isSecureContext: false,
      execResult: true,
    });

    await copyTextToClipboard('B5B2-2E81');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(createdTextareas).toHaveLength(1);
    expect(createdTextareas[0].value).toBe('B5B2-2E81');
    expect(createdTextareas[0].selected).toBe(true);
    expect(createdTextareas[0].selectionRange).toEqual([0, 9]);
    expect(body.children).toHaveLength(0);
    expect(activeButton.focused).toBe(true);
  });

  it('mounts fallback textarea inside active dialog so Radix FocusScope does not steal focus', async () => {
    const { body, dialog, createdTextareas, execCommand } = setupDom({
      isSecureContext: false,
      insideDialog: true,
      execResult: true,
    });

    let parentDuringCopy: FakeElement | null = null;
    execCommand.mockImplementation(() => {
      parentDuringCopy = createdTextareas[0].parent;
      return true;
    });

    await copyTextToClipboard('CODE-1234');

    expect(parentDuringCopy).toBe(dialog);
    expect(dialog?.children).toHaveLength(0);
    expect(body.children).toHaveLength(0);
  });

  it('falls back to execCommand when navigator.clipboard.writeText rejects', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    const { execCommand } = setupDom({ isSecureContext: true, writeText, execResult: true });

    await copyTextToClipboard('fallback-ok');

    expect(writeText).toHaveBeenCalledWith('fallback-ok');
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('throws and cleans up textarea if execCommand returns false', async () => {
    const { body } = setupDom({
      isSecureContext: false,
      execResult: false,
    });

    await expect(copyTextToClipboard('fail')).rejects.toThrow('execCommand copy failed');
    expect(body.children).toHaveLength(0);
  });
});
