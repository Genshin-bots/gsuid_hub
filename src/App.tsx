import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import FrameworkConfigPage from "@/pages/FrameworkConfigPage";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ConfigDirtyProvider } from "@/contexts/ConfigDirtyContext";
import { AIStatusProvider } from "@/contexts/AIStatusContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import HomePage from "@/pages/HomePage";
import Dashboard from "@/pages/Dashboard";
import DatabasePage from "@/pages/DatabasePage";
import PluginsPage from "@/pages/PluginsPage";
import LogsPage from "@/pages/LogsPage";
import TracesPage from "@/pages/TracesPage";
import ThemesPage from "@/pages/ThemesPage";
import ConsolePage from "@/pages/ConsolePage";
import SchedulerPage from "@/pages/SchedulerPage";
import PluginStorePage from "@/pages/PluginStorePage";
import GitUpdatePage from "@/pages/GitUpdatePage";
import CoreConfigPage from "@/pages/CoreConfigPage";
import BackupPage from "@/pages/BackupPage";
import AIConfigPage from "@/pages/AIConfigPage";
import PersonaConfigPage from "@/pages/PersonaConfigPage";
import AICapabilityAgentsPage from "@/pages/AICapabilityAgentsPage";
import AIToolsPage from "@/pages/AIToolsPage";
import AISkillsPage from "@/pages/AISkillsPage";
import AIStatisticsPage from "@/pages/AIStatisticsPage";
import AIMemoryPage from "@/pages/AIMemoryPage";
import AIScheduledTasksPage from "@/pages/AIScheduledTasksPage";
import AIKnowledgePage from "@/pages/AIKnowledgePage";
import AIMemePage from "@/pages/AIMemePage";
import SessionManagementPage from "@/pages/SessionManagementPage";
import AIHistoryPage from "@/pages/AIHistoryPage";
import MCPConfigPage from "@/pages/MCPConfigPage";
import AIKanbanPage from "@/pages/AIKanbanPage";
import AIApprovalsPage from "@/pages/AIApprovalsPage";
import AIBudgetPage from "@/pages/AIBudgetPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import BrandSettingsPage from "@/pages/BrandSettingsPage";
import BatchPushPage from "@/pages/BatchPushPage";
import AIDebugPage from "@/pages/AIDebugPage";
import AIArtifactsPage from "@/pages/AIArtifactsPage";
import AIToolOutputsPage from "@/pages/AIToolOutputsPage";
import StateStorePage from "@/pages/StateStorePage";
import GroupProfilePage from "@/pages/GroupProfilePage";
import AIOpsPage from "@/pages/AIOpsPage";
import AIRuntimePage from "@/pages/AIRuntimePage";
import LiveChatPage from "@/pages/LiveChatPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
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
        <Route path="database" element={<AdminRoute><DatabasePage /></AdminRoute>} />
        <Route path="plugins" element={<PluginsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="traces" element={<TracesPage />} />
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
        <Route path="core-config" element={<AdminRoute><CoreConfigPage /></AdminRoute>} />
        <Route path="state-store" element={<StateStorePage />} />
        <Route path="group-profile" element={<GroupProfilePage />} />
        <Route path="backup" element={<AdminRoute><BackupPage /></AdminRoute>} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="brand-settings" element={<BrandSettingsPage />} />
        <Route path="batch-push" element={<AdminRoute><BatchPushPage /></AdminRoute>} />
        <Route path="ai-debug" element={<AIDebugPage />} />
        <Route path="ai-ops" element={<AIOpsPage />} />
        <Route path="ai-runtime" element={<AIRuntimePage />} />
        <Route path="ai-artifacts" element={<AIArtifactsPage />} />
        <Route path="ai-tool-outputs" element={<AIToolOutputsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
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
