import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Users,
  UsersRound,
  UserPlus,
  UserMinus,
  UserRound,
  TrendingUp,
  Activity,
  MessageSquare,
  LayoutGrid,
  ChartColumn,
  Maximize2,
  Minimize2,
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
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { dashboardApi, type DailyCommandData, type BotItem } from '@/lib/api';
import {
  asPercent,
  collectCommandKeysFromTriggerRows,
  latestDateWithMetric,
  sparkHeadline,
  unwrapSettledRows,
} from '@/lib/featureUtils';
import { MetricDayCalendar } from '@/components/ui/metric-day-calendar';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BAR_RADIUS_RIGHT,
  BAR_THICKNESS,
  barFill,
  compactTick,
  EChartsWrapper,
  LEGEND_BASE,
  niceMax,
  stackedCells,
  useSeriesRamp,
  withAlpha,
} from '@/components/charts';
import type { EChartsOption } from 'echarts';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { DataBlock, MetricHero, MetricMini } from '@/components/ui/DataBlock';

// ============================================================================
// 视觉基元
// ============================================================================
//
// 色阶 / 渐变 / 柱条圆角 / 刻度压缩 / 轴底子已抽到 @/components/charts 的
// chartPrimitives（与 /ai-statistics 共用），数据块外观在 @/components/ui/DataBlock。
// 下面只留 /dashboard 自己的排版常量与数据整形。

/** 「其他」分组的内部名。用哨兵而不是译文，避免和真实命令重名把两条 series 合并掉。 */
const OTHER_SERIES = '__other__';
/** 堆叠图的分段上限：前 4 个命令各占一色，其余全并进「其他」。 */
const STACK_SERIES_LIMIT = 4;

interface TopSeries {
  /** series 名（顺序即堆叠顺序），末位可能是 OTHER_SERIES */
  names: string[];
  /** 行，按总量降序 —— 配合 yAxis.inverse 让 #1 落在最上面 */
  rows: { id: string; values: number[] }[];
  hasOther: boolean;
}

/**
 * 把「每行由 N 种命令构成」的稀疏数据压成「前 4 名 + 其他」，并按总量降序。
 * 直接给每种命令一色的话，真实数据动辄十几种命令，图例翻页、颜色打架都读不下去；
 * 归一之后 series 数量恒定，颜色索引也就稳定，切日期不会整片换色。
 */
function buildTopSeries(
  rows: Record<string, unknown>[],
  keys: readonly string[],
  idKey: string,
  limit = STACK_SERIES_LIMIT,
): TopSeries {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const k of keys) totals.set(k, (totals.get(k) ?? 0) + (Number(row[k]) || 0));
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const topKeys = ranked.slice(0, limit).map(([k]) => k);
  const restKeys = ranked.slice(limit).map(([k]) => k);
  const hasOther = restKeys.length > 0;

  const out = rows.map((row) => {
    const values = topKeys.map((k) => Number(row[k]) || 0);
    if (hasOther) {
      values.push(restKeys.reduce((sum, k) => sum + (Number(row[k]) || 0), 0));
    }
    return { id: String(row[idKey] ?? ''), values };
  });
  out.sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));

  return { names: hasOther ? [...topKeys, OTHER_SERIES] : topKeys, rows: out, hasOther };
}

/**
 * 归一后 series 名 → 色号。前 limit 个用主题色阶，「其他」固定吃最后一格中性灰，
 * 这样「其他」在两张图里永远是同一个颜色，读者一眼能认出。
 */
function stackColors(names: string[], ramp: string[], hasOther: boolean): string[] {
  return names.map((_, i) => (hasOther && i === names.length - 1 ? ramp[4] : ramp[i % 4]));
}

/** 月度命令的四项指标：i18n key → 数据字段。改成小倍数后每项一个独立面板，色号按序取主题色阶。 */
const MONTHLY_COMMAND_SERIES = [
  { key: 'dashboard.sendCommand', field: 'sentCommands' },
  { key: 'dashboard.receiveCommand', field: 'receivedCommands' },
  { key: 'dashboard.commandCall', field: 'commandCalls' },
  { key: 'dashboard.imageGen', field: 'imageGenerated' },
] as const;

/** 月度用户/群组的两项指标，写法与上面一致。 */
const MONTHLY_AUDIENCE_SERIES = [
  { key: 'dashboard.users', field: 'users' },
  { key: 'dashboard.groups', field: 'groups' },
] as const;

/** 常驻刷新的间隔。页面切到后台时暂停，回到前台立刻补一次。 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * 图表高度带。行高 DAY_ROW_HEIGHT 同时定住「一根条占多高」，
 * 所以卡片高度跟着行数走时，条粗细天然稳定，不需要再按行数单独调宽。
 * 下限 DAY_CHART_MIN 只保证 0~1 行时轴和标签还放得下，别再往上兜 ——
 * 之前压到 130 就是为了让 2 行的图「有存在感」，结果两条细条浮在 40px 空白里。
 */
const SPARK_HEIGHT = 124;
const DAY_ROW_HEIGHT = 26;
const DAY_CHART_MIN = 104;
/** 上限是「一屏」的硬约束：群组一多就封顶，不把页面顶出一条折线。 */
const DAY_CHART_MAX = 300;
/** 近 60 天总量条形图占满整行后的高度：宽是高的十几倍，压太扁就成了装饰线条。 */
const RECENT_TREND_HEIGHT = 132;

type DayBlockKey = 'command' | 'group' | 'personal';

/** 展开态按这张卡自己的行数算高：2 行就别留一大片空白，几十行也铺得开。
 *  行高沿用 DAY_ROW_HEIGHT，展开前后的条粗细才对得上。
 *  2000px 封顶是防极端数据把页面顶成几千像素 —— 单日的命令条目不至于这么多。 */
function expandedDayHeight(rows: number): number {
  return Math.min(Math.max(rows * DAY_ROW_HEIGHT + 96, 200), 2000);
}

interface DayBlockProps {
  blockKey: DayBlockKey;
  expandedKey: DayBlockKey | null;
  onToggle: (key: DayBlockKey) => void;
  title: string;
  icon: typeof Users;
  option: EChartsOption;
  rows: number;
  compactHeight: number;
  onEvents?: React.ComponentProps<typeof EChartsWrapper>['onEvents'];
}

/**
 * 按日图。收起态是十二栅格里的四分之一宽一格；展开后占满整行、高度放开，
 * 把这张接口当天返回的全部条目铺出来 —— 概览和明细在同一张卡上切换，不用另开页面。
 * 标题右侧常驻「共 N 条」和展开按钮，入口不至于藏在图里看不见。
 */
function DayBlock({
  blockKey,
  expandedKey,
  onToggle,
  title,
  icon: Icon,
  option,
  rows,
  compactHeight,
  onEvents,
}: DayBlockProps) {
  const { t } = useLanguage();
  const expanded = expandedKey === blockKey;
  /* 展开的那张吃满 12 列，没展开的退成 6+6 排下一行。
     但光凑总数不够 —— 栅格是按文档顺序自动放置的，12 列的项塞不进当前行剩下的
     6 列时会整行下移，把那半行留成空洞。三张顺序是命令 / 群组 / 个人，
     中位的「群组」一展开就正好踩中：第一行只剩它前面那张卡，右半整片空着。
     所以展开的那张用 order-first 顶到本组最前，剩下两张才排得进同一行。 */
  const span = expanded
    ? 'order-first md:col-span-2 xl:col-span-12'
    : expandedKey
      ? 'md:col-span-1 xl:col-span-6'
      : 'xl:col-span-4';
  return (
    <DataBlock
      title={title}
      icon={Icon}
      className={span}
      extra={
        <div className="flex items-center gap-1.5">
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('dashboard.itemCount', { count: rows })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={t(expanded ? 'dashboard.collapseChart' : 'dashboard.expandChart')}
            title={t(expanded ? 'dashboard.collapseChart' : 'dashboard.expandChart')}
            onClick={() => onToggle(blockKey)}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      }
    >
      {/* key 跟着展开态走：echarts-for-react 只在 window resize 时 resize，
          容器被 grid 改成 12 列、图表变高之后它仍按旧尺寸渲染，会被裁掉一块。
          换 key 强制重建实例，它会拿新容器的尺寸重新初始化。 */}
      <EChartsWrapper
        key={expanded ? 'expanded' : 'compact'}
        option={option}
        height={expanded ? expandedDayHeight(rows) : compactHeight}
        onEvents={onEvents}
      />
    </DataBlock>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  /** 全页图表共用一套主题色阶：切主题时所有图一起换色。 */
  const ramp = useSeriesRamp();
  // State for bot list from API
  const [botList, setBotList] = useState<BotItem[]>([{ id: 'all', name: t('dashboard.summary') }]);
  const [selectedBot, setSelectedBot] = useState('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Data states from API
  const [keyMetrics, setKeyMetrics] = useState({
    dau: 0,
    dag: 0,
    mau: 0,
    mag: 0,
    retention: '0%',
    newUsers: 0,
    churnedUsers: 0,
    dauMauRatio: '0',
    dagMagRatio: '0',
  });
  const [monthlyCommandData, setMonthlyCommandData] = useState<
    Array<{
      date: string;
      sentCommands: number;
      receivedCommands: number;
      commandCalls: number;
      imageGenerated: number;
    }>
  >([]);
  const [monthlyUserGroupData, setMonthlyUserGroupData] = useState<
    Array<{
      date: string;
      users: number;
      groups: number;
    }>
  >([]);
  // Daily data states
  const [dailyCommandUsage, setDailyCommandUsage] = useState<DailyCommandData[]>([]);
  const [dailyGroupTriggers, setDailyGroupTriggers] = useState<Array<Record<string, unknown>>>([]);
  const [dailyPersonalTriggers, setDailyPersonalTriggers] = useState<
    Array<Record<string, unknown>>
  >([]);
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

  // 汇总指标 + 月度序列。抽成 useCallback 供「首次进入」和「定时刷新」共用一份实现。
  const loadSummary = useCallback(async () => {
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
        // 按后端契约给「百分数本身」：dauMauRatio/dagMagRatio 是 rstrip 掉 % 的 DAU_MAU/DAG_MAG，
        // 不是 0~1 的分数。给 0.23 会让前端的 asPercent 补成 0.23%，比真值小两个数量级。
        dauMauRatio: (Math.random() * 20 + 5).toFixed(2),
        dagMagRatio: (Math.random() * 50 + 10).toFixed(2),
      });
    }
  }, [selectedBot]);

  // 月度两张图改小倍数后没有图例了（每项指标一个独立面板，本来就不该有开关）；
  // 命令使用量是单序列，也不需要图例。这里只保留堆叠图的可见性状态。
  const [groupTriggerVisibility, setGroupTriggerVisibility] = useState<Record<string, boolean>>({});
  const [personalTriggerVisibility, setPersonalTriggerVisibility] = useState<
    Record<string, boolean>
  >({});
  /** yyyy-MM-dd → 当日命令总数（日历角标 + 禁用无数据日） */
  const [dailyCommandCounts, setDailyCommandCounts] = useState<Record<string, number>>({});
  /** 最近一次成功拉取的时刻，供工具栏显示「更新于」 */
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  /** 月度序列末尾那个「今天」的 MM-DD，用于给读数挂「今日」角标 */
  const todayMD = format(new Date(), 'MM-dd');

  // 日历：近 60 天每日命令总数（随 bot 变化）
  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      try {
        const rows = await dashboardApi.getDailyCommandCounts(60, selectedBot);
        if (cancelled) return;
        const record: Record<string, number> = {};
        for (const item of rows ?? []) {
          record[item.date] = item.count ?? 0;
        }
        setDailyCommandCounts(record);
        // 当前选中日若无数据，跳到最近有命令的一天
        const cur = format(selectedDate, 'yyyy-MM-dd');
        if ((record[cur] ?? 0) <= 0) {
          const latest = latestDateWithMetric(record);
          if (latest) {
            setSelectedDate(parse(latest, 'yyyy-MM-dd', new Date()));
          }
        }
      } catch (error) {
        console.error('Failed to fetch daily command counts:', error);
      }
    };
    void loadCounts();
    return () => {
      cancelled = true;
    };
    // selectedDate 不进 deps：避免跳转后重复拉 counts；bot 变才重拉
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [selectedBot]);

  // 按日三张图。堆叠图的可见性默认「没被显式关掉就是显示」，
  // 所以这里不用重建图例状态，定时刷新也不会把用户关掉的分段重新打开。
  const loadDaily = useCallback(async () => {
    setIsLoadingDaily(true);
    // 三个接口各自降级：任一失败只影响自己的图，不连带清空其它已成功的数据
    const [commands, groupTriggers, personalTriggers] = await Promise.allSettled([
      dashboardApi.getDailyCommands(dateStr, selectedBot),
      dashboardApi.getDailyGroupTriggers(dateStr, selectedBot),
      dashboardApi.getDailyPersonalTriggers(dateStr, selectedBot),
    ]);

    const onError = (reason: unknown) => console.error('Failed to fetch daily data:', reason);
    const commandRows = unwrapSettledRows<DailyCommandData>(commands, onError);
    const groupRows = unwrapSettledRows<Record<string, unknown>>(groupTriggers, onError);
    const personalRows = unwrapSettledRows<Record<string, unknown>>(personalTriggers, onError);

    setDailyCommandUsage(commandRows);
    setDailyGroupTriggers(groupRows);
    setDailyPersonalTriggers(personalRows);

    const cmds = collectCommandKeysFromTriggerRows(
      [...groupRows, ...personalRows],
      ['group', 'user'],
    );
    for (const row of commandRows) {
      if (row?.command && !cmds.includes(row.command)) cmds.push(row.command);
    }
    setCommandTypeList(cmds);
    setIsLoadingDaily(false);
  }, [dateStr, selectedBot]);

  useEffect(() => {
    void loadSummary();
    void loadDaily();
    setUpdatedAt(new Date());
  }, [loadSummary, loadDaily]);

  /**
   * 常驻刷新：定时重拉，且在标签页重新可见时立刻补一次（切走期间错过的数据不留着）。
   * 页面不可见时跳过定时请求，避免后台无谓打后端。
   */
  useEffect(() => {
    const refresh = () => {
      void loadSummary();
      void loadDaily();
      setUpdatedAt(new Date());
    };
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadSummary, loadDaily]);

  const metricTiles = [
    {
      key: 'dau',
      title: 'DAU',
      value: keyMetrics.dau.toLocaleString(),
      icon: Users,
      desc: t('dashboard.dauDesc'),
    },
    {
      key: 'dag',
      title: 'DAG',
      value: keyMetrics.dag.toLocaleString(),
      icon: UsersRound,
      desc: t('dashboard.dagDesc'),
    },
    {
      key: 'retention',
      title: t('dashboard.retention'),
      value: keyMetrics.retention,
      icon: TrendingUp,
      desc: t('dashboard.retentionDesc'),
    },
    {
      key: 'newUsers',
      title: t('dashboard.newUsers'),
      value: keyMetrics.newUsers.toLocaleString(),
      icon: UserPlus,
      desc: t('dashboard.newUsersDesc'),
    },
    {
      key: 'churnedUsers',
      title: t('dashboard.churnedUsers'),
      value: keyMetrics.churnedUsers.toLocaleString(),
      icon: UserMinus,
      desc: t('dashboard.churnedUsersDesc'),
    },
    {
      key: 'mau',
      title: 'MAU',
      value: keyMetrics.mau.toLocaleString(),
      icon: Activity,
      desc: t('dashboard.mauDesc'),
    },
    {
      key: 'dauMauRatio',
      title: t('dashboard.dauMauRatio'),
      value: asPercent(keyMetrics.dauMauRatio),
      icon: Activity,
      desc: t('dashboard.dauMauRatioDesc'),
    },
    {
      key: 'mag',
      title: 'MAG',
      value: keyMetrics.mag.toLocaleString(),
      icon: UsersRound,
      desc: t('dashboard.magDesc'),
    },
    {
      key: 'dagMagRatio',
      title: t('dashboard.dagMagRatio'),
      value: asPercent(keyMetrics.dagMagRatio),
      icon: TrendingUp,
      desc: t('dashboard.dagMagRatioDesc'),
    },
  ];

  /** 主指标固定取第一个（DAU —— 今天到底有多少人在用，是这块板子上最该被看见的数字）。 */
  const heroMetric = metricTiles[0];
  const restMetrics = metricTiles.slice(1);

  // ============================================================================
  // ECharts 配置
  // ============================================================================

  // ============================================================================
  // 月度小倍数（small multiples）
  // ============================================================================
  // 这两组指标内部量级差得很远（接收消息上万、命令调用几百；用户几十、群组个位数）。
  // 画在同一根 Y 轴上，小的那几条会被压成贴地直线 —— 那是量级差，不是样式能救的。
  // 所以每项指标一个独立面板、各自的 Y 轴：既不谎报比例，也不再浪费绘图区。
  // 面板抬头交给 React 写（指标名 + 最新值），ECharts 只负责那条线，版式更好控。

  const monthlySparkOption = useCallback(
    (dates: string[], values: number[], color: string, showXAxis: boolean): EChartsOption => {
      /* 平均参照线自己算，不用 markLine 的 type:'average'。两个原因：
         一是那种写法下 label.formatter 只能收 CallbackDataParams，value 是联合类型，
         为了拿一个数字得单写一层收窄；二是全 0 的序列画出来是一条贴着底的虚线加个「0」，
         纯属噪声，不如不画。 */
      const sum = values.reduce((acc, v) => acc + v, 0);
      const avg = values.length > 0 ? sum / values.length : 0;
      return {
        animationDuration: 600,
        animationEasing: 'cubicOut' as const,
        /* 不开 containLabel：开了之后每格绘图区宽度随自己的标签长度浮动，
           一排格子的线就不再等宽。改成写死余量 —— 左边 28 刚好放下峰值数字（9px 字体 + 8px 间隙），
           右边 14 是给 boundaryGap:false 时压在网格边线上的首/末个日期标签留半格宽度，
           不留的话 `10-13` 会被切掉半个字符变成 `10-1`。
           bottom 则是：有 X 轴标签的格子多留 10px 给日期，没有的顺势把绘图区往上顶，两排线才对得齐。 */
        grid: { left: 28, right: 14, top: 6, bottom: showXAxis ? 18 : 8 },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { show: false },
          axisTick: { show: false },
          // 一排面板共用同一条时间轴：日期只由最左那格标一次，其余 3 格省掉，
          // 否则 4 组日期数字挤在一起，是「中间显得拥挤」的主要来源。
          axisLabel: {
            show: showXAxis,
            fontSize: 9,
            hideOverlap: true,
            margin: 6,
            interval: 'auto',
          },
        },
        yAxis: {
          type: 'value',
          /* 上界自己算：交给自动取整，每格线占的高度会不一样，同排的线就散了 */
          min: 0,
          max: niceMax(values),
          axisLine: { show: false },
          axisTick: { show: false },
          // 只留峰值一个数字。每项指标量级不同（0-15k 和 0-600 并排），
          // 顶端数字给出参照，中间的档位只会挤占绘图区。
          axisLabel: {
            show: true,
            showMaxLabel: true,
            showMinLabel: false,
            hideOverlap: true,
            fontSize: 9,
            formatter: compactTick,
          },
          /* 中间刻度不受 showMinLabel/showMaxLabel 控制，splitNumber 才是开关：
           给 2 会画 0/50%/100% 三档，藏掉 0 也还剩两个数字挤在窄格里；
           给 1 只剩 0 和 max，藏掉 0 就真的只有峰值一个。 */
          splitNumber: 1,
          splitLine: { lineStyle: { type: 'dashed', opacity: 0.45 } },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'line', lineStyle: { type: 'dashed' } },
        },
        series: [
          {
            type: 'line',
            data: values,
            smooth: 0.25,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { width: 2, cap: 'round' },
            itemStyle: { color },
            /* 单序列独占一个面板，面积渐变叠不到别人身上，可以放心铺一层 */
            areaStyle: { color: barFill(color) },
            emphasis: { lineStyle: { width: 3 } },
            /* 平均值参照线。只有折线本身时，「这阵子比平常高还是低」只能靠眼估；
             画一条虚线并标出它的 Y 值，才有一个可读的基准。
             样式刻意压低（虚线、无端点、细一档）——它是参照不是数据，不该跟实线抢。 */
            markLine:
              sum > 0
                ? {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { type: 'dashed', width: 1, color: withAlpha(color, 0.6) },
                    data: [{ yAxis: avg }],
                    label: {
                      show: true,
                      position: 'start',
                      distance: 3,
                      fontSize: 9,
                      formatter: compactTick(avg),
                    },
                  }
                : undefined,
          },
        ],
      };
    },
    [],
  );

  /** 一项指标 = 抬头（名称 + 最新值）+ 一块独立 Y 轴的折线面板。 */
  const renderSpark = (
    label: string,
    dates: string[],
    values: number[],
    color: string,
    showXAxis: boolean,
  ): React.ReactNode => {
    const head = sparkHeadline(dates, values, todayMD);
    return (
      <div key={label} className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{label}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color }}>
            {head}
          </span>
        </div>
        <EChartsWrapper
          option={monthlySparkOption(dates, values, color, showXAxis)}
          height={SPARK_HEIGHT}
        />
      </div>
    );
  };

  const commandSparks = useMemo(
    () =>
      MONTHLY_COMMAND_SERIES.map((s, i) =>
        renderSpark(
          t(s.key),
          monthlyCommandData.map((d) => d.date.slice(5)),
          monthlyCommandData.map((d) => d[s.field]),
          ramp[i % 4],
          i === 0,
        ),
      ),
    // renderSpark 每次渲染都是新函数，只让它依赖真正影响产出的量
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthlyCommandData, ramp, t, todayMD],
  );

  const audienceSparks = useMemo(
    () =>
      MONTHLY_AUDIENCE_SERIES.map((s, i) =>
        renderSpark(
          t(s.key),
          monthlyUserGroupData.map((d) => d.date.slice(5)),
          monthlyUserGroupData.map((d) => d[s.field]),
          ramp[i % 4],
          i === 0,
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthlyUserGroupData, ramp, t, todayMD],
  );
  /* 近 60 天每日命令总数。dailyCommandCounts 一直在拉，但此前只当日历角标和「禁用无数据日」用，
     一整条时间序列摆在手里却从没画出来 —— 页面底部的空白就是这么来的。
     键是 yyyy-MM-dd，字典序即时间序，排完直接切片成 MM-DD 当 X 轴。 */
  const recentCommandTotals = useMemo(() => {
    const entries = Object.entries(dailyCommandCounts).sort(([a], [b]) => (a < b ? -1 : 1));
    return {
      dates: entries.map(([d]) => d.slice(5)),
      values: entries.map(([, v]) => v),
      total: entries.reduce((sum, [, v]) => sum + v, 0),
    };
  }, [dailyCommandCounts]);

  /* 画成竖条而不是折线：整行宽度是高度的十几倍，横向的线在这个比例下会压成一条装饰，
     竖条则顺着宽度自然排开，每天一根，缺哪天一眼就看出来。 */
  const recentTrendOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 700,
      animationEasing: 'cubicOut' as const,
      grid: { left: 2, right: 8, top: 12, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: recentCommandTotals.dates,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 9, hideOverlap: true, margin: 6 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { showMinLabel: false, hideOverlap: true, fontSize: 9, formatter: compactTick },
        splitNumber: 2,
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.45 } },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      series: [
        {
          type: 'bar',
          data: recentCommandTotals.values,
          barMaxWidth: 12,
          itemStyle: { color: barFill(ramp[0]), borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: ramp[0] } },
        },
      ],
    }),
    [recentCommandTotals, ramp],
  );

  // 命令使用量 - 排名横条
  // 排序交给前端：后端给的顺序是「注册顺序」不是「使用量顺序」，
  // 之前 #1（个股）落在最底下，排行图得从上往下读才成立，所以这里显式降序 + inverse。
  const rankedUsage = useMemo(
    () => [...dailyCommandUsage].sort((a, b) => b.count - a.count),
    [dailyCommandUsage],
  );

  const commandUsageOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 700,
      animationEasing: 'cubicOut' as const,
      grid: { left: 2, right: 14, bottom: 12, top: 12, containLabel: true },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10 },
        splitNumber: 3,
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.5 } },
      },
      yAxis: {
        type: 'category',
        data: rankedUsage.map((d) => d.command),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, width: 76, overflow: 'truncate' },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      // 单序列：ECharts 会按 series 名自动长出一个图例，压在 X 轴刻度上，必须显式关掉
      legend: { show: false },
      series: [
        {
          name: t('dashboard.callCount'),
          type: 'bar',
          /* 单序列排名图：命令名已经在 Y 轴上了，再按命令名上色就是纯装饰，
             十几条不同颜色的横条看着像彩虹。统一吃主题主色。 */
          data: rankedUsage.map((d) => d.count),
          itemStyle: { color: barFill(ramp[0]), borderRadius: BAR_RADIUS_RIGHT },
          barMaxWidth: BAR_THICKNESS,
          emphasis: { focus: 'series' },
        },
      ],
    }),
    [rankedUsage, ramp, t],
  );

  // 两张堆叠图的图例：分段已归一成「前 4 + 其他」，最多 5 项，单行放得下，不需要翻页。
  const buildStackLegend = useCallback(
    (names: string[], selected: Record<string, boolean>): EChartsOption['legend'] => ({
      orient: 'horizontal',
      ...LEGEND_BASE,
      itemGap: 14,
      data: names.map((name) => ({ name, icon: 'roundRect' as const })),
      bottom: 0,
      left: 'center',
      width: '94%',
      /* 内部名是哨兵，图例上要显示译文 */
      formatter: (name: string) => (name === OTHER_SERIES ? t('dashboard.otherCommands') : name),
      selected,
    }),
    [t],
  );

  const stackedTriggerTooltipFormatter = useCallback(
    (params: any) => {
      if (!Array.isArray(params) || params.length === 0) return '';
      const label = params[0].axisValue;
      let total = 0;
      let rows = '';
      params.forEach((p: any) => {
        if (p.value > 0) {
          total += p.value;
          const name = p.seriesName === OTHER_SERIES ? t('dashboard.otherCommands') : p.seriesName;
          rows += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:2px 0">
          <span style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
            ${name}
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
    [t],
  );

  /**
   * 两张堆叠图的共同骨架。差异只有数据源和分组键，所以抽成一个函数：
   * 命令种类经 buildTopSeries 归一成「前 4 + 其他」，行按总量降序 + yAxis.inverse，
   * 于是 #1 落在最上面、颜色索引也稳定，图例最多 5 项不用翻页。
   */
  const buildStackOption = useCallback(
    (data: TopSeries, visibility: Record<string, boolean>): EChartsOption => {
      const cells = stackedCells(data.rows.map((r) => r.values));
      const colors = stackColors(data.names, ramp, data.hasOther);
      // 没被用户显式关掉的分段一律显示：切日期/定时刷新后不会把手动隐藏的分段弹回来
      const selected: Record<string, boolean> = {};
      data.names.forEach((name) => {
        selected[name] = visibility[name] !== false;
      });
      return {
        animationDuration: 700,
        animationEasing: 'cubicOut' as const,
        grid: { left: 2, right: 14, bottom: 40, top: 12, containLabel: true },
        xAxis: {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { fontSize: 10 },
          splitNumber: 3,
          splitLine: { lineStyle: { type: 'dashed', opacity: 0.5 } },
        },
        yAxis: {
          type: 'category',
          data: data.rows.map((r) => r.id),
          inverse: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { fontSize: 10, width: 80, overflow: 'truncate' },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: stackedTriggerTooltipFormatter,
        },
        legend: buildStackLegend(data.names, selected),
        series: data.names.map((name, index) => ({
          name,
          type: 'bar' as const,
          stack: 'total',
          data: cells.map((row) => row[index]),
          barMaxWidth: BAR_THICKNESS,
          itemStyle: { color: colors[index] },
          emphasis: { focus: 'series' as const },
        })),
      };
    },
    [buildStackLegend, ramp, stackedTriggerTooltipFormatter],
  );

  // 群组命令触发量 - 堆叠水平柱状图
  const groupSeries = useMemo(
    () => buildTopSeries(dailyGroupTriggers, commandTypeList, 'group'),
    [dailyGroupTriggers, commandTypeList],
  );

  const groupTriggerOption = useMemo(
    () => buildStackOption(groupSeries, groupTriggerVisibility),
    [buildStackOption, groupSeries, groupTriggerVisibility],
  );

  // 个人命令触发量 - 堆叠水平柱状图
  const personalSeries = useMemo(
    () => buildTopSeries(dailyPersonalTriggers, commandTypeList, 'user'),
    [dailyPersonalTriggers, commandTypeList],
  );

  const personalTriggerOption = useMemo(
    () => buildStackOption(personalSeries, personalTriggerVisibility),
    [buildStackOption, personalSeries, personalTriggerVisibility],
  );

  // 三张按日图并排在同一行：取三者所需高度的最大值，行底才齐平。
  // 行数少就整体缩矮 —— 这是唯一能同时消掉空白又不把条撑粗的办法。
  const dayChartHeight = useMemo(() => {
    const needed = Math.max(
      dailyCommandUsage.length * DAY_ROW_HEIGHT + 56,
      dailyGroupTriggers.length * DAY_ROW_HEIGHT + 88,
      dailyPersonalTriggers.length * DAY_ROW_HEIGHT + 88,
    );
    return Math.min(Math.max(needed, DAY_CHART_MIN), DAY_CHART_MAX);
  }, [dailyCommandUsage.length, dailyGroupTriggers.length, dailyPersonalTriggers.length]);

  /* 按日图的明细视图。同一时刻只展开一张：三张同时展开会把页面拉成三四屏，
     概览本身就没意义了；一次看一张，要横向比较靠上面那些月度小倍数。
     null 表示都没展开。 */
  const [expandedDay, setExpandedDay] = useState<DayBlockKey | null>(null);
  const toggleDay = useCallback((key: DayBlockKey) => {
    setExpandedDay((cur) => (cur === key ? null : key));
  }, []);

  // Legend 切换事件处理
  const handleLegendSelectChanged = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
      keyMap: Record<string, string>,
    ) => {
      return (params: any) => {
        if (params.type === 'legendselectchanged') {
          setter((prev) => {
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
    },
    [],
  );

  const groupTriggerLegendHandler = useMemo(() => {
    const keyMap: Record<string, string> = {};
    groupSeries.names.forEach((name) => {
      keyMap[name] = name;
    });
    return handleLegendSelectChanged(setGroupTriggerVisibility, keyMap);
  }, [groupSeries.names, handleLegendSelectChanged]);

  const personalTriggerLegendHandler = useMemo(() => {
    const keyMap: Record<string, string> = {};
    personalSeries.names.forEach((name) => {
      keyMap[name] = name;
    });
    return handleLegendSelectChanged(setPersonalTriggerVisibility, keyMap);
  }, [personalSeries.names, handleLegendSelectChanged]);

  return (
    <PinnedPage
      /* gap-3 md:gap-4：一屏要塞下磁贴 + 两行图表，默认的 gap-3 md:gap-6 会在三段之间白掉 24px */
      className="gap-3 md:gap-4"
      header={
        <div>
          {/* 「更新于」与副标题底边对齐：窄屏筛选独占整行后，toolbar 没有它的位置 */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <LayoutGrid className="w-8 h-8 shrink-0" />
                <span className="truncate">{t('dashboard.title')}</span>
              </h1>
              <p className="text-muted-foreground mt-1">{t('dashboard.description')}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
              {t('dashboard.lastUpdated')}
              {updatedAt ? ` ${format(updatedAt, 'HH:mm:ss')}` : ''}
            </span>
          </div>
        </div>
      }
      toolbar={
        /* 日期是下方三块图表的筛选条件，跟着标题常驻；切换后不用滚回中间。
            窄屏下两个 flex-1 筛选各占半行铺满 */
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  tabToolbarControlClass,
                  'ui-field-trigger min-w-0 flex-1 justify-start px-3 font-normal sm:w-[220px] sm:flex-none',
                  !selectedDate && 'text-muted-foreground',
                )}
              >
                <span className="truncate tabular-nums">
                  {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : t('dashboard.selectDate')}
                </span>
                {(dailyCommandCounts[dateStr] ?? 0) > 0 && (
                  <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">
                    {dailyCommandCounts[dateStr]}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
              <MetricDayCalendar
                selected={selectedDate}
                onSelect={setSelectedDate}
                metrics={dailyCommandCounts}
                disableEmpty
                formatMetric={(n) => String(n)}
              />
            </PopoverContent>
          </Popover>
          <span className="flex min-w-0 flex-1 items-center sm:flex-none">
            <Select value={selectedBot} onValueChange={setSelectedBot}>
              <SelectTrigger className={cn(tabToolbarControlClass, 'w-full sm:w-[180px]')}>
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
          </span>
        </div>
      }
    >
      {/* 整页一块一块的磁贴：外层 glass-card-grid 统一留阴影安全区，内层网格用纯工具类控间距
          （glass-card-grid 自带 margin-block，会压掉 Tailwind 的 mt-*，别叠着用） */}
      <div className="glass-card-grid">
        {/* 指标区：1 个主指标 + 8 个次要指标，同一行、齐高。
Hero 只占 2 列：它是三行短文本，给 3 列会在右侧留出一大片空白，
主次差距靠字号拉开就够了，不必靠面积。
次要区用 col-span-10 / grid-cols-8 —— 容器宽度是 10 列，格子按 8 等分（每格约 150px），
容器和网格列数不必相等，这样 8 个指标刚好一行排满。 */}
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
          <div className="md:col-span-12 xl:col-span-2">
            <MetricHero
              title={heroMetric.title}
              value={heroMetric.value}
              desc={heroMetric.desc}
              icon={heroMetric.icon}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:col-span-12 xl:col-span-10 xl:grid-cols-8">
            {restMetrics.map((metric) => (
              <MetricMini
                key={metric.key}
                title={metric.title}
                value={metric.value}
                desc={metric.desc}
              />
            ))}
          </div>
        </div>

        {/* 月度对照独占一个栅格：8+4 一行，展开按日图时不会被它挤动。 */}
        <div className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-12">
          <DataBlock
            title={t('dashboard.monthlyCommandStats')}
            icon={MessageSquare}
            className="md:col-span-2 xl:col-span-8"
          >
            {/* 小倍数：一项指标一格，各自独立 Y 轴，互不压平。
                窄屏 2 列（否则每格太窄、Y 轴刻度会被邻格切掉），xl 起铺满一行。 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 xl:grid-cols-4">{commandSparks}</div>
          </DataBlock>

          <DataBlock title={t('dashboard.monthlyUserStats')} icon={Users} className="xl:col-span-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">{audienceSparks}</div>
          </DataBlock>
        </div>

        {/* 三张按日图自己一个栅格。单独拆出来是给展开用的：展开时要把该卡 order-first
            顶到本组最前，若和月度卡共用栅格，顶的会是整个数据区，月度对照会被压下去。
            收起时 4+4+4 铺一行，展开时 12 / 6+6 两行，两种排法都填满整行。 */}
        <div className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-12">
          <DayBlock
            blockKey="command"
            expandedKey={expandedDay}
            onToggle={toggleDay}
            title={t('dashboard.commandUsage')}
            icon={ChartColumn}
            option={commandUsageOption}
            rows={dailyCommandUsage.length}
            compactHeight={dayChartHeight}
          />

          <DayBlock
            blockKey="group"
            expandedKey={expandedDay}
            onToggle={toggleDay}
            title={t('dashboard.groupCommandTrigger')}
            icon={UsersRound}
            option={groupTriggerOption}
            rows={dailyGroupTriggers.length}
            compactHeight={dayChartHeight}
            onEvents={{ legendselectchanged: groupTriggerLegendHandler }}
          />

          <DayBlock
            blockKey="personal"
            expandedKey={expandedDay}
            onToggle={toggleDay}
            title={t('dashboard.personalCommandTrigger')}
            icon={UserRound}
            option={personalTriggerOption}
            rows={dailyPersonalTriggers.length}
            compactHeight={dayChartHeight}
            onEvents={{ legendselectchanged: personalTriggerLegendHandler }}
          />
        </div>

        {/* 近 60 天总量单独占一整行：60 根竖条在四分之一宽的格子里会挤成一片，
            摊到全宽才有「哪几天塌了」这种可读性。合计数挂在标题右侧当读数。 */}
        <div className="mt-3">
          <DataBlock
            title={t('dashboard.recentTrend')}
            icon={ChartColumn}
            extra={
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('dashboard.recentTrendTotal', { count: recentCommandTotals.total })}
              </span>
            }
          >
            <EChartsWrapper option={recentTrendOption} height={RECENT_TREND_HEIGHT} />
          </DataBlock>
        </div>
      </div>
    </PinnedPage>
  );
}
