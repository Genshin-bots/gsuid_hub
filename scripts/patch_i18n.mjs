import fs from 'node:fs';

const files = [
  {
    path: 'f:/gsuid_hub/src/i18n/locales/zh-CN/aiConfig.json',
    keys: {
      extraProviderBanner: '当前使用由插件 **{plugin}** 注册的嵌入模型提供方 **{displayName}**（{kind} 模式）。',
      extraProviderHint: '如需修改配置，请前往「插件管理」页面操作。',
    },
  },
  {
    path: 'f:/gsuid_hub/src/i18n/locales/en-US/aiConfig.json',
    keys: {
      extraProviderBanner: 'Currently using embedding provider **{displayName}** registered by plugin **{plugin}** ({kind} mode).',
      extraProviderHint: 'To modify configuration, please go to the Plugin Management page.',
    },
  },
  {
    path: 'f:/gsuid_hub/src/i18n/locales/ja-JP/aiConfig.json',
    keys: {
      extraProviderBanner: 'プラグイン **{plugin}** が登録した埋め込みプロバイダー **{displayName}**（{kind} モード）を使用中です。',
      extraProviderHint: '設定を変更するには、プラグイン管理ページに移動してください。',
    },
  },
];

for (const { path, keys } of files) {
  let text = fs.readFileSync(path, 'utf8');
  const obj = JSON.parse(text);

  // Insert the new keys into the vectorDb section
  if (!obj.vectorDb) {
    console.error(`vectorDb section missing in ${path}`);
    continue;
  }
  let changed = false;
  for (const [k, v] of Object.entries(keys)) {
    if (!obj.vectorDb[k]) {
      obj.vectorDb[k] = v;
      changed = true;
    }
  }
  if (changed) {
    // Use the same formatting as the original file (2 spaces indent)
    fs.writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    console.log(`Updated: ${path}`);
  } else {
    console.log(`Already up to date: ${path}`);
  }
}
