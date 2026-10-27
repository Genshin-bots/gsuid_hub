import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigGrid, TagsInput, pluginConfigItemToFieldDef } from '@/components/config';
import type { ConfigFormData, ConfigValue } from '@/components/config';
import { CheckListField } from '@/components/config/CheckListField';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Plus,
  Copy,
  Trash2,
  Sparkles,
  User,
  Check,
  Brain,
  Bot,
  RefreshCw,
  Search,
  Image as ImageIcon,
  Music,
  FileText,
  Upload,
  Play,
  Pause,
  Eye,
  Volume2,
  ImagePlus,
  Music2,
  Globe,
  Users,
  PowerOff,
  Settings,
  AlertCircle,
  MessageSquare,
  MessageCircle,
  MessagesSquare,
  Clock,
  Compass,
  X,
  Layers,
  ScrollText,
  AlignLeft,
  Smile,
} from 'lucide-react';
import { PersonaMemePackTab } from '@/components/persona/PersonaMemePackTab';
// 支持的音频格式
const SUPPORTED_AUDIO_FORMATS = ['mp3', 'ogg', 'wav', 'm4a', 'flac'];
const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg', // mp3
  'audio/ogg', // ogg
  'audio/wav', // wav
  'audio/x-m4a', // m4a
  'audio/flac', // flac
  'audio/mp3', // mp3 (alternative)
  'audio/wave', // wav (alternative)
];
import {
  getApiErrorMessage,
  personaApi,
  promptGroupApi,
  frameworkConfigApi,
  capabilityAgentsApi,
  type AgentNodeItem,
  type PersonaListItem,
  type PersonaFrameworkConfig,
  type PersonaConfig,
  type PersonaScope,
  type AIMode,
  type AutonomyCareZone,
  type PluginConfigItem,
  type PersonaToolCatalog,
  type SpeechShapeSpec,
} from '@/lib/api';
import { FALLBACK_SPEECH_SHAPE, SPEECH_SOFT_MAX, SPEECH_SOFT_MIN } from '@/lib/speechShape';
import { toast } from 'sonner';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { GlassAlert } from '@/components/ui/glass-alert';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import {
  activePromptGroupLines,
  DEFAULT_PROMPT_GROUP,
} from '@/components/persona/activePromptGroups';
import {
  PromptGroupPanel,
  type PromptGroupPanelHandle,
} from '@/components/persona/PromptGroupPanel';
import { CapabilityAgentsPanel } from '@/components/persona/CapabilityAgentsPanel';
import { useCapabilityAgents } from '@/components/persona/useCapabilityAgents';
import { enabledIdsToSpec, specToEnabledIds } from '@/lib/capabilityAgentAllowlist';
import { enabledPluginsToSpec, specToEnabledPlugins } from '@/lib/personaToolScope';
import { PersonaToolScopeEditor } from '@/components/persona/PersonaToolScopeEditor';
// ============================================================================
// 类型定义
// ============================================================================
interface PersonaCardData extends PersonaListItem {
  enabled: boolean;
  groups: string[];
  content: string;
  config?: PersonaConfig;
}
// AI 模式选项
const AI_MODE_OPTIONS: {
  value: AIMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: '提及应答',
    label: '提及应答',
    icon: <MessageSquare className="w-4 h-4" />,
    description: '被@时自动回复',
  },
  {
    value: '定时巡检',
    label: '定时巡检',
    icon: <Clock className="w-4 h-4" />,
    description: '定时检查处理任务',
  },
  {
    value: '命令补充',
    label: '命令补充',
    icon: <MessageCircle className="w-4 h-4" />,
    description: '命令返回后再补一句',
  },
  {
    value: '自主行动',
    label: '自主行动',
    icon: <Compass className="w-4 h-4" />,
    description: '空闲时自己看一眼，再决定要不要说',
  },
];
const SCOPE_OPTIONS: {
  value: PersonaScope;
  labelKey: string;
  descKey: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'disabled',
    labelKey: 'personaConfig.scopeDisabled',
    descKey: 'personaConfig.scopeDisabledDesc',
    icon: <PowerOff className="w-4 h-4" />,
  },
  {
    value: 'specific',
    labelKey: 'personaConfig.scopeSpecific',
    descKey: 'personaConfig.scopeSpecificDesc',
    icon: <Users className="w-4 h-4" />,
  },
  {
    value: 'global',
    labelKey: 'personaConfig.scopeGlobal',
    descKey: 'personaConfig.scopeGlobalDesc',
    icon: <Globe className="w-4 h-4" />,
  },
  {
    value: 'global_group',
    labelKey: 'personaConfig.scopeGlobalGroup',
    descKey: 'personaConfig.scopeGlobalGroupDesc',
    icon: <MessagesSquare className="w-4 h-4" />,
  },
  {
    value: 'global_private',
    labelKey: 'personaConfig.scopeGlobalPrivate',
    descKey: 'personaConfig.scopeGlobalPrivateDesc',
    icon: <MessageCircle className="w-4 h-4" />,
  },
];
const CONFIG_OPTION_BUTTON =
  'flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 transition-colors text-left min-h-[3.5rem]';
/** 常驻直装工具名：每轮必然在场，白名单里默认勾上，其余工具才需要用户显式钉。 */
function collectAlwaysMountedTools(catalog: PersonaToolCatalog | null): string[] {
  if (!catalog) return [];
  const names = new Set<string>();
  for (const tools of Object.values(catalog.tools ?? {})) {
    for (const tool of tools) {
      if (tool.always_mounted) names.add(tool.name);
    }
  }
  return Array.from(names).sort();
}
const CARD_BADGE = 'h-5 px-1.5 text-[10px] font-sans font-medium';
function isGlobalLikeScope(scope: PersonaScope | undefined): boolean {
  return scope === 'global' || scope === 'global_group' || scope === 'global_private';
}
function findConflictingPersonas(
  configs: Record<string, PersonaConfig>,
  personaName: string,
  newScope: PersonaScope,
): string[] {
  if (!isGlobalLikeScope(newScope)) return [];
  return Object.entries(configs)
    .filter(([name, cfg]) => name !== personaName && isGlobalLikeScope(cfg.scope))
    .map(([name]) => name);
}
// ============================================================================
// 工具函数
// ============================================================================
// 截取 markdown 文本的预览内容
function settingsToFormData(config: Record<string, PluginConfigItem>): ConfigFormData {
  const out: ConfigFormData = {};
  for (const [key, item] of Object.entries(config)) {
    out[key] = pluginConfigItemToFieldDef(key, item);
  }
  return out;
}
function settingsToPayload(config: Record<string, PluginConfigItem>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(config)) {
    const rawType = (item.type || '').toLowerCase();
    if (rawType === 'gsdivider') continue;
    payload[key] = item.value;
  }
  return payload;
}
function getMarkdownPreview(content: string, maxLength: number = 100): string {
  if (!content) return '';
  const cleaned = content
    .replace(/^#+ .*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength) + '...';
}
// 将文件转换为 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
// 获取范围标签样式
function getScopeBadgeStyle(scope: PersonaScope) {
  switch (scope) {
    case 'global':
      return 'bg-blue-500/15 text-blue-600 border border-blue-500/30';
    case 'global_group':
      return 'bg-sky-500/15 text-sky-600 border border-sky-500/30';
    case 'global_private':
      return 'bg-violet-500/15 text-violet-600 border border-violet-500/30';
    case 'specific':
      return 'bg-green-500/15 text-green-600 border border-green-500/30';
    case 'disabled':
    default:
      return 'bg-gray-500/15 text-gray-500 border border-gray-500/30';
  }
}
function speechShapeOf(config: PersonaConfig | undefined): SpeechShapeSpec {
  const shape = config?.speech_shape;
  if (!shape || shape.tiers.length === 0) return FALLBACK_SPEECH_SHAPE;
  return shape;
}

function boundInt(raw: string, min: number, max: number, fallback: number): number {
  if (!/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getScopeLabel(scope: PersonaScope, t: (key: string) => string) {
  switch (scope) {
    case 'global':
      return t('personaConfig.scopeGlobal');
    case 'global_group':
      return t('personaConfig.scopeGlobalGroup');
    case 'global_private':
      return t('personaConfig.scopeGlobalPrivate');
    case 'specific':
      return t('personaConfig.scopeSpecific');
    case 'disabled':
    default:
      return t('personaConfig.scopeDisabled');
  }
}
// ============================================================================
// 组件定义
// ============================================================================
function clampProbability(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const stepped = Math.round(value * 20) / 20;
  return Math.min(1, Math.max(0, stepped));
}

function formatProbability(value: number): string {
  return String(Math.round(value * 100) / 100);
}

const ASIDE_IMAGE_DEFAULT = 0.2;
const ASIDE_TEXT_DEFAULT = 0.35;
const ASIDE_MIXED_DEFAULT = 0.25;
const ACTIVE_HOURS_DEFAULT = ['08:00-23:30'];
const AUTONOMY_INTERVAL_DEFAULT = 45;
const TIMEZONE_OPTIONS = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

function timezoneChoices(current: string): string[] {
  if (TIMEZONE_OPTIONS.includes(current)) return TIMEZONE_OPTIONS;
  return [current, ...TIMEZONE_OPTIONS];
}

function boundedInt(raw: string, low: number, high: number, fallback: number): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(high, Math.max(low, value));
}

function knownAIModes(modes: readonly string[] | undefined): AIMode[] {
  if (!modes) return [];
  const known = new Set<string>(AI_MODE_OPTIONS.map((mode) => mode.value));
  const out: AIMode[] = [];
  for (const mode of modes) {
    let item = mode;
    if (mode === '余韵点评' || mode === '命令接话') item = '命令补充';
    if (mode === '自由活动') item = '自主行动';
    if (!known.has(item)) continue;
    if (out.includes(item as AIMode)) continue;
    out.push(item as AIMode);
  }
  return out;
}

function asideBadge(config: PersonaConfig | undefined, toolsMark: string): string {
  const image = Math.round((config?.aside_image_probability ?? ASIDE_IMAGE_DEFAULT) * 100);
  const text = Math.round((config?.aside_text_probability ?? ASIDE_TEXT_DEFAULT) * 100);
  const mixed = Math.round((config?.aside_mixed_probability ?? ASIDE_MIXED_DEFAULT) * 100);
  const probs = `${image}·${text}·${mixed}`;
  return toolsMark ? `${probs}·${toolsMark}` : probs;
}

function SpeechSliderField({
  id,
  icon,
  label,
  description,
  raw,
  min,
  max,
  fallback,
  onChange,
}: {
  id: string;
  icon?: ReactNode;
  label: string;
  description: string;
  raw: string;
  min: number;
  max: number;
  fallback: number;
  onChange: (value: string) => void;
}) {
  const value = boundInt(raw, min, max, fallback);
  return (
    <div className="space-y-3">
      <LabelWithHelp
        htmlFor={id}
        icon={icon}
        label={label}
        description={description}
        className="text-base font-medium"
      />
      <div className="flex items-center gap-3">
        <Slider
          aria-label={label}
          className="min-w-0 flex-1"
          min={min}
          max={max}
          step={1}
          value={[value]}
          onValueChange={(next) => {
            const picked = next[0];
            if (picked !== undefined) onChange(String(picked));
          }}
        />
        <Input
          id={id}
          inputMode="numeric"
          aria-label={label}
          min={min}
          max={max}
          value={raw}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          onBlur={() => onChange(String(value))}
          className="h-10 w-16 shrink-0 px-2 text-center tabular-nums"
        />
      </div>
    </div>
  );
}

function ProbabilityField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [raw, setRaw] = useState(formatProbability(value));
  useEffect(() => {
    setRaw(formatProbability(value));
  }, [value]);
  return (
    <div className={cn('space-y-2', disabled && 'opacity-50')}>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <Slider
          aria-label={label}
          disabled={disabled}
          className="min-w-0 flex-1"
          min={0}
          max={1}
          step={0.05}
          value={[value]}
          onValueChange={(next) => {
            const picked = next[0];
            if (picked !== undefined) onChange(clampProbability(picked, value));
          }}
        />
        <Input
          id={id}
          disabled={disabled}
          inputMode="decimal"
          aria-label={label}
          min={0}
          max={1}
          step={0.05}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          onBlur={() => {
            const parsed = clampProbability(Number(raw), value);
            onChange(parsed);
            setRaw(formatProbability(parsed));
          }}
          className="h-10 w-16 shrink-0 px-2 text-center tabular-nums"
        />
      </div>
    </div>
  );
}

function SpeechFields({
  shape,
  chatStyleText,
  speechSoftText,
  onChatStyleText,
  onSpeechSoftText,
}: {
  shape: SpeechShapeSpec;
  chatStyleText: string;
  speechSoftText: string;
  onChatStyleText: (value: string) => void;
  onSpeechSoftText: (value: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
      <SpeechSliderField
        id="persona-chat-style"
        icon={<MessagesSquare className="h-4 w-4" />}
        label={t('personaConfig.chatStyle')}
        description={t('personaConfig.chatStyleHint')}
        raw={chatStyleText}
        min={shape.chat_style_min}
        max={shape.chat_style_max}
        fallback={50}
        onChange={onChatStyleText}
      />
      <SpeechSliderField
        id="persona-speech-soft"
        icon={<AlignLeft className="h-4 w-4" />}
        label={t('personaConfig.speechSoft')}
        description={t('personaConfig.speechSoftHint', { count: shape.soft_default })}
        raw={speechSoftText}
        min={SPEECH_SOFT_MIN}
        max={SPEECH_SOFT_MAX}
        fallback={shape.soft_default}
        onChange={onSpeechSoftText}
      />
    </div>
  );
}

export default function PersonaConfigPage() {
  const { style, mode } = useTheme();
  const sheetOverlay = mode === 'dark' ? 'bg-black/50' : 'bg-white/40';
  const promptPanelRef = useRef<PromptGroupPanelHandle>(null);
  const { t } = useLanguage();
  const isGlass = style !== 'solid';
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const initialTab =
    rawTab === 'capability-agents' || rawTab === 'capabilityAgents'
      ? 'capabilityAgents'
      : rawTab === 'prompts'
        ? 'prompts'
        : 'personas';
  const [libraryView, setLibraryViewState] = useState<'prompts' | 'personas' | 'capabilityAgents'>(
    initialTab,
  );

  const setLibraryView = useCallback(
    (next: 'prompts' | 'personas' | 'capabilityAgents') => {
      setLibraryViewState(next);
      setSearchParams(
        next === 'capabilityAgents'
          ? { tab: 'capability-agents' }
          : next === 'prompts'
            ? { tab: 'prompts' }
            : {},
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'capability-agents' || tabParam === 'capabilityAgents') {
      setLibraryViewState('capabilityAgents');
    } else if (tabParam === 'prompts') {
      setLibraryViewState('prompts');
    } else {
      setLibraryViewState('personas');
    }
  }, [searchParams]);

  const capability = useCapabilityAgents();
  // 状态
  const [personaList, setPersonaList] = useState<PersonaListItem[]>([]);
  const [personaDetails, setPersonaDetails] = useState<Record<string, PersonaCardData>>({});
  const [personaConfigs, setPersonaConfigs] = useState<Record<string, PersonaConfig>>({});
  const [heartbeatStatus, setHeartbeatStatus] = useState<
    Record<
      string,
      {
        enabled: boolean;
        job_registered: boolean;
        inspect_interval: number | null;
        job_id: string | null;
      }
    >
  >({});
  const [frameworkConfig, setFrameworkConfig] = useState<PersonaFrameworkConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  // AI 创建对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaQuery, setNewPersonaQuery] = useState('');
  // 手动创建对话框状态
  const [createManuallyDialogOpen, setCreateManuallyDialogOpen] = useState(false);
  const [newPersonaContent, setNewPersonaContent] = useState('');
  // 编辑对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<PersonaCardData | null>(null);
  const builtinPersona = editingPersona?.builtin === true || editingPersona?.name === '早柚';
  const [promptGroupNames, setPromptGroupNames] = useState<string[]>(['默认']);
  const [editingPromptGroup, setEditingPromptGroup] = useState('默认');
  const [speechShape, setSpeechShape] = useState<SpeechShapeSpec>(FALLBACK_SPEECH_SHAPE);
  const [chatStyleText, setChatStyleText] = useState('50');
  const [speechSoftText, setSpeechSoftText] = useState('60');
  const [editContent, setEditContent] = useState('');
  const [editingGroups, setEditingGroups] = useState<string[]>([]);
  const [editingAIModes, setEditingAIModes] = useState<AIMode[]>([]);
  const [editingScope, setEditingScope] = useState<PersonaScope>('disabled');
  const [editingInspectInterval, setEditingInspectInterval] = useState<number>(10);
  const [editingKeywords, setEditingKeywords] = useState<string[]>([]);
  const [asideImage, setAsideImage] = useState(ASIDE_IMAGE_DEFAULT);
  const [asideText, setAsideText] = useState(ASIDE_TEXT_DEFAULT);
  const [asideMixed, setAsideMixed] = useState(ASIDE_MIXED_DEFAULT);
  const [asideAllowTools, setAsideAllowTools] = useState(false);
  const [activeHours, setActiveHours] = useState<string[]>(ACTIVE_HOURS_DEFAULT);
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [autonomyInterval, setAutonomyInterval] = useState(AUTONOMY_INTERVAL_DEFAULT);
  const [careMinZone, setCareMinZone] = useState<AutonomyCareZone>('familiar');
  const [allowMemeReply, setAllowMemeReply] = useState(true);
  // 字段都由 AI 行动模式带出。关掉时不隐藏、只冻结，避免这一行塌掉。
  const showInspectInterval = editingAIModes.includes('定时巡检');
  const showTriggerKeywords = editingAIModes.includes('提及应答');
  const showAside = editingAIModes.includes('命令补充');
  const showAutonomy = editingAIModes.includes('自主行动');
  const showActiveHours = showInspectInterval || showAutonomy;
  const [editingToolNames, setEditingToolNames] = useState<string[]>([]);
  const [editingEnabledPlugins, setEditingEnabledPlugins] = useState<string[]>([]);
  const [toolCatalog, setToolCatalog] = useState<PersonaToolCatalog | null>(null);
  const [delegableAgents, setDelegableAgents] = useState<AgentNodeItem[]>([]);
  const [editingEnabledAgents, setEditingEnabledAgents] = useState<string[]>([]);
  const [editingSettings, setEditingSettings] = useState<Record<string, PluginConfigItem>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('markdown');
  // 音频播放状态
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 文件上传状态
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  // 二次确认对话框状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [scopeChangeConfirmOpen, setScopeChangeConfirmOpen] = useState(false);
  const [pendingScopeChange, setPendingScopeChange] = useState<{
    personaName: string;
    newScope: PersonaScope;
    conflicts: string[];
  } | null>(null);
  // 图片预览对话框
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewImageTitle, setPreviewImageTitle] = useState('');
  // 统一文件上传引用和状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetPersona, setUploadTargetPersona] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'avatar' | 'image' | 'audio'>('avatar');
  // 资源刷新时间戳 - 用于强制刷新图片缓存
  const [resourceTimestamp, setResourceTimestamp] = useState<number>(Date.now());
  // 获取启用人格列表
  const enabledPersonas = useMemo(() => {
    return frameworkConfig?.config?.enable_persona?.value || [];
  }, [frameworkConfig]);
  // 获取人格对应的群聊映射
  const personaGroupsMap = useMemo(() => {
    return frameworkConfig?.config?.persona_for_session?.value || {};
  }, [frameworkConfig]);
  // 可委派能力代理：列表项（node_id 为主键，display_name 兜底）
  const capabilityAgentItems = useMemo(
    () =>
      delegableAgents.map((a) => ({
        value: a.node_id,
        label: a.display_name || a.node_id,
        description: a.when_to_use || a.node_id,
      })),
    [delegableAgents],
  );
  // 获取所有人格卡片数据
  const personaCards = useMemo(() => {
    return personaList.map((item) => {
      const config = personaConfigs[item.name];
      return {
        ...item,
        enabled: enabledPersonas.includes(item.name),
        groups: config?.target_groups || personaGroupsMap[item.name] || [],
        content: personaDetails[item.name]?.content || '',
        config: config,
      };
    });
  }, [personaList, enabledPersonas, personaGroupsMap, personaDetails, personaConfigs]);
  const activePromptLines = useMemo(
    () =>
      activePromptGroupLines(
        personaCards.map((persona) => ({
          name: persona.name,
          enabled: persona.enabled,
          promptGroup: persona.config?.prompt_group,
        })),
      ),
    [personaCards],
  );
  const activeByGroup = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const line of activePromptLines) grouped[line.group] = line.names;
    return grouped;
  }, [activePromptLines]);
  // 加载人格列表和框架配置
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [listData, frameworkData, allConfigs, hbStatus, agentList, catalog] = await Promise.all(
        [
          personaApi.getPersonaList(),
          personaApi.getFrameworkConfig(),
          personaApi.getAllPersonaConfigs().catch(() => ({}) as Record<string, PersonaConfig>),
          personaApi.getHeartbeatStatus().catch(() => null),
          capabilityAgentsApi
            .getList(undefined, { delegable: true })
            .catch(() => ({ items: [], count: 0 })),
          personaApi.getToolCatalog().catch(() => null),
        ],
      );
      setDelegableAgents(agentList.items ?? []);
      setToolCatalog(catalog);
      setPersonaList(listData);
      setFrameworkConfig(frameworkData);
      setPersonaConfigs(allConfigs);
      try {
        const groups = await promptGroupApi.list();
        setPromptGroupNames(groups.map((group) => group.name));
      } catch {
        setPromptGroupNames(['默认']);
      }
      if (hbStatus?.items) {
        const map: typeof heartbeatStatus = {};
        for (const item of hbStatus.items) {
          map[item.persona_name] = {
            enabled: item.enabled,
            job_registered: item.job_registered,
            inspect_interval: item.inspect_interval,
            job_id: item.job_id,
          };
        }
        setHeartbeatStatus(map);
      }
      // 加载每个人格的详情
      const detailsMap: Record<string, PersonaCardData> = {};
      await Promise.all(
        listData.map(async (item) => {
          try {
            const detail = await personaApi.getPersona(item.name);
            const config = allConfigs[item.name];
            detailsMap[item.name] = {
              name: detail.name,
              content: detail.content,
              has_avatar: detail.metadata?.has_avatar ?? item.has_avatar,
              has_image: detail.metadata?.has_image ?? item.has_image,
              has_audio: detail.metadata?.has_audio ?? item.has_audio,
              enabled: enabledPersonas.includes(item.name),
              groups: config?.target_groups || personaGroupsMap[item.name] || [],
              config: config,
            };
          } catch {
            detailsMap[item.name] = {
              name: item.name,
              has_avatar: item.has_avatar,
              has_image: item.has_image,
              has_audio: item.has_audio,
              enabled: false,
              groups: [],
              content: '',
              config: allConfigs[item.name],
            };
          }
        }),
      );
      setPersonaDetails(detailsMap);
    } catch (error) {
      console.error('Failed to load persona data:', error);
      toast.error(t('personaConfig.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t, enabledPersonas, personaGroupsMap]);
  useEffect(() => {
    loadData();
  }, []);
  // 清理音频资源
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  // 更新框架配置到后端
  const updateFrameworkConfig = useCallback(
    async (configName: string, config: Record<string, unknown>) => {
      try {
        await frameworkConfigApi.updateFrameworkConfig(configName, config);
        toast.success(t('common.saveSuccess'));
      } catch (error) {
        console.error('Failed to update framework config:', error);
        toast.error(t('common.saveFailed'));
        throw error;
      }
    },
    [t],
  );
  // 创建新人格
  const handleCreatePersona = async () => {
    if (!newPersonaName.trim()) {
      toast.error(t('common.error'));
      return;
    }
    if (!newPersonaQuery.trim()) {
      toast.error(t('common.error'));
      return;
    }
    try {
      setIsCreating(true);
      await personaApi.createPersona({
        name: newPersonaName.trim(),
        query: newPersonaQuery.trim(),
      });
      toast.success(t('personaConfig.createSuccess'));
      setCreateDialogOpen(false);
      setNewPersonaName('');
      setNewPersonaQuery('');
      await loadData();
    } catch (error) {
      console.error('Failed to create persona:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || t('personaConfig.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };
  // 手动创建新人格
  const handleAddPersona = async () => {
    if (!newPersonaName.trim()) {
      toast.error(t('common.error'));
      return;
    }
    if (!newPersonaContent.trim()) {
      toast.error(t('common.error'));
      return;
    }
    try {
      setIsCreating(true);
      await personaApi.addPersona({
        name: newPersonaName.trim(),
        content: newPersonaContent.trim(),
      });
      toast.success(t('personaConfig.createSuccess'));
      setCreateManuallyDialogOpen(false);
      setNewPersonaName('');
      setNewPersonaContent('');
      await loadData();
    } catch (error) {
      console.error('Failed to add persona:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || t('personaConfig.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };
  // 切换人格启用状态（旧版兼容）
  const handleToggleEnabled = async (personaName: string, enabled: boolean) => {
    if (!frameworkConfig) return;
    try {
      const newEnabledList = enabled
        ? [...enabledPersonas, personaName]
        : enabledPersonas.filter((n) => n !== personaName);
      await updateFrameworkConfig(frameworkConfig.full_name, {
        enable_persona: newEnabledList,
      });
      await loadData();
    } catch (error) {
      console.error('Failed to toggle persona:', error);
    }
  };
  // 处理范围变更
  const handleScopeChange = async (personaName: string, newScope: PersonaScope) => {
    const conflicts = findConflictingPersonas(personaConfigs, personaName, newScope);
    if (conflicts.length > 0) {
      setPendingScopeChange({ personaName, newScope, conflicts });
      setScopeChangeConfirmOpen(true);
      return;
    }
    await applyScopeChange(personaName, newScope);
  };
  // 应用范围变更
  const applyScopeChange = async (personaName: string, newScope: PersonaScope) => {
    try {
      setIsSavingConfig(true);
      const currentConfig = personaConfigs[personaName] || {
        ai_mode: [],
        scope: 'disabled',
        target_groups: [],
      };

      await personaApi.updatePersonaConfig(personaName, {
        ...currentConfig,
        scope: newScope,
      });
      toast.success(t('personaConfig.configUpdated'));
      await loadData();
    } catch (error) {
      console.error('Failed to update persona scope:', error);
      toast.error(t('personaConfig.configUpdateFailed'));
    } finally {
      setIsSavingConfig(false);
      setPendingScopeChange(null);
    }
  };
  // 确认切换全局启用
  const handleConfirmScopeChange = async () => {
    if (!pendingScopeChange) return;

    try {
      setIsSavingConfig(true);

      for (const conflictName of pendingScopeChange.conflicts) {
        const currentGlobalConfig = personaConfigs[conflictName] || {
          ai_mode: [],
          scope: 'disabled',
          target_groups: [],
        };
        await personaApi.updatePersonaConfig(conflictName, {
          ...currentGlobalConfig,
          scope: 'disabled',
        });
      }

      // 然后设置新的人格为全局启用
      const currentConfig = personaConfigs[pendingScopeChange.personaName] || {
        ai_mode: [],
        scope: 'disabled',
        target_groups: [],
      };
      await personaApi.updatePersonaConfig(pendingScopeChange.personaName, {
        ...currentConfig,
        scope: pendingScopeChange.newScope,
      });
      toast.success(t('personaConfig.configUpdated'));
      await loadData();
    } catch (error) {
      console.error('Failed to update persona scope:', error);
      toast.error(t('personaConfig.configUpdateFailed'));
    } finally {
      setIsSavingConfig(false);
      setPendingScopeChange(null);
      setScopeChangeConfirmOpen(false);
    }
  };
  // 处理 AI 模式变更
  const handleAIModesChange = async (personaName: string, newModes: AIMode[]) => {
    try {
      setIsSavingConfig(true);
      const currentConfig = personaConfigs[personaName] || {
        ai_mode: [],
        scope: 'disabled',
        target_groups: [],
      };

      await personaApi.updatePersonaConfig(personaName, {
        ...currentConfig,
        ai_mode: newModes,
      });
      toast.success(t('personaConfig.configUpdated'));
      await loadData();
    } catch (error) {
      console.error('Failed to update persona AI modes:', error);
      toast.error(t('personaConfig.configUpdateFailed'));
    } finally {
      setIsSavingConfig(false);
    }
  };
  const loadPersonaSettings = useCallback(
    async (personaName: string) => {
      setSettingsLoading(true);
      setSettingsLoaded(false);
      try {
        const data = await personaApi.getPersonaSettings(personaName);
        setEditingSettings(data ?? {});
        setSettingsLoaded(true);
      } catch (error) {
        console.error('Failed to load persona settings:', error);
        toast.error(t('personaConfig.personaSettingsLoadFailed'));
        setEditingSettings({});
        setSettingsLoaded(false);
      } finally {
        setSettingsLoading(false);
      }
    },
    [t],
  );
  const handleSettingsChange = useCallback((key: string, value: ConfigValue) => {
    setEditingSettings((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return { ...prev, [key]: { ...current, value } };
    });
  }, []);
  // 打开编辑对话框（点击卡片）
  const handleCardClick = (persona: PersonaCardData) => {
    setEditingPersona(persona);
    setEditContent(persona.content);
    setEditingGroups([...persona.groups]);
    setEditingAIModes(knownAIModes(persona.config?.ai_mode));
    setEditingScope(persona.config?.scope || 'disabled');
    setEditingPromptGroup(persona.config?.prompt_group || '默认');
    const shape = speechShapeOf(persona.config);
    setSpeechShape(shape);
    setChatStyleText(String(persona.config?.chat_style ?? 50));
    setSpeechSoftText(
      String(
        boundInt(
          String(persona.config?.speech_len_soft ?? shape.soft_default),
          SPEECH_SOFT_MIN,
          SPEECH_SOFT_MAX,
          shape.soft_default,
        ),
      ),
    );
    setEditingInspectInterval(persona.config?.inspect_interval || 10);
    setEditingKeywords(persona.config?.keywords || []);
    setAsideImage(
      clampProbability(
        persona.config?.aside_image_probability ?? ASIDE_IMAGE_DEFAULT,
        ASIDE_IMAGE_DEFAULT,
      ),
    );
    setAsideText(
      clampProbability(
        persona.config?.aside_text_probability ?? ASIDE_TEXT_DEFAULT,
        ASIDE_TEXT_DEFAULT,
      ),
    );
    setAsideMixed(
      clampProbability(
        persona.config?.aside_mixed_probability ?? ASIDE_MIXED_DEFAULT,
        ASIDE_MIXED_DEFAULT,
      ),
    );
    setAsideAllowTools(persona.config?.aside_allow_tools === true);
    setActiveHours(
      persona.config?.active_hours && persona.config.active_hours.length > 0
        ? persona.config.active_hours
        : ACTIVE_HOURS_DEFAULT,
    );
    setTimezone(persona.config?.timezone || 'Asia/Shanghai');
    setAutonomyInterval(persona.config?.autonomy_interval_minutes ?? AUTONOMY_INTERVAL_DEFAULT);
    setCareMinZone(persona.config?.autonomy_care_min_zone === 'close' ? 'close' : 'familiar');
    setAllowMemeReply(persona.config?.allow_meme_reply !== false);
    // 常驻直装工具默认就在白名单里：每轮必然在场，不必让用户手动勾一遍
    const configuredToolNames = persona.config?.tool_names ?? [];
    setEditingToolNames(
      configuredToolNames.length > 0 ? configuredToolNames : collectAlwaysMountedTools(toolCatalog),
    );
    setEditingEnabledPlugins(
      specToEnabledPlugins(
        persona.config?.enabled_tools,
        (toolCatalog?.plugins ?? []).map((p) => p.name),
      ),
    );
    setEditingEnabledAgents(
      specToEnabledIds(
        persona.config?.capability_agents,
        delegableAgents.map((a) => a.node_id),
      ),
    );
    setEditingSettings({});
    setSettingsLoaded(false);
    setActiveTab('markdown');
    setEditDialogOpen(true);
    void loadPersonaSettings(persona.name);
  };
  // 点击头像上传 - 直接触发文件选择
  const handleAvatarClick = (e: React.MouseEvent, persona: PersonaCardData) => {
    e.stopPropagation();
    setUploadTargetPersona(persona.name);
    setUploadType('avatar');
    // 延迟触发点击，确保状态已更新
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };
  // 点击立绘上传 - 直接触发文件选择
  const handleImageClick = (e: React.MouseEvent, persona: PersonaCardData) => {
    e.stopPropagation();
    setUploadTargetPersona(persona.name);
    setUploadType('image');
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };
  // 点击音频上传 - 直接触发文件选择
  const handleAudioClick = (e: React.MouseEvent, persona: PersonaCardData) => {
    e.stopPropagation();
    setUploadTargetPersona(persona.name);
    setUploadType('audio');
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };
  // 统一处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetPersona) return;
    try {
      if (uploadType === 'avatar') {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          toast.error(t('personaConfig.invalidImageType'));
          return;
        }
        // 验证文件大小 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(t('personaConfig.imageSizeLimit'));
          return;
        }
        setIsUploadingAvatar(true);
        const base64 = await fileToBase64(file);
        await personaApi.uploadAvatar(uploadTargetPersona, base64);
        toast.success(t('personaConfig.avatarUploadSuccess'));
      } else if (uploadType === 'image') {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          toast.error(t('personaConfig.invalidImageType'));
          return;
        }
        // 验证文件大小 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(t('personaConfig.imageSizeLimit'));
          return;
        }
        setIsUploadingImage(true);
        const base64 = await fileToBase64(file);
        await personaApi.uploadImage(uploadTargetPersona, base64);
        toast.success(t('personaConfig.imageUploadSuccess'));
      } else if (uploadType === 'audio') {
        // 验证文件类型 - 支持多种音频格式
        const isValidAudioType = SUPPORTED_AUDIO_MIME_TYPES.some(
          (mimeType) =>
            file.type.toLowerCase().includes(mimeType.toLowerCase()) ||
            file.type.toLowerCase().startsWith('audio/'),
        );
        if (!isValidAudioType && !file.type.startsWith('audio/')) {
          toast.error(t('personaConfig.invalidAudioType'));
          return;
        }
        // 验证文件大小 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t('personaConfig.audioSizeLimit'));
          return;
        }
        // 检测音频格式
        let audioFormat = 'mp3'; // 默认格式
        const fileName = file.name.toLowerCase();
        for (const format of SUPPORTED_AUDIO_FORMATS) {
          if (fileName.endsWith(`.${format}`)) {
            audioFormat = format;
            break;
          }
        }
        setIsUploadingAudio(true);
        const base64 = await fileToBase64(file);
        await personaApi.uploadAudio(uploadTargetPersona, base64, audioFormat);
        toast.success(t('personaConfig.audioUploadSuccess'));
      }
      // 更新资源时间戳，强制刷新图片缓存
      setResourceTimestamp(Date.now());
      // 更新 editingPersona 状态，使编辑对话框立即显示新上传的资源
      if (editingPersona && editingPersona.name === uploadTargetPersona) {
        setEditingPersona({
          ...editingPersona,
          has_avatar: uploadType === 'avatar' ? true : editingPersona.has_avatar,
          has_image: uploadType === 'image' ? true : editingPersona.has_image,
          has_audio: uploadType === 'audio' ? true : editingPersona.has_audio,
        });
      }
      await loadData();
    } catch (error) {
      console.error('Failed to upload file:', error);
      if (uploadType === 'avatar') {
        toast.error(t('personaConfig.avatarUploadFailed'));
      } else if (uploadType === 'image') {
        toast.error(t('personaConfig.imageUploadFailed'));
      } else {
        toast.error(t('personaConfig.audioUploadFailed'));
      }
    } finally {
      setIsUploadingAvatar(false);
      setIsUploadingImage(false);
      setIsUploadingAudio(false);
      // 清空 input 值，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  // 保存编辑（群聊关联）
  const handleSaveEdit = async () => {
    if (!editingPersona || !frameworkConfig) return;
    try {
      setIsSaving(true);
      // 保存群聊关联
      const updatedPersonaForSession = {
        ...personaGroupsMap,
        [editingPersona.name]: editingGroups,
      };
      await updateFrameworkConfig(frameworkConfig.full_name, {
        persona_for_session: updatedPersonaForSession,
      });
      const saveConflicts = findConflictingPersonas(
        personaConfigs,
        editingPersona.name,
        editingScope,
      );
      for (const conflictName of saveConflicts) {
        const conflictConfig = personaConfigs[conflictName] || {
          ai_mode: [],
          scope: 'disabled' as PersonaScope,
          target_groups: [],
        };
        await personaApi.updatePersonaConfig(conflictName, {
          ...conflictConfig,
          scope: 'disabled',
        });
      }
      // 保存 AI 模式和启用范围配置
      await personaApi.updatePersonaConfig(editingPersona.name, {
        ai_mode: knownAIModes(editingAIModes),
        scope: editingScope,
        target_groups: editingGroups,
        inspect_interval: editingInspectInterval,
        keywords: editingKeywords,
        aside_image_probability: asideImage,
        aside_text_probability: asideText,
        aside_mixed_probability: asideMixed,
        aside_allow_tools: asideAllowTools,
        active_hours: activeHours,
        timezone: timezone.trim(),
        autonomy_interval_minutes: boundedInt(
          String(autonomyInterval),
          15,
          720,
          AUTONOMY_INTERVAL_DEFAULT,
        ),
        autonomy_care_min_zone: careMinZone,
        allow_meme_reply: allowMemeReply,
        ...(toolCatalog && toolCatalog.plugins.length > 0
          ? {
              enabled_tools: enabledPluginsToSpec(
                editingEnabledPlugins,
                toolCatalog.plugins.map((p) => p.name),
              ),
            }
          : {}),
        tool_names: editingToolNames,
        prompt_group: editingPromptGroup,
        chat_style: boundInt(
          chatStyleText,
          speechShape.chat_style_min,
          speechShape.chat_style_max,
          50,
        ),
        speech_len_soft: boundInt(
          speechSoftText,
          SPEECH_SOFT_MIN,
          SPEECH_SOFT_MAX,
          speechShape.soft_default,
        ),
        ...(delegableAgents.length > 0
          ? {
              capability_agents: enabledIdsToSpec(
                editingEnabledAgents,
                delegableAgents.map((a) => a.node_id),
              ),
            }
          : {}),
      });
      // 保存 Markdown 内容（仅在内容发生变化时）
      if (!builtinPersona && editContent !== editingPersona.content) {
        await personaApi.updatePersonaContent(editingPersona.name, editContent);
      }
      if (settingsLoaded) {
        await personaApi.updatePersonaSettings(
          editingPersona.name,
          settingsToPayload(editingSettings),
        );
      }
      toast.success(t('personaConfig.saveSuccess'));
      setEditDialogOpen(false);
      setEditingPersona(null);
      setEditContent('');
      setEditingGroups([]);
      setEditingAIModes([]);
      setEditingScope('disabled');
      await loadData();
    } catch (error) {
      console.error('Failed to save persona:', error);
      toast.error(getApiErrorMessage(error, t('personaConfig.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };
  // 打开删除确认
  const handleDeleteClick = (e: React.MouseEvent, personaName: string) => {
    e.stopPropagation();
    setDeleteTarget(personaName);
    setDeleteConfirmOpen(true);
  };
  const handleCopyClick = (e: React.MouseEvent, personaName: string) => {
    e.stopPropagation();
    setCopyTarget(personaName);
    setCopyConfirmOpen(true);
  };
  const handleConfirmCopy = async () => {
    if (!copyTarget) return;
    try {
      setIsCopying(copyTarget);
      const data = await personaApi.copyPersona(copyTarget);
      const newName = data?.name ?? '';
      toast.success(
        newName
          ? t('personaConfig.copySuccessNamed', { name: newName })
          : t('personaConfig.copySuccess'),
      );
      setCopyConfirmOpen(false);
      setCopyTarget(null);
      await loadData();
    } catch (error) {
      console.error('Failed to copy persona:', error);
      toast.error(getApiErrorMessage(error, t('personaConfig.copyFailed')));
    } finally {
      setIsCopying(null);
    }
  };
  // 处理卡片上的群聊标签变化（直接保存）
  const handleGroupsChange = async (personaName: string, groups: string[]) => {
    if (!frameworkConfig) return;
    try {
      const currentConfig = personaConfigs[personaName] || {
        ai_mode: [],
        scope: 'disabled',
        target_groups: [],
      };

      await personaApi.updatePersonaConfig(personaName, {
        ...currentConfig,
        target_groups: groups,
      });
      // 重新加载数据以更新显示
      await loadData();
    } catch (error) {
      console.error('Failed to save groups:', error);
      toast.error(t('common.saveFailed'));
    }
  };
  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(deleteTarget);
      await personaApi.deletePersona(deleteTarget);
      toast.success(t('personaConfig.deleteSuccess'));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete persona:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg
          ? `${t('personaConfig.deleteFailed')}: ${errorMsg}`
          : t('personaConfig.deleteFailed'),
      );
    } finally {
      setIsDeleting(null);
    }
  };
  // 播放/暂停音频
  const toggleAudioPlayback = (personaName: string) => {
    const audioUrl = personaApi.getAudioUrl(personaName);
    if (playingAudio === personaName) {
      // 暂停当前播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(null);
    } else {
      // 播放新音频
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAudio(null);
      audio.onerror = () => {
        toast.error(t('personaConfig.loadFailed'));
        setPlayingAudio(null);
      };
      audioRef.current = audio;
      audio.play().catch(() => {
        toast.error(t('personaConfig.loadFailed'));
        setPlayingAudio(null);
      });
      setPlayingAudio(personaName);
    }
  };
  // 打开图片预览
  const openImagePreview = (url: string, title: string) => {
    setPreviewImageUrl(url);
    setPreviewImageTitle(title);
    setImagePreviewOpen(true);
  };
  // 渲染人格卡片 - 美观的卡片设计，带红色主题和毛玻璃效果
  const renderPersonaCard = (persona: PersonaCardData) => {
    const preview = getMarkdownPreview(persona.content);
    const avatarUrl = personaApi.getAvatarUrl(persona.name, resourceTimestamp);
    const imageUrl = personaApi.getImageUrl(persona.name, resourceTimestamp);
    const hasImage = persona.has_image;
    const scope = persona.config?.scope || 'disabled';
    const aiModes = knownAIModes(persona.config?.ai_mode);
    const inspectInterval = persona.config?.inspect_interval;
    const hb = heartbeatStatus[persona.name];
    return (
      <Card
        key={persona.name}
        onClick={() => handleCardClick(persona)}
        className={cn(
          'relative min-w-0 cursor-pointer transition-colors duration-300 group',
          'glass-card border border-primary/20 hover:border-primary/40',
        )}
      >
        {/* 立绘贴边铺满。宿主不能 overflow-hidden（会把玻璃阴影切成直角），
            圆角裁切放在这一层。 */}
        {hasImage && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn(
                'w-full h-full object-cover transition-opacity',
                isGlass ? 'opacity-30 group-hover:opacity-40' : 'opacity-15 group-hover:opacity-20',
              )}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="persona-card-image-fade absolute inset-0" />
          </div>
        )}
        <CardContent className="relative z-10 flex h-full flex-col gap-3 p-4 sm:p-6">
          {/* === 区域1: 头像和基本信息 === */}
          <div className="flex items-center gap-3">
            {/* 头像 - 带红色主题边框 */}
            <div
              onClick={(e) => handleAvatarClick(e, persona)}
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0',
                'cursor-pointer transition-all',
                'ring-2 ring-primary/30 hover:ring-primary/60',
                persona.has_avatar ? 'bg-transparent' : 'bg-primary/10',
              )}
              title={t('personaConfig.uploadAvatar')}
            >
              {persona.has_avatar ? (
                <img
                  src={avatarUrl}
                  alt={persona.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Upload className="w-5 h-5 text-primary/60" />
              )}
            </div>
            {/* 名称和状态 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-base truncate">{persona.name}</h3>
                <div className="flex items-center shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleCopyClick(e, persona.name)}
                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    disabled={isCopying === persona.name || isDeleting === persona.name}
                    title={t('personaConfig.copyPersona')}
                  >
                    {isCopying === persona.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {persona.builtin !== true && persona.name !== '早柚' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, persona.name)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={isDeleting === persona.name || isCopying === persona.name}
                      title={t('personaConfig.deleteConfirm')}
                    >
                      {isDeleting === persona.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {/* Heartbeat 运行态 */}
              {hb && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <Badge variant={hb.enabled ? 'default' : 'secondary'} className={CARD_BADGE}>
                    {hb.enabled
                      ? t('personaConfig.heartbeatEnabled')
                      : t('personaConfig.heartbeatDisabled')}
                  </Badge>
                  <Badge
                    variant={hb.job_registered ? 'default' : 'outline'}
                    className={cn(
                      CARD_BADGE,
                      hb.job_registered
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                        : '',
                    )}
                  >
                    {hb.job_registered
                      ? t('personaConfig.jobRegistered')
                      : t('personaConfig.jobMissing')}
                  </Badge>
                  {hb.inspect_interval != null && (
                    <Badge variant="outline" className={CARD_BADGE}>
                      {t('personaConfig.inspectInterval')}: {hb.inspect_interval}
                      {t('personaConfig.minutesUnit')}
                    </Badge>
                  )}
                </div>
              )}
              {/* 状态标签行 - 胶囊样式 */}
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={cn(CARD_BADGE, getScopeBadgeStyle(scope))}>
                  {getScopeLabel(scope, t)}
                </Badge>
                {aiModes.length > 0 && (
                  <Badge
                    className={cn(
                      CARD_BADGE,
                      'bg-primary/15 text-primary border border-primary/30',
                    )}
                  >
                    {aiModes.length} {t('personaConfig.modesEnabled')}
                  </Badge>
                )}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {t('personaConfig.personaPromptGroupLine', {
                  name: persona.config?.prompt_group?.trim() || DEFAULT_PROMPT_GROUP,
                })}
              </p>
            </div>
          </div>
          {/* === 区域2: 内容预览 === */}
          <p className="text-xs text-muted-foreground line-clamp-2 break-words whitespace-pre-wrap min-h-[32px]">
            {preview || t('common.noData')}
          </p>
          {/* === 区域3: 资源状态（胶囊按钮） === */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {[
              {
                key: 'avatar',
                has: persona.has_avatar,
                icon: ImageIcon,
                label: t('personaConfig.avatar'),
                onClick: handleAvatarClick,
                activeColor: 'green',
              },
              {
                key: 'image',
                has: persona.has_image,
                icon: ImagePlus,
                label: t('personaConfig.image'),
                onClick: handleImageClick,
                activeColor: 'blue',
              },
              {
                key: 'audio',
                has: persona.has_audio,
                icon: Music2,
                label: t('personaConfig.audio'),
                onClick: handleAudioClick,
                activeColor: 'purple',
              },
            ].map(({ key, has, icon: Icon, label, onClick, activeColor }) => {
              // 悬浮时胶囊自身文案切成「添加/替换」：原生 title 悬浮提示慢且容易被忽略
              const hoverLabel = has
                ? t('personaConfig.replaceResource', { name: label })
                : t('personaConfig.addResource', { name: label });
              return (
                <button
                  key={key}
                  onClick={(e) => onClick(e, persona)}
                  className={cn(
                    // 命名 group/pill：卡片根元素自带无别名 group，无别名的 group-hover 会被卡片 hover 一并触发
                    'group/pill flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all',
                    has
                      ? activeColor === 'green'
                        ? 'bg-green-500/15 text-green-600 border border-green-500/30 hover:bg-green-500/25'
                        : activeColor === 'blue'
                          ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30 hover:bg-blue-500/25'
                          : 'bg-purple-500/15 text-purple-600 border border-purple-500/30 hover:bg-purple-500/25'
                      : 'bg-muted/30 text-muted-foreground border border-border/30 hover:bg-muted/50',
                  )}
                  title={hoverLabel}
                >
                  {/* 图标槽两格叠放：缺失态默认 X，悬浮换成「+」与「添加」文案配套 */}
                  <span className="grid h-3 w-3 shrink-0 place-items-center">
                    <span
                      className={cn(
                        'col-start-1 row-start-1',
                        !has && 'group-hover/pill:invisible',
                      )}
                    >
                      {has ? <Icon className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </span>
                    {!has && (
                      <span className="col-start-1 row-start-1 invisible group-hover/pill:visible">
                        <Plus className="w-3 h-3" />
                      </span>
                    )}
                  </span>
                  {/* 文案槽两格叠放：默认资源名 → 悬浮「添加/替换」；同格堆叠保证胶囊宽度不跳动 */}
                  <span className="hidden sm:grid">
                    <span className="col-start-1 row-start-1 group-hover/pill:invisible">
                      {label}
                    </span>
                    <span className="col-start-1 row-start-1 invisible group-hover/pill:visible">
                      {hoverLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {/* === 区域4: 启用范围选择（分隔线 + 胶囊按钮） === */}
          <div className="pt-3 border-t border-primary/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-2">
              <Globe className="w-3 h-3 text-primary/60" />
              <Label className="text-[10px] text-muted-foreground leading-none">
                {t('personaConfig.enableScope')}
              </Label>
            </div>
            {/* 5 个范围：窄屏三列（两行）才放得下文案；桌面仍五等分锁一行 */}
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleScopeChange(persona.name, option.value)}
                  disabled={isSavingConfig}
                  className={cn(
                    'flex min-w-0 items-center justify-center gap-1 px-1 py-2.5 sm:py-1.5 rounded-full text-[10px] font-medium leading-tight transition-all',
                    'border',
                    scope === option.value
                      ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                      : 'bg-transparent text-muted-foreground border-border/30 hover:bg-muted/30 hover:border-border/50',
                  )}
                >
                  <span className="flex h-3 w-3 shrink-0 items-center justify-center [&_svg]:h-3 [&_svg]:w-3">
                    {option.icon}
                  </span>
                  <span className="min-w-0 truncate">{t(option.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
          {/* === 区域5: AI 模式选择（胶囊按钮） === */}
          <div onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-2">
              <Settings className="w-3 h-3 text-primary/60" />
              <Label className="text-[10px] text-muted-foreground leading-none">
                {t('personaConfig.aiModes')}
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AI_MODE_OPTIONS.map((mode) => {
                const isSelected = aiModes.includes(mode.value);
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => {
                      const newModes = isSelected
                        ? aiModes.filter((m) => m !== mode.value)
                        : [...aiModes, mode.value];
                      handleAIModesChange(persona.name, newModes as AIMode[]);
                    }}
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-sans font-medium text-left transition-all border',
                      isSelected
                        ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                        : 'bg-transparent text-muted-foreground border-border/30 hover:bg-muted/30 hover:border-border/50',
                    )}
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                      {mode.icon}
                    </span>
                    <span className="flex-1 text-left">{mode.label}</span>
                    {mode.value === '定时巡检' && isSelected && inspectInterval && (
                      <span className="shrink-0 text-[10px] font-medium text-primary/70">
                        {inspectInterval}
                        {t('personaConfig.minutesUnit')}
                      </span>
                    )}
                    {mode.value === '命令补充' && isSelected && (
                      <span
                        title={t('personaConfig.asideBadgeHint')}
                        className="shrink-0 text-[10px] font-medium text-primary/70"
                      >
                        {asideBadge(
                          persona.config,
                          persona.config?.aside_allow_tools
                            ? t('personaConfig.asideToolsShort')
                            : '',
                        )}
                      </span>
                    )}
                    {mode.value === '自主行动' && isSelected && (
                      <span className="shrink-0 text-[10px] font-medium text-primary/70">
                        {persona.config?.autonomy_interval_minutes ?? AUTONOMY_INTERVAL_DEFAULT}
                        {t('personaConfig.minutesUnit')}
                      </span>
                    )}
                    {mode.value === '提及应答' &&
                      isSelected &&
                      (persona.config?.keywords?.length ?? 0) > 0 && (
                        <span className="shrink-0 text-[10px] font-medium text-primary/70">
                          {persona.config?.keywords?.length}
                          {t('personaConfig.keywordsCountSuffix')}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
          </div>
          {/* === 区域6: 关联群聊（仅特定模式） === */}
          {scope === 'specific' && (
            <div className="pt-3 border-t border-primary/10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1 mb-2">
                <Users className="w-3 h-3 text-primary/60" />
                <Label className="text-[10px] text-muted-foreground leading-none">
                  {t('personaConfig.enabledGroups')}
                </Label>
              </div>
              <TagsInput
                value={persona.groups}
                onChange={(groups) => handleGroupsChange(persona.name, groups)}
                placeholder={t('personaConfig.groupsPlaceholder')}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  return (
    <>
      {/* 隐藏的文件输入框 - 用于所有上传 */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
        accept={
          uploadType === 'audio'
            ? 'audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-m4a,audio/flac,audio/wave'
            : 'image/png,image/jpeg,image/jpg'
        }
      />
      <PinnedPage
        className="min-w-0"
        header={
          <div className="min-w-0 sm:overflow-x-auto">
            <h1 className="sm:whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Brain className="w-8 h-8 shrink-0" />
              {t('personaConfig.title')}
            </h1>
            <p className="sm:whitespace-nowrap text-muted-foreground mt-1">
              {t('personaConfig.description')}
            </p>
          </div>
        }
        toolbar={
          <div className="flex w-full min-w-0 flex-col gap-3 md:gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className={tabToolbarGroupWrapClass}>
                <TabButtonGroup
                  value={libraryView}
                  onValueChange={(value) =>
                    setLibraryView(value as 'personas' | 'capabilityAgents' | 'prompts')
                  }
                  options={[
                    {
                      value: 'personas',
                      label: t('personaConfig.tabPersonas'),
                      icon: <User className="h-4 w-4" />,
                    },
                    {
                      value: 'capabilityAgents',
                      label: t('personaConfig.tabCapabilityAgents'),
                      icon: <Bot className="h-4 w-4" />,
                    },
                    {
                      value: 'prompts',
                      label: t('personaConfig.tabPrompts'),
                      icon: <ScrollText className="h-4 w-4" />,
                    },
                  ]}
                />
              </div>
              {/* 图四红框：切换到人格代理页签后在右侧自动出现的三个 button group（图三） */}
              {libraryView === 'capabilityAgents' && (
                <div className={cn(tabToolbarGroupWrapClass, 'shrink animate-in fade-in-50')}>
                  <TabButtonGroup
                    options={capability.sourceOptions}
                    value={capability.activeSource}
                    onValueChange={(value) => capability.setActiveSource(value as any)}
                  />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              {libraryView === 'personas' ? (
                <>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className={cn(tabToolbarControlClass, 'flex-1 gap-2 whitespace-nowrap sm:flex-none')}>
                        <Sparkles className="h-4 w-4" />
                        {t('personaConfig.createNew')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          {t('personaConfig.createNew')}
                        </DialogTitle>
                        <DialogDescription>{t('personaConfig.createNewDesc')}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 md:space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="persona-name">{t('personaConfig.personaName')}</Label>
                          <Input
                            id="persona-name"
                            placeholder={t('personaConfig.personaNamePlaceholder')}
                            value={newPersonaName}
                            onChange={(e) => setNewPersonaName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="persona-query">{t('personaConfig.personaQuery')}</Label>
                          <Textarea
                            id="persona-query"
                            placeholder={t('personaConfig.personaQueryPlaceholder')}
                            value={newPersonaQuery}
                            onChange={(e) => setNewPersonaQuery(e.target.value)}
                            rows={4}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setCreateDialogOpen(false)}
                          disabled={isCreating}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          onClick={handleCreatePersona}
                          disabled={isCreating || !newPersonaName.trim() || !newPersonaQuery.trim()}
                          className="gap-2"
                        >
                          {isCreating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('personaConfig.creating')}
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              {t('common.confirm')}
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {/* 手动创建按钮 */}
                  <Dialog
                    open={createManuallyDialogOpen}
                    onOpenChange={setCreateManuallyDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(tabToolbarControlClass, 'flex-1 gap-2 whitespace-nowrap sm:flex-none')}
                      >
                        <Plus className="h-4 w-4" />
                        {t('personaConfig.createNewManually')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Plus className="h-5 w-5 text-primary" />
                          {t('personaConfig.createNewManually')}
                        </DialogTitle>
                        <DialogDescription>
                          {t('personaConfig.createNewManuallyDesc')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 md:space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="persona-name-manual">
                            {t('personaConfig.personaName')}
                          </Label>
                          <Input
                            id="persona-name-manual"
                            placeholder={t('personaConfig.personaNamePlaceholder')}
                            value={newPersonaName}
                            onChange={(e) => setNewPersonaName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="persona-content-manual">
                            {t('personaConfig.personaContent')}
                          </Label>
                          <Textarea
                            id="persona-content-manual"
                            placeholder={t('personaConfig.personaContentPlaceholder')}
                            value={newPersonaContent}
                            onChange={(e) => setNewPersonaContent(e.target.value)}
                            rows={8}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setCreateManuallyDialogOpen(false)}
                          disabled={isCreating}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          onClick={handleAddPersona}
                          disabled={
                            isCreating || !newPersonaName.trim() || !newPersonaContent.trim()
                          }
                          className="gap-2"
                        >
                          {isCreating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('common.loading')}
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              {t('common.confirm')}
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : libraryView === 'prompts' ? (
                <Button
                  className={cn(tabToolbarControlClass, 'flex-1 gap-2 whitespace-nowrap sm:flex-none')}
                  onClick={() => promptPanelRef.current?.openCreate()}
                >
                  <Plus className="h-4 w-4" />
                  {t('personaConfig.promptCreate')}
                </Button>
              ) : (
                /* 图 5：能力代理操控与搜索控件（搜索、刷新、新建节点），收成一行靠右对齐 */
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <div className="relative min-w-0 flex-1 sm:w-[200px] sm:flex-none md:w-[260px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={capability.searchQuery}
                      onChange={(event) => capability.setSearchQuery(event.target.value)}
                      placeholder={t('aiCapabilityAgents.searchPlaceholder')}
                      className={cn(tabToolbarControlClass, 'pl-9 w-full')}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={capability.loadData}
                    disabled={capability.isLoading}
                    className={cn(tabToolbarControlClass, 'gap-2 shrink-0')}
                  >
                    {capability.isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{t('common.refresh')}</span>
                  </Button>
                  <Button
                    onClick={() => capability.openDialog('create')}
                    className={cn(tabToolbarControlClass, 'gap-2 shrink-0')}
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('aiCapabilityAgents.newProfile')}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        }
      >
        {libraryView === 'prompts' ? (
          <PromptGroupPanel
            ref={promptPanelRef}
            activeByGroup={activeByGroup}
            activeLines={activePromptLines}
            activeReady={!isLoading}
          />
        ) : libraryView === 'capabilityAgents' ? (
          <CapabilityAgentsPanel capability={capability} />
        ) : (
          <div className="md:-mt-3">
            <div className="mb-3 space-y-3">
              <GlassAlert tone="warning">{t('personaConfig.builtinPersonaWarning')}</GlassAlert>
              {/* 全局启用提示 */}
              {personaCards.some((p) => isGlobalLikeScope(p.config?.scope)) && (
                <GlassAlert tone="info" icon={Globe}>
                  {t('personaConfig.globalEnabledHint', {
                    name: personaCards
                      .filter((p) => isGlobalLikeScope(p.config?.scope))
                      .map((p) => `${p.name}（${getScopeLabel(p.config?.scope || 'disabled', t)}）`)
                      .join('、'),
                  })}
                </GlassAlert>
              )}
              {/* 无启用人格警告 */}
              {!personaCards.some((p) => isGlobalLikeScope(p.config?.scope)) &&
                !personaCards.some((p) => p.config?.scope === 'specific') &&
                personaCards.length > 0 && (
                  <GlassAlert tone="warning">
                    {t('personaConfig.noPersonaEnabledWarning')}
                  </GlassAlert>
                )}
              {/* 仅特定群聊启用警告 */}
              {!personaCards.some((p) => isGlobalLikeScope(p.config?.scope)) &&
                personaCards.some((p) => p.config?.scope === 'specific') && (
                  <GlassAlert
                    tone="warning"
                    className="grid w-full max-w-full grid-cols-[auto_minmax(0,1fr)]"
                    contentClassName="whitespace-normal break-all"
                  >
                    {t('personaConfig.specificOnlyWarning', {
                      groups:
                        personaCards
                          .filter((p) => p.config?.scope === 'specific' && p.groups.length > 0)
                          .flatMap((p) => p.groups)
                          .join('、') || t('personaConfig.noGroups'),
                    })}
                  </GlassAlert>
                )}
            </div>
            {/* 人格列表 - 固定列数的响应式网格。不用 auto-fit：空轨道会被折叠成 0，
            只剩一张卡时它就被拉满整行；卡片内部本就是 5 等分范围胶囊的窄卡设计。 */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : personaCards.length === 0 ? (
              <>
                {/* 无人格警告 */}
                <GlassAlert tone="warning">{t('personaConfig.noPersonaAtAllWarning')}</GlassAlert>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('personaConfig.noPersonas')}</p>
                  <Button variant="link" onClick={() => setCreateDialogOpen(true)} className="mt-2">
                    {t('personaConfig.createNew')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="glass-card-grid grid min-w-0 grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {personaCards.map(renderPersonaCard)}
              </div>
            )}
          </div>
        )}
        {/* 编辑：右侧半屏，交互对齐看板详情 Sheet */}
        <Sheet open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <SheetContent
            side="right"
            overlayClassName={cn(
              sheetOverlay,
              'data-[state=open]:animate-sheet-overlay-in data-[state=closed]:animate-sheet-overlay-out',
            )}
            className="flex h-full w-full flex-col gap-0 bg-background/95 p-0 glass-card !fixed !inset-y-0 !right-0 !left-auto !top-0 !rounded-none !border-l !max-w-full sm:!max-w-[60vw] data-[state=open]:animate-sheet-slide-in-right data-[state=closed]:animate-sheet-slide-out-right"
          >
            <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
              <SheetTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                {t('personaConfig.editPersona')}: {editingPersona?.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {t('personaConfig.editPersonaAriaDesc')}
              </SheetDescription>
            </SheetHeader>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="shrink-0 px-6 pt-4">
                <TabButtonGroup
                  value={activeTab}
                  onValueChange={setActiveTab}
                  options={[
                    {
                      value: 'markdown',
                      label: t('personaConfig.personaMarkdown'),
                      icon: <FileText className="h-4 w-4" />,
                    },
                    {
                      value: 'config',
                      label: t('personaConfig.config'),
                      icon: <Settings className="h-4 w-4" />,
                    },
                    {
                      value: 'settings',
                      label: t('personaConfig.personaSettings'),
                      icon: <Sparkles className="h-4 w-4" />,
                    },
                    {
                      value: 'avatar',
                      label: t('personaConfig.avatar'),
                      icon: <ImageIcon className="h-4 w-4" />,
                    },
                    {
                      value: 'image',
                      label: t('personaConfig.image'),
                      icon: <ImageIcon className="h-4 w-4" />,
                    },
                    {
                      value: 'audio',
                      label: t('personaConfig.audio'),
                      icon: <Music className="h-4 w-4" />,
                    },
                    {
                      value: 'meme_packs',
                      label: t('personaConfig.memePacks'),
                      icon: <Smile className="h-4 w-4" />,
                    },
                  ]}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
                <TabsContent
                  value="meme_packs"
                  className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
                >
                  {editingPersona && (
                    <PersonaMemePackTab
                      personaName={editingPersona.name}
                      allowReply={allowMemeReply}
                      onAllowReplyChange={setAllowMemeReply}
                    />
                  )}
                </TabsContent>
                {/* 自述文档 Tab */}
                <TabsContent
                  value="markdown"
                  className="mt-0 hidden min-h-0 flex-1 flex-col data-[state=active]:flex"
                >
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <Label className="flex shrink-0 items-center gap-2">
                      <Brain className="h-4 w-4" />
                      {t('personaConfig.personaContent')}
                    </Label>
                    {builtinPersona && (
                      <GlassAlert tone="warning" className="shrink-0">
                        {t('personaConfig.builtinPersonaWarning')}
                      </GlassAlert>
                    )}
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      readOnly={builtinPersona}
                      className="h-full min-h-0 flex-1 resize-none font-mono text-sm"
                      placeholder={t('personaConfig.personaQueryPlaceholder')}
                    />
                  </div>
                </TabsContent>
                {/* 配置 Tab */}
                <TabsContent
                  value="config"
                  className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
                >
                  <div className="space-y-8">
                    {/* 启用范围配置：标题独占一行，选项格随宽度换行 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-base">
                        <ScrollText className="h-4 w-4" />
                        {t('personaConfig.promptGroupLabel')}
                      </Label>
                      <Select value={editingPromptGroup} onValueChange={setEditingPromptGroup}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(promptGroupNames.length > 0 ? promptGroupNames : ['默认']).map(
                            (name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <SpeechFields
                      shape={speechShape}
                      chatStyleText={chatStyleText}
                      speechSoftText={speechSoftText}
                      onChatStyleText={setChatStyleText}
                      onSpeechSoftText={setSpeechSoftText}
                    />
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-base">
                        <Globe className="h-4 w-4" />
                        {t('personaConfig.enableScope')}
                      </Label>
                      <div className="grid grid-cols-2 gap-3 items-stretch sm:grid-cols-3 lg:grid-cols-5">
                        {SCOPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEditingScope(option.value)}
                            className={cn(
                              CONFIG_OPTION_BUTTON,
                              'h-full min-w-0',
                              editingScope === option.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-border/80 hover:bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'p-1.5 rounded-full shrink-0',
                                editingScope === option.value
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {option.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {t(option.labelKey)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {t(option.descKey)}
                              </div>
                            </div>
                            {editingScope === option.value && (
                              <Check className="w-4 h-4 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 全局启用冲突提示 */}
                    {editingPersona &&
                      findConflictingPersonas(personaConfigs, editingPersona.name, editingScope)
                        .length > 0 && (
                        <GlassAlert tone="warning" icon={AlertCircle}>
                          {t('personaConfig.globalConflictHint', {
                            name: findConflictingPersonas(
                              personaConfigs,
                              editingPersona.name,
                              editingScope,
                            ).join('、'),
                          })}
                        </GlassAlert>
                      )}
                    {/* AI 模式配置 */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-base">
                        <Settings className="h-4 w-4" />
                        {t('personaConfig.aiModes')}
                      </Label>
                      {/* 只有四个模式，仍按启用范围的五列排，末格留空才能上下对齐 */}
                      <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {AI_MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.value}
                            type="button"
                            onClick={() => {
                              const isSelected = editingAIModes.includes(mode.value);
                              if (isSelected) {
                                setEditingAIModes(editingAIModes.filter((m) => m !== mode.value));
                              } else {
                                setEditingAIModes([...editingAIModes, mode.value]);
                              }
                            }}
                            className={cn(
                              CONFIG_OPTION_BUTTON,
                              editingAIModes.includes(mode.value)
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-border/80 hover:bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'p-1.5 rounded-full shrink-0',
                                editingAIModes.includes(mode.value)
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {mode.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* 标题与「(即将推出)」合成一行整体截断：窄格下允许省略，不折成两行 */}
                              <div className="font-medium text-sm truncate">{mode.label}</div>
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {mode.description}
                              </div>
                            </div>
                            {editingAIModes.includes(mode.value) && (
                              <Check className="w-4 h-4 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 关联群聊 - 仅在 specific 模式下显示 */}
                    {editingScope === 'specific' && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4" />
                          {t('personaConfig.enabledGroups')}
                        </Label>
                        <TagsInput
                          value={editingGroups}
                          onChange={setEditingGroups}
                          placeholder={t('personaConfig.groupsPlaceholder')}
                        />
                      </div>
                    )}
                    {/*
                      定时巡检间隔与触发关键词成组并排一行。
                      两个字段都由 AI 行动模式带出，但模式关掉时**不隐藏、只冻结置灰**：
                      隐藏会让这一行塌掉、布局跳来跳去，用户也看不到自己上次配的值，
                      重新勾上还得再找一遍。冻结态的标签同样变灰，控件走各自的 disabled 样式。
                      值一直随 payload 提交（inspect_interval / keywords），冻结不影响已存的数据。
                    */}
                    <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          className={cn(
                            'flex items-center gap-2 text-base',
                            // 冻结态用 opacity 而不是 text-muted-foreground：本主题里
                            // --muted-foreground 与 --foreground 同色（240 5% 10%），改文字色等于没改
                            !showInspectInterval && 'opacity-50',
                          )}
                        >
                          <Clock className="h-4 w-4" />
                          {t('personaConfig.inspectInterval')}
                        </Label>
                        <Select
                          disabled={!showInspectInterval}
                          value={editingInspectInterval.toString()}
                          onValueChange={(value) => setEditingInspectInterval(parseInt(value, 10))}
                        >
                          {/* 冻结态（虚线 + 灰底）由 index.css 的 [role="combobox"]:disabled 规则给：
                              那里对 combobox 的背景/边框是 !important，工具类压不动 */}
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">
                              {t('personaConfig.inspectInterval5min')}
                            </SelectItem>
                            <SelectItem value="10">
                              {t('personaConfig.inspectInterval10min')}
                            </SelectItem>
                            <SelectItem value="15">
                              {t('personaConfig.inspectInterval15min')}
                            </SelectItem>
                            <SelectItem value="30">
                              {t('personaConfig.inspectInterval30min')}
                            </SelectItem>
                            <SelectItem value="60">
                              {t('personaConfig.inspectInterval60min')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <LabelWithHelp
                          icon={
                            <MessageSquare
                              className={cn('h-4 w-4', !showTriggerKeywords && 'opacity-50')}
                            />
                          }
                          label={t('personaConfig.triggerKeywords')}
                          description={t('personaConfig.keywordsHint')}
                          className={cn(
                            'text-base font-medium',
                            !showTriggerKeywords && 'opacity-50',
                          )}
                        />
                        <TagsInput
                          disabled={!showTriggerKeywords}
                          value={editingKeywords}
                          onChange={setEditingKeywords}
                          placeholder={t('personaConfig.keywordsPlaceholder')}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <LabelWithHelp
                        icon={
                          <MessageCircle className={cn('h-4 w-4', !showAside && 'opacity-50')} />
                        }
                        label={t('personaConfig.asideTitle')}
                        description={t('personaConfig.asideHint')}
                        className={cn('text-base font-medium', !showAside && 'opacity-50')}
                      />
                      <div className="grid gap-3 md:gap-4 sm:grid-cols-3">
                        <ProbabilityField
                          id="aside-image"
                          label={t('personaConfig.asideImage')}
                          value={asideImage}
                          disabled={!showAside}
                          onChange={setAsideImage}
                        />
                        <ProbabilityField
                          id="aside-text"
                          label={t('personaConfig.asideText')}
                          value={asideText}
                          disabled={!showAside}
                          onChange={setAsideText}
                        />
                        <ProbabilityField
                          id="aside-mixed"
                          label={t('personaConfig.asideMixed')}
                          value={asideMixed}
                          disabled={!showAside}
                          onChange={setAsideMixed}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <LabelWithHelp
                          htmlFor="aside-allow-tools"
                          label={t('personaConfig.asideAllowTools')}
                          description={t('personaConfig.asideAllowToolsHint')}
                          className={cn('text-sm font-medium', !showAside && 'opacity-50')}
                        />
                        <Switch
                          id="aside-allow-tools"
                          checked={asideAllowTools}
                          disabled={!showAside}
                          onCheckedChange={setAsideAllowTools}
                          aria-label={t('personaConfig.asideAllowTools')}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <LabelWithHelp
                          icon={
                            <Clock className={cn('h-4 w-4', !showActiveHours && 'opacity-50')} />
                          }
                          label={t('personaConfig.activeHours')}
                          description={t('personaConfig.activeHoursHint')}
                          className={cn('text-base font-medium', !showActiveHours && 'opacity-50')}
                        />
                        <TagsInput
                          disabled={!showActiveHours}
                          value={activeHours}
                          onChange={setActiveHours}
                          placeholder={t('personaConfig.activeHoursPlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <LabelWithHelp
                          label={t('personaConfig.timezone')}
                          description={t('personaConfig.timezoneHint')}
                          className={cn('text-base font-medium', !showActiveHours && 'opacity-50')}
                        />
                        <Select
                          disabled={!showActiveHours}
                          value={timezone}
                          onValueChange={setTimezone}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timezoneChoices(timezone).map((zone) => (
                              <SelectItem key={zone} value={zone}>
                                {zone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <LabelWithHelp
                        icon={<Compass className={cn('h-4 w-4', !showAutonomy && 'opacity-50')} />}
                        label={t('personaConfig.autonomyTitle')}
                        description={t('personaConfig.autonomyHint')}
                        className={cn('text-base font-medium', !showAutonomy && 'opacity-50')}
                      />
                      <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
                        <div className={cn('space-y-2', !showAutonomy && 'opacity-50')}>
                          <Label htmlFor="autonomy-interval" className="text-sm">
                            {t('personaConfig.autonomyInterval')}
                          </Label>
                          <Input
                            id="autonomy-interval"
                            type="number"
                            min={15}
                            max={720}
                            disabled={!showAutonomy}
                            value={autonomyInterval}
                            onChange={(event) => {
                              const value = Number.parseInt(event.target.value, 10);
                              if (Number.isFinite(value)) setAutonomyInterval(value);
                            }}
                            onBlur={() =>
                              setAutonomyInterval((current) =>
                                boundedInt(String(current), 15, 720, AUTONOMY_INTERVAL_DEFAULT),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className={cn('text-sm', !showAutonomy && 'opacity-50')}>
                            {t('personaConfig.autonomyCareZone')}
                          </Label>
                          <Select
                            disabled={!showAutonomy}
                            value={careMinZone}
                            onValueChange={(value) =>
                              setCareMinZone(value === 'close' ? 'close' : 'familiar')
                            }
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="familiar">
                                {t('personaConfig.autonomyCareFamiliar')}
                              </SelectItem>
                              <SelectItem value="close">
                                {t('personaConfig.autonomyCareClose')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {/* 工具装配：启用工具（按插件）/ 显式工具白名单 */}
                    <PersonaToolScopeEditor
                      catalog={toolCatalog}
                      enabledPlugins={editingEnabledPlugins}
                      onEnabledPluginsChange={setEditingEnabledPlugins}
                      toolNames={editingToolNames}
                      onToolNamesChange={setEditingToolNames}
                      t={t}
                    />
                    <CheckListField
                      label={t('personaConfig.capabilityAgents')}
                      icon={<Layers className="h-4 w-4" />}
                      value={editingEnabledAgents}
                      items={capabilityAgentItems}
                      onChange={setEditingEnabledAgents}
                      searchPlaceholder={t('personaConfig.capabilityAgentsSearchPlaceholder')}
                      emptyText={t('personaConfig.capabilityAgentsEmpty')}
                      help={t('personaConfig.capabilityAgentsHint')}
                      summary={t('personaConfig.listSummary', {
                        selected: editingEnabledAgents.length,
                        total: capabilityAgentItems.length,
                      })}
                      t={t}
                    />
                  </div>
                </TabsContent>
                <TabsContent
                  value="settings"
                  className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
                >
                  {settingsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </div>
                  ) : Object.keys(editingSettings).length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 rounded-lg glass-card glass-alert border border-border/30">
                      {t('personaConfig.personaSettingsLoadFailed')}
                    </div>
                  ) : (
                    <div className="space-y-3 md:space-y-4">
                      <LabelWithHelp
                        label={t('personaConfig.personaSettings')}
                        description={t('personaConfig.personaSettingsHint')}
                        className="text-base font-medium"
                      />
                      <ConfigGrid
                        config={settingsToFormData(editingSettings)}
                        onChange={handleSettingsChange}
                        columns={3}
                      />
                    </div>
                  )}
                </TabsContent>
                {/* 头像 Tab */}
                <TabsContent
                  value="avatar"
                  className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
                >
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        {t('personaConfig.avatar')}
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (editingPersona) {
                            setUploadTargetPersona(editingPersona.name);
                            setUploadType('avatar');
                            setTimeout(() => fileInputRef.current?.click(), 0);
                          }
                        }}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {editingPersona?.has_avatar
                          ? t('personaConfig.updateAvatar')
                          : t('personaConfig.uploadAvatar')}
                      </Button>
                    </div>
                    <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[300px]">
                      {editingPersona?.has_avatar ? (
                        <div className="relative group">
                          <img
                            src={personaApi.getAvatarUrl(editingPersona.name, resourceTimestamp)}
                            alt={editingPersona.name}
                            className="max-w-full max-h-[400px] rounded-lg object-contain"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-2"
                              onClick={() =>
                                openImagePreview(
                                  personaApi.getAvatarUrl(editingPersona.name, resourceTimestamp),
                                  t('personaConfig.avatar'),
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              {t('common.view')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">{t('personaConfig.noAvatar')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                {/* 立绘 Tab */}
                <TabsContent
                  value="image"
                  className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
                >
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        {t('personaConfig.image')}
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (editingPersona) {
                            setUploadTargetPersona(editingPersona.name);
                            setUploadType('image');
                            setTimeout(() => fileInputRef.current?.click(), 0);
                          }
                        }}
                        disabled={isUploadingImage}
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {editingPersona?.has_image
                          ? t('personaConfig.updateImage')
                          : t('personaConfig.uploadImage')}
                      </Button>
                    </div>
                    <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[300px]">
                      {editingPersona?.has_image ? (
                        <div className="relative group">
                          <img
                            src={personaApi.getImageUrl(editingPersona.name, resourceTimestamp)}
                            alt={editingPersona.name}
                            className="max-w-full max-h-[400px] rounded-lg object-contain"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-2"
                              onClick={() =>
                                openImagePreview(
                                  personaApi.getImageUrl(editingPersona.name, resourceTimestamp),
                                  t('personaConfig.image'),
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              {t('common.view')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">{t('personaConfig.noImage')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                {/* 音频 Tab */}
                <TabsContent
                  value="audio"
                  className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
                >
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Music className="h-4 w-4" />
                        {t('personaConfig.audio')}
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (editingPersona) {
                            setUploadTargetPersona(editingPersona.name);
                            setUploadType('audio');
                            setTimeout(() => fileInputRef.current?.click(), 0);
                          }
                        }}
                        disabled={isUploadingAudio}
                      >
                        {isUploadingAudio ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {editingPersona?.has_audio
                          ? t('personaConfig.updateAudio')
                          : t('personaConfig.uploadAudio')}
                      </Button>
                    </div>
                    <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg min-h-[200px]">
                      {editingPersona?.has_audio ? (
                        <div className="flex items-center gap-3 md:gap-4">
                          <Button
                            variant="outline"
                            size="lg"
                            className="gap-2"
                            onClick={() => toggleAudioPlayback(editingPersona.name)}
                          >
                            {playingAudio === editingPersona.name ? (
                              <>
                                <Pause className="h-5 w-5" />
                                {t('personaConfig.pauseAudio')}
                              </>
                            ) : (
                              <>
                                <Play className="h-5 w-5" />
                                {t('personaConfig.playAudio')}
                              </>
                            )}
                          </Button>
                          {playingAudio === editingPersona.name && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              {t('personaConfig.playing')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">{t('personaConfig.noAudio')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            <SheetFooter className="shrink-0 flex-row items-center justify-between gap-3 space-x-0 border-t px-6 py-4">
              <div className="text-xs tabular-nums text-muted-foreground">
                {t('personaConfig.charCount', { count: [...editContent].length })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={isSaving}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={() => setSaveConfirmOpen(true)}
                  disabled={isSaving}
                  className="button-solid gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {t('personaConfig.savePersona')}
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        {/* 图片预览对话框 */}
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="sm:max-w-[800px] sm:max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewImageTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t('personaConfig.imagePreviewAriaDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              <img
                src={previewImageUrl}
                alt={previewImageTitle}
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImagePreviewOpen(false)}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* 保存二次确认 */}
        <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('personaConfig.confirmSave')}</AlertDialogTitle>
              <AlertDialogDescription>
                {editingPersona &&
                findConflictingPersonas(personaConfigs, editingPersona.name, editingScope).length >
                  0
                  ? t('personaConfig.confirmSaveWithConflict', {
                      name: editingPersona.name,
                      current: findConflictingPersonas(
                        personaConfigs,
                        editingPersona.name,
                        editingScope,
                      ).join('、'),
                    })
                  : t('personaConfig.confirmSaveMessage', {
                      name: editingPersona?.name,
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveEdit}>{t('common.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* 全局启用冲突确认 */}
        <AlertDialog open={scopeChangeConfirmOpen} onOpenChange={setScopeChangeConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                {t('personaConfig.globalConflictTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('personaConfig.globalConflictMessage', {
                  current: pendingScopeChange?.conflicts.join('、'),
                  new: pendingScopeChange?.personaName,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingScopeChange(null)}>
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmScopeChange}>
                {t('personaConfig.switchGlobal')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* 复制二次确认 */}
        <AlertDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('personaConfig.copyConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('personaConfig.copyConfirmMessage', {
                  name: copyTarget,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmCopy}>
                {t('personaConfig.copyPersona')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* 删除二次确认 */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('personaConfig.deleteConfirm')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('personaConfig.deleteConfirmMessage', {
                  name: deleteTarget,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PinnedPage>
    </>
  );
}
