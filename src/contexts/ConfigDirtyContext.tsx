import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ConfigDirtyContextType {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const ConfigDirtyContext = createContext<ConfigDirtyContextType | undefined>(undefined);

export function ConfigDirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  return (
    <ConfigDirtyContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </ConfigDirtyContext.Provider>
  );
}

export function useConfigDirty() {
  const context = useContext(ConfigDirtyContext);
  if (context === undefined) {
    throw new Error('useConfigDirty must be used within a ConfigDirtyProvider');
  }
  return context;
}
