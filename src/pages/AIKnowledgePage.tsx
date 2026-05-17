import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
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
} from 'lucide-react';
import { aiKnowledgeApi, AIKnowledgeItem, aiImageApi, AIImageItem, AIImageUploadResponse } from '@/lib/api';
import { toast } from 'sonner';
import { TagsInput } from '@/components/config/TagsInput';
import { assetsApi } from '@/lib/api';

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
    <div className="p-4 sm:p-6 space-y-6">
      {/* 页面标题 */}
      <div className="min-w-0 overflow-x-auto">
        <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
          <BookOpen className="w-8 h-8 shrink-0" />
          {t('aiKnowledge.title')}
        </h1>
        <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiKnowledge.description')}</p>
      </div>

      {/* 筛选和操作栏 */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        {/* 左侧：知识类型和来源筛选 */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
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
            glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
          />
          <TabButtonGroup
            options={sourceOptions}
            value={sourceFilter}
            onValueChange={(value) => {
              setSourceFilter(value as SourceFilter);
              setPage(1);
            }}
            className="shrink-0"
            glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
          />
        </div>
        
        {/* 右侧：搜索和添加按钮 */}
        <div className="flex gap-2 w-full xl:w-auto">
          <div className="relative flex-1 xl:flex-none xl:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={knowledgeType === 'text' ? t('aiKnowledge.searchPlaceholder') : t('aiKnowledge.searchImagePlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
          <Button onClick={handleOpenAddDialog} size="icon" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

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

      {/* 图片预览 Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              {t('aiKnowledge.imagePreview')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img 
              src={previewImageUrl} 
              alt="Preview"
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
              onError={(e) => {
                toast.error(t('aiKnowledge.imageLoadFailed'));
                setPreviewDialogOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
