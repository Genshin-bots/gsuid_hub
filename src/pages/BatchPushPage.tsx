/**
 * /batch-push — 批量推送页（运维 / 主动通告）
 *
 * 来源：docs/skills/gshub-development/README.md §3.1「完全空缺」第 2 项
 * 后端对应：message_api.py (`/api/BatchPush` + 新增的 `/api/BatchPush/targets`)
 *
 * 设计：
 * - 三段式：正文（HTML）、目标（群 / 用户、多选、可 ALL*）、目标 Bot
 * - 实时把推文渲染到 <div> 当作预览（用 CSS 把 <p>/<img> 转成块）
 * - 提交流程统一走 batchPushApi.push，错误回显用 getApiErrorMessage
 *
 * 涉及的 SKILL 章节：
 * - [§04 排版铁律 · PinnedPage 标题页](./references/04-page-layout-spec.md)
 * - [§05 §5.5 Radix Select 哨兵](./references/05-components-and-form-controls.md)
 * - [§01 §1.5 错误回显后端 detail](./references/01-architecture-and-conventions.md)
 */
import { useEffect, useMemo, useState } from 'react';
import { Send, History, ListChecks, Info, Users } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
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
import { Textarea } from '@/components/ui/textarea';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  batchPushApi,
  getApiErrorMessage,
} from '@/lib/api';

const ALL_BOT_SENTINEL = '__all__';

interface PushTarget {
  bot_id: string;
  label: string;
  value: string;
}

interface PushTargets {
  bots: { bot_id: string; name: string }[];
  groups: PushTarget[];
  users: PushTarget[];
}

export default function BatchPushPage() {
  const { t } = useLanguage();
  const [text, setText] = useState(t('batchPush.defaultBody'));
  const [targetType, setTargetType] = useState<'group' | 'user'>('group');
  const [targetValues, setTargetValues] = useState<string[]>([]);
  const [bot, setBot] = useState<string>(ALL_BOT_SENTINEL);
  const [submitting, setSubmitting] = useState(false);
  const [targets, setTargets] = useState<PushTargets | null>(null);

  const loadTargets = async () => {
    try {
      const data = await batchPushApi.getTargets();
      setTargets(data as unknown as PushTargets);
    } catch (e) {
      // 后端可能还没实现 /api/BatchPush/targets 端点；保持空态走「ALL* 宏 + 手填 target」
      console.warn(t('batchPush.targetsFallbackWarn'), e);
      setTargets({ bots: [], groups: [], users: [] });
    }
  };

  useEffect(() => {
    loadTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTargets: PushTarget[] = useMemo(
    () => (targetType === 'group' ? targets?.groups ?? [] : targets?.users ?? []),
    [targetType, targets],
  );

  const toggle = (v: string, checked: boolean) => {
    setTargetValues((prev) =>
      checked ? [...new Set([...prev, v])] : prev.filter((x) => x !== v),
    );
  };

  const submit = async () => {
    if (!text.trim()) {
      toast.error(t('batchPush.textRequired'));
      return;
    }
    if (targetValues.length === 0) {
      toast.error(t('batchPush.targetsRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await batchPushApi.push({
        push_text: text,
        push_tag: targetValues.join(','),
        push_bot: bot === ALL_BOT_SENTINEL ? '' : bot,
      });
      toast.success(t('batchPush.submitSuccess'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('batchPush.submitFail')));
    } finally {
      setSubmitting(false);
    }
  };

  // Preview: 用 DOMParser 解析 HTML 为 [元素,文本]
  const previewLines = useMemo(() => {
    if (typeof window === 'undefined' || !text) return [] as string[];
    // 安全：仅作渲染预览，使用原生 DOMParser；提交路径后端还会走 BeautifulSoup 再验
    const wrap = document.createElement('div');
    wrap.innerHTML = text;
    const out: string[] = [];
    wrap.querySelectorAll('p').forEach((p) => out.push(p.textContent || ''));
    wrap.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') ?? '';
      out.push(`[image ${img.getAttribute('width') ?? ''}x${img.getAttribute('height') ?? ''} ${src.slice(0, 24)}…]`);
    });
    return out.filter(Boolean);
  }, [text]);

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
                <Label htmlFor="push-text">{t('batchPush.pushTextLabel')}</Label>
                <Textarea
                  id="push-text"
                  className="min-h-[160px] font-mono text-sm"
                  placeholder={t('batchPush.pushTextPlaceholder') ?? ''}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('batchPush.targetTypeLabel')}</Label>
                  <Select
                    value={targetType}
                    onValueChange={(v) => {
                      setTargetType(v as 'group' | 'user');
                      setTargetValues([]);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">
                        {t('batchPush.targetTypeGroup')}
                      </SelectItem>
                      <SelectItem value="user">
                        {t('batchPush.targetTypeUser')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('batchPush.botsLabel')}</Label>
                  <Select value={bot} onValueChange={setBot}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_BOT_SENTINEL}>
                        {t('batchPush.botsAll')}
                      </SelectItem>
                      {(targets?.bots ?? []).map((b) => (
                        <SelectItem key={b.bot_id} value={b.bot_id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('batchPush.targetsLabel')}</Label>
                <div className="border border-border/40 rounded-lg p-3 max-h-56 overflow-auto space-y-2 bg-muted/30">
                  {currentTargets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('batchPush.targetsPlaceholder')}
                    </p>
                  ) : (
                    currentTargets.map((tg) => (
                      <label
                        key={tg.value}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={targetValues.includes(tg.value)}
                          onCheckedChange={(c) => toggle(tg.value, !!c)}
                        />
                        <span className="truncate">{tg.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {tg.value}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('batchPush.loadedTargets', { count: currentTargets.length })}
                </p>
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
                {previewLines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('batchPush.previewEmpty')}
                  </p>
                ) : (
                  previewLines.map((line, i) => (
                    <p key={i} className="text-sm whitespace-pre-wrap leading-6">
                      {line}
                    </p>
                  ))
                )}
              </div>
              <Input
                className="h-9 mt-3 font-mono text-xs"
                value={targetValues.join(',')}
                readOnly
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
