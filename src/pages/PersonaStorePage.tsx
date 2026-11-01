import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Store,
  ArrowLeft,
  Search,
  Package,
  RefreshCw,
  Download,
  Trash2,
  DownloadCloud,
  FileText,
  Grid3x3,
  Check,
  Link2,
  Loader2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  personaStoreApi,
  type StorePersona,
  type PersonaStoreListResponse,
  getApiErrorMessage,
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { PinnedPage } from '@/components/layout/PinnedPage';

const PERSONA_PAGE_SIZE = 32;

function storeTabCount(text: string, alert = false) {
  return (
    <span className={cn('tab-segment-count', alert && 'tab-segment-count-alert')}>{text}</span>
  );
}

const GITHUB_REPO_RE = /github\.com[/:]([^/]+)\/([^/.]+)/;
const README_FETCH_TIMEOUT_MS = 8000;

function buildReadmeUrls(persona: StorePersona): string[] {
  const branch = persona.branch || 'main';
  const fallback = branch === 'main' ? 'master' : 'main';
  const match = (persona.link || '').match(GITHUB_REPO_RE);
  if (!match) {
    // 非 GitHub 链接按 Gitea 风格的 /raw/<branch>/ 猜
    return [branch, fallback].map((b) => `${persona.link}/raw/${b}/README.md`);
  }
  const [, owner, repo] = match;
  // 与插件市场同一组候选：直连优先，失败顺序退到代理/国内镜像
  const urls = [branch, fallback].map(
    (b) => `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${b}/README.md`,
  );
  for (const b of [branch, fallback]) {
    urls.push(
      `https://ghproxy.com/https://raw.githubusercontent.com/${owner}/${repo}/${b}/README.md`,
      `https://raw.gitcode.com/${owner}/${repo}/raw/${b}/README.md`,
      `https://cnb.cool/${owner}/${repo}/-/git/raw/${b}/README.md`,
    );
  }
  return urls;
}

export default function PersonaStorePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [storePayload, setStorePayload] = useState<PersonaStoreListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [readmeDialogOpen, setReadmeDialogOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<StorePersona | null>(null);
  const [readmeContent, setReadmeContent] = useState('');
  const [readmeLoading, setReadmeLoading] = useState(false);
  // img 渲染回调走 ref 拿当前人格：components 对象保持稳定引用，避免 README 每次重渲染
  const selectedPersonaRef = useRef<StorePersona | null>(null);
  selectedPersonaRef.current = selectedPersona;

  const [installByUrlOpen, setInstallByUrlOpen] = useState(false);
  const [installByUrlUrl, setInstallByUrlUrl] = useState('');
  const [installByUrlBranch, setInstallByUrlBranch] = useState('');
  const [installByUrlLoading, setInstallByUrlLoading] = useState(false);
  // hasUpdate 只在 check_updates=1 时由后端实时计算；点过一次「检查更新」后
  // 让后续翻页/切 tab/搜索都带着这个标记，否则可更新页签永远刷出空列表
  const [updatesChecked, setUpdatesChecked] = useState(false);

  const fetchPersonas = async (checkUpdates = false) => {
    const withCheck = checkUpdates || updatesChecked;
    try {
      setIsLoading(true);
      const data = await personaStoreApi.getPersonaList({
        tab: activeTab,
        search: appliedSearch || undefined,
        limit: PERSONA_PAGE_SIZE,
        offset: (page - 1) * PERSONA_PAGE_SIZE,
        check_updates: withCheck,
      });
      if (withCheck) setUpdatesChecked(true);
      setStorePayload(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaStore.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    fetchPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, appliedSearch]);

  // README 里相对路径的图片按仓库 raw 地址解析；默认分支加载失败时回退 main/master
  const readmeComponents: Components = useMemo(
    () => ({
      img: ({ src, alt }) => {
        const srcStr = typeof src === 'string' ? src : '';
        const persona = selectedPersonaRef.current;
        const isRelative =
          !!srcStr && !/^(https?:)?\/\//i.test(srcStr) && !srcStr.startsWith('data:');
        const match = isRelative ? (persona?.link || '').match(GITHUB_REPO_RE) : null;
        if (!match) return <img src={srcStr} alt={alt || ''} />;
        const [, owner, repo] = match;
        const branch = persona?.branch || 'main';
        const path = srcStr.replace(/^\.?\//, '');
        return (
          <img
            src={`https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${path}`}
            alt={alt || ''}
            data-fallback={`https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${
              branch === 'main' ? 'master' : 'main'
            }/${path}`}
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.fallbackTried !== '1') {
                el.dataset.fallbackTried = '1';
                el.src = el.dataset.fallback || el.src;
              }
            }}
          />
        );
      },
    }),
    [],
  );

  const patchPersona = (id: string, patch: Partial<StorePersona>) => {
    // counts 是服务端全量计数，按旧→新状态转换补差值，避免徽标数停留在旧值
    setStorePayload((prev) => {
      if (!prev) return prev;
      const old = prev.personas.find((p) => p.id === id);
      if (!old) return prev;
      const next = { ...old, ...patch };
      const installedDelta = Number(next.installed) - Number(old.installed);
      const updatesDelta = Number(next.hasUpdate) - Number(old.hasUpdate);
      return {
        ...prev,
        personas: prev.personas.map((p) => (p.id === id ? next : p)),
        counts: {
          all: prev.counts?.all ?? 0,
          installed: Math.max(0, (prev.counts?.installed ?? 0) + installedDelta),
          updates: Math.max(0, (prev.counts?.updates ?? 0) + updatesDelta),
        },
      };
    });
  };

  const handleInstall = async (persona: StorePersona) => {
    try {
      setActionLoading(persona.id);
      const res = await personaStoreApi.install(persona.id);
      toast.success(t('personaStore.installSuccess'));
      patchPersona(persona.id, {
        installed: true,
        persona_name: res?.persona_name ?? null,
        hasUpdate: false,
        status: 'installed',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaStore.installFailed')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (persona: StorePersona) => {
    const name = persona.persona_name;
    if (!name) return;
    try {
      setActionLoading(persona.id);
      await personaStoreApi.update(name);
      toast.success(t('personaStore.updateSuccess'));
      patchPersona(persona.id, { hasUpdate: false });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaStore.updateFailed')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (persona: StorePersona) => {
    const name = persona.persona_name;
    if (!name) return;
    if (!confirm(t('personaStore.uninstallConfirm', { name }))) return;
    try {
      setActionLoading(persona.id);
      await personaStoreApi.uninstall(name);
      toast.success(t('personaStore.uninstallSuccess'));
      patchPersona(persona.id, {
        installed: false,
        persona_name: null,
        hasUpdate: false,
        status: 'not_installed',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaStore.uninstallFailed')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallByUrl = async () => {
    const url = installByUrlUrl.trim();
    const branch = installByUrlBranch.trim();
    if (!url) {
      toast.error(t('personaStore.urlRequired'));
      return;
    }
    if (!/^(https?:\/\/|ssh:\/\/|git@)/i.test(url)) {
      toast.error(t('personaStore.urlProtocolInvalid'));
      return;
    }
    try {
      setInstallByUrlLoading(true);
      await personaStoreApi.installByUrl(url, branch || undefined);
      toast.success(t('personaStore.installSuccess'));
      setInstallByUrlOpen(false);
      setInstallByUrlUrl('');
      setInstallByUrlBranch('');
      // page 不是 1 时交给 useEffect 按新页刷新；已是 1 时手动刷一次
      setPage(1);
      if (page === 1) await fetchPersonas();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaStore.installFailed')));
    } finally {
      setInstallByUrlLoading(false);
    }
  };

  const handleCardClick = async (persona: StorePersona) => {
    setSelectedPersona(persona);
    setReadmeDialogOpen(true);
    setReadmeLoading(true);
    setReadmeContent('');
    for (const url of buildReadmeUrls(persona)) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(README_FETCH_TIMEOUT_MS) });
        if (response.ok) {
          setReadmeContent(await response.text());
          setReadmeLoading(false);
          return;
        }
      } catch {
        // 候选地址失败换下一个
      }
    }
    setReadmeContent(t('personaStore.noReadme'));
    setReadmeLoading(false);
  };

  const visiblePersonas = useMemo(() => storePayload?.personas ?? [], [storePayload]);
  const storeStats = useMemo(
    () => storePayload?.counts ?? { all: 0, installed: 0, updates: 0 },
    [storePayload],
  );
  const totalPages = Math.max(
    1,
    Math.ceil((storePayload?.count ?? visiblePersonas.length) / PERSONA_PAGE_SIZE),
  );

  const countText = (value: number) => (isLoading ? '—' : String(value));
  const tabOptions = [
    {
      value: 'all',
      label: t('personaStore.allPersonas'),
      icon: <Grid3x3 className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.all)),
    },
    {
      value: 'installed',
      label: t('personaStore.installed'),
      icon: <Check className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.installed)),
    },
    {
      value: 'updates',
      label: t('personaStore.updates'),
      icon: <RefreshCw className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.updates), !isLoading && storeStats.updates > 0),
    },
  ];

  return (
    <PinnedPage
      className="gap-3 md:gap-4"
      header={
        <div className="flex items-start gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1.5 h-8 w-8 shrink-0"
            onClick={() => navigate('/persona-config')}
            title={t('personaStore.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Store className="w-8 h-8 shrink-0" />
              {t('personaStore.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('personaStore.description')}</p>
          </div>
        </div>
      }
      toolbar={
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className={cn(tabToolbarGroupWrapClass, 'min-w-0')}>
            <TabButtonGroup
              options={tabOptions}
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v);
                setPage(1);
              }}
              className="w-full sm:w-auto"
              collapseOnMobile
            />
          </div>
          <div className="relative order-first min-w-0 sm:order-none sm:ml-auto sm:w-64 sm:flex-none lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('personaStore.searchPersona')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(tabToolbarControlClass, 'w-full pl-10')}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => void fetchPersonas(true)}
            className={cn(tabToolbarControlClass, 'w-full gap-2 sm:w-auto')}
          >
            <RefreshCw className="w-4 h-4" />
            {t('personaStore.checkUpdates')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setInstallByUrlOpen(true)}
            className={cn(tabToolbarControlClass, 'w-full gap-2 sm:w-auto')}
          >
            <Link2 className="w-4 h-4" />
            {t('personaStore.installFromUrl')}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="grid gap-3 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="glass-card">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : visiblePersonas.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="!py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">
              {searchQuery
                ? t('personaStore.noMatchedPersonas')
                : activeTab === 'installed'
                  ? t('personaStore.noInstalledPersonas')
                  : activeTab === 'updates'
                    ? t('personaStore.allPersonasUpdated')
                    : t('personaStore.noPersonas')}
            </p>
            {searchQuery && <p className="text-sm">{t('personaStore.adjustSearchKeywords')}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiblePersonas.map((persona) => (
            <Card
              key={persona.id}
              className={`glass-card flex flex-col cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all ${persona.installed ? 'ring-1 ring-green-500/30' : ''}`}
              onClick={() => void handleCardClick(persona)}
            >
              <div className="p-4 pb-2">
                <div className="flex gap-3">
                  <div className="relative flex-shrink-0 self-start">
                    {persona.cover ? (
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border shadow-md bg-background">
                        <img
                          src={persona.cover}
                          alt={persona.id}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-border shadow-md">
                        <User className="w-7 h-7 text-muted-foreground/50" />
                      </div>
                    )}
                    {persona.avatar && (
                      <div className="absolute -bottom-px -right-px">
                        <div className="w-[22px] h-[22px] rounded-full border-2 border-background overflow-hidden bg-background shadow-sm">
                          <img src={persona.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-base truncate">{persona.id}</h3>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0">
                        {persona.installed && (
                          <Badge
                            variant="outline"
                            className="theme-chip theme-chip-tint text-xs font-normal text-green-500 border-green-500"
                          >
                            {t('personaStore.installedBadge')}
                          </Badge>
                        )}
                        {persona.hasUpdate && (
                          <Badge
                            variant="outline"
                            className="theme-chip theme-chip-tint text-xs font-normal text-amber-500 border-amber-500"
                          >
                            {t('personaStore.canUpdate')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p
                      className="text-sm text-muted-foreground mt-1 truncate"
                      title={persona.info || persona.description}
                    >
                      {persona.info || persona.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {persona.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="theme-chip shrink-0 text-xs font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <CardFooter className="mt-auto p-4 pt-2 sm:p-4 sm:pt-2">
                {persona.installed ? (
                  <div className="flex gap-1.5 w-full">
                    {persona.hasUpdate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs text-primary hover:text-primary [&_svg]:!text-current"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUpdate(persona);
                        }}
                        disabled={actionLoading === persona.id}
                      >
                        {actionLoading === persona.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        {t('personaStore.update')}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-xs text-destructive hover:text-destructive [&_svg]:!text-current"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUninstall(persona);
                      }}
                      disabled={actionLoading === persona.id}
                    >
                      {actionLoading === persona.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      {t('personaStore.uninstall')}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" asChild>
                      <a
                        href={persona.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DownloadCloud className="w-3 h-3" />
                        {t('personaStore.details')}
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1.5 w-full">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-xs text-primary hover:text-primary [&_svg]:!text-current"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleInstall(persona);
                      }}
                      disabled={actionLoading === persona.id}
                    >
                      {actionLoading === persona.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {t('personaStore.install')}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" asChild>
                      <a
                        href={persona.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DownloadCloud className="w-3 h-3" />
                        {t('personaStore.details')}
                      </a>
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && !isLoading && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">
            {t('personaStore.pagination.label', { total: storePayload?.count ?? 0 })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('personaStore.pagination.prev')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('personaStore.pagination.page', { current: page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t('personaStore.pagination.next')}
          </Button>
        </div>
      )}

      {/* README 预览 */}
      <Dialog open={readmeDialogOpen} onOpenChange={setReadmeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedPersona?.id}
            </DialogTitle>
            <DialogDescription>
              {selectedPersona?.link || selectedPersona?.info || ''}
            </DialogDescription>
          </DialogHeader>
          {readmeLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
                components={readmeComponents}
              >
                {readmeContent}
              </ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 从 URL 导入 */}
      <Dialog open={installByUrlOpen} onOpenChange={setInstallByUrlOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('personaStore.installFromUrlTitle')}</DialogTitle>
            <DialogDescription>{t('personaStore.installFromUrlDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="persona-repo-url">{t('personaStore.repoUrl')}</Label>
              <Input
                id="persona-repo-url"
                placeholder="https://github.com/owner/persona_repo"
                value={installByUrlUrl}
                onChange={(e) => setInstallByUrlUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="persona-repo-branch">{t('personaStore.repoBranch')}</Label>
              <Input
                id="persona-repo-branch"
                placeholder="main"
                value={installByUrlBranch}
                onChange={(e) => setInstallByUrlBranch(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInstallByUrlOpen(false)}
              disabled={installByUrlLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleInstallByUrl()} disabled={installByUrlLoading}>
              {installByUrlLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('personaStore.install')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
