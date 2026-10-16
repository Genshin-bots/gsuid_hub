/**
 * /ai-artifacts —— AI 产出物与工具落盘（合并页）
 *
 * 原 /ai-artifacts 与 /ai-tool-outputs 合并：页面壳（标题 / 页签 / 常驻筛选行）只有一份，
 * 两个数据面板按 TabButtonGroup 页签切换。两块内容同属「Agent 产物落盘」，
 * 但后端不同（artifacts_api.py / tool_outputs_api.py），字段与操作也不同，因此保持两块面板而不是一张混合表。
 *
 * 页签走 `?tab=`（toolOutputs），因此：
 * - 侧边栏只有一个入口（/ai-artifacts），pathname 不变，展开态侧栏高亮稳定；
 * - /ai-tool-outputs 旧深链重定向过来，cognition.ts 的 to_ / sa_ 跳转仍落在工具落盘页签；
 * - 分享 / 刷新 URL 能回到同一个页签。
 */
import { useCallback, useEffect, useState } from 'react';
import { FileSearch, PackageOpen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { useLanguage } from '@/contexts/LanguageContext';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  TabButtonGroup,
  type TabButtonOption,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import { aiToolOutputsApi } from '@/lib/api';
import {
  ArtifactsFilters,
  ArtifactsPanel,
  type ArtifactsPanelProps,
} from './AIOutputs/ArtifactsPanel';
import {
  ToolOutputsFilters,
  ToolOutputsPanel,
  type ToolOutputsPanelProps,
} from './AIOutputs/ToolOutputsPanel';
import { TOOL_ALL } from './AIOutputs/constants';

const TAB_OUTPUTS = 'toolOutputs';

export default function AIOutputsPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  // 产出物是默认页签，URL 保持干净；只有切到工具落盘才带 ?tab=
  const tab = searchParams.get('tab') === TAB_OUTPUTS ? TAB_OUTPUTS : 'artifacts';
  const changeTab = useCallback(
    (value: string) => {
      setSearchParams(value === TAB_OUTPUTS ? { tab: TAB_OUTPUTS } : {}, { replace: true });
    },
    [setSearchParams],
  );

  // ── 产出物面板的筛选状态（筛选行在常驻区，故提升到这里） ──────────────
  const [rootTaskId, setRootTaskId] = useState('');
  const [useAll, setUseAll] = useState(true);
  const [artifactsExpired, setArtifactsExpired] = useState(false);
  const [artifactsRefreshKey, setArtifactsRefreshKey] = useState(0);

  const bumpArtifactsRefresh = useCallback(() => setArtifactsRefreshKey((k) => k + 1), []);
  const changeUseAll = useCallback((next: boolean) => {
    setUseAll(next);
    // 切回「全部」时清掉已填的 root_task_id，避免「按 ID 过滤」残留文案干扰
    if (next) setRootTaskId('');
  }, []);

  // ── 工具落盘面板的筛选状态 ───────────────────────────────────────────
  const [keyword, setKeyword] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [toolName, setToolName] = useState(TOOL_ALL);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [outputsExpired, setOutputsExpired] = useState(false);
  const [outputsOffset, setOutputsOffset] = useState(0);
  const [outputsRefreshKey, setOutputsRefreshKey] = useState(0);

  const bumpOutputsRefresh = useCallback(() => setOutputsRefreshKey((k) => k + 1), []);

  useEffect(() => {
    (async () => {
      try {
        const res = await aiToolOutputsApi.toolNames();
        setToolNames(res.tool_names ?? []);
      } catch {
        // 后端未升级时忽略
      }
    })();
  }, []);

  /** 回车 / 「查询」：回到第一页并重新提交关键词（词没变时靠 refreshKey 仍会重查） */
  const submitToolOutputsSearch = useCallback(() => {
    setOutputsOffset(0);
    setKeyword(keywordDraft.trim());
    bumpOutputsRefresh();
  }, [keywordDraft, bumpOutputsRefresh]);

  const artifactsProps: ArtifactsPanelProps = {
    rootTaskId,
    onRootTaskIdChange: setRootTaskId,
    useAll,
    onUseAllChange: changeUseAll,
    includeExpired: artifactsExpired,
    onIncludeExpiredChange: setArtifactsExpired,
    refreshKey: artifactsRefreshKey,
    onRefresh: bumpArtifactsRefresh,
  };

  const toolOutputsProps: ToolOutputsPanelProps = {
    keyword,
    keywordDraft,
    onKeywordDraftChange: setKeywordDraft,
    onSearch: submitToolOutputsSearch,
    toolName,
    onToolNameChange: (value) => {
      setToolName(value);
      setOutputsOffset(0);
    },
    toolNames,
    includeExpired: outputsExpired,
    onIncludeExpiredChange: (value) => {
      setOutputsExpired(value);
      setOutputsOffset(0);
    },
    offset: outputsOffset,
    onOffsetChange: setOutputsOffset,
    refreshKey: outputsRefreshKey,
    onRefresh: bumpOutputsRefresh,
  };

  const tabOptions: TabButtonOption[] = [
    {
      value: 'artifacts',
      label: t('aiArtifacts.title'),
      icon: <PackageOpen className="h-4 w-4" />,
    },
    {
      value: 'toolOutputs',
      label: t('aiToolOutputs.title'),
      icon: <FileSearch className="h-4 w-4" />,
    },
  ];

  return (
    <PinnedPage
      className="gap-4"
      header={
        <div className="min-w-0">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PackageOpen className="w-8 h-8 shrink-0" />
            {t('aiOutputs.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiOutputs.description')}</p>
        </div>
      }
      toolbar={
        /* 两行控件行：页签一行（连同刷新等操作留给面板内的卡片头），
           当前页签的筛选行一行。窄屏各自换行，不横滑。 */
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 max-w-full items-center">
            <div className={tabToolbarGroupWrapClass}>
              <TabButtonGroup
                options={tabOptions}
                value={tab}
                onValueChange={changeTab}
                className="shrink-0"
              />
            </div>
          </div>
          {tab === 'artifacts' ? (
            <ArtifactsFilters {...artifactsProps} />
          ) : (
            <ToolOutputsFilters {...toolOutputsProps} />
          )}
        </div>
      }
    >
      {tab === 'artifacts' ? (
        <ArtifactsPanel {...artifactsProps} />
      ) : (
        <ToolOutputsPanel {...toolOutputsProps} />
      )}
    </PinnedPage>
  );
}
