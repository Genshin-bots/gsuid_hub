import { lazy, Suspense, type ReactNode } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { LuminousGlassFilter } from '@/components/ui/LuminousGlassFilter';
import { LiquidGlassFilter } from '@/components/ui/LiquidGlassFilter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ConfigDirtyProvider } from '@/contexts/ConfigDirtyContext';
import { AIStatusProvider } from '@/contexts/AIStatusContext';
import { BrandProvider } from '@/contexts/BrandContext';
import { PageSpinner } from '@/components/layout/PageSpinner';
import Login from '@/pages/Login';

const AppLayout = lazy(() =>
  import('@/components/layout/AppLayout').then((m) => ({ default: m.AppLayout })),
);
const HomePage = lazy(() => import('@/pages/HomePage'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const DatabasePage = lazy(() => import('@/pages/DatabasePage'));
const PluginsPage = lazy(() => import('@/pages/PluginsPage'));
const PluginViewPage = lazy(() => import('@/pages/PluginViewPage'));
const LogsPage = lazy(() => import('@/pages/LogsPage'));
const ThemesPage = lazy(() => import('@/pages/ThemesPage'));
const ConsolePage = lazy(() => import('@/pages/ConsolePage'));
const SchedulerPage = lazy(() => import('@/pages/SchedulerPage'));
const PluginStorePage = lazy(() => import('@/pages/PluginStorePage'));
const GitUpdatePage = lazy(() => import('@/pages/GitUpdatePage'));
const FrameworkConfigPage = lazy(() => import('@/pages/FrameworkConfigPage'));
const BackupPage = lazy(() => import('@/pages/BackupPage'));
const AIConfigPage = lazy(() => import('@/pages/AIConfigPage'));
const PersonaConfigPage = lazy(() => import('@/pages/PersonaConfigPage'));
const PersonaStorePage = lazy(() => import('@/pages/PersonaStorePage'));
const AIToolsPage = lazy(() => import('@/pages/AIToolsPage'));
const AIStatisticsPage = lazy(() => import('@/pages/AIStatisticsPage'));
const AIMemoryPage = lazy(() => import('@/pages/AIMemoryPage'));
const AIKnowledgePage = lazy(() => import('@/pages/AIKnowledgePage'));
const AIMemePage = lazy(() => import('@/pages/AIMemePage'));
const SessionManagementPage = lazy(() => import('@/pages/SessionManagementPage'));
const AIHistoryPage = lazy(() => import('@/pages/AIHistoryPage'));
const MCPMarketPage = lazy(() => import('@/pages/MCPMarketPage'));
const AIKanbanPage = lazy(() => import('@/pages/AIKanbanPage'));
const AIApprovalsPage = lazy(() => import('@/pages/AIApprovalsPage'));
const AIBudgetPage = lazy(() => import('@/pages/AIBudgetPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const BrandSettingsPage = lazy(() => import('@/pages/BrandSettingsPage'));
const BatchPushPage = lazy(() => import('@/pages/BatchPushPage'));
const AIOutputsPage = lazy(() => import('@/pages/AIOutputsPage'));
const GroupProfilePage = lazy(() => import('@/pages/GroupProfilePage'));
const AIOpsPage = lazy(() => import('@/pages/AIOpsPage'));
const AIDebugPage = lazy(() => import('@/pages/AIDebugPage'));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageSpinner fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * /ai-runtime 已改名 /ai-debug；「关系温度」挪到 /ai-artifacts。
 * 旧 ?tab= 深链按新归属分流：relationship→产出物页，其余诊断页签透传到 /ai-debug。
 */
function LegacyAiRuntimeRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  if (tab === 'relationship') {
    return <Navigate to="/ai-artifacts?tab=relationship" replace />;
  }
  const allowed = new Set([
    'ops',
    'assemble',
    'entityIndex',
    'slots',
    'hooks',
    'cognition',
    'group',
  ]);
  const params = new URLSearchParams(searchParams);
  if (!tab || !allowed.has(tab)) {
    params.delete('tab');
  }
  const suffix = params.toString();
  return <Navigate to={`/ai-debug${suffix ? `?${suffix}` : ''}`} replace />;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageSpinner fullPage />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<PageSpinner fullPage />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="database"
            element={
              <AdminRoute>
                <DatabasePage />
              </AdminRoute>
            }
          />
          <Route path="plugins" element={<PluginsPage />} />
          <Route path="plugin-view/:pluginId/:pageId?" element={<PluginViewPage />} />
          <Route path="logs" element={<LogsPage />} />
          {/* 命令追踪与 HTTP 追踪已并入 /logs，旧深链重定向过去 */}
          <Route path="traces" element={<Navigate to="/logs" replace />} />
          <Route path="http-traces" element={<Navigate to="/logs?tab=http-traces" replace />} />
          <Route path="themes" element={<ThemesPage />} />
          <Route path="console" element={<ConsolePage />} />
          <Route path="scheduler" element={<SchedulerPage />} />
          <Route path="plugin-store" element={<PluginStorePage />} />
          <Route path="git-update" element={<GitUpdatePage />} />
          <Route path="framework-config" element={<FrameworkConfigPage />} />
          <Route path="ai-config" element={<AIConfigPage />} />
          <Route path="persona-config" element={<PersonaConfigPage />} />
          <Route path="persona-store" element={<PersonaStorePage />} />
          {/* MCP 配置已并入 /ai-tools 的「MCP 配置」页签，旧深链重定向过去 */}
          <Route path="mcp-config" element={<Navigate to="/ai-tools?tab=mcp" replace />} />
          <Route path="mcp-market" element={<MCPMarketPage />} />
          {/* 能力代理已并入 /persona-config 的「人格代理」页签，旧深链重定向过去 */}
          <Route
            path="ai-capability-agents"
            element={<Navigate to="/persona-config?tab=capability-agents" replace />}
          />
          <Route path="ai-tools" element={<AIToolsPage />} />
          {/* 技能已并入 /ai-tools 的「技能列表」页签，旧深链重定向过去 */}
          <Route path="ai-skills" element={<Navigate to="/ai-tools?tab=skills" replace />} />
          <Route path="ai-statistics" element={<AIStatisticsPage />} />
          {/* 定时任务已并入 /ai-kanban 的「定时任务」页签，旧深链重定向过去 */}
          <Route
            path="ai-scheduled-tasks"
            element={<Navigate to="/ai-kanban?mode=tasks" replace />}
          />
          <Route path="ai-knowledge" element={<AIKnowledgePage />} />
          <Route path="ai-meme" element={<AIMemePage />} />
          <Route path="ai-memory" element={<AIMemoryPage />} />
          <Route path="session-management" element={<SessionManagementPage />} />
          {/* 实时聊天已并入 /session-management 的「自主创建」虚拟会话，旧深链重定向过去 */}
          <Route path="live-chat" element={<Navigate to="/session-management" replace />} />
          <Route path="ai-history" element={<AIHistoryPage />} />
          <Route path="ai-kanban" element={<AIKanbanPage />} />
          <Route path="ai-approvals" element={<AIApprovalsPage />} />
          <Route path="ai-budget" element={<AIBudgetPage />} />
          {/* 核心配置已并入 /framework-config 的首个页签，旧深链重定向过去 */}
          <Route
            path="core-config"
            element={<Navigate to="/framework-config?tab=core" replace />}
          />
          {/* 状态存储已并入 /ai-kanban 的「数据模式」，旧深链重定向过去 */}
          <Route path="state-store" element={<Navigate to="/ai-kanban?mode=data" replace />} />
          <Route path="group-profile" element={<GroupProfilePage />} />
          <Route
            path="backup"
            element={
              <AdminRoute>
                <BackupPage />
              </AdminRoute>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="brand-settings" element={<BrandSettingsPage />} />
          <Route
            path="batch-push"
            element={
              <AdminRoute>
                <BatchPushPage />
              </AdminRoute>
            }
          />
          <Route path="ai-ops" element={<AIOpsPage />} />
          <Route path="ai-debug" element={<AIDebugPage />} />
          {/* /ai-runtime 改名 /ai-debug：运维排查（关系温度已挪到 /ai-artifacts） */}
          <Route path="ai-runtime" element={<LegacyAiRuntimeRedirect />} />
          {/* 产出物与工具落盘合并页：页签走 ?tab=，侧边栏仍是单个入口 */}
          <Route path="ai-artifacts" element={<AIOutputsPage />} />
          <Route
            path="ai-tool-outputs"
            element={<Navigate to="/ai-artifacts?tab=toolOutputs" replace />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        {/* BrandProvider 放在 AuthProvider 之上，因为 /api/brand 是公开接口，
            登录页加载就需要展示品牌信息 */}
        <BrandProvider>
          <AuthProvider>
            <ConfigDirtyProvider>
              <AIStatusProvider>
                <TooltipProvider>
                  <Sonner />
                  <LuminousGlassFilter />
                  <LiquidGlassFilter />
                  <HashRouter>
                    <AppRoutes />
                  </HashRouter>
                </TooltipProvider>
              </AIStatusProvider>
            </ConfigDirtyProvider>
          </AuthProvider>
        </BrandProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
