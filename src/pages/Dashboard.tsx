import { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, UsersRound, UserPlus, UserMinus, TrendingUp,
  Activity, Calendar, Bot, MessageSquare, LayoutGrid
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { dashboardApi, DailyCommandData, BotItem } from '@/lib/api';
import { commandColors } from '@/lib/mockData';
import { useLanguage } from '@/contexts/LanguageContext';
import { EChartsWrapper } from '@/components/charts';
import type { EChartsOption } from 'echarts';

export default function Dashboard() {
  const { t } = useLanguage();
  // State for bot list from API
  const [botList, setBotList] = useState<BotItem[]>([{ id: 'all', name: t('dashboard.summary') }]);
  const [selectedBot, setSelectedBot] = useState('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Data states from API
  const [keyMetrics, setKeyMetrics] = useState({
    dau: 0, dag: 0, mau: 0, mag: 0, retention: '0%',
    newUsers: 0, churnedUsers: 0, dauMauRatio: '0', dagMagRatio: '0'
  });
  const [monthlyCommandData, setMonthlyCommandData] = useState<Array<{
    date: string;
    sentCommands: number;
    receivedCommands: number;
    commandCalls: number;
    imageGenerated: number;
  }>>([]);
  const [monthlyUserGroupData, setMonthlyUserGroupData] = useState<Array<{
    date: string;
    users: number;
    groups: number;
  }>>([]);
  // Daily data states
  const [dailyCommandUsage, setDailyCommandUsage] = useState<DailyCommandData[]>([]);
  const [dailyGroupTriggers, setDailyGroupTriggers] = useState<Array<Record<string, any>>>([]);
  const [dailyPersonalTriggers, setDailyPersonalTriggers] = useState<Array<Record<string, any>>>([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
 
  // Dynamic command list from API
  const [commandTypeList, setCommandTypeList] = useState<string[]>([]);
  
  // Fetch bot list from API
  useEffect(() => {
    const fetchBots = async () => {
      try {
        const bots = await dashboardApi.getBots();
        if (bots.length > 0) {
          setBotList(bots);
        }
      } catch (error) {
        console.error('Failed to fetch bot list:', error);
        setBotList([{ id: 'all', name: t('dashboard.summary') }]);
      }
    };
    fetchBots();
  }, []);
    
  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metrics, commands, usersGroups] = await Promise.all([
          dashboardApi.getMetrics(selectedBot),
          dashboardApi.getCommands(selectedBot),
          dashboardApi.getUsersGroups(selectedBot),
        ]);
        setKeyMetrics(metrics);
        setMonthlyCommandData(commands);
        setMonthlyUserGroupData(usersGroups);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setKeyMetrics({
          dau: Math.floor(Math.random() * 5000) + 1000,
          dag: Math.floor(Math.random() * 800) + 200,
          mau: Math.floor(Math.random() * 20000) + 5000,
          mag: Math.floor(Math.random() * 3000) + 500,
          retention: (Math.random() * 30 + 60).toFixed(1) + '%',
          newUsers: Math.floor(Math.random() * 300) + 50,
          churnedUsers: Math.floor(Math.random() * 100) + 20,
          dauMauRatio: (Math.random() * 0.3 + 0.1).toFixed(2),
          dagMagRatio: (Math.random() * 0.4 + 0.2).toFixed(2),
        });
      }
    };
    fetchData();
  }, [selectedBot]);

  // Legend visibility states for each chart
  const [monthlyCommandVisibility, setMonthlyCommandVisibility] = useState<Record<string, boolean>>({
    sentCommands: true,
    receivedCommands: true,
    commandCalls: true,
    imageGenerated: true,
  });
  const [monthlyUserGroupVisibility, setMonthlyUserGroupVisibility] = useState<Record<string, boolean>>({
    users: true,
    groups: true,
  });
  const [commandUsageVisibility, setCommandUsageVisibility] = useState<Record<string, boolean>>({
    count: true,
  });
  const [groupTriggerVisibility, setGroupTriggerVisibility] = useState<Record<string, boolean>>({});
  const [personalTriggerVisibility, setPersonalTriggerVisibility] = useState<Record<string, boolean>>({});
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Fetch daily data when date or bot changes
  useEffect(() => {
    const fetchDailyData = async () => {
      setIsLoadingDaily(true);
      try {
        const [commands, groupTriggers, personalTriggers] = await Promise.all([
          dashboardApi.getDailyCommands(dateStr, selectedBot),
          dashboardApi.getDailyGroupTriggers(dateStr, selectedBot),
          dashboardApi.getDailyPersonalTriggers(dateStr, selectedBot),
        ]);
        
        const today = new Date();
        const isToday = selectedDate.getDate() === today.getDate() &&
                        selectedDate.getMonth() === today.getMonth() &&
                        selectedDate.getFullYear() === today.getFullYear();
                        
        if (isToday && commands.length === 0 && groupTriggers.length === 0 && personalTriggers.length === 0) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          setSelectedDate(yesterday);
          return;
        }
        
        setDailyCommandUsage(commands);
        setDailyGroupTriggers(groupTriggers);
        setDailyPersonalTriggers(personalTriggers);
        
        if (groupTriggers.length > 0) {
          const firstItem = groupTriggers[0];
          const cmds = Object.keys(firstItem).filter(k => k !== 'group');
          setCommandTypeList(cmds);
          const visibility: Record<string, boolean> = {};
          cmds.forEach(cmd => { visibility[cmd] = true; });
          setGroupTriggerVisibility(visibility);
          setPersonalTriggerVisibility(visibility);
        }
      } catch (error) {
        console.error('Failed to fetch daily data:', error);
        setDailyCommandUsage([]);
        setDailyGroupTriggers([]);
        setDailyPersonalTriggers([]);
      } finally {
        setIsLoadingDaily(false);
      }
    };
    fetchDailyData();
  }, [selectedBot, selectedDate]);

  const metricCards = [
    { title: 'DAU', value: keyMetrics.dau.toLocaleString(), icon: Users, color: 'text-blue-500', desc: t('dashboard.dau') },
    { title: 'DAG', value: keyMetrics.dag.toLocaleString(), icon: UsersRound, color: 'text-green-500', desc: t('dashboard.dag') },
    { title: t('dashboard.retention'), value: keyMetrics.retention, icon: TrendingUp, color: 'text-purple-500', desc: t('dashboard.retention') },
    { title: t('dashboard.newUsers'), value: keyMetrics.newUsers.toLocaleString(), icon: UserPlus, color: 'text-cyan-500', desc: t('dashboard.newUsers') },
    { title: t('dashboard.churnedUsers'), value: keyMetrics.churnedUsers.toLocaleString(), icon: UserMinus, color: 'text-red-500', desc: t('dashboard.churnedUsers') },
    { title: 'MAU', value: keyMetrics.mau.toLocaleString(), icon: Activity, color: 'text-orange-500', desc: t('dashboard.mau') },
    { title: t('dashboard.dauMauRatio'), value: keyMetrics.dauMauRatio, icon: TrendingUp, color: 'text-indigo-500', desc: t('dashboard.dauMauRatio') },
    { title: 'MAG', value: keyMetrics.mag.toLocaleString(), icon: UsersRound, color: 'text-teal-500', desc: t('dashboard.mag') },
    { title: t('dashboard.dagMagRatio'), value: keyMetrics.dagMagRatio, icon: TrendingUp, color: 'text-pink-500', desc: t('dashboard.dagMagRatio') },
  ];

  // ============================================================================
  // ECharts 配置
  // ============================================================================

  // 月度命令统计 - 折线图
  const monthlyCommandOption = useMemo<EChartsOption>(() => ({
    animationDuration: 1000,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyCommandData.map(d => d.date.slice(5)),
      boundaryGap: false,
    },
    yAxis: { type: 'value' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { show: false } },
    },
    legend: {
      data: [
        { name: t('dashboard.sendCommand'), icon: 'roundRect' },
        { name: t('dashboard.receiveCommand'), icon: 'roundRect' },
        { name: t('dashboard.commandCall'), icon: 'roundRect' },
        { name: t('dashboard.imageGen'), icon: 'roundRect' },
      ],
      bottom: 0,
      selected: {
        [t('dashboard.sendCommand')]: monthlyCommandVisibility.sentCommands,
        [t('dashboard.receiveCommand')]: monthlyCommandVisibility.receivedCommands,
        [t('dashboard.commandCall')]: monthlyCommandVisibility.commandCalls,
        [t('dashboard.imageGen')]: monthlyCommandVisibility.imageGenerated,
      },
    },
    series: [
      {
        name: t('dashboard.sendCommand'),
        type: 'line',
        data: monthlyCommandData.map(d => d.sentCommands),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        areaStyle: {
          opacity: 0.08,
        },
        emphasis: { focus: 'series' },
      },
      {
        name: t('dashboard.receiveCommand'),
        type: 'line',
        data: monthlyCommandData.map(d => d.receivedCommands),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        areaStyle: {
          opacity: 0.08,
        },
        emphasis: { focus: 'series' },
      },
      {
        name: t('dashboard.commandCall'),
        type: 'line',
        data: monthlyCommandData.map(d => d.commandCalls),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        areaStyle: {
          opacity: 0.08,
        },
        emphasis: { focus: 'series' },
      },
      {
        name: t('dashboard.imageGen'),
        type: 'line',
        data: monthlyCommandData.map(d => d.imageGenerated),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        areaStyle: {
          opacity: 0.08,
        },
        emphasis: { focus: 'series' },
      },
    ],
  }), [monthlyCommandData, monthlyCommandVisibility, t]);

  // 月度用户与群组统计 - 柱状图
  const monthlyUserGroupOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: monthlyUserGroupData.map(d => d.date.slice(5)),
    },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: [
        { name: t('dashboard.users'), icon: 'roundRect' },
        { name: t('dashboard.groups'), icon: 'roundRect' },
      ],
      bottom: 0,
      selected: {
        [t('dashboard.users')]: monthlyUserGroupVisibility.users,
        [t('dashboard.groups')]: monthlyUserGroupVisibility.groups,
      },
    },
    series: [
      {
        name: t('dashboard.users'),
        type: 'bar',
        data: monthlyUserGroupData.map(d => d.users),
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('dashboard.groups'),
        type: 'bar',
        data: monthlyUserGroupData.map(d => d.groups),
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
    ],
  }), [monthlyUserGroupData, monthlyUserGroupVisibility, t]);

  // 命令使用量 - 水平柱状图
  const commandUsageOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '8%', bottom: '8%', top: '8%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: dailyCommandUsage.map(d => d.command),
      axisLabel: { fontSize: 11 },
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: [{ name: t('dashboard.callCount'), icon: 'roundRect' }],
      bottom: 0,
      selected: {
        [t('dashboard.callCount')]: commandUsageVisibility.count,
      },
    },
    series: [
      {
        name: t('dashboard.callCount'),
        type: 'bar',
        data: dailyCommandUsage.map(d => d.count),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [0, 6, 6, 0] },
        emphasis: { focus: 'series' },
      },
    ],
  }), [dailyCommandUsage, commandUsageVisibility, t]);

  // 群组命令触发量 - 堆叠水平柱状图
  const groupTriggerOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '8%', bottom: '12%', top: '8%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: dailyGroupTriggers.map(d => d.group),
      axisLabel: { fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const label = params[0].axisValue;
        let total = 0;
        let rows = '';
        params.forEach((p: any) => {
          if (p.value > 0) {
            total += p.value;
            rows += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:2px 0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
                ${p.seriesName}
              </span>
              <span style="font-weight:600">${p.value}</span>
            </div>`;
          }
        });
        return `<div style="min-width:120px">
          <div style="font-weight:600;margin-bottom:6px">${label}</div>
          ${rows}
          <div style="border-top:1px solid rgba(128,128,128,0.2);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
            <span>${t('dashboard.total')}</span><span style="font-weight:700">${total}</span>
          </div>
        </div>`;
      },
    },
    legend: {
      data: commandTypeList.map(cmd => ({ name: cmd, icon: 'roundRect' })),
      bottom: 0,
      selected: groupTriggerVisibility,
    },
    series: commandTypeList.map((cmd, index) => ({
      name: cmd,
      type: 'bar' as const,
      stack: 'total',
      data: dailyGroupTriggers.map(d => d[cmd] || 0),
      barMaxWidth: 20,
      itemStyle: {
        color: commandColors[cmd] || '#6b7280',
        borderRadius: index === commandTypeList.length - 1 ? [0, 6, 6, 0] : undefined,
      },
      emphasis: { focus: 'series' as const },
    })),
  }), [dailyGroupTriggers, commandTypeList, groupTriggerVisibility, t]);

  // 个人命令触发量 - 堆叠水平柱状图
  const personalTriggerOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '8%', bottom: '12%', top: '8%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: dailyPersonalTriggers.map(d => d.user),
      axisLabel: { fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const label = params[0].axisValue;
        let total = 0;
        let rows = '';
        params.forEach((p: any) => {
          if (p.value > 0) {
            total += p.value;
            rows += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:2px 0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
                ${p.seriesName}
              </span>
              <span style="font-weight:600">${p.value}</span>
            </div>`;
          }
        });
        return `<div style="min-width:120px">
          <div style="font-weight:600;margin-bottom:6px">${label}</div>
          ${rows}
          <div style="border-top:1px solid rgba(128,128,128,0.2);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
            <span>${t('dashboard.total')}</span><span style="font-weight:700">${total}</span>
          </div>
        </div>`;
      },
    },
    legend: {
      data: commandTypeList.map(cmd => ({ name: cmd, icon: 'roundRect' })),
      bottom: 0,
      selected: personalTriggerVisibility,
    },
    series: commandTypeList.map((cmd, index) => ({
      name: cmd,
      type: 'bar' as const,
      stack: 'total',
      data: dailyPersonalTriggers.map(d => d[cmd] || 0),
      barMaxWidth: 20,
      itemStyle: {
        color: commandColors[cmd] || '#6b7280',
        borderRadius: index === commandTypeList.length - 1 ? [0, 6, 6, 0] : undefined,
      },
      emphasis: { focus: 'series' as const },
    })),
  }), [dailyPersonalTriggers, commandTypeList, personalTriggerVisibility, t]);

  // Legend 切换事件处理
  const handleLegendSelectChanged = useCallback((
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    keyMap: Record<string, string>
  ) => {
    return (params: any) => {
      if (params.type === 'legendselectchanged') {
        setter(prev => {
          const next = { ...prev };
          Object.entries(keyMap).forEach(([legendName, stateKey]) => {
            if (legendName in params.selected) {
              next[stateKey] = params.selected[legendName];
            }
          });
          return next;
        });
      }
    };
  }, []);

  const monthlyCommandLegendHandler = useMemo(() => handleLegendSelectChanged(
    setMonthlyCommandVisibility,
    {
      [t('dashboard.sendCommand')]: 'sentCommands',
      [t('dashboard.receiveCommand')]: 'receivedCommands',
      [t('dashboard.commandCall')]: 'commandCalls',
      [t('dashboard.imageGen')]: 'imageGenerated',
    }
  ), [t, handleLegendSelectChanged]);

  const monthlyUserGroupLegendHandler = useMemo(() => handleLegendSelectChanged(
    setMonthlyUserGroupVisibility,
    {
      [t('dashboard.users')]: 'users',
      [t('dashboard.groups')]: 'groups',
    }
  ), [t, handleLegendSelectChanged]);

  const commandUsageLegendHandler = useMemo(() => handleLegendSelectChanged(
    setCommandUsageVisibility,
    { [t('dashboard.callCount')]: 'count' }
  ), [t, handleLegendSelectChanged]);

  const groupTriggerLegendHandler = useMemo(() => {
    const keyMap: Record<string, string> = {};
    commandTypeList.forEach(cmd => { keyMap[cmd] = cmd; });
    return handleLegendSelectChanged(setGroupTriggerVisibility, keyMap);
  }, [commandTypeList, handleLegendSelectChanged]);

  const personalTriggerLegendHandler = useMemo(() => {
    const keyMap: Record<string, string> = {};
    commandTypeList.forEach(cmd => { keyMap[cmd] = cmd; });
    return handleLegendSelectChanged(setPersonalTriggerVisibility, keyMap);
  }, [commandTypeList, handleLegendSelectChanged]);

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      {/* Header with Bot Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutGrid className="w-8 h-8" />
            {t('dashboard.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('dashboard.description')}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-muted-foreground" />
          <Select value={selectedBot} onValueChange={setSelectedBot}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('dashboard.selectBot')} />
            </SelectTrigger>
            <SelectContent>
              {botList.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  {bot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-4">
        {metricCards.map((metric) => (
          <Card key={metric.title} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.title}</p>
                <p className="text-xs text-muted-foreground/70">{metric.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Command Line Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t('dashboard.monthlyCommandStats')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EChartsWrapper
            option={monthlyCommandOption}
            height={300}
            onEvents={{ legendselectchanged: monthlyCommandLegendHandler }}
          />
        </CardContent>
      </Card>

      {/* Monthly User & Group Bar Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('dashboard.monthlyUserStats')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EChartsWrapper
            option={monthlyUserGroupOption}
            height={300}
            onEvents={{ legendselectchanged: monthlyUserGroupLegendHandler }}
          />
        </CardContent>
      </Card>

      {/* Date Selector */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">{t('dashboard.dateDetails')}</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "yyyy-MM-dd") : t('dashboard.selectDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              defaultMonth={selectedDate}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Command Usage - Full Width Row */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t('dashboard.commandUsage')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EChartsWrapper
            option={commandUsageOption}
            height={350}
            onEvents={{ legendselectchanged: commandUsageLegendHandler }}
          />
        </CardContent>
      </Card>

      {/* Group & Personal Triggers */}
      <div className="space-y-6">
        {/* Group Command Triggers */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="w-5 h-5" />
              {t('dashboard.groupCommandTrigger')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EChartsWrapper
              option={groupTriggerOption}
              height={350}
              onEvents={{ legendselectchanged: groupTriggerLegendHandler }}
            />
          </CardContent>
        </Card>

        {/* Personal Command Triggers */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('dashboard.personalCommandTrigger')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EChartsWrapper
              option={personalTriggerOption}
              height={350}
              onEvents={{ legendselectchanged: personalTriggerLegendHandler }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
