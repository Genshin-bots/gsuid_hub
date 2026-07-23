/**
 * Group profile browser (state_store scope __gscore_group_profile__).
 * Read + delete only (state-store has no write API).
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { aiStateStoreApi, getApiErrorMessage, type AIStateStoreKeyItem } from '@/lib/api';
import { GROUP_PROFILE_STATE_SCOPE, normalizeGroupProfile } from '@/lib/featureUtils';

export default function GroupProfilePage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const [keys, setKeys] = useState<AIStateStoreKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [profile, setProfile] = useState<ReturnType<typeof normalizeGroupProfile> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiStateStoreApi.getKeys({
        scope: GROUP_PROFILE_STATE_SCOPE,
      });
      setKeys(data.items ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('groupProfile.loadFailed')));
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const loadDetail = async (stateKey: string) => {
    setSelectedKey(stateKey);
    setDetailLoading(true);
    try {
      const data = await aiStateStoreApi.getValue({
        scope: GROUP_PROFILE_STATE_SCOPE,
        state_key: stateKey,
      });
      setProfile(normalizeGroupProfile(data.value, stateKey));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('groupProfile.loadDetailFailed')));
      setProfile(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Users className="w-8 h-8 shrink-0" />
              {t('groupProfile.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">
              {t('groupProfile.description')}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-9 whitespace-nowrap self-end sm:self-auto"
            onClick={() => void loadKeys()}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={cn('lg:col-span-1', isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              {t('groupProfile.scopes')} ({keys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="space-y-1 pr-2">
                  {keys.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('groupProfile.empty')}</p>
                  )}
                  {keys.map((k) => (
                    <button
                      key={k.state_key}
                      type="button"
                      className={cn(
                        'w-full text-left rounded-md px-2 py-2 text-sm hover:bg-primary/10 transition',
                        selectedKey === k.state_key && 'bg-primary/15 text-primary font-medium',
                      )}
                      onClick={() => void loadDetail(k.state_key)}
                    >
                      <div className="truncate">{k.state_key}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {k.size_bytes} B
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className={cn('lg:col-span-2', isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{selectedKey ?? t('groupProfile.selectHint')}</CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </div>
            )}
            {!detailLoading && profile && (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  {t('groupProfile.lastUpdated')}: {profile.last_updated || '—'}
                </p>
                <section>
                  <h4 className="font-medium mb-2">{t('groupProfile.tags')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(profile.tag_counts).length === 0 && '—'}
                    {Object.entries(profile.tag_counts)
                      .sort((a, b) => Number(b[1]) - Number(a[1]))
                      .map(([tag, n]) => (
                        <Badge key={tag} variant="secondary">
                          {tag} × {n}
                        </Badge>
                      ))}
                  </div>
                </section>
                <section>
                  <h4 className="font-medium mb-2">{t('groupProfile.termMappings')}</h4>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {Object.entries(profile.term_mappings).length === 0 && (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {Object.entries(profile.term_mappings).map(([alias, formal]) => (
                      <div key={alias} className="flex gap-2">
                        <Badge variant="outline">{alias}</Badge>
                        <span>→</span>
                        <span>{formal}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h4 className="font-medium mb-2">{t('groupProfile.memberAliases')}</h4>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {Object.entries(profile.member_alias_ids).length === 0 && (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {Object.entries(profile.member_alias_ids).map(([alias, ids]) => (
                      <div key={alias} className="flex flex-wrap gap-1 items-center">
                        <Badge variant="outline">{alias}</Badge>
                        {ids.map((id) => (
                          <span key={id} className="text-xs text-muted-foreground">
                            {id}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
            {!detailLoading && !profile && selectedKey == null && (
              <p className="text-sm text-muted-foreground">{t('groupProfile.selectHint')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PinnedPage>
  );
}
