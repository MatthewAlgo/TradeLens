import { create } from 'zustand';

type AppView = 'trading' | 'backtest' | 'settings';

interface UIState {
  view: AppView;
  isSidebarOpen: boolean;
  theme: 'dark' | 'light';
  
  setView: (view: AppView) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'trading',
  isSidebarOpen: true,
  theme: 'dark',
  
  setView: (view) => set({ view }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
