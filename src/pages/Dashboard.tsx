import { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
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
import {
  commandColors,
} from '@/lib/mockData';
import { useLanguage } from '@/contexts/LanguageContext';

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
       // Fallback to default: only show "summary" on error
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
        // Fallback to mock data on error
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
        
        // 如果是今天且没有数据，自动切到昨天
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
        
        // Extract dynamic command types from API data
        if (groupTriggers.length > 0) {
          const firstItem = groupTriggers[0];
          const cmds = Object.keys(firstItem).filter(k => k !== 'group');
          setCommandTypeList(cmds);
          // Set visibility for all commands
          const visibility: Record<string, boolean> = {};
          cmds.forEach(cmd => { visibility[cmd] = true; });
          setGroupTriggerVisibility(visibility);
          setPersonalTriggerVisibility(visibility);
        }
      } catch (error) {
        console.error('Failed to fetch daily data:', error);
        // Fallback to empty data on error
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

  // Generic legend click handler
  const createLegendClickHandler = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
    return useCallback((e: any) => {
      const { dataKey } = e;
      setter(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    }, [setter]);
  };

  const handleMonthlyCommandLegendClick = createLegendClickHandler(setMonthlyCommandVisibility);
  const handleMonthlyUserGroupLegendClick = createLegendClickHandler(setMonthlyUserGroupVisibility);
  const handleCommandUsageLegendClick = createLegendClickHandler(setCommandUsageVisibility);
  const handleGroupTriggerLegendClick = createLegendClickHandler(setGroupTriggerVisibility);
  const handlePersonalTriggerLegendClick = createLegendClickHandler(setPersonalTriggerVisibility);

  // Custom tooltip for stacked bar charts
  const StackedBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
    
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold mb-2 text-foreground">{label}</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {payload.filter((entry: any) => entry.value > 0).map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-2 pt-2 flex justify-between">
          <span className="text-muted-foreground text-sm">{t('dashboard.total')}</span>
          <span className="font-semibold text-foreground">{total}</span>
        </div>
      </div>
    );
  };

  // Custom legend with click to toggle visibility
  const renderClickableLegend = (props: any, visibility: Record<string, boolean>) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {payload.map((entry: any, index: number) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all text-xs",
              visibility[entry.dataKey] 
                ? "bg-muted/50 hover:bg-muted" 
                : "bg-muted/20 opacity-50 hover:opacity-70"
            )}
            onClick={() => props.onClick?.({ dataKey: entry.dataKey })}
          >
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: entry.color }}
            />
            <span className={visibility[entry.dataKey] ? "text-foreground" : "text-muted-foreground line-through"}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

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
        
        {/* #TODO: Populate bot list from API */}
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
          {/* #TODO: Replace with actual API data */}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyCommandData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.slice(5)}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                content={(props) => renderClickableLegend({ ...props, onClick: handleMonthlyCommandLegendClick }, monthlyCommandVisibility)}
              />
              <Line 
                type="monotone" 
                dataKey="sentCommands" 
                stroke="#3b82f6"
                name={t('dashboard.sendCommand')}
                strokeWidth={2}
                dot={false}
                hide={!monthlyCommandVisibility.sentCommands}
              />
              <Line 
                type="monotone" 
                dataKey="receivedCommands" 
                stroke="#10b981"
                name={t('dashboard.receiveCommand')}
                strokeWidth={2}
                dot={false}
                hide={!monthlyCommandVisibility.receivedCommands}
              />
              <Line 
                type="monotone" 
                dataKey="commandCalls" 
                stroke="#f59e0b"
                name={t('dashboard.commandCall')}
                strokeWidth={2}
                dot={false}
                hide={!monthlyCommandVisibility.commandCalls}
              />
              <Line 
                type="monotone" 
                dataKey="imageGenerated" 
                stroke="#8b5cf6"
                name={t('dashboard.imageGen')}
                strokeWidth={2}
                dot={false}
                hide={!monthlyCommandVisibility.imageGenerated}
              />
            </LineChart>
          </ResponsiveContainer>
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
          {/* #TODO: Replace with actual API data */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyUserGroupData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                content={(props) => renderClickableLegend({ ...props, onClick: handleMonthlyUserGroupLegendClick }, monthlyUserGroupVisibility)}
              />
              <Bar 
                dataKey="users" 
                fill="#3b82f6"
                name={t('dashboard.users')}
                radius={[4, 4, 0, 0]}
                hide={!monthlyUserGroupVisibility.users}
              />
              <Bar 
                dataKey="groups" 
                fill="#10b981"
                name={t('dashboard.groups')}
                radius={[4, 4, 0, 0]}
                hide={!monthlyUserGroupVisibility.groups}
              />
            </BarChart>
          </ResponsiveContainer>
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
          {/* #TODO: Replace with actual API data */}
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dailyCommandUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="command" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                content={(props) => renderClickableLegend({ ...props, onClick: handleCommandUsageLegendClick }, commandUsageVisibility)}
              />
              <Bar 
                dataKey="count" 
                fill="#3b82f6"
                name={t('dashboard.callCount')}
                radius={[0, 6, 6, 0]}
                hide={!commandUsageVisibility.count}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Group & Personal Triggers - Each on Separate Row */}
      <div className="space-y-6">
        {/* Group Command Triggers Stacked Bar Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="w-5 h-5" />
              {t('dashboard.groupCommandTrigger')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* #TODO: Replace with actual API data */}
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dailyGroupTriggers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="group" type="category" tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={<StackedBarTooltip />} />
                <Legend 
                  content={(props) => renderClickableLegend({ ...props, onClick: handleGroupTriggerLegendClick }, groupTriggerVisibility)}
                />
                {commandTypeList.map((cmd, index) => (
                  <Bar
                    key={cmd}
                    dataKey={cmd}
                    stackId="total"
                    fill={commandColors[cmd] || '#6b7280'}
                    name={cmd}
                    hide={!groupTriggerVisibility[cmd]}
                    radius={index === commandTypeList.length - 1 ? [0, 6, 6, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Personal Command Triggers Stacked Bar Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('dashboard.personalCommandTrigger')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* #TODO: Replace with actual API data */}
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dailyPersonalTriggers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={75} />
                <Tooltip content={<StackedBarTooltip />} />
                <Legend 
                  content={(props) => renderClickableLegend({ ...props, onClick: handlePersonalTriggerLegendClick }, personalTriggerVisibility)}
                />
                {commandTypeList.map((cmd, index) => (
                  <Bar
                    key={cmd}
                    dataKey={cmd}
                    stackId="total"
                    fill={commandColors[cmd] || '#6b7280'}
                    name={cmd}
                    hide={!personalTriggerVisibility[cmd]}
                    radius={index === commandTypeList.length - 1 ? [0, 6, 6, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
