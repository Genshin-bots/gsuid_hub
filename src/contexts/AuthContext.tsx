import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { authApi, User, getAuthToken, setAuthToken } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, registerCode?: string, isAdmin?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData);
      } catch {
        localStorage.removeItem('auth_user');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const response = await authApi.login(email, password);
      
      if (response.user && response.token) {
        const userData = response.user;
        setUser(userData);
        setAuthToken(response.token);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        setIsLoading(false);
        return { success: true };
      }
      
      setIsLoading(false);
      return { success: false, error: '登录失败' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error instanceof Error ? error.message : '登录失败' };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, registerCode: string = '', isAdmin: boolean = false): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const response = await authApi.register(name, email, password, registerCode, isAdmin);
      
      if (response.user && response.token) {
        const userData = response.user;
        setUser(userData);
        setAuthToken(response.token);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        setIsLoading(false);
        return { success: true };
      }
      
      setIsLoading(false);
      return { success: false, error: response.msg || '注册失败' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error instanceof Error ? error.message : '注册失败' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setAuthToken(null);
      localStorage.removeItem('auth_user');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      localStorage.setItem('auth_user', JSON.stringify(userData));
    } catch {
      // Ignore refresh errors
    }
  }, []);

  // 使用useMemo缓存context value，避免不必要的重渲染
  const contextValue = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
      isAuthenticated: !!user,
    }),
    [user, isLoading, login, register, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
