import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagsInput } from '@/components/config/TagsInput';
import { MultiSelectChipGroup } from '@/components/ui/MultiSelectChipGroup';
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
  Trash2,
  Sparkles,
  User,
  Check,
  Brain,
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
  Target,
  HelpCircle,
  Package,
  Wrench,
} from 'lucide-react';
// 支持的音频格式
const SUPPORTED_AUDIO_FORMATS = ['mp3', 'ogg', 'wav', 'm4a', 'flac'];
const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',   // mp3
  'audio/ogg',    // ogg
  'audio/wav',    // wav
  'audio/x-m4a',  // m4a
  'audio/flac',   // flac
  'audio/mp3',    // mp3 (alternative)
  'audio/wave',   // wav (alternative)
];
import {
  personaApi,
  frameworkConfigApi,
  type PersonaListItem,
  type PersonaFrameworkConfig,
  type PersonaConfig,
  type PersonaScope,
  type AIMode,
} from '@/lib/api';
import { toast } from 'sonner';
import { PinnedPage } from '@/components/layout/PinnedPage';
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
const AI_MODE_OPTIONS: { value: AIMode; label: string; icon: React.ReactNode; description: string; disabled?: boolean }[] = [
  { value: '提及应答', label: '提及应答', icon: <MessageSquare className="w-4 h-4" />, description: '被@时自动回复' },
  { value: '定时巡检', label: '定时巡检', icon: <Clock className="w-4 h-4" />, description: '定时检查处理任务' },
  { value: '趣向捕捉(暂不可用)', label: '趣向捕捉', icon: <Target className="w-4 h-4" />, description: '识别响应特定内容', disabled: true },
  { value: '困境救场(暂不可用)', label: '困境救场', icon: <HelpCircle className="w-4 h-4" />, description: '群友遇困时帮助', disabled: true },
];
const SCOPE_OPTIONS: { value: PersonaScope; labelKey: string; descKey: string; icon: React.ReactNode }[] = [
  { value: 'disabled', labelKey: 'personaConfig.scopeDisabled', descKey: 'personaConfig.scopeDisabledDesc', icon: <PowerOff className="w-4 h-4" /> },
  { value: 'specific', labelKey: 'personaConfig.scopeSpecific', descKey: 'personaConfig.scopeSpecificDesc', icon: <Users className="w-4 h-4" /> },
  { value: 'global', labelKey: 'personaConfig.scopeGlobal', descKey: 'personaConfig.scopeGlobalDesc', icon: <Globe className="w-4 h-4" /> },
  { value: 'global_group', labelKey: 'personaConfig.scopeGlobalGroup', descKey: 'personaConfig.scopeGlobalGroupDesc', icon: <MessagesSquare className="w-4 h-4" /> },
  { value: 'global_private', labelKey: 'personaConfig.scopeGlobalPrivate', descKey: 'personaConfig.scopeGlobalPrivateDesc', icon: <MessageCircle className="w-4 h-4" /> },
];
const CONFIG_OPTION_BUTTON =
  'flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 transition-all text-left min-h-[3.5rem]';
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
export default function PersonaConfigPage() {
  const { style, cardOpacity, blurIntensity } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';
  // 状态
  const [personaList, setPersonaList] = useState<PersonaListItem[]>([]);
  const [personaDetails, setPersonaDetails] = useState<Record<string, PersonaCardData>>({});
  const [personaConfigs, setPersonaConfigs] = useState<Record<string, PersonaConfig>>({});
  const [heartbeatStatus, setHeartbeatStatus] = useState<
    Record<
      string,
      { enabled: boolean; job_registered: boolean; inspect_interval: number | null; job_id: string | null }
    >
  >({});
  const [frameworkConfig, setFrameworkConfig] = useState<PersonaFrameworkConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
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
  const [editContent, setEditContent] = useState('');
  const [editingGroups, setEditingGroups] = useState<string[]>([]);
  const [editingAIModes, setEditingAIModes] = useState<AIMode[]>([]);
  const [editingScope, setEditingScope] = useState<PersonaScope>('disabled');
  const [editingInspectInterval, setEditingInspectInterval] = useState<number>(10);
  const [editingKeywords, setEditingKeywords] = useState<string[]>([]);
  const [editingToolPacks, setEditingToolPacks] = useState<string[]>(['dynamic']);
  const [editingToolNames, setEditingToolNames] = useState<string[]>([]);
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
    return frameworkConfig?.config.enable_persona.value || [];
  }, [frameworkConfig]);
  // 获取人格对应的群聊映射
  const personaGroupsMap = useMemo(() => {
    return frameworkConfig?.config.persona_for_session.value || {};
  }, [frameworkConfig]);
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
  // 加载人格列表和框架配置
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [listData, frameworkData, allConfigs, hbStatus] = await Promise.all([
        personaApi.getPersonaList(),
        personaApi.getFrameworkConfig(),
        personaApi.getAllPersonaConfigs().catch(() => ({} as Record<string, PersonaConfig>)),
        personaApi.getHeartbeatStatus().catch(() => null),
      ]);
      setPersonaList(listData);
      setFrameworkConfig(frameworkData);
      setPersonaConfigs(allConfigs);
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
        })
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
    [t]
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
      const currentConfig = personaConfigs[personaName] || { ai_mode: [], scope: 'disabled', target_groups: [] };
      
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
        const currentGlobalConfig = personaConfigs[conflictName] || { ai_mode: [], scope: 'disabled', target_groups: [] };
        await personaApi.updatePersonaConfig(conflictName, {
          ...currentGlobalConfig,
          scope: 'disabled',
        });
      }
      
      // 然后设置新的人格为全局启用
      const currentConfig = personaConfigs[pendingScopeChange.personaName] || { ai_mode: [], scope: 'disabled', target_groups: [] };
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
      const currentConfig = personaConfigs[personaName] || { ai_mode: [], scope: 'disabled', target_groups: [] };
      
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
  // 打开编辑对话框（点击卡片）
  const handleCardClick = (persona: PersonaCardData) => {
    setEditingPersona(persona);
    setEditContent(persona.content);
    setEditingGroups([...persona.groups]);
    setEditingAIModes(persona.config?.ai_mode || []);
    setEditingScope(persona.config?.scope || 'disabled');
    setEditingInspectInterval(persona.config?.inspect_interval || 10);
    setEditingKeywords(persona.config?.keywords || []);
    setEditingToolPacks(persona.config?.tool_packs || ['dynamic']);
    setEditingToolNames(persona.config?.tool_names || []);
    setActiveTab('markdown');
    setEditDialogOpen(true);
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
        const isValidAudioType = SUPPORTED_AUDIO_MIME_TYPES.some(mimeType =>
          file.type.toLowerCase().includes(mimeType.toLowerCase()) ||
          file.type.toLowerCase().startsWith('audio/')
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
        ai_mode: editingAIModes,
        scope: editingScope,
        target_groups: editingGroups,
        inspect_interval: editingInspectInterval,
        keywords: editingKeywords,
        tool_packs: editingToolPacks,
        tool_names: editingToolNames,
      });
      // 保存 Markdown 内容（仅在内容发生变化时）
      if (editContent !== editingPersona.content) {
        await personaApi.updatePersonaContent(editingPersona.name, editContent);
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
      toast.error(t('personaConfig.saveFailed'));
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
  // 处理卡片上的群聊标签变化（直接保存）
  const handleGroupsChange = async (personaName: string, groups: string[]) => {
    if (!frameworkConfig) return;
    try {
      const currentConfig = personaConfigs[personaName] || { ai_mode: [], scope: 'disabled', target_groups: [] };
      
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
      toast.error(errorMsg ? `${t('personaConfig.deleteFailed')}: ${errorMsg}` : t('personaConfig.deleteFailed'));
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
    const aiModes = persona.config?.ai_mode || [];
    const inspectInterval = persona.config?.inspect_interval;
    const hb = heartbeatStatus[persona.name];
    return (
      <Card
        key={persona.name}
        onClick={() => handleCardClick(persona)}
        className={cn(
          'relative transition-all duration-300 cursor-pointer group',
          'hover:shadow-xl hover:scale-[1.02]',
          // 毛玻璃效果 + 红色主题边框
          isGlass
            ? 'glass-card border border-primary/20 hover:border-primary/40'
            : 'border border-primary/30 hover:border-primary/50 bg-card'
        )}
      >
        {/* 立绘背景层 */}
        {hasImage && (
          <div className="absolute inset-0 z-0">
            <img
              src={imageUrl}
              alt=""
              className={cn(
                "w-full h-full object-cover transition-opacity",
                isGlass
                  ? "opacity-30 group-hover:opacity-40"
                  : "opacity-15 group-hover:opacity-20"
              )}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className={cn(
              "absolute inset-0 bg-gradient-to-t",
              isGlass
                ? "from-background/80 via-background/50 to-background/30"
                : "from-background via-background/90 to-background/60"
            )} />
          </div>
        )}
        <CardContent className="relative z-10 p-4 flex flex-col h-full gap-3">
          {/* === 区域1: 头像和基本信息 === */}
          <div className="flex items-center gap-3">
            {/* 头像 - 带红色主题边框 */}
            <div
              onClick={(e) => handleAvatarClick(e, persona)}
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0',
                'cursor-pointer transition-all',
                'ring-2 ring-primary/30 hover:ring-primary/60',
                persona.has_avatar ? 'bg-transparent' : 'bg-primary/10'
              )}
              title={t('personaConfig.uploadAvatar')}
            >
              {persona.has_avatar ? (
                <img
                  src={avatarUrl}
                  alt={persona.name}
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleDeleteClick(e, persona.name)}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  disabled={isDeleting === persona.name}
                >
                  {isDeleting === persona.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {/* Heartbeat 运行态 */}
              {hb && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <Badge
                    variant={hb.enabled ? 'default' : 'secondary'}
                    className={CARD_BADGE}
                  >
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
                <Badge
                  className={cn(CARD_BADGE, getScopeBadgeStyle(scope))}
                >
                  {getScopeLabel(scope, t)}
                </Badge>
                {aiModes.length > 0 && (
                  <Badge className={cn(CARD_BADGE, 'bg-primary/15 text-primary border border-primary/30')}>
                    {aiModes.length} {t('personaConfig.modesEnabled')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {/* === 区域2: 内容预览 === */}
          <p className="text-xs text-muted-foreground line-clamp-2 break-words whitespace-pre-wrap min-h-[32px]">
            {preview || t('common.noData')}
          </p>
          {/* === 区域3: 资源状态（胶囊按钮） === */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {[
              { key: 'avatar', has: persona.has_avatar, icon: ImageIcon, label: t('personaConfig.avatar'), onClick: handleAvatarClick, activeColor: 'green' },
              { key: 'image', has: persona.has_image, icon: ImagePlus, label: t('personaConfig.image'), onClick: handleImageClick, activeColor: 'blue' },
              { key: 'audio', has: persona.has_audio, icon: Music2, label: t('personaConfig.audio'), onClick: handleAudioClick, activeColor: 'purple' },
            ].map(({ key, has, icon: Icon, label, onClick, activeColor }) => (
              <button
                key={key}
                onClick={(e) => onClick(e, persona)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all',
                  has
                    ? activeColor === 'green'
                      ? 'bg-green-500/15 text-green-600 border border-green-500/30 hover:bg-green-500/25'
                      : activeColor === 'blue'
                      ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30 hover:bg-blue-500/25'
                      : 'bg-purple-500/15 text-purple-600 border border-purple-500/30 hover:bg-purple-500/25'
                    : 'bg-muted/30 text-muted-foreground border border-border/30 hover:bg-muted/50'
                )}
                title={label}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          {/* === 区域4: 启用范围选择（分隔线 + 胶囊按钮） === */}
          <div className="pt-3 border-t border-primary/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-2">
              <Globe className="w-3 h-3 text-primary/60" />
              <Label className="text-[10px] text-muted-foreground leading-none">{t('personaConfig.enableScope')}</Label>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleScopeChange(persona.name, option.value)}
                  disabled={isSavingConfig}
                  className={cn(
                    'shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all',
                    'border whitespace-nowrap',
                    scope === option.value
                      ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                      : 'bg-transparent text-muted-foreground border-border/30 hover:bg-muted/30 hover:border-border/50'
                  )}
                >
                  <span className="w-3 h-3 flex items-center justify-center shrink-0">{option.icon}</span>
                  <span>{t(option.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
          {/* === 区域5: AI 模式选择（胶囊按钮） === */}
          <div onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 mb-2">
              <Settings className="w-3 h-3 text-primary/60" />
              <Label className="text-[10px] text-muted-foreground leading-none">{t('personaConfig.aiModes')}</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AI_MODE_OPTIONS.map((mode) => {
                const isSelected = aiModes.includes(mode.value);
                return (
                  <button
                    key={mode.value}
                    type="button"
                    disabled={mode.disabled}
                    onClick={() => {
                      if (mode.disabled) return;
                      const newModes = isSelected
                        ? aiModes.filter(m => m !== mode.value)
                        : [...aiModes, mode.value];
                      handleAIModesChange(persona.name, newModes as AIMode[]);
                    }}
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-sans font-medium text-left transition-all border',
                      mode.disabled && 'opacity-40 cursor-not-allowed',
                      isSelected
                        ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                        : 'bg-transparent text-muted-foreground border-border/30 hover:bg-muted/30 hover:border-border/50'
                    )}
                  >
                    <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{mode.icon}</span>
                    <span className="flex-1 text-left">{mode.label}</span>
                    {mode.value === '定时巡检' && isSelected && inspectInterval && (
                      <span className="shrink-0 text-[10px] font-medium text-primary/70">{inspectInterval}{t('personaConfig.minutesUnit')}</span>
                    )}
                    {mode.value === '提及应答' && isSelected && (persona.config?.keywords?.length ?? 0) > 0 && (
                      <span className="shrink-0 text-[10px] font-medium text-primary/70">{persona.config?.keywords?.length}{t('personaConfig.keywordsCountSuffix')}</span>
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
                <Label className="text-[10px] text-muted-foreground leading-none">{t('personaConfig.enabledGroups')}</Label>
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
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Brain className="w-8 h-8 shrink-0" />
              {t('personaConfig.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">{t('personaConfig.description')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
            {/* AI 生成按钮 */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 whitespace-nowrap">
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
                  <DialogDescription>
                    {t('personaConfig.createNewDesc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="persona-name">
                      {t('personaConfig.personaName')}
                    </Label>
                    <Input
                      id="persona-name"
                      placeholder={t('personaConfig.personaNamePlaceholder')}
                      value={newPersonaName}
                      onChange={(e) => setNewPersonaName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="persona-query">
                      {t('personaConfig.personaQuery')}
                    </Label>
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
                    disabled={
                      isCreating || !newPersonaName.trim() || !newPersonaQuery.trim()
                    }
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
            <Dialog open={createManuallyDialogOpen} onOpenChange={setCreateManuallyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 whitespace-nowrap">
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
                <div className="space-y-4 py-4">
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
          </div>
        </div>
      }
    >
      {/* 全局启用提示 */}
      {personaCards.some((p) => isGlobalLikeScope(p.config?.scope)) && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg text-sm",
          "bg-blue-500/10 text-blue-600 border border-blue-500/30"
        )}>
          <Globe className="w-4 h-4" />
          <span>{t('personaConfig.globalEnabledHint', {
            name: personaCards
              .filter((p) => isGlobalLikeScope(p.config?.scope))
              .map((p) => `${p.name}（${getScopeLabel(p.config?.scope || 'disabled', t)}）`)
              .join('、'),
          })}</span>
        </div>
      )}
      {/* 无启用人格警告 */}
      {!personaCards.some((p) => isGlobalLikeScope(p.config?.scope)) && !personaCards.some(p => p.config?.scope === 'specific') && personaCards.length > 0 && (
        <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-sm glass-card",
                  "border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300"
        )} style={{
          ["--card-opacity" as string]: (cardOpacity / 100).toString(),
          ["--blur-intensity" as string]: `${blurIntensity}px`,
        }}
        >
          <AlertCircle className="w-4 h-4" />
          <span>{t('personaConfig.noPersonaEnabledWarning')}</span>
        </div>
      )}
      {/* 仅特定群聊启用警告 */}
      {!personaCards.some((p) => isGlobalLikeScope(p.config?.scope)) && personaCards.some(p => p.config?.scope === 'specific') && (
        <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-sm glass-card",
                  "border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300"
        )} style={{
          ["--card-opacity" as string]: (cardOpacity / 100).toString(),
          ["--blur-intensity" as string]: `${blurIntensity}px`,
        }}
        >
          <AlertCircle className="w-4 h-4" />
          <span>{t('personaConfig.specificOnlyWarning', {
            groups: personaCards
              .filter(p => p.config?.scope === 'specific' && p.groups.length > 0)
              .flatMap(p => p.groups)
              .join('、') || t('personaConfig.noGroups')
          })}</span>
        </div>
      )}
      {/* 人格列表 - 响应式网格布局 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : personaCards.length === 0 ? (
        <>
          {/* 无人格警告 */}
          <div className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm glass-card",
                    "border border-amber-500/40 dark:border-amber-400/40 text-amber-700 dark:text-amber-300"
          )} style={{
            ["--card-opacity" as string]: (cardOpacity / 100).toString(),
            ["--blur-intensity" as string]: `${blurIntensity}px`,
          }}
          >
            <AlertCircle className="w-4 h-4" />
            <span>{t('personaConfig.noPersonaAtAllWarning')}</span>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t('personaConfig.noPersonas')}
            </p>
            <Button
              variant="link"
              onClick={() => setCreateDialogOpen(true)}
              className="mt-2"
            >
              {t('personaConfig.createNew')}
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
          {personaCards.map(renderPersonaCard)}
        </div>
      )}
      {/* 编辑：右侧半屏，交互对齐看板详情 Sheet */}
      <Sheet open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <SheetContent
          side="right"
          overlayClassName="bg-white/80 dark:bg-black/80 data-[state=open]:animate-sheet-overlay-in data-[state=closed]:animate-sheet-overlay-out"
          className="flex h-full w-full flex-col gap-0 bg-background/95 p-0 glass-card !fixed !inset-y-0 !right-0 !left-auto !top-0 !rounded-none !border-l !max-w-[60vw] will-change-transform data-[state=open]:animate-sheet-slide-in-right data-[state=closed]:animate-sheet-slide-out-right"
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="markdown" className="gap-2">
                <FileText className="h-4 w-4" />
                {t('personaConfig.personaMarkdown')}
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2">
                <Settings className="h-4 w-4" />
                {t('personaConfig.config')}
              </TabsTrigger>
              <TabsTrigger value="avatar" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                {t('personaConfig.avatar')}
              </TabsTrigger>
              <TabsTrigger value="image" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                {t('personaConfig.image')}
              </TabsTrigger>
              <TabsTrigger value="audio" className="gap-2">
                <Music className="h-4 w-4" />
                {t('personaConfig.audio')}
              </TabsTrigger>
            </TabsList>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
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
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
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
              <div className="space-y-6">
                {/* 启用范围配置 */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4" />
                    {t('personaConfig.enableScope')}
                  </Label>
                  <div className="grid grid-cols-5 gap-3 items-stretch">
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
                            : 'border-border hover:border-border/80 hover:bg-muted/50'
                        )}
                      >
                        <div className={cn(
                          'p-1.5 rounded-full shrink-0',
                          editingScope === option.value
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {option.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{t(option.labelKey)}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{t(option.descKey)}</div>
                        </div>
                        {editingScope === option.value && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* 全局启用冲突提示 */}
                  {editingPersona && findConflictingPersonas(personaConfigs, editingPersona.name, editingScope).length > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-amber-500/10 text-amber-600 border border-amber-500/30">
                      <AlertCircle className="w-4 h-4" />
                      <span>{t('personaConfig.globalConflictHint', {
                        name: findConflictingPersonas(personaConfigs, editingPersona.name, editingScope).join('、'),
                      })}</span>
                    </div>
                  )}
                </div>
                {/* AI 模式配置 */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Settings className="h-4 w-4" />
                    {t('personaConfig.aiModes')}
                  </Label>
                  <div className="grid grid-cols-5 gap-3 items-stretch">
                    {AI_MODE_OPTIONS.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        disabled={mode.disabled}
                        onClick={() => {
                          if (mode.disabled) return;
                          const isSelected = editingAIModes.includes(mode.value);
                          if (isSelected) {
                            setEditingAIModes(editingAIModes.filter(m => m !== mode.value));
                          } else {
                            setEditingAIModes([...editingAIModes, mode.value]);
                          }
                        }}
                        className={cn(
                          CONFIG_OPTION_BUTTON,
                          mode.disabled && 'opacity-50 cursor-not-allowed',
                          editingAIModes.includes(mode.value)
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-border/80 hover:bg-muted/50'
                        )}
                      >
                        <div className={cn(
                          'p-1.5 rounded-full shrink-0',
                          editingAIModes.includes(mode.value) ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          {mode.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {mode.label}
                            {mode.disabled && <span className="text-xs text-muted-foreground">({t('common.comingSoon')})</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{mode.description}</div>
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
                  <div className="space-y-3">
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
                {/* 定时巡检间隔 - 仅在选择"定时巡检"模式时显示 */}
                {editingAIModes.includes('定时巡检') && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4" />
                      {t('personaConfig.inspectInterval')}
                    </Label>
                    <Select
                      value={editingInspectInterval.toString()}
                      onValueChange={(value) => setEditingInspectInterval(parseInt(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">{t('personaConfig.inspectInterval5min')}</SelectItem>
                        <SelectItem value="10">{t('personaConfig.inspectInterval10min')}</SelectItem>
                        <SelectItem value="15">{t('personaConfig.inspectInterval15min')}</SelectItem>
                        <SelectItem value="30">{t('personaConfig.inspectInterval30min')}</SelectItem>
                        <SelectItem value="60">{t('personaConfig.inspectInterval60min')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* 触发关键词 - 仅在选择"提及应答"模式时显示 */}
                {editingAIModes.includes('提及应答') && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4" />
                      {t('personaConfig.triggerKeywords')}
                    </Label>
                    <TagsInput
                      value={editingKeywords}
                      onChange={setEditingKeywords}
                      placeholder={t('personaConfig.keywordsPlaceholder')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('personaConfig.keywordsHint')}
                    </p>
                  </div>
                )}
                {/* 工具能力族（AgentNode 同构：dynamic / task_basics / capability_domain 族名） */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4" />
                    {t('personaConfig.toolPacks')}
                  </Label>
                  <TagsInput
                    value={editingToolPacks}
                    onChange={setEditingToolPacks}
                    placeholder={t('personaConfig.toolPacksPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('personaConfig.toolPacksHint')}
                  </p>
                </div>
                {/* 显式工具白名单（并入保底池，不经向量检索） */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Wrench className="h-4 w-4" />
                    {t('personaConfig.toolNames')}
                  </Label>
                  <TagsInput
                    value={editingToolNames}
                    onChange={setEditingToolNames}
                    placeholder={t('personaConfig.toolNamesPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('personaConfig.toolNamesHint')}
                  </p>
                </div>
              </div>
            </TabsContent>
            {/* 头像 Tab */}
            <TabsContent
              value="avatar"
              className="mt-0 hidden min-h-0 flex-1 overflow-y-auto data-[state=active]:block"
            >
              <div className="space-y-4">
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
                              t('personaConfig.avatar')
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
                      <p className="text-muted-foreground">
                        {t('personaConfig.noAvatar')}
                      </p>
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
              <div className="space-y-4">
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
                              t('personaConfig.image')
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
                      <p className="text-muted-foreground">
                        {t('personaConfig.noImage')}
                      </p>
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
              <div className="space-y-4">
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
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        className="gap-2"
                        onClick={() =>
                          toggleAudioPlayback(editingPersona.name)
                        }
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
                      <p className="text-muted-foreground">
                        {t('personaConfig.noAudio')}
                      </p>
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
                className="gap-2"
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
            <Button
              variant="outline"
              onClick={() => setImagePreviewOpen(false)}
            >
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
              {editingPersona && findConflictingPersonas(personaConfigs, editingPersona.name, editingScope).length > 0
                ? t('personaConfig.confirmSaveWithConflict', {
                    name: editingPersona.name,
                    current: findConflictingPersonas(personaConfigs, editingPersona.name, editingScope).join('、'),
                  })
                : t('personaConfig.confirmSaveMessage', {
                    name: editingPersona?.name,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveEdit}>
              {t('common.confirm')}
            </AlertDialogAction>
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
      {/* 删除二次确认 */}
      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('personaConfig.deleteConfirm')}
            </AlertDialogTitle>
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
