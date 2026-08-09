/**
 * /batch-push — 批量推送页（运维 / 主动通告）
 *
 * 来源：docs/skills/gshub-development/README.md §3.1「完全空缺」第 2 项
 * 后端对应：message_api.py (`/api/BatchPush` + `/api/BatchPush/targets`)
 *
 * 设计：
 * - 正文（HTML）+ 目标（群/用户混选）+ 目标 Bot（WS 连接）+ 机器人账号（bot_self_id）
 * - 精准四维：push_bot（WS）/ 平台 bot_id（tag）/ bot_self_id / 人·群
 * - 目标列表：后端分页 + 前端虚拟化；选中用 `Set<string>` O(1)
 * - targets?bot_id= **只按平台**过滤（与 WS Select 无关）；WS 仅映射到提交时的 push_bot
 * - bot_self_id：列表（统计库+历史）可选，也可用 InputWithDropdown 手填；
 *   解析出平台时筛目标，提交带 push_bot_self_id，非宏 tag 追加第三段
 * - 提交流程统一走 batchPushApi.push，错误回显用 getApiErrorMessage
 *
 * 涉及的 SKILL 章节：
 * - [§04 排版铁律 · PinnedPage 标题页](./references/04-page-layout-spec.md)
 * - [§05 §5.5 Radix Select 哨兵](./references/05-components-and-form-controls.md)
 * - [§01 §1.5 错误回显后端 detail](./references/01-architecture-and-conventions.md)
 * - [§10 大列表分页 + 虚拟化（参考 ConsolePanel）](./references/10-pitfalls-and-performance.md)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckCheck,
  ChevronDown,
  Eraser,
  History,
  ImagePlus,
  Info,
  LayoutList,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Send,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { Textarea } from '@/components/ui/textarea';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  batchPushApi,
  getApiErrorMessage,
  type BatchPushBotSelfOption,
  type BatchPushTargetItem,
} from '@/lib/api';
import {
  type BatchPushImageAsset,
  buildBatchPushImagePlaceholder,
  collectImageFilesFromDataTransfer,
  expandBatchPushBody,
  insertTextAt,
  isImageFile,
  makeBatchPushImageId,
  normalizeBatchPushBodyImages,
  pruneBatchPushImageAssets,
} from '@/lib/featureUtils';
import { cn } from '@/lib/utils';

/** Max dimension edge when encoding (keep payload reasonable; backend still gets width/height). */
const IMAGE_MAX_EDGE = 4096;
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp';

/** Read File → asset + short editor placeholder (base64 never enters the textarea). */
function readImageFileAsPlaceholder(file: File): Promise<{
  id: string;
  placeholder: string;
  asset: BatchPushImageAsset;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (!dataUrl.startsWith('data:image/')) {
        reject(new Error('not_image_data_url'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || 1;
        let h = img.naturalHeight || 1;
        if (w > IMAGE_MAX_EDGE || h > IMAGE_MAX_EDGE) {
          const scale = IMAGE_MAX_EDGE / Math.max(w, h);
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
        }
        const id = makeBatchPushImageId();
        resolve({
          id,
          placeholder: buildBatchPushImagePlaceholder(id, w, h),
          asset: { dataUrl, width: w, height: h },
        });
      };
      img.onerror = () => reject(new Error('decode_failed'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

const ALL_BOT_SENTINEL = '__all__';
const TYPE_ALL = 'all';
const TYPE_GROUP = 'group';
const TYPE_USER = 'user';
const SEARCH_DEBOUNCE_MS = 200;
// 后端单页大小：与 backend message_api.py 默认 limit 对齐；想再大可调到 1000。
const PAGE_SIZE = 200;
// 单行估算高度（含 padding/border）。h-9 checkbox + Badge + 文字行 ≈ 36px。
const ROW_ESTIMATE_PX = 36;
const VIRTUAL_LIST_HEIGHT_PX = 360; // h-90

type TargetKind = BatchPushTargetItem['kind'];

interface PageInfo {
  total: number;
  hasMore: boolean;
}

interface BotOption {
  bot_id: string;
  name: string;
  ws_bot_id?: string;
  connected?: boolean;
}

/** 解析后的机器人账号：来自下拉匹配或用户手填 */
interface ResolvedBotSelf {
  bot_self_id: string;
  /** 已知/手填时的平台 bot_id；纯手填 self_id 时可能为空 */
  bot_id?: string;
}

/**
 * 把后端返回的目标按 kind 字段直接归类（不再依赖 value 前缀启发式）：
 * 后端 v2026-07 起显式返回 kind，宏/群/用户三类一目了然。
 */
function badgeLabelForKind(kind: TargetKind, tGroup: string, tUser: string): string {
  if (kind === 'group' || kind === 'macro') return tGroup;
  return tUser;
}

/**
 * 为非宏 tag 追加 `|{bot_self_id}` 第三段（已有第三段则不改）。
 * 宏 ALLUSER/ALLGROUP 仅靠全局 push_bot_self_id 指定账号。
 */
function enrichTagWithBotSelfId(tag: string, botSelfId: string): string {
  if (!botSelfId) return tag;
  if (tag === 'ALLUSER' || tag === 'ALLGROUP') return tag;
  const parts = tag.split('|');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${tag}|${botSelfId}`;
  }
  return tag;
}

/** 从 push_tag 解析平台 bot_id（第二段）；宏返回 null */
function platformFromTag(tag: string): string | null {
  if (tag === 'ALLUSER' || tag === 'ALLGROUP') return null;
  const parts = tag.split('|');
  return parts[1]?.trim() || null;
}

/** 从 push_tag 粗分 kind */
function kindFromTag(tag: string): 'macro' | 'group' | 'user' {
  if (tag === 'ALLUSER' || tag === 'ALLGROUP') return 'macro';
  if (tag.startsWith('g:')) return 'group';
  if (tag.startsWith('u:')) return 'user';
  return 'user';
}

/**
 * 解析 bot_self 输入：
 * - 空 → null（不指定账号）
 * - 命中列表 id / label / 唯一 bot_self_id → 带平台
 * - 手填 `self_id:platform`（与 Dashboard id 一致）或 `self_id (platform)` → 拆分
 * - 其它纯文本 → 仅 bot_self_id（不筛平台）
 */
function resolveBotSelfInput(
  raw: string,
  options: BatchPushBotSelfOption[],
): ResolvedBotSelf | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const byId = options.find((o) => o.id === trimmed);
  if (byId) return { bot_self_id: byId.bot_self_id, bot_id: byId.bot_id };

  const byLabel = options.find((o) => o.label === trimmed);
  if (byLabel) return { bot_self_id: byLabel.bot_self_id, bot_id: byLabel.bot_id };

  const bySelf = options.filter((o) => o.bot_self_id === trimmed);
  if (bySelf.length === 1) {
    return { bot_self_id: bySelf[0].bot_self_id, bot_id: bySelf[0].bot_id };
  }
  if (bySelf.length > 1) {
    // 多平台同 self_id：只锁定账号，不猜平台
    return { bot_self_id: trimmed };
  }

  // 优先：以已知 option.id 匹配（self 可含冒号时仍可靠）
  const byIdPrefix = options.find(
    (o) =>
      trimmed === o.id ||
      (trimmed.startsWith(`${o.bot_self_id}:`) &&
        trimmed.slice(o.bot_self_id.length + 1) === o.bot_id),
  );
  if (byIdPrefix) {
    return { bot_self_id: byIdPrefix.bot_self_id, bot_id: byIdPrefix.bot_id };
  }

  // 手填 label 形：`3399214199 (onebot)`
  const labelMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (labelMatch) {
    const selfId = labelMatch[1].trim();
    const platform = labelMatch[2].trim();
    if (selfId && platform) return { bot_self_id: selfId, bot_id: platform };
  }

  // 手填 Dashboard id 形：优先已知平台名后缀，再 lastIndexOf(':')
  const knownPlatforms = new Set(options.map((o) => o.bot_id));
  for (const platform of knownPlatforms) {
    const suffix = `:${platform}`;
    if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
      const selfId = trimmed.slice(0, -suffix.length).trim();
      if (selfId && !/\s/.test(platform)) {
        return { bot_self_id: selfId, bot_id: platform };
      }
    }
  }

  const colon = trimmed.lastIndexOf(':');
  if (colon > 0 && colon < trimmed.length - 1) {
    const selfId = trimmed.slice(0, colon).trim();
    const platform = trimmed.slice(colon + 1).trim();
    // 平台段不含空格，避免把普通文案误拆
    if (selfId && platform && !/\s/.test(platform)) {
      return { bot_self_id: selfId, bot_id: platform };
    }
  }

  return { bot_self_id: trimmed };
}

export default function BatchPushPage() {
  const { t } = useLanguage();
  const [text, setText] = useState(t('batchPush.defaultBody'));
  // 用 Set 持有选中值，避免 `targetValues.includes()` 在 3k+ 行时退化为 O(n²) 的卡顿
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(() => new Set());
  const [typeFilter, setTypeFilter] = useState<string>(TYPE_ALL);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  /** WS 连接（push_bot）；哨兵 = 全部 active */
  const [bot, setBot] = useState<string>(ALL_BOT_SENTINEL);
  /**
   * 机器人账号输入（可选可填）：
   * - 空 = 不指定
   * - 下拉选中时为 option.id（`bot_self_id:bot_id`）
   * - 手填可为纯 self_id、`self:platform` 或 `self (platform)`
   */
  const [botSelfInput, setBotSelfInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bodyDragging, setBodyDragging] = useState(false);
  const [insertingImage, setInsertingImage] = useState(false);
  /** Base64 lives here — never in the textarea value. */
  const [imageAssets, setImageAssets] = useState<Record<string, BatchPushImageAsset>>({});
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const imageAssetsRef = useRef(imageAssets);
  imageAssetsRef.current = imageAssets;

  // ---- 目标列表状态：分页累积 + 顶部元信息 ----
  const [bots, setBots] = useState<BotOption[]>([]);
  const [botSelfOptions, setBotSelfOptions] = useState<BatchPushBotSelfOption[]>([]);
  const [items, setItems] = useState<BatchPushTargetItem[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({ total: 0, hasMore: false });
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const resolvedBotSelf = useMemo(
    () => resolveBotSelfInput(botSelfInput, botSelfOptions),
    [botSelfInput, botSelfOptions],
  );
  /** 目标列表平台筛选：解析出平台 bot_id 时启用 */
  const platformFilter = resolvedBotSelf?.bot_id;
  /** 提交用的 bot_self_id（手填或列表） */
  const resolvedBotSelfId = resolvedBotSelf?.bot_self_id?.trim() || '';

  /** InputWithDropdown 选项：用 id 作 value，显示 label */
  const botSelfDropdownOptions = useMemo(
    () => botSelfOptions.map((o) => o.id),
    [botSelfOptions],
  );
  const formatBotSelfLabel = useCallback(
    (raw: string) => {
      const hit = botSelfOptions.find((o) => o.id === raw);
      if (hit) return hit.label;
      // 手填值：尽量展示为 label 形
      const resolved = resolveBotSelfInput(raw, botSelfOptions);
      if (resolved?.bot_id) return `${resolved.bot_self_id} (${resolved.bot_id})`;
      return raw;
    },
    [botSelfOptions],
  );

  // 搜索框防抖：连打字不每次都重新请求。
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  /**
   * 拉取一页：reset=true 时清空 items 并从 offset=0 开始；false 时追加到末尾。
   * 关键不变量：调用方需保证 reset=true 与「筛选条件变更」同源，
   * 否则会出现重复项 / offset 错位。
   */
  const loadPage = useCallback(
    async (reset: boolean) => {
      const params: Parameters<typeof batchPushApi.getTargets>[0] = {
        kind: typeFilter as 'all' | 'group' | 'user',
        q: debouncedSearch.trim() || undefined,
        limit: PAGE_SIZE,
        offset: reset ? 0 : items.length,
      };
      // targets?bot_id= 只接受**平台** bot_id（onebot / telegram / …），见后端
      // message_api.batch_push_targets 与 docs/10-batch-push.md。
      // WS 连接 id（push_bot）与平台 id 是不同维度，绝不可把 WS Select 的值当 bot_id 过滤，
      // 否则生产/demo 都会得到空列表，且宏 ALL* 在带 bot_id 时被后端隐藏。
      // 注意：也不要把 bot_self_id 传给 targets——否则返回的 bot_self_ids 会被缩成单项，
      // 下拉无法再切换其它账号。
      if (platformFilter) {
        params.bot_id = platformFilter;
      }
      try {
        const data = await batchPushApi.getTargets(params);
        if (reset) {
          setItems(data.items);
        } else {
          // 用 Set 去重，避免 offset/limit 在筛选变化瞬间抓到重叠时的重复行
          setItems((prev) => {
            const seen = new Set(prev.map((it) => it.value));
            return [
              ...prev,
              ...data.items.filter((it) => !seen.has(it.value)),
            ];
          });
        }
        setPageInfo({ total: data.total, hasMore: data.has_more });
        // bots / bot_self_ids 在分页过程中保持稳定，第一页顺便刷新
        if (reset) {
          if (data.bots) setBots(data.bots);
          if (data.bot_self_ids) setBotSelfOptions(data.bot_self_ids);
        }
      } catch (e) {
        if (reset) {
          console.warn(t('batchPush.targetsFallbackWarn'), e);
          setItems([]);
          setPageInfo({ total: 0, hasMore: false });
        } else {
          toast.error(getApiErrorMessage(e, t('batchPush.loadMoreFailed')));
        }
        throw e; // 让调用方感知失败，避免重复触发
      }
    },
    [platformFilter, typeFilter, debouncedSearch, items.length, t],
  );

  // 筛选条件变化时重置 items 并拉首页（WS bot 不影响 targets 列表，不列入）
  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    loadPage(true).catch(() => {/* loadPage 内部已 toast */}).finally(() => {
      if (!cancelled) setInitialLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // loadPage 已通过 deps 涵盖全部筛选条件；显式列出便于阅读
    // platformFilter 随 botSelfInput 解析结果变化，用于按平台筛目标
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter, typeFilter, debouncedSearch]);

  /**
   * 平台 / 类型筛选变化时，剪掉与当前筛选不兼容的已选项，
   * 避免跨平台 tag 被新 bot_self_id 错误 enrich 后提交。
   * 搜索词与 WS bot 变化不剪枝（WS 只影响提交时的 push_bot）。
   */
  useEffect(() => {
    setSelectedTargets((prev) => {
      if (prev.size === 0) return prev;
      let removed = 0;
      const next = new Set<string>();
      for (const tag of prev) {
        const kind = kindFromTag(tag);
        if (typeFilter === TYPE_GROUP && (kind === 'user' || tag === 'ALLUSER')) {
          removed += 1;
          continue;
        }
        if (typeFilter === TYPE_USER && (kind === 'group' || tag === 'ALLGROUP')) {
          removed += 1;
          continue;
        }
        const tagPlatform = platformFromTag(tag);
        if (platformFilter && tagPlatform && tagPlatform !== platformFilter) {
          removed += 1;
          continue;
        }
        next.add(tag);
      }
      if (removed > 0) {
        // setState 外 toast，避免严格模式下重复触发
        queueMicrotask(() => {
          toast.info(t('batchPush.selectionPruned', { count: removed }));
        });
      }
      return next.size === prev.size ? prev : next;
    });
  }, [platformFilter, typeFilter, t]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !pageInfo.hasMore) return;
    setLoadingMore(true);
    try {
      await loadPage(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pageInfo.hasMore, loadPage]);

  /**
   * 筛选条件变化时，把虚拟列表滚到顶部，否则用户会看到滚动条卡在原位置但内容已变。
   * 依赖 items.length 而非 filters，避免初次挂载（items=[]）时误滚。
   */
  useEffect(() => {
    // 仅当已经有数据时滚动（首次加载时 parentRef 可能还没挂好）
    if (parentRef.current && items.length > 0) {
      parentRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter, typeFilter, debouncedSearch]);

  const toggle = (v: string, checked: boolean) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (checked) next.add(v);
      else next.delete(v);
      return next;
    });
  };

  const selectAllLoaded = () => {
    if (items.length === 0) return;
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      for (const it of items) next.add(it.value);
      return next;
    });
  };

  const clearSelection = () => setSelectedTargets(new Set());

  /**
   * 读图 → 内存存 base64；正文只插入短占位：
   *   `<img data-bp-id="..." width height alt="image" />`
   * 提交时再 expand 成带 data URL 的标签给后端。
   */
  const insertImageFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter(isImageFile);
      if (images.length === 0) {
        toast.error(t('batchPush.imageNotImage'));
        return;
      }
      setInsertingImage(true);
      try {
        const placeholders: string[] = [];
        const nextAssets: Record<string, BatchPushImageAsset> = {};
        for (const file of images) {
          try {
            const { id, placeholder, asset } = await readImageFileAsPlaceholder(file);
            placeholders.push(placeholder);
            nextAssets[id] = asset;
          } catch {
            toast.error(t('batchPush.imageReadFailed', { name: file.name || 'image' }));
          }
        }
        if (placeholders.length === 0) return;
        setImageAssets((prev) => ({ ...prev, ...nextAssets }));
        let caretAfter = 0;
        setText((prev) => {
          const el = textAreaRef.current;
          const start = el?.selectionStart ?? prev.length;
          const end = el?.selectionEnd ?? prev.length;
          const needLeadingNl = start > 0 && prev[start - 1] !== '\n';
          const insert = (needLeadingNl ? '\n' : '') + placeholders.join('\n') + '\n';
          const { next, caret } = insertTextAt(prev, insert, start, end);
          caretAfter = caret;
          return next;
        });
        requestAnimationFrame(() => {
          const ta = textAreaRef.current;
          if (!ta) return;
          ta.focus();
          ta.setSelectionRange(caretAfter, caretAfter);
        });
        toast.success(t('batchPush.imageInserted', { count: placeholders.length }));
      } finally {
        setInsertingImage(false);
      }
    },
    [t],
  );

  /** Keep textarea free of huge base64; prune deleted image assets. */
  const onBodyTextChange = useCallback((raw: string) => {
    if (raw.includes('data:image')) {
      const { text: next, assets, extracted } = normalizeBatchPushBodyImages(
        raw,
        imageAssetsRef.current,
      );
      setImageAssets(pruneBatchPushImageAssets(next, assets));
      setText(next);
      if (extracted > 0) {
        toast.success(t('batchPush.imageInserted', { count: extracted }));
      }
      return;
    }
    setText(raw);
    setImageAssets((prev) => pruneBatchPushImageAssets(raw, prev));
  }, [t]);

  const onBodyPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = collectImageFilesFromDataTransfer(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      void insertImageFiles(files);
    },
    [insertImageFiles],
  );

  const onBodyDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer?.types?.includes('Files')) setBodyDragging(true);
  }, []);

  const onBodyDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setBodyDragging(false);
  }, []);

  const onBodyDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onBodyDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setBodyDragging(false);
      const files = collectImageFilesFromDataTransfer(e.dataTransfer);
      if (files.length === 0) {
        toast.error(t('batchPush.imageNotImage'));
        return;
      }
      void insertImageFiles(files);
    },
    [insertImageFiles, t],
  );

  // ---------------------------------------------------------------------------
  // 虚拟化（参考 src/components/ConsolePanel.tsx 既有用法）
  // ---------------------------------------------------------------------------
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 10,
    // value 是后端拼接的稳定字符串（g:<id>|<bot_id> / u:<id>|<bot_id> / ALLGROUP），
    // 跨分页/筛选切换时也不会变，可作为稳定 key 让 React 复用节点。
    getItemKey: (i) => items[i]?.value ?? `__missing_${i}`,
    measureElement:
      typeof window !== 'undefined' && 'ResizeObserver' in window
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  });

  const submit = async () => {
    if (!text.trim()) {
      toast.error(t('batchPush.textRequired'));
      return;
    }
    if (selectedTargets.size === 0) {
      toast.error(t('batchPush.targetsRequired'));
      return;
    }
    setSubmitting(true);
    try {
      // Expand placeholders → full base64 img tags only at submit time.
      const push_text = expandBatchPushBody(text, imageAssets);
      const botSelfId = resolvedBotSelfId;
      // 非宏 tag 追加第三段 bot_self_id，与全局 push_bot_self_id 双保险
      const push_tag = Array.from(selectedTargets)
        .map((tag) => enrichTagWithBotSelfId(tag, botSelfId))
        .join(',');
      // push_bot：WS 连接；空 = 全部 active。push_bot_self_id 仅在有值时附带（省略空串，
      // 与后端「缺省 / 空 = 不限制」一致，避免部分校验把 "" 当显式值）。
      await batchPushApi.push({
        push_text,
        push_tag,
        push_bot: bot === ALL_BOT_SENTINEL ? '' : bot,
        ...(botSelfId ? { push_bot_self_id: botSelfId } : {}),
      });
      toast.success(t('batchPush.submitSuccess'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('batchPush.submitFail')));
    } finally {
      setSubmitting(false);
    }
  };

  // Preview: expand placeholders then render real images (textarea stays light).
  const previewBlocks = useMemo(() => {
    if (typeof window === 'undefined' || !text) {
      return [] as Array<{ type: 'text' | 'image'; content: string; w?: string; h?: string }>;
    }
    const expanded = expandBatchPushBody(text, imageAssets);
    const wrap = document.createElement('div');
    wrap.innerHTML = expanded;
    const out: Array<{ type: 'text' | 'image'; content: string; w?: string; h?: string }> = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'IMG') {
          const bpId = el.getAttribute('data-bp-id');
          const fromAsset = bpId ? imageAssets[bpId] : undefined;
          out.push({
            type: 'image',
            content: fromAsset?.dataUrl || el.getAttribute('src') || '',
            w: el.getAttribute('width') ?? (fromAsset ? String(fromAsset.width) : undefined),
            h: el.getAttribute('height') ?? (fromAsset ? String(fromAsset.height) : undefined),
          });
          return;
        }
        el.childNodes.forEach(walk);
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = (node.textContent || '').trim();
        if (txt) out.push({ type: 'text', content: txt });
      }
    };
    wrap.childNodes.forEach(walk);
    if (out.length === 0 && text.trim()) {
      out.push({ type: 'text', content: text });
    }
    return out;
  }, [text, imageAssets]);

  const typeFilterOptions = useMemo(
    () => [
      {
        value: TYPE_ALL,
        label: t('batchPush.tabAll'),
        icon: <LayoutList className="w-4 h-4" />,
      },
      {
        value: TYPE_GROUP,
        label: t('batchPush.targetTypeGroup'),
        icon: <Users className="w-4 h-4" />,
      },
      {
        value: TYPE_USER,
        label: t('batchPush.targetTypeUser'),
        icon: <User className="w-4 h-4" />,
      },
    ],
    [t],
  );

  const selectedTagString = useMemo(() => {
    return Array.from(selectedTargets)
      .map((tag) => enrichTagWithBotSelfId(tag, resolvedBotSelfId))
      .join(',');
  }, [selectedTargets, resolvedBotSelfId]);

  return (
    <PinnedPage
      className="gap-6"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Send className="w-8 h-8 shrink-0" />
              {t('batchPush.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('batchPush.description')}
            </p>
          </div>
          <Button
            className="h-9 self-start sm:self-auto shrink-0"
            onClick={submit}
            disabled={submitting}
          >
            <Send className="w-4 h-4" />
            {submitting ? t('batchPush.submitting') : t('batchPush.submit')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左：正文 + 目标 */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                {t('batchPush.sectionTextTitle')}
              </CardTitle>
              <CardDescription>
                {t('batchPush.sectionTextDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="push-text">{t('batchPush.pushTextLabel')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={IMAGE_ACCEPT}
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = e.target.files;
                        if (list && list.length > 0) {
                          void insertImageFiles(Array.from(list));
                        }
                        // allow re-selecting the same file
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      disabled={insertingImage}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {insertingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImagePlus className="w-4 h-4" />
                      )}
                      {t('batchPush.insertImage')}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('batchPush.imageHint')}</p>
                <div
                  className={cn(
                    'relative rounded-md transition-colors',
                    bodyDragging && 'ring-2 ring-primary/60 bg-primary/5',
                  )}
                  onDragEnter={onBodyDragEnter}
                  onDragLeave={onBodyDragLeave}
                  onDragOver={onBodyDragOver}
                  onDrop={onBodyDrop}
                >
                  <Textarea
                    ref={textAreaRef}
                    id="push-text"
                    className="min-h-[160px] font-mono text-sm"
                    placeholder={t('batchPush.pushTextPlaceholder') ?? ''}
                    value={text}
                    onChange={(e) => onBodyTextChange(e.target.value)}
                    onPaste={onBodyPaste}
                  />
                  {bodyDragging && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-primary/50 bg-background/70 text-sm font-medium text-primary">
                      <span className="flex items-center gap-2">
                        <ImagePlus className="w-5 h-5" />
                        {t('batchPush.imageDropHint')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                {t('batchPush.sectionTargetsTitle')}
              </CardTitle>
              <CardDescription>
                {t('batchPush.sectionTargetsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 行 1：WS Bot + 机器人账号（bot_self_id） */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label>{t('batchPush.botsLabel')}</Label>
                  <Select value={bot} onValueChange={setBot}>
                    <SelectTrigger className={cn(tabToolbarControlClass, 'w-full')}>
                      <SelectValue placeholder={t('batchPush.botsAll') ?? ''} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_BOT_SENTINEL}>
                        {t('batchPush.botsAll')}
                      </SelectItem>
                      {bots.map((b) => (
                        <SelectItem key={b.bot_id} value={b.bot_id}>
                          {b.name}
                          {b.connected === false ? ` · ${t('batchPush.botDisconnected')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('batchPush.botsHint')}</p>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>{t('batchPush.botSelfLabel')}</Label>
                  <InputWithDropdown
                    value={botSelfInput}
                    onChange={setBotSelfInput}
                    options={botSelfDropdownOptions}
                    formatLabel={formatBotSelfLabel}
                    placeholder={t('batchPush.botSelfPlaceholder') ?? ''}
                    inputPlaceholder={t('batchPush.botSelfInputPlaceholder') ?? ''}
                    className={cn(tabToolbarControlClass, 'w-full')}
                    popoverWidth="w-[var(--radix-popover-trigger-width)] min-w-[280px]"
                  />
                  <p className="text-xs text-muted-foreground">{t('batchPush.botSelfHint')}</p>
                </div>
              </div>

              {/* 行 2：类型筛选 Tab + 刷新；以默认高度 TabButtonGroup 为基准，同行 h-11 */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                <div className={tabToolbarGroupWrapClass}>
                  <TabButtonGroup
                    options={typeFilterOptions}
                    value={typeFilter}
                    onValueChange={setTypeFilter}
                    className="shrink-0"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(tabToolbarControlClass, 'w-full shrink-0 sm:w-auto sm:ml-auto')}
                  onClick={() => loadPage(true)}
                  disabled={initialLoading}
                >
                  <RefreshCw className={initialLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                  {t('batchPush.refresh')}
                </Button>
              </div>

              {/* 搜索框（label + value 双字段模糊匹配） */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 font-mono text-xs"
                  placeholder={t('batchPush.searchPlaceholder') ?? ''}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              {/* 行 4：虚拟化目标列表 + 行 5：Load more 触发器（在虚拟列表容器内部底部） */}
              <div
                ref={parentRef}
                className="border border-border/40 rounded-lg bg-muted/30 overflow-auto"
                style={{ height: VIRTUAL_LIST_HEIGHT_PX }}
              >
                {initialLoading ? (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('batchPush.loading')}
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">
                    {t('batchPush.noResults')}
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        height: rowVirtualizer.getTotalSize(),
                        position: 'relative',
                      }}
                    >
                      {rowVirtualizer.getVirtualItems().map((vi) => {
                        const it = items[vi.index];
                        const isMacro = it.kind === 'macro';
                        const badgeText = badgeLabelForKind(
                          it.kind,
                          t('batchPush.targetTypeGroup'),
                          t('batchPush.targetTypeUser'),
                        );
                        return (
                          <label
                            key={it.value}
                            data-index={vi.index}
                            ref={(node) => rowVirtualizer.measureElement(node)}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: vi.size,
                              transform: `translateY(${vi.start}px)`,
                            }}
                            className="flex items-center gap-2 px-3 cursor-pointer text-sm hover:bg-accent/40 border-b border-border/20"
                          >
                            <Checkbox
                              checked={selectedTargets.has(it.value)}
                              onCheckedChange={(c) => toggle(it.value, !!c)}
                            />
                            <Badge
                              variant={isMacro ? 'secondary' : 'outline'}
                              className="shrink-0 text-[10px] px-1.5 py-0"
                            >
                              {badgeText}
                            </Badge>
                            <span
                              className={
                                isMacro
                                  ? 'truncate flex-1 font-semibold text-primary'
                                  : 'truncate flex-1'
                              }
                            >
                              {it.label}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0 font-mono">
                              {it.value}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {/* Load more：在虚拟列表容器底部触发「拉下一页」，
                        不用 IntersectionObserver 是因为 virtualization 的滚动由它托管，
                        自管 observer 会和它抢事件。按钮更可控，UX 上也直观。 */}
                    <div className="sticky bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/40 p-2">
                      {pageInfo.hasMore ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-full h-8 text-xs"
                          onClick={loadMore}
                          disabled={loadingMore}
                        >
                          {loadingMore ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          {t('batchPush.loadMore', {
                            loaded: items.length,
                            total: pageInfo.total,
                          })}
                        </Button>
                      ) : items.length > 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground py-1">
                          {t('batchPush.loadedAll', { total: pageInfo.total })}
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              {/* 行 6：Footer（统计 + 批量操作） */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {t('batchPush.loadedTargets', { count: items.length })}
                  {pageInfo.total > 0 && items.length !== pageInfo.total && (
                    <> · {t('batchPush.totalTargets', { total: pageInfo.total })}</>
                  )}
                  {' · '}
                  {t('batchPush.selectedCount', { count: selectedTargets.size })}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={selectAllLoaded}
                    disabled={items.length === 0}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t('batchPush.selectAllLoaded')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={clearSelection}
                    disabled={selectedTargets.size === 0}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    {t('batchPush.clearSelection')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                {t('batchPush.noteTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>{t('batchPush.note1')}</li>
                <li>{t('batchPush.note2')}</li>
                <li>{t('batchPush.note3')}</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 右：预览 + 最近记录 */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('batchPush.previewTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border border-border/40 rounded-lg p-3 min-h-[160px] space-y-2 bg-background/50">
                {previewBlocks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('batchPush.previewEmpty')}
                  </p>
                ) : (
                  previewBlocks.map((block, i) =>
                    block.type === 'image' ? (
                      <div key={i} className="space-y-1">
                        <img
                          src={block.content}
                          alt=""
                          width={block.w ? Number(block.w) : undefined}
                          height={block.h ? Number(block.h) : undefined}
                          className="max-h-48 max-w-full rounded border border-border/40 object-contain"
                        />
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {block.w && block.h ? `${block.w}×${block.h}` : 'image'} · base64
                        </p>
                      </div>
                    ) : (
                      <p key={i} className="text-sm whitespace-pre-wrap leading-6">
                        {block.content}
                      </p>
                    ),
                  )
                )}
              </div>
              <Input
                className="h-9 mt-3 font-mono text-xs"
                value={selectedTagString}
                readOnly
                placeholder={selectedTagString ? '' : (t('batchPush.targetsPlaceholder') ?? '')}
              />
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                {t('batchPush.historyTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {t('batchPush.historyEmpty')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PinnedPage>
  );
}