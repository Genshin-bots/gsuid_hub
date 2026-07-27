import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
  tabToolbarIconButtonClass,
} from '@/components/ui/TabButtonGroup';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Sparkles,
  FileText,
  Image,
  Upload,
  Eye,
  Files,
  Download,
  FileUp,
  FolderOpen,
  ScrollText,
  FilePlus,
} from 'lucide-react';
import {
  aiKnowledgeApi,
  AIKnowledgeItem,
  AIKnowledgeBulkRequest,
  AIKnowledgeBulkResponse,
  AIKnowledgeBackupResponse,
  AIKnowledgeDocDeleteResponse,
  aiImageApi,
  AIImageItem,
  AIImageUploadResponse,
  assetsApi,
} from '@/lib/api';
import { toast } from 'sonner';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { TagsInput } from '@/components/config/TagsInput';


// ============================================================================
// 类型定义
// ============================================================================

type KnowledgeType = 'text' | 'image';
type SourceFilter = 'plugin' | 'manual';

interface TextKnowledgeFormData {
  id: string;
  plugin: string;
  title: string;
  content: string;
  tags: string[];
}

interface ImageKnowledgeFormData {
  id: string;
  plugin: string;
  path: string;
  tags: string[];
  content: string;
  previewUrl?: string;
}

const initialTextFormData: TextKnowledgeFormData = {
  id: '',
  plugin: 'manual',
  title: '',
  content: '',
  tags: [],
};

const initialImageFormData: ImageKnowledgeFormData = {
  id: '',
  plugin: 'manual',
  path: '',
  tags: [],
  content: '',
  previewUrl: '',
};

// ============================================================================
// 组件定义
// ============================================================================

export default function AIKnowledgePage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 知识类型筛选（文本/图片）
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeType>('text');
  
  // 来源筛选（插件/手动）
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('plugin');
  
  // 搜索和分页状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // 文本知识状态
  const [textKnowledgeList, setTextKnowledgeList] = useState<AIKnowledgeItem[]>([]);
  const [textSearchResults, setTextSearchResults] = useState<AIKnowledgeItem[]>([]);
  
  // 图片知识状态
  const [imageKnowledgeList, setImageKnowledgeList] = useState<AIImageItem[]>([]);
  const [imageSearchResults, setImageSearchResults] = useState<AIImageItem[]>([]);
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog 状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [textFormData, setTextFormData] = useState<TextKnowledgeFormData>(initialTextFormData);
  const [imageFormData, setImageFormData] = useState<ImageKnowledgeFormData>(initialImageFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 批量导入（服务端分片）
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkText, setBulkText] = useState('');
  const [bulkDocId, setBulkDocId] = useState('');
  const [bulkDocTitle, setBulkDocTitle] = useState('');
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkChunkSize, setBulkChunkSize] = useState(400);
  const [bulkChunkOverlap, setBulkChunkOverlap] = useState(60);
  const [bulkReplace, setBulkReplace] = useState(true);
  const [bulkPlugin, setBulkPlugin] = useState('manual');
  const [bulkOneDocPerFile, setBulkOneDocPerFile] = useState(true);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<
    { doc_id: string; total_chunks: number; written: number; skipped: number } | null
  >(null);
  const [isBulkDragging, setIsBulkDragging] = useState(false);

  // 文档级浏览（按 doc_id）
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [docViewerDocId, setDocViewerDocId] = useState('');
  const [docViewerTitle, setDocViewerTitle] = useState('');
  const [docViewerChunks, setDocViewerChunks] = useState<AIKnowledgeItem[]>([]);
  const [docViewerLoading, setDocViewerLoading] = useState(false);
  const [docViewerTotal, setDocViewerTotal] = useState(0);
  const [docViewerPage, setDocViewerPage] = useState(1);
  const [docViewerLimit] = useState(20);
  const [deletingDoc, setDeletingDoc] = useState<{ doc_id: string; title: string } | null>(null);

  // 备份导入/导出
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupImporting, setBackupImporting] = useState(false);


  // 删除确认 Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AIKnowledgeItem | AIImageItem | null>(null);

  // 图片预览 Dialog
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  // 加载知识列表
  const fetchKnowledgeList = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (knowledgeType === 'text') {
        const data = await aiKnowledgeApi.getKnowledgeList({ 
          page, 
          limit, 
          source: sourceFilter 
        });
        setTextKnowledgeList(data.list || []);
        setTotal(data.total);
        setPageSize(data.page_size);
      } else {
        const data = await aiImageApi.getImageList({ 
          page, 
          limit, 
          plugin: sourceFilter 
        });
        setImageKnowledgeList(data.list || []);
        setTotal(data.total);
        setPageSize(data.page_size);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, sourceFilter, knowledgeType, t]);

  useEffect(() => {
    fetchKnowledgeList();
  }, [fetchKnowledgeList]);

  // 搜索处理
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      setTextSearchResults([]);
      setImageSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      
      if (knowledgeType === 'text') {
        const data = await aiKnowledgeApi.searchKnowledge(searchQuery, 50, sourceFilter);
        setTextSearchResults(data.results || []);
      } else {
        const data = await aiImageApi.searchImages(searchQuery, 50, sourceFilter);
        setImageSearchResults(data.results || []);
      }
      
      setShowSearchResults(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsSearching(false);
    }
  };

  // 打开新增 Dialog
  const handleOpenAddDialog = () => {
    setIsEditMode(false);
    if (knowledgeType === 'text') {
      setTextFormData(initialTextFormData);
    } else {
      setImageFormData(initialImageFormData);
    }
    setDialogOpen(true);
  };

  // 打开编辑 Dialog - 文本知识
  const handleOpenEditTextDialog = (item: AIKnowledgeItem) => {
    setIsEditMode(true);
    setTextFormData({
      id: item.id,
      plugin: item.plugin,
      title: item.title,
      content: item.content,
      tags: item.tags || [],
    });
    setDialogOpen(true);
  };

  // 打开编辑 Dialog - 图片知识
  const handleOpenEditImageDialog = (item: AIImageItem) => {
    setIsEditMode(true);
    setImageFormData({
      id: item.id,
      plugin: item.plugin,
      path: item.path,
      tags: item.tags || [],
      content: item.content || '',
      previewUrl: assetsApi.getPreviewUrl(item.path),
    });
    setDialogOpen(true);
  };

  // 保存文本知识
  const handleSaveTextKnowledge = async () => {
    if (!textFormData.title.trim() || !textFormData.content.trim()) {
      toast.error(t('common.saveFailed'));
      return;
    }

    try {
      setIsSaving(true);
      if (isEditMode) {
        await aiKnowledgeApi.updateKnowledge(textFormData.id, {
          title: textFormData.title,
          content: textFormData.content,
          tags: textFormData.tags,
        });
        toast.success(t('common.saveSuccess'));
      } else {
        await aiKnowledgeApi.createKnowledge({
          plugin: textFormData.plugin,
          title: textFormData.title,
          content: textFormData.content,
          tags: textFormData.tags,
        });
        toast.success(t('common.saveSuccess'));
      }
      setDialogOpen(false);
      fetchKnowledgeList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // 保存图片知识
  const handleSaveImageKnowledge = async () => {
    if (!imageFormData.path.trim() || imageFormData.tags.length === 0) {
      toast.error(t('aiKnowledge.imagePathAndTagsRequired'));
      return;
    }

    try {
      setIsSaving(true);
      if (isEditMode) {
        // 图片知识暂不支持更新，只能删除后重新添加
        toast.error(t('aiKnowledge.imageUpdateNotSupported'));
      } else {
        await aiImageApi.createImage({
          id: imageFormData.id,
          plugin: imageFormData.plugin,
          path: imageFormData.path,
          tags: imageFormData.tags.join(','),
          content: imageFormData.content,
        });
        toast.success(t('common.saveSuccess'));
        setDialogOpen(false);
        fetchKnowledgeList();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // 处理保存
  const handleSave = () => {
    if (knowledgeType === 'text') {
      handleSaveTextKnowledge();
    } else {
      handleSaveImageKnowledge();
    }
  };

  // 删除知识
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      
      if (knowledgeType === 'text') {
        await aiKnowledgeApi.deleteKnowledge(itemToDelete.id);
      } else {
        await aiImageApi.deleteImage(itemToDelete.id);
      }
      
      toast.success(t('common.success'));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchKnowledgeList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.delete'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error(t('aiKnowledge.invalidImageType'));
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('aiKnowledge.imageSizeLimit'));
      return;
    }

    try {
      setIsUploading(true);
      const result = await aiImageApi.uploadImage(file);
      
      setImageFormData(prev => ({
        ...prev,
        path: result.path,
        previewUrl: assetsApi.getPreviewUrl(result.path),
      }));
      
      toast.success(t('aiKnowledge.imageUploadSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiKnowledge.imageUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  // 预览图片
  const handlePreviewImage = (path: string) => {
    setPreviewImageUrl(assetsApi.getPreviewUrl(path));
    setPreviewDialogOpen(true);
  };

  // ===================== 批量导入（服务端分片） =====================
  const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB / 单文件软上限（服务端无硬限制）

  const resetBulkDialog = () => {
    setBulkFiles([]);
    setBulkText('');
    setBulkDocId('');
    setBulkDocTitle('');
    setBulkTags([]);
    setBulkChunkSize(400);
    setBulkChunkOverlap(60);
    setBulkReplace(true);
    setBulkPlugin('manual');
    setBulkOneDocPerFile(true);
    setBulkImportResult(null);
  };

  const ACCEPTED_TEXT_EXT = ['.txt', '.md', '.markdown', '.rst', '.log', '.json', '.jsonl', '.csv', '.html', '.htm', '.xml', '.yaml', '.yml', '.ini', '.conf', '.tex'];

  const isAcceptedTextFile = (f: File) => {
    const name = f.name.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) return true;
    return ACCEPTED_TEXT_EXT.some((ext) => name.endsWith(ext));
  };

  const handleBulkDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBulkDragging(false);
    const list = Array.from(e.dataTransfer.files || []).filter(isAcceptedTextFile);
    if (list.length === 0) {
      toast.error(t('aiKnowledge.bulkNoValidFiles'));
      return;
    }
    setBulkFiles((prev) => [...prev, ...list]);
    // 自动用第一个文件名作为默认 doc_id / title（仅在用户尚未手动填写时）
    setBulkDocTitle((cur) => (cur ? cur : list[0].name.replace(/\.[^.]+$/, '')));
    setBulkDocId((cur) => (cur ? cur : list[0].name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toLowerCase()));
  };

  const handleBulkPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []).filter(isAcceptedTextFile);
    if (list.length === 0) {
      toast.error(t('aiKnowledge.bulkNoValidFiles'));
      return;
    }
    setBulkFiles((prev) => [...prev, ...list]);
    setBulkDocTitle((cur) => (cur ? cur : list[0].name.replace(/\.[^.]+$/, '')));
    setBulkDocId((cur) => (cur ? cur : list[0].name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toLowerCase()));
    e.target.value = '';
  };

  const removeBulkFile = (idx: number) => {
    setBulkFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  };

  const readFileAsText = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsText(f, 'utf-8');
    });

  const handleBulkImport = async () => {
    if (bulkFiles.length === 0 && !bulkText.trim()) {
      toast.error(t('aiKnowledge.bulkNoContent'));
      return;
    }
    if (!bulkDocTitle.trim()) {
      toast.error(t('aiKnowledge.bulkTitleRequired'));
      return;
    }

    setBulkImporting(true);
    setBulkImportResult(null);
    try {
      // 读取文件
      const fileContents: { name: string; text: string }[] = [];
      for (const f of bulkFiles) {
        if (f.size > MAX_FILE_BYTES) {
          toast.error(t('aiKnowledge.bulkFileTooLarge', { name: f.name }));
          setBulkImporting(false);
          return;
        }
        const text = await readFileAsText(f);
        fileContents.push({ name: f.name, text });
      }

      const aggregate: { doc_id: string; total_chunks: number; written: number; skipped: number } = {
        doc_id: '',
        total_chunks: 0,
        written: 0,
        skipped: 0,
      };

      if (bulkOneDocPerFile) {
        // 每个文件一个 doc_id
        for (let i = 0; i < fileContents.length; i++) {
          const fc = fileContents[i];
          const baseId = (bulkDocId || fc.name).replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toLowerCase();
          const docId = fileContents.length === 1 ? baseId : `${baseId}_${i + 1}`;
          const title = fileContents.length === 1 ? bulkDocTitle : `${bulkDocTitle} - ${fc.name}`;
          const req: AIKnowledgeBulkRequest = {
            title,
            doc_id: docId,
            full_text: fc.text,
            tags: bulkTags,
            plugin: bulkPlugin,
            chunk_size: bulkChunkSize,
            chunk_overlap: bulkChunkOverlap,
            replace: bulkReplace,
          };
          const resp = await aiKnowledgeApi.bulkImport(req);
          aggregate.total_chunks += resp.total_chunks;
          aggregate.written += resp.written;
          aggregate.skipped += resp.skipped;
        }
        if (fileContents.length > 0) {
          const baseId = (bulkDocId || fileContents[0].name).replace(/\.[^.]+$/, '').replace(/\s+/g, '_').toLowerCase();
          aggregate.doc_id = fileContents.length === 1 ? baseId : `${baseId}_1 ... ${fileContents.length}`;
        }
      } else {
        // 合并为单个 doc_id（按文件顺序，添加文件头分隔）
        const fullText = fileContents
          .map((fc) => `\n\n===== FILE: ${fc.name} =====\n\n${fc.text}`)
          .join('\n');
        const req: AIKnowledgeBulkRequest = {
          title: bulkDocTitle,
          doc_id: bulkDocId || undefined,
          full_text: bulkText.trim() ? `${bulkText}\n${fullText}` : fullText,
          tags: bulkTags,
          plugin: bulkPlugin,
          chunk_size: bulkChunkSize,
          chunk_overlap: bulkChunkOverlap,
          replace: bulkReplace,
        };
        const resp = await aiKnowledgeApi.bulkImport(req);
        aggregate.doc_id = resp.doc_id;
        aggregate.total_chunks = resp.total_chunks;
        aggregate.written = resp.written;
        aggregate.skipped = resp.skipped;
      }

      setBulkImportResult(aggregate);
      toast.success(t('aiKnowledge.bulkImportSuccess'));
      fetchKnowledgeList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiKnowledge.bulkImportFailed'));
    } finally {
      setBulkImporting(false);
    }
  };

  // ===================== 文档级浏览 =====================
  const openDocViewer = async (docId: string, title?: string) => {
    setDocViewerDocId(docId);
    setDocViewerTitle(title || docId);
    setDocViewerPage(1);
    setDocViewerChunks([]);
    setDocViewerOpen(true);
    await loadDocChunks(docId, 1);
  };

  const loadDocChunks = async (docId: string, pageNum: number) => {
    try {
      setDocViewerLoading(true);
      const data = await aiKnowledgeApi.getKnowledgeList({
        source: 'manual',
        doc_id: docId,
        page: pageNum,
        limit: docViewerLimit,
      });
      setDocViewerChunks(data.list || []);
      setDocViewerTotal(data.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setDocViewerLoading(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deletingDoc) return;
    try {
      setIsDeleting(true);
      const resp: AIKnowledgeDocDeleteResponse = await aiKnowledgeApi.deleteDoc(deletingDoc.doc_id);
      toast.success(t('aiKnowledge.bulkDeleteDocSuccess', { count: resp.deleted_chunks }));
      setDeletingDoc(null);
      if (docViewerOpen) {
        setDocViewerOpen(false);
      }
      fetchKnowledgeList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.delete'));
    } finally {
      setIsDeleting(false);
    }
  };

  // ===================== 备份导出/导入 =====================
  const handleExportBackup = async () => {
    try {
      const blob = await aiKnowledgeApi.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manual_knowledge.jsonl';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('aiKnowledge.backupExportSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiKnowledge.backupExportFailed'));
    }
  };

  const handlePickBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setBackupFile(f);
    e.target.value = '';
  };

  const handleImportBackup = async () => {
    if (!backupFile) {
      toast.error(t('aiKnowledge.backupFileRequired'));
      return;
    }
    try {
      setBackupImporting(true);
      const jsonl = await backupFile.text();
      const resp: AIKnowledgeBackupResponse = await aiKnowledgeApi.importBackup({ jsonl });
      toast.success(t('aiKnowledge.backupImportSuccess', { total: resp.total, written: resp.written }));
      setBackupDialogOpen(false);
      setBackupFile(null);
      fetchKnowledgeList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiKnowledge.backupImportFailed'));
    } finally {
      setBackupImporting(false);
    }
  };

  // ===================== 深度对账 =====================
  const [reconciling, setReconciling] = useState(false);
  const handleReconcile = async () => {
    if (!window.confirm(t('aiKnowledge.reconcileConfirm') ?? '')) return;
    try {
      setReconciling(true);
      const resp = await aiKnowledgeApi.reconcile();
      const summary = [
        `${t('aiKnowledge.reconcileTotal')}: ${resp.total ?? 0}`,
        `${t('aiKnowledge.reconcileMatched')}: ${resp.matched ?? 0}`,
        `${t('aiKnowledge.reconcileMissingInVector')}: ${resp.missing_in_vector ?? 0}`,
        `${t('aiKnowledge.reconcileMissingInSql')}: ${resp.missing_in_sql ?? 0}`,
        `${t('aiKnowledge.reconcileReEmbedded')}: ${resp.re_embedded ?? 0}`,
      ].join('\n');
      toast.success(
        `${t('aiKnowledge.reconcile')}: \n${summary}`,
        { duration: 8000 },
      );
      fetchKnowledgeList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiKnowledge.reconcileFailed'));
    } finally {
      setReconciling(false);
    }
  };


  // 点击行打开编辑
  const handleOpenEdit = async (item: AIKnowledgeItem | AIImageItem) => {
    if (knowledgeType === 'text') {
      handleOpenEditTextDialog(item as AIKnowledgeItem);
    } else {
      handleOpenEditImageDialog(item as AIImageItem);
    }
  };

  // 分页
  const totalPages = pageSize ? Math.ceil(total / pageSize) : Math.ceil(total / limit);
  const currentPage = page;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // 计算页码范围
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // 显示的数据源
  const displayList = knowledgeType === 'text' 
    ? (showSearchResults && textSearchResults.length > 0 ? textSearchResults : textKnowledgeList)
    : (showSearchResults && imageSearchResults.length > 0 ? imageSearchResults : imageKnowledgeList);
  const displayTotal = showSearchResults 
    ? (knowledgeType === 'text' ? textSearchResults.length : imageSearchResults.length)
    : total;

  // 知识类型选项
  const knowledgeTypeOptions = [
    { value: 'text', label: t('aiKnowledge.typeText'), icon: <FileText className="w-4 h-4" /> },
    { value: 'image', label: t('aiKnowledge.typeImage'), icon: <Image className="w-4 h-4" /> },
  ];

  // 来源选项
  const sourceOptions = [
    { value: 'plugin', label: t('aiKnowledge.sourcePlugin'), icon: <Sparkles className="w-4 h-4" /> },
    { value: 'manual', label: t('aiKnowledge.sourceManual'), icon: <Pencil className="w-4 h-4" /> },
  ];

  return (
    <PinnedPage
      header={
        /* 页面标题 */
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 shrink-0" />
            {t('aiKnowledge.title')}
          </h1>
          <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiKnowledge.description')}</p>
        </div>
      }
      toolbar={
        /* 筛选和操作栏：以默认高度 TabButtonGroup 为基准，同行控件统一 h-11 */
        <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
          {/* 左侧：知识类型和来源筛选（保持默认高度，不压矮） */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className={tabToolbarGroupWrapClass}>
              <TabButtonGroup
                options={knowledgeTypeOptions}
                value={knowledgeType}
                onValueChange={(value) => {
                  setKnowledgeType(value as KnowledgeType);
                  setPage(1);
                  setShowSearchResults(false);
                  setSearchQuery('');
                }}
                className="shrink-0"
              />
            </div>
            <div className={tabToolbarGroupWrapClass}>
              <TabButtonGroup
                options={sourceOptions}
                value={sourceFilter}
                onValueChange={(value) => {
                  setSourceFilter(value as SourceFilter);
                  setPage(1);
                }}
                className="shrink-0"
              />
            </div>
          </div>

          {/* 右侧：搜索和操作按钮，h-11 与默认 TabButtonGroup 外壳齐平 */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <div className="relative flex-1 min-w-[12rem] xl:flex-none xl:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={knowledgeType === 'text' ? t('aiKnowledge.searchPlaceholder') : t('aiKnowledge.searchImagePlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className={cn(tabToolbarControlClass, 'pl-9')}
              />
            </div>
            <Button className={tabToolbarControlClass} onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button
              onClick={() => {
                setKnowledgeType('text');
                setSourceFilter('manual');
                resetBulkDialog();
                setBulkDialogOpen(true);
              }}
              variant="outline"
              className={cn(tabToolbarControlClass, 'shrink-0')}
              title={t('aiKnowledge.bulkImport')}
            >
              <FileUp className="h-4 w-4" />
              <span className="hidden md:inline ml-1">{t('aiKnowledge.bulkImport')}</span>
            </Button>
            <Button
              onClick={handleExportBackup}
              variant="outline"
              className={cn(tabToolbarControlClass, 'shrink-0')}
              title={t('aiKnowledge.exportBackup')}
            >
              <Download className="h-4 w-4" />
              <span className="hidden md:inline ml-1">{t('aiKnowledge.exportBackup')}</span>
            </Button>
            <Button
              onClick={() => { setBackupFile(null); setBackupDialogOpen(true); }}
              variant="outline"
              className={cn(tabToolbarControlClass, 'shrink-0')}
              title={t('aiKnowledge.importBackup')}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden md:inline ml-1">{t('aiKnowledge.importBackup')}</span>
            </Button>
            <Button
              onClick={handleReconcile}
              variant="outline"
              className={cn(tabToolbarControlClass, 'shrink-0')}
              title={t('aiKnowledge.reconcile') ?? ''}
              disabled={reconciling}
            >
              {reconciling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="hidden md:inline ml-1">
                {t('aiKnowledge.reconcile')}
              </span>
            </Button>
            <Button
              onClick={handleOpenAddDialog}
              size="icon"
              className={cn(tabToolbarIconButtonClass, 'shrink-0')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      {/* 搜索结果提示 */}
      {showSearchResults && displayList.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('aiKnowledge.searchResults')}: {displayList.length}</span>
          <Button variant="ghost" size="sm" onClick={() => { setShowSearchResults(false); setSearchQuery(''); }}>
            <X className="h-4 w-4 mr-1" />
            {t('common.clear')}
          </Button>
        </div>
      )}

      {/* 知识列表表格 */}
      <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-20" />
                </div>
              ))}
            </div>
          ) : displayList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {t('common.noData')}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {knowledgeType === 'text' ? (
                      <>
                        <TableHead className="w-[180px]">{t('aiKnowledge.titleField')}</TableHead>
                        <TableHead className="w-[100px]">{t('aiKnowledge.plugin')}</TableHead>
                        <TableHead className="w-[180px]">{t('aiKnowledge.content')}</TableHead>
                        <TableHead>{t('aiKnowledge.tags')}</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="w-[100px]">{t('aiKnowledge.preview')}</TableHead>
                        <TableHead className="w-[100px]">{t('aiKnowledge.plugin')}</TableHead>
                        <TableHead className="w-[200px]">{t('aiKnowledge.path')}</TableHead>
                        <TableHead>{t('aiKnowledge.tags')}</TableHead>
                      </>
                    )}
                    <TableHead className="w-[100px] text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knowledgeType === 'text' ? (
                    // 文本知识列表
                    (displayList as AIKnowledgeItem[]).map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => handleOpenEdit(item)}>
                        <TableCell className="font-medium truncate">{item.title}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{item.plugin}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="line-clamp-1">{item.content.split('\n')[0]}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.tags && item.tags.length > 0 ? (
                              item.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {(() => {
                              const docKey = item.id.includes('#') ? item.id.split('#')[0] : '';
                              if (!docKey) return null;
                              return (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t('aiKnowledge.viewDoc', { docId: docKey })}
                                  onClick={() => openDocViewer(docKey, item.title.replace(/\s*-\s*第\d+段\s*$/, '').trim())}
                                >
                                  <ScrollText className="h-4 w-4" />
                                </Button>
                              );
                            })()}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditTextDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    // 图片知识列表
                    (displayList as AIImageItem[]).map((item) => (
                      <TableRow key={item.id} className="cursor-pointer" onClick={() => handleOpenEdit(item)}>
                        <TableCell>
                          <div 
                            className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewImage(item.path);
                            }}
                          >
                            <img 
                              src={assetsApi.getPreviewUrl(item.path)} 
                              alt={item.id}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-muted-foreground text-xs">No Image</span>';
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{item.plugin}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="line-clamp-1 text-xs font-mono">{item.path}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.tags && item.tags.length > 0 ? (
                              item.tags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreviewImage(item.path)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* 分页 */}
              {!showSearchResults && totalPages > 1 && (
                <div className="p-4 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => handlePageChange(Math.max(1, page - 1))}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {getPageNumbers().map((p, index) =>
                        p === 'ellipsis' ? (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === currentPage}
                              onClick={() => handlePageChange(p as number)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                          className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  <div className="text-sm text-muted-foreground text-center mt-2">
                    {t('common.totalRecords', { total: displayTotal })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {knowledgeType === 'text' ? (
                <>
                  <FileText className="w-5 h-5" />
                  {isEditMode ? t('aiKnowledge.editText') : t('aiKnowledge.addText')}
                </>
              ) : (
                <>
                  <Image className="w-5 h-5" />
                  {isEditMode ? t('aiKnowledge.editImage') : t('aiKnowledge.addImage')}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiKnowledge.formAriaDesc')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {knowledgeType === 'text' ? (
              // 文本知识表单
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {t('aiKnowledge.titleField')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={textFormData.title}
                    onChange={(e) => setTextFormData({ ...textFormData, title: e.target.value })}
                    placeholder={t('aiKnowledge.titlePlaceholder')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('aiKnowledge.plugin')}
                  </Label>
                  <Input
                    value={textFormData.plugin}
                    onChange={(e) => setTextFormData({ ...textFormData, plugin: e.target.value })}
                    disabled={isEditMode}
                    placeholder="manual"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Pencil className="w-4 h-4" />
                    {t('aiKnowledge.tags')}
                  </Label>
                  <TagsInput
                    value={textFormData.tags}
                    onChange={(tags) => setTextFormData({ ...textFormData, tags })}
                    placeholder={t('aiKnowledge.tagsPlaceholder')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('aiKnowledge.content')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={textFormData.content}
                    onChange={(e) => setTextFormData({ ...textFormData, content: e.target.value })}
                    placeholder={t('aiKnowledge.contentPlaceholder')}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </>
            ) : (
              // 图片知识表单
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    {t('aiKnowledge.imageFile')}
                    <span className="text-destructive">*</span>
                  </Label>
                  
                  {/* 图片上传区域 */}
                  {!imageFormData.previewUrl ? (
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                        disabled={isUploading}
                      />
                      <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        {isUploading ? (
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        ) : (
                          <Upload className="w-8 h-8 text-muted-foreground" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {isUploading ? t('aiKnowledge.uploading') : t('aiKnowledge.clickToUpload')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('aiKnowledge.imageSizeHint')}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={imageFormData.previewUrl} 
                        alt="Preview"
                        className="w-full max-h-48 object-contain rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setImageFormData(prev => ({ ...prev, path: '', previewUrl: '' }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('aiKnowledge.plugin')}
                  </Label>
                  <Input
                    value={imageFormData.plugin}
                    onChange={(e) => setImageFormData({ ...imageFormData, plugin: e.target.value })}
                    disabled={isEditMode}
                    placeholder="manual"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Pencil className="w-4 h-4" />
                    {t('aiKnowledge.tags')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <TagsInput
                    value={imageFormData.tags}
                    onChange={(tags) => setImageFormData({ ...imageFormData, tags })}
                    placeholder={t('aiKnowledge.imageTagsPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('aiKnowledge.imageTagsHelp')}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('aiKnowledge.imageDescription')}
                  </Label>
                  <Textarea
                    value={imageFormData.content}
                    onChange={(e) => setImageFormData({ ...imageFormData, content: e.target.value })}
                    placeholder={t('aiKnowledge.imageDescriptionPlaceholder')}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('aiKnowledge.imageDescriptionHelp')}
                  </p>
                </div>
                
                {imageFormData.path && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {t('aiKnowledge.imagePath')}
                    </Label>
                    <Input
                      value={imageFormData.path}
                      disabled
                      className="font-mono text-xs"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter className="flex items-center justify-between">
            {isEditMode && (
              <span className="text-sm text-muted-foreground">
                ID: {knowledgeType === 'text' ? textFormData.id : imageFormData.id}
              </span>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving || (knowledgeType === 'image' && !imageFormData.path)}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {knowledgeType === 'text' 
                ? t('aiKnowledge.deleteConfirm', { title: (itemToDelete as AIKnowledgeItem)?.title })
                : t('aiKnowledge.deleteImageConfirm', { id: itemToDelete?.id })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量导入（服务端分片）Dialog */}
      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(o) => {
          if (!bulkImporting) setBulkDialogOpen(o);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              {t('aiKnowledge.bulkImportTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiKnowledge.bulkImportHint')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 拖入区 */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                isBulkDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              )}
              onDragOver={(e) => { e.preventDefault(); setIsBulkDragging(true); }}
              onDragLeave={() => setIsBulkDragging(false)}
              onDrop={handleBulkDrop}
            >
              <input
                type="file"
                accept=".txt,.md,.markdown,.rst,.log,.json,.jsonl,.csv,.html,.htm,.xml,.yaml,.yml,.ini,.conf,.tex"
                multiple
                onChange={handleBulkPickFiles}
                className="hidden"
                id="bulk-file-input"
                disabled={bulkImporting}
              />
              <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <Files className="w-10 h-10 text-muted-foreground" />
                <span className="text-sm font-medium">{t('aiKnowledge.bulkDropOrClick')}</span>
                <span className="text-xs text-muted-foreground">{t('aiKnowledge.bulkSupportedExts')}</span>
              </label>
            </div>

            {/* 已选文件 */}
            {bulkFiles.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('aiKnowledge.bulkSelectedFiles', { count: bulkFiles.length })}</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-muted/30">
                  {bulkFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 flex items-center gap-2">
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({formatBytes(f.size)})</span>
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => removeBulkFile(i)} disabled={bulkImporting}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 或直接粘贴文本 */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('aiKnowledge.bulkOrPasteText')}</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={4}
                placeholder={t('aiKnowledge.bulkPastePlaceholder')}
                disabled={bulkImporting}
                className="font-mono text-xs"
              />
            </div>

            {/* 元信息 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('aiKnowledge.bulkDocTitle')} <span className="text-destructive">*</span></Label>
                <Input
                  value={bulkDocTitle}
                  onChange={(e) => setBulkDocTitle(e.target.value)}
                  placeholder={t('aiKnowledge.bulkDocTitlePlaceholder')}
                  disabled={bulkImporting}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('aiKnowledge.bulkDocId')}</Label>
                <Input
                  value={bulkDocId}
                  onChange={(e) => setBulkDocId(e.target.value)}
                  placeholder={t('aiKnowledge.bulkDocIdPlaceholder')}
                  disabled={bulkImporting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('aiKnowledge.bulkPlugin')}</Label>
                <Input
                  value={bulkPlugin}
                  onChange={(e) => setBulkPlugin(e.target.value)}
                  disabled={bulkImporting}
                  placeholder="manual"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('aiKnowledge.bulkTags')}</Label>
                <TagsInput
                  value={bulkTags}
                  onChange={setBulkTags}
                  placeholder={t('aiKnowledge.bulkTagsPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('aiKnowledge.bulkChunkSize')}</Label>
                <Input
                  type="number"
                  min={50}
                  max={4000}
                  value={bulkChunkSize}
                  onChange={(e) => setBulkChunkSize(Math.max(50, Math.min(4000, Number(e.target.value) || 400)))}
                  disabled={bulkImporting}
                />
                <p className="text-xs text-muted-foreground">{t('aiKnowledge.bulkChunkSizeHelp')}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('aiKnowledge.bulkChunkOverlap')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={4000}
                  value={bulkChunkOverlap}
                  onChange={(e) => setBulkChunkOverlap(Math.max(0, Math.min(4000, Number(e.target.value) || 0)))}
                  disabled={bulkImporting}
                />
                <p className="text-xs text-muted-foreground">{t('aiKnowledge.bulkChunkOverlapHelp')}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bulkOneDocPerFile}
                  onChange={(e) => setBulkOneDocPerFile(e.target.checked)}
                  disabled={bulkImporting}
                />
                {t('aiKnowledge.bulkOneDocPerFile')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bulkReplace}
                  onChange={(e) => setBulkReplace(e.target.checked)}
                  disabled={bulkImporting}
                />
                {t('aiKnowledge.bulkReplace')}
              </label>
            </div>

            {bulkImportResult && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium text-foreground mb-1">{t('aiKnowledge.bulkImportResultTitle')}</div>
                <div>doc_id: <span className="font-mono">{bulkImportResult.doc_id || '-'}</span></div>
                <div>{t('aiKnowledge.bulkImportResultTotal', { n: bulkImportResult.total_chunks })}</div>
                <div>{t('aiKnowledge.bulkImportResultWritten', { n: bulkImportResult.written })}</div>
                {bulkImportResult.skipped > 0 && (
                  <div className="text-amber-600">{t('aiKnowledge.bulkImportResultSkipped', { n: bulkImportResult.skipped })}</div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkImporting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBulkImport} disabled={bulkImporting}>
              {bulkImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('aiKnowledge.bulkImport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文档级浏览 Dialog（按 doc_id） */}
      <Dialog open={docViewerOpen} onOpenChange={setDocViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              {t('aiKnowledge.docViewerTitle', { docId: docViewerDocId })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiKnowledge.docViewerSubtitle', { title: docViewerTitle })}
            </DialogDescription>
          </DialogHeader>

          {docViewerLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t('common.loading')}
            </div>
          ) : docViewerChunks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t('common.noData')}</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('aiKnowledge.docViewerTotalChunks', { total: docViewerTotal })}</div>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {docViewerChunks.map((chunk) => {
                  const m = /#(\d+)$/.exec(chunk.id);
                  const idx = m ? m[1] : '?';
                  return (
                    <div key={chunk.id} className="border rounded-md p-3 bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-xs">#{idx}</Badge>
                        <span className="text-xs text-muted-foreground truncate ml-2 font-mono">{chunk.id}</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-foreground/80 max-h-40 overflow-y-auto">{chunk.content}</pre>
                    </div>
                  );
                })}
              </div>
              {docViewerTotal > docViewerLimit && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={docViewerPage <= 1}
                    onClick={() => { const np = docViewerPage - 1; setDocViewerPage(np); loadDocChunks(docViewerDocId, np); }}
                  >
                    {t('aiKnowledge.docViewerPrev')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {docViewerPage} / {Math.ceil(docViewerTotal / docViewerLimit)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={docViewerPage >= Math.ceil(docViewerTotal / docViewerLimit)}
                    onClick={() => { const np = docViewerPage + 1; setDocViewerPage(np); loadDocChunks(docViewerDocId, np); }}
                  >
                    {t('aiKnowledge.docViewerNext')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => setDeletingDoc({ doc_id: docViewerDocId, title: docViewerTitle })}
              disabled={docViewerLoading || docViewerTotal === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('aiKnowledge.deleteWholeDoc')}
            </Button>
            <Button variant="outline" onClick={() => setDocViewerOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 备份导入 Dialog（JSONL） */}
      <Dialog open={backupDialogOpen} onOpenChange={(o) => { if (!backupImporting) setBackupDialogOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              {t('aiKnowledge.importBackupTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiKnowledge.importBackupHint')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".jsonl,.json,.txt"
                onChange={handlePickBackupFile}
                className="hidden"
                id="backup-file-input"
                disabled={backupImporting}
              />
              <label htmlFor="backup-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <FilePlus className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium">{backupFile ? backupFile.name : t('aiKnowledge.backupPickFile')}</span>
                {backupFile && <span className="text-xs text-muted-foreground">{formatBytes(backupFile.size)}</span>}
              </label>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('aiKnowledge.importBackupNote')}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupDialogOpen(false)} disabled={backupImporting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleImportBackup} disabled={backupImporting || !backupFile}>
              {backupImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('aiKnowledge.importBackup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除整篇文档确认 */}
      <AlertDialog open={!!deletingDoc} onOpenChange={(o) => { if (!o) setDeletingDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiKnowledge.deleteWholeDocConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiKnowledge.deleteWholeDocConfirm', { docId: deletingDoc?.doc_id })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingDoc(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoc}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('aiKnowledge.deleteWholeDoc')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinnedPage>
  );
}
