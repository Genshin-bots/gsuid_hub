/**
 * /ai-tools「技能列表」页签的面板（原 /ai-skills 整页内容）
 *
 * 原 /ai-skills 已并入 /ai-tools：技能列表成为工具页签组里的第 4 个页签，
 * 承担技能列表 + 详情 + Git 克隆安装 + Markdown 编辑 + 删除。
 *
 * 「添加技能」按钮不在本组件里：页签同行的操作按钮统一放页面 toolbar
 * （AGENTS.md §三 页面内操作按钮 1），因此新增弹窗的开合状态由父组件传进来。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  AlertCircle,
  Trash2,
  Edit2,
  GitBranch,
  FileText,
  ScrollText,
  Link,
  FileCode,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { aiSkillsApi, getApiErrorMessage, type AISkill, type AISkillDetail } from '@/lib/api';
import { toast } from 'sonner';

interface ParsedSkill {
  name: string;
  title: string;
  summary: string;
  fullDescription: string;
  content: string;
}

function parseSkillDescription(skill: AISkill): ParsedSkill {
  const lines = skill.description.split('\n');
  const firstLine = lines[0];
  // 第一行很短则视为标题，否则用技能名兜底
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

  return {
    name: skill.name,
    title,
    summary: summaryLines.slice(1).join('\n') || skill.description,
    fullDescription: skill.description,
    content: skill.content || skill.description,
  };
}

interface SkillsPanelProps {
  /** 新增技能弹窗的开合状态由页面 toolbar 的按钮持有 */
  addDialogOpen: boolean;
  onAddDialogOpenChange: (open: boolean) => void;
}

export default function SkillsPanel({ addDialogOpen, onAddDialogOpenChange }: SkillsPanelProps) {
  const { t } = useLanguage();

  const [skills, setSkills] = useState<AISkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<AISkillDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 新增技能弹窗内容
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

  const parsedSkills = useMemo(() => skills.map((skill) => parseSkillDescription(skill)), [skills]);

  /** 克隆 / 删除后复用，避免每个操作里重写一遍「刷新列表」 */
  const reloadSkills = useCallback(async () => {
    try {
      const data = await aiSkillsApi.getSkillsList();
      setSkills(data.skills || []);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, t('aiSkills.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await aiSkillsApi.getSkillsList();
        if (cancelled) return;
        setSkills(data.skills || []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = getApiErrorMessage(err, t('aiSkills.loadFailed'));
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSkillClick = async (skill: ParsedSkill) => {
    setDialogOpen(true);
    setIsLoadingDetail(true);
    try {
      const detail = await aiSkillsApi.getSkillDetail(skill.name);
      setSelectedSkill(detail);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiSkills.loadDetailFailed')));
      setSelectedSkill(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleAddSkill = async () => {
    if (!gitUrl.trim()) {
      toast.error(t('aiSkills.gitUrlPlaceholder'));
      return;
    }

    setIsCloning(true);
    try {
      await aiSkillsApi.cloneSkill(gitUrl.trim(), skillName.trim() || undefined, updateIfExists);
      toast.success(t('aiSkills.cloneSuccess'));
      onAddDialogOpenChange(false);
      setGitUrl('');
      setSkillName('');
      setUpdateIfExists(false);
      await reloadSkills();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiSkills.cloneFailed')));
    } finally {
      setIsCloning(false);
    }
  };

  const handleDeleteClick = (skill: ParsedSkill) => {
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
      await reloadSkills();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiSkills.deleteFailed')));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = async (skill: ParsedSkill) => {
    setSkillToEdit(skill);
    setEditDialogOpen(true);
    setIsLoadingMarkdown(true);
    setEditContent('');

    try {
      // 列表接口已带 content，优先直接用；缺失时再打 markdown 接口
      if (skill.content) {
        setEditContent(skill.content);
      } else {
        const markdown = await aiSkillsApi.getSkillMarkdown(skill.name);
        setEditContent(markdown.content);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiSkills.loadDetailFailed')));
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
      toast.error(getApiErrorMessage(err, t('aiSkills.saveFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {error && (
        <GlassAlert tone="danger" icon={AlertCircle}>
          {error}
        </GlassAlert>
      )}

      {isLoading ? (
        <div className="glass-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
            <Card key={key} className="glass-card">
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
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('aiSkills.noSkills')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="glass-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {parsedSkills.map((skill) => (
            <Card
              key={skill.name}
              className={cn(
                'relative cursor-pointer transition-colors hover:border-primary/50',
                'glass-card',
              )}
              onClick={() => void handleSkillClick(skill)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 sm:pr-20">
                  <Sparkles className="w-5 h-5 text-primary shrink-0" />
                  <span className="truncate text-lg">{skill.title}</span>
                </CardTitle>
                <CardDescription className="break-all font-mono text-xs text-muted-foreground">
                  {skill.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {skill.summary}
                </p>
                <div className="mt-4 flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleEditClick(skill);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    {t('aiSkills.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(skill);
                    }}
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
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {selectedSkill?.name || t('aiSkills.loading')}
            </DialogTitle>
            <DialogDescription className="text-base">{selectedSkill?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2">
            {isLoadingDetail ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : selectedSkill ? (
              <div className="space-y-4 py-1">
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

                {selectedSkill.content && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {t('aiSkills.markdown')}
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-md overflow-x-auto">
                      <pre className="whitespace-pre-wrap text-sm">{selectedSkill.content}</pre>
                    </div>
                  </div>
                )}

                {selectedSkill.license && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Link className="w-4 h-4" />
                      {t('aiSkills.license')}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedSkill.license}</p>
                  </div>
                )}

                {selectedSkill.compatibility && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      {t('aiSkills.compatibility')}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedSkill.compatibility}</p>
                  </div>
                )}

                {selectedSkill.resources && selectedSkill.resources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      {t('aiSkills.resources')}
                    </h3>
                    <ul className="space-y-1">
                      {selectedSkill.resources.map((resource) => (
                        <li
                          key={resource.uri || resource.name}
                          className="text-sm text-muted-foreground"
                        >
                          <span className="font-mono">{resource.name}</span>
                          {resource.description && `: ${resource.description}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSkill.scripts && selectedSkill.scripts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      {t('aiSkills.scripts')}
                    </h3>
                    <ul className="space-y-1">
                      {selectedSkill.scripts.map((script) => (
                        <li
                          key={script.uri || script.name}
                          className="text-sm text-muted-foreground"
                        >
                          <span className="font-mono">{script.name}</span>
                          {script.description && `: ${script.description}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    {t('aiSkills.uri')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {selectedSkill.uri}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* 新增技能弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={onAddDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              {t('aiSkills.addSkill')}
            </DialogTitle>
            <DialogDescription>{t('aiSkills.addSkillDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="skillGitUrl">{t('aiSkills.gitUrl')}</Label>
              <Input
                id="skillGitUrl"
                placeholder={t('aiSkills.gitUrlPlaceholder')}
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skillNewName">{t('aiSkills.skillName')}</Label>
              <Input
                id="skillNewName"
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
              <Button variant="outline" onClick={() => onAddDialogOpenChange(false)}>
                {t('aiSkills.cancel')}
              </Button>
              <Button onClick={() => void handleAddSkill()} disabled={isCloning}>
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
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('aiSkills.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑技能弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              {t('aiSkills.editSkill')}: {skillToEdit?.name}
            </DialogTitle>
            <DialogDescription>{t('aiSkills.editSkillDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-1 space-y-4 mt-2">
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
          </div>
          <DialogFooter className="shrink-0 pt-3 border-t border-border/40 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('aiSkills.cancel')}
            </Button>
            <Button onClick={() => void confirmEdit()} disabled={isSaving || isLoadingMarkdown}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('aiSkills.saving')}
                </>
              ) : (
                t('aiSkills.save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
