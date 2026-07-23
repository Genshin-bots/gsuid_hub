// Mock data for dashboard
// #TODO: Replace all mock data generators with actual API calls

// Bot list for selection
export const mockBotList = [
  { id: 'all', name: '汇总' },
  { id: 'bot-001', name: 'Bot Alpha' },
  { id: 'bot-002', name: 'Bot Beta' },
  { id: 'bot-003', name: 'Bot Gamma' },
];

// #TODO: Fetch key metrics from backend API
export const generateKeyMetrics = (botId: string = 'all') => ({
  dau: Math.floor(Math.random() * 5000) + 1000, // Daily Active Users
  dag: Math.floor(Math.random() * 800) + 200,   // Daily Active Groups
  retention: (Math.random() * 30 + 60).toFixed(1) + '%', // User Retention
  newUsers: Math.floor(Math.random() * 300) + 50,  // New Users
  churnedUsers: Math.floor(Math.random() * 100) + 20, // Churned Users
  mau: Math.floor(Math.random() * 20000) + 5000, // Monthly Active Users
  dauMauRatio: (Math.random() * 0.3 + 0.1).toFixed(2), // DAU/MAU
  mag: Math.floor(Math.random() * 3000) + 500,   // Monthly Active Groups
  dagMagRatio: (Math.random() * 0.4 + 0.2).toFixed(2), // DAG/MAG
});

// #TODO: Fetch monthly command data from backend API
export const generateMonthlyCommandData = (botId: string = 'all') => {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      sentCommands: Math.floor(Math.random() * 2000) + 500,
      receivedCommands: Math.floor(Math.random() * 1800) + 400,
      commandCalls: Math.floor(Math.random() * 3000) + 800,
      imageGenerated: Math.floor(Math.random() * 500) + 50,
    });
  }
  return data;
};

// #TODO: Fetch monthly user and group data from backend API
export const generateMonthlyUserGroupData = (botId: string = 'all') => {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      users: Math.floor(Math.random() * 3000) + 500,
      groups: Math.floor(Math.random() * 600) + 100,
    });
  }
  return data;
};

// #TODO: Fetch daily command usage data from backend API
export const generateDailyCommandUsage = (botId: string = 'all', date: string) => {
  const commands = [
    '/start', '/help', '/settings', '/info', '/status',
    '/search', '/generate', '/translate', '/weather', '/news',
    '/remind', '/note', '/chat', '/image', '/voice'
  ];
  return commands.map(cmd => ({
    command: cmd,
    count: Math.floor(Math.random() * 500) + 50,
  }));
};

// Command types for stacked bar charts
export const commandTypes = [
  '全天候', '删除自选', '加入自选', '我的自选', 'mr', '添加自选', '信息', '其他命令'
];

/**
 * @deprecated Prefer `getCommandColor` from `@/lib/featureUtils`.
 * Kept for mock generators; Dashboard no longer uses this map as a sole source
 * (unknown real command names used to fall back to gray #6b7280).
 */
export { COMMAND_COLOR_OVERRIDES as commandColors, getCommandColor } from '@/lib/featureUtils';

// #TODO: Fetch daily group command triggers from backend API
// Returns stacked data format for different commands per group
export const generateDailyGroupCommandTriggers = (botId: string = 'all', date: string) => {
  const groups = [
    '群组 A', '群组 B', '群组 C', '群组 D', '群组 E',
    '群组 F', '群组 G', '群组 H', '群组 I', '群组 J'
  ];
  
  return groups.map(group => {
    const data: Record<string, string | number> = { group };
    commandTypes.forEach(cmd => {
      data[cmd] = Math.floor(Math.random() * 10);
    });
    return data;
  });
};

// #TODO: Fetch daily personal command triggers from backend API
// Returns stacked data format for different commands per user
export const generateDailyPersonalCommandTriggers = (botId: string = 'all', date: string) => {
  const users = [
    '748203226', '1098345874', '444835641', '44638563', '1449448054',
    '378805055', '61974774', '280747437', '3064615021'
  ];
  
  return users.map(user => {
    const data: Record<string, string | number> = { user };
    commandTypes.forEach(cmd => {
      data[cmd] = Math.floor(Math.random() * 5);
    });
    return data;
  });
};

// Legacy mock data (kept for compatibility)
export const generateDailyActiveUsers = () => {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      users: Math.floor(Math.random() * 500) + 100,
      newUsers: Math.floor(Math.random() * 50) + 10,
      sessions: Math.floor(Math.random() * 800) + 200,
    });
  }
  return data;
};

export const generateMonthlyHeatmap = () => {
  const data = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    data.push({
      day,
      week: Math.ceil((day + new Date(year, month, 1).getDay()) / 7),
      dayOfWeek: new Date(year, month, day).getDay(),
      value: Math.floor(Math.random() * 100),
    });
  }
  return data;
};

export const generateStats = () => ({
  totalUsers: 12458,
  activeToday: 342,
  newThisWeek: 156,
  avgSessionTime: '4m 32s',
  bounceRate: '32%',
  pageViews: 45892,
});

export const generateRecentActivity = () => [
  { id: 1, action: '用户登录', user: 'user@example.com', time: '2分钟前' },
  { id: 2, action: '配置更新', user: 'admin@demo.com', time: '5分钟前' },
  { id: 3, action: '数据导出', user: 'admin@demo.com', time: '12分钟前' },
  { id: 4, action: '新用户注册', user: 'new@user.com', time: '25分钟前' },
  { id: 5, action: '插件启用', user: 'admin@demo.com', time: '1小时前' },
];

// Mock database data
export const generateMockDatabaseData = () => ({
  users: [
    { id: 1, name: '张三', email: 'zhangsan@example.com', role: 'admin', status: 'active', createdAt: '2024-01-15' },
    { id: 2, name: '李四', email: 'lisi@example.com', role: 'user', status: 'active', createdAt: '2024-02-20' },
    { id: 3, name: '王五', email: 'wangwu@example.com', role: 'user', status: 'inactive', createdAt: '2024-03-10' },
    { id: 4, name: '赵六', email: 'zhaoliu@example.com', role: 'moderator', status: 'active', createdAt: '2024-04-05' },
    { id: 5, name: '钱七', email: 'qianqi@example.com', role: 'user', status: 'active', createdAt: '2024-05-12' },
  ],
  products: [
    { id: 1, name: '商品A', price: 99.99, stock: 150, category: '电子产品', status: 'available' },
    { id: 2, name: '商品B', price: 199.99, stock: 50, category: '服装', status: 'available' },
    { id: 3, name: '商品C', price: 49.99, stock: 0, category: '食品', status: 'out_of_stock' },
    { id: 4, name: '商品D', price: 299.99, stock: 25, category: '电子产品', status: 'available' },
  ],
  orders: [
    { id: 1, userId: 1, total: 299.99, status: 'completed', createdAt: '2024-12-20' },
    { id: 2, userId: 2, total: 149.99, status: 'pending', createdAt: '2024-12-21' },
    { id: 3, userId: 3, total: 599.99, status: 'shipped', createdAt: '2024-12-22' },
  ],
});

// Mock plugin configs
export const generatePluginConfigs = () => [
  {
    id: 'email-service',
    name: '邮件服务',
    description: '配置邮件发送服务',
    enabled: true,
    config: {
      smtp_host: { type: 'text', label: 'SMTP 主机', value: 'smtp.example.com' },
      smtp_port: { type: 'number', label: 'SMTP 端口', value: 587 },
      use_ssl: { type: 'boolean', label: '使用 SSL', value: true },
      sender_email: { type: 'email', label: '发送者邮箱', value: 'noreply@example.com' },
    },
  },
  {
    id: 'storage',
    name: '存储服务',
    description: '配置文件存储',
    enabled: true,
    config: {
      provider: { type: 'select', label: '存储提供商', value: 'local', options: ['local', 's3', 'oss', 'cos'] },
      max_file_size: { type: 'number', label: '最大文件大小 (MB)', value: 10 },
      allowed_types: { type: 'list', label: '允许的文件类型', value: ['jpg', 'png', 'pdf', 'doc'] },
      upload_path: { type: 'text', label: '上传路径', value: '/uploads' },
    },
  },
  {
    id: 'notification',
    name: '通知服务',
    description: '配置推送通知',
    enabled: false,
    config: {
      push_enabled: { type: 'boolean', label: '启用推送', value: false },
      webhook_url: { type: 'url', label: 'Webhook URL', value: '' },
      retry_count: { type: 'number', label: '重试次数', value: 3 },
      timeout: { type: 'number', label: '超时时间 (秒)', value: 30 },
    },
  },
  {
    id: 'scheduler',
    name: '定时任务',
    description: '配置定时任务调度',
    enabled: true,
    config: {
      cron_expression: { type: 'text', label: 'Cron 表达式', value: '0 0 * * *' },
      timezone: { type: 'select', label: '时区', value: 'Asia/Shanghai', options: ['Asia/Shanghai', 'UTC', 'America/New_York', 'Europe/London'] },
      start_date: { type: 'date', label: '开始日期', value: '2024-01-01' },
      max_retries: { type: 'number', label: '最大重试', value: 5 },
    },
  },
  {
    id: 'analytics',
    name: '数据分析',
    description: '配置数据分析和统计',
    enabled: true,
    config: {
      tracking_enabled: { type: 'boolean', label: '启用追踪', value: true },
      sample_rate: { type: 'number', label: '采样率 (%)', value: 100 },
      retention_days: { type: 'number', label: '数据保留天数', value: 90 },
      excluded_paths: { type: 'list', label: '排除路径', value: ['/admin', '/api/health'] },
    },
  },
];

// Mock logs
export const generateLogs = () => {
  const levels = ['info', 'warn', 'error', 'debug'] as const;
  const sources = ['api', 'auth', 'database', 'scheduler', 'email'];
  const messages = {
    info: ['Request completed successfully', 'User logged in', 'Cache refreshed', 'Task scheduled'],
    warn: ['High memory usage detected', 'Rate limit approaching', 'Deprecated API called', 'Slow query detected'],
    error: ['Database connection failed', 'Authentication error', 'File not found', 'Timeout exceeded'],
    debug: ['Processing request', 'Query executed', 'Cache hit', 'Session validated'],
  };

  const logs = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const messageList = messages[level];
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    const time = new Date(now.getTime() - i * 60000 * Math.random() * 10);

    logs.push({
      id: i + 1,
      level,
      source,
      message,
      timestamp: time.toISOString(),
      details: level === 'error' ? { stack: 'Error: ' + message + '\n    at Function.execute (/app/src/index.ts:42:15)' } : undefined,
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// #TODO: Replace with actual file tree API
export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileTreeNode[];
}

export const generateFileTree = (): FileTreeNode[] => [
  {
    id: 'data',
    name: 'data',
    path: 'data',
    type: 'folder',
    children: [
      {
        id: 'data-config',
        name: 'config',
        path: 'data/config',
        type: 'folder',
        children: [
          { id: 'data-config-settings', name: 'settings.json', path: 'data/config/settings.json', type: 'file' },
          { id: 'data-config-users', name: 'users.json', path: 'data/config/users.json', type: 'file' },
          { id: 'data-config-plugins', name: 'plugins.json', path: 'data/config/plugins.json', type: 'file' },
        ],
      },
      {
        id: 'data-logs',
        name: 'logs',
        path: 'data/logs',
        type: 'folder',
        children: [
          { id: 'data-logs-app', name: 'app.log', path: 'data/logs/app.log', type: 'file' },
          { id: 'data-logs-error', name: 'error.log', path: 'data/logs/error.log', type: 'file' },
          { id: 'data-logs-access', name: 'access.log', path: 'data/logs/access.log', type: 'file' },
        ],
      },
      {
        id: 'data-db',
        name: 'db',
        path: 'data/db',
        type: 'folder',
        children: [
          { id: 'data-db-main', name: 'main.sqlite', path: 'data/db/main.sqlite', type: 'file' },
          { id: 'data-db-cache', name: 'cache.sqlite', path: 'data/db/cache.sqlite', type: 'file' },
        ],
      },
      {
        id: 'data-cache',
        name: 'cache',
        path: 'data/cache',
        type: 'folder',
        children: [
          { id: 'data-cache-temp', name: 'temp', path: 'data/cache/temp', type: 'folder', children: [] },
        ],
      },
    ],
  },
  {
    id: 'plugins',
    name: 'plugins',
    path: 'plugins',
    type: 'folder',
    children: [
      {
        id: 'plugins-email',
        name: 'email-service',
        path: 'plugins/email-service',
        type: 'folder',
        children: [
          { id: 'plugins-email-config', name: 'config.json', path: 'plugins/email-service/config.json', type: 'file' },
          { id: 'plugins-email-main', name: 'main.py', path: 'plugins/email-service/main.py', type: 'file' },
        ],
      },
      {
        id: 'plugins-storage',
        name: 'storage',
        path: 'plugins/storage',
        type: 'folder',
        children: [
          { id: 'plugins-storage-config', name: 'config.json', path: 'plugins/storage/config.json', type: 'file' },
        ],
      },
    ],
  },
  {
    id: 'static',
    name: 'static',
    path: 'static',
    type: 'folder',
    children: [
      {
        id: 'static-images',
        name: 'images',
        path: 'static/images',
        type: 'folder',
        children: [
          { id: 'static-images-logo', name: 'logo.png', path: 'static/images/logo.png', type: 'file' },
          { id: 'static-images-favicon', name: 'ICON.png', path: 'static/images/ICON.png', type: 'file' },
        ],
      },
      {
        id: 'static-fonts',
        name: 'fonts',
        path: 'static/fonts',
        type: 'folder',
        children: [],
      },
    ],
  },
  { id: 'env', name: '.env', path: '.env', type: 'file' },
  { id: 'config-yaml', name: 'config.yaml', path: 'config.yaml', type: 'file' },
  { id: 'readme', name: 'README.md', path: 'README.md', type: 'file' },
];

// #TODO: Replace with actual backup list API
export interface BackupFile {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed';
}

export const generateBackupList = (): BackupFile[] => {
  const backups: BackupFile[] = [];
  const now = new Date();
  
  for (let i = 0; i < 10; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(2, 0, 0, 0);
    
    backups.push({
      id: `backup-${i}`,
      filename: `backup_${date.toISOString().split('T')[0]}_02-00.zip`,
      size: Math.floor(Math.random() * 50000000) + 10000000,
      createdAt: date,
      status: i === 0 && Math.random() > 0.8 ? 'in_progress' : 'completed',
    });
  }
  
  return backups;
};
