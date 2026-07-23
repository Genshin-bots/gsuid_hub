import fs from 'node:fs';
import path from 'node:path';

const locales = ['zh-CN', 'en-US', 'ja-JP'];
const packs = {
  'zh-CN': {
    sidebar: { stateStore: '状态存储', groupProfile: '群组画像' },
    stateStore: {
      title: '状态存储',
      description: '浏览与清理 AI 持久状态（state_store），支持 scope/key 查看与批量删除',
      batchDelete: '批量删除',
    },
    groupProfile: {
      title: '群组画像',
      description: '查看 state_store 中的群语境标签、词汇映射与成员称呼（只读）',
      scopes: '群 scope 列表',
      empty: '暂无群画像数据',
      selectHint: '选择左侧群组查看详情',
      lastUpdated: '上次更新',
      tags: '语境标签',
      termMappings: '词汇映射',
      memberAliases: '成员称呼',
      loadFailed: '加载群画像列表失败',
      loadDetailFailed: '加载群画像详情失败',
    },
    memorySettings: {
      fields: {
        batchIntervalSeconds: '批处理间隔(秒)',
        idleFlushSeconds: '静默落库(秒)',
        llmSemaphoreLimit: 'LLM 并发上限',
        observerBlacklist: 'Observer 黑名单群',
        observerBlacklistPlaceholder: '输入群 ID 后回车',
        enablePreferenceMemory: '偏好记忆',
        enableFamiliarityRouting: 'RF-Mem 熟悉度路由',
        enableRecollectionPath: 'RF-Mem 回忆路径',
      },
      readonlyHint:
        '以下项来自 MEMORY_CONFIG 框架配置，此处只读展示；请在「框架配置」中修改。',
    },
    aiMemory: {
      tabSearch: '检索试跑',
      search: {
        title: '双路检索试跑',
        query: '查询文本',
        queryPlaceholder: '输入要检索的记忆内容…',
        groupId: '群组 ID',
        userId: '用户 ID',
        userIdOptional: '可选',
        topK: 'top_k',
        run: '执行检索',
        failed: '检索失败',
        episodes: 'Episodes',
        entities: 'Entities',
        edges: 'Edges',
        errors: {
          empty_query: '请输入查询文本',
          empty_group: '请输入群组 ID',
          bad_top_k: 'top_k 需在 1–50',
        },
      },
    },
    aiTools: {
      diagnostics: '诊断',
      issuesOnly: '仅问题',
      emptyDescOnly: '空 docstring',
      allTools: '全部',
      emptyDescription: '无描述(永不召回)',
      metaCategory: 'meta(不进向量)',
      assemblePreview: '装配预览',
      assembleQuery: '测试 query',
      assembleRun: '预览装配',
      assembleFailed: '装配预览失败',
      seeds: '种子工具',
      pool: '附加池',
      corePoolSize: '保底池大小',
      entityIndex: '实体索引',
      entitySearch: '搜索 surface…',
      entityIndexFailed: '加载实体索引失败',
      ambiguous: '歧义',
    },
    aiStatistics: {
      historyTrend: '历史趋势',
      memoryPipeline: '记忆管道',
      memoryHealth: '管道健康',
      healthy: '健康',
      degraded: '降级',
      empty: '空闲',
      days7: '近7日',
      days14: '近14日',
      days30: '近30日',
      perfRange: '跨日性能',
      singleDay: '单日',
      rangeMode: '范围',
    },
    aiSkills: {
      updateExisting: '同名则更新',
      updateHint: '覆盖安装已存在技能',
      reinstall: '从源更新',
    },
    aiHistory: {
      linkedAgents: '关联 Agent',
      loadLinkedFailed: '加载关联 Agent 失败',
    },
    personaConfig: {
      heartbeatStatus: '巡检状态',
      jobRegistered: 'Job 已注册',
      jobMissing: 'Job 未注册',
      heartbeatEnabled: '已启用巡检',
      heartbeatDisabled: '未启用巡检',
    },
    aiKanban: {
      applyPatch: '应用补丁',
      patchText: '补丁内容',
      patchSummary: '补丁摘要',
      patchSuccess: '补丁已提交',
      patchFailed: '补丁提交失败',
    },
  },
  'en-US': {
    sidebar: { stateStore: 'State Store', groupProfile: 'Group Profile' },
    stateStore: {
      title: 'State Store',
      description: 'Browse and clean AI persistent state (state_store)',
      batchDelete: 'Batch delete',
    },
    groupProfile: {
      title: 'Group Profile',
      description: 'View group context tags, term mappings, and member aliases (read-only)',
      scopes: 'Group scopes',
      empty: 'No group profiles',
      selectHint: 'Select a group on the left',
      lastUpdated: 'Last updated',
      tags: 'Context tags',
      termMappings: 'Term mappings',
      memberAliases: 'Member aliases',
      loadFailed: 'Failed to load group profiles',
      loadDetailFailed: 'Failed to load profile detail',
    },
    memorySettings: {
      fields: {
        batchIntervalSeconds: 'Batch interval (s)',
        idleFlushSeconds: 'Idle flush (s)',
        llmSemaphoreLimit: 'LLM concurrency',
        observerBlacklist: 'Observer blacklist groups',
        observerBlacklistPlaceholder: 'Enter group id and press Enter',
        enablePreferenceMemory: 'Preference memory',
        enableFamiliarityRouting: 'RF-Mem familiarity routing',
        enableRecollectionPath: 'RF-Mem recollection path',
      },
      readonlyHint:
        'The following are read-only reflections from MEMORY_CONFIG. Edit them under Framework Config.',
    },
    aiMemory: {
      tabSearch: 'Search',
      search: {
        title: 'Dual-route memory search',
        query: 'Query',
        queryPlaceholder: 'Text to retrieve…',
        groupId: 'Group ID',
        userId: 'User ID',
        userIdOptional: 'Optional',
        topK: 'top_k',
        run: 'Search',
        failed: 'Search failed',
        episodes: 'Episodes',
        entities: 'Entities',
        edges: 'Edges',
        errors: {
          empty_query: 'Query is required',
          empty_group: 'Group ID is required',
          bad_top_k: 'top_k must be 1–50',
        },
      },
    },
    aiTools: {
      diagnostics: 'Diagnostics',
      issuesOnly: 'Issues only',
      emptyDescOnly: 'Empty docstring',
      allTools: 'All',
      emptyDescription: 'Empty description (never recalled)',
      metaCategory: 'meta (not vector-searchable)',
      assemblePreview: 'Assemble preview',
      assembleQuery: 'Test query',
      assembleRun: 'Preview',
      assembleFailed: 'Assemble preview failed',
      seeds: 'Seed tools',
      pool: 'Extra pool',
      corePoolSize: 'Core pool size',
      entityIndex: 'Entity index',
      entitySearch: 'Search surface…',
      entityIndexFailed: 'Failed to load entity index',
      ambiguous: 'Ambiguous',
    },
    aiStatistics: {
      historyTrend: 'History trend',
      memoryPipeline: 'Memory pipeline',
      memoryHealth: 'Pipeline health',
      healthy: 'Healthy',
      degraded: 'Degraded',
      empty: 'Empty',
      days7: '7 days',
      days14: '14 days',
      days30: '30 days',
      perfRange: 'Range performance',
      singleDay: 'Single day',
      rangeMode: 'Range',
    },
    aiSkills: {
      updateExisting: 'Update if exists',
      updateHint: 'Overwrite existing skill',
      reinstall: 'Update from source',
    },
    aiHistory: {
      linkedAgents: 'Linked agents',
      loadLinkedFailed: 'Failed to load linked agents',
    },
    personaConfig: {
      heartbeatStatus: 'Heartbeat status',
      jobRegistered: 'Job registered',
      jobMissing: 'Job missing',
      heartbeatEnabled: 'Heartbeat on',
      heartbeatDisabled: 'Heartbeat off',
    },
    aiKanban: {
      applyPatch: 'Apply patch',
      patchText: 'Patch text',
      patchSummary: 'Summary',
      patchSuccess: 'Patch submitted',
      patchFailed: 'Patch failed',
    },
  },
  'ja-JP': {
    sidebar: { stateStore: '状態ストア', groupProfile: 'グループ像' },
    stateStore: {
      title: '状態ストア',
      description: 'AI 永続状態（state_store）の閲覧と削除',
      batchDelete: '一括削除',
    },
    groupProfile: {
      title: 'グループ像',
      description: '群コンテキストタグ・語彙マッピング・メンバー呼称（読み取り専用）',
      scopes: 'グループ scope',
      empty: 'データなし',
      selectHint: '左からグループを選択',
      lastUpdated: '最終更新',
      tags: 'コンテキストタグ',
      termMappings: '語彙マッピング',
      memberAliases: 'メンバー呼称',
      loadFailed: '一覧の読込に失敗',
      loadDetailFailed: '詳細の読込に失敗',
    },
    memorySettings: {
      fields: {
        batchIntervalSeconds: 'バッチ間隔(秒)',
        idleFlushSeconds: 'アイドル flush(秒)',
        llmSemaphoreLimit: 'LLM 同時数',
        observerBlacklist: 'Observer ブラックリスト',
        observerBlacklistPlaceholder: '群 ID を入力して Enter',
        enablePreferenceMemory: '好み記憶',
        enableFamiliarityRouting: 'RF-Mem 熟悉度',
        enableRecollectionPath: 'RF-Mem 回想',
      },
      readonlyHint:
        '以下は MEMORY_CONFIG の読み取り専用反映です。フレームワーク設定で変更してください。',
    },
    aiMemory: {
      tabSearch: '検索試行',
      search: {
        title: '二経路記憶検索',
        query: 'クエリ',
        queryPlaceholder: '検索テキスト…',
        groupId: 'グループ ID',
        userId: 'ユーザー ID',
        userIdOptional: '任意',
        topK: 'top_k',
        run: '検索',
        failed: '検索失敗',
        episodes: 'Episodes',
        entities: 'Entities',
        edges: 'Edges',
        errors: {
          empty_query: 'クエリを入力',
          empty_group: 'グループ ID を入力',
          bad_top_k: 'top_k は 1–50',
        },
      },
    },
    aiTools: {
      diagnostics: '診断',
      issuesOnly: '問題のみ',
      emptyDescOnly: '空 docstring',
      allTools: 'すべて',
      emptyDescription: '説明なし(召回不可)',
      metaCategory: 'meta(ベクトル外)',
      assemblePreview: '組立プレビュー',
      assembleQuery: 'テスト query',
      assembleRun: 'プレビュー',
      assembleFailed: 'プレビュー失敗',
      seeds: 'シード',
      pool: '追加プール',
      corePoolSize: 'コアプール',
      entityIndex: 'エンティティ索引',
      entitySearch: 'surface 検索…',
      entityIndexFailed: '索引の読込失敗',
      ambiguous: '曖昧',
    },
    aiStatistics: {
      historyTrend: '履歴トレンド',
      memoryPipeline: '記憶パイプライン',
      memoryHealth: '健全性',
      healthy: '健全',
      degraded: '劣化',
      empty: '空',
      days7: '7日',
      days14: '14日',
      days30: '30日',
      perfRange: '範囲パフォーマンス',
      singleDay: '単日',
      rangeMode: '範囲',
    },
    aiSkills: {
      updateExisting: '同名なら更新',
      updateHint: '既存スキルを上書き',
      reinstall: 'ソースから更新',
    },
    aiHistory: {
      linkedAgents: '関連 Agent',
      loadLinkedFailed: '関連 Agent の読込失敗',
    },
    personaConfig: {
      heartbeatStatus: '巡回状態',
      jobRegistered: 'Job 登録済',
      jobMissing: 'Job 未登録',
      heartbeatEnabled: '巡回 ON',
      heartbeatDisabled: '巡回 OFF',
    },
    aiKanban: {
      applyPatch: 'パッチ適用',
      patchText: 'パッチ本文',
      patchSummary: '要約',
      patchSuccess: 'パッチ送信済',
      patchFailed: 'パッチ失敗',
    },
  },
};

function deepMerge(a, b) {
  if (Array.isArray(b)) return b;
  if (b && typeof b === 'object') {
    const out = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
    for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
    return out;
  }
  return b;
}

for (const loc of locales) {
  const base = path.join('F:/gsuid_hub/src/i18n/locales', loc);
  const p = packs[loc];
  for (const [file, patch] of Object.entries(p)) {
    const fp = path.join(base, `${file}.json`);
    let cur = {};
    if (fs.existsSync(fp)) cur = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const next = deepMerge(cur, patch);
    fs.writeFileSync(fp, `${JSON.stringify(next, null, 2)}\n`);
    console.log('updated', fp);
  }
  const indexPath = path.join(base, 'index.ts');
  let idx = fs.readFileSync(indexPath, 'utf8');
  for (const mod of ['stateStore', 'groupProfile']) {
    if (!idx.includes(`./${mod}.json`)) {
      idx = idx.replace(
        /const locale = \{/,
        `import module_${mod} from './${mod}.json';\nconst locale = {`,
      );
      if (idx.includes('"logsConfig": module50')) {
        idx = idx.replace(
          '"logsConfig": module50',
          `"logsConfig": module50,\n  "${mod}": module_${mod}`,
        );
      } else {
        idx = idx.replace(/} as const;/, `,\n  "${mod}": module_${mod}\n} as const;`);
      }
    }
  }
  fs.writeFileSync(indexPath, idx);
  console.log('index', loc);
}
