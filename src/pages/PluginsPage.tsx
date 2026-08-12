import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Loader2, ChevronDown, Save, Server, LayoutGrid, Users, Shield, Filter, Zap, MessageSquare, Key, Command, Package, RotateCw, Download, Sliders, Cog, Database, Globe, Bell, Lock, Palette, FileText, Layers, Wrench } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType, RepeatGroupField, RepeatGroupItem } from '@/components/config';
import { pluginsApi, gitUpdateApi, Plugin, ServiceConfig, SvItem, SvCommand, PluginConfigItem, PluginConfigGroup, PluginListItem } from '@/lib/api';
import { toast } from 'sonner';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { PluginIcon } from '@/components/ui/plugin-icon';

// 命令类型颜色映射 - 提取为模块级常量，避免每次渲染重建
const CMD_TYPE_COLORS: Record<string, string> = {
  command: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700',
  prefix: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700',
  suffix: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700',
  keyword: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700',
  fullmatch: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700',
  regex: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700',
  file: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900 dark:text-pink-300 dark:border-pink-700',
  message: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700',
};
const CMD_TYPE_DEFAULT_COLOR = 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';

// 根据配置名称关键词智能分配图标
const configNameIconMap: Record<string, React.ReactNode> = {
  '基本': <Settings className="w-4 h-4" />,
  '基础': <Settings className="w-4 h-4" />,
  'basic': <Settings className="w-4 h-4" />,
  'general': <Settings className="w-4 h-4" />,
  '通用': <Settings className="w-4 h-4" />,
  '高级': <Sliders className="w-4 h-4" />,
  'advanced': <Sliders className="w-4 h-4" />,
  '安全': <Shield className="w-4 h-4" />,
  'security': <Shield className="w-4 h-4" />,
  '权限': <Lock className="w-4 h-4" />,
  'permission': <Lock className="w-4 h-4" />,
  '消息': <MessageSquare className="w-4 h-4" />,
  'message': <MessageSquare className="w-4 h-4" />,
  '用户': <Users className="w-4 h-4" />,
  'user': <Users className="w-4 h-4" />,
  '服务': <Server className="w-4 h-4" />,
  'service': <Server className="w-4 h-4" />,
  '数据库': <Database className="w-4 h-4" />,
  'database': <Database className="w-4 h-4" />,
  '网络': <Globe className="w-4 h-4" />,
  'network': <Globe className="w-4 h-4" />,
  '通知': <Bell className="w-4 h-4" />,
  'notification': <Bell className="w-4 h-4" />,
  '外观': <Palette className="w-4 h-4" />,
  'theme': <Palette className="w-4 h-4" />,
  '过滤': <Filter className="w-4 h-4" />,
  'filter': <Filter className="w-4 h-4" />,
  '命令': <Command className="w-4 h-4" />,
  'command': <Command className="w-4 h-4" />,
  '快捷': <Zap className="w-4 h-4" />,
  'hotkey': <Zap className="w-4 h-4" />,
  '定时': <Key className="w-4 h-4" />,
  'schedule': <Key className="w-4 h-4" />,
  '配置': <Cog className="w-4 h-4" />,
  'config': <Cog className="w-4 h-4" />,
  '文件': <FileText className="w-4 h-4" />,
  'file': <FileText className="w-4 h-4" />,
  '分层': <Layers className="w-4 h-4" />,
  'layer': <Layers className="w-4 h-4" />,
  '工具': <Wrench className="w-4 h-4" />,
  'tool': <Wrench className="w-4 h-4" />,
};

// 用于无法匹配关键词时的循环图标列表
const fallbackConfigIcons = [
  <Settings className="w-4 h-4" />,
  <Cog className="w-4 h-4" />,
  <Sliders className="w-4 h-4" />,
  <Wrench className="w-4 h-4" />,
  <Layers className="w-4 h-4" />,
  <Database className="w-4 h-4" />,
];

/**
 * 简化正则命令关键字用于显示。
 * 算法：
 * 1. 剥离字符类 [...], 转义序列(\d \w \uXXXX 等), 量词({1,15} + *)
 * 2. 递归解析分组(含命名、非捕获等)，多选项优先选中文最多的
 * 3. 拼接分组间的字面文本
 *
 * 示例：
 *   "^(?P<kind>删除全部)(?P<char>[\u4e00-...]{1,15})(?P<type>面板|面包|bg)图$"
 *   → "删除全部面板图"
 *   "^(?P<waves_id>\d{9})?(?P<char>[\u4e00-...]{1,15})(权重|qz)$"
 *   → "权重"
 *   "^(?:第?(?P<period_pre>\d+|下期|下下期|...)期?...)$"
 *   → "第下期期矩阵信息"
 */
const _regexSimplifyCache = new Map<string, string>();

/** 用 O(n) 扫描剥离字符类 [...]，避免灾难性回溯 */
function stripCharClass(s: string): string {
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '[' && (i === 0 || s[i - 1] !== '\\')) {
      i++; // skip '['
      while (i < s.length && !(s[i] === ']' && s[i - 1] !== '\\')) i++;
      i++; // skip ']'
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

/** 用 O(n) 扫描剥离常见正则元字符和转义序列 */
function stripEscapeMeta(s: string): string {
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const c = s[i + 1];
      if ('dwWsSbDBntrfv'.includes(c)) { i += 2; continue; }
      if (c === 'u' && i + 5 < s.length && /^[\da-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) { i += 6; continue; }
      if (c === 'U' && i + 9 < s.length && /^[\da-fA-F]{8}$/.test(s.slice(i + 2, i + 10))) { i += 10; continue; }
      if (c === 'x' && i + 3 < s.length && /^[\da-fA-F]{2}$/.test(s.slice(i + 2, i + 4))) { i += 4; continue; }
      if (c === '{') {
        let j = i + 2;
        while (j < s.length && s[j] !== '}') j++;
        i = j + 1; continue;
      }
      out += s[i]; i++;
    } else if (s[i] === '{') {
      i++;
      while (i < s.length && s[i] !== '}') i++;
      i++; continue;
    } else if ('*+^$'.includes(s[i])) {
      i++; continue;
    } else {
      out += s[i]; i++;
    }
  }
  return out;
}

/** 计算字符串中可读字符(CJK×10 + 字母数字×1)的权重 */
function countReadableScore(s: string): number {
  let cjk = 0, alpha = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fa5) cjk++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)) alpha++;
  }
  return cjk * 10 + alpha;
}

/**
 * 快速简化正则命令关键字用于显示（非递归版）。
 * 算法：
 * 1. O(n) 扫描剥离字符类 [...] 和转义序列
 * 2. 剥离分组前缀 (?P<name>, ?:, ?=, ?!, 等)
 * 3. 迭代简化最内层分组：从内到外逐层处理 (…)，
 *    对 | 多选项选可读性最高的
 * 4. 剥离剩余元字符，提取可读文本，截断至 20 字符
 *
 * 相比旧递归版 extractReadable → processGroupBody → extractReadable，
 * 此版本无递归调用，对 500+ 正则的处理速度大幅提升。
 */
function simplifyRegexKeyword(keyword: string): string {
  if (!keyword) return keyword;
  const cached = _regexSimplifyCache.get(keyword);
  if (cached !== undefined) return cached;

  // Step 1: O(n) 扫描剥离字符类和转义序列
  let s = stripEscapeMeta(stripCharClass(keyword));

  // Step 2: 剥离分组前缀
  s = s.replace(/\?P<[^>]+>/g, '');
  s = s.replace(/\?[=:!]/g, '');
  s = s.replace(/\?<[=!]/g, '');

  // Step 3: 迭代简化最内层分组 — 从内到外逐层处理
  // 每次只匹配不含嵌套括号的最内层 (...)，选择 | 多选项中可读性最高的
  let prev = '';
  let maxIter = 10;
  while (prev !== s && maxIter-- > 0) {
    prev = s;
    s = s.replace(/\(([^()]*)\)/g, (_match: string, content: string) => {
      const alts = content.split('|');
      if (alts.length > 1) {
        let best = alts[0];
        let bestScore = countReadableScore(best);
        for (const alt of alts) {
          const score = countReadableScore(alt);
          if (score > bestScore) { best = alt; bestScore = score; }
        }
        return best;
      }
      return content;
    });
  }

  // Step 4: 剥离剩余元字符，反转义
  s = s.replace(/[()|*+?]/g, '');
  s = s.replace(/\\(.)/g, '$1');
  s = s.trim();

  // Step 5: 提取可读文本序列，截断
  const readable = s.match(/[\u4e00-\u9fa5]+|[a-zA-Z]{2,}|[a-zA-Z0-9]+/g) || [];
  const result = readable.join('').slice(0, 20) || s.slice(0, 20) || keyword.slice(0, 20);

  _regexSimplifyCache.set(keyword, result);
  return result;
}

// 简单哈希函数，用于根据名称生成稳定的索引
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 转为32位整数
  }
  return Math.abs(hash);
}

function getConfigIcon(name: string, index: number): React.ReactNode {
  const lowerName = name.toLowerCase();
  // 尝试关键词匹配
  for (const [keyword, icon] of Object.entries(configNameIconMap)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return icon;
    }
  }
  // 无法匹配时，使用基于名称哈希的循环图标
  return fallbackConfigIcons[simpleHash(name) % fallbackConfigIcons.length];
}

// Convert API plugin to local plugin type
const convertToPlugin = (plugin: Plugin): any => {
  const processConfig = (configData: Record<string, any>) => {
    const converted: Record<string, ConfigFieldDefinition> = {};
    for (const [key, value] of Object.entries(configData || {})) {
      const configItem = value as PluginConfigItem;
      let type: ConfigFieldType = 'text';
      const rawType = configItem.type?.toLowerCase() || '';

      // 注意：匹配顺序很重要，更具体的类型要先匹配
      if (rawType === 'gsrepeatgroup') type = 'repeatgroup';
      else if (rawType === 'gsdivider') type = 'divider';
      else if (rawType === 'gscolor') type = 'color';
      else if (rawType === 'gsfileupload') type = 'fileupload';
      else if (rawType === 'gsfilesupload') type = 'filesupload';
      else if (rawType === 'gstimerange') type = 'timerange';
      else if (rawType === 'gsdate') type = 'date';
      else if (rawType === 'gstimer') type = 'time';
      else if (rawType === 'gstime') type = 'time'; // 已废弃但仍支持
      else if (rawType === 'gsbool') type = 'boolean';
      else if (rawType === 'gsint') {
        // gsint: 有 options 时用下拉选择，否则用数字输入
        if (configItem.options) {
          type = 'select';
          configItem.options = configItem.options.map(String);
          // value 也需要转为字符串
          configItem.value = String(configItem.value ?? '');
        } else {
          type = 'number';
        }
      }
      else if (rawType === 'gsfloat') type = 'number';
      else if (rawType === 'gsliststr') type = configItem.options ? 'multiselect' : 'tags';
      else if (rawType === 'gslist') {
        type = 'tags';
        // 整数列表转字符串列表
        if (Array.isArray(configItem.value)) {
          configItem.value = configItem.value.map(String);
        }
      }
      else if (rawType === 'gsdict') {
        type = 'text';
        if (typeof configItem.value === 'object' && configItem.value !== null) {
          configItem.value = JSON.stringify(configItem.value, null, 2);
        }
      }
      else if (rawType === 'gsimage') type = 'image';
      else if (rawType === 'gsstr') type = configItem.options ? 'select' : 'text';
      // 兜底：模糊匹配旧格式
      else if (rawType.includes('bool')) type = 'boolean';
      else if (rawType.includes('int')) type = 'number';
      else if (rawType.includes('float')) type = 'number';
      else if (rawType.includes('list') || rawType.includes('array')) type = configItem.options ? 'multiselect' : 'tags';
      else if (rawType.includes('time') || rawType.includes('date')) type = 'date';
      else if (rawType.includes('str') || rawType.includes('string')) type = configItem.options ? 'select' : 'text';
      else if (rawType.includes('dict') || rawType.includes('object')) {
        type = 'text';
        if (typeof configItem.value === 'object' && configItem.value !== null) {
          configItem.value = JSON.stringify(configItem.value, null, 2);
        }
      } else if (rawType.includes('image')) type = 'image';

      converted[key] = {
        value: configItem.value as ConfigValue,
        default: configItem.default,
        type,
        label: configItem.title || key,
        placeholder: configItem.desc || '请输入内容',
        options: configItem.options,
        description: configItem.desc || key,
        required: false,
        disabled: false,
        rawType: configItem.type,
        // 新增字段透传
        secret: configItem.secret,
        regex: configItem.regex,
        min_value: configItem.min_value,
        max_value: configItem.max_value,
        upload_to: configItem.upload_to,
        filename: configItem.filename,
        suffix: configItem.suffix,
        // gsrepeatgroup: 透传 template 供 RepeatGroupField 渲染各子字段
        template: configItem.template,
      } as unknown as ConfigFieldDefinition;
    }
    return converted;
  };

  const config = processConfig(plugin.config || {});
  const config_groups = plugin.config_groups?.map(group => ({
    ...group,
    config: processConfig(group.config)
  }));

  return { ...plugin, config, config_groups } as unknown as Plugin;
};

export default function PluginsPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();
  const [pluginList, setPluginList] = useState<PluginListItem[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('');
  
  // 用于跟踪当前正在加载的插件ID，防止竞态条件
  const loadingPluginIdRef = useRef<string | null>(null);
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [isReloadingPlugin, setIsReloadingPlugin] = useState(false);

  // 更新全部插件相关状态
  const [updateAllDialogOpen, setUpdateAllDialogOpen] = useState(false);
  const [updateAllPanelOpen, setUpdateAllPanelOpen] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  type PluginUpdateStatus = 'pending' | 'updating' | 'success' | 'failed';
  interface PluginUpdateItem {
    name: string;
    status: PluginUpdateStatus;
    message?: string;
  }
  const [pluginUpdateList, setPluginUpdateList] = useState<PluginUpdateItem[]>([]);

  // Track original state for change detection
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [originalServiceConfig, setOriginalServiceConfig] = useState<ServiceConfig | null>(null);
  const [originalSvList, setOriginalSvList] = useState<SvItem[]>([]);

  // Edited state
  const [editedServiceConfig, setEditedServiceConfig] = useState<Partial<ServiceConfig>>({});
  const [editedSvList, setEditedSvList] = useState<SvItem[]>([]);
  const [originalEnabled, setOriginalEnabled] = useState<boolean>(true);
  const [editedEnabled, setEditedEnabled] = useState<boolean>(true);

  const selectedPlugin = plugins.find((p) => p.id === selectedPluginId);

  // 预计算所有 SV 命令的去重汇总列表
  const allCommands = useMemo(() => {
    if (!editedSvList || editedSvList.length === 0) return [];
    const map = new Map<string, SvCommand>();
    editedSvList.forEach(sv => {
      sv.commands?.forEach(cmd => {
        const key = `${cmd.type}:${cmd.keyword}`;
        if (!map.has(key)) map.set(key, cmd);
      });
    });
    return Array.from(map.values());
  }, [editedSvList]);

  const isConfigDirty = useMemo(() => {
    if (!selectedPlugin || !originalConfig) return false;
    const configChanged = JSON.stringify(selectedPlugin.config) !== JSON.stringify(originalConfig.config);
    const groupsChanged = JSON.stringify(selectedPlugin.config_groups) !== JSON.stringify(originalConfig.groups);
    return configChanged || groupsChanged;
  }, [selectedPlugin, originalConfig]);

  const isServiceDirty = useMemo(() => {
    const serviceChanged = JSON.stringify(editedServiceConfig) !== JSON.stringify(originalServiceConfig);
    const svListChanged = JSON.stringify(editedSvList) !== JSON.stringify(originalSvList);
    const enabledChanged = editedEnabled !== originalEnabled;
    return serviceChanged || svListChanged || enabledChanged;
  }, [editedServiceConfig, originalServiceConfig, editedSvList, originalSvList, editedEnabled, originalEnabled]);

  // 过滤空字符串的辅助函数
  const filterEmptyPrefix = (prefix: string[] | undefined): string[] => {
    if (!Array.isArray(prefix)) return [];
    return prefix.filter(item => item !== '');
  };

  // Fetch plugin list (lightweight)
  const fetchPluginList = async () => {
    try {
      setIsLoading(true);
      const data = await pluginsApi.getPluginList();
      setPluginList(data);
      
      // If has plugins and none selected, select first
      if (data.length > 0 && !selectedPluginId) {
        setSelectedPluginId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch plugin list:', error);
      toast.error(t('plugins.loadPluginListFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch plugin detail for a specific plugin
  const fetchPluginDetail = async (pluginName: string) => {
    const requestId = pluginName; // 用插件名作为请求ID
    loadingPluginIdRef.current = requestId;
    
    try {
      setIsLoadingDetail(true);
      const data = await pluginsApi.getPlugin(pluginName);
      
      // 竞态条件检查：如果当前正在加载的不是这个请求，则忽略响应
      if (loadingPluginIdRef.current !== requestId) {
        console.log(`Ignored stale response for plugin: ${pluginName}`);
        return;
      }
      
      const converted = convertToPlugin(data);
      
      setPlugins(prev => {
        // Remove existing plugin with same id if exists, then add new one
        const filtered = prev.filter(p => p.id !== converted.id);
        return [...filtered, converted];
      });
      
      // If this is the selected plugin, set original config
      // 再次检查 selectedPluginId 是否仍然匹配，防止慢请求覆盖快请求的数据
      if (data.id === selectedPluginId && loadingPluginIdRef.current === requestId) {
        setOriginalConfig({
          config: JSON.parse(JSON.stringify(converted.config)),
          groups: JSON.parse(JSON.stringify(converted.config_groups || []))
        });
        
        const processedServiceConfig = converted.service_config ? {
          ...converted.service_config,
          prefix: filterEmptyPrefix(converted.service_config.prefix)
        } : null;
        
        setOriginalServiceConfig(JSON.parse(JSON.stringify(processedServiceConfig)));
        setOriginalSvList(JSON.parse(JSON.stringify(converted.sv_list || [])));
        setEditedServiceConfig({
          ...(processedServiceConfig || {}),
          enabled: converted.enabled ?? true
        });
        setEditedSvList(JSON.parse(JSON.stringify(converted.sv_list || [])));
        setOriginalEnabled(converted.enabled ?? true);
        setEditedEnabled(converted.enabled ?? true);

        if (converted.config_names && converted.config_names.length > 0) {
          setSelectedConfigName(converted.config_names[0]);
        } else {
          setSelectedConfigName(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch plugin detail:', error);
      toast.error(t('plugins.loadPluginDetailFailed'));
    } finally {
      // 只有当前请求ID匹配时才清除加载状态
      if (loadingPluginIdRef.current === requestId) {
        loadingPluginIdRef.current = null;
        setIsLoadingDetail(false);
      }
    }
  };

  useEffect(() => {
    fetchPluginList();
  }, []);

  // Fetch detail when selected plugin changes
  useEffect(() => {
    if (selectedPluginId) {
      // Check if we already have the detail for this plugin
      const existingPlugin = plugins.find(p => p.id === selectedPluginId);
      if (!existingPlugin) {
        // Need to fetch detail for this plugin
        const pluginInfo = pluginList.find(p => p.id === selectedPluginId);
        if (pluginInfo) {
          fetchPluginDetail(pluginInfo.name);
        }
      }
    }
  }, [selectedPluginId, pluginList, plugins]);

  // Update original state only when switching/loading a plugin detail.
  // Do not depend on the whole selectedPlugin object here: editing config updates
  // plugins state, which creates a new selectedPlugin object. If this effect runs
  // on every edit, it overwrites originalConfig with the edited value and keeps
  // the save button disabled.
  useEffect(() => {
    if (!selectedPlugin) return;
    
    // 如果有正在加载的请求且与当前选中的插件不匹配，跳过（等待新请求）
    // 只有在没有正在加载的请求，或正在加载的请求就是当前选中的插件时，才更新状态
    if (loadingPluginIdRef.current !== null && loadingPluginIdRef.current !== selectedPlugin.id) {
      return;
    }
    
    setOriginalConfig({
      config: JSON.parse(JSON.stringify(selectedPlugin.config)),
      groups: JSON.parse(JSON.stringify(selectedPlugin.config_groups || []))
    });
    
    const processedServiceConfig = selectedPlugin.service_config ? {
      ...selectedPlugin.service_config,
      prefix: filterEmptyPrefix(selectedPlugin.service_config.prefix)
    } : null;
    
    setOriginalServiceConfig(JSON.parse(JSON.stringify(processedServiceConfig)));
    setOriginalSvList(JSON.parse(JSON.stringify(selectedPlugin.sv_list || [])));
    setEditedServiceConfig({
      ...(processedServiceConfig || {}),
      enabled: selectedPlugin.enabled ?? true
    });
    setEditedSvList(JSON.parse(JSON.stringify(selectedPlugin.sv_list || [])));
    setOriginalEnabled(selectedPlugin.enabled ?? true);
    setEditedEnabled(selectedPlugin.enabled ?? true);

    if (selectedPlugin.config_names && selectedPlugin.config_names.length > 0) {
      if (!selectedConfigName || !selectedPlugin.config_names.includes(selectedConfigName)) {
        setSelectedConfigName(selectedPlugin.config_names[0]);
      }
    } else {
      setSelectedConfigName(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlugin?.id]);

  const updateConfigValue = useCallback((pluginId: string, fieldKey: string, value: ConfigValue | RepeatGroupItem[], groupName: string | null) => {
    setPlugins((prev) =>
      prev.map((p) => {
        if (p.id !== pluginId) return p;

        const newPlugin = { ...p };
        if (groupName && newPlugin.config_groups) {
          newPlugin.config_groups = newPlugin.config_groups.map(g => {
            if (g.config_name === groupName) {
              return {
                ...g,
                config: {
                  ...g.config,
                  [fieldKey]: { ...g.config[fieldKey], value }
                }
              };
            }
            return g;
          });
        } else if (newPlugin.config) {
          newPlugin.config = {
            ...newPlugin.config,
            [fieldKey]: { ...newPlugin.config[fieldKey], value }
          };
        }
        return newPlugin;
      })
    );
  }, []);

  // 校验所有配置项的 regex
  const validateAllRegex = (): boolean => {
    if (!selectedPlugin) return true;
    const configsToCheck: Array<{ key: string; field: ConfigFieldDefinition }> = [];
    
    if (selectedPlugin.config_groups && selectedPlugin.config_groups.length > 0) {
      for (const group of selectedPlugin.config_groups) {
        for (const [key, field] of Object.entries(group.config)) {
          configsToCheck.push({ key, field: field as unknown as ConfigFieldDefinition });
        }
      }
    } else if (selectedPlugin.config) {
      for (const [key, field] of Object.entries(selectedPlugin.config)) {
        configsToCheck.push({ key, field: field as unknown as ConfigFieldDefinition });
      }
    }
    
    for (const { key, field } of configsToCheck) {
      if (field.regex && (field.type === 'text' || field.type === 'password')) {
        try {
          const re = new RegExp(field.regex);
          const val = String(field.value || '');
          if (!re.test(val)) {
            toast.error(`配置项"${field.label}"(${key})不符合格式要求: ${field.regex}`);
            return false;
          }
        } catch {
          // 无效正则，跳过
        }
      }
    }
    return true;
  };

  // 保存前对值进行类型特定的转换
  const convertValueForSave = (key: string, field: ConfigFieldDefinition): { skip: boolean; value?: unknown } => {
    const rawType = (field as any).rawType?.toLowerCase?.() || '';
    
    // divider 类型不需要保存
    if (field.type === 'divider' || rawType === 'gsdivider') {
      return { skip: true };
    }
    
    // gsdict: 将 JSON 字符串转回对象
    if (rawType === 'gsdict') {
      try {
        return { skip: false, value: JSON.parse(field.value as string) };
      } catch {
        return { skip: false, value: field.value };
      }
    }
    
    // gslist: 将字符串数组转为整数数组
    if (rawType === 'gslist' && Array.isArray(field.value)) {
      return { skip: false, value: (field.value as string[]).map(Number).filter(n => !isNaN(n)) };
    }
    
    return { skip: false, value: field.value };
  };

  const handleSaveConfig = async () => {
    if (!selectedPlugin) return;
    
    // 先校验 regex
    if (!validateAllRegex()) return;
    
    setIsSavingConfig(true);
    try {
      let payload: any = {};
      
      const buildConfigPayload = (config: Record<string, any>) => {
        const entries: [string, unknown][] = [];
        for (const [k, v] of Object.entries(config)) {
          const result = convertValueForSave(k, v as ConfigFieldDefinition);
          if (!result.skip) {
            entries.push([k, result.value]);
          }
        }
        return Object.fromEntries(entries);
      };
      
      if (selectedPlugin.config_groups && selectedPlugin.config_groups.length > 0) {
        payload = {
          config_groups: selectedPlugin.config_groups.map(g => ({
            config_name: g.config_name,
            config: buildConfigPayload(g.config)
          }))
        };
      } else {
        payload = buildConfigPayload(selectedPlugin.config);
      }
      await pluginsApi.updatePlugin(selectedPlugin.name, payload);

      setOriginalConfig({
        config: JSON.parse(JSON.stringify(selectedPlugin.config)),
        groups: JSON.parse(JSON.stringify(selectedPlugin.config_groups || []))
      });
      toast.success(t('plugins.pluginConfigUpdated'));
    } catch (error) {
      toast.error(t('plugins.updatePluginConfigFailed'));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveService = async () => {
    if (!selectedPlugin) return;
    setIsSavingService(true);
    try {
      // 保存服务配置（包含 enabled 状态），过滤掉prefix中的空字符串
      const servicePayload = {
        ...editedServiceConfig,
        enabled: editedEnabled,
        prefix: filterEmptyPrefix(editedServiceConfig.prefix)
      };
      await pluginsApi.updateServiceConfig(selectedPlugin.name, servicePayload as Record<string, unknown>);

      // 保存 SV 配置
      for (const sv of editedSvList) {
        await pluginsApi.updateSvConfig(selectedPlugin.name, sv.name, sv as unknown as Record<string, unknown>);
      }

      setOriginalServiceConfig(JSON.parse(JSON.stringify({
        ...editedServiceConfig,
        prefix: filterEmptyPrefix(editedServiceConfig.prefix)
      })));
      setOriginalSvList(JSON.parse(JSON.stringify(editedSvList)));
      setOriginalEnabled(editedEnabled);

      toast.success(t('plugins.serviceConfigUpdated'));
    } catch (error) {
      toast.error(t('plugins.updateServiceConfigFailed'));
    } finally {
      setIsSavingService(false);
    }
  };

  // 重载当前插件（reloadPlugin 走 postRaw，看顶层 status/msg，勿用 api.post 解包 data）
  const handleReloadPlugin = async () => {
    if (!selectedPlugin) return;
    const name = selectedPlugin.name;
    setIsReloadingPlugin(true);
    try {
      const result = await pluginsApi.reloadPlugin(name);
      if (result?.status === 0) {
        toast.success(result.msg || t('plugins.reloadPluginSuccess', { name }));
        // 重载会重建 SL：清本地详情缓存并刷新列表/详情
        setPlugins((prev) => prev.filter((p) => p.name !== name && p.id !== selectedPlugin.id));
        await fetchPluginList();
        await fetchPluginDetail(name);
      } else {
        toast.error(
          result?.msg || t('plugins.reloadPluginFailed', { name, error: '' }),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReloadingPlugin(false);
    }
  };

  // 更新全部插件 - 打开确认对话框
  const handleUpdateAllClick = () => {
    setUpdateAllDialogOpen(true);
  };

  // 更新全部插件 - 开始执行
  const handleUpdateAllConfirm = async () => {
    setUpdateAllDialogOpen(false);
    setUpdateAllPanelOpen(true);
    setIsUpdatingAll(true);
    
    // 初始化所有插件状态为 pending
    const initialList: PluginUpdateItem[] = pluginList.map(p => ({ name: p.name, status: 'pending' }));
    setPluginUpdateList(initialList);

    // 并行更新所有插件
    const updatePromises = pluginList.map(async (plugin) => {
      // 更新状态为 updating
      setPluginUpdateList(prev => prev.map(p =>
        p.name === plugin.name ? { ...p, status: 'updating' } : p
      ));
      
      try {
        // api.post 已解包：返回 GitForceUpdateResponse（{ success, message, current_commit }）
        const result = await gitUpdateApi.forceUpdate(plugin.name);
        if (result?.success) {
          setPluginUpdateList(prev => prev.map(p =>
            p.name === plugin.name
              ? { ...p, status: 'success', message: result.message }
              : p
          ));
        } else {
          setPluginUpdateList(prev => prev.map(p =>
            p.name === plugin.name
              ? { ...p, status: 'failed', message: result?.message || t('plugins.updateFailed') }
              : p
          ));
        }
      } catch (error) {
        setPluginUpdateList(prev => prev.map(p =>
          p.name === plugin.name
            ? {
                ...p,
                status: 'failed',
                message: error instanceof Error ? error.message : String(error),
              }
            : p
        ));
      }
    });

    await Promise.all(updatePromises);
    setIsUpdatingAll(false);
  };

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold tracking-tight flex items-center gap-3">
              <Settings className="h-8 w-8 shrink-0" />
              {t('plugins.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground">{t('plugins.description')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateAllClick}
                    disabled={isLoading || pluginList.length === 0}
                    className="gap-2 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    {t('plugins.updateAllPlugins')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('plugins.updateAllPluginsDesc')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReloadPlugin}
                    disabled={!selectedPlugin || isReloadingPlugin}
                    className="gap-2 whitespace-nowrap"
                  >
                    <RotateCw className={`w-4 h-4 ${isReloadingPlugin ? 'animate-spin' : ''}`} />
                    {t('plugins.reloadPlugin')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('plugins.reloadPlugin')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      }
      toolbar={
        /* 插件选择：随标题常驻 */
        <TabButtonGroup
          options={pluginList.map((plugin) => ({
            value: plugin.id,
            label: plugin.name,
            icon: (
              <PluginIcon pluginName={plugin.name} />
            ),
          }))}
          value={selectedPluginId}
          onValueChange={setSelectedPluginId}
        />
      }
    >
      {isLoading || isLoadingDetail ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">{t('plugins.loadingPluginConfig')}</p>
          </CardContent>
        </Card>
      ) : selectedPlugin ? (
        <Card key={selectedPlugin.id} className="glass-card">
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center overflow-hidden">
                <PluginIcon pluginName={selectedPlugin.name} className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{selectedPlugin.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedPlugin.description}</p>
              </div>
            </div>
          </div>

          <CardContent className="pt-0 space-y-6">
            <Separator />

            {/* 服务配置区域 - 重新设计为与Core配置一致的风格 */}
            <Collapsible defaultOpen={false} className="group/service">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-background/50 rounded-xl p-4 border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center text-primary">
                      <Server className="w-6 h-6" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{t('plugins.serviceConfig')}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{t('plugins.serviceConfigDesc')}</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/service:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* Plugin服务配置 - 独立可折叠 */}
                <Collapsible defaultOpen={true} className="group/plugin">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-muted/30 rounded-lg p-3 border">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center text-primary">
                          <Package className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold">{t('plugins.pluginServiceConfig')}</h4>
                          <p className="text-muted-foreground text-sm">{t('plugins.pluginServiceConfigDesc')}</p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/plugin:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-10">
                    {/* 汇总所有SV命令Tags - 默认折叠，展开时才渲染 */}
                    {allCommands.length > 0 && (
                      <Collapsible defaultOpen={false} className="group/allCmds mb-6">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity py-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Command className="w-4 h-4" />
                              {t('plugins.allCommands')} ({allCommands.length})
                            </Label>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/allCmds:rotate-180" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="flex flex-wrap items-center gap-1.5 pb-4 border-b">
                            <TooltipProvider delayDuration={300}>
                              {allCommands.map((cmd: SvCommand, cmdIndex: number) => {
                                const colorClass = CMD_TYPE_COLORS[cmd.type] || CMD_TYPE_DEFAULT_COLOR;
                                
                                return (
                                  <Tooltip key={cmdIndex}>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs cursor-pointer transition-colors ${colorClass}`}
                                      >
                                        {cmd.type === 'regex' ? simplifyRegexKeyword(cmd.keyword) : cmd.keyword}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs z-50 bg-white dark:bg-gray-900 border shadow-lg">
                                      <div className="space-y-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{t('plugins.commandTrigger')}</p>
                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-gray-700 dark:text-gray-300">
                                          <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandType')}:</span>
                                          <span className="text-gray-900 dark:text-gray-100">{t(`plugins.triggerTypes.${cmd.type}`) || cmd.type}</span>
                                          <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandKeyword')}:</span>
                                          <span className="font-mono break-all text-gray-900 dark:text-gray-100">{cmd.keyword}</span>
                                          <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandBlock')}:</span>
                                          <span className="text-gray-900 dark:text-gray-100">{cmd.block ? '✓' : '✗'}</span>
                                          <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandToMe')}:</span>
                                          <span className="text-gray-900 dark:text-gray-100">{cmd.to_me ? '✓' : '✗'}</span>
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </TooltipProvider>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                {/* 插件状态 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    {t('plugins.pluginStatus')}
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedEnabled}
                      onCheckedChange={(checked) => setEditedEnabled(checked)}
                    />
                    <span className="text-sm text-muted-foreground">{editedEnabled ? t('plugins.enabled') : t('plugins.disabled')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('plugins.permissionLevel')}
                  </Label>
                  <Select
                    value={String(editedServiceConfig.pm || 0)}
                    onValueChange={(v) => setEditedServiceConfig(prev => ({ ...prev, pm: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => (
                        <SelectItem key={v} value={String(v)}>{t('plugins.permissionLevels.' + v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* {t('plugins.priority')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {t('plugins.priority')}
                  </Label>
                  <Input
                    type="number"
                    className="bg-background h-10"
                    value={editedServiceConfig.priority || 0}
                    onChange={(e) => setEditedServiceConfig(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    placeholder={t('plugins.enterPriority')}
                  />
                </div>

                {/* {t('plugins.responseArea')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {t('plugins.responseArea')}
                  </Label>
                  <Select
                    value={editedServiceConfig.area || 'ALL'}
                    onValueChange={(v) => setEditedServiceConfig(prev => ({ ...prev, area: v }))}
                  >
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全局</SelectItem>
                      <SelectItem value="DIRECT">仅限私聊</SelectItem>
                      <SelectItem value="GROUP">仅限群聊</SelectItem>
                      <SelectItem value="SV">SV服务</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* {t('plugins.pluginWhiteList')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {t('plugins.pluginWhiteList')}
                  </Label>
                  <ConfigField
                    fieldKey="white_list"
                    field={{
                      type: 'tags',
                      label: t('plugins.pluginWhiteList'),
                      value: editedServiceConfig.white_list || [],
                      placeholder: t('plugins.enterWhitelistContent')
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* {t('plugins.pluginBlackList')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('plugins.pluginBlackList')}
                  </Label>
                  <ConfigField
                    fieldKey="black_list"
                    field={{
                      type: 'tags',
                      label: t('plugins.pluginBlackList'),
                      value: editedServiceConfig.black_list || [],
                      placeholder: t('plugins.enterBlacklistContent')
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* {t('plugins.disablePrefix')} */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2 shrink-0">
                      <Key className="w-4 h-4" />
                      {t('plugins.disablePrefix')}
                    </Label>
                    {/* force_prefix 只读显示 - 带颜色的tags */}
                    {Array.isArray(editedServiceConfig.force_prefix) && editedServiceConfig.force_prefix.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">强制前缀：</span>
                        {editedServiceConfig.force_prefix.map((prefix: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                            {prefix}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedServiceConfig.disable_force_prefix || false}
                      onCheckedChange={(checked) => setEditedServiceConfig(prev => ({ ...prev, disable_force_prefix: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">{t('plugins.disablePrefixDesc')}</span>
                  </div>
                </div>

                {/* {t('plugins.allowEmptyPrefix')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    {t('plugins.allowEmptyPrefix')}
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedServiceConfig.allow_empty_prefix || false}
                      onCheckedChange={(checked) => setEditedServiceConfig(prev => ({ ...prev, allow_empty_prefix: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">允许空命令前缀</span>
                  </div>
                </div>

                {/* prefix 可编辑 - 使用tags组件 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    prefix
                  </Label>
                  <ConfigField
                    fieldKey="prefix"
                    field={{
                      type: 'tags',
                      label: 'prefix',
                      value: editedServiceConfig.prefix || [],
                      placeholder: '输入前缀内容'
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* SV 服务列表配置 - 独立可折叠 */}
                {editedSvList && editedSvList.length > 0 && (
                  <Collapsible defaultOpen={false} className="group/svConfig mt-8">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-muted/30 rounded-lg p-3 border">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center text-primary">
                            <Command className="w-5 h-5" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold">SV 服务配置</h4>
                            <p className="text-muted-foreground text-sm">管理单个服务的详细配置</p>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/svConfig:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-10">
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {editedSvList.map((sv, index) => (
                      <Card key={`${sv.name}-${index}`} className="glass-card border h-full flex flex-col">
                        <CardContent className="p-6 space-y-4 flex-1">
                          {/* SV名称 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-primary" />
                              <span className="font-medium">{sv.name}</span>
                            </div>
                            <Switch
                              checked={sv.enabled}
                              onCheckedChange={(checked) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, enabled: checked };
                                setEditedSvList(newSvList);
                              }}
                            />
                          </div>

                          {/* {t('plugins.permissionLevel')} */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              {t('plugins.permissionLevel')}
                            </Label>
                            <Select
                              value={String(sv.pm || 0)}
                              onValueChange={(v) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, pm: parseInt(v) };
                                setEditedSvList(newSvList);
                              }}
                            >
                              <SelectTrigger className="bg-background h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => (
                                  <SelectItem key={v} value={String(v)}>{t('plugins.permissionLevels.' + v)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* {t('plugins.priority')} */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              {t('plugins.priority')}
                            </Label>
                            <Input
                              type="number"
                              className="bg-background h-9"
                              value={sv.priority || 0}
                              onChange={(e) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, priority: parseInt(e.target.value) || 0 };
                                setEditedSvList(newSvList);
                              }}
                              placeholder={t('plugins.enterPriority')}
                            />
                          </div>

                          {/* {t('plugins.responseArea')} */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              {t('plugins.responseArea')}
                            </Label>
                            <Select
                              value={sv.area || 'ALL'}
                              onValueChange={(v) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, area: v };
                                setEditedSvList(newSvList);
                              }}
                            >
                              <SelectTrigger className="bg-background h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">{t('plugins.global')}</SelectItem>
                                <SelectItem value="DIRECT">{t('plugins.directOnly')}</SelectItem>
                                <SelectItem value="GROUP">{t('plugins.groupOnly')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* {t('plugins.whiteList')} / {t('plugins.blackList')} */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                {t('plugins.whiteList')}
                              </Label>
                              <ConfigField
                                fieldKey={`sv_${index}_white_list`}
                                field={{
                                  type: 'tags',
                                  label: t('plugins.whiteList'),
                                  value: sv.white_list || [],
                                  placeholder: t('plugins.enterWhitelistContent')
                                }}
                                onChange={(fieldKey, value) => {
                                  const newSvList = [...editedSvList];
                                  newSvList[index] = { ...sv, white_list: value as unknown as string[] };
                                  setEditedSvList(newSvList);
                                }}
                                showLabel={false}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {t('plugins.blackList')}
                              </Label>
                              <ConfigField
                                fieldKey={`sv_${index}_black_list`}
                                field={{
                                  type: 'tags',
                                  label: t('plugins.blackList'),
                                  value: sv.black_list || [],
                                  placeholder: t('plugins.enterBlacklistContent')
                                }}
                                onChange={(fieldKey, value) => {
                                  const newSvList = [...editedSvList];
                                  newSvList[index] = { ...sv, black_list: value as unknown as string[] };
                                  setEditedSvList(newSvList);
                                }}
                                showLabel={false}
                              />
                            </div>
                          </div>

                          {/* 命令Tags - 默认折叠 */}
                          {sv.commands && sv.commands.length > 0 ? (
                            <Collapsible defaultOpen={false} className="group/cmds">
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Command className="w-4 h-4" />
                                    命令 ({sv.commands.length})
                                  </Label>
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/cmds:rotate-180" />
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                  <TooltipProvider delayDuration={300}>
                                    {sv.commands.map((cmd: SvCommand, cmdIndex: number) => {
                                      const colorClass = CMD_TYPE_COLORS[cmd.type] || CMD_TYPE_DEFAULT_COLOR;
                                      const displayText = cmd.type === 'regex' ? simplifyRegexKeyword(cmd.keyword) : cmd.keyword;
                                      return (
                                        <Tooltip key={cmdIndex}>
                                          <TooltipTrigger asChild>
                                            <span
                                              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs cursor-pointer transition-colors ${colorClass}`}
                                            >
                                              {displayText}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs z-50 bg-white dark:bg-gray-900 border shadow-lg">
                                            <div className="space-y-1">
                                              <p className="font-medium text-gray-900 dark:text-gray-100">{t('plugins.commandTrigger')}</p>
                                              <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-gray-700 dark:text-gray-300">
                                                <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandType')}:</span>
                                                <span className="text-gray-900 dark:text-gray-100">{t(`plugins.triggerTypes.${cmd.type}`) || cmd.type}</span>
                                                <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandKeyword')}:</span>
                                                <span className="font-mono break-all text-gray-900 dark:text-gray-100">{cmd.keyword}</span>
                                                <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandBlock')}:</span>
                                                <span className="text-gray-900 dark:text-gray-100">{cmd.block ? '✓' : '✗'}</span>
                                                <span className="text-gray-500 dark:text-gray-400">{t('plugins.commandToMe')}:</span>
                                                <span className="text-gray-900 dark:text-gray-100">{cmd.to_me ? '✓' : '✗'}</span>
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </TooltipProvider>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Command className="w-4 h-4" />
                                命令
                              </Label>
                              <span className="text-xs text-muted-foreground">无</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* 服务配置保存按钮 - 放在最外层 */}
              <div className="flex items-center justify-end mt-8">
                <Button
                  size="lg"
                  className="gap-2 min-w-[160px] h-11"
                  disabled={!isServiceDirty || isSavingService}
                  onClick={handleSaveService}
                >
                  {isSavingService ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  确认修改
                </Button>
              </div>

              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* 参数配置区域 - 默认展开 */}
            <Collapsible defaultOpen={true} className="group/config">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-background/50 rounded-xl p-4 border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center text-primary">
                      <Settings className="w-6 h-6" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{t('plugins.configParams')}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{t('plugins.configParamsDesc')}</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/config:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-10">
                {selectedPlugin.config_names && selectedPlugin.config_names.length > 1 && (
                  <div className="mb-4">
                    <TabButtonGroup
                      options={selectedPlugin.config_names.map((name: string, index: number) => ({
                        value: name,
                        label: name,
                        icon: getConfigIcon(name, index),
                      }))}
                      value={selectedConfigName || ''}
                      onValueChange={(val) => val && setSelectedConfigName(val)}
                    />
                  </div>
                )}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const currentGroup = selectedPlugin.config_groups?.find(g => g.config_name === selectedConfigName);
                    const displayConfig = currentGroup ? currentGroup.config : selectedPlugin.config;

                    const entries = Object.entries(displayConfig);
                    if (entries.length === 0) {
                      return (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                          <p>{t('plugins.noConfigItems')}</p>
                        </div>
                      );
                    }

                    return entries.map(([key, field]) => {
                      const fieldDef = field as unknown as ConfigFieldDefinition;
                      // divider / repeatgroup 类型需要占据整行
                      const isFullWidth = fieldDef.type === 'divider' || fieldDef.type === 'repeatgroup';
                      if (fieldDef.type === 'repeatgroup') {
                        const groupValue = Array.isArray(fieldDef.value) ? (fieldDef.value as unknown as RepeatGroupItem[]) : [];
                        return (
                          <div key={`${selectedConfigName}_${key}`} className="col-span-full">
                            <RepeatGroupField
                              fieldKey={key}
                              template={fieldDef.template || {}}
                              value={groupValue}
                              onChange={(fieldKey, value) => updateConfigValue(selectedPlugin.id, fieldKey, value, selectedConfigName)}
                              title={fieldDef.label}
                              description={fieldDef.description}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={`${selectedConfigName}_${key}`} className={isFullWidth ? 'col-span-full' : undefined}>
                          <ConfigField
                            fieldKey={key}
                            field={fieldDef}
                            onChange={(fieldKey, value) => updateConfigValue(selectedPlugin.id, fieldKey, value, selectedConfigName)}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="flex items-center justify-end mt-6">
                  <Button
                    size="lg"
                    className="gap-2 min-w-[160px] h-11"
                    disabled={!isConfigDirty || isSavingConfig}
                    onClick={handleSaveConfig}
                  >
                    {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    确认修改
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>请先选择要配置的插件</p>
          </CardContent>
        </Card>
      )}

      {/* 更新全部插件确认对话框 */}
      <AlertDialog open={updateAllDialogOpen} onOpenChange={setUpdateAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('plugins.updateAllPlugins')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('plugins.updateAllPluginsConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateAllConfirm}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 更新全部插件状态面板 */}
      {updateAllPanelOpen && (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="w-5 h-5" />
                {t('plugins.updateAllPlugins')}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUpdateAllPanelOpen(false)}
              >
                {t('common.close')}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('plugins.pluginSelection')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('common.error')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pluginUpdateList.map((plugin) => (
                    <TableRow key={plugin.name}>
                      <TableCell className="font-medium">{plugin.name}</TableCell>
                      <TableCell>
                        {plugin.status === 'pending' && (
                          <Badge variant="secondary">{t('plugins.updatePending')}</Badge>
                        )}
                        {plugin.status === 'updating' && (
                          <Badge variant="default" className="gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t('plugins.updating')}
                          </Badge>
                        )}
                        {plugin.status === 'success' && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            {t('plugins.updateSuccess')}
                          </Badge>
                        )}
                        {plugin.status === 'failed' && (
                          <Badge variant="destructive">
                            {t('plugins.updateFailed')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {plugin.message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </PinnedPage>
  );
}
