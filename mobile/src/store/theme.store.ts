import { create } from "zustand";
import {
  Theme, darkTheme, lightTheme,
  ALL_THEMES,
} from "../theme";

interface ThemeState {
  isDark: boolean;
  themeId: string;
  theme: Theme;
  toggle: () => void;
  setDark: (v: boolean) => void;
  setThemeId: (id: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark:  true,
  themeId: "midnight",
  theme:   darkTheme,

  setDark: (isDark) => {
    const { themeId } = get();
    const found = ALL_THEMES.find(t => t.id === themeId);
    set({
      isDark,
      theme: isDark
        ? (found?.dark  ?? darkTheme)
        : (found?.light ?? lightTheme),
    });
  },

  toggle: () => {
    const { isDark, themeId } = get();
    const next = !isDark;
    const found = ALL_THEMES.find(t => t.id === themeId);
    set({
      isDark: next,
      theme: next
        ? (found?.dark  ?? darkTheme)
        : (found?.light ?? lightTheme),
    });
  },

  setThemeId: (id) => {
    const { isDark } = get();
    const found = ALL_THEMES.find(t => t.id === id);
    if (!found) return;
    set({
      themeId: id,
      theme: isDark ? found.dark : found.light,
    });
  },
}));
