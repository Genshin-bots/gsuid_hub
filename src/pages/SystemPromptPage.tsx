import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
import { MessageSquare, Plus, Search, Pencil, Trash2, Loader2, FileText } from 'lucide-react';
import { systemPromptApi, SystemPromptItem } from '@/lib/api';
import { toast } from 'sonner';
import { FormCard } from '@/components/FormCard';

// ============================================================================
// 类型定义
// ============================================================================

interface SystemPromptFormData {
  id: string;
  title: string;
  desc: string;
  content: string;
  tags: string[];
}

const initialFormData: SystemPromptFormData = {
  id: '',
  title: '',
  desc: '',
  content: '',
  tags: [],
};

// ============================================================================
// 组件定义
// ============================================================================

export default function SystemPromptPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 状态
  const [promptList, setPromptList] = useState<SystemPromptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pageSize, setPageSize] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SystemPromptItem[]>([]);

  // Dialog 状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<SystemPromptFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 删除确认 Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<SystemPromptItem | null>(null);

  // 查看详情 Dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPromptItem | null>(null);

  // 加载提示词列表
  const fetchPromptList = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await systemPromptApi.getSystemPromptList({ page, limit });
      setPromptList(data.list || []);
      setTotal(data.total);
      setPageSize(data.page_size);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, t]);

  useEffect(() => {
    fetchPromptList();
  }, [fetchPromptList]);

  // 搜索处理
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const data = await systemPromptApi.searchSystemPrompt(searchQuery, { limit: 50 });
      setSearchResults(data.results || []);
      setShowSearchResults(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsSearching(false);
    }
  };

  // 搜索结果切换
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 打开新增 Dialog
  const handleOpenAddDialog = () => {
    setIsEditMode(false);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  // 打开编辑 Dialog
  const handleOpenEditDialog = (item: SystemPromptItem) => {
    setIsEditMode(true);
    setFormData({
      id: item.id,
      title: item.title,
      desc: item.desc,
      content: item.content,
      tags: item.tags || [],
    });
    setDialogOpen(true);
  };

  // 保存提示词
  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error(t('common.saveFailed'));
      return;
    }

    try {
      setIsSaving(true);
      if (isEditMode) {
        await systemPromptApi.updateSystemPrompt(formData.id, {
          title: formData.title,
          desc: formData.desc,
          content: formData.content,
          tags: formData.tags,
        });
        toast.success(t('common.saveSuccess'));
      } else {
        await systemPromptApi.createSystemPrompt({
          title: formData.title,
          desc: formData.desc,
          content: formData.content,
          tags: formData.tags,
        });
        toast.success(t('common.saveSuccess'));
      }
      setDialogOpen(false);
      fetchPromptList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // 删除提示词
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await systemPromptApi.deleteSystemPrompt(itemToDelete.id);
      toast.success(t('common.success'));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchPromptList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.delete'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 点击行打开编辑
  const handleOpenEdit = (item: SystemPromptItem) => {
    setSelectedPrompt(item);
    setFormData({
      id: item.id,
      title: item.title,
      desc: item.desc,
      content: item.content,
      tags: item.tags || [],
    });
    setIsEditMode(true);
    setDialogOpen(true);
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
  const displayList = showSearchResults && searchResults.length > 0 ? searchResults : promptList;
  const displayTotal = showSearchResults && searchResults.length > 0 ? searchResults.length : total;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 页面标题 */}
      <div className="min-w-0 overflow-x-auto">
        <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="w-8 h-8 shrink-0" />
          {t('systemPrompt.title')}
        </h1>
        <p className="whitespace-nowrap text-muted-foreground mt-1">{t('systemPrompt.description')}</p>
      </div>

      {/* 搜索和操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('systemPrompt.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        {showSearchResults && (
          <Button
            variant="outline"
            onClick={() => {
              setShowSearchResults(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            {t('systemPrompt.clearSearch')}
          </Button>
        )}
        <Button onClick={handleOpenAddDialog} className="shrink-0 whitespace-nowrap">
          <Plus className="w-4 h-4 mr-2" />
          {t('systemPrompt.add')}
        </Button>
      </div>

      {/* 搜索结果提示 */}
      {showSearchResults && searchResults.length > 0 && (
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-sm">
            {t('systemPrompt.searchResults', { count: searchResults.length })}
          </p>
        </div>
      )}

      {/* 列表卡片 */}
      <Card className={cn(isGlass && 'glass-card')}>
        <CardHeader>
          <CardTitle>{t('systemPrompt.listTitle')}</CardTitle>
          <CardDescription>
            {t('systemPrompt.total', { total: displayTotal })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">{t('systemPrompt.titleField')}</TableHead>
                <TableHead>{t('systemPrompt.descField')}</TableHead>
                <TableHead className="w-[200px]">{t('systemPrompt.tags')}</TableHead>
                <TableHead className="w-[120px] text-right">{t('systemPrompt.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : displayList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {showSearchResults ? t('systemPrompt.noSearchResults') : t('systemPrompt.empty')}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayList.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => handleOpenEdit(item)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {item.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm line-clamp-2">
                        {item.desc || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                        {item.tags && item.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditDialog(item)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
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
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {getPageNumbers().map((p, i) =>
                    p === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={() => handlePageChange(p)}
                          isActive={currentPage === p}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <FormCard
            type="systemPrompt"
            mode="edit"
            data={formData}
            onChange={(key, value) => setFormData({ ...formData, [key]: value })}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('systemPrompt.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('systemPrompt.save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('systemPrompt.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('systemPrompt.deleteConfirm', { title: itemToDelete?.title || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('systemPrompt.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('systemPrompt.confirmDelete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
