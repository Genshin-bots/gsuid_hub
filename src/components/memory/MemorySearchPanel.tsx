/**
 * Dual-route memory search playground (POST /api/ai/memory/search).
 */
import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getApiErrorMessage, memoryApi, type MemorySearchResponse } from '@/lib/api';
import { validateMemorySearchInput } from '@/lib/featureUtils';

export default function MemorySearchPanel() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('');
  const [userId, setUserId] = useState('');
  const [topK, setTopK] = useState(10);
  const [enableSystem2, setEnableSystem2] = useState(true);
  const [enableUserGlobal, setEnableUserGlobal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MemorySearchResponse | null>(null);

  const onSearch = async () => {
    const v = validateMemorySearchInput({ query, groupId, topK });
    if (v.ok === false) {
      toast.error(t(`aiMemory.search.errors.${v.error}`));
      return;
    }
    setLoading(true);
    try {
      const data = await memoryApi.search({
        query: query.trim(),
        group_id: groupId.trim(),
        user_id: userId.trim() || null,
        top_k: topK,
        enable_system2: enableSystem2,
        enable_user_global: enableUserGlobal,
      });
      setResult(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiMemory.search.failed')));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            {t('aiMemory.search.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>{t('aiMemory.search.query')}</Label>
              <Input
                className="h-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('aiMemory.search.queryPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('aiMemory.search.groupId')}</Label>
              <Input
                className="h-9"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder="789012"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('aiMemory.search.userId')}</Label>
              <Input
                className="h-9"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={t('aiMemory.search.userIdOptional')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('aiMemory.search.topK')}</Label>
              <Input
                className="h-9"
                type="number"
                min={1}
                max={50}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value) || 10)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="mem-search-s2"
                  checked={enableSystem2}
                  onCheckedChange={setEnableSystem2}
                />
                <Label htmlFor="mem-search-s2">System-2</Label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="mem-search-ug"
                  checked={enableUserGlobal}
                  onCheckedChange={setEnableUserGlobal}
                />
                <Label htmlFor="mem-search-ug">user_global</Label>
              </div>
            </div>
          </div>
          <Button className="h-9" onClick={onSearch} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {t('aiMemory.search.run')}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ResultColumn
            title={`${t('aiMemory.search.episodes')} (${result.episodes?.length ?? 0})`}
            items={(result.episodes ?? []).map((e) => ({
              id: String(e.id ?? ''),
              primary: String(e.content ?? ''),
              score: e.score,
            }))}
          />
          <ResultColumn
            title={`${t('aiMemory.search.entities')} (${result.entities?.length ?? 0})`}
            items={(result.entities ?? []).map((e) => ({
              id: String(e.id ?? ''),
              primary: String(e.name ?? e.summary ?? ''),
              secondary: e.summary ? String(e.summary) : undefined,
              score: e.score,
            }))}
          />
          <ResultColumn
            title={`${t('aiMemory.search.edges')} (${result.edges?.length ?? 0})`}
            items={(result.edges ?? []).map((e) => ({
              id: String(e.id ?? ''),
              primary: String(e.fact ?? ''),
              score: e.score,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function ResultColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; primary: string; secondary?: string; score?: number }>;
}) {
  return (
    <Card className="border border-border/50">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-2">
            {items.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            {items.map((item, i) => (
              <div
                key={item.id || i}
                className="rounded-md border border-border/40 p-2 text-sm space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-4 whitespace-pre-wrap break-words flex-1">
                    {item.primary || '—'}
                  </p>
                  {item.score != null && (
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {Number(item.score).toFixed(3)}
                    </Badge>
                  )}
                </div>
                {item.secondary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.secondary}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
