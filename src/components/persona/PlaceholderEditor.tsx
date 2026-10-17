import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { PlaceholderHintBody } from '@/components/persona/PlaceholderResolved';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  BADGE_CLASS,
  columnCountOf,
  filterPlaceholderNames,
  mentionQueryAt,
  moveGridIndex,
  placeholderClass,
  placeholderLabel,
  type GridKey,
} from '@/components/persona/placeholderTokens';

const TOKEN_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
const DRAG_TYPE = 'application/x-gs-placeholder';

let dragToken = '';
let dragSource: HTMLElement | null = null;
let droppedInside = false;

function tokenElement(node: Node | null, stop: Node | null = null): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== stop) {
    if (cur instanceof HTMLElement && cur.dataset.token) return cur;
    cur = cur.parentNode;
  }
  return null;
}

function skipEmpty(node: Node | null, dir: 'prev' | 'next'): Node | null {
  let cur = node;
  while (cur && cur.nodeType === Node.TEXT_NODE && !(cur.textContent ?? '').length) {
    cur = dir === 'prev' ? cur.previousSibling : cur.nextSibling;
  }
  return cur;
}

function badgeBesideCaret(
  root: HTMLElement,
  range: Range,
  dir: 'back' | 'fwd',
): HTMLElement | null {
  if (!range.collapsed) return null;
  const { startContainer, startOffset } = range;
  if (!root.contains(startContainer)) return null;
  const inside = tokenElement(startContainer, root);
  if (inside && root.contains(inside)) return inside;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent ?? '';
    const atEdge = dir === 'back' ? startOffset === 0 : startOffset === text.length;
    if (!atEdge) return null;
    const sibling = dir === 'back' ? startContainer.previousSibling : startContainer.nextSibling;
    return tokenElement(skipEmpty(sibling, dir === 'back' ? 'prev' : 'next'));
  }
  const index = dir === 'back' ? startOffset - 1 : startOffset;
  const child = startContainer.childNodes[index] ?? null;
  return tokenElement(skipEmpty(child, dir === 'back' ? 'prev' : 'next'));
}

function makeBadge(name: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.contentEditable = 'false';
  span.draggable = true;
  span.dataset.token = name;
  span.className = cn(BADGE_CLASS, 'cursor-grab active:cursor-grabbing', placeholderClass(name));
  span.textContent = placeholderLabel(name);
  span.addEventListener('dragstart', (event) => {
    dragToken = name;
    dragSource = span;
    droppedInside = false;
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(DRAG_TYPE, name);
    event.dataTransfer.setData('text/plain', `{{${name}}}`);
    event.dataTransfer.effectAllowed = 'copyMove';
  });
  span.addEventListener('dragend', () => {
    const parent = span.parentElement;
    const leave = !droppedInside && dragSource === span && span.isConnected && parent;
    if (leave && parent) {
      span.remove();
      parent.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (dragSource === span) dragSource = null;
    dragToken = '';
    droppedInside = false;
  });
  return span;
}

function appendPlain(parent: HTMLElement, text: string) {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) parent.appendChild(document.createElement('br'));
    if (line) parent.appendChild(document.createTextNode(line));
  });
}

export function paintPlaceholderText(root: HTMLElement, value: string) {
  root.replaceChildren();
  TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  for (const match of value.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) appendPlain(root, value.slice(cursor, start));
    root.appendChild(makeBadge(match[1] ?? ''));
    cursor = start + match[0].length;
  }
  if (cursor < value.length) appendPlain(root, value.slice(cursor));
}

export function readPlaceholderText(root: HTMLElement): string {
  let out = '';
  const walk = (node: Node, block: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const token = node.dataset.token;
    if (token) {
      out += `{{${token}}}`;
      return;
    }
    if (node.tagName === 'BR') {
      out += '\n';
      return;
    }
    const nested = node.tagName === 'DIV' || node.tagName === 'P';
    if (nested && block && out && !out.endsWith('\n')) out += '\n';
    node.childNodes.forEach((child) => {
      walk(child, true);
    });
  };
  root.childNodes.forEach((child) => {
    walk(child, false);
  });
  return out.replace(/\u00a0/g, ' ');
}

function captureCaretOffset(root: HTMLElement): number | null {
  // 不能往正文里插标记。keyup 里插节点会把光标拆走，@ / 列表刚打开就被关掉。
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return null;
  let count = 0;
  let found = false;
  const countWhole = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      count += (node.textContent ?? '').replace(/\u00a0/g, ' ').length;
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const token = node.dataset.token;
    if (token) {
      count += `{{${token}}}`.length;
      return;
    }
    if (node.tagName === 'BR') {
      count += 1;
      return;
    }
    node.childNodes.forEach(countWhole);
  };
  const walk = (node: Node) => {
    if (found) return;
    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
        count += text.slice(0, range.startOffset).length;
      } else {
        for (let index = 0; index < range.startOffset; index += 1) {
          const child = node.childNodes[index];
          if (child) countWhole(child);
        }
      }
      found = true;
      return;
    }
    countWhole(node);
  };
  root.childNodes.forEach(walk);
  return found ? count : null;
}

function placeOffset(root: HTMLElement, offset: number) {
  let left = offset;
  let target: Node = root;
  let at = root.childNodes.length;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (left <= text.length) {
        target = node;
        at = left;
        return true;
      }
      left -= text.length;
      return false;
    }
    if (!(node instanceof HTMLElement)) return false;
    if (node.dataset.token) {
      const size = `{{${node.dataset.token}}}`.length;
      if (left <= size) {
        target = node.parentNode ?? root;
        at = indexOfNode(node) + (left === 0 ? 0 : 1);
        return true;
      }
      left -= size;
      return false;
    }
    if (node.tagName === 'BR') {
      if (left <= 1) {
        target = node.parentNode ?? root;
        at = indexOfNode(node) + (left === 0 ? 0 : 1);
        return true;
      }
      left -= 1;
      return false;
    }
    for (const child of node.childNodes) {
      if (walk(child)) return true;
    }
    return false;
  };
  for (const child of root.childNodes) {
    if (walk(child)) break;
  }
  const range = document.createRange();
  const max =
    target.nodeType === Node.TEXT_NODE
      ? (target.textContent ?? '').length
      : target.childNodes.length;
  range.setStart(target, Math.min(at, max));
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function indexOfNode(node: Node): number {
  const parent = node.parentNode;
  if (!parent) return 0;
  return Array.prototype.indexOf.call(parent.childNodes, node);
}

type MentionAnchor = {
  node: Text;
  start: number;
  end: number;
};

type MentionMenu = {
  query: string;
  left: number;
  anchorTop: number;
  anchorBottom: number;
};

function textCaret(root: HTMLElement): { node: Text; offset: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType === Node.TEXT_NODE) {
    return { node: startContainer as Text, offset: startOffset };
  }
  if (!(startContainer instanceof HTMLElement)) return null;
  const prev = startContainer.childNodes[startOffset - 1] ?? null;
  if (!prev || prev.nodeType !== Node.TEXT_NODE) return null;
  return { node: prev as Text, offset: (prev.textContent ?? '').length };
}

function mentionAtCaret(root: HTMLElement): {
  node: Text;
  start: number;
  end: number;
  query: string;
} | null {
  const caret = textCaret(root);
  if (!caret) return null;
  const own = (caret.node.textContent ?? '').slice(0, caret.offset);
  const direct = mentionQueryAt(own);
  if (direct) {
    return { node: caret.node, start: direct.start, end: caret.offset, query: direct.query };
  }
  // 光标常落在触发符后的空文本节点上，要再认前一个文本节点。
  if (caret.offset !== 0) return null;
  let prev: Node | null = caret.node.previousSibling;
  while (prev && prev.nodeType === Node.TEXT_NODE && !(prev.textContent ?? '').length) {
    prev = prev.previousSibling;
  }
  if (!prev || prev.nodeType !== Node.TEXT_NODE) return null;
  const prevText = prev.textContent ?? '';
  const hit = mentionQueryAt(prevText);
  if (!hit || hit.start + 1 + hit.query.length !== prevText.length) return null;
  return { node: prev as Text, start: hit.start, end: prevText.length, query: hit.query };
}

function isTypingTarget(node: Element): boolean {
  const tag = node.tagName;
  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    tag === 'A'
  ) {
    return true;
  }
  if (node.getAttribute('contenteditable') === 'true') return true;
  const role = node.getAttribute('role');
  return role === 'button' || role === 'textbox' || role === 'tab' || role === 'combobox';
}

function caretBox(root: HTMLElement): { left: number; top: number; bottom: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  const rect = range.getBoundingClientRect();
  if (rect.top === 0 && rect.left === 0 && rect.height === 0) {
    const box = root.getBoundingClientRect();
    return { left: box.left + 12, top: box.top + 8, bottom: box.top + 28 };
  }
  return { left: rect.left, top: rect.top, bottom: rect.bottom || rect.top + 20 };
}

function isGridKey(key: string): key is GridKey {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
}

function menuColumns(root: HTMLElement | null): number {
  if (!root) return 1;
  const tops = [...root.querySelectorAll<HTMLButtonElement>('button')].map(
    (button) => button.offsetTop,
  );
  return columnCountOf(tops);
}

function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

type PlaceholderEditorProps = {
  id: string;
  value: string;
  placeholders: string[];
  readOnly?: boolean;
  onChange: (value: string) => void;
};

export function PlaceholderEditor({
  id,
  value,
  placeholders,
  readOnly = false,
  onChange,
}: PlaceholderEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const painted = useRef('');
  const ownEdit = useRef(false);
  const caretAt = useRef<number | null>(null);
  const mentionAnchor = useRef<MentionAnchor | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const querySeen = useRef('');
  const dismissed = useRef<string | null>(null);
  const blurTimer = useRef<number | null>(null);
  const blurSaves = useRef(0);
  const { t } = useLanguage();
  const [menu, setMenu] = useState<MentionMenu | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const [active, setActive] = useState(0);
  const [tip, setTip] = useState<{
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    if (menu !== null) return;
    if (ownEdit.current) {
      ownEdit.current = false;
      return;
    }
    if (focused.current && readPlaceholderText(root) === value) return;
    paintPlaceholderText(root, value);
    painted.current = value;
  }, [value, menu]);

  const commit = () => {
    const root = editorRef.current;
    if (!root) return;
    const next = readPlaceholderText(root);
    painted.current = next;
    if (next !== value) {
      ownEdit.current = true;
      onChange(next);
    }
  };

  const placeCaret = (range: Range | null) => {
    const root = editorRef.current;
    if (!root) return;
    root.focus();
    const selection = window.getSelection();
    if (!selection) return;
    if (range && root.contains(range.startContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    const end = document.createRange();
    end.selectNodeContents(root);
    end.collapse(false);
    selection.removeAllRanges();
    selection.addRange(end);
  };

  const insertToken = (name: string, range: Range | null) => {
    if (readOnly || !name) return;
    const root = editorRef.current;
    if (!root) return;
    const selection = window.getSelection();
    const inside =
      selection !== null && selection.rangeCount > 0 && root.contains(selection.anchorNode);
    if (range || !inside) placeCaret(range);
    const nextSelection = window.getSelection();
    const badge = makeBadge(name);
    if (!nextSelection || nextSelection.rangeCount === 0) {
      root.appendChild(badge);
    } else {
      const target = nextSelection.getRangeAt(0);
      target.deleteContents();
      target.insertNode(badge);
      target.setStartAfter(badge);
      target.collapse(true);
      nextSelection.removeAllRanges();
      nextSelection.addRange(target);
    }
    droppedInside = true;
    const moved = dragSource;
    if (moved && moved !== badge && root.contains(moved)) moved.remove();
    dragSource = null;
    commit();
  };

  const rememberCaret = () => {
    const root = editorRef.current;
    if (!root) return;
    const offset = captureCaretOffset(root);
    if (offset !== null) caretAt.current = offset;
  };

  const closeMention = () => {
    mentionAnchor.current = null;
    querySeen.current = '';
    menuRef.current = null;
    setMenu(null);
  };

  const syncMention = (repositionOnly = false) => {
    const root = editorRef.current;
    if (!root || readOnly || placeholders.length === 0) {
      closeMention();
      return;
    }
    const found = mentionAtCaret(root);
    const box = found ? caretBox(root) : null;
    if (!found || !box) {
      // 滚动或光标不在文本上时留着列表。
      // 光标还在正文里、但已经离开 @ / ，才关闭。
      if (repositionOnly || !textCaret(root)) return;
      dismissed.current = null;
      closeMention();
      return;
    }
    const mark = `${found.start}:${found.query}`;
    if (dismissed.current === mark) return;
    dismissed.current = null;
    mentionAnchor.current = { node: found.node, start: found.start, end: found.end };
    if (found.query !== querySeen.current) {
      querySeen.current = found.query;
      setActive(0);
    }
    const next = {
      query: found.query,
      left: Math.round(box.left),
      anchorTop: Math.round(box.top),
      anchorBottom: Math.round(box.bottom),
    };
    setMenu((prev) => {
      if (
        prev &&
        prev.query === next.query &&
        prev.left === next.left &&
        prev.anchorTop === next.anchorTop &&
        prev.anchorBottom === next.anchorBottom
      ) {
        return prev;
      }
      return next;
    });
  };

  const insertMention = (name: string) => {
    const anchor = mentionAnchor.current;
    const root = editorRef.current;
    if (!anchor || !root || !name || !root.contains(anchor.node)) return;
    const text = anchor.node.textContent ?? '';
    const parent = anchor.node.parentNode;
    if (!parent) return;
    const before = text.slice(0, anchor.start);
    const after = text.slice(anchor.end);
    anchor.node.textContent = before;
    const badge = makeBadge(name);
    parent.insertBefore(badge, anchor.node.nextSibling);
    const afterNode = after ? document.createTextNode(after) : null;
    if (afterNode) parent.insertBefore(afterNode, badge.nextSibling);
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      if (afterNode) range.setStart(afterNode, 0);
      else range.setStartAfter(badge);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    closeMention();
    commit();
    rememberCaret();
  };

  const filtered = useMemo(
    () => (menu ? filterPlaceholderNames(placeholders, menu.query) : []),
    [menu, placeholders],
  );
  const activeSafe = filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1);

  const syncMentionRef = useRef(syncMention);
  syncMentionRef.current = syncMention;
  const closeMentionRef = useRef(closeMention);
  closeMentionRef.current = closeMention;
  const menuOpen = menu !== null;

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const list = listRef.current;
    const node = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !node) return;
    const listRect = list.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (nodeRect.top < listRect.top) list.scrollTop -= listRect.top - nodeRect.top;
    else if (nodeRect.bottom > listRect.bottom) list.scrollTop += nodeRect.bottom - listRect.bottom;
  }, [menuOpen, activeSafe, menu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onMove = () => syncMentionRef.current(true);
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target instanceof Node ? event.target : null;
      const element = node instanceof Element ? node : node?.parentElement;
      if (element?.closest('[data-placeholder-menu]')) return;
      const root = editorRef.current;
      if (root && node && root.contains(node)) return;
      dismissed.current = null;
      closeMentionRef.current();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menuOpen]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (event.nativeEvent.isComposing || composing.current) return;
    if (menu && filtered.length > 0 && isGridKey(event.key)) {
      event.preventDefault();
      const columns = menuColumns(listRef.current);
      setActive(moveGridIndex(activeSafe, filtered.length, columns, event.key));
      return;
    }
    if (menu && event.key === 'Enter' && filtered.length > 0) {
      event.preventDefault();
      insertMention(filtered[activeSafe] ?? '');
      return;
    }
    if (menu && event.key === 'Escape') {
      event.preventDefault();
      const anchor = mentionAnchor.current;
      dismissed.current = anchor ? `${anchor.start}:${menu.query}` : null;
      closeMention();
      return;
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
      const hits = [...root.querySelectorAll<HTMLElement>('[data-token]')].filter((el) =>
        range.intersectsNode(el),
      );
      if (hits.length === 0) return;
      event.preventDefault();
      range.deleteContents();
      hits.forEach((el) => {
        el.remove();
      });
      commit();
      return;
    }
    const badge = badgeBesideCaret(root, range, event.key === 'Backspace' ? 'back' : 'fwd');
    if (!badge || !root.contains(badge)) return;
    event.preventDefault();
    const parent = badge.parentNode;
    const index = parent ? indexOfNode(badge) : 0;
    badge.remove();
    if (parent) {
      const next = document.createRange();
      next.setStart(parent, Math.min(index, parent.childNodes.length));
      next.collapse(true);
      selection.removeAllRanges();
      selection.addRange(next);
    }
    commit();
  };

  const menuStyle = (() => {
    if (!menu) return undefined;
    const width = 320;
    const left = Math.max(8, Math.min(menu.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - menu.anchorBottom;
    const above = spaceBelow < 220 && menu.anchorTop > spaceBelow;
    return {
      left,
      width,
      top: above ? undefined : menu.anchorBottom + 6,
      bottom: above ? window.innerHeight - menu.anchorTop + 6 : undefined,
    };
  })();
  const activeName = filtered[activeSafe] ?? '';

  return (
    <div className="space-y-2">
      {placeholders.length > 0 && (
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((name) => (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    draggable={!readOnly}
                    disabled={readOnly}
                    className={cn(
                      BADGE_CLASS,
                      placeholderClass(name),
                      readOnly
                        ? 'disabled:cursor-not-allowed'
                        : 'cursor-grab active:cursor-grabbing',
                    )}
                    onMouseDown={() => {
                      const root = editorRef.current;
                      caretAt.current = root ? captureCaretOffset(root) : null;
                    }}
                    onDragStart={(event) => {
                      dragToken = name;
                      dragSource = null;
                      droppedInside = false;
                      event.dataTransfer.setData(DRAG_TYPE, name);
                      event.dataTransfer.setData('text/plain', `{{${name}}}`);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={() => {
                      dragToken = '';
                    }}
                    onClick={() => {
                      const root = editorRef.current;
                      if (!root || caretAt.current === null) {
                        insertToken(name, null);
                        return;
                      }
                      root.focus();
                      placeOffset(root, caretAt.current);
                      const selection = window.getSelection();
                      const range =
                        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                      insertToken(name, range);
                    }}
                  >
                    {placeholderLabel(name)}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm whitespace-normal">
                  <PlaceholderHintBody token={name} />
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 占位符标签必须嵌在可编辑正文里，textarea 画不出 */}
      <div
        id={id}
        ref={editorRef}
        contentEditable={readOnly ? 'false' : 'true'}
        suppressContentEditableWarning
        className={cn(
          'min-h-[9rem] w-full whitespace-pre-wrap rounded-lg border-2 border-primary/35 bg-background px-3 py-2 text-sm leading-7 shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          readOnly ? 'cursor-not-allowed opacity-80 [&_*]:!cursor-not-allowed' : 'cursor-text',
        )}
        onFocus={() => {
          focused.current = true;
          if (blurTimer.current !== null) {
            window.clearTimeout(blurTimer.current);
            blurTimer.current = null;
          }
        }}
        onBlur={(event) => {
          const nextFocus = event.relatedTarget;
          if (nextFocus instanceof Element && nextFocus.closest('[data-placeholder-menu]')) return;
          if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
          blurTimer.current = window.setTimeout(() => {
            blurTimer.current = null;
            const root = editorRef.current;
            const active = document.activeElement;
            const activeEl = active instanceof Element ? active : null;
            const insideEditor = Boolean(
              root && activeEl && (activeEl === root || root.contains(activeEl)),
            );
            const insideMenu = Boolean(activeEl?.closest('[data-placeholder-menu]'));
            if (insideEditor || insideMenu) {
              focused.current = true;
              return;
            }
            const transient =
              !activeEl ||
              activeEl === document.body ||
              activeEl === document.documentElement ||
              Boolean(activeEl.closest('[data-radix-focus-guard]')) ||
              !isTypingTarget(activeEl);
            if (transient && menuRef.current && root && blurSaves.current < 2) {
              blurSaves.current += 1;
              root.focus();
              focused.current = true;
              return;
            }
            blurSaves.current = 0;
            focused.current = false;
            dismissed.current = null;
            closeMention();
            if (!root) return;
            const next = readPlaceholderText(root);
            paintPlaceholderText(root, next);
            painted.current = next;
            if (next !== value) onChange(next);
          }, 0);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          syncMention();
        }}
        onInput={() => {
          blurSaves.current = 0;
          commit();
          syncMention();
        }}
        onKeyDown={onKeyDown}
        onKeyUp={() => {
          rememberCaret();
          syncMention();
        }}
        onMouseUp={() => {
          rememberCaret();
          syncMention();
        }}
        onPointerOver={(event) => {
          const badge = tokenElement(event.target as Node, editorRef.current);
          if (!badge || !editorRef.current?.contains(badge)) return;
          const rect = badge.getBoundingClientRect();
          const name = badge.dataset.token ?? '';
          setTip({ name, x: rect.left, y: rect.top, w: rect.width, h: rect.height });
        }}
        onPointerOut={(event) => {
          const badge = tokenElement(event.target as Node, editorRef.current);
          if (!badge) return;
          const next = event.relatedTarget;
          if (next instanceof Node && badge.contains(next)) return;
          setTip(null);
        }}
        onDragOver={(event) => {
          if (readOnly || !dragToken) return;
          event.preventDefault();
          event.dataTransfer.dropEffect =
            dragSource && editorRef.current?.contains(dragSource) ? 'move' : 'copy';
        }}
        onDrop={(event) => {
          if (readOnly) return;
          const plain = event.dataTransfer.getData('text/plain');
          const fromPlain = /^\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}$/.exec(plain.trim());
          const name =
            event.dataTransfer.getData(DRAG_TYPE) || dragToken || (fromPlain ? fromPlain[1] : '');
          if (!name) return;
          event.preventDefault();
          droppedInside = true;
          insertToken(name, caretRangeAt(event.clientX, event.clientY));
        }}
      />
      {tip &&
        createPortal(
          <TooltipProvider delayDuration={0}>
            <Tooltip key={`${tip.name}-${tip.x}-${tip.y}`} open>
              <TooltipTrigger asChild>
                <span
                  className="pointer-events-none fixed"
                  style={{ left: tip.x, top: tip.y, width: tip.w, height: tip.h }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm whitespace-normal">
                <PlaceholderHintBody token={tip.name} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>,
          document.body,
        )}
      {menu &&
        menuStyle &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            aria-label={t('personaConfig.promptTokenList')}
            data-placeholder-menu
            className="pointer-events-auto fixed z-[80] max-h-60 overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-md"
            style={menuStyle}
            onMouseDown={(event) => {
              // 点菜单会让正文失焦并重绘，拦住焦点，回车和点击才能插在原光标处。
              event.preventDefault();
            }}
          >
            <p className="mb-2 text-xs leading-5 text-muted-foreground">
              {t('personaConfig.promptTokenSummon')}
            </p>
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {t('personaConfig.promptTokenEmpty')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {filtered.map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={index === activeSafe}
                      data-active={index === activeSafe ? 'true' : 'false'}
                      className={cn(
                        BADGE_CLASS,
                        'cursor-pointer',
                        placeholderClass(name),
                        index === activeSafe && 'ring-2 ring-ring ring-offset-1',
                      )}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => insertMention(name)}
                    >
                      {placeholderLabel(name)}
                    </button>
                  ))}
                </div>
                {activeName && (
                  <div className="mt-2 px-0.5 text-xs leading-5 text-muted-foreground">
                    <PlaceholderHintBody token={activeName} />
                  </div>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function PlaceholderText({ text }: { text: string }) {
  const parts: Array<
    { kind: 'text'; value: string; at: number } | { kind: 'token'; name: string; at: number }
  > = [];
  TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ kind: 'text', value: text.slice(cursor, start), at: cursor });
    parts.push({ kind: 'token', name: match[1] ?? '', at: start });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: 'text', value: text.slice(cursor), at: cursor });
  return (
    <TooltipProvider delayDuration={200}>
      {parts.map((part) =>
        part.kind === 'text' ? (
          <span key={`t-${part.at}`}>{part.value}</span>
        ) : (
          <Tooltip key={`b-${part.at}`}>
            <TooltipTrigger asChild>
              <span className={cn(BADGE_CLASS, 'cursor-default', placeholderClass(part.name))}>
                {placeholderLabel(part.name)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm whitespace-normal">
              <PlaceholderHintBody token={part.name} />
            </TooltipContent>
          </Tooltip>
        ),
      )}
    </TooltipProvider>
  );
}
