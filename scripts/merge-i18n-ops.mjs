import fs from 'node:fs';
import path from 'node:path';

const packs = {
  'zh-CN': {
    sidebar: { aiOps: 'AI 运维中心' },
    aiOps: {
      title: 'AI 运维诊断中心',
      description: 'Bot 连接、存活 Session、黑白名单、安全策略、触发回放、配置快照等',
      loadFailed: '加载失败',
      saveFailed: '保存失败',
      saved: '已保存',
      tabs: {
        bots: 'Bot 看板',
        sessions: 'Session',
        access: '黑白名单',
        security: '安全输出',
        topology: '工具拓扑',
        lifecycle: '记忆生命周期',
        multimodal: '多模态',
        intent: '意图分类',
        trigger: '触发回放',
        followup: '续聊窗口',
        output: '输出试跑',
        snapshot: '配置快照',
        plugins: '插件诊断',
      },
      bots: {
        title: 'WS Bot 实时看板',
        total: '总数',
        connected: '在线',
        offline: '离线',
        online: '在线',
        empty: '当前无 active_bot',
      },
      sessions: {
        title: '存活 AI Session 注册表',
        count: '共 {count} 个',
        empty: '无存活 AI Session',
        active: '活跃',
        idle: '空闲',
        unknown: '未知',
      },
      access: {
        title: 'AI 黑白名单',
        blackList: '黑名单',
        whiteList: '白名单',
        blackHint: '命中用户或群 ID 则不进 AI',
        whiteHint: '非空时仅名单内可进 AI',
      },
      security: {
        title: '安全与输出策略',
        fields: {
          content_guard_enable: '内容守卫',
          output_firewall_enable: '出戏防火墙',
          render_long_markdown_as_image: '长 markdown 出图',
          markdown_image_min_chars: '出图最小字符',
          markdown_image_max_width: '出图最大宽度',
          history_merge_window: '同人连发合并窗口(秒)',
          follow_up_window: '续聊窗口(秒)',
          follow_up_max_total: '续聊天花板(秒)',
          tool_search_recall: '工具召回种子数',
          tool_extra_pool_max: '附加工具池上限',
          tool_context_window: '工具检索上下文轮数',
          output_firewall_extra_terms: '防火墙补充禁词',
          memory_sensitive_extra_terms: '隐私记忆敏感词',
        },
      },
      topology: {
        title: '工具池运行时拓扑',
        anyPersona: '（不指定 persona）',
        toolPacks: 'tool_packs',
        toolNames: '显式 tool_names',
        categories: '分类计数',
        corePool: '保底池工具',
      },
      lifecycle: {
        title: '记忆生命周期报告',
        empty: '尚未执行过维护（或进程刚启动）',
        runNow: '立即维护',
        ran: '维护完成',
        runFailed: '维护失败',
      },
      multimodal: {
        title: '多模态摄入健康度',
        ok: '健康',
        warn: '警告',
        critical: '危急',
      },
      intent: {
        title: '意图分类试跑',
        placeholder: '输入一条用户消息…',
        empty: '请输入文本',
        run: '分类',
        failed: '分类失败',
      },
      trigger: {
        title: '触发路径回放',
        placeholder: '消息文本…',
        run: '干跑',
        failed: '回放失败',
        wouldEnterAi: '将进入 AI',
        blocked: '被拦截',
        noResponse: '不应答',
        unknown: '未知',
      },
      followup: {
        title: '续聊窗口',
        empty: '当前无活跃续聊窗口',
      },
      output: {
        title: 'OOC / 输出归一化试跑',
        userText: '用户来话（影响身份逼问门）',
        aiText: 'AI 待发送文本',
        run: '试跑',
        failed: '试跑失败',
      },
      snapshot: {
        title: '配置快照导入导出',
        export: '导出',
        import: '导入',
        exported: '已导出',
        exportFailed: '导出失败',
        imported: '已应用 {count} 项',
        importFailed: '导入失败',
        invalidJson: 'JSON 无效',
        invalidSnapshot: '不是合法快照',
        applyMemory: '同时应用 memory_config（慎用）',
      },
      plugins: {
        title: '插件依赖 / 加载诊断',
      },
    },
  },
  'en-US': {
    sidebar: { aiOps: 'AI Ops Center' },
    aiOps: {
      title: 'AI Ops Diagnostics',
      description: 'Bots, sessions, access lists, security, trigger replay, snapshots…',
      loadFailed: 'Load failed',
      saveFailed: 'Save failed',
      saved: 'Saved',
      tabs: {
        bots: 'Bots',
        sessions: 'Sessions',
        access: 'Access',
        security: 'Security',
        topology: 'Tool topology',
        lifecycle: 'Lifecycle',
        multimodal: 'Multimodal',
        intent: 'Intent',
        trigger: 'Trigger replay',
        followup: 'Follow-up',
        output: 'Output preview',
        snapshot: 'Snapshot',
        plugins: 'Plugins',
      },
      bots: {
        title: 'WS Bot board',
        total: 'Total',
        connected: 'Online',
        offline: 'Offline',
        online: 'Online',
        empty: 'No active bots',
      },
      sessions: {
        title: 'Live AI session registry',
        count: '{count} sessions',
        empty: 'No live AI sessions',
        active: 'Active',
        idle: 'Idle',
        unknown: 'Unknown',
      },
      access: {
        title: 'AI black / white lists',
        blackList: 'Blacklist',
        whiteList: 'Whitelist',
        blackHint: 'Users/groups blocked from AI',
        whiteHint: 'If non-empty, only listed IDs may use AI',
      },
      security: {
        title: 'Security & output policy',
        fields: {
          content_guard_enable: 'Content guard',
          output_firewall_enable: 'OOC firewall',
          render_long_markdown_as_image: 'Long markdown as image',
          markdown_image_min_chars: 'Min chars for image',
          markdown_image_max_width: 'Image max width',
          history_merge_window: 'History merge window (s)',
          follow_up_window: 'Follow-up window (s)',
          follow_up_max_total: 'Follow-up ceiling (s)',
          tool_search_recall: 'Tool recall seeds',
          tool_extra_pool_max: 'Extra tool pool max',
          tool_context_window: 'Tool context turns',
          output_firewall_extra_terms: 'Firewall extra terms',
          memory_sensitive_extra_terms: 'Memory sensitive terms',
        },
      },
      topology: {
        title: 'Tool pool topology',
        anyPersona: '(no persona)',
        toolPacks: 'tool_packs',
        toolNames: 'tool_names',
        categories: 'Category counts',
        corePool: 'Core pool tools',
      },
      lifecycle: {
        title: 'Memory lifecycle report',
        empty: 'No maintenance run yet',
        runNow: 'Run now',
        ran: 'Maintenance done',
        runFailed: 'Maintenance failed',
      },
      multimodal: { title: 'Multimodal intake health', ok: 'OK', warn: 'Warn', critical: 'Critical' },
      intent: {
        title: 'Intent classification',
        placeholder: 'User message…',
        empty: 'Enter text',
        run: 'Classify',
        failed: 'Failed',
      },
      trigger: {
        title: 'Trigger path replay',
        placeholder: 'Message text…',
        run: 'Dry-run',
        failed: 'Failed',
        wouldEnterAi: 'Would enter AI',
        blocked: 'Blocked',
        noResponse: 'No response',
        unknown: 'Unknown',
      },
      followup: { title: 'Follow-up windows', empty: 'No active windows' },
      output: {
        title: 'OOC / normalize preview',
        userText: 'User text',
        aiText: 'AI text',
        run: 'Preview',
        failed: 'Failed',
      },
      snapshot: {
        title: 'Config snapshot',
        export: 'Export',
        import: 'Import',
        exported: 'Exported',
        exportFailed: 'Export failed',
        imported: 'Applied {count} keys',
        importFailed: 'Import failed',
        invalidJson: 'Invalid JSON',
        invalidSnapshot: 'Invalid snapshot',
        applyMemory: 'Also apply memory_config (careful)',
      },
      plugins: { title: 'Plugin load diagnostics' },
    },
  },
  'ja-JP': {
    sidebar: { aiOps: 'AI 運用センター' },
    aiOps: {
      title: 'AI 運用診断',
      description: 'Bot / Session / アクセス / セキュリティ / トリガー / スナップショット',
      loadFailed: '読込失敗',
      saveFailed: '保存失敗',
      saved: '保存しました',
      tabs: {
        bots: 'Bot',
        sessions: 'Session',
        access: 'アクセス',
        security: 'セキュリティ',
        topology: 'ツール拓扑',
        lifecycle: 'ライフサイクル',
        multimodal: 'マルチモーダル',
        intent: '意図',
        trigger: 'トリガー',
        followup: '続聊',
        output: '出力試行',
        snapshot: 'スナップショット',
        plugins: 'プラグイン',
      },
      bots: {
        title: 'WS Bot ボード',
        total: '合計',
        connected: 'オンライン',
        offline: 'オフライン',
        online: 'オンライン',
        empty: 'active_bot なし',
      },
      sessions: {
        title: '生存 AI Session',
        count: '{count} 件',
        empty: 'Session なし',
        active: '活性',
        idle: 'アイドル',
        unknown: '不明',
      },
      access: {
        title: 'AI 黑白名单',
        blackList: 'ブラックリスト',
        whiteList: 'ホワイトリスト',
        blackHint: '該当 ID は AI 不可',
        whiteHint: '非空時は名簿内のみ AI 可',
      },
      security: {
        title: '安全と出力ポリシー',
        fields: {
          content_guard_enable: 'コンテンツガード',
          output_firewall_enable: 'OOC ファイアウォール',
          render_long_markdown_as_image: '長 markdown 画像化',
          markdown_image_min_chars: '画像化最小文字',
          markdown_image_max_width: '画像最大幅',
          history_merge_window: '連発マージ窓(秒)',
          follow_up_window: '続聊窓(秒)',
          follow_up_max_total: '続聊上限(秒)',
          tool_search_recall: 'ツール召回数',
          tool_extra_pool_max: '追加プール上限',
          tool_context_window: 'ツール文脈輪数',
          output_firewall_extra_terms: '追加禁詞',
          memory_sensitive_extra_terms: '記憶敏感詞',
        },
      },
      topology: {
        title: 'ツールプール拓扑',
        anyPersona: '（persona なし）',
        toolPacks: 'tool_packs',
        toolNames: 'tool_names',
        categories: '分類カウント',
        corePool: 'コアプール',
      },
      lifecycle: {
        title: '記憶ライフサイクル',
        empty: '未実行',
        runNow: '今すぐ実行',
        ran: '完了',
        runFailed: '失敗',
      },
      multimodal: { title: 'マルチモーダル健全性', ok: 'OK', warn: '警告', critical: '危険' },
      intent: {
        title: '意図分類',
        placeholder: 'メッセージ…',
        empty: '入力してください',
        run: '分類',
        failed: '失敗',
      },
      trigger: {
        title: 'トリガー経路リプレイ',
        placeholder: '本文…',
        run: 'ドライラン',
        failed: '失敗',
        wouldEnterAi: 'AI に入る',
        blocked: '遮断',
        noResponse: '応答なし',
        unknown: '不明',
      },
      followup: { title: '続聊ウィンドウ', empty: 'アクティブなし' },
      output: {
        title: 'OOC / 正規化プレビュー',
        userText: 'ユーザー文',
        aiText: 'AI 文',
        run: '試行',
        failed: '失敗',
      },
      snapshot: {
        title: '設定スナップショット',
        export: 'エクスポート',
        import: 'インポート',
        exported: '完了',
        exportFailed: '失敗',
        imported: '{count} 件適用',
        importFailed: '失敗',
        invalidJson: 'JSON 不正',
        invalidSnapshot: 'スナップショット不正',
        applyMemory: 'memory_config も適用（注意）',
      },
      plugins: { title: 'プラグイン診断' },
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

for (const loc of Object.keys(packs)) {
  const base = path.join('F:/gsuid_hub/src/i18n/locales', loc);
  const p = packs[loc];
  for (const [file, patch] of Object.entries(p)) {
    const fp = path.join(base, `${file}.json`);
    let cur = {};
    if (fs.existsSync(fp)) cur = JSON.parse(fs.readFileSync(fp, 'utf8'));
    fs.writeFileSync(fp, `${JSON.stringify(deepMerge(cur, patch), null, 2)}\n`);
    console.log('updated', fp);
  }
  const indexPath = path.join(base, 'index.ts');
  let idx = fs.readFileSync(indexPath, 'utf8');
  if (!idx.includes('./aiOps.json')) {
    idx = idx.replace(
      /const locale = \{/,
      `import module_aiOps from './aiOps.json';\nconst locale = {`,
    );
    if (idx.includes('"stateStore":')) {
      idx = idx.replace(/("stateStore": module_stateStore)/, `$1,\n  "aiOps": module_aiOps`);
    } else {
      idx = idx.replace(/} as const;/, `,\n  "aiOps": module_aiOps\n} as const;`);
    }
    fs.writeFileSync(indexPath, idx);
  }
  console.log('index', loc);
}
