import { create } from "zustand";
import { lightTheme, darkTheme, Theme } from "../theme";

interface ThemeState {
  isDark: boolean;
  theme: Theme;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: true,           // dark como padrão — nunca pisca branco
  theme: darkTheme,
  setDark: (isDark) => set({ isDark, theme: isDark ? darkTheme : lightTheme }),
  toggle: () =>
    set((state) => ({
      isDark: !state.isDark,
      theme: state.isDark ? lightTheme : darkTheme,
    })),
}));
