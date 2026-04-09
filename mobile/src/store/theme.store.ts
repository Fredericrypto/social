import { create } from 'zustand';
import { lightTheme, darkTheme, Theme } from '../theme';

interface ThemeState {
  isDark: boolean;
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,
  theme: darkTheme,
  toggle: () => {
    const isDark = !get().isDark;
    set({ isDark, theme: isDark ? darkTheme : lightTheme });
  },
}));
