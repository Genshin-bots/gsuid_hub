import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, AlertCircle, Plus, Trash2, Edit2, GitBranch, FileText, ScrollText, Link, FileCode, FolderOpen, Loader2 } from 'lucide-react';
import { aiSkillsApi, getApiErrorMessage, type AISkill, type AISkillDetail } from '@/lib/api';
import { toast } from 'sonner';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

// ============================================================================
// 类型定义
// ============================================================================

interface ParsedSkill {
  name: string;
  title: string;
  summary: string;
  fullDescription: string;
  content: string;
}

// ============================================================================
// 工具函数
// ============================================================================

function parseSkillDescription(skill: AISkill): ParsedSkill {
  const lines = skill.description.split('\n');
  const firstLine = lines[0];
  // 如果第一行字数小于11，则作为标题
  const title = firstLine.length < 11 ? firstLine : skill.name;
  
  // Args 之前的所有内容作为简介
  const summaryLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('Args:') || line.startsWith('Returns:') || line.startsWith('Example:')) {
      break;
    }
    if (line.trim()) {
      summaryLines.push(line.trim());
    }
  }
  // 去掉第一行（标题行），保留换行
  const summary = summaryLines.slice(1).join('\n') || skill.description;
  
  return {
    name: skill.name,
    title,
    summary,
    fullDescription: skill.description,
    content: skill.content || skill.description,
  };
}

// ============================================================================
// 组件定义
// ============================================================================

export default function AISkillsPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 状态
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<AISkillDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 新增技能弹窗状态
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [gitUrl, setGitUrl] = useState('');
  const [skillName, setSkillName] = useState('');
  const [updateIfExists, setUpdateIfExists] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  // 删除确认弹窗状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<ParsedSkill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 编辑弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [skillToEdit, setSkillToEdit] = useState<ParsedSkill | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 解析后的技能列表
  const parsedSkills = useMemo(() => {
    return skills.map(skill => parseSkillDescription(skill));
  }, [skills]);

  // 加载技能列表
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await aiSkillsApi.getSkillsList();
        setSkills(data.skills || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('aiSkills.loadFailed'));
        toast.error(err instanceof Error ? err.message : t('aiSkills.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, [t]);

  const handleSkillClick = async (skill: ParsedSkill) => {
    setDialogOpen(true);
    setIsLoadingDetail(true);
    try {
      const detail = await aiSkillsApi.getSkillDetail(skill.name);
      setSelectedSkill(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiSkills.loadDetailFailed'));
      setSelectedSkill(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 处理新增技能
  const handleAddSkill = async () => {
    if (!gitUrl.trim()) {
      toast.error(t('aiSkills.gitUrlPlaceholder'));
      return;
    }

    setIsCloning(true);
    try {
      await aiSkillsApi.cloneSkill(gitUrl.trim(), skillName.trim() || undefined, updateIfExists);
      toast.success(t('aiSkills.cloneSuccess'));
      setAddDialogOpen(false);
      setGitUrl('');
      setSkillName('');
      setUpdateIfExists(false);
      // 刷新列表
      const data = await aiSkillsApi.getSkillsList();
      setSkills(data.skills || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiSkills.cloneFailed')));
    } finally {
      setIsCloning(false);
    }
  };

  // 处理删除技能
  const handleDeleteClick = (e: React.MouseEvent, skill: ParsedSkill) => {
    e.stopPropagation();
    setSkillToDelete(skill);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!skillToDelete) return;

    setIsDeleting(true);
    try {
      await aiSkillsApi.deleteSkill(skillToDelete.name);
      toast.success(t('aiSkills.deleteSuccess'));
      setDeleteDialogOpen(false);
      setSkillToDelete(null);
      // 刷新列表
      const data = await aiSkillsApi.getSkillsList();
      setSkills(data.skills || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiSkills.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  // 处理编辑技能
  const handleEditClick = async (e: React.MouseEvent, skill: ParsedSkill) => {
    e.stopPropagation();
    setSkillToEdit(skill);
    setEditDialogOpen(true);
    setIsLoadingMarkdown(true);
    setEditContent('');

    try {
      // 直接使用 ParsedSkill 中已有的 content 字段（来自列表接口）
      if (skill.content) {
        setEditContent(skill.content);
      } else {
        // 如果没有 content，调用 markdown 接口作为后备
        const markdown = await aiSkillsApi.getSkillMarkdown(skill.name);
        setEditContent(markdown.content);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiSkills.loadDetailFailed'));
      // 使用 fullDescription 作为最后后备
      setEditContent(skill.fullDescription);
    } finally {
      setIsLoadingMarkdown(false);
    }
  };

  const confirmEdit = async () => {
    if (!skillToEdit) return;

    setIsSaving(true);
    try {
      await aiSkillsApi.updateSkillMarkdown(skillToEdit.name, editContent);
      toast.success(t('aiSkills.saveSuccess'));
      setEditDialogOpen(false);
      setSkillToEdit(null);
      setEditContent('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('aiSkills.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PinnedPage
      header={
        /* 页面标题 */
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Sparkles className="w-8 h-8 shrink-0" />
              {t('aiSkills.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiSkills.description')}</p>
          </div>
          {/* 新增技能按钮 */}
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2 whitespace-nowrap self-end sm:self-auto">
            <Plus className="h-4 w-4" />
            {t('aiSkills.addSkill')}
          </Button>
        </div>
      }
    >
      {/* 错误提示 */}
      {error && (
        <Card className={cn(
          "border-destructive/50",
          isGlass ? "glass-card" : "border border-border/50"
        )}>
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* 技能列表 */}
      {isLoading ? (
        <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className={cn(
              isGlass ? "glass-card" : "border border-border/50"
            )}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : parsedSkills.length === 0 ? (
        <Card className={cn(
          isGlass ? "glass-card" : "border border-border/50"
        )}>
          <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Sparkles className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('aiSkills.noSkills')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parsedSkills.map((skill) => (
            <Card 
              key={skill.name} 
              className={cn(
                "relative transition-colors hover:border-primary/50",
                isGlass ? "glass-card" : "border border-border/50"
              )}
              onClick={() => handleSkillClick(skill)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 pr-20">
                  <Sparkles className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-lg truncate">{skill.title}</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-mono">
                  {skill.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {skill.summary}
                </p>
                {/* 右下角操作按钮 */}
                <div className="flex justify-end gap-1 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleEditClick(e, skill)}
                    className="h-8 px-3 gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    {t('aiSkills.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteClick(e, skill)}
                    className="h-8 px-3 text-destructive hover:text-destructive gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('aiSkills.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 技能详情弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {selectedSkill?.name || t('aiSkills.loading')}
            </DialogTitle>
            <DialogDescription className="text-base">
              {selectedSkill?.name}
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : selectedSkill ? (
            <div className="mt-4 space-y-4">
              {/* 技能描述 */}
              {selectedSkill.description && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <ScrollText className="w-4 h-4" />
                    {t('aiSkills.descriptionField')}
                  </h3>
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-md overflow-x-auto">
                    {selectedSkill.description}
                  </pre>
                </div>
              )}

              {/* Markdown 内容 */}
              {selectedSkill.content && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('aiSkills.markdown')}
                  </h3>
                  <div className="bg-muted/50 p-4 rounded-md overflow-x-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {selectedSkill.content}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* 许可证 */}
              {selectedSkill.license && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    {t('aiSkills.license')}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedSkill.license}</p>
                </div>
              )}
              
              {/* 兼容性 */}
              {selectedSkill.compatibility && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    {t('aiSkills.compatibility')}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedSkill.compatibility}</p>
                </div>
              )}
              
              {/* 资源列表 */}
              {selectedSkill.resources && selectedSkill.resources.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    {t('aiSkills.resources')}
                  </h3>
                  <ul className="space-y-1">
                    {selectedSkill.resources.map((resource, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        <span className="font-mono">{resource.name}</span>
                        {resource.description && `: ${resource.description}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 脚本列表 */}
              {selectedSkill.scripts && selectedSkill.scripts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    {t('aiSkills.scripts')}
                  </h3>
                  <ul className="space-y-1">
                    {selectedSkill.scripts.map((script, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        <span className="font-mono">{script.name}</span>
                        {script.description && `: ${script.description}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 路径信息 */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  {t('aiSkills.uri')}
                </h3>
                <p className="text-xs text-muted-foreground font-mono break-all">{selectedSkill.uri}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 新增技能弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              {t('aiSkills.addSkill')}
            </DialogTitle>
            <DialogDescription>
              {t('aiSkills.addSkillDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="gitUrl">{t('aiSkills.gitUrl')}</Label>
              <Input
                id="gitUrl"
                placeholder={t('aiSkills.gitUrlPlaceholder')}
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skillName">{t('aiSkills.skillName')}</Label>
              <Input
                id="skillName"
                placeholder={t('aiSkills.skillNamePlaceholder')}
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={updateIfExists}
                onCheckedChange={(v) => setUpdateIfExists(v === true)}
              />
              <span>{t('aiSkills.updateExisting')}</span>
            </label>
            <p className="text-xs text-muted-foreground -mt-2">{t('aiSkills.updateHint')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                {t('aiSkills.cancel')}
              </Button>
              <Button onClick={handleAddSkill} disabled={isCloning}>
                {isCloning
                  ? t('aiSkills.cloning')
                  : updateIfExists
                    ? t('aiSkills.reinstall')
                    : t('aiSkills.clone')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiSkills.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiSkills.deleteConfirm', { name: skillToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              {t('aiSkills.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('aiSkills.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑技能弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              {t('aiSkills.editSkill')}: {skillToEdit?.name}
            </DialogTitle>
            <DialogDescription>
              {t('aiSkills.editSkillDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('aiSkills.markdownContent')}
              </Label>
              {isLoadingMarkdown ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <Textarea
                  className="min-h-[300px] font-mono text-sm"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t('aiSkills.cancel')}
              </Button>
              <Button onClick={confirmEdit} disabled={isSaving || isLoadingMarkdown}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('aiSkills.saving')}
                  </>
                ) : t('aiSkills.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
