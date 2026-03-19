import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import FrameworkConfigPage from "@/pages/FrameworkConfigPage";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import DatabasePage from "@/pages/DatabasePage";
import PluginsPage from "@/pages/PluginsPage";
import LogsPage from "@/pages/LogsPage";
import ThemesPage from "@/pages/ThemesPage";
import ConsolePage from "@/pages/ConsolePage";
import SchedulerPage from "@/pages/SchedulerPage";
import PluginStorePage from "@/pages/PluginStorePage";
import CoreConfigPage from "@/pages/CoreConfigPage";
import BackupPage from "@/pages/BackupPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

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

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="database" element={<DatabasePage />} />
        <Route path="plugins" element={<PluginsPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="themes" element={<ThemesPage />} />
        <Route path="console" element={<ConsolePage />} />
        <Route path="scheduler" element={<SchedulerPage />} />
        <Route path="plugin-store" element={<PluginStorePage />} />
        <Route path="framework-config" element={<FrameworkConfigPage />} />
        <Route path="core-config" element={<CoreConfigPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
