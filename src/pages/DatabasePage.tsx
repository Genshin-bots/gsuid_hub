import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Plus, Pencil, Trash2, Filter, RefreshCw, ChevronLeft, ChevronRight, Settings, Database, X, PlusCircle } from 'lucide-react';
import { databaseApi, PluginDatabaseInfo, DatabaseTableInfo, DatabaseColumn, PaginatedData } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

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
      toast({
        title: t('common.loadFailed'),
        description: t('database.loadPluginsFailed') || 'Unable to load plugin list',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      toast({
        title: t('database.loadFailed'),
        description: t('database.loadDataFailed'),
        variant: 'destructive'
      });
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
        toast({ title: t('database.createSuccess'), description: t('database.recordCreated') });
      } else {
        const pkName = tableMetadata?.pk_name || 'id';
        const recordId = editingItem[pkName];
        await databaseApi.updateRecord(activeTable, recordId as string | number, editingItem);
        toast({ title: t('database.updateSuccess'), description: t('database.recordUpdated') });
      }
      fetchTableData(activeTable, currentPage, perPage);
      setIsDialogOpen(false);
      setEditingItem(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to save record:', error);
      toast({
        title: t('database.saveFailed'),
        description: t('database.saveRecordFailed'),
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (item: Record<string, unknown>) => {
    if (!activeTable || !tableMetadata) return;

    try {
      const pkName = tableMetadata.pk_name || 'id';
      const recordId = item[pkName];
      await databaseApi.deleteRecord(activeTable, recordId as string | number);
      toast({ title: t('database.deleteSuccess'), description: t('database.recordDeleted') });
      fetchTableData(activeTable, currentPage, perPage);
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast({
        title: t('database.deleteFailed'),
        description: t('database.deleteRecordFailed'),
        variant: 'destructive'
      });
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
    <div className="space-y-6 flex-1 overflow-auto p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Database className="w-8 h-8" />
          {t('database.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('database.description')}</p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <h2 className="text-lg font-semibold min-w-[80px]">{t('database.selectPlugin')}</h2>
            <Select
              value={selectedPluginId}
              onValueChange={setSelectedPluginId}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder={t('database.selectPlugin')} />
              </SelectTrigger>
              <SelectContent>
                {plugins.map((plugin) => (
                  <SelectItem key={plugin.plugin_id} value={plugin.plugin_id}>
                    <div className="flex items-center gap-2">
                      {plugin.icon ? (
                        <img src={plugin.icon} alt={plugin.plugin_name} className="w-4 h-4 object-contain" />
                      ) : (
                        <Settings className="w-4 h-4" />
                      )}
                      {plugin.plugin_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedPlugin && selectedPlugin.tables.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-3 block">{t('database.selectTable')}</h2>
            <ToggleGroup type="single" value={activeTable} onValueChange={setActiveTable} className="flex flex-wrap gap-1">
              {selectedPlugin.tables.map((table) => (
                <ToggleGroupItem key={table.table_name} value={table.table_name} className="px-4 py-2">
                  {table.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardContent>
        </Card>
      )}

      {activeTable && tableMetadata && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>{tableMetadata.label}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => fetchTableData(activeTable, currentPage, perPage)} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t('database.refresh')}
                </Button>
                <Button onClick={handleCreate} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  {t('database.addNew')}
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
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
                    <SelectTrigger className="w-full sm:w-[150px]">
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
                        title="添加筛选"
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

                {/* 搜索按钮 - 放在右侧 */}
                <Button
                  onClick={handleSearch}
                  size="sm"
                  disabled={isSearching}
                  className="ml-auto"
                >
                  {isSearching ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-1" />
                  )}
                  {t('database.search')}
                </Button>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="overflow-x-auto">
                <Table>
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
                      <TableHead className="w-[100px] whitespace-nowrap">{t('database.actions')}</TableHead>
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
                          <TableCell>
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
                  共 {data.total} 条记录，第 {currentPage} / {totalPages} 页
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? '新增记录' : '编辑记录'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {columns.map((col) => (
              <div key={col.name} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={col.name} className="text-right">
                  {col.title}
                </Label>
                {col.type === 'bool' ? (
                  <div className="col-span-3 flex items-center">
                    <Switch
                      checked={Boolean(editingItem?.[col.name])}
                      onCheckedChange={(checked) => handleInputChange(col.name, checked)}
                    />
                  </div>
                ) : col.type === 'int' || col.type === 'float' ? (
                  <Input
                    id={col.name}
                    type="number"
                    value={String(editingItem?.[col.name] ?? '')}
                    onChange={(e) => handleInputChange(col.name, col.type === 'int' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
                    className="col-span-3"
                  />
                ) : (
                  <Input
                    id={col.name}
                    value={String(editingItem?.[col.name] ?? '')}
                    onChange={(e) => handleInputChange(col.name, e.target.value)}
                    className="col-span-3"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
