import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  Activity,
  AlertTriangle,
  ArrowDownAZ,
  BadgeCheck,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cloud,
  Code,
  Database,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Factory,
  Film,
  Flame,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Info,
  KeyRound,
  Landmark,
  Layers,
  LayoutGrid,
  ListOrdered,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Package,
  Palette,
  Plane,
  Plug,
  Radio,
  RefreshCw,
  ScanSearch,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Terminal,
  Trash2,
  Users,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import {
  getApiErrorMessage,
  mcpConfigApi,
  mcpMarketApi,
  type MCPBindCandidate,
  type MCPConfig,
  type MCPConfigCreateData,
  type MCPMarketDetail,
  type MCPMarketEntry,
  type MCPMarketInstallPreview,
  type MCPMarketTool,
  type MCPMarketVariant,
  type MCPRuntimeCheck,
  type MCPToolFromServer,
  type MCPTransport,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  McpBindSection,
  McpDiscoveringHint,
  McpEnvBindableControl,
  McpSwitchRow,
  McpToolSelectSection,
} from '@/components/mcp/McpToolControls';
import { defaultToolMeta, type ToolMeta } from '@/components/mcp/toolMeta';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OverflowTags } from '@/components/ui/overflow-tags';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';

const PAGE_SIZE = 24;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // mcpmarket 中文分类
  托管: Cloud,
  精选: Sparkles,
  最火: Flame,
  新上: Clock,
  开发: Code,
  数据: Database,
  社交: Users,
  创作: Palette,
  生产: Factory,
  企业: Building2,
  金融: Landmark,
  搜索: Search,
  媒体: ImageIcon,
  工具: Wrench,
  官方: BadgeCheck,
  教育: GraduationCap,
  商业: Briefcase,
  其他: MoreHorizontal,
  // ModelScope 英文 slug
  'browser-automation': Globe,
  'developer-tools': Code,
  'location-services': MapPin,
  search: Search,
  finance: Landmark,
  'knowledge-and-memory': Brain,
  'entertainment-and-media': Film,
  'calendar-management': Calendar,
  'travel-and-transportation': Plane,
  communication: MessageSquare,
  'research-and-data': FlaskConical,
  'art-and-culture': Palette,
  databases: Database,
  'version-control': GitBranch,
  'file-systems': FolderOpen,
  'image-and-video-processing': ImageIcon,
  'os-automation': Terminal,
  'cloud-platforms': Cloud,
  monitoring: Activity,
  'note-taking': NotebookPen,
  'social-media': Users,
  'ai-media': Sparkles,
  'skill-management': Wrench,
  AIGC: Sparkles,
  other: MoreHorizontal,
};

function categoryIcon(cat: string): LucideIcon {
  return CATEGORY_ICONS[cat] || Tag;
}

function transportBadge(transport?: string) {
  const t = transport || '';
  if (t === 'stdio')
    return {
      label: 'stdio',
      Icon: Terminal,
      text: 'text-violet-600 dark:text-violet-400',
      badge: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400',
      selected: 'border-violet-500/60 bg-violet-500/10',
    };
  if (t === 'sse')
    return {
      label: 'SSE',
      Icon: Radio,
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      selected: 'border-amber-500/60 bg-amber-500/10',
    };
  return {
    label: 'HTTP',
    Icon: Globe,
    text: 'text-sky-600 dark:text-sky-400',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    selected: 'border-sky-500/60 bg-sky-500/10',
  };
}

function runtimeGuideText(
  check: MCPRuntimeCheck,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const key = `mcpMarket.install.runtimeGuide.${check.runtime}`;
  const text = t(key, { command: check.command });
  return text === key
    ? t('mcpMarket.install.runtimeGuide.unknown', { command: check.command })
    : text;
}

function ReadmeSection({ readme }: { readme: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-left text-sm hover:bg-sky-500/15"
        >
          <BookOpen className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="flex-1">{t('mcpMarket.install.readmeTitle')}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-left">
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{readme}</ReactMarkdown>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolsSection({ tools }: { tools: MCPMarketTool[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-left text-sm hover:bg-sky-500/15"
        >
          <Wrench className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="flex-1">
            {t('mcpMarket.install.toolsTitle', { count: tools.length })}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
          {tools.map((tool) => (
            <div key={tool.name} className="space-y-1">
              <div className="font-mono text-xs font-semibold">{tool.name}</div>
              {tool.description && (
                <div className="text-xs leading-relaxed text-muted-foreground">
                  {tool.description}
                </div>
              )}
              {tool.params && tool.params.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tool.params.map((p) => (
                    <span
                      key={p.name}
                      title={p.description || undefined}
                      className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {p.name}
                      {p.required ? <span className="text-destructive">*</span> : null}
                      {p.type ? `:${p.type}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MarketLogo({ entry }: { entry: MCPMarketEntry }) {
  const [failed, setFailed] = useState(false);
  if (entry.logo_url && !failed) {
    return (
      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border shadow-md bg-background">
        <img
          src={mcpMarketApi.logoUrl(entry.logo_url)}
          alt={entry.qualified_name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-border shadow-md">
      <Plug className="w-7 h-7 text-muted-foreground/50" />
    </div>
  );
}

export default function MCPMarketPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<MCPMarketEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [degraded, setDegraded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortType, setSortType] = useState<'default' | 'popular' | 'name'>('default');
  const [hostedOnly, setHostedOnly] = useState(false);
  const [sourceType, setSourceType] = useState<'mcpmarket' | 'modelscope' | 'all'>('mcpmarket');
  const [categories, setCategories] = useState<string[]>([]);
  const [transportMap, setTransportMap] = useState<Record<string, string[]>>({});
  const [truncated, setTruncated] = useState(false);
  const [partial, setPartial] = useState(false);
  const [pageInput, setPageInput] = useState('1');

  const [installTarget, setInstallTarget] = useState<MCPMarketEntry | null>(null);
  const [detail, setDetail] = useState<MCPMarketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [variantIndex, setVariantIndex] = useState(0);
  const [preview, setPreview] = useState<MCPMarketInstallPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [installName, setInstallName] = useState('');
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [visibleEnv, setVisibleEnv] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState(false);

  // 装机后凭据提示 + 主人自动绑定
  const [credConfig, setCredConfig] = useState<{ id: string; name: string } | null>(null);
  const [credCandidates, setCredCandidates] = useState<MCPBindCandidate[] | null>(null);
  const [credSelected, setCredSelected] = useState<Set<string>>(new Set());
  const [credBinding, setCredBinding] = useState(false);

  // 已安装配置（market_meta.qualified_name → 本地配置）：卡片显示「卸载」
  const [installedConfigs, setInstalledConfigs] = useState<MCPConfig[]>([]);
  const [uninstallTarget, setUninstallTarget] = useState<MCPConfig | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  // 安装向导内的可编辑项（与编辑页同一套控件语义）
  const [toolSel, setToolSel] = useState<Set<string>>(new Set());
  const [installToolMeta, setInstallToolMeta] = useState<Record<string, ToolMeta>>({});
  // 实连探测到的工具（优先于市场元数据 tools 展示/安装）
  const [liveTools, setLiveTools] = useState<MCPToolFromServer[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [envBindable, setEnvBindable] = useState<Record<string, boolean>>({});
  const [bindHelp, setBindHelp] = useState('');
  const [bindUrl, setBindUrl] = useState('');
  const [bindAliasText, setBindAliasText] = useState('');
  const [allowAutoPrivate, setAllowAutoPrivate] = useState(false);
  const [installEnabled, setInstallEnabled] = useState(true);

  const installedMap = useMemo(() => {
    const m = new Map<string, MCPConfig>();
    for (const c of installedConfigs) {
      const qn = c.market_meta?.qualified_name;
      if (qn) m.set(qn, c);
    }
    return m;
  }, [installedConfigs]);

  const loadInstalled = useCallback(async () => {
    try {
      const data = await mcpConfigApi.getList();
      setInstalledConfigs(data.configs || []);
    } catch {
      setInstalledConfigs([]);
    }
  }, []);

  type MarketQuery = {
    page: number;
    search: string;
    category: string;
    sort: string;
    hosted: boolean;
    source: string;
  };
  const lastQueryRef = useRef<MarketQuery | null>(null);

  const loadList = useCallback(
    async (opts: MarketQuery) => {
      try {
        setIsLoading(true);
        lastQueryRef.current = opts;
        const data = await mcpMarketApi.list({
          search: opts.search || undefined,
          category: opts.category || undefined,
          hosted: opts.hosted || undefined,
          sort: opts.sort,
          source: opts.source,
          page: opts.page,
          page_size: PAGE_SIZE,
        });
        setEntries(data.entries || []);
        setTotal(data.total || 0);
        setPage(data.page || opts.page);
        setDegraded(Boolean(data.degraded));
        setCategories(data.categories || []);
        setTruncated(Boolean(data.truncated));
        setPartial(Boolean(data.partial));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('mcpMarket.loadFailed')));
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  // 可装性判定未完的 scope：后台判定续跑，定时重拉同一查询即得完整目录
  useEffect(() => {
    if (!partial || isLoading) return;
    const timer = setTimeout(() => {
      const q = lastQueryRef.current;
      if (q) void loadList(q);
    }, 12_000);
    return () => clearTimeout(timer);
  }, [partial, isLoading, loadList]);

  const reload = useCallback(
    (
      nextPage: number,
      overrides?: Partial<{
        search: string;
        category: string;
        sortType: 'default' | 'popular' | 'name';
        hostedOnly: boolean;
        sourceType: 'mcpmarket' | 'modelscope' | 'all';
      }>,
    ) => {
      const f = { search, category, sortType, hostedOnly, sourceType, ...overrides };
      void loadList({
        page: nextPage,
        search: f.search,
        category: f.category,
        sort: f.sortType,
        hosted: f.hostedOnly,
        source: f.sourceType,
      });
    },
    [loadList, search, category, sortType, hostedOnly, sourceType],
  );

  useEffect(() => {
    void loadList({
      page: 1,
      search: '',
      category: '',
      sort: 'default',
      hosted: false,
      source: 'mcpmarket',
    });
    void loadInstalled();
  }, [loadList, loadInstalled]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  // 可见卡片的 transport 徽章：批量端点（详情缓存支撑），不阻塞列表渲染
  useEffect(() => {
    const names = entries.map((e) => e.qualified_name);
    if (names.length === 0) {
      setTransportMap({});
      return;
    }
    let cancelled = false;
    mcpMarketApi
      .transports(names)
      .then((d) => {
        if (!cancelled) setTransportMap(d.transports || {});
      })
      .catch(() => {
        if (!cancelled) setTransportMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const submitSearch = () => {
    const next = searchInput.trim();
    setSearch(next);
    void loadList({
      page: 1,
      search: next,
      category,
      sort: sortType,
      hosted: hostedOnly,
      source: sourceType,
    });
  };

  const jumpToPage = () => {
    const n = Math.min(Math.max(1, Number(pageInput) || 1), totalPages);
    setPageInput(String(n));
    if (n !== page) reload(n);
  };

  const openInstall = (entry: MCPMarketEntry) => {
    setInstallTarget(entry);
    setDetail(null);
    setPreview(null);
    setEnvValues({});
    setVisibleEnv(new Set());
    setToolSel(new Set());
    setInstallToolMeta({});
    setLiveTools(null);
    setDiscovering(false);
    setEnvBindable({});
    setBindHelp('');
    setBindUrl('');
    setBindAliasText('');
    setAllowAutoPrivate(false);
    setInstallEnabled(true);
    setDetailLoading(true);
    mcpMarketApi
      .detail(entry.qualified_name)
      .then((data) => {
        setDetail(data);
        const idx =
          typeof data.default_variant === 'number' && data.default_variant < data.variants.length
            ? data.default_variant
            : 0;
        setVariantIndex(idx);
        setInstallName(data.chinese_name || data.name || entry.qualified_name);
        // 市场元数据里的凭据获取地址/指引 → 预填绑定引导（仍可改）
        setBindUrl(data.obtain_url || '');
        setBindHelp(data.auth_help || '');
      })
      .catch((error) => {
        toast.error(getApiErrorMessage(error, t('mcpMarket.loadFailed')));
        setInstallTarget(null);
      })
      .finally(() => setDetailLoading(false));
  };

  const requestPreview = useCallback(
    (qualifiedName: string, index: number) => {
      setPreviewLoading(true);
      setLiveTools(null);
      mcpMarketApi
        .installPreview(qualifiedName, index)
        .then((data) => {
          setPreview(data);
          setInstallName(data.name || installName);
          setEnvValues((prev) => {
            const next = { ...prev };
            for (const key of data.env_required || []) {
              if (!(key in next)) next[key] = '';
            }
            return next;
          });
          // fail-closed：全部 env 默认「可按用户绑定」；工具默认全选
          setEnvBindable((prev) => {
            const next = { ...prev };
            for (const key of data.env_required || []) {
              if (!(key in next)) next[key] = true;
            }
            return next;
          });
          setToolSel(new Set((data.tools || []).map((tl) => tl.name)));
        })
        .catch((error) => toast.error(getApiErrorMessage(error, t('mcpMarket.loadFailed'))))
        .finally(() => setPreviewLoading(false));
    },
    [installName, t],
  );

  useEffect(() => {
    if (!installTarget || !detail) return;
    if (!detail.variants || detail.variants.length === 0) return;
    requestPreview(installTarget.qualified_name, variantIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installTarget, detail, variantIndex]);

  const variants: MCPMarketVariant[] = detail?.variants || [];
  const envRequired = preview?.env_required || [];
  const runtimeCheck = preview?.runtime_check ?? null;
  const runtimeMissing = runtimeCheck !== null && !runtimeCheck.available;
  // 后端探活判死链的 http 变体：隐藏安装方式卡片；选中项死链时拦截安装
  const deadUrls = new Set(preview?.dead_urls || []);
  const variantDead = preview?.url ? deadUrls.has(preview.url) : false;
  // 实连探测到的工具优先于市场元数据展示
  const toolsForDisplay = liveTools ?? preview?.tools ?? [];

  // headers/url 里的 {VAR}/${VAR} 占位用已填变量值替换（如 Bearer {TOKEN}、?API_KEY={API_KEY}）
  const fillPlaceholders = (text: string, encode = false) =>
    text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, a, b) => {
      const replacement = envValues[a || b];
      return typeof replacement === 'string' && replacement
        ? encode
          ? encodeURIComponent(replacement)
          : replacement
        : m;
    });
  const buildResolvedHeaders = () =>
    Object.fromEntries(
      Object.entries(preview?.headers || {}).map(([key, value]) => [key, fillPlaceholders(value)]),
    );
  const buildResolvedUrl = () => fillPlaceholders(preview?.url || '', true);

  // 连接选中变体实际探测工具列表：stdio 会在本机执行一次该命令，remote 走握手
  const discoverLiveTools = async () => {
    if (!preview || discovering || variantDead) return;
    const missing = envRequired.filter((key) => !(envValues[key] || '').trim());
    if (missing.length > 0) {
      toast.error(t('mcpMarket.install.envMissing', { keys: missing.join(', ') }));
      return;
    }
    setDiscovering(true);
    try {
      const isStdio = preview.transport === 'stdio';
      const result = await mcpConfigApi.discoverToolsFromConfig({
        name: installName.trim() || preview.name || 'preview',
        transport: (preview.transport || 'stdio') as MCPTransport,
        command: isStdio ? preview.command : undefined,
        args: isStdio ? preview.args : undefined,
        source_url: preview.source_url,
        requires_checkout: preview.requires_checkout,
        env: isStdio ? { ...preview.env, ...envValues } : undefined,
        url: isStdio ? undefined : buildResolvedUrl(),
        headers: isStdio ? undefined : buildResolvedHeaders(),
      });
      setLiveTools(result.tools);
      setToolSel(new Set(result.tools.map((tl) => tl.name)));
      if (result.count > 0) {
        toast.success(`${t('mcpConfig.toolsCount', { count: result.count })}`);
      } else {
        toast.warning(t('mcpConfig.discoverEmpty'));
      }
    } catch (error) {
      toast.error(
        error instanceof DOMException && error.name === 'TimeoutError'
          ? t('mcpConfig.discoverTimeout')
          : getApiErrorMessage(error, t('mcpConfig.discoverFailed')),
      );
    } finally {
      setDiscovering(false);
    }
  };

  const confirmInstall = async () => {
    if (!preview || !installTarget || runtimeMissing || variantDead) return;
    const name = installName.trim();
    if (!name) {
      toast.error(t('mcpMarket.install.nameRequired'));
      return;
    }
    const missing = envRequired.filter((key) => !(envValues[key] || '').trim());
    if (missing.length > 0) {
      toast.error(t('mcpMarket.install.envMissing', { keys: missing.join(', ') }));
      return;
    }
    const resolvedHeaders = buildResolvedHeaders();
    // 「可按用户绑定」勾选项 → user_env_keys；有可绑凭据的服务工具默认 private
    const userEnvKeys = envRequired.filter((k) => envBindable[k] !== false);
    const hasCreds = userEnvKeys.length > 0;
    const tools = toolsForDisplay
      .filter((tl) => toolSel.has(tl.name))
      .map((tl) => {
        const meta = installToolMeta[tl.name] ?? defaultToolMeta(hasCreds);
        return {
          ...tl,
          exposure: meta.exposure,
          mutating: meta.mutating,
          sensitive_args: meta.sensitiveArgs,
          credential_params: meta.credParamsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      });
    const payload: MCPConfigCreateData = {
      name,
      transport: (preview.transport as MCPConfigCreateData['transport']) || 'stdio',
      command: preview.command,
      args: preview.args,
      url: buildResolvedUrl(),
      headers: resolvedHeaders,
      env: { ...preview.env, ...envValues },
      description: preview.description,
      market_meta: preview.market_meta,
      tools,
      enabled: installEnabled,
      register_as_ai_tools: true,
      user_env_keys: userEnvKeys,
      bind_help: bindHelp.trim(),
      bind_url: bindUrl.trim(),
      bind_alias: bindAliasText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      allow_autonomous_private: allowAutoPrivate,
    };
    try {
      setInstalling(true);
      const created = await mcpConfigApi.create(payload);
      void loadInstalled();
      toast.success(t('mcpMarket.install.success'));
      setInstallTarget(null);
      // 带凭据服务：提示公用凭据语义 + 可一键为主人安装绑定
      if (Object.keys(payload.env ?? {}).length > 0) {
        setCredConfig({ id: created.config_id, name });
      } else {
        navigate('/mcp-config');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpMarket.install.failed')));
    } finally {
      setInstalling(false);
    }
  };

  // 凭据弹窗打开时拉取主人候选
  useEffect(() => {
    if (!credConfig) return;
    let alive = true;
    mcpConfigApi
      .getBindCandidates()
      .then((res) => {
        if (alive) setCredCandidates(res.candidates ?? []);
      })
      .catch(() => {
        if (alive) setCredCandidates([]);
      });
    return () => {
      alive = false;
    };
  }, [credConfig]);

  const closeCredDialog = () => {
    setCredConfig(null);
    setCredCandidates(null);
    setCredSelected(new Set());
    navigate('/mcp-config');
  };

  const handleCredBind = async () => {
    if (!credConfig || !credCandidates || credSelected.size === 0) return;
    const pairs = credCandidates
      .filter((c) => credSelected.has(`${c.bot_id}|${c.user_id}`))
      .map((c) => ({ bot_id: c.bot_id, user_id: c.user_id }));
    try {
      setCredBinding(true);
      const res = await mcpConfigApi.adminBind(credConfig.id, pairs);
      toast.success(t('mcpMarket.install.credBindDone', { count: res.bound_count }));
      closeCredDialog();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpConfig.installBindFailed')));
    } finally {
      setCredBinding(false);
    }
  };

  const toggleCredPair = (key: string) => {
    setCredSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleInstallTool = (name: string) => {
    setToolSel((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const confirmUninstall = async () => {
    if (!uninstallTarget) return;
    try {
      setUninstalling(true);
      await mcpConfigApi.delete(uninstallTarget.config_id);
      toast.success(t('mcpMarket.install.uninstallDone'));
      setUninstallTarget(null);
      void loadInstalled();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mcpMarket.loadFailed')));
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <TooltipProvider>
      <PinnedPage
        header={
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <ShoppingBag width={32} height={32} className="text-foreground" />
              {t('mcpMarket.title')}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {t('mcpMarket.description')}
            </p>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sourceType}
            onValueChange={(v) => {
              const next = v as 'mcpmarket' | 'modelscope' | 'all';
              setSourceType(next);
              reload(1, { sourceType: next });
            }}
          >
            <SelectTrigger className={cn(tabToolbarControlClass, 'w-[140px]')}>
              <SelectValue placeholder={t('mcpMarket.filterSource')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcpmarket">
                <span className="inline-flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  {t('mcpMarket.sourceMcpmarket')}
                </span>
              </SelectItem>
              <SelectItem value="modelscope">
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  {t('mcpMarket.sourceModelscope')}
                </span>
              </SelectItem>
              <SelectItem value="all">
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('mcpMarket.sourceAll')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={category || 'all'}
            onValueChange={(v) => {
              const next = v === 'all' ? '' : v;
              setCategory(next);
              reload(1, { category: next });
            }}
          >
            <SelectTrigger className={cn(tabToolbarControlClass, 'w-[150px]')}>
              <SelectValue placeholder={t('mcpMarket.filterCategory')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="inline-flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('mcpMarket.filterAll')}
                </span>
              </SelectItem>
              {categories.map((cat) => {
                const Icon = categoryIcon(cat);
                return (
                  <SelectItem key={cat} value={cat}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {cat}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select
            value={sortType}
            onValueChange={(v) => {
              const next = v as 'default' | 'popular' | 'name';
              setSortType(next);
              reload(1, { sortType: next });
            }}
          >
            <SelectTrigger className={cn(tabToolbarControlClass, 'w-[140px]')}>
              <SelectValue placeholder={t('mcpMarket.sortLabel')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                <span className="inline-flex items-center gap-1.5">
                  <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('mcpMarket.sortDefault')}
                </span>
              </SelectItem>
              <SelectItem value="popular">
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  {t('mcpMarket.sortPopular')}
                </span>
              </SelectItem>
              <SelectItem value="name">
                <span className="inline-flex items-center gap-1.5">
                  <ArrowDownAZ className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('mcpMarket.sortName')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={hostedOnly ? 'hosted' : 'all'}
            onValueChange={(v) => {
              const next = v === 'hosted';
              setHostedOnly(next);
              reload(1, { hostedOnly: next });
            }}
          >
            <SelectTrigger className={cn(tabToolbarControlClass, 'w-[130px]')}>
              <SelectValue placeholder={t('mcpMarket.filterHosted')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="inline-flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('mcpMarket.filterHostedAll')}
                </span>
              </SelectItem>
              <SelectItem value="hosted">
                <span className="inline-flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  {t('mcpMarket.filterHostedOnly')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {truncated && sortType !== 'default' && (
            <span className="text-xs text-muted-foreground">
              {t('mcpMarket.truncatedTip', { total })}
            </span>
          )}
          <div className="relative ml-auto min-w-44 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch();
              }}
              placeholder={t('mcpMarket.searchPlaceholder')}
              className={cn(tabToolbarControlClass, 'pl-9')}
            />
          </div>
          <Button variant="outline" className={tabToolbarControlClass} onClick={submitSearch}>
            {t('common.search')}
          </Button>
          <Button
            variant="outline"
            className={tabToolbarControlClass}
            onClick={() => reload(page)}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>

        {degraded && (
          <Card className="glass-card">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm text-muted-foreground">{t('mcpMarket.degradedTip')}</p>
            </CardContent>
          </Card>
        )}

        {partial && !isLoading && (
          <Card className="glass-card">
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('mcpMarket.partialTip')}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">{t('mcpMarket.empty')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map((entry) => {
                const chips = [...(entry.categories || []), ...(entry.tags || [])];
                const installedCfg = installedMap.get(entry.qualified_name);
                return (
                  <Card
                    key={entry.qualified_name}
                    className="glass-card flex flex-col cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                    onClick={() => openInstall(entry)}
                  >
                    <div className="p-4 pb-2">
                      <div className="flex gap-3">
                        <div className="relative flex-shrink-0 self-start">
                          <MarketLogo entry={entry} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3
                              className="font-semibold text-base truncate"
                              title={entry.chinese_name || entry.name}
                            >
                              {entry.chinese_name || entry.name}
                            </h3>
                            <div className="flex flex-wrap items-center justify-end gap-1 sm:shrink-0">
                              {entry.source === 'preset' && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  {t('mcpMarket.presetBadge')}
                                </Badge>
                              )}
                              {installedCfg && (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-xs font-normal text-emerald-700 dark:text-emerald-400"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t('mcpMarket.install.installedBadge')}
                                </Badge>
                              )}
                              {(transportMap[entry.qualified_name] || []).slice(0, 3).map((tr) => {
                                const meta = transportBadge(tr);
                                return (
                                  <Badge
                                    key={tr}
                                    variant="outline"
                                    className={cn('gap-1 px-1.5 text-[10px]', meta.badge)}
                                  >
                                    <meta.Icon className="h-3 w-3" />
                                    {meta.label}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {entry.author ? `by ${entry.author}` : entry.qualified_name}
                          </p>
                          <p
                            className="text-sm text-muted-foreground mt-1 truncate"
                            title={entry.description || ''}
                          >
                            {entry.description || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-[1.625rem] items-center px-4 pb-2">
                      <OverflowTags tags={chips} className="max-w-none" expandOnHover={false} />
                    </div>

                    <CardFooter className="mt-auto p-4 pt-2 sm:p-4 sm:pt-2">
                      {installedCfg ? (
                        <Button
                          variant="outline"
                          className="w-full gap-1 text-sm text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUninstallTarget(installedCfg);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                          {t('mcpMarket.install.uninstall')}
                        </Button>
                      ) : (
                        <Button
                          className="w-full gap-1 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInstall(entry);
                          }}
                        >
                          <Download className="w-3 h-3" />
                          {t('mcpMarket.install.action')}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
            <div className="glass-card flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {t('mcpMarket.totalCount', { total })}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page <= 1 || isLoading}
                  onClick={() => reload(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-9 gap-1 px-3"
                  disabled={page <= 1 || isLoading}
                  onClick={() => reload(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('mcpMarket.prevPage')}
                </Button>
                <div className="mx-1 flex items-center gap-1.5">
                  <Input
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') jumpToPage();
                    }}
                    onBlur={jumpToPage}
                    className="h-9 w-16 text-center"
                    inputMode="numeric"
                  />
                  <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
                    / {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="h-9 gap-1 px-3"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => reload(page + 1)}
                >
                  {t('mcpMarket.nextPage')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => reload(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* 安装向导 */}
        <Dialog
          open={Boolean(installTarget)}
          onOpenChange={(open) => !open && setInstallTarget(null)}
        >
          <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-[560px] flex-col overflow-hidden p-0 lg:max-w-[1180px]">
            <DialogHeader className="shrink-0 border-b px-5 py-3.5">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <Package className="h-5 w-5 shrink-0 text-primary" />
                {t('mcpMarket.install.title', {
                  name: installTarget?.chinese_name || installTarget?.name || '',
                })}
                {detail?.is_hosted && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-700 dark:text-sky-400"
                  >
                    <Cloud className="h-3 w-3" />
                    {t('mcpMarket.install.hostedBadge')}
                  </Badge>
                )}
                {detail?.is_verified && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {t('mcpMarket.install.verifiedBadge')}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t('mcpMarket.install.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[62vh] overflow-y-auto px-5 pb-1 pt-2 lg:flex lg:min-h-0 lg:flex-col lg:overflow-visible lg:pr-7">
              {detailLoading || !detail ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : variants.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('mcpMarket.install.noVariantsTitle')}</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      {detail.is_hosted
                        ? t('mcpMarket.install.noVariantsHosted')
                        : t('mcpMarket.install.noVariants')}
                    </p>
                  </div>
                  {detail.readme && <ReadmeSection readme={detail.readme} />}
                  {detail.tools && detail.tools.length > 0 && <ToolsSection tools={detail.tools} />}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => navigate('/mcp-config')}
                  >
                    {t('mcpMarket.install.manualConfig')}
                  </Button>
                </div>
              ) : (
                /* 双栏独立滚动：左=介绍/安装方式/凭据，右=工具/开关；移动端单列长滚 */
                <div className="lg:flex lg:min-h-0 lg:flex-1 lg:gap-4">
                  {/* 左栏：服务信息 / 安装方式 / 基础与凭据 */}
                  <div className="divide-y divide-border/40 lg:w-1/2 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                    {detail.readme && (
                      <div className="py-3 first:pt-0">
                        <ReadmeSection readme={detail.readme} />
                      </div>
                    )}

                    <div className="space-y-1.5 py-3 first:pt-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Layers className="h-3.5 w-3.5" />
                        {t('mcpMarket.install.variantLabel')}
                      </div>
                      <div className="grid gap-1.5">
                        {variants.map((variant, index) => {
                          if (variant.url && deadUrls.has(variant.url)) return null;
                          const meta = transportBadge(variant.transport);
                          const active = index === variantIndex;
                          return (
                            <div
                              key={`${variant.transport}:${variant.url || ''}:${variant.command || ''}:${variant.label || ''}`}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                                active ? meta.selected : 'border-border hover:bg-accent/40',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => setVariantIndex(index)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                              >
                                <meta.Icon className={cn('h-4 w-4 shrink-0', meta.text)} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {variant.label || meta.label}
                                  </p>
                                  <p
                                    className="truncate select-text font-mono text-[11px] text-muted-foreground"
                                    title={variant.url || undefined}
                                  >
                                    {variant.transport === 'stdio'
                                      ? [variant.command, ...(variant.args || [])].join(' ')
                                      : variant.url}
                                  </p>
                                </div>
                              </button>
                              {variant.url ? (
                                <a
                                  href={variant.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                                  aria-label={variant.url}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                              {variant.requires_checkout && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 gap-1 border-amber-500/40 text-[10px] text-amber-600"
                                >
                                  {t('mcpMarket.install.checkoutBadge')}
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className={cn('shrink-0 gap-1 text-[10px]', meta.badge)}
                              >
                                <meta.Icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {previewLoading || !preview ? (
                      <div className="flex items-center gap-2 py-4 first:pt-0 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('common.loading')}
                      </div>
                    ) : (
                      <>
                        {(runtimeCheck ||
                          preview.runs_local_command ||
                          preview.name_conflict ||
                          variantDead) && (
                          <div className="space-y-2 py-2 first:pt-0">
                            {variantDead && (
                              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <p className="min-w-0 flex-1 text-xs text-destructive">
                                  {t('mcpMarket.install.deadVariant')}
                                </p>
                              </div>
                            )}
                            {runtimeCheck?.available && (
                              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                <div className="min-w-0 text-xs text-emerald-700 dark:text-emerald-400">
                                  <p>
                                    {t('mcpMarket.install.runtimeOk', {
                                      command: runtimeCheck.command,
                                    })}
                                  </p>
                                  {runtimeCheck.resolved && (
                                    <p
                                      className="mt-0.5 truncate font-mono opacity-80"
                                      title={runtimeCheck.resolved}
                                    >
                                      {runtimeCheck.resolved}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            {runtimeCheck && !runtimeCheck.available && (
                              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <div className="min-w-0 flex-1 text-xs text-destructive">
                                  <p className="font-medium">
                                    {t('mcpMarket.install.runtimeMissingTitle', {
                                      command: runtimeCheck.command || 'stdio',
                                    })}
                                  </p>
                                  <p className="mt-1 opacity-90">
                                    {runtimeGuideText(runtimeCheck, t)}
                                  </p>
                                  <p className="mt-1 opacity-75">
                                    {t('mcpMarket.install.runtimeRestart')}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  disabled={previewLoading}
                                  onClick={() =>
                                    installTarget &&
                                    requestPreview(installTarget.qualified_name, variantIndex)
                                  }
                                >
                                  <RefreshCw
                                    className={cn('h-3.5 w-3.5', previewLoading && 'animate-spin')}
                                  />
                                </Button>
                              </div>
                            )}
                            {preview.runs_local_command && (
                              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  {t('mcpMarket.install.localCommandTip')}
                                </p>
                              </div>
                            )}
                            {preview.requires_checkout && (
                              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <div className="min-w-0 flex-1 text-xs text-amber-700 dark:text-amber-400">
                                  <p>{t('mcpMarket.install.checkoutTip')}</p>
                                  {preview.source_url && (
                                    <a
                                      href={preview.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2"
                                    >
                                      {t('mcpMarket.install.checkoutRepo')}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                            {preview.name_conflict && (
                              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <p className="text-xs text-destructive">
                                  {t('mcpMarket.install.nameConflict')}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1.5 py-2 first:pt-0">
                          <Label
                            htmlFor="mcp-install-name"
                            className="flex items-center gap-1.5 text-xs font-medium"
                          >
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            {t('mcpMarket.install.nameLabel')}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="mcp-install-name"
                            className="h-9"
                            value={installName}
                            onChange={(e) => setInstallName(e.target.value)}
                          />
                        </div>

                        {envRequired.length > 0 && (
                          <div className="space-y-1.5 py-2 first:pt-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                {t('mcpMarket.install.envLabel')}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {detail?.auth_help
                                      ? `${detail.auth_help} ${t('mcpMarket.install.envTip')}`
                                      : t('mcpMarket.install.envTip')}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              {detail?.obtain_url && (
                                <a
                                  href={detail.obtain_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  {t('mcpMarket.install.envObtain')}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="space-y-2">
                              {envRequired.map((key) => {
                                const visible = visibleEnv.has(key);
                                return (
                                  <div key={key} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-9 w-40 shrink-0 items-center">
                                        <code className="truncate font-mono text-xs">{key}</code>
                                      </div>
                                      <div className="relative flex-1">
                                        <Input
                                          type={visible ? 'text' : 'password'}
                                          value={envValues[key] || ''}
                                          onChange={(e) =>
                                            setEnvValues((prev) => ({
                                              ...prev,
                                              [key]: e.target.value,
                                            }))
                                          }
                                          className="pr-9 font-mono text-xs"
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                          onClick={() =>
                                            setVisibleEnv((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(key)) {
                                                next.delete(key);
                                              } else {
                                                next.add(key);
                                              }
                                              return next;
                                            })
                                          }
                                        >
                                          {visible ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                          ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                      <McpEnvBindableControl
                                        envKey={key}
                                        checked={envBindable[key] !== false}
                                        onCheckedChange={(c) =>
                                          setEnvBindable((prev) => ({ ...prev, [key]: c }))
                                        }
                                      />
                                    </div>
                                    {detail?.env_hints?.[key] && (
                                      <p className="text-xs text-muted-foreground">
                                        {detail.env_hints[key]}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 py-2 first:pt-0">
                          <McpBindSection
                            bindHelp={bindHelp}
                            bindUrl={bindUrl}
                            bindAliasText={bindAliasText}
                            onChange={(patch) => {
                              if (patch.bindHelp !== undefined) setBindHelp(patch.bindHelp);
                              if (patch.bindUrl !== undefined) setBindUrl(patch.bindUrl);
                              if (patch.bindAliasText !== undefined)
                                setBindAliasText(patch.bindAliasText);
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* 右栏：工具与开关（预览就绪后显示） */}
                  {preview && (
                    <div className="mt-3 divide-y divide-border/40 lg:mt-0 lg:w-1/2 lg:min-h-0 lg:overflow-y-auto lg:pl-1 lg:pr-1">
                      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 py-2 first:pt-0">
                        <McpSwitchRow
                          checked={installEnabled}
                          onCheckedChange={setInstallEnabled}
                          label={t('mcpConfig.enabled')}
                          description={t('mcpConfig.enabledHelp')}
                        />
                        <McpSwitchRow
                          checked={allowAutoPrivate}
                          onCheckedChange={setAllowAutoPrivate}
                          label={t('mcpConfig.allowAutonomousPrivateShort')}
                          description={t('mcpConfig.allowAutonomousPrivateHelp')}
                        />
                      </div>

                      <div className="space-y-1.5 py-2 first:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => void discoverLiveTools()}
                          disabled={discovering || runtimeMissing || variantDead}
                        >
                          {discovering ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ScanSearch className="h-4 w-4" />
                          )}
                          {discovering
                            ? t('mcpConfig.discoveringTools')
                            : t('mcpConfig.discoverTools')}
                        </Button>
                        <McpDiscoveringHint active={discovering} />
                        {toolsForDisplay.length === 0 && !discovering && (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {t('mcpMarket.install.discoverHint')}
                          </p>
                        )}
                        {toolsForDisplay.length > 0 && (
                          <McpToolSelectSection
                            tools={toolsForDisplay.map((tl) => ({
                              name: tl.name,
                              description: tl.description,
                            }))}
                            selected={toolSel}
                            onToggle={toggleInstallTool}
                            toolMeta={installToolMeta}
                            onMetaChange={(n, meta) =>
                              setInstallToolMeta((prev) => ({ ...prev, [n]: meta }))
                            }
                            fallbackMeta={defaultToolMeta(
                              envRequired.filter((k) => envBindable[k] !== false).length > 0,
                            )}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="shrink-0 flex-col gap-3 border-t px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
              <div className="flex min-w-0 items-center gap-3 text-[11px]">
                {detail?.page_url && (
                  <a
                    href={detail.page_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                  >
                    {t('mcpMarket.install.viewMarketPage')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {detail?.source_url && (
                  <a
                    href={detail.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                    title={detail.source_url}
                  >
                    {t('mcpMarket.install.viewPublishUrl')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 justify-end gap-2">
                <Button variant="outline" onClick={() => setInstallTarget(null)}>
                  {t('common.cancel')}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={confirmInstall}
                        disabled={
                          installing || previewLoading || !preview || runtimeMissing || variantDead
                        }
                        className="gap-2"
                      >
                        {installing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {t('mcpMarket.install.confirm')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('mcpMarket.install.confirmTip')}</TooltipContent>
                </Tooltip>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 装机后凭据提示 + 主人自动绑定 */}
        <Dialog open={credConfig !== null} onOpenChange={(open) => !open && closeCredDialog()}>
          <DialogContent className="w-[95vw] max-w-lg glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                {t('mcpMarket.install.credTitle')}
              </DialogTitle>
              <DialogDescription>{t('mcpMarket.install.credSharedNotice')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm font-medium">{t('mcpMarket.install.credAutoBind')}</p>
              {credCandidates === null ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : credCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('mcpConfig.candidatesEmpty')}</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {credCandidates.map((c) => {
                    const key = `${c.bot_id}|${c.user_id}`;
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border/40 px-2.5 py-2 text-sm hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={credSelected.has(key)}
                          onCheckedChange={() => toggleCredPair(key)}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {c.user_name || c.user_id}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {c.user_id}@{c.bot_id}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t('mcpMarket.install.credManualHint')}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeCredDialog}>
                {t('mcpMarket.install.credSkip')}
              </Button>
              {credCandidates !== null && credCandidates.length > 0 && (
                <Button disabled={credSelected.size === 0 || credBinding} onClick={handleCredBind}>
                  {credBinding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('mcpMarket.install.credAutoBind')}（{credSelected.size}）
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 卸载确认 */}
        <AlertDialog
          open={uninstallTarget !== null}
          onOpenChange={(open) => !open && setUninstallTarget(null)}
        >
          <AlertDialogContent className="w-[95vw] max-w-lg glass-card">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('mcpMarket.install.uninstallTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('mcpMarket.install.uninstallDesc', {
                  name: uninstallTarget?.name ?? '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmUninstall}
                disabled={uninstalling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {uninstalling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('mcpMarket.install.uninstall')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PinnedPage>
    </TooltipProvider>
  );
}
