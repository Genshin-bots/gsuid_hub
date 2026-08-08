import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Plus, Pencil, Trash2, Filter, RefreshCw, ChevronLeft, ChevronRight, Database, X, PlusCircle } from 'lucide-react';
import { databaseApi, PluginDatabaseInfo, DatabaseTableInfo, DatabaseColumn, PaginatedData } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { PluginIcon } from '@/components/ui/plugin-icon';

export default function DatabasePage() {
  const { t } = useLanguage();
  const [plugins, setPlugins] = useState<PluginDatabaseInfo[]>([]);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('');
  const [activeTable, setActiveTable] = useState<string>('');
  const [tableMetadata, setTableMetadata] = useState<DatabaseTableInfo | null>(null);
  const [data, setData] = useState<PaginatedData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [filterValue, setFilterValue] = useState('');
  const [filters, setFilters] = useState<{column: string; value: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Floating horizontal scrollbar refs and state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const floatingScrollbarRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [showFloatingBar, setShowFloatingBar] = useState(false);
  const [floatingBarStyle, setFloatingBarStyle] = useState<React.CSSProperties>({});
  // 右侧是否还有隐藏列（scrollLeft < maxScroll）：此时有内容滑在固定操作列下方，
  // 固定列左侧的渐变遮罩 + 分层阴影据此一并切换，提示用户「这边还有更多列」；
  // 有溢出时初始 scrollLeft=0 也为 true——正是最需要提示的时刻，滚到最右后自动退场
  const [hasMoreRight, setHasMoreRight] = useState(false);

  const selectedPlugin = useMemo(() => {
    return plugins.find(p => p.plugin_id === selectedPluginId);
  }, [plugins, selectedPluginId]);

  const fetchPlugins = useCallback(async () => {
    try {
      setIsLoading(true);
      const pluginData = await databaseApi.getPlugins();
      setPlugins(pluginData);
      if (pluginData.length > 0) {
        setSelectedPluginId(pluginData[0].plugin_id);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
      toast.error(t('database.loadPluginsFailed') || 'Unable to load plugin list');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  useEffect(() => {
    if (selectedPlugin && selectedPlugin.tables.length > 0) {
      setActiveTable(selectedPlugin.tables[0].table_name);
    } else {
      setActiveTable('');
    }
  }, [selectedPlugin]);

  useEffect(() => {
    if (activeTable) {
      // 切换表时重置搜索和筛选状态
      setSearchTerm('');
      setFilterColumn('');
      setFilterValue('');
      setFilters([]);
      setCurrentPage(1);
      setHasSearched(false);
      
      fetchTableMetadata(activeTable);
      fetchTableData(activeTable, 1, perPage);
    }
  }, [activeTable]);

  // Floating horizontal scrollbar: scroll sync handlers
  const handleFloatingScroll = useCallback(() => {
    if (floatingScrollbarRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = floatingScrollbarRef.current.scrollLeft;
    }
  }, []);

  const handleTableScroll = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    if (floatingScrollbarRef.current) {
      floatingScrollbarRef.current.scrollLeft = el.scrollLeft;
    }
    // 同步「右侧还有隐藏列」状态（同值 setState 会被 React 跳过，不会造成额外重渲染；
    // 1px 容差消化缩放/HiDPI 的亚像素舍入）
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setHasMoreRight((prev) => (prev === canRight ? prev : canRight));
  }, []);

  // Measure table dimensions, detect horizontal scroll need, and update fixed bar position
  useEffect(() => {
    let rafId = 0;

    const measure = () => {
      const el = tableContainerRef.current;
      if (!el) return;

      const hasOverflow = el.scrollWidth > el.clientWidth;
      const rect = el.getBoundingClientRect();
      const inViewport = rect.bottom > 0 && rect.top < window.innerHeight;

      // 切表 / 数据刷新 / 窗口缩放后 scrollLeft 可能被浏览器重置或截断，
      // 在这里同步固定列的遮罩/阴影状态，避免残留（无溢出时 canRight 恒为 false）
      const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
      setHasMoreRight((prev) => (prev === canRight ? prev : canRight));

      // Whether the floating bar should be shown right now.
      const shouldShow = hasOverflow && inViewport;
      setShowFloatingBar(shouldShow);

      if (shouldShow) {
        setTableScrollWidth(el.scrollWidth);
        setFloatingBarStyle({
          position: 'fixed',
          left: Math.max(rect.left, 0),
          width: rect.width,
          bottom: 12,
          zIndex: 9999,
        });
      }
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };

    measure();

    const observer = new ResizeObserver(schedule);
    if (tableContainerRef.current) {
      observer.observe(tableContainerRef.current);
    }

    const mainEl = tableContainerRef.current?.closest('main');
    mainEl?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      mainEl?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [activeTable, data]);

  const fetchTableMetadata = async (tableName: string) => {
    try {
      const metadata = await databaseApi.getTableMetadata(tableName);
      setTableMetadata(metadata);
    } catch (error) {
      console.error('Failed to fetch table metadata:', error);
    }
  };

  const fetchTableData = async (
    tableName: string,
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    searchColumns?: string[],
    filterColumns?: string[],
    filterValues?: string[]
  ) => {
    try {
      setIsSearching(true);
      const result = await databaseApi.getTableData(
        tableName,
        page,
        pageSize,
        search,
        searchColumns,
        filterColumns,
        filterValues
      );
      setData(result);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to fetch table data:', error);
      toast.error(t('database.loadDataFailed'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (!activeTable) return;
    
    // 标记已经点击过搜索按钮
    setHasSearched(true);
    
    // 收集所有筛选条件
    const filterCols: string[] = [];
    const filterVals: string[] = [];
    
    // 添加新的筛选条件（如果有）
    if (filterColumn && filterValue) {
      filterCols.push(filterColumn);
      filterVals.push(filterValue);
    }
    
    // 添加已保存的多个筛选条件
    filters.forEach(f => {
      filterCols.push(f.column);
      filterVals.push(f.value);
    });
    
    // 调用后端搜索API
    fetchTableData(activeTable, 1, perPage, searchTerm || undefined, undefined, filterCols, filterVals);
  };

  const addFilter = () => {
    if (filterColumn && filterValue) {
      // 检查是否已存在相同列的筛选
      const existingIndex = filters.findIndex(f => f.column === filterColumn);
      if (existingIndex >= 0) {
        // 更新已存在的筛选
        const newFilters = [...filters];
        newFilters[existingIndex] = { column: filterColumn, value: filterValue };
        setFilters(newFilters);
      } else {
        // 添加新的筛选
        setFilters([...filters, { column: filterColumn, value: filterValue }]);
      }
      // 清空当前输入
      setFilterColumn('');
      setFilterValue('');
    }
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const columns = tableMetadata?.columns || [];
  const columnNames = columns.map(col => col.name);

  // 前端筛选逻辑 - 仅用于后端未返回筛选结果时的本地筛选
  // 前端筛选逻辑 - 仅在点击搜索按钮后执行
  const filteredData = useMemo(() => {
    if (!data?.items) return [];
    
    let result = [...data.items];

    // 只有在点击过搜索按钮后才进行前端筛选
    if (hasSearched) {
      // 搜索功能 - 搜索所有列
      if (searchTerm) {
        result = result.filter((item) =>
          Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      }

      // 当前选中的筛选列
      if (filterColumn && filterValue) {
        result = result.filter((item) =>
          String(item[filterColumn]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }

      // 已添加的多个筛选条件
      if (filters.length > 0) {
        result = result.filter((item) => {
          return filters.every(f =>
            String(item[f.column]).toLowerCase().includes(f.value.toLowerCase())
          );
        });
      }
    }

    return result;
  }, [data, searchTerm, filterColumn, filterValue, filters, hasSearched]);

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  const handlePageChange = (newPage: number) => {
    if (activeTable && newPage >= 1 && newPage <= totalPages) {
      fetchTableData(activeTable, newPage, perPage);
    }
  };

  const handleCreate = () => {
    const emptyItem: Record<string, unknown> = {};
    columns.forEach((col) => {
      emptyItem[col.name] = col.default ?? (col.type === 'int' ? 0 : col.type === 'bool' ? false : '');
    });
    setEditingItem(emptyItem);
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: Record<string, unknown>) => {
    setEditingItem({ ...item });
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingItem || !activeTable) return;

    try {
      if (isCreating) {
        await databaseApi.createRecord(activeTable, editingItem);
        toast.success(t('database.recordCreated'));
      } else {
        const pkName = tableMetadata?.pk_name || 'id';
        const recordId = editingItem[pkName];
        await databaseApi.updateRecord(activeTable, recordId as string | number, editingItem);
        toast.success(t('database.recordUpdated'));
      }
      fetchTableData(activeTable, currentPage, perPage);
      setIsDialogOpen(false);
      setEditingItem(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to save record:', error);
      toast.error(t('database.saveRecordFailed'));
    }
  };

  const handleDelete = async (item: Record<string, unknown>) => {
    if (!activeTable || !tableMetadata) return;

    try {
      const pkName = tableMetadata.pk_name || 'id';
      const recordId = item[pkName];
      await databaseApi.deleteRecord(activeTable, recordId as string | number);
      toast.success(t('database.recordDeleted'));
      fetchTableData(activeTable, currentPage, perPage);
    } catch (error) {
      console.error('Failed to delete record:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg ? `${t('database.deleteRecordFailed')}: ${errorMsg}` : t('database.deleteRecordFailed'));
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setEditingItem((prev) => prev ? { ...prev, [field]: value } : null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
    <PinnedPage
      header={
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Database className="w-8 h-8" />
            {t('database.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('database.description')}</p>
        </div>
      }
      toolbar={
        /* 插件选择 + 数据表选择：两级导航控件，随标题常驻。
           两者原本是 space-y-6 的兄弟，故这里用 space-y-6 保持同样的行距 */
        <div className="space-y-6">
          <div>
            <TabButtonGroup
              options={plugins.map((plugin) => ({
                value: plugin.plugin_id,
                label: plugin.plugin_name,
                icon: (
                  <PluginIcon pluginName={plugin.plugin_name === '核心功能' ? 'gsuid_core' : plugin.plugin_name} />
                ),
              }))}
              value={selectedPluginId}
              onValueChange={setSelectedPluginId}
            />
          </div>

          {selectedPlugin && selectedPlugin.tables.length > 0 && (
            <div>
              <TabButtonGroup
                options={selectedPlugin.tables.map((table) => ({
                  value: table.table_name,
                  label: table.label,
                  icon: <Database className="w-4 h-4" />,
                }))}
                value={activeTable}
                onValueChange={setActiveTable}
              />
            </div>
          )}
        </div>
      }
    >
      {activeTable && tableMetadata && (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              {/* 全局搜索框 */}
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('database.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full sm:w-[200px]"
                />
              </div>
              
              {/* 筛选区域 + 搜索按钮 */}
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {/* 筛选区域 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterColumn} onValueChange={setFilterColumn}>
                    <SelectTrigger className="h-10 w-full sm:w-[150px]">
                      <SelectValue placeholder={t('database.filterColumn')} />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filterColumn && (
                    <>
                      <Input
                        placeholder={t('database.filterValue')}
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addFilter()}
                        className="w-full sm:w-[150px]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addFilter}
                        title={t('database.addFilter')}
                        className="h-10"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* 已添加的筛选条件 */}
                {filters.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {filters.map((filter, index) => {
                      const col = columns.find(c => c.name === filter.column);
                      return (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                          {col?.title || filter.column}: {filter.value}
                          <button
                            onClick={() => removeFilter(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* 搜索按钮 - 紧贴筛选区域 */}
                <Button
                  onClick={handleSearch}
                  size="sm"
                  disabled={isSearching}
                  className="h-10"
                >
                  {isSearching ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-1" />
                  )}
                  {t('database.search')}
                </Button>

                {/* 刷新 + 新增按钮 - 推到最右 */}
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Button onClick={() => fetchTableData(activeTable, currentPage, perPage)} variant="outline" size="sm" className="h-10">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {t('database.refresh')}
                  </Button>
                  <Button onClick={handleCreate} size="sm" className="h-10">
                    <Plus className="h-4 w-4 mr-1" />
                    {t('database.addNew')}
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="relative">
              <Table
                wrapperRef={tableContainerRef}
                wrapperClassName="scrollbar-hide"
                onWrapperScroll={handleTableScroll}
              >
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col.name} className="whitespace-nowrap">
                          {col.title.length > 10 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{col.title.slice(0, 10)}...</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {col.title}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            col.title
                          )}
                        </TableHead>
                      ))}
                      {/* 操作列固定在表格右缘，不随横向滚动（.table-sticky-right 见 index.css）；
                          右侧还有隐藏列时加渐变遮罩 + 分层阴影，提示「还有更多列」 */}
                      <TableHead
                        className={cn(
                          'w-[100px] whitespace-nowrap table-sticky-right',
                          hasMoreRight && 'table-sticky-fade table-sticky-shadow'
                        )}
                      >
                        {t('database.actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                          {t('database.noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item, index) => (
                        <TableRow key={index}>
                          {columns.map((col) => (
                            <TableCell key={col.name} className="whitespace-nowrap">
                              {typeof item[col.name] === 'boolean' ? (
                                <Badge variant={item[col.name] ? 'default' : 'secondary'}>
                                  {item[col.name] ? t('database.yes') : t('database.no')}
                                </Badge>
                              ) : (
                                String(item[col.name] ?? '')
                              )}
                            </TableCell>
                          ))}
                          <TableCell className={cn('table-sticky-right', hasMoreRight && 'table-sticky-fade table-sticky-shadow')}>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
            </div>

            {data && data.total > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {t('database.paginationInfo')
                    .replace('{total}', String(data.total))
                    .replace('{current}', String(currentPage))
                    .replace('{totalPages}', String(totalPages))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* 三段式 flex：header / 可滚动字段区 / footer——长表单只滚中间，
            取消/保存按钮常驻可见（此前 overflow-y-auto 挂在 DialogContent 上，按钮会被滚走） */}
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{isCreating ? t('database.addRecord') : t('database.editRecord')}</DialogTitle>
            {/* Radix 无障碍要求 DialogTitle + DialogDescription 成对（P-16/P-18）；
                顺带展示「哪张表 / 哪条记录」的上下文 */}
            <DialogDescription>
              {isCreating
                ? t('database.addRecordDescription').replace('{table}', tableMetadata?.label || activeTable)
                : t('database.editRecordDescription')
                    .replace('{table}', tableMetadata?.label || activeTable)
                    .replace('{pk}', tableMetadata?.pk_name || 'id')
                    .replace('{id}', String(editingItem?.[tableMetadata?.pk_name || 'id'] ?? ''))}
            </DialogDescription>
          </DialogHeader>

          <div className="grow min-h-0 overflow-y-auto py-2">
            {/* 字段名置于输入框上方（旧版 25% 右对齐标签列会把长字段名挤成竖条）；
                标签区预留两行高并底对齐（min-h-10 + justify-end）：同行字段一长一短时，
                下方输入框仍水平对齐，多出的空隙留在标签上方、不挤压输入框；
                line-clamp-2 兜底超长标签（全文悬停 title 可见），杜绝三行破对齐；
                桌面双列压缩表单高度，移动端退回单列；bool 字段内联 Switch，高度与 Input 对齐 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
              {columns.map((col) => {
                const isNumber = col.type === 'int' || col.type === 'float';
                // 编辑时主键只读：handleSave 用 editingItem[pk] 定位记录，
                // 若允许改主键，保存会指向一条不存在的记录
                const pkLocked = !isCreating && col.name === (tableMetadata?.pk_name || 'id');
                return (
                  <div key={col.name} className="flex flex-col gap-2">
                    <div className="flex flex-col justify-end min-h-10">
                      <Label htmlFor={col.name} title={col.title} className="text-muted-foreground leading-snug line-clamp-2">
                        {col.title}
                      </Label>
                    </div>
                    {col.type === 'bool' ? (
                      <div className="flex items-center h-10 px-3 rounded-md border border-border/60">
                        <Switch
                          id={col.name}
                          checked={Boolean(editingItem?.[col.name])}
                          onCheckedChange={(checked) => handleInputChange(col.name, checked)}
                        />
                      </div>
                    ) : (
                      <Input
                        id={col.name}
                        type={isNumber ? 'number' : 'text'}
                        value={String(editingItem?.[col.name] ?? '')}
                        onChange={(e) =>
                          handleInputChange(
                            col.name,
                            isNumber
                              ? (col.type === 'int' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)
                              : e.target.value
                          )
                        }
                        readOnly={pkLocked}
                        title={pkLocked ? t('database.pkEditHint') : undefined}
                        className={pkLocked ? 'bg-muted/40 cursor-not-allowed' : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PinnedPage>
    {/* Floating horizontal scrollbar rendered via Portal to body,
        so position:fixed works correctly regardless of ancestor transforms */}
    {showFloatingBar && createPortal(
      <div
        ref={floatingScrollbarRef}
        className="overflow-x-auto h-3 bg-background/80 border border-border/60 shadow-md backdrop-blur-sm rounded-full"
        onScroll={handleFloatingScroll}
        style={floatingBarStyle}
      >
        <div style={{ width: tableScrollWidth, minWidth: '100%' }} className="h-px" />
      </div>,
      document.body
    )}
  </>
  );
}
