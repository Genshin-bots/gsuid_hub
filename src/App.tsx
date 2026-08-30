import { lazy, Suspense, type ReactNode } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const TracesPage = lazy(() => import('@/pages/TracesPage'));
const HttpTracesPage = lazy(() => import('@/pages/HttpTracesPage'));
const ThemesPage = lazy(() => import('@/pages/ThemesPage'));
const ConsolePage = lazy(() => import('@/pages/ConsolePage'));
const SchedulerPage = lazy(() => import('@/pages/SchedulerPage'));
const PluginStorePage = lazy(() => import('@/pages/PluginStorePage'));
const GitUpdatePage = lazy(() => import('@/pages/GitUpdatePage'));
const FrameworkConfigPage = lazy(() => import('@/pages/FrameworkConfigPage'));
const CoreConfigPage = lazy(() => import('@/pages/CoreConfigPage'));
const BackupPage = lazy(() => import('@/pages/BackupPage'));
const AIConfigPage = lazy(() => import('@/pages/AIConfigPage'));
const PersonaConfigPage = lazy(() => import('@/pages/PersonaConfigPage'));
const AICapabilityAgentsPage = lazy(() => import('@/pages/AICapabilityAgentsPage'));
const AIToolsPage = lazy(() => import('@/pages/AIToolsPage'));
const AISkillsPage = lazy(() => import('@/pages/AISkillsPage'));
const AIStatisticsPage = lazy(() => import('@/pages/AIStatisticsPage'));
const AIMemoryPage = lazy(() => import('@/pages/AIMemoryPage'));
const AIScheduledTasksPage = lazy(() => import('@/pages/AIScheduledTasksPage'));
const AIKnowledgePage = lazy(() => import('@/pages/AIKnowledgePage'));
const AIMemePage = lazy(() => import('@/pages/AIMemePage'));
const SessionManagementPage = lazy(() => import('@/pages/SessionManagementPage'));
const AIHistoryPage = lazy(() => import('@/pages/AIHistoryPage'));
const MCPConfigPage = lazy(() => import('@/pages/MCPConfigPage'));
const AIKanbanPage = lazy(() => import('@/pages/AIKanbanPage'));
const AIApprovalsPage = lazy(() => import('@/pages/AIApprovalsPage'));
const AIBudgetPage = lazy(() => import('@/pages/AIBudgetPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const BrandSettingsPage = lazy(() => import('@/pages/BrandSettingsPage'));
const BatchPushPage = lazy(() => import('@/pages/BatchPushPage'));
const AIDebugPage = lazy(() => import('@/pages/AIDebugPage'));
const AIArtifactsPage = lazy(() => import('@/pages/AIArtifactsPage'));
const AIToolOutputsPage = lazy(() => import('@/pages/AIToolOutputsPage'));
const StateStorePage = lazy(() => import('@/pages/StateStorePage'));
const GroupProfilePage = lazy(() => import('@/pages/GroupProfilePage'));
const AIOpsPage = lazy(() => import('@/pages/AIOpsPage'));
const AIRuntimePage = lazy(() => import('@/pages/AIRuntimePage'));
const LiveChatPage = lazy(() => import('@/pages/LiveChatPage'));

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
          <Route path="traces" element={<TracesPage />} />
          <Route path="http-traces" element={<HttpTracesPage />} />
          <Route path="themes" element={<ThemesPage />} />
          <Route path="console" element={<ConsolePage />} />
          <Route path="scheduler" element={<SchedulerPage />} />
          <Route path="plugin-store" element={<PluginStorePage />} />
          <Route path="git-update" element={<GitUpdatePage />} />
          <Route path="framework-config" element={<FrameworkConfigPage />} />
          <Route path="ai-config" element={<AIConfigPage />} />
          <Route path="persona-config" element={<PersonaConfigPage />} />
          <Route path="mcp-config" element={<MCPConfigPage />} />
          <Route path="ai-capability-agents" element={<AICapabilityAgentsPage />} />
          <Route path="ai-tools" element={<AIToolsPage />} />
          <Route path="ai-skills" element={<AISkillsPage />} />
          <Route path="ai-statistics" element={<AIStatisticsPage />} />
          <Route path="ai-scheduled-tasks" element={<AIScheduledTasksPage />} />
          <Route path="ai-knowledge" element={<AIKnowledgePage />} />
          <Route path="ai-meme" element={<AIMemePage />} />
          <Route path="ai-memory" element={<AIMemoryPage />} />
          <Route path="session-management" element={<SessionManagementPage />} />
          <Route path="live-chat" element={<LiveChatPage />} />
          <Route path="ai-history" element={<AIHistoryPage />} />
          <Route path="ai-kanban" element={<AIKanbanPage />} />
          <Route path="ai-approvals" element={<AIApprovalsPage />} />
          <Route path="ai-budget" element={<AIBudgetPage />} />
          <Route
            path="core-config"
            element={
              <AdminRoute>
                <CoreConfigPage />
              </AdminRoute>
            }
          />
          <Route path="state-store" element={<StateStorePage />} />
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
          <Route path="ai-debug" element={<AIDebugPage />} />
          <Route path="ai-ops" element={<AIOpsPage />} />
          <Route path="ai-runtime" element={<AIRuntimePage />} />
          <Route path="ai-artifacts" element={<AIArtifactsPage />} />
          <Route path="ai-tool-outputs" element={<AIToolOutputsPage />} />
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
