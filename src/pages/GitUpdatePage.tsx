import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
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
  GitBranch,
  RefreshCw,
  RotateCcw,
  Download,
  GitCommit,
  User,
  Calendar,
  ArrowDownToLine,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Cog,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  gitUpdateApi,
  pluginsApi,
  GitPluginStatus,
  GitCommitInfo,
  GitCommitListResponse,
  PluginListItem,
} from '@/lib/api';

const PAGE_SIZE = 20;

// Memoized commit card for mobile
const CommitCard = memo(function CommitCard({
  commit,
  isCurrent,
  isCheckingOut,
  onCheckout,
  t,
}: {
  commit: GitCommitInfo;
  isCurrent: boolean;
  isCheckingOut: boolean;
  onCheckout: (commit: GitCommitInfo) => void;
  t: (key: string) => string;
}) {
  return (
    <Card className={`glass-card ${isCurrent ? 'border-primary/50 bg-primary/5' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Badge
              variant={isCurrent ? 'default' : 'outline'}
              className="font-mono text-xs whitespace-nowrap shrink-0"
            >
              {commit.short_hash}
            </Badge>
            {isCurrent && (
              <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                {t('gitUpdate.currentVersion')}
              </Badge>
            )}
          </div>
          {!isCurrent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCheckout(commit)}
              disabled={isCheckingOut}
              className="gap-1 text-xs h-7 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              {t('gitUpdate.checkoutToVersion')}
            </Button>
          )}
        </div>
        <p className="text-sm font-medium break-all">{commit.message}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {commit.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {commit.date}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

// Memoized commit row for desktop
const CommitRow = memo(function CommitRow({
  commit,
  isCurrent,
  isCheckingOut,
  onCheckout,
  t,
}: {
  commit: GitCommitInfo;
  isCurrent: boolean;
  isCheckingOut: boolean;
  onCheckout: (commit: GitCommitInfo) => void;
  t: (key: string) => string;
}) {
  return (
    <tr className={`border-b border-border/50 ${isCurrent ? 'bg-primary/5' : ''}`}>
      <td className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={isCurrent ? 'default' : 'outline'}
            className="font-mono text-xs whitespace-nowrap"
          >
            {commit.short_hash}
          </Badge>
          {isCurrent && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {t('gitUpdate.currentVersion')}
            </Badge>
          )}
        </div>
      </td>
      <td className="p-3 max-w-[400px] truncate">{commit.message}</td>
      <td className="p-3 text-muted-foreground whitespace-nowrap">{commit.author}</td>
      <td className="p-3 text-muted-foreground text-sm whitespace-nowrap">{commit.date}</td>
      <td className="p-3 text-right">
        {!isCurrent && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCheckout(commit)}
            disabled={isCheckingOut}
            className="gap-1 whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            {t('gitUpdate.checkoutToVersion')}
          </Button>
        )}
      </td>
    </tr>
  );
});

export default function GitUpdatePage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const isMobile = useIsMobile();

  // State
  const [plugins, setPlugins] = useState<GitPluginStatus[]>([]);
  const [pluginIcons, setPluginIcons] = useState<Record<string, string>>({});
  const [selectedPlugin, setSelectedPlugin] = useState<string>('');
  const [commitsData, setCommitsData] = useState<GitCommitListResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isForceUpdating, setIsForceUpdating] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Use ref to track selected plugin without causing re-renders in callbacks
  const selectedPluginRef = useRef(selectedPlugin);
  selectedPluginRef.current = selectedPlugin;

  // Dialog state
  const [checkoutDialog, setCheckoutDialog] = useState<{
    open: boolean;
    commit: GitCommitInfo | null;
  }>({ open: false, commit: null });
  const [forceUpdateDialog, setForceUpdateDialog] = useState(false);

  // Fetch all plugin statuses + icons (runs once on mount)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoadingStatus(true);
        const [statusData, pluginList] = await Promise.all([
          gitUpdateApi.getStatus(),
          pluginsApi.getPluginList().catch(() => [] as PluginListItem[]),
        ]);

        if (cancelled) return;

        const gitPlugins = statusData.filter(p => p.is_git_repo);
        setPlugins(gitPlugins);

        // Build icon map from plugin list
        const iconMap: Record<string, string> = {};
        pluginList.forEach((p: PluginListItem) => {
          if (p.icon) iconMap[p.id.toLowerCase()] = p.icon;
        });
        setPluginIcons(iconMap);

        // Set default selection
        if (gitPlugins.length > 0) {
          const core = gitPlugins.find(p => p.name.toLowerCase() === 'gsuid_core');
          setSelectedPlugin(core ? core.name : gitPlugins[0].name);
        }
      } catch (error) {
        console.error('Failed to fetch git status:', error);
        if (!cancelled) {
          toast({
            title: t('common.error'),
            description: t('gitUpdate.loadStatusFailed'),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsLoadingStatus(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []); // Only run once on mount

  // Fetch commits when plugin changes
  useEffect(() => {
    if (!selectedPlugin) return;
    let cancelled = false;

    async function loadCommits() {
      try {
        setIsLoadingCommits(true);
        setDisplayCount(PAGE_SIZE);
        const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
        if (!cancelled) setCommitsData(data);
      } catch (error) {
        console.error('Failed to fetch commits:', error);
        if (!cancelled) {
          toast({
            title: t('common.error'),
            description: t('gitUpdate.loadCommitsFailed'),
            variant: 'destructive',
          });
          setCommitsData(null);
        }
      } finally {
        if (!cancelled) setIsLoadingCommits(false);
      }
    }

    loadCommits();
    return () => { cancelled = true; };
  }, [selectedPlugin]); // Only depends on selectedPlugin

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const statusData = await gitUpdateApi.getStatus();
      const gitPlugins = statusData.filter(p => p.is_git_repo);
      setPlugins(gitPlugins);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoadingStatus(false);
    }
    // Also refresh commits for current plugin
    if (selectedPluginRef.current) {
      try {
        setIsLoadingCommits(true);
        setDisplayCount(PAGE_SIZE);
        const data = await gitUpdateApi.getRemoteCommits(selectedPluginRef.current);
        setCommitsData(data);
      } catch (error) {
        console.error('Failed to refresh commits:', error);
      } finally {
        setIsLoadingCommits(false);
      }
    }
  }, [t, toast]);

  // Handle checkout
  const handleCheckout = async () => {
    if (!checkoutDialog.commit || !selectedPlugin) return;
    try {
      setIsCheckingOut(true);
      await gitUpdateApi.checkout(selectedPlugin, checkoutDialog.commit.short_hash);
      toast({
        title: t('common.success'),
        description: t('gitUpdate.checkoutSuccess', { hash: checkoutDialog.commit.short_hash }),
      });
      // Refresh commits
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
    } catch (error) {
      console.error('Checkout failed:', error);
      toast({
        title: t('common.error'),
        description: t('gitUpdate.checkoutFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
      setCheckoutDialog({ open: false, commit: null });
    }
  };

  // Handle force update
  const handleForceUpdate = async () => {
    if (!selectedPlugin) return;
    try {
      setIsForceUpdating(true);
      const result = await gitUpdateApi.forceUpdate(selectedPlugin);
      toast({
        title: t('common.success'),
        description: t('gitUpdate.forceUpdateSuccess', {
          hash: result.current_commit?.short_hash || '',
        }),
      });
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
    } catch (error) {
      console.error('Force update failed:', error);
      toast({
        title: t('common.error'),
        description: t('gitUpdate.forceUpdateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsForceUpdating(false);
      setForceUpdateDialog(false);
    }
  };

  // Get current plugin status
  const currentPlugin = plugins.find(p => p.name === selectedPlugin);

  // Format plugin display name
  const getPluginDisplayName = (name: string) => {
    return name.toLowerCase() === 'gsuid_core' ? t('gitUpdate.core') : name;
  };

  // Paginated commits
  const allCommits = commitsData?.commits || [];
  const displayedCommits = allCommits.slice(0, displayCount);
  const hasMore = displayCount < allCommits.length;

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, allCommits.length));
  }, [allCommits.length]);

  const handleCheckoutClick = useCallback((commit: GitCommitInfo) => {
    setCheckoutDialog({ open: true, commit });
  }, []);

  return (
    <div className="space-y-4 flex-1 overflow-hidden p-4 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <GitBranch className="w-7 h-7 sm:w-8 sm:h-8" />
            {t('gitUpdate.title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('gitUpdate.description')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoadingStatus || isLoadingCommits}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoadingStatus || isLoadingCommits) ? 'animate-spin' : ''}`} />
          {t('gitUpdate.refresh')}
        </Button>
      </div>

      {/* Plugin Selector - TabButtonGroup style */}
      {isLoadingStatus ? (
        <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg border border-border/40">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
      ) : (
        <TabButtonGroup
          options={plugins.map(plugin => ({
            value: plugin.name,
            label: getPluginDisplayName(plugin.name),
            icon: pluginIcons[plugin.name.toLowerCase()] ? (
              <img src={pluginIcons[plugin.name.toLowerCase()]} className="w-4 h-4 rounded-sm" alt="" />
            ) : (
              <Cog className="w-4 h-4" />
            ),
          }))}
          value={selectedPlugin}
          onValueChange={setSelectedPlugin}
          glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
        />
      )}

      {/* Current Status */}
      {currentPlugin && currentPlugin.current_commit && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {t('gitUpdate.currentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{t('gitUpdate.branch')}:</span>
                <Badge variant="secondary" className="whitespace-nowrap">{currentPlugin.branch}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{t('gitUpdate.commit')}:</span>
                <Badge variant="outline" className="font-mono whitespace-nowrap">
                  {currentPlugin.current_commit.short_hash}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{t('gitUpdate.author')}:</span>
                <span className="text-sm truncate">{currentPlugin.current_commit.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{t('gitUpdate.date')}:</span>
                <span className="text-sm truncate">{currentPlugin.current_commit.date}</span>
              </div>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <span className="text-sm text-muted-foreground shrink-0">{t('gitUpdate.message')}:</span>
              <span className="text-sm">{currentPlugin.current_commit.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit List */}
      <Card className="glass-card flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            {t('gitUpdate.remoteCommits')}
          </CardTitle>
          <CardDescription>
            {t('gitUpdate.detachedHeadWarning')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden p-0 sm:px-6 sm:pb-6">
          {isLoadingCommits ? (
            <div className="space-y-3 p-4 sm:p-0">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : !commitsData || allCommits.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground p-4">
              <GitCommit className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('gitUpdate.noCommits')}</p>
            </div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="h-full overflow-y-auto">
              <div className="space-y-3 p-4">
                {displayedCommits.map((commit) => (
                  <CommitCard
                    key={commit.hash}
                    commit={commit}
                    isCurrent={commit.hash === commitsData.current_hash}
                    isCheckingOut={isCheckingOut}
                    onCheckout={handleCheckoutClick}
                    t={t}
                  />
                ))}
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      className="gap-2"
                    >
                      <ChevronDown className="w-4 h-4" />
                      {t('gitUpdate.loadMore')} ({displayCount}/{allCommits.length})
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Desktop: Table layout */
            <div className="h-full overflow-y-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b border-border/50">
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-28 whitespace-nowrap">{t('gitUpdate.commit')}</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('gitUpdate.message')}</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-28 whitespace-nowrap">{t('gitUpdate.author')}</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-44 whitespace-nowrap">{t('gitUpdate.date')}</th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground w-32 whitespace-nowrap">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCommits.map((commit) => (
                    <CommitRow
                      key={commit.hash}
                      commit={commit}
                      isCurrent={commit.hash === commitsData.current_hash}
                      isCheckingOut={isCheckingOut}
                      onCheckout={handleCheckoutClick}
                      t={t}
                    />
                  ))}
                  {hasMore && (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        <Button
                          variant="outline"
                          onClick={handleLoadMore}
                          className="gap-2"
                        >
                          <ChevronDown className="w-4 h-4" />
                          {t('gitUpdate.loadMore')} ({displayCount}/{allCommits.length})
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Force Update Button */}
      <div className="flex justify-center sm:justify-end">
        <Button
          variant="destructive"
          onClick={() => setForceUpdateDialog(true)}
          disabled={isForceUpdating || !selectedPlugin || isLoadingStatus}
          className="gap-2 w-full sm:w-auto"
        >
          <Download className={`w-4 h-4 ${isForceUpdating ? 'animate-spin' : ''}`} />
          {t('gitUpdate.forceUpdate')}
        </Button>
      </div>

      {/* Checkout Confirmation Dialog */}
      <AlertDialog
        open={checkoutDialog.open}
        onOpenChange={(open) => {
          if (!open) setCheckoutDialog({ open: false, commit: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              {t('gitUpdate.checkoutConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('gitUpdate.checkoutConfirmDesc', {
                plugin: getPluginDisplayName(selectedPlugin),
                hash: checkoutDialog.commit?.short_hash || '',
                message: checkoutDialog.commit?.message || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCheckingOut}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCheckingOut ? t('gitUpdate.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force Update Confirmation Dialog */}
      <AlertDialog open={forceUpdateDialog} onOpenChange={setForceUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('gitUpdate.forceUpdateConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('gitUpdate.forceUpdateConfirmDesc', {
                plugin: getPluginDisplayName(selectedPlugin),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isForceUpdating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceUpdate}
              disabled={isForceUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isForceUpdating ? t('gitUpdate.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
